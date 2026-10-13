/**
 * T-047: owner-bound local drafts with a 2-day lifetime (LDS-2, LDS-4;
 * DG-63, DG-64; Mobile SRS v2.3.0 §3.6.3, §3.6.4).
 *
 * The SQLite engine is Node's real one behind the expo-sqlite interface, and
 * the file system is a real temporary directory behind expo-file-system's
 * (fakes/). These tests prove the client's control flow; the native modules
 * are exercised by the development self-check on an emulator or a device.
 */
import { createHash, randomBytes } from "crypto";
import * as SecureStore from "expo-secure-store";
import * as fs from "fs";
import { AppState } from "react-native";

import { logout } from "../src/api/auth";
import { fetchDraftStatus, submitReport } from "../src/api/reporting";
import { prepareCitizenQueue } from "../src/services/citizenQueue";
import { receivedReference } from "../src/services/received";
import { endCitizenSession, onCitizenSessionEnded } from "../src/auth/session";
import { saveCitizenTokens } from "../src/services/secureStorage";
import { ingestCapture } from "../src/storage/capture";
import { draftDatabaseFile, hasPlaintextHeader, openDraftDatabase } from "../src/storage/database";
import { localStatus } from "../src/domain/draftStatus";
import {
  deleteExpiredDrafts,
  DRAFT_LIFETIME_MS,
  draftRepository,
  type DraftRow,
  EvidenceRefused,
  type NewEvidence,
} from "../src/storage/drafts";
import { discardDraft } from "../src/storage/lifetime";
import {
  closeLocalStore,
  isLocalStoreOpen,
  type LocalStore,
  LocalStoreClosed,
  openLocalStore,
  purgeExpired,
  repositoryAt,
  setStoreClock,
  sweepOrphanMedia,
} from "../src/storage/localStore";
import { draftMediaDirectory, draftMediaFile, mediaFileName, readDraftMedia } from "../src/storage/media";
import { migrate, SCHEMA_VERSION, SchemaMismatch } from "../src/storage/schema";
import {
  createTestDraft,
  createTestPendingSubmission,
  listTestItems,
  removeTestItems,
  RETENTION_TEST_OWNER,
} from "../src/storage/retentionTest";
import { runStorageSelfCheck, SELF_CHECK_OWNER } from "../src/storage/selfCheck";
import { File, fsControl, Paths, pathOf, resetFileSystem } from "./fakes/fileSystem";
import { control, memoryDatabase, resetSqlite } from "./fakes/sqlite";
import { jsonResponse, mockFetch, secureStoreContents } from "./helpers";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("../src/api/reporting", () => ({
  ...jest.requireActual("../src/api/reporting"),
  fetchDraftStatus: jest.fn(),
  submitReport: jest.fn(),
}));

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111"; // synthetic
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222"; // synthetic
const MARKER = Buffer.from("PARAKH-SYNTHETIC-PHOTO-BYTES");
const START = new Date("2026-10-06T08:00:00.000Z");
const HOUR = 60 * 60 * 1000;

let now = START;
const clock = () => now;
function advance(ms: number): void {
  now = new Date(now.getTime() + ms);
}

function syntheticPhoto(size = 4096): Uint8Array {
  return new Uint8Array(Buffer.concat([MARKER, randomBytes(size)]));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A file where the camera would have written it. */
function cacheCapture(name: string, bytes: Uint8Array = syntheticPhoto()): string {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  return file.uri;
}

function photoCapture(name: string, bytes?: Uint8Array) {
  return {
    uri: cacheCapture(name, bytes),
    kind: "photo" as const,
    mimeType: "image/jpeg",
    capturedAt: START.toISOString(),
  };
}

function inode(uri: string): number {
  return fs.statSync(pathOf(uri)).ino;
}

function item(kind: NewEvidence["kind"], extra: Partial<NewEvidence> = {}): NewEvidence {
  const bytes = randomBytes(64);
  const mimeType = kind === "photo" ? "image/jpeg" : kind === "video" ? "video/mp4" : "audio/mp4";
  const evidenceId = `0000aaaa-0000-4000-8000-${randomBytes(6).toString("hex")}`;
  return {
    evidenceId,
    kind,
    mimeType,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    capturedAt: START.toISOString(),
    fileName: mediaFileName(evidenceId, mimeType),
    sourceUri: "file:///synthetic/camera-output",
    ...extra,
  };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(EvidenceRefused);
  return (error as EvidenceRefused).reason;
}

async function repositories() {
  const db = memoryDatabase();
  await migrate(db);
  return { db, a: draftRepository(db, ACCOUNT_A, clock), b: draftRepository(db, ACCOUNT_B, clock) };
}

/** A draft the reporter has reviewed, ready for Submit. */
async function readyDraft(store: LocalStore) {
  const draft = await store.drafts.create();
  await ingestCapture(
    store.drafts,
    draft.client_submission_id,
    photoCapture(`ready-${draft.client_submission_id}.jpg`),
  );
  await store.drafts.update(draft.client_submission_id, { pipeline_state: "READY_TO_SUBMIT" });
  return draft;
}

function foregroundListener(): (state: string) => Promise<void> {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][1];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(async () => {
  await closeLocalStore();
  resetFileSystem();
  resetSqlite();
  secureStoreContents().clear();
  now = START;
  setStoreClock(clock);
  (fetchDraftStatus as jest.Mock).mockReset().mockRejectedValue(new Error("synthetic offline"));
  (submitReport as jest.Mock).mockReset();
});

describe("the draft database has no application encryption (DG-63)", () => {
  test("it is plain SQLite, opened without a key, and nothing is put in secure storage", async () => {
    const db = await openDraftDatabase();
    await draftRepository(db, ACCOUNT_A, clock).create();
    await db.closeAsync();

    const head = fs.readFileSync(pathOf(draftDatabaseFile().uri)).subarray(0, 16);
    expect(hasPlaintextHeader(head)).toBe(true);
    expect(control.statements.some((s) => /PRAGMA\s+key/i.test(s))).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreContents().size).toBe(0);
  });

  test("a database written by a newer app is refused, left as it is, and its connection closed", async () => {
    const db = await openDraftDatabase();
    await db.runAsync("UPDATE schema_version SET version = ?", SCHEMA_VERSION + 1);
    await db.closeAsync();
    const before = fs.readFileSync(pathOf(draftDatabaseFile().uri));

    await expect(openDraftDatabase()).rejects.toThrow(/newer/);
    expect(control.closed).toBe(control.opened);
    expect(fs.readFileSync(pathOf(draftDatabaseFile().uri)).equals(before)).toBe(true);
  });
});

