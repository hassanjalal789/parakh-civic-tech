/**
 * T-055 — the resumable evidence upload (API-131, API-132, API-133; UC-CIT-023).
 *
 * The server is an in-memory stand-in that applies the development server's
 * rules (backend/parakh/drafts/services.py): it recomputes each chunk's hash,
 * keeps an item's metadata fixed, treats the same chunk again as a replay,
 * reassembles and re-hashes each item on completion, and answers a missing chunk
 * with E_UPLOAD_INCOMPLETE. Files are synthetic; nothing reaches a network.
 */
import { createHash, randomBytes } from "crypto";

import { ApiError, OfflineError } from "../src/api/errors";
import type { ChunkReceipt, EvidenceChunk, EvidenceManifest, ServerDraft } from "../src/api/reporting";
import { chunkCount, chunkRange, manifestText, toBase64, UPLOAD } from "../src/domain/upload";
import { uploadDraftEvidence, type UploadApi, type UploadProgress } from "../src/services/evidenceUpload";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository, type DraftRepository, type EvidenceRow } from "../src/storage/drafts";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

type Held = {
  meta: Omit<EvidenceChunk, "chunk_index" | "chunk_sha256" | "chunk_base64">;
  chunks: Map<number, Buffer>;
  complete: boolean;
};

/** The development server's evidence rules, in memory. */
class FakeServer implements UploadApi {
  lifecycle: ServerDraft["lifecycle"] | "absent" = "active";
  items = new Map<string, Held>();
  log: string[] = [];
  /** Chunk sends (counted from 1) that fail as if the connection dropped before the server got them. */
  dropBefore = new Set<number>();
  /** Chunk sends that reach the server, whose answer is then lost. */
  dropAfter = new Set<number>();
  /** `id:index` → how many more sends of that chunk arrive damaged. */
  damaged = new Map<string, number>();
  /** Items whose next reassembly fails the server's check. */
  badAssembly = new Set<string>();
  /** Items whose every reassembly fails it. */
  alwaysBad = new Set<string>();
  /** A chunk the server keeps losing before completion. */
  alwaysForget: { id: string; index: number } | null = null;
  /** Chunks the server "lost" before completion. */
  forget: { id: string; index: number }[] = [];
  refuseCompletion: ApiError | null = null;
  completions = 0;
  private sends = 0;

  fetchDraft = async (id: string): Promise<ServerDraft | null> => {
    this.log.push("status");
    if (this.lifecycle === "absent") return null;
    return this.body(id);
  };

  sendEvidenceChunk = async (_id: string, chunk: EvidenceChunk): Promise<ChunkReceipt> => {
    const n = ++this.sends;
    if (this.dropBefore.has(n)) throw new OfflineError();
    this.log.push(`chunk ${chunk.evidence_id.slice(-2)}:${chunk.chunk_index}`);
    let data = Buffer.from(chunk.chunk_base64, "base64");
    const key = `${chunk.evidence_id}:${chunk.chunk_index}`;
    const left = this.damaged.get(key) ?? 0;
    if (left > 0) {
      this.damaged.set(key, left - 1);
      data = Buffer.concat([data, Buffer.from([0])]); // altered in transit
    }
    if (data.length === 0 || data.length > UPLOAD.serverChunkMaxBytes)
      throw new ApiError("E_VALIDATION", 400);
    if (chunk.chunk_count < Math.ceil(chunk.byte_size / UPLOAD.serverChunkMaxBytes)) {
      throw new ApiError("E_VALIDATION", 400, { field: "chunk_count" });
    }
    if (sha256(data) !== chunk.chunk_sha256) {
      throw new ApiError("E_CAPTURE_INTEGRITY", 422, {
        evidence_ids: [chunk.evidence_id],
        chunk_index: chunk.chunk_index,
      });
    }
    const { chunk_index: _i, chunk_sha256: _s, chunk_base64: _b, ...meta } = chunk;
    let held = this.items.get(chunk.evidence_id);
    if (!held) {
      held = { meta, chunks: new Map(), complete: false };
      this.items.set(chunk.evidence_id, held);
    } else if (JSON.stringify(held.meta) !== JSON.stringify(meta)) {
      throw new ApiError("E_VALIDATION", 400, { field: "evidence_metadata" });
    }
    if (!held.complete) {
      const existing = held.chunks.get(chunk.chunk_index);
      if (existing && sha256(existing) !== chunk.chunk_sha256) {
        throw new ApiError("E_CAPTURE_INTEGRITY", 422, { evidence_ids: [chunk.evidence_id] });
      }
      held.chunks.set(chunk.chunk_index, data);
    }
    if (this.dropAfter.has(n)) throw new OfflineError();
    const received = held.complete ? held.meta.chunk_count : held.chunks.size;
    return {
      evidence_id: chunk.evidence_id,
      chunk_index: chunk.chunk_index,
      received_chunks: received,
      chunk_count: held.meta.chunk_count,
      all_chunks_received: received === held.meta.chunk_count,
    };
  };

