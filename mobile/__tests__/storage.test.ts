/**
 * T-047: owner-bound encrypted local storage (LDS-2, LDS-3, LDS-4; DR-23).
 *
 * SQLCipher is SIMULATED here (fakes/sqlite.ts); AES-256-GCM and SHA-256 are
 * Node's real implementations behind the expo-crypto interface. These tests
 * prove the client's control flow. Encryption by the real native modules is
 * checked on the emulator and must be confirmed on devices (DEP-08).
 */
import { createHash, randomBytes } from "crypto";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as fs from "fs";

import { logout } from "../src/api/auth";
import { endCitizenSession, onCitizenSessionEnded } from "../src/auth/session";
import { saveCitizenTokens } from "../src/services/secureStorage";
import { toHex } from "../src/storage/bytes";
import { ingestCapture } from "../src/storage/capture";
import { databaseFile, hasPlaintextHeader, openEncryptedDatabase } from "../src/storage/database";
import { draftRepository, EvidenceRefused, type NewEvidence } from "../src/storage/drafts";
import { DB_KEY_NAME, LocalStorageUnavailable } from "../src/storage/key";
import {
  closeLocalStore,
  isLocalStoreOpen,
  LocalStoreClosed,
  openLocalStore,
  removeOrphanMedia,
} from "../src/storage/localStore";
import {
  deriveMediaKey,
  MediaIntegrityError,
  mediaDirectory,
  mediaFile,
  readDecrypted,
  sha256Hex,
  writeEncrypted,
} from "../src/storage/media";
import { migrate, SCHEMA_VERSION, SchemaMismatch } from "../src/storage/schema";
import { runStorageSelfCheck, SELF_CHECK_OWNER } from "../src/storage/selfCheck";
import { File, Paths, pathOf, resetFileSystem } from "./fakes/fileSystem";
import { control, memoryDatabase, resetSqlite } from "./fakes/sqlite";
import { jsonResponse, mockFetch, secureStoreContents } from "./helpers";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111"; // synthetic
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222"; // synthetic
const MARKER = Buffer.from("PARAKH-SYNTHETIC-PHOTO-BYTES");
const CAPTURED_AT = "2026-10-05T06:00:00.000Z";

function syntheticPhoto(size = 4096): Uint8Array {
  return new Uint8Array(Buffer.concat([MARKER, randomBytes(size)]));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function contains(haystack: Buffer, needle: Buffer): boolean {
  return haystack.indexOf(needle) !== -1;
}

function cacheCapture(name: string, bytes: Uint8Array): string {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  return file.uri;
}

function item(kind: NewEvidence["kind"], extra: Partial<NewEvidence> = {}): NewEvidence {
  const bytes = randomBytes(64);
  const mimeType = kind === "photo" ? "image/jpeg" : kind === "video" ? "video/mp4" : "audio/mp4";
  return {
    evidenceId: `0000aaaa-0000-4000-8000-${randomBytes(6).toString("hex")}`,
    kind,
    mimeType,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    capturedAt: CAPTURED_AT,
    ...extra,
  };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(EvidenceRefused);
  return (error as EvidenceRefused).reason;
}

async function unavailable(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LocalStorageUnavailable);
  return (error as LocalStorageUnavailable).reason;
}

beforeEach(async () => {
  await closeLocalStore();
  resetFileSystem();
  resetSqlite("sqlcipher");
  secureStoreContents().clear();
});