describe("the 2-day lifetime (DG-64)", () => {
  test("expires_at is created_at + 48 hours (172,800 s), from the device clock in UTC", async () => {
    const { a } = await repositories();
    const draft = await a.create();
    expect(DRAFT_LIFETIME_MS).toBe(172_800_000);
    expect(draft.created_at).toBe("2026-10-06T08:00:00.000Z");
    expect(draft.expires_at).toBe("2026-10-08T08:00:00.000Z");
  });

  test("editing, adding evidence and reopening never extend it, and it cannot be edited", async () => {
    const { db, a } = await repositories();
    const draft = await a.create();
    advance(47 * HOUR);
    await a.update(draft.client_submission_id, { category: "water", typed_description: "synthetic" });
    await a.registerEvidence(draft.client_submission_id, item("photo"));
    const reopened = await draftRepository(db, ACCOUNT_A, clock).get(draft.client_submission_id);

    expect(reopened?.expires_at).toBe(draft.expires_at);
    expect(reopened?.created_at).toBe(draft.created_at);
    expect(reopened?.updated_at).toBe(now.toISOString()); // the edit was recorded; the lifetime was not moved
    await expect(
      a.update(draft.client_submission_id, { expires_at: "2099-01-01" } as never),
    ).rejects.toThrow();
    await expect(
      a.update(draft.client_submission_id, { created_at: "2099-01-01" } as never),
    ).rejects.toThrow();
    expect((await a.get(draft.client_submission_id))?.expires_at).toBe(draft.expires_at);
  });

  test("an unsubmitted draft is gone the instant its lifetime ends, before any purge", async () => {
    const { db, a } = await repositories();
    const draft = await a.create();
    const id = draft.client_submission_id;
    await a.registerEvidence(id, item("photo"));
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" }); // reviewed, but Submit never pressed
    advance(DRAFT_LIFETIME_MS - 1);
    expect(await a.get(id)).not.toBeNull();

    advance(1); // exactly expires_at
    expect(await a.get(id)).toBeNull();
    expect(await a.list()).toEqual([]);
    expect(await a.evidence(id)).toEqual([]);
    expect(await a.update(id, { category: "water" })).toBeNull();
    expect(await refusal(a.registerEvidence(id, item("photo")))).toBe("unknown_draft");
    expect(await a.recordSubmit(id, "00000000-0000-4000-8000-0000000000aa")).toBeNull(); // Submit cannot revive it
    const row = await draftRepository(db, ACCOUNT_A, () => START).get(id); // the row, read as before expiry
    expect(row?.submission_requested_at).toBeNull();
  });

  test("the purge deletes every account's expired drafts, rows and files, and asks the server to cancel", async () => {
    const a = await openLocalStore(ACCOUNT_A);
    const b = await openLocalStore(ACCOUNT_B);
    const draftA = await a.drafts.create();
    const fileA = (await ingestCapture(a.drafts, draftA.client_submission_id, photoCapture("a.jpg")))
      .file_name;
    const draftB = await b.drafts.create();
    const fileB = (await ingestCapture(b.drafts, draftB.client_submission_id, photoCapture("b.jpg")))
      .file_name;
    const submitted = await readyDraft(a);
    advance(HOUR);
    await a.drafts.recordSubmit(submitted.client_submission_id, "00000000-0000-4000-8000-0000000000aa");
    advance(23 * HOUR);
    const fresh = await a.drafts.create();

    advance(24 * HOUR); // draftA and draftB are now exactly 48 h old
    expect(await purgeExpired()).toEqual({ drafts: 2, pendingSubmissions: 0 });

    expect(draftMediaFile(fileA).exists).toBe(false);
    expect(draftMediaFile(fileB).exists).toBe(false);
    expect(await repositoryAt(ACCOUNT_A, () => START).get(draftA.client_submission_id)).toBeNull(); // the row itself
    expect(await repositoryAt(ACCOUNT_B, () => START).get(draftB.client_submission_id)).toBeNull();
    expect(await a.drafts.pendingServerCancellations()).toEqual([draftA.client_submission_id]);
    expect(await b.drafts.pendingServerCancellations()).toEqual([draftB.client_submission_id]);
    // A pending submission follows its own 48 hours from Submit instead, and a younger draft stays.
    const [kept] = await a.drafts.evidence(submitted.client_submission_id);
    expect(kept).toBeDefined();
    expect(await a.drafts.get(fresh.client_submission_id)).not.toBeNull();

    advance(HOUR); // 48 h after Submit (DG-67)
    expect(await purgeExpired()).toEqual({ drafts: 0, pendingSubmissions: 1 });
    expect(await a.drafts.get(submitted.client_submission_id)).toBeNull();
    expect(draftMediaFile(kept?.file_name as string).exists).toBe(false);
    expect(await a.drafts.pendingServerCancellations()).toEqual([
      draftA.client_submission_id,
      submitted.client_submission_id,
    ]);
  });

  test("a pending submission is gone the instant its 48 hours from Submit end, for its own account only", async () => {
    const { db, a, b } = await repositories();
    const { client_submission_id: id } = await a.create();
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    advance(10 * HOUR);
    await a.recordSubmit(id, "00000000-0000-4000-8000-0000000000aa");
    advance(48 * HOUR - 1);
    expect(localStatus((await a.get(id)) as DraftRow)).toMatchObject({
      kind: "pending_submission",
      confirmed: false,
      deletesAt: "2026-10-08T18:00:00.000Z",
    });
    expect(await a.endedSubmissions()).toEqual([]);

    advance(1);
    expect(await a.get(id)).toBeNull();
    expect(await a.list()).toEqual([]);
    expect((await a.endedSubmissions()).map((d) => d.client_submission_id)).toEqual([id]);
    expect(await b.endedSubmissions()).toEqual([]);
    expect(await deleteExpiredDrafts(db, now)).toEqual([
      { clientSubmissionId: id, ownerAccountId: ACCOUNT_A, kind: "pending_submission", fileNames: [] },
    ]);
  });

  test("opening the store deletes expired drafts and unconfirmed pending submissions, and says how many", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    await store.drafts.create();
    const pending = await readyDraft(store);
    advance(HOUR);
    await store.drafts.recordSubmit(pending.client_submission_id, "00000000-0000-4000-8000-0000000000aa");
    await store.drafts.create();
    await closeLocalStore();
    advance(DRAFT_LIFETIME_MS);
    expect((await openLocalStore(ACCOUNT_A)).report).toMatchObject({ expired: 2, unconfirmedRemoved: 1 });
  });

  test("returning to the foreground deletes a draft whose lifetime ended in the background", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    advance(DRAFT_LIFETIME_MS);
    await foregroundListener()("active");
    expect(await repositoryAt(ACCOUNT_A, () => START).get(draft.client_submission_id)).toBeNull();
  });
});

