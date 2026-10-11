/**
 * The resumable evidence upload (T-055; API-131, API-132, API-133; UC-CIT-023).
 *
 * - **Only what was captured is sent.** Before anything leaves the phone, every
 *   kept file is read and hashed again; a file that no longer matches its hash at
 *   capture, or is gone, stops the upload and is never sent (evidence-first; the
 *   server recomputes every hash too).
 * - **An interrupted upload resumes from the last chunk the server confirmed.**
 *   The server holds what it received; on every run the device asks it (API-133)
 *   and sends only the rest. A chunk whose answer was lost is sent again, which the
 *   server treats as a replay. Nothing about the upload is stored on the phone.
 * - **A chunk the server reports as damaged in transit** (`E_CAPTURE_INTEGRITY`)
 *   is sent again, up to UPLOAD.chunkTries times. An item whose reassembled bytes
 *   fail the server's check is sent once more from the start.
 * - When every item is on the server, the manifest is completed (API-132), which
 *   starts the server's processing. Until a report exists, what was uploaded is
 *   temporary processing data (DG-55).
 * - **The local draft and its files are never changed here.** The server's refusals
 *   are returned for the screens to explain; the evidence stays on the phone.
 *
 * Nothing here starts on its own: the reporting flow calls it (T-052, T-058).
 */
import {
  completeEvidenceManifest,
  type EvidenceManifest,
  fetchDraft,
  type ServerDraft,
  type ServerLifecycle,
  sendEvidenceChunk,
} from "../api/reporting";
import { ApiError, OfflineError } from "../api/errors";
import { chunkCount, chunkRange, manifestText, toBase64, UPLOAD } from "../domain/upload";
import { utf8 } from "../storage/bytes";
import type { DraftRepository, EvidenceRow } from "../storage/drafts";
import { draftMediaFile, sha256Hex } from "../storage/media";

export type UploadApi = {
  fetchDraft: typeof fetchDraft;
  sendEvidenceChunk: typeof sendEvidenceChunk;
  completeEvidenceManifest: typeof completeEvidenceManifest;
};

const SERVER: UploadApi = { fetchDraft, sendEvidenceChunk, completeEvidenceManifest };

export type UploadResult =
  | { kind: "complete"; draft: ServerDraft }
  /** The connection dropped. What the server confirmed stays there, and the next run continues from it. */
  | { kind: "offline" }
  /** The server does not hold this draft yet: it is opened first (API-130). */
  | { kind: "not_on_server" }
  /** The draft on the server can no longer take evidence. */
  | { kind: "not_active"; lifecycle: Exclude<ServerLifecycle, "absent" | "active"> }
  /** A kept file is gone, or no longer matches its hash at capture. It is never sent. */
  | { kind: "evidence_missing" | "evidence_changed"; evidenceId: string }
  /** The server kept finding these items damaged in transit. */
  | { kind: "integrity_failed"; evidenceIds: string[] }
  /** The server refused the evidence for a reason the reporter must act on (for example `video_duration`). */
  | { kind: "refused"; code: string; field: string | null; evidenceIds: string[] };

export type UploadProgress = { sentBytes: number; totalBytes: number };

type Options = { api?: UploadApi; onProgress?: (progress: UploadProgress) => void };