  completeEvidenceManifest = async (id: string, manifest: EvidenceManifest): Promise<ServerDraft> => {
    this.completions++;
    this.log.push("complete");
    for (const { id: eid, index } of this.forget.splice(0)) this.items.get(eid)?.chunks.delete(index);
    if (this.alwaysForget) this.items.get(this.alwaysForget.id)?.chunks.delete(this.alwaysForget.index);
    const lines = [...manifest.manifest]
      .sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
      .map((e) => `${e.evidence_id}:${e.kind}:${e.sha256}:${e.byte_size}\n`)
      .join("");
    const missing = manifest.manifest.map((e) => e.evidence_id).filter((eid) => !this.items.has(eid));
    if (missing.length) throw new ApiError("E_UPLOAD_INCOMPLETE", 409, { evidence_ids: missing.sort() });
    const incomplete: Record<string, number[]> = {};
    const bad: string[] = [];
    for (const entry of manifest.manifest) {
      const held = this.items.get(entry.evidence_id) as Held;
      if (held.complete) continue;
      const count = held.meta.chunk_count;
      if (held.chunks.size !== count) {
        incomplete[entry.evidence_id] = [...Array(count).keys()].filter((i) => !held.chunks.has(i));
        continue;
      }
      const data = Buffer.concat([...Array(count).keys()].map((i) => held.chunks.get(i) as Buffer));
      if (
        this.badAssembly.delete(entry.evidence_id) ||
        this.alwaysBad.has(entry.evidence_id) ||
        sha256(data) !== held.meta.sha256
      ) {
        held.chunks.clear();
        bad.push(entry.evidence_id);
        continue;
      }
      held.complete = true;
    }
    if (Object.keys(incomplete).length) {
      throw new ApiError("E_UPLOAD_INCOMPLETE", 409, {
        evidence_ids: Object.keys(incomplete).sort(),
        missing_chunks: incomplete,
      });
    }
    if (bad.length) throw new ApiError("E_CAPTURE_INTEGRITY", 422, { evidence_ids: bad.sort() });
    if (this.refuseCompletion) throw this.refuseCompletion;
    if (sha256(lines) !== manifest.manifest_sha256) {
      throw new ApiError("E_CAPTURE_INTEGRITY", 422, { evidence_ids: [], reason: "manifest" });
    }
    return { ...this.body(id), manifest_complete: true };
  };

  assembled(eid: string): Buffer {
    const held = this.items.get(eid) as Held;
    return Buffer.concat([...Array(held.meta.chunk_count).keys()].map((i) => held.chunks.get(i) as Buffer));
  }

  private body(id: string): ServerDraft {
    return {
      client_submission_id: id,
      lifecycle: this.lifecycle as ServerDraft["lifecycle"],
      pipeline_state: "UPLOADING",
      manifest_complete: false,
      evidence: [...this.items.entries()].map(([eid, held]) => ({
        evidence_id: eid,
        kind: held.meta.kind,
        status: held.complete ? ("COMPLETE" as const) : ("RECEIVING" as const),
        byte_size: held.meta.byte_size,
        duration_seconds: null,
        received_chunks: held.complete ? held.meta.chunk_count : held.chunks.size,
        chunk_count: held.meta.chunk_count,
      })),
    };
  }
}