describe("A-04 expired pending recovery at store boundaries", () => {
  test("B1: a row crossing expiry during another final check is not purged unchecked", async () => {
    const first = await pendingFor();
    advance(1000);
    const second = await pendingFor();
    now = new Date(START.getTime() + DRAFT_LIFETIME_MS);
    let entered!: () => void;
    let release!: () => void;
    const checking = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const answer = new Promise<string>((resolve) => {
      release = () => resolve("active");
    });
    (fetchDraftStatus as jest.Mock).mockImplementation((id: string) => {
      for (const name of id === first.id ? first.files : second.files) {
        expect(draftMediaFile(name).exists).toBe(true);
      }
      if (id === first.id) {
        entered();
        return answer;
      }
      return Promise.resolve("active");
    });
    const purging = purgeExpired();
    await checking;
    advance(1000);
    release();
    await purging;
    expect(fetchDraftStatus).not.toHaveBeenCalledWith(second.id);
    for (const name of second.files) expect(draftMediaFile(name).exists).toBe(true);
    await purgeExpired();
    expect(fetchDraftStatus).toHaveBeenCalledWith(second.id);
    for (const name of second.files) expect(draftMediaFile(name).exists).toBe(false);
  });

  test("B2: a stopped prepared queue is replaced before pending deletion", async () => {
    const { id, store } = await pendingFor();
    const old = prepareCitizenQueue(ACCOUNT_A, store.drafts, clock);
    old.stop();
    advance(DRAFT_LIFETIME_MS);
    await purgeExpired();
    expect(fetchDraftStatus).toHaveBeenCalledWith(id);
    expect(await store.drafts.endedSubmissions()).toEqual([]);
  });

  test("B2: synthetic store owners neither replace the citizen queue nor make status calls", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const queue = prepareCitizenQueue(ACCOUNT_A, store.drafts, clock);
    await createTestPendingSubmission();
    await openLocalStore(SELF_CHECK_OWNER);
    await openLocalStore("00000000-0000-4000-8000-00000000c4ed");
    expect(queue.stopped).toBe(false);
    advance(DRAFT_LIFETIME_MS);
    await purgeExpired();
    expect(fetchDraftStatus).not.toHaveBeenCalled();
    expect(submitReport).not.toHaveBeenCalled();
    expect(queue.stopped).toBe(false);
    await closeLocalStore();
    await openLocalStore(RETENTION_TEST_OWNER);
    expect(fetchDraftStatus).not.toHaveBeenCalled();
  });

  async function pendingFor(owner = ACCOUNT_A) {
    const store = await openLocalStore(owner);
    const draft = await readyDraft(store);
    await store.drafts.recordSubmit(draft.client_submission_id, "00000000-0000-4000-8000-0000000000aa");
    return {
      store,
      id: draft.client_submission_id,
      files: (await store.drafts.evidence(draft.client_submission_id)).map((e) => e.file_name),
    };
  }

  function found(id: string) {
    (fetchDraftStatus as jest.Mock).mockImplementation(async (requested: string) => {
      expect(requested).toBe(id);
      // The last check must precede deleting the content.
      expect(await repositoryAt(ACCOUNT_A, () => START).get(id)).not.toBeNull();
      return "submitted";
    });
    (submitReport as jest.Mock).mockResolvedValue({
      report_id: "00000000-0000-4000-8000-00000000abcd",
      report_reference: "PRK-RECOVERED",
      state: "SUBMITTED",
      created_at: START.toISOString(),
    });
  }

  test("cold reopen after 48 hours recovers a received report before local deletion", async () => {
    const { id, files } = await pendingFor();
    await closeLocalStore();
    advance(DRAFT_LIFETIME_MS + HOUR);
    (fetchDraftStatus as jest.Mock).mockImplementation(async () => {
      for (const name of files) expect(draftMediaFile(name).exists).toBe(true);
      return "submitted";
    });
    (submitReport as jest.Mock).mockResolvedValue({
      report_id: "00000000-0000-4000-8000-00000000abcd",
      report_reference: "PRK-COLD",
      state: "SUBMITTED",
      created_at: START.toISOString(),
    });
    const reopened = await openLocalStore(ACCOUNT_A);
    expect(fetchDraftStatus).toHaveBeenCalledWith(id);
    expect(submitReport).toHaveBeenCalledWith(id, "00000000-0000-4000-8000-0000000000aa");
    expect(receivedReference(id)).toBe("PRK-COLD");
    expect(await reopened.drafts.endedSubmissions()).toEqual([]);
    expect(await reopened.drafts.pendingServerCancellations()).toEqual([]);
    expect(reopened.report.unconfirmedRemoved).toBe(0);
  });

  test("foreground cleanup checks a submitted report before deleting its expired row", async () => {
    const { id, store } = await pendingFor();
    found(id);
    advance(DRAFT_LIFETIME_MS);
    await foregroundListener()("active");
    expect(fetchDraftStatus).toHaveBeenCalledWith(id);
    expect(receivedReference(id)).toBe("PRK-RECOVERED");
    expect(await store.drafts.endedSubmissions()).toEqual([]);
    expect(await store.drafts.pendingServerCancellations()).toEqual([]);
  });

  test("reachable unsubmitted and unreachable expired rows are removed without a new submission", async () => {
    const { id, store } = await pendingFor();
    (fetchDraftStatus as jest.Mock).mockResolvedValue("active");
    advance(DRAFT_LIFETIME_MS);
    expect(await purgeExpired()).toEqual({ drafts: 0, pendingSubmissions: 1 });
    expect(fetchDraftStatus).toHaveBeenCalledWith(id);
    expect(submitReport).not.toHaveBeenCalled();
    expect(await store.drafts.pendingServerCancellations()).toEqual([id]);
    expect(receivedReference(id)).toBeNull();
  });

  test("offline expiry still removes the row and media at the unchanged deadline", async () => {
    const { id, store, files } = await pendingFor();
    advance(DRAFT_LIFETIME_MS);
    expect(await purgeExpired()).toEqual({ drafts: 0, pendingSubmissions: 1 });
    expect(fetchDraftStatus).toHaveBeenCalledWith(id);
    expect(submitReport).not.toHaveBeenCalled();
    for (const name of files) expect(draftMediaFile(name).exists).toBe(false);
    expect(await store.drafts.endedSubmissions()).toEqual([]);
    expect(await store.drafts.pendingServerCancellations()).toEqual([id]);
  });

  test("closing during cold recovery cannot replay or install the old owner's store", async () => {
    const { id } = await pendingFor();
    await closeLocalStore();
    advance(DRAFT_LIFETIME_MS);
    let entered!: () => void;
    let release!: () => void;
    const checking = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const answer = new Promise<string>((resolve) => {
      release = () => resolve("submitted");
    });
    (fetchDraftStatus as jest.Mock).mockImplementation(() => {
      entered();
      return answer;
    });
    const pending = openLocalStore(ACCOUNT_A);
    const rejected = expect(pending).rejects.toBeInstanceOf(LocalStoreClosed);
    await checking;
    await closeLocalStore();
    release();
    await rejected;
    expect(submitReport).not.toHaveBeenCalled();
    expect(receivedReference(id)).toBeNull();
    expect(isLocalStoreOpen()).toBe(false);
    expect(control.closed).toBe(control.opened);
    (fetchDraftStatus as jest.Mock).mockRejectedValue(new Error("synthetic offline"));
    const other = await openLocalStore(ACCOUNT_B);
    expect(other.report.unconfirmedRemoved).toBe(1);
    expect(await other.drafts.pendingServerCancellations()).toEqual([]);
  });

  test("an account switch during foreground recovery fences the old queue", async () => {
    const { id } = await pendingFor();
    advance(DRAFT_LIFETIME_MS);
    let entered!: () => void;
    let release!: () => void;
    const checking = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const answer = new Promise<string>((resolve) => {
      release = () => resolve("submitted");
    });
    (fetchDraftStatus as jest.Mock).mockImplementation(() => {
      entered();
      return answer;
    });
    const purging = purgeExpired();
    await checking;
    const other = await openLocalStore(ACCOUNT_B);
    release();
    await purging;
    expect(submitReport).not.toHaveBeenCalled();
    expect(receivedReference(id)).toBeNull();
    expect(await other.drafts.pendingServerCancellations()).toEqual([]);
    expect(await repositoryAt(ACCOUNT_A, clock).pendingServerCancellations()).toEqual([id]);
  });

  test("another account is deleted on expiry but never queried with the signed-in account's credentials", async () => {
    const { id } = await pendingFor(ACCOUNT_B);
    await closeLocalStore();
    advance(DRAFT_LIFETIME_MS);
    const store = await openLocalStore(ACCOUNT_A);
    expect(fetchDraftStatus).not.toHaveBeenCalled();
    expect(submitReport).not.toHaveBeenCalled();
    expect(store.report.unconfirmedRemoved).toBe(1);
    expect(await store.drafts.pendingServerCancellations()).toEqual([]);
    expect(await repositoryAt(ACCOUNT_B, clock).pendingServerCancellations()).toEqual([id]);
  });
});