describe("database key custody (DR-23 rules 3, 4, 5 and 8)", () => {
  test("first launch makes a 256-bit key, keeps it only in SecureStore, and applies it first", async () => {
    const { db, key, cipherVersion } = await openEncryptedDatabase();
    const stored = secureStoreContents().get(DB_KEY_NAME) as string;

    expect(key).toHaveLength(32);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toBe(toHex(key));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(DB_KEY_NAME, stored, {
      keychainAccessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    });
    expect(control.statements[0]).toBe(`PRAGMA key = "x'${stored}'";`);
    expect(cipherVersion).toMatch(/simulated/);

    const onDisk = fs.readFileSync(pathOf(databaseFile().uri));
    expect(hasPlaintextHeader(onDisk.subarray(0, 16))).toBe(false);
    expect(contains(onDisk, Buffer.from(stored))).toBe(false); // the key is not in the database file
    await db.closeAsync();
  });

  test("a reopen reuses the stored key and never creates another", async () => {
    await (await openEncryptedDatabase()).db.closeAsync();
    const stored = secureStoreContents().get(DB_KEY_NAME);
    control.statements = [];
    await (await openEncryptedDatabase()).db.closeAsync();

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(control.statements[0]).toBe(`PRAGMA key = "x'${stored}'";`);
  });

  test("an existing database whose key is missing fails closed and gets no new key", async () => {
    await (await openEncryptedDatabase()).db.closeAsync();
    const before = fs.readFileSync(pathOf(databaseFile().uri));
    secureStoreContents().clear();
    const opens = control.opened;

    expect(await unavailable(openEncryptedDatabase())).toBe("key_missing");
    expect(secureStoreContents().has(DB_KEY_NAME)).toBe(false);
    expect(control.opened).toBe(opens); // the database was not even opened
    expect(fs.readFileSync(pathOf(databaseFile().uri)).equals(before)).toBe(true);
  });

  test("an unreadable or malformed key fails closed", async () => {
    await (await openEncryptedDatabase()).db.closeAsync();
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keystore unavailable"));
    expect(await unavailable(openEncryptedDatabase())).toBe("key_unreadable");

    secureStoreContents().set(DB_KEY_NAME, "not-a-key");
    expect(await unavailable(openEncryptedDatabase())).toBe("key_unreadable");
  });

  test("another key cannot open the database, and the connection is closed", async () => {
    await (await openEncryptedDatabase()).db.closeAsync();
    secureStoreContents().set(DB_KEY_NAME, toHex(randomBytes(32)));
    const closed = control.closed;

    expect(await unavailable(openEncryptedDatabase())).toBe("wrong_key");
    expect(control.closed).toBe(closed + 1);
  });

  test("a build without SQLCipher refuses to store anything (no plaintext fallback)", async () => {
    resetSqlite("plain"); // real unencrypted SQLite: PRAGMA key is ignored, cipher_version is absent
    expect(await unavailable(openEncryptedDatabase())).toBe("not_encrypted");
    expect(control.closed).toBe(1);
    expect(control.statements.filter((s) => /CREATE TABLE/i.test(s))).toEqual([]); // stopped before any schema work
  });

  test("any other failure while opening still fails closed, with the connection closed", async () => {
    const { db } = await openEncryptedDatabase();
    await db.runAsync("UPDATE schema_version SET version = ?", SCHEMA_VERSION + 1); // written by a newer app
    await db.closeAsync();
    const closed = control.closed;

    expect(await unavailable(openEncryptedDatabase())).toBe("open_failed");
    expect(control.closed).toBe(closed + 1);
  });

  test("a cipher that ignored the key is caught by the file-header check", async () => {
    resetSqlite("key_ignored");
    expect(await unavailable(openEncryptedDatabase())).toBe("not_encrypted");
    expect(control.closed).toBe(1);
  });
});

