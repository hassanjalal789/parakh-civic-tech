/**
 * T-052 — from a finished draft to a report: readiness, API-130, the upload (T-055),
 * processing, confirmation (API-135) with the phone's own hash check, and Submit through
 * the queue. The server is an in-memory stand-in; files are synthetic.
 */
import { createHash, randomBytes } from "crypto";

import { ApiError, OfflineError } from "../src/api/errors";
import type { Confirmation, DraftBody, EvidenceChunk, Rendering, ServerDraft } from "../src/api/reporting";
import { contentHashText, descriptionOf, draftBody, missingParts } from "../src/domain/report";
import {
  checkRendering,
  confirmReviewed,
  type PipelineApi,
  prepareForReview,
  submitConfirmed,
} from "../src/services/reportPipeline";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const sha256 = (s: Uint8Array | string) => createHash("sha256").update(s).digest("hex");
const GPS = {
  kind: "coordinates" as const,
  measured: {
    latitude: 31.52037,
    longitude: 74.358749,
    accuracyM: 12,
    fix: "current" as const,
    measuredAt: "2026-10-11T08:59:00.000Z",
  },
  reported: { latitude: 31.52037, longitude: 74.358749 },
};

const TEXTS = { transcription: "Water pipe burst", ur: "پانی کا پائپ پھٹ گیا", en: "Water pipe burst" };

/** The server's rules for the calls the pipeline makes, in memory. */
class FakeServer implements PipelineApi {
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
      text_origins: {},
      ai_generated_texts: { transcription: true, ur: true, en: true },
      processing_status: this.status,
      failure_code: this.status === "FAILED" ? "SIMULATED_FAILURE" : null,
      ai_generated: true,
      simulated: true,
    };
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

let drafts: DraftRepository;
let id: string;
let server: FakeServer;

async function capture(
  name: string,
  bytes: Uint8Array,
  kind: "photo" | "voice_original" | "location_voice",
  at: string,
) {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  const mimeType = kind === "photo" ? "image/jpeg" : "audio/mp4";
  return ingestCapture(drafts, id, { uri: file.uri, kind, mimeType, capturedAt: at });
}

async function readyVoiceDraft() {
  await drafts.update(id, { category: "drainage" });
  await capture(
    "p.jpg",
    new Uint8Array([0xff, 0xd8, 0xff, ...randomBytes(4000)]),
    "photo",
    "2026-10-11T08:58:00.000Z",
  );
  await capture(
    "r.m4a",
    syntheticMp4({ seconds: 8, tracks: ["soun"] }),
    "voice_original",
    "2026-10-11T08:58:30.000Z",
  );
  await drafts.setLocation(id, GPS);
}

beforeEach(async () => {
  resetFileSystem();
  resetSqlite();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  id = (await drafts.create()).client_submission_id;
  server = new FakeServer();
});

describe("T-052: what a draft needs before it is sent", () => {
  test("a new draft lacks everything; each part, once given, is no longer missing", async () => {
    expect(missingParts((await drafts.get(id))!, [])).toEqual([
      "category",
      "photo",
      "description",
      "location",
    ]);
    await readyVoiceDraft();
    expect(missingParts((await drafts.get(id))!, await drafts.evidence(id))).toEqual([]);
  });

  test("a spoken location needs its recording; typed text that is only spaces is no description", async () => {
    await drafts.update(id, { category: "road", description_mode: "typed", typed_description: "   " });
    await capture("p.jpg", new Uint8Array([0xff, 0xd8, 0xff, 1]), "photo", "2026-10-11T08:58:00.000Z");
    await drafts.setLocation(id, { kind: "spoken" });
    expect(missingParts((await drafts.get(id))!, await drafts.evidence(id))).toEqual([
      "description",
      "location",
    ]);
    await drafts.update(id, { typed_description: "  Broken road\n" });
    await capture(
      "l.m4a",
      syntheticMp4({ seconds: 5, tracks: ["soun"] }),
      "location_voice",
      "2026-10-11T08:59:00.000Z",
    );
    expect(missingParts((await drafts.get(id))!, await drafts.evidence(id))).toEqual([]);
  });

  test("the API-130 body: the category, the text as written, the first capture's time, the location", async () => {
    await drafts.update(id, {
      category: "road",
      description_mode: "typed",
      typed_description: "  Broken road\n",
    });
    await capture("p2.jpg", new Uint8Array([0xff, 0xd8, 0xff, 2]), "photo", "2026-10-11T08:58:40.000Z");
    await capture("p1.jpg", new Uint8Array([0xff, 0xd8, 0xff, 1]), "photo", "2026-10-11T08:58:00.000Z");
    await drafts.setLocation(id, GPS);
    const body = draftBody((await drafts.get(id))!, await drafts.evidence(id));
    expect(body).toEqual({
      client_submission_id: id,
      category: "road",
      description_mode: "typed",
      typed_description: "  Broken road\n", // exactly as written (DG-76)
      captured_at: "2026-10-11T08:58:00.000Z", // the first capture (FR-PUB.25)
      location: {
        measured: {
          latitude: 31.52037,
          longitude: 74.358749,
          accuracy_m: 12,
          fix: "current",
          measured_at: "2026-10-11T08:59:00.000Z",
        },
        reported: { latitude: 31.52037, longitude: 74.358749 },
        description: null,
        spoken_description: false,
      },
    });
  });

  test("a voice draft sends no typed text, whatever was left behind", async () => {
    await readyVoiceDraft();
    await drafts.update(id, { typed_description: "  " });
    const draft = (await drafts.get(id))!;
    expect(descriptionOf(draft, await drafts.evidence(id))).toBe("voice");
    expect(draftBody(draft, await drafts.evidence(id))).not.toHaveProperty("typed_description");
  });
});