describe("drafts are bound to their owner (FR-COMMON.25)", () => {
  test("a new draft is a LOCAL_DRAFT with a client id, an owner and no reference", async () => {
    const { a } = await repositories();
    const draft = await a.create();
    expect(draft.client_submission_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft.pipeline_state).toBe("LOCAL_DRAFT");
    expect(draft.owner_account_id).toBe(ACCOUNT_A);
    expect(draft.report_reference).toBeNull();
    expect(draft.submission_requested_at).toBeNull();
  });

  test("another account cannot list, open, change, submit, delete or add to it", async () => {
    const { a, b } = await repositories();
    const draft = await a.create();
    const id = draft.client_submission_id;
    const photo = item("photo");
    await a.registerEvidence(id, photo);
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    await a.queueServerCancellation(id);

    expect(await b.list()).toEqual([]);
    expect(await b.get(id)).toBeNull();
    expect(await b.evidence(id)).toEqual([]);
    expect(await b.update(id, { category: "water" })).toBeNull();
    expect(await b.recordSubmit(id, "00000000-0000-4000-8000-0000000000bb")).toBeNull();
    expect(await b.remove(id)).toEqual([]);
    expect(await b.removeEvidence(id, photo.evidenceId)).toBeNull();
    expect(await refusal(b.registerEvidence(id, item("photo")))).toBe("unknown_draft");
    await b.markAdopted(photo.evidenceId);
    await b.forgetUnadopted(photo.evidenceId);
    expect(await b.pendingServerCancellations()).toEqual([]);
    await b.clearServerCancellation(id);

    const own = await a.get(id);
    expect(own?.category).toBeNull();
    expect(own?.submission_requested_at).toBeNull();
    expect(await a.evidence(id)).toEqual([
      expect.objectContaining({ source_uri: "file:///synthetic/camera-output" }),
    ]);
    expect(await a.pendingServerCancellations()).toEqual([id]);
    expect(() => draftRepository(memoryDatabase(), "")).toThrow();
  });
});

describe("evidence bounds (DG-47, DG-54)", () => {
  test("1–3 photos, one optional video of up to 60 seconds, one voice original", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    for (let i = 0; i < 3; i++) await a.registerEvidence(id, item("photo"));
    expect(await refusal(a.registerEvidence(id, item("photo")))).toBe("photo_limit");

    await a.registerEvidence(id, item("video", { durationSeconds: 60.4 })); // within the 0.5 s container tolerance
    expect(await refusal(a.registerEvidence(id, item("video", { durationSeconds: 10 })))).toBe("video_limit");
    await a.registerEvidence(id, item("voice_original"));
    expect(await refusal(a.registerEvidence(id, item("voice_original")))).toBe("voice_limit");
    expect(await a.evidence(id)).toHaveLength(5);

    const other = await a.create();
    const long = item("video", { durationSeconds: 61 });
    expect(await refusal(a.registerEvidence(other.client_submission_id, long))).toBe("video_too_long");
  });

  test("two captures racing for the last photo place cannot both take it", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    await a.registerEvidence(id, item("photo"));
    await a.registerEvidence(id, item("photo"));

    const results = await Promise.allSettled([
      a.registerEvidence(id, item("photo")),
      a.registerEvidence(id, item("photo")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect((rejected?.reason as EvidenceRefused).reason).toBe("photo_limit");
    expect(await a.evidence(id)).toHaveLength(3);
  });

  test("an unexpected type or a malformed hash is refused", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    expect(await refusal(a.registerEvidence(id, item("photo", { mimeType: "image/png" })))).toBe("bad_type");
    expect(await refusal(a.registerEvidence(id, item("photo", { sha256: "abc" })))).toBe("bad_hash");
  });

  test("evidence is frozen once the draft leaves LOCAL_DRAFT; a retake works before", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    const first = item("photo");
    await a.registerEvidence(id, first);
    expect((await a.removeEvidence(id, first.evidenceId))?.evidence_id).toBe(first.evidenceId);
    const second = item("photo");
    await a.registerEvidence(id, second);

    await a.update(id, { pipeline_state: "UPLOADING" });
    expect(await refusal(a.registerEvidence(id, item("photo")))).toBe("not_editable");
    expect(await a.removeEvidence(id, second.evidenceId)).toBeNull();
    expect(await a.evidence(id)).toHaveLength(1);
  });
});