describe("media encrypted before it is written (LDS-4, DR-23 rules 6 and 7)", () => {
  const databaseKey = new Uint8Array(randomBytes(32));
  const id = "0000bbbb-0000-4000-8000-000000000001";

  test("the media key is derived from the database key, not equal to it", async () => {
    const one = (await deriveMediaKey(databaseKey)) as unknown as { material: Buffer };
    const two = (await deriveMediaKey(databaseKey)) as unknown as { material: Buffer };
    expect(one.material.equals(two.material)).toBe(true);
    expect(one.material.equals(Buffer.from(databaseKey))).toBe(false);
  });

  test("the file on disk is ciphertext and decrypts to exactly the captured bytes", async () => {
    const key = await deriveMediaKey(databaseKey);
    const photo = syntheticPhoto();
    await writeEncrypted(key, id, photo);

    const raw = fs.readFileSync(pathOf(mediaFile(id).uri));
    expect(raw.subarray(0, 4).toString()).toBe("PKM1");
    expect(raw).toHaveLength(4 + 12 + photo.length + 16);
    expect(contains(raw, MARKER)).toBe(false);
    expect(Buffer.from(await readDecrypted(key, id, sha256(photo))).equals(Buffer.from(photo))).toBe(true);
  });

  test("an item is written once and never replaced", async () => {
    const key = await deriveMediaKey(databaseKey);
    await writeEncrypted(key, id, syntheticPhoto());
    const before = fs.readFileSync(pathOf(mediaFile(id).uri));
    await expect(writeEncrypted(key, id, syntheticPhoto())).rejects.toThrow(/write-once/);
    expect(fs.readFileSync(pathOf(mediaFile(id).uri)).equals(before)).toBe(true);
  });

  test("a changed byte, a file moved under another id, or a wrong hash fails the integrity check", async () => {
    const key = await deriveMediaKey(databaseKey);
    const photo = syntheticPhoto();
    await writeEncrypted(key, id, photo);
    const path = pathOf(mediaFile(id).uri);
    const good = fs.readFileSync(path);

    const other = "0000bbbb-0000-4000-8000-000000000002";
    fs.writeFileSync(pathOf(mediaFile(other).uri), good);
    await expect(readDecrypted(key, other, sha256(photo))).rejects.toBeInstanceOf(MediaIntegrityError);

    await expect(readDecrypted(key, id, "0".repeat(64))).rejects.toBeInstanceOf(MediaIntegrityError);

    const tampered = Buffer.from(good);
    tampered[40] = (tampered[40] ?? 0) ^ 1;
    fs.writeFileSync(path, tampered);
    await expect(readDecrypted(key, id, sha256(photo))).rejects.toBeInstanceOf(MediaIntegrityError);
  });

  test("evidence ids must be UUIDs, so no path can escape the media directory", () => {
    expect(() => mediaFile("../../SQLite/parakh-local")).toThrow();
  });
});