describe("T-052: preparing for review", () => {
  test("nothing is sent while parts are missing", async () => {
    expect(await prepareForReview(drafts, id, server)).toEqual({
      kind: "missing",
      missing: ["category", "photo", "description", "location"],
    });
    expect(server.opened).toHaveLength(0);
  });

  test("opened, uploaded, completed — then the texts to review; the local draft stays editable", async () => {
    await readyVoiceDraft();
    const result = await prepareForReview(drafts, id, server);
    expect(result.kind).toBe("review");
    expect(server.opened).toHaveLength(1);
    expect(server.complete.size).toBe(2);
    expect((await drafts.get(id))?.pipeline_state).toBe("LOCAL_DRAFT");
  });

  test("offline: waiting for connection, and the next try continues", async () => {
    await readyVoiceDraft();
    server.offline = true;
    expect(await prepareForReview(drafts, id, server)).toEqual({ kind: "offline" });
    server.offline = false;
    expect((await prepareForReview(drafts, id, server)).kind).toBe("review");
  });

  test("still processing, or failed: named as such", async () => {
    await readyVoiceDraft();
    server.status = "PROCESSING";
    expect(await prepareForReview(drafts, id, server)).toEqual({ kind: "processing" });
    server.status = "FAILED";
    expect((await checkRendering(id, server)).kind).toBe("failed");
  });

  test("a refusal from the server is returned with its field", async () => {
    await readyVoiceDraft();
    server.refuseOpen = new ApiError("E_VALIDATION", 400, { field: "location" });
    expect(await prepareForReview(drafts, id, server)).toEqual({
      kind: "refused",
      code: "E_VALIDATION",
      field: "location",
    });
  });
});

describe("T-052: confirming exactly what was shown (FR-PUB.21, DG-62)", () => {
  async function review() {
    await readyVoiceDraft();
    const prepared = await prepareForReview(drafts, id, server);
    if (prepared.kind !== "review") throw new Error(prepared.kind);
    return prepared.rendering;
  }

  test("the nine fields, all three texts reviewed, the key sent; recorded on the phone", async () => {
    const rendering = await review();
    expect(
      await confirmReviewed(drafts, id, rendering, "33333333-3333-4333-8333-333333333333", server, () => NOW),
    ).toEqual({ kind: "confirmed" });
    expect(server.confirmations).toEqual([
      {
        key: "33333333-3333-4333-8333-333333333333",
        body: {
          voice_transcription_artifact_id: rendering.voice_transcription_artifact_id,
          client_submission_id: id,
          rendering_version: 1,
          rendering_content_hash: rendering.rendering_content_hash,
          reporter_subject_type: "citizen",
          reporter_account_id: ACCOUNT,
          confirmed_at: NOW.toISOString(),
          reviewed_texts: ["transcription", "ur", "en"],
        },
      },
    ]);
    expect(await drafts.get(id)).toMatchObject({
      rendering_version: 1,
      rendering_content_hash: rendering.rendering_content_hash,
    });
  });

  test("texts that do not match their hash are never confirmed", async () => {
    const rendering = await review();
    const altered = { ...rendering, english_rendering: "Something else" };
    expect(await confirmReviewed(drafts, id, altered, "k", server)).toEqual({ kind: "changed" });
    expect(server.confirmations).toHaveLength(0);
  });

  test("a superseded version, or no connection, is reported as such", async () => {
    const rendering = await review();
    server.refuseConfirm = new ApiError("E_RENDERING_SUPERSEDED", 409);
    expect(await confirmReviewed(drafts, id, rendering, "k", server)).toEqual({ kind: "changed" });
    server.refuseConfirm = null;
    server.offline = true;
    expect(await confirmReviewed(drafts, id, rendering, "k", server)).toEqual({ kind: "offline" });
  });

  test("the phone's hash is the server's, byte for byte (vectors from backend rendering_hash)", () => {
    expect(
      sha256(
        contentHashText(
          "  Pipe burst near the school\r\n",
          "پانی کا پائپ پھٹ گیا\n",
          'Water pipe burst "near" the school',
        ),
      ),
    ).toBe("b93372362afa05d6314871c6599a2ef6952be89f09e14f8eda17ba41e30a053a");
    expect(sha256(contentHashText("Water", "پانی", "پانی"))).toBe(
      "7c600ed845c0c468d518e868c3aa28d49cd3fde3caf1f508efc22cb7da779fab",
    );
  });
});

describe("T-052: Submit (DG-65)", () => {
  test("only a confirmed draft becomes ready to submit, and the queue sends it", async () => {
    await readyVoiceDraft();
    const queue = {
      requestSubmission: jest.fn(async () => ({
        kind: "submitted" as const,
        reportId: "r",
        reportReference: "PRK-1",
      })),
    };
    expect(await submitConfirmed(drafts, id, queue)).toEqual({ kind: "refused", reason: "not_ready" });
    expect(queue.requestSubmission).not.toHaveBeenCalled();
    expect((await drafts.get(id))?.pipeline_state).toBe("LOCAL_DRAFT");

    const prepared = await prepareForReview(drafts, id, server);
    if (prepared.kind !== "review") throw new Error(prepared.kind);
    await confirmReviewed(drafts, id, prepared.rendering, "k", server);
    expect(await submitConfirmed(drafts, id, queue)).toMatchObject({
      kind: "submitted",
      reportReference: "PRK-1",
    });
    expect(queue.requestSubmission).toHaveBeenCalledWith(id);
    expect((await drafts.get(id))?.pipeline_state).toBe("READY_TO_SUBMIT");
  });
});