describe("Submit is recorded once, and only for a reviewed draft (DG-65)", () => {
  const KEY = "00000000-0000-4000-8000-0000000000aa";

  test("a draft still being prepared cannot be submitted", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    expect((await a.recordSubmit(id, KEY))?.submission_requested_at).toBeNull();
    await a.update(id, { pipeline_state: "AWAITING_REPORTER_REVIEW" });
    expect((await a.recordSubmit(id, KEY))?.submission_requested_at).toBeNull();
  });

  test("the first press is kept: its time and its key never change", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    const first = await a.recordSubmit(id, KEY);
    advance(HOUR);
    const again = await a.recordSubmit(id, "00000000-0000-4000-8000-0000000000bb");

    expect(first?.submission_requested_at).toBe(START.toISOString());
    expect(first?.submission_expires_at).toBe("2026-10-08T08:00:00.000Z"); // 48 h from the press (DG-67)
    expect(again?.submission_requested_at).toBe(START.toISOString());
    expect(again?.submission_expires_at).toBe("2026-10-08T08:00:00.000Z"); // a later press never extends it
    expect(again?.submission_key).toBe(KEY);
    await expect(a.update(id, { submission_expires_at: "2099-01-01" } as never)).rejects.toThrow();
    await expect(a.update(id, { submission_key: "x" } as never)).rejects.toThrow();
    await expect(a.update(id, { submission_requested_at: null } as never)).rejects.toThrow();
    await expect(a.recordSubmit(id, "not-a-key")).rejects.toThrow();
  });

  test("a draft whose cancellation was asked for cannot be submitted", async () => {
    const { a } = await repositories();
    const { client_submission_id: id } = await a.create();
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT", cancel_requested_at: START.toISOString() });
    expect((await a.recordSubmit(id, KEY))?.submission_requested_at).toBeNull();
  });
});

describe("a capture is moved into the drafts folder, never copied (DG-63)", () => {
  test("the camera's own file becomes the draft file: the same file, the same bytes, the hash at capture", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const photo = syntheticPhoto();
    const uri = cacheCapture("camera-1.jpg", photo);
    const before = inode(uri);

    const row = await ingestCapture(store.drafts, id, {
      uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: START.toISOString(),
    });

    const stored = draftMediaFile(row.file_name);
    expect(new File(uri).exists).toBe(false);
    expect(inode(stored.uri)).toBe(before); // a rename: the file the camera wrote, not a copy of it
    expect(fsControl.moves).toBe(1);
    expect(fsControl.copies).toBe(0);
    expect(draftMediaDirectory().list()).toHaveLength(1);
    expect(fs.readFileSync(pathOf(stored.uri)).equals(Buffer.from(photo))).toBe(true); // nothing re-encoded or encrypted
    expect(row.sha256).toBe(sha256(photo));
    expect(row.byte_size).toBe(photo.length);
    expect(row.file_name).toBe(`${row.evidence_id}.jpg`);
    expect((await store.drafts.evidence(id))[0]?.source_uri).toBeNull();
    expect(Buffer.from(await readDraftMedia(row.file_name, row.sha256)).equals(Buffer.from(photo))).toBe(
      true,
    );
  });

  test("a refused capture is deleted, and nothing joins the draft", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    for (let n = 1; n <= 3; n++) await ingestCapture(store.drafts, id, photoCapture(`camera-${n}.jpg`));
    const fourth = photoCapture("camera-4.jpg");

    expect(await refusal(ingestCapture(store.drafts, id, fourth))).toBe("photo_limit");
    expect(new File(fourth.uri).exists).toBe(false);
    expect(draftMediaDirectory().list()).toHaveLength(3);
    expect(await store.drafts.evidence(id)).toHaveLength(3);
  });

  test("a capture of a type the app does not accept is refused and deleted", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const capture = { ...photoCapture("camera.png"), mimeType: "image/png" };
    expect(await refusal(ingestCapture(store.drafts, id, capture))).toBe("bad_type");
    expect(new File(capture.uri).exists).toBe(false);
  });

  test("after an unexpected failure before the move, the file is kept where the camera wrote it", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const capture = photoCapture("camera-1.jpg");
    jest.spyOn(store.drafts, "registerEvidence").mockRejectedValueOnce(new Error("disk full"));

    await expect(ingestCapture(store.drafts, id, capture)).rejects.toThrow("disk full");
    expect(new File(capture.uri).exists).toBe(true);
    expect(draftMediaDirectory().exists ? draftMediaDirectory().list() : []).toHaveLength(0);
  });

  test("if the move fails, the draft does not list the item and the file stays where it was", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const capture = photoCapture("camera-1.jpg");
    fsControl.failNextMove = new Error("synthetic move failure");

    await expect(ingestCapture(store.drafts, id, capture)).rejects.toThrow("synthetic move failure");
    expect(new File(capture.uri).exists).toBe(true);
    expect(await store.drafts.evidence(id)).toEqual([]);
  });

  test("a stored file that no longer matches the hash taken at capture is refused when read", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const row = await ingestCapture(store.drafts, id, photoCapture("camera-1.jpg"));
    const path = pathOf(draftMediaFile(row.file_name).uri);
    const bytes = fs.readFileSync(path);
    bytes[40] = (bytes[40] ?? 0) ^ 1;
    fs.writeFileSync(path, bytes);
    await expect(readDraftMedia(row.file_name, row.sha256)).rejects.toThrow(/capture hash/);
  });

  test("media names come only from UUIDs and capture types, so no path leaves the folder", () => {
    expect(() => draftMediaFile("../../SQLite/parakh-drafts.db")).toThrow();
    expect(() => mediaFileName("../x", "image/jpeg")).toThrow();
    expect(() => mediaFileName("00000000-0000-4000-8000-000000000001", "image/png")).toThrow();
    expect(mediaFileName("00000000-0000-4000-8000-000000000001", "video/quicktime")).toMatch(/\.mov$/);
  });
});