describe("drafts are bound to their owner (FR-COMMON.25, SC-10)", () => {
  async function repositories() {
    const db = memoryDatabase();
    await migrate(db);
    return { db, a: draftRepository(db, ACCOUNT_A), b: draftRepository(db, ACCOUNT_B) };
  }

  test("a new draft is a LOCAL_DRAFT with a client id and no reference", async () => {
    const { a } = await repositories();
    const draft = await a.create();
    expect(draft.client_submission_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft.pipeline_state).toBe("LOCAL_DRAFT");
    expect(draft.owner_account_id).toBe(ACCOUNT_A);
    expect(draft.report_reference).toBeNull();
  });

  test("another account cannot list, open, change, delete or add to it", async () => {
    const { a, b } = await repositories();
    const draft = await a.create();
    await a.registerEvidence(draft.client_submission_id, item("photo"));

    expect(await b.list()).toEqual([]);
    expect(await b.get(draft.client_submission_id)).toBeNull();
    expect(await b.evidence(draft.client_submission_id)).toEqual([]);
    expect(await b.update(draft.client_submission_id, { category: "street_lights" })).toBeNull();
    expect(await b.remove(draft.client_submission_id)).toEqual([]);
    expect(await b.removeEvidence(draft.client_submission_id, "x")).toBeNull();
    expect(await refusal(b.registerEvidence(draft.client_submission_id, item("photo")))).toBe(
      "unknown_draft",
    );

    expect((await a.get(draft.client_submission_id))?.category).toBeNull();
    expect(await a.evidence(draft.client_submission_id)).toHaveLength(1);
  });

  test("identity, ownership and timestamps are not editable", async () => {
    const { a } = await repositories();
    const draft = await a.create();
    await expect(
      a.update(draft.client_submission_id, { owner_account_id: ACCOUNT_B } as never),
    ).rejects.toThrow();
    await expect(a.update(draft.client_submission_id, { created_at: "x" } as never)).rejects.toThrow();
    expect(() => draftRepository(memoryDatabase(), "")).toThrow();
  });

  test("1–3 photos, one optional video of up to 60 seconds, one voice original (DG-47, DG-54)", async () => {
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

  test("migrations run once and a newer database is refused", async () => {
    const { db } = await repositories();
    await migrate(db);
    expect(await db.getFirstAsync<{ version: number }>("SELECT version FROM schema_version")).toEqual({
      version: SCHEMA_VERSION,
    });
    await db.runAsync("UPDATE schema_version SET version = ?", SCHEMA_VERSION + 1);
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
});

describe("a capture becomes encrypted evidence (FR-PUB.5, NFR-9)", () => {
  test("the plaintext cache file is replaced by an encrypted copy that carries the capture hash", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    const photo = syntheticPhoto();
    const uri = cacheCapture("camera-1.jpg", photo);

    const row = await ingestCapture(store, draft.client_submission_id, {
      uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: CAPTURED_AT,
    });

    expect(new File(uri).exists).toBe(false);
    expect(row.sha256).toBe(sha256(photo));
    expect(row.byte_size).toBe(photo.length);
    expect(contains(fs.readFileSync(pathOf(mediaFile(row.evidence_id).uri)), MARKER)).toBe(false);
    const back = await readDecrypted(store.mediaKey, row.evidence_id, row.sha256);
    expect(Buffer.from(back).equals(Buffer.from(photo))).toBe(true);
    expect(await sha256Hex(back)).toBe(row.sha256);
  });

  test("a refused capture leaves neither plaintext nor ciphertext behind", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const capture = (n: number) => ({
      uri: cacheCapture(`camera-${n}.jpg`, syntheticPhoto()),
      kind: "photo" as const,
      mimeType: "image/jpeg",
      capturedAt: CAPTURED_AT,
    });
    for (let n = 1; n <= 3; n++) await ingestCapture(store, id, capture(n));
    const fourth = capture(4);

    expect(await refusal(ingestCapture(store, id, fourth))).toBe("photo_limit");
    expect(new File(fourth.uri).exists).toBe(false);
    expect(mediaDirectory().list()).toHaveLength(3);
  });

  test("a stored copy that does not decrypt to the captured bytes is discarded, and the plaintext kept", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const uri = cacheCapture("camera-1.jpg", syntheticPhoto());
    const encrypt = jest.mocked(Crypto.aesEncryptAsync);
    const genuine = encrypt.getMockImplementation() as typeof Crypto.aesEncryptAsync;
    encrypt.mockImplementationOnce(async (plaintext, key, options) => {
      const altered = new Uint8Array(plaintext as Uint8Array);
      altered[0] = (altered[0] ?? 0) ^ 1; // a write that silently changed one byte
      return genuine(altered, key, options);
    });

    await expect(
      ingestCapture(store, id, { uri, kind: "photo", mimeType: "image/jpeg", capturedAt: CAPTURED_AT }),
    ).rejects.toBeInstanceOf(MediaIntegrityError);
    expect(new File(uri).exists).toBe(true);
    expect(mediaDirectory().list()).toHaveLength(0);
    expect(await store.drafts.evidence(id)).toEqual([]);
  });

  test("after an unexpected failure the plaintext is kept, so no evidence is lost", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const { client_submission_id: id } = await store.drafts.create();
    const uri = cacheCapture("camera-1.jpg", syntheticPhoto());
    jest.spyOn(store.drafts, "registerEvidence").mockRejectedValueOnce(new Error("disk full"));

    await expect(
      ingestCapture(store, id, { uri, kind: "photo", mimeType: "image/jpeg", capturedAt: CAPTURED_AT }),
    ).rejects.toThrow("disk full");
    expect(new File(uri).exists).toBe(true);
    expect(mediaDirectory().list()).toHaveLength(0);
  });
});

