/**
 * The server's rules for the calls the report pipeline makes (API-130 to API-135 and the
 * corrections route), in memory, for tests. Texts are synthetic.
 */
import { createHash } from "crypto";

import { ApiError, OfflineError } from "../../src/api/errors";
import type {
  Confirmation,
  Correction,
  DraftBody,
  EvidenceChunk,
  Rendering,
  ServerDraft,
} from "../../src/api/reporting";
import { contentHashText } from "../../src/domain/report";
import type { PipelineApi } from "../../src/services/reportPipeline";

const sha256 = (s: Uint8Array | string) => createHash("sha256").update(s).digest("hex");

export const TEXTS = {
  transcription: "Water pipe burst",
  ur: "پانی کا پائپ پھٹ گیا",
  en: "Water pipe burst",
};

/** The server's rules for the calls the pipeline makes, in memory. */
export class FakeServer implements PipelineApi {
  opened: DraftBody[] = [];
  confirmations: { body: Confirmation; key: string }[] = [];
  chunks = new Map<string, Map<number, Buffer>>();
  meta = new Map<string, { count: number }>();
  complete = new Set<string>();
  offline = false;
  status: Rendering["processing_status"] = "COMPLETED";
  texts = { ...TEXTS };
  version = 1;
  refuseOpen: ApiError | null = null;
  refuseConfirm: ApiError | null = null;
  corrections: Correction[] = [];
  origins: Partial<Record<"transcription" | "ur" | "en", string>> = {};
  lowConfidence = new Set<string>(["location"]);

  private guard() {
    if (this.offline) throw new OfflineError();
  }
  openDraftOnServer = async (body: DraftBody) => {
    this.guard();
    if (this.refuseOpen) throw this.refuseOpen;
    this.opened.push(body);
    return this.draft(body.client_submission_id);
  };
  fetchDraft = async (id: string) => {
    this.guard();
    return this.opened.length ? this.draft(id) : null;
  };
  sendEvidenceChunk = async (_id: string, chunk: EvidenceChunk) => {
    this.guard();
    const held = this.chunks.get(chunk.evidence_id) ?? new Map<number, Buffer>();
    held.set(chunk.chunk_index, Buffer.from(chunk.chunk_base64, "base64"));
    this.chunks.set(chunk.evidence_id, held);
    this.meta.set(chunk.evidence_id, { count: chunk.chunk_count });
    return {
      evidence_id: chunk.evidence_id,
      chunk_index: chunk.chunk_index,
      received_chunks: held.size,
      chunk_count: chunk.chunk_count,
      all_chunks_received: held.size === chunk.chunk_count,
    };
  };
  completeEvidenceManifest = async (id: string) => {
    this.guard();
    for (const eid of this.chunks.keys()) this.complete.add(eid);
    return { ...this.draft(id), manifest_complete: true };
  };
  fetchRendering = async (id: string): Promise<Rendering | null> => {
    this.guard();
    const done = this.status === "COMPLETED";
    return {
      voice_transcription_artifact_id: "22222222-2222-4222-8222-222222222222",
      client_submission_id: id,
      source_kind: "voice",
      rendering_version: this.version,
      rendering_content_hash: done
        ? sha256(contentHashText(this.texts.transcription, this.texts.ur, this.texts.en))
        : null,
      source_language: done ? "ur" : null,
      transcription: done ? this.texts.transcription : null,
      urdu_civic_rendering: done ? this.texts.ur : null,
      english_rendering: done ? this.texts.en : null,
      text_origins: this.origins,
      ai_generated_texts: {
        transcription: this.origins.transcription !== "reporter",
        ur: this.origins.ur !== "reporter",
        en: this.origins.en !== "reporter",
      },
      fields: done
        ? ["issue_category", "location"].map((key) => ({
            key,
            value: key,
            confidence: this.lowConfidence.has(key) ? 0.4 : 0.9,
            low_confidence: this.lowConfidence.has(key),
          }))
        : [],
      processing_status: this.status,
      failure_code: this.status === "FAILED" ? "SIMULATED_FAILURE" : null,
      ai_generated: true,
      simulated: true,
    };
  };
  correctRendering = async (id: string, body: Correction) => {
    this.guard();
    if (body.rendering_version !== this.version) throw new ApiError("E_RENDERING_SUPERSEDED", 409);
    this.corrections.push(body);
    const fields = {
      transcription: "transcription",
      ur: "urdu_civic_rendering",
      en: "english_rendering",
    } as const;
    for (const key of ["transcription", "ur", "en"] as const) {
      const value = body[fields[key]];
      if (value !== undefined && value.trim() !== this.texts[key].trim()) {
        this.texts[key] = value;
        this.origins[key] = "reporter";
      }
    }
    for (const field of body.corrected_fields) this.lowConfidence.delete(field);
    this.version += 1;
    return (await this.fetchRendering(id)) as Rendering;
  };
  confirmRendering = async (_id: string, body: Confirmation, key: string) => {
    this.guard();
    if (this.refuseConfirm) throw this.refuseConfirm;
    this.confirmations.push({ body, key });
    return {};
  };
  private draft(id: string): ServerDraft {
    return {
      client_submission_id: id,
      lifecycle: "active",
      pipeline_state: "UPLOADING",
      manifest_complete: false,
      evidence: [...this.chunks.entries()].map(([eid, held]) => ({
        evidence_id: eid,
        kind: "photo",
        status: this.complete.has(eid) ? ("COMPLETE" as const) : ("RECEIVING" as const),
        byte_size: 0,
        duration_seconds: null,
        received_chunks: held.size,
        chunk_count: this.meta.get(eid)?.count ?? 0,
      })),
    };
  }
}