describe("a capture interrupted by a crash is finished on the next start", () => {
  /** What ingestion leaves when the app dies after the row and before the move. */
  async function interrupted(store: LocalStore, bytes = syntheticPhoto()) {
    const { client_submission_id: id } = await store.drafts.create();
    const uri = cacheCapture("camera-crash.jpg", bytes);
    const evidence = item("photo", { sha256: sha256(bytes), byteSize: bytes.length, sourceUri: uri });
    await store.drafts.registerEvidence(id, evidence);
    return { id, uri, evidence };
  }

  test("the camera's file is moved now, when it is still there", async () => {
    const { id, uri, evidence } = await interrupted(await openLocalStore(ACCOUNT_A));
    await closeLocalStore();
    const store = await openLocalStore(ACCOUNT_A);

    expect(store.report.captures).toEqual({ completed: 1, lost: 0, pending: 0 });
    expect(new File(uri).exists).toBe(false);
    expect(draftMediaFile(evidence.fileName).exists).toBe(true);
    expect((await store.drafts.evidence(id))[0]?.source_uri).toBeNull();
  });

  test("a file already moved is only marked", async () => {
    const { id, uri, evidence } = await interrupted(await openLocalStore(ACCOUNT_A));
    fs.mkdirSync(pathOf(draftMediaDirectory().uri), { recursive: true });
    fs.renameSync(pathOf(uri), pathOf(draftMediaFile(evidence.fileName).uri));
    await closeLocalStore();
    const store = await openLocalStore(ACCOUNT_A);

    expect(store.report.captures).toEqual({ completed: 1, lost: 0, pending: 0 });
    expect((await store.drafts.evidence(id))[0]?.source_uri).toBeNull();
  });

  test("a capture whose file is gone loses its row and is counted, never lost silently", async () => {
    const { id, uri } = await interrupted(await openLocalStore(ACCOUNT_A));
    fs.unlinkSync(pathOf(uri)); // the system cleared its cache
    await closeLocalStore();
    const store = await openLocalStore(ACCOUNT_A);

    expect(store.report.captures).toEqual({ completed: 0, lost: 1, pending: 0 });
    expect(await store.drafts.evidence(id)).toEqual([]);
  });

  test("a file that does not match the hash taken at capture is never adopted, and never deleted", async () => {
    const { id, uri } = await interrupted(await openLocalStore(ACCOUNT_A));
    fs.writeFileSync(pathOf(uri), syntheticPhoto()); // other bytes under that name
    await closeLocalStore();
    const store = await openLocalStore(ACCOUNT_A);

    expect(store.report.captures).toEqual({ completed: 0, lost: 1, pending: 0 });
    expect(await store.drafts.evidence(id)).toEqual([]);
    expect(new File(uri).exists).toBe(true);
  });

  test("a move that fails again is left for the next start, with nothing deleted", async () => {
    const { id, uri } = await interrupted(await openLocalStore(ACCOUNT_A));
    await closeLocalStore();
    fsControl.failNextMove = new Error("synthetic move failure");
    expect((await openLocalStore(ACCOUNT_A)).report.captures).toEqual({ completed: 0, lost: 0, pending: 1 });
    expect(new File(uri).exists).toBe(true);
    await closeLocalStore();

    const store = await openLocalStore(ACCOUNT_A);
    expect(store.report.captures).toEqual({ completed: 1, lost: 0, pending: 0 });
    expect(await store.drafts.evidence(id)).toHaveLength(1);
  });
});