describe("the open store, sign-out and the wipe protocol (SRS §3.4.3 step 5)", () => {
  test("two accounts on one phone each see only their own drafts", async () => {
    await (await openLocalStore(ACCOUNT_A)).drafts.create();
    expect(await (await openLocalStore(ACCOUNT_B)).drafts.list()).toEqual([]);
    expect(await (await openLocalStore(ACCOUNT_A)).drafts.list()).toHaveLength(1);
  });

  test("closing releases the connection and the key; the next open reads the key again", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const reads = (SecureStore.getItemAsync as jest.Mock).mock.calls.length;
    await closeLocalStore();

    expect(isLocalStoreOpen()).toBe(false);
    expect(control.closed).toBe(control.opened);
    expect((store.mediaKey as unknown as { released: boolean }).released).toBe(true);
    await openLocalStore(ACCOUNT_A);
    expect((SecureStore.getItemAsync as jest.Mock).mock.calls.length).toBe(reads + 1);
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
    expect(secureStoreContents().has(DB_KEY_NAME)).toBe(true); // drafts are kept, not wiped (§3.4.3.3)
    expect(await (await openLocalStore(ACCOUNT_A)).drafts.list()).toHaveLength(1);
  });

  test("logout closes the store as well", async () => {
    await openLocalStore(ACCOUNT_A);
    await saveCitizenTokens({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
    mockFetch(jsonResponse(204, null));
    await logout();
    expect(isLocalStoreOpen()).toBe(false);
    expect(secureStoreContents().has(DB_KEY_NAME)).toBe(true);
  });

  test("an open that finishes after a close never installs its connection", async () => {
    const pending = openLocalStore(ACCOUNT_A);
    await closeLocalStore();
    await expect(pending).rejects.toBeInstanceOf(LocalStoreClosed);
    expect(isLocalStoreOpen()).toBe(false);
    expect(control.closed).toBe(control.opened);
  });

  test("orphaned ciphertext is removed, and another account's files are kept", async () => {
    const capture = (name: string) => ({
      uri: cacheCapture(name, syntheticPhoto()),
      kind: "photo" as const,
      mimeType: "image/jpeg",
      capturedAt: CAPTURED_AT,
    });
    const a = await openLocalStore(ACCOUNT_A);
    const rowA = await ingestCapture(a, (await a.drafts.create()).client_submission_id, capture("a.jpg"));
    const b = await openLocalStore(ACCOUNT_B);
    const rowB = await ingestCapture(b, (await b.drafts.create()).client_submission_id, capture("b.jpg"));
    const orphan = "0000cccc-0000-4000-8000-000000000001";
    await writeEncrypted(a.mediaKey, orphan, syntheticPhoto());

    expect(await removeOrphanMedia()).toBe(1);
    expect(mediaFile(orphan).exists).toBe(false);
    expect(mediaFile(rowA.evidence_id).exists).toBe(true);
    expect(mediaFile(rowB.evidence_id).exists).toBe(true);
  });
});

describe("the development self-check (a DEP-08 evidence helper)", () => {
  test("passes against the simulated cipher and leaves no synthetic data behind", async () => {
    const result = await runStorageSelfCheck();
    expect(result).toMatchObject({
      databaseHeaderEncrypted: true,
      mediaCiphertextOnly: true,
      mediaRoundTrip: true,
      plaintextCacheRemoved: true,
      otherOwnerSeesNothing: true,
      cleanedUp: true,
      passed: true,
    });
    expect(mediaDirectory().list()).toHaveLength(0);
    expect(Paths.cache.list()).toHaveLength(0);
  });

  test("a run interrupted earlier leaves nothing that a later run trips over", async () => {
    const leftover = await openLocalStore(SELF_CHECK_OWNER);
    await leftover.drafts.create(); // as if a previous run stopped half-way
    expect((await runStorageSelfCheck()).passed).toBe(true);
    expect(await leftover.drafts.list()).toEqual([]);
  });

  test("a build without SQLCipher fails the check instead of passing it", async () => {
    resetSqlite("plain");
    expect(await unavailable(runStorageSelfCheck())).toBe("not_encrypted");
  });
});

describe("interruption and interleaving (review findings R-005 and R-006)", () => {
  type Row = Record<string, unknown>;
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
    const realRun = db.runAsync.bind(db);
    let interrupted = false;
    db.runAsync = async (sql: string, ...args: (string | number | null)[]) => {
      if (!interrupted && sql.startsWith("INSERT INTO schema_version")) {
        interrupted = true;
        throw new Error("synthetic interruption before version checkpoint");
      }
      return realRun(sql, ...args);
    };

    await expect(migrate(db)).rejects.toThrow("synthetic interruption");
    expect(await tables(db)).toEqual(["schema_version"]); // the schema change was rolled back with it

    await migrate(db); // the next open recovers instead of failing closed for ever
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM schema_version")).toEqual({
      n: 1,
    });
    expect(await tables(db)).toEqual(["drafts", "evidence", "pending_consent", "schema_version"]);
    const drafts = draftRepository(db, ACCOUNT_A);
    await drafts.create();
    expect(await drafts.list()).toHaveLength(1);
  });

  // Every state the earlier, non-transactional setup could stop in: each prefix of migration 1's
  // statements, with no version row. The first is the review's case (everything but the version).
  test.each([
    ["everything but the version row", "DELETE FROM schema_version;"],
    ["no consent table", "DELETE FROM schema_version; DROP TABLE pending_consent;"],
    [
      "no evidence index",
      "DELETE FROM schema_version; DROP TABLE pending_consent; DROP INDEX evidence_by_draft;",
    ],
    ["no evidence table", "DELETE FROM schema_version; DROP TABLE pending_consent; DROP TABLE evidence;"],
    [
      "only the drafts table",
      "DELETE FROM schema_version; DROP TABLE pending_consent; DROP TABLE evidence; DROP INDEX drafts_by_owner;",
    ],
  ])("R-005: a setup an earlier build left at %s is completed, and its draft kept", async (_state, cut) => {
    const db = memoryDatabase();
    await migrate(db);
    const kept = await draftRepository(db, ACCOUNT_A).create();
    await db.execAsync(cut);

    await migrate(db);
    expect(await version(db)).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM schema_version")).toEqual({
      n: 1,
    });
    expect(await tables(db)).toEqual(["drafts", "evidence", "pending_consent", "schema_version"]);
    const again = draftRepository(db, ACCOUNT_A);
    expect((await again.get(kept.client_submission_id))?.created_at).toBe(kept.created_at);
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
    expect(await tables(damaged)).toEqual(["drafts", "evidence", "pending_consent", "schema_version"]);
  });

  test("R-005: through the opener, an interrupted first setup does not lock the drafts out", async () => {
    const { db } = await openEncryptedDatabase();
    await db.execAsync("DELETE FROM schema_version; DROP TABLE evidence;"); // a setup cut short
    await db.closeAsync();

    const reopened = await openEncryptedDatabase(); // completes the setup instead of failing closed
    expect(await version(reopened.db as unknown as ReturnType<typeof memoryDatabase>)).toBe(SCHEMA_VERSION);
    await reopened.db.closeAsync();
  });

  test("R-006: the orphan sweep waits for a capture in flight, and the evidence stays decryptable", async () => {
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
    const uri = cacheCapture("sweep-race.jpg", photo);

    const pending = ingestCapture(store, draft.client_submission_id, {
      uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: CAPTURED_AT,
    });
    await atRegistration; // the ciphertext is on disk and its row does not exist yet
    let swept: number | null = null;
    const sweep = removeOrphanMedia().then((n) => {
      swept = n;
    });
    await new Promise((r) => setTimeout(r, 25));
    expect(swept).toBeNull(); // the sweep is waiting for the capture, not racing it

    unblock();
    const row = await pending;
    await sweep;
    expect(swept).toBe(0);
    expect(await store.drafts.evidence(draft.client_submission_id)).toHaveLength(1);
    expect(mediaFile(row.evidence_id).exists).toBe(true);
    const back = await readDecrypted(store.mediaKey, row.evidence_id, row.sha256);
    expect(Buffer.from(back).equals(Buffer.from(photo))).toBe(true);
    expect(new File(uri).exists).toBe(false); // the plaintext went only once the row existed
  });

  test("R-006: a sweep that is already running finishes before a capture writes anything", async () => {
    const store = await openLocalStore(ACCOUNT_A);
    const draft = await store.drafts.create();
    const orphan = "0000dddd-0000-4000-8000-000000000001";
    await writeEncrypted(store.mediaKey, orphan, syntheticPhoto());
    const order: string[] = [];

    const sweep = removeOrphanMedia().then((n) => order.push(`sweep removed ${n}`));
    const capture = ingestCapture(store, draft.client_submission_id, {
      uri: cacheCapture("after-sweep.jpg", syntheticPhoto()),
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: CAPTURED_AT,
    }).then((row) => {
      order.push("capture registered");
      return row;
    });
    const [, row] = await Promise.all([sweep, capture]);

    expect(order).toEqual(["sweep removed 1", "capture registered"]);
    expect(mediaFile(orphan).exists).toBe(false);
    expect(mediaFile(row.evidence_id).exists).toBe(true);
  });
});