/** A stop with a reason, carried out of the nested loops. */
class Stop extends Error {
  constructor(readonly result: UploadResult) {
    super(result.kind);
  }
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

function asResult(error: unknown): UploadResult {
  if (error instanceof Stop) return error.result;
  if (error instanceof OfflineError) return { kind: "offline" };
  if (error instanceof ApiError) {
    const evidenceIds = ids(error.details.evidence_ids);
    // Damaged again after it was sent once more: reported as damage, not as a refusal.
    if (error.code === "E_CAPTURE_INTEGRITY" && evidenceIds.length > 0)
      return { kind: "integrity_failed", evidenceIds };
    const field = typeof error.details.field === "string" ? error.details.field : null;
    return { kind: "refused", code: error.code, field, evidenceIds };
  }
  throw error; // a signed-out session or a programming error is not an upload outcome
}

/** The file exactly as captured, or a stop. */
async function capturedBytes(item: EvidenceRow): Promise<Uint8Array> {
  const file = draftMediaFile(item.file_name);
  if (!file.exists) throw new Stop({ kind: "evidence_missing", evidenceId: item.evidence_id });
  const bytes = await file.bytes();
  if (bytes.length !== item.byte_size || (await sha256Hex(bytes)) !== item.sha256) {
    throw new Stop({ kind: "evidence_changed", evidenceId: item.evidence_id });
  }
  return bytes;
}

export async function uploadDraftEvidence(
  drafts: DraftRepository,
  draftId: string,
  { api = SERVER, onProgress }: Options = {},
): Promise<UploadResult> {
  // Only items whose file has reached the draft; one still being moved is finished on the next open.
  const items = (await drafts.evidence(draftId)).filter((e) => e.source_uri === null);
  const counts = new Map<string, number>();
  const totalBytes = items.reduce((n, e) => n + e.byte_size, 0);
  let sentBytes = 0;
  const report = () => onProgress?.({ sentBytes, totalBytes });

  async function sendChunks(item: EvidenceRow, indexes: readonly number[]): Promise<void> {
    if (indexes.length === 0) return;
    const bytes = await capturedBytes(item); // checked again right before it is sent
    const count = counts.get(item.evidence_id) ?? chunkCount(item.byte_size);
    for (const index of indexes) {
      const [start, end] = chunkRange(item.byte_size, count, index);
      const chunk = bytes.slice(start, end);
      const body = {
        evidence_id: item.evidence_id,
        kind: item.kind,
        mime_type: item.mime_type,
        byte_size: item.byte_size,
        sha256: item.sha256,
        captured_at: item.captured_at,
        chunk_index: index,
        chunk_count: count,
        chunk_sha256: await sha256Hex(chunk),
        chunk_base64: toBase64(chunk),
      };
      for (let tries = 1; ; tries++) {
        try {
          await api.sendEvidenceChunk(draftId, body);
          break;
        } catch (error) {
          const damaged = error instanceof ApiError && error.code === "E_CAPTURE_INTEGRITY";
          if (!damaged) throw error;
          if (tries >= UPLOAD.chunkTries)
            throw new Stop({ kind: "integrity_failed", evidenceIds: [item.evidence_id] });
        }
      }
      sentBytes += end - start;
      report();
    }
  }

  const all = (count: number, from = 0) => Array.from({ length: count - from }, (_, i) => from + i);

  try {
    // 1. Nothing is sent unless every kept file is still exactly what was captured.
    for (const item of items) await capturedBytes(item);

    // 2. Where the server stands.
    const server = await api.fetchDraft(draftId);
    if (!server) return { kind: "not_on_server" };
    if (server.lifecycle !== "active") return { kind: "not_active", lifecycle: server.lifecycle };
    const held = new Map(server.evidence.map((e) => [e.evidence_id, e]));
    for (const item of items) {
      const e = held.get(item.evidence_id);
      // An item the server already knows keeps the chunk count it was started with.
      counts.set(item.evidence_id, e ? e.chunk_count : chunkCount(item.byte_size));
      if (e?.status === "COMPLETE") sentBytes += item.byte_size;
      else if (e && e.received_chunks > 0)
        sentBytes += chunkRange(
          item.byte_size,
          e.chunk_count,
          Math.min(e.received_chunks, e.chunk_count) - 1,
        )[1];
    }
    report();

    // 3. What the server does not hold yet, chunk by chunk, in order.
    for (const item of items) {
      const e = held.get(item.evidence_id);
      if (e?.status === "COMPLETE") continue;
      const count = counts.get(item.evidence_id) ?? chunkCount(item.byte_size);
      await sendChunks(item, all(count, e?.received_chunks ?? 0));
    }

    // 4. The manifest, with one more round for anything the server still lacks.
    const entries = items.map((e) => ({
      evidence_id: e.evidence_id,
      kind: e.kind,
      sha256: e.sha256,
      byte_size: e.byte_size,
    }));
    const manifest: EvidenceManifest = {
      manifest: entries,
      manifest_sha256: await sha256Hex(utf8(manifestText(entries))),
    };
    for (let round = 1; ; round++) {
      try {
        return { kind: "complete", draft: await api.completeEvidenceManifest(draftId, manifest) };
      } catch (error) {
        if (round > 1 || !(error instanceof ApiError)) throw error;
        const byId = new Map(items.map((e) => [e.evidence_id, e]));
        if (error.code === "E_UPLOAD_INCOMPLETE") {
          // The chunks the server lacks; an item it has never seen is sent whole.
          const missing = (error.details.missing_chunks ?? {}) as Record<string, unknown>;
          for (const id of ids(error.details.evidence_ids)) {
            const item = byId.get(id);
            if (!item) continue;
            const indexes = missing[id];
            await sendChunks(
              item,
              Array.isArray(indexes)
                ? indexes.filter((i): i is number => Number.isInteger(i))
                : all(counts.get(id) ?? chunkCount(item.byte_size)),
            );
          }
          continue;
        }
        if (error.code === "E_CAPTURE_INTEGRITY" && error.details.reason === undefined) {
          // Items whose reassembled bytes failed the server's check; the server dropped their chunks.
          for (const id of ids(error.details.evidence_ids)) {
            const item = byId.get(id);
            if (item) await sendChunks(item, all(counts.get(id) ?? chunkCount(item.byte_size)));
          }
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    return asResult(error);
  }
}