describe("the open store, sign-out and the wipe protocol (SRS §3.4.3 step 5)", () => {
  test("two accounts on one phone each see only their own drafts", async () => {
    await (await openLocalStore(ACCOUNT_A)).drafts.create();
    expect(await (await openLocalStore(ACCOUNT_B)).drafts.list()).toEqual([]);
    expect(await (await openLocalStore(ACCOUNT_A)).drafts.list()).toHaveLength(1);
  });

  test("closing releases the connection and the foreground watch", async () => {
    await openLocalStore(ACCOUNT_A);
    const watch = (AppState.addEventListener as jest.Mock).mock.results.at(-1)?.value as {
      remove: jest.Mock;
    };
    await closeLocalStore();
    expect(isLocalStoreOpen()).toBe(false);
    expect(control.closed).toBe(control.opened);
    expect(watch.remove).toHaveBeenCalled();
  });

  test("session expiry closes the store before sign-in is shown, and the drafts stay", async () => {
    await (await openLocalStore(ACCOUNT_A)).drafts.create();
    let atSignIn: { open: boolean; connectionClosed: boolean } | null = null;
    const stop = onCitizenSessionEnded(() => {
      atSignIn = { open: isLocalStoreOpen(), connectionClosed: control.closed === control.opened };
    });
    await endCitizenSession("session_expired");
    stop();

    expect(atSignIn).toEqual({ open: false, connectionClosed: true }); // step 5 finished before step 8
    expect(await (await openLocalStore(ACCOUNT_A)).drafts.list()).toHaveLength(1); // kept (§3.4.3.3)
  });

  test("logout closes the store as well", async () => {
    await openLocalStore(ACCOUNT_A);
    await saveCitizenTokens({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
    mockFetch(jsonResponse(204, null));
    await logout();
    expect(isLocalStoreOpen()).toBe(false);
  });

  test("an open that finishes after a close never installs its connection", async () => {
    const pending = openLocalStore(ACCOUNT_A);
    await closeLocalStore();
    await expect(pending).rejects.toBeInstanceOf(LocalStoreClosed);
    expect(isLocalStoreOpen()).toBe(false);
    expect(control.closed).toBe(control.opened);
  });

  test("orphan files are removed; another account's files and names this app never writes are kept", async () => {
    const a = await openLocalStore(ACCOUNT_A);
    const rowA = await ingestCapture(
      a.drafts,
      (await a.drafts.create()).client_submission_id,
      photoCapture("a.jpg"),
    );
    const b = await openLocalStore(ACCOUNT_B);
    const rowB = await ingestCapture(
      b.drafts,
      (await b.drafts.create()).client_submission_id,
      photoCapture("b.jpg"),
    );
    const orphan = draftMediaFile("0000cccc-0000-4000-8000-000000000001.jpg");
    orphan.write(syntheticPhoto());
    const foreign = new File(draftMediaDirectory().uri, "notes.txt");
    foreign.write("not a draft file");

    expect(await sweepOrphanMedia()).toBe(1);
    expect(orphan.exists).toBe(false);
    expect(foreign.exists).toBe(true);
    expect(draftMediaFile(rowA.file_name).exists).toBe(true);
    expect(draftMediaFile(rowB.file_name).exists).toBe(true);
  });

  test("discarding a draft removes its rows and then its files", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await readyDraft(store);
    const [row] = await store.drafts.evidence(draft.client_submission_id);
    await discardDraft(store.drafts, draft.client_submission_id);
    expect(await store.drafts.get(draft.client_submission_id)).toBeNull();
    expect(draftMediaFile(row?.file_name as string).exists).toBe(false);
  });
});

describe("the development self-check", () => {
  test("passes against the fakes and leaves no synthetic data behind", async () => {
    const result = await runStorageSelfCheck();
    expect(result).toEqual({
      legacy: { status: "none" },
      databaseIsPlainSqlite: true,
      captureMovedNotCopied: true,
      mediaMatchesCapture: true,
      lifetimeFixedAtCreation: true,
      expiredDraftDeleted: true,
      pendingSubmissionDeletedAfter48h: true,
      otherOwnerSeesNothing: true,
      cleanedUp: true,
      passed: true,
    });
    expect(draftMediaDirectory().list()).toHaveLength(0);
    expect(Paths.cache.list()).toHaveLength(0);
    expect(await (await openLocalStore(SELF_CHECK_OWNER)).drafts.pendingServerCancellations()).toEqual([]);
  });

  test("a run interrupted earlier leaves nothing that a later run trips over", async () => {
    const leftover = await openLocalStore(SELF_CHECK_OWNER);
    await leftover.drafts.create(); // as if a previous run stopped half-way
    await leftover.drafts.queueServerCancellation("00000000-0000-4000-8000-00000000c4ee");
    expect((await runStorageSelfCheck()).passed).toBe(true);
    expect(await leftover.drafts.list()).toEqual([]);
    expect(await leftover.drafts.pendingServerCancellations()).toEqual([]);
  });
});

describe("interruption and interleaving (review findings R-005 and R-006)", () => {
  type Row = Record<string, unknown>;
  const TABLES = ["drafts", "evidence", "legacy_migration", "schema_version", "server_cancellations"];
  const tables = async (db: ReturnType<typeof memoryDatabase>) =>
    (
      await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
    ).map((t) => t.name);
  const version = async (db: ReturnType<typeof memoryDatabase>) =>
    (await db.getFirstAsync<{ v: number }>("SELECT max(version) AS v FROM schema_version"))?.v;

  test("R-005: an interrupted schema setup is rolled back, and the next open completes it", async () => {
    const db = memoryDatabase();
    control.failOn = /^INSERT INTO schema_version/;
    await expect(migrate(db)).rejects.toThrow("synthetic interruption");
    expect(await tables(db)).toEqual(["schema_version"]); // the schema change was rolled back with it

    await migrate(db);
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM schema_version")).toEqual({
      n: 1,
    });
    expect(await tables(db)).toEqual(TABLES);
    const drafts = draftRepository(db, ACCOUNT_A, clock);
    await drafts.create();
    expect(await drafts.list()).toHaveLength(1);
  });

  test.each([
    ["everything but the version row", "DELETE FROM schema_version;"],
    ["no migration marker", "DELETE FROM schema_version; DROP TABLE legacy_migration;"],
    [
      "no cancellation notes",
      "DELETE FROM schema_version; DROP TABLE legacy_migration; DROP TABLE server_cancellations;",
    ],
    [
      "no evidence table",
      "DELETE FROM schema_version; DROP TABLE legacy_migration; DROP TABLE server_cancellations; DROP TABLE evidence;",
    ],
    [
      "only the drafts table",
      "DELETE FROM schema_version; DROP TABLE legacy_migration; DROP TABLE server_cancellations; DROP TABLE evidence; DROP INDEX drafts_by_expiry; DROP INDEX drafts_by_owner;",
    ],
  ])("R-005: a setup left at %s is completed, and its draft kept with its lifetime", async (_state, cut) => {
    const db = memoryDatabase();
    await migrate(db);
    const kept = await draftRepository(db, ACCOUNT_A, clock).create();
    await db.execAsync(cut);

    await migrate(db);
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await tables(db)).toEqual(TABLES);
    const again = draftRepository(db, ACCOUNT_A, clock);
    const found = await again.get(kept.client_submission_id);
    expect(found?.created_at).toBe(kept.created_at);
    expect(found?.expires_at).toBe(kept.expires_at);
    await again.registerEvidence(kept.client_submission_id, item("photo"));
    expect(await again.evidence(kept.client_submission_id)).toHaveLength(1);
  });

  test("R-005: a table this app does not recognise is refused, never altered, cleared or dropped", async () => {
    const foreign = memoryDatabase();
    await foreign.execAsync("CREATE TABLE drafts (client_submission_id TEXT PRIMARY KEY, other TEXT);");
    await foreign.runAsync("INSERT INTO drafts VALUES (?, ?)", "synthetic-1", "kept");
    await expect(migrate(foreign)).rejects.toThrow();
    expect(await foreign.getAllAsync<Row>("SELECT * FROM drafts")).toEqual([
      { client_submission_id: "synthetic-1", other: "kept" },
    ]);

    const damaged = memoryDatabase();
    await migrate(damaged);
    await damaged.execAsync("ALTER TABLE drafts DROP COLUMN last_error;");
    await expect(migrate(damaged)).rejects.toBeInstanceOf(SchemaMismatch);
    expect(await tables(damaged)).toEqual(TABLES);
  });

  test("R-006: the orphan sweep waits for a capture in flight, and the evidence stays", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    const original = store.drafts.registerEvidence.bind(store.drafts);
    let unblock!: () => void;
    let reached!: () => void;
    const blocked = new Promise<void>((r) => {
      unblock = r;
    });
    const atRegistration = new Promise<void>((r) => {
      reached = r;
    });
    store.drafts.registerEvidence = async (...args) => {
      reached();
      await blocked;
      return original(...args);
    };
    const photo = syntheticPhoto();
    const capture = photoCapture("sweep-race.jpg", photo);

    const pending = ingestCapture(store.drafts, draft.client_submission_id, capture);
    await atRegistration;
    let swept: number | null = null;
    const sweep = sweepOrphanMedia().then((n) => {
      swept = n;
    });
    await settle();
    expect(swept).toBeNull(); // the sweep is waiting for the capture, not racing it

    unblock();
    const row = await pending;
    await sweep;
    expect(swept).toBe(0);
    expect(Buffer.from(await readDraftMedia(row.file_name, row.sha256)).equals(Buffer.from(photo))).toBe(
      true,
    );
  });

  test("R-006: a sweep that is already running finishes before a capture starts", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    const orphan = draftMediaFile("0000dddd-0000-4000-8000-000000000001.jpg");
    draftMediaDirectory().create({ intermediates: true, idempotent: true });
    orphan.write(syntheticPhoto());
    const order: string[] = [];

    const sweep = sweepOrphanMedia().then((n) => order.push(`sweep removed ${n}`));
    const capture = ingestCapture(
      store.drafts,
      draft.client_submission_id,
      photoCapture("after-sweep.jpg"),
    ).then((row) => {
      order.push("capture registered");
      return row;
    });
    const [, row] = await Promise.all([sweep, capture]);

    expect(order).toEqual(["sweep removed 1", "capture registered"]);
    expect(orphan.exists).toBe(false);
    expect(draftMediaFile(row.file_name).exists).toBe(true);
  });

  test("a capture into a draft whose lifetime has just ended is refused, and its file deleted", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    advance(DRAFT_LIFETIME_MS);
    const capture = photoCapture("too-late.jpg");
    expect(await refusal(ingestCapture(store.drafts, draft.client_submission_id, capture))).toBe(
      "unknown_draft",
    );
    expect(new File(capture.uri).exists).toBe(false);
  });
});