let drafts: DraftRepository;
let draftId: string;
let server: FakeServer;
let photo: EvidenceRow;
let video: EvidenceRow;
let voice: EvidenceRow;

async function capture(name: string, bytes: Uint8Array, kind: EvidenceRow["kind"], mimeType: string) {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  return ingestCapture(drafts, draftId, { uri: file.uri, kind, mimeType, capturedAt: NOW.toISOString() });
}

beforeEach(async () => {
  resetFileSystem();
  resetSqlite();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  draftId = (await drafts.create()).client_submission_id;
  photo = await capture(
    "p.jpg",
    new Uint8Array([0xff, 0xd8, 0xff, ...randomBytes(300_000)]),
    "photo",
    "image/jpeg",
  );
  // About 700 KiB: three chunks of 256 KiB.
  video = await capture("v.mp4", syntheticMp4({ seconds: 20, mdatBytes: 700_000 }), "video", "video/mp4");
  voice = await capture(
    "r.m4a",
    syntheticMp4({ seconds: 12, tracks: ["soun"] }),
    "voice_original",
    "audio/mp4",
  );
  server = new FakeServer();
});

const upload = (onProgress?: (p: UploadProgress) => void) =>
  uploadDraftEvidence(drafts, draftId, { api: server, onProgress });
const tail = (row: EvidenceRow) => row.evidence_id.slice(-2);
const fileBytes = (row: EvidenceRow) => draftMediaFile(row.file_name).bytes();