describe("schema migration 2: the pending-submission deadline (DG-67)", () => {
  /** A database as the 7 October build left it: schema version 1, no deadline column. */
  async function versionOne() {
    const db = memoryDatabase();
    await migrate(db);
    const a = draftRepository(db, ACCOUNT_A, clock);
    const { client_submission_id: id } = await a.create();
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    await a.recordSubmit(id, "00000000-0000-4000-8000-0000000000aa");
    await db.execAsync(
      `DROP INDEX drafts_by_submission_expiry; ALTER TABLE drafts DROP COLUMN submission_expires_at;
       UPDATE schema_version SET version = 1;`,
    );
    return { db, id };
  }

  test("a version-1 database gains the column, and existing pending submissions get their deadline", async () => {
    const { db, id } = await versionOne();
    await migrate(db);
    expect(await db.getFirstAsync("SELECT max(version) AS v FROM schema_version")).toEqual({
      v: SCHEMA_VERSION,
    });
    expect((await draftRepository(db, ACCOUNT_A, clock).get(id))?.submission_expires_at).toBe(
      "2026-10-08T08:00:00.000Z",
    );
    await migrate(db); // a repeat changes nothing
    expect((await draftRepository(db, ACCOUNT_A, clock).get(id))?.submission_expires_at).toBe(
      "2026-10-08T08:00:00.000Z",
    );
  });

  test("an interrupted migration 2 is rolled back whole, and the next open completes it", async () => {
    const { db, id } = await versionOne();
    control.failOn = /^\s*UPDATE drafts SET submission_expires_at/;
    await expect(migrate(db)).rejects.toThrow("synthetic interruption");
    const columns = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(drafts)")).map((c) => c.name);
    expect(columns).not.toContain("submission_expires_at"); // the column went back with the rest
    expect(await db.getFirstAsync("SELECT max(version) AS v FROM schema_version")).toEqual({ v: 1 });

    await migrate(db);
    expect((await draftRepository(db, ACCOUNT_A, clock).get(id))?.submission_expires_at).toBe(
      "2026-10-08T08:00:00.000Z",
    );
  });

  test("migration 2 replayed on a database that already has the column only fills in what is missing", async () => {
    const db = memoryDatabase();
    await migrate(db);
    const a = draftRepository(db, ACCOUNT_A, clock);
    const { client_submission_id: id } = await a.create();
    await a.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    await a.recordSubmit(id, "00000000-0000-4000-8000-0000000000aa");
    await db.execAsync("DELETE FROM schema_version;"); // as an interrupted earlier build could leave it
    await migrate(db);
    expect((await a.get(id))?.submission_expires_at).toBe("2026-10-08T08:00:00.000Z");
  });
});

describe("the development retention-test items", () => {
  test("follow the real rules: a draft 48 h from creation, a pending submission 48 h from Submit", async () => {
    await createTestDraft();
    advance(HOUR);
    await createTestPendingSubmission();
    const items = await listTestItems();
    expect(items.map((i) => [i.kind, i.deletesAt, i.files])).toEqual([
      ["pending_submission", "2026-10-08T09:00:00.000Z", 1],
      ["draft", "2026-10-08T08:00:00.000Z", 1],
    ]);

    advance(47 * HOUR); // 48 h after the draft was created
    expect(await purgeExpired()).toEqual({ drafts: 1, pendingSubmissions: 0 });
    expect((await listTestItems()).map((i) => i.kind)).toEqual(["pending_submission"]);
    advance(HOUR); // 48 h after Submit
    expect(await purgeExpired()).toEqual({ drafts: 0, pendingSubmissions: 1 });
    expect(await listTestItems()).toEqual([]);
    expect(await (await openLocalStore(RETENTION_TEST_OWNER)).drafts.pendingServerCancellations()).toEqual(
      [],
    );
  });

  test("survive a restart, and can be removed", async () => {
    await createTestDraft();
    await createTestPendingSubmission();
    await closeLocalStore();
    expect(await listTestItems()).toHaveLength(2);
    expect(await removeTestItems()).toBe(2);
    expect(await listTestItems()).toEqual([]);
    expect(draftMediaDirectory().list()).toHaveLength(0);
  });

  test("are never sent: no queue runs for their account", async () => {
    await createTestPendingSubmission();
    const [item] = await listTestItems();
    const draft = await repositoryAt(RETENTION_TEST_OWNER, clock).get(item?.id as string);
    expect(draft).toMatchObject({ submission_outcome: null, attempts: 0, first_submission_attempt_at: null });
  });
});

describe("local status: a saved draft is never mistaken for a pending submission", () => {
  test("each kind says what it is and when it is deleted", async () => {
    const { a } = await repositories();
    const draft = await a.create();
    expect(localStatus(draft)).toEqual({ kind: "draft", deletesAt: "2026-10-08T08:00:00.000Z" });
    await a.update(draft.client_submission_id, { pipeline_state: "READY_TO_SUBMIT" });
    advance(HOUR);
    const pending = (await a.recordSubmit(
      draft.client_submission_id,
      "00000000-0000-4000-8000-0000000000aa",
    )) as DraftRow;
    expect(localStatus(pending)).toEqual({
      kind: "pending_submission",
      confirmed: false,
      deletesAt: "2026-10-08T09:00:00.000Z",
      needsReporter: false,
      cancelling: false,
    });
    const refused = (await a.update(draft.client_submission_id, {
      submission_outcome: "rejected",
    })) as DraftRow;
    expect(localStatus(refused)).toMatchObject({ kind: "pending_submission", needsReporter: true });
    const received = (await a.update(draft.client_submission_id, {
      report_reference: "PRK-7Q2X-91KD",
    })) as DraftRow;
    expect(localStatus(received)).toEqual({ kind: "received", reportReference: "PRK-7Q2X-91KD" });
  });
});

describe("session tokens stay on this phone (DG-59)", () => {
  test("they are written for this device only, so a restored backup does not carry them", async () => {
    await saveCitizenTokens({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
    for (const key of ["parakh.citizen.access_token", "parakh.citizen.refresh_token"]) {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, expect.any(String), {
        keychainAccessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
      });
    }
  });
});