describe("T-055: the evidence upload", () => {
  test("every item in chunks of at most 256 KiB, each with its own hash, then the manifest", async () => {
    const progress: UploadProgress[] = [];
    const result = await upload((p) => progress.push(p));
    expect(result).toMatchObject({ kind: "complete", draft: { manifest_complete: true } });
    for (const row of [photo, video, voice]) {
      expect(sha256(server.assembled(row.evidence_id))).toBe(row.sha256);
      expect(server.items.get(row.evidence_id)?.meta).toMatchObject({
        kind: row.kind,
        mime_type: row.mime_type,
        sha256: row.sha256,
        byte_size: row.byte_size,
        captured_at: row.captured_at,
        chunk_count: chunkCount(row.byte_size),
      });
      for (const data of server.items.get(row.evidence_id)?.chunks.values() ?? []) {
        expect(data.length).toBeLessThanOrEqual(UPLOAD.chunkBytes);
      }
    }
    expect(chunkCount(video.byte_size)).toBe(3);
    expect(server.log.filter((l) => l.startsWith(`chunk ${tail(video)}`))).toEqual([
      `chunk ${tail(video)}:0`,
      `chunk ${tail(video)}:1`,
      `chunk ${tail(video)}:2`,
    ]);
    expect(server.log[0]).toBe("status");
    expect(server.log.at(-1)).toBe("complete");
    const total = photo.byte_size + video.byte_size + voice.byte_size;
    expect(progress.at(-1)).toEqual({ sentBytes: total, totalBytes: total });
  });

  test("an interrupted upload resumes from the last chunk the server confirmed", async () => {
    server.dropBefore.add(4); // the photo (2 chunks) and the video's first chunk arrive; the next send fails
    expect(await upload()).toEqual({ kind: "offline" });
    expect(server.items.get(video.evidence_id)?.chunks.size).toBe(1);
    server.log = [];
    const progress: UploadProgress[] = [];
    expect((await upload((p) => progress.push(p))).kind).toBe("complete");
    // Nothing the server confirmed is sent again: the video continues at chunk 1.
    expect(server.log).toEqual([
      "status",
      `chunk ${tail(video)}:1`,
      `chunk ${tail(video)}:2`,
      `chunk ${tail(voice)}:0`,
      "complete",
    ]);
    const [, end] = chunkRange(video.byte_size, 3, 0);
    expect(progress[0]?.sentBytes).toBe(photo.byte_size + end);
    expect(sha256(server.assembled(video.evidence_id))).toBe(video.sha256);
  });

  test("a chunk whose answer was lost is not sent again: the server's count already includes it", async () => {
    server.dropAfter.add(3); // the video's chunk 0 is stored, its answer lost
    expect(await upload()).toEqual({ kind: "offline" });
    server.log = [];
    expect((await upload()).kind).toBe("complete");
    expect(server.log.filter((l) => l.startsWith(`chunk ${tail(video)}`))).toEqual([
      `chunk ${tail(video)}:1`,
      `chunk ${tail(video)}:2`,
    ]);
  });

  test("a chunk damaged in transit is sent again; three damaged sends set the item aside, and nothing completes", async () => {
    server.damaged.set(`${video.evidence_id}:1`, 2);
    expect((await upload()).kind).toBe("complete");
    expect(server.log.filter((l) => l === `chunk ${tail(video)}:1`)).toHaveLength(3);

    server = new FakeServer();
    server.damaged.set(`${voice.evidence_id}:0`, 3);
    expect(await upload()).toEqual({ kind: "integrity_failed", evidenceIds: [voice.evidence_id] });
    expect(server.log.filter((l) => l === `chunk ${tail(voice)}:0`)).toHaveLength(UPLOAD.chunkTries);
    expect(server.completions).toBe(0);
  });

  test("an item whose reassembled bytes fail the server's check is sent once more from the start", async () => {
    server.badAssembly.add(video.evidence_id);
    expect((await upload()).kind).toBe("complete");
    expect(server.log.filter((l) => l.startsWith(`chunk ${tail(video)}`))).toHaveLength(6);
    expect(server.completions).toBe(2);
    expect(sha256(server.assembled(video.evidence_id))).toBe(video.sha256);
  });

  test("one more round only: an item damaged again, or chunks still missing, stop the upload", async () => {
    server.alwaysBad.add(video.evidence_id);
    expect(await upload()).toEqual({ kind: "integrity_failed", evidenceIds: [video.evidence_id] });
    expect(server.completions).toBe(2);

    server = new FakeServer();
    server.alwaysForget = { id: voice.evidence_id, index: 0 };
    expect(await upload()).toEqual({
      kind: "refused",
      code: "E_UPLOAD_INCOMPLETE",
      field: null,
      evidenceIds: [voice.evidence_id],
    });
    expect(server.completions).toBe(2);
  });

  test("chunks the server lacks at completion are sent, exactly those, then the manifest completes", async () => {
    server.forget.push({ id: video.evidence_id, index: 2 });
    expect((await upload()).kind).toBe("complete");
    expect(server.log.slice(-3)).toEqual(["complete", `chunk ${tail(video)}:2`, "complete"]);
  });

  test("an item the server already holds is not sent again; one it started keeps its chunk count", async () => {
    // The video was started with 5 chunks (an earlier chunk size); 2 of them arrived.
    const bytes = await fileBytes(video);
    for (const i of [0, 1]) {
      const [s, e] = chunkRange(video.byte_size, 5, i);
      await server.sendEvidenceChunk(draftId, {
        evidence_id: video.evidence_id,
        kind: video.kind,
        mime_type: video.mime_type,
        byte_size: video.byte_size,
        sha256: video.sha256,
        captured_at: video.captured_at,
        chunk_index: i,
        chunk_count: 5,
        chunk_sha256: sha256(bytes.slice(s, e)),
        chunk_base64: Buffer.from(bytes.slice(s, e)).toString("base64"),
      });
    }
    server.log = [];
    expect((await upload()).kind).toBe("complete");
    expect(server.log.filter((l) => l.startsWith(`chunk ${tail(video)}`))).toEqual([
      `chunk ${tail(video)}:2`,
      `chunk ${tail(video)}:3`,
      `chunk ${tail(video)}:4`,
    ]);
    expect(sha256(server.assembled(video.evidence_id))).toBe(sha256(bytes));
    server.log = [];
    expect((await upload()).kind).toBe("complete"); // a replay: everything held, nothing sent
    expect(server.log).toEqual(["status", "complete"]);
  });

  test("a kept file that changed since capture, or is gone, is never sent — nor anything else", async () => {
    const file = draftMediaFile(voice.file_name);
    const bytes = await file.bytes();
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff; // one byte altered after capture
    file.write(bytes);
    expect(await upload()).toEqual({ kind: "evidence_changed", evidenceId: voice.evidence_id });
    expect(server.log).toEqual([]);

    draftMediaFile(photo.file_name).delete();
    expect(await upload()).toEqual({ kind: "evidence_missing", evidenceId: photo.evidence_id });
    expect(server.log).toEqual([]);
  });

  test("a draft the server has not seen, or can no longer change, is sent nothing", async () => {
    server.lifecycle = "absent";
    expect(await upload()).toEqual({ kind: "not_on_server" });
    server.lifecycle = "submitted";
    expect(await upload()).toEqual({ kind: "not_active", lifecycle: "submitted" });
    expect(server.log).toEqual(["status", "status"]);
  });

  test("no connection when asking the server: nothing is sent", async () => {
    server.fetchDraft = async () => {
      throw new OfflineError();
    };
    expect(await upload()).toEqual({ kind: "offline" });
    expect(server.items.size).toBe(0);
  });

  test("a refusal the reporter must act on is returned with its field, and the phone's evidence is untouched", async () => {
    const hashes = async () =>
      (await Promise.all([photo, video, voice].map(fileBytes))).map((b) => sha256(b));
    const before = await hashes();
    server.refuseCompletion = new ApiError("E_VALIDATION", 400, {
      field: "video_duration",
      evidence_ids: [video.evidence_id],
      max_seconds: 60,
    });
    expect(await upload()).toEqual({
      kind: "refused",
      code: "E_VALIDATION",
      field: "video_duration",
      evidenceIds: [video.evidence_id],
    });
    expect(await hashes()).toEqual(before);
    expect(before).toEqual([photo, video, voice].map((e) => e.sha256));
    expect((await drafts.evidence(draftId)).map((e) => e.sha256)).toEqual(
      [photo, video, voice].map((e) => e.sha256),
    );
    expect((await drafts.get(draftId))?.pipeline_state).toBe("LOCAL_DRAFT");
  });
});

describe("T-055: chunks, hashes and encoding", () => {
  test("chunks cover an item exactly once, in order, never empty and never over the server's limit", () => {
    for (const size of [1, 2, 255, 262_144, 262_145, 700_123, 40 * 1024 * 1024]) {
      for (const count of [chunkCount(size), Math.min(size, chunkCount(size) + 3)]) {
        let next = 0;
        for (let i = 0; i < count; i++) {
          const [start, end] = chunkRange(size, count, i);
          expect(start).toBe(next);
          expect(end).toBeGreaterThan(start);
          expect(end - start).toBeLessThanOrEqual(UPLOAD.serverChunkMaxBytes);
          next = end;
        }
        expect(next).toBe(size);
      }
    }
    expect(() => chunkCount(0)).toThrow();
    expect(() => chunkRange(10, 11, 0)).toThrow();
    expect(() => chunkRange(10, 2, 2)).toThrow();
  });

  test("the manifest hash is the server's, byte for byte (vector from backend manifest_hash)", () => {
    const text = manifestText([
      {
        evidence_id: "22222222-2222-4222-8222-222222222222",
        kind: "photo",
        sha256: "ab".repeat(32),
        byte_size: 123,
      },
      {
        evidence_id: "11111111-1111-4111-8111-111111111111",
        kind: "voice_original",
        sha256: "cd".repeat(32),
        byte_size: 456,
      },
    ]);
    expect(sha256(text)).toBe("ceb377541adfbb9bfad688f4f29a17de1bbb7fb4e5bd7cf43675307489ae3d09");
  });

  test("base64 matches the standard encoding, padding included", () => {
    for (let n = 0; n < 12; n++) {
      const bytes = new Uint8Array(randomBytes(n));
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
    const big = new Uint8Array(randomBytes(UPLOAD.chunkBytes + 1));
    expect(toBase64(big)).toBe(Buffer.from(big).toString("base64"));
  });
});
