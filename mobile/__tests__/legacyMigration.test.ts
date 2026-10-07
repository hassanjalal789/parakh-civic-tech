/**
 * T-128: drafts of the 5 October 2026 development build move once from the
 * superseded encrypted store into the plain one, without loss (DG-63; Mobile
 * SRS v2.3.0 §3.6.3, "Transition").
 *
 * The old store is built here exactly as that build wrote it: the same
 * schema, the key in secure storage, and each item sealed as "PKM1" ‖
 * AES-256-GCM. SQLCipher is SIMULATED (fakes/sqlite.ts) and AES-256-GCM is
 * Node's, behind the expo-crypto interface. All data is synthetic.
 */
import { createHash, randomBytes } from "crypto";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import * as fs from "fs";
import * as path from "path";

import { concat, toHex, utf8 } from "../src/storage/bytes";
import { draftDatabaseFile, hasPlaintextHeader } from "../src/storage/database";
import {
  LEGACY_DB_NAME,
  LEGACY_KEY_NAME,
  legacyDatabaseFile,
  legacyMediaDirectory,
  legacyMediaFile,
  legacyMediaKey,
} from "../src/storage/legacy/legacyStore";
import { discardDraft } from "../src/storage/lifetime";
import { closeLocalStore, openLocalStore, setStoreClock } from "../src/storage/localStore";
import { draftMediaDirectory, draftMediaFile, readDraftMedia } from "../src/storage/media";
import { pathOf, resetFileSystem } from "./fakes/fileSystem";
import { control, defaultDatabaseDirectory, resetSqlite } from "./fakes/sqlite";
import { secureStoreContents } from "./helpers";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111"; // synthetic
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222"; // synthetic
const NOW = new Date("2026-10-06T08:00:00.000Z");
const KEY_K = "0000eeee-0000-4000-8000-000000000001";

/** The 5 October schema, verbatim (the build wrote nothing to pending_consent). */
const OLD_SCHEMA = `CREATE TABLE schema_version (version INTEGER NOT NULL);
  INSERT INTO schema_version (version) VALUES (1);
  CREATE TABLE drafts (
    client_submission_id TEXT PRIMARY KEY,
    owner_account_id TEXT NOT NULL,
    pipeline_state TEXT NOT NULL,
    category TEXT,
    description_mode TEXT NOT NULL DEFAULT 'voice',
    typed_description TEXT,
    latitude REAL,
    longitude REAL,
    accuracy_m REAL,
    location_source TEXT,
    location_unverified INTEGER NOT NULL DEFAULT 0,
    rendering_version INTEGER,
    rendering_content_hash TEXT,
    submission_key TEXT,
    first_submission_attempt_at TEXT,
    next_attempt_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    report_id TEXT,
    report_reference TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX drafts_by_owner ON drafts (owner_account_id, updated_at);`;

const OLD_EVIDENCE = `CREATE TABLE evidence (
    evidence_id TEXT PRIMARY KEY,
    client_submission_id TEXT NOT NULL REFERENCES drafts (client_submission_id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    duration_seconds REAL,
    uploaded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX evidence_by_draft ON evidence (client_submission_id);
  CREATE TABLE pending_consent (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`;

type OldDraft = {
  id: string;
  owner: string;
  createdAt: string;
  state?: string;
  submissionKey?: string | null;
  firstAttemptAt?: string | null;
  attempts?: number;
};
type OldItem = {
  id: string;
  draftId: string;
  kind: "photo" | "video" | "voice_original";
  mime: string;
  bytes: Uint8Array;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function synthetic(size = 2048): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from("PARAKH-SYNTHETIC-LEGACY"), randomBytes(size)]));
}

const L1 = "0000a001-0000-4000-8000-000000000001";
const L2 = "0000a001-0000-4000-8000-000000000002";

function photo(id: string, draftId: string): OldItem {
  return { id, draftId, kind: "photo", mime: "image/jpeg", bytes: synthetic() };
}

/** Writes the old store as the 5 October build left it. */
async function oldStore(
  drafts: OldDraft[],
  items: OldItem[],
  options: { key?: "stored" | "absent" | "other"; consentRow?: boolean; evidenceTable?: boolean } = {},
): Promise<void> {
  const key = new Uint8Array(randomBytes(32));
  const db = await SQLite.openDatabaseAsync(LEGACY_DB_NAME, { useNewConnection: true });
  await db.execAsync(`PRAGMA key = "x'${toHex(key)}'";`);
  await db.execAsync(OLD_SCHEMA);
  if (options.evidenceTable !== false) await db.execAsync(OLD_EVIDENCE);
  for (const d of drafts) {
    await db.runAsync(
      `INSERT INTO drafts (client_submission_id, owner_account_id, pipeline_state, category, typed_description,
         latitude, longitude, accuracy_m, location_source, submission_key, first_submission_attempt_at, attempts,
         created_at, updated_at)
       VALUES (?, ?, ?, 'water', 'synthetic typed text', 31.52, 74.35, 12.5, 'device', ?, ?, ?, ?, ?)`,
      d.id,
      d.owner,
      d.state ?? "LOCAL_DRAFT",
      d.submissionKey ?? null,
      d.firstAttemptAt ?? null,
      d.attempts ?? 0,
      d.createdAt,
      d.createdAt,
    );
  }
  for (const e of items) {
    await db.runAsync(
      `INSERT INTO evidence (evidence_id, client_submission_id, kind, mime_type, byte_size, sha256, captured_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      e.id,
      e.draftId,
      e.kind,
      e.mime,
      e.bytes.length,
      sha256(e.bytes),
      "2026-10-05T10:00:00.000Z",
      "2026-10-05T10:00:00.000Z",
    );
  }
  if (options.consentRow) {
    await db.runAsync(
      "INSERT INTO pending_consent (id, payload_json, created_at) VALUES (1, '{}', ?)",
      NOW.toISOString(),
    );
  }
  await db.closeAsync();
  const mediaKey = await legacyMediaKey(key);
  legacyMediaDirectory().create({ intermediates: true, idempotent: true });
  for (const e of items) {
    const sealed = await Crypto.aesEncryptAsync(e.bytes, mediaKey, {
      additionalData: utf8(`parakh-media-v1:${e.id}`),
    });
    legacyMediaFile(e.id).write(concat(utf8("PKM1"), await sealed.combined()));
  }
  const mode = options.key ?? "stored";
  if (mode === "stored") secureStoreContents().set(LEGACY_KEY_NAME, toHex(key));
  if (mode === "other") secureStoreContents().set(LEGACY_KEY_NAME, toHex(randomBytes(32)));
}

/** A fingerprint of every file of the old store, to prove it was left untouched. */
function oldFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of [defaultDatabaseDirectory, pathOf(legacyMediaDirectory().uri)]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith("parakh-drafts")) continue; // the new store
      out[name] = sha256(fs.readFileSync(path.join(dir, name)));
    }
  }
  return out;
}

function oldStoreGone(): boolean {
  const media = legacyMediaDirectory();
  return (
    !legacyDatabaseFile().exists &&
    !fs.existsSync(`${pathOf(legacyDatabaseFile().uri)}.rows`) &&
    !(media.exists && media.list().length > 0) &&
    !secureStoreContents().has(LEGACY_KEY_NAME)
  );
}

beforeEach(async () => {
  await closeLocalStore();
  resetFileSystem();
  resetSqlite();
  secureStoreContents().clear();
  setStoreClock(() => NOW);
});

describe("a readable old store is moved once, then removed", () => {
  test("every draft and item arrives, with its original creation time; then the old database, media and key go", async () => {
    const items = [
      photo("0000b001-0000-4000-8000-000000000001", L1),
      photo("0000b001-0000-4000-8000-000000000002", L1),
      {
        ...photo("0000b001-0000-4000-8000-000000000003", L1),
        kind: "voice_original" as const,
        mime: "audio/mp4",
      },
      photo("0000b001-0000-4000-8000-000000000004", L2),
    ];
    await oldStore(
      [
        { id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" },
        { id: L2, owner: ACCOUNT_B, createdAt: "2026-10-06T07:00:00.000Z" },
      ],
      items,
    );

    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toEqual({
      status: "migrated",
      drafts: 2,
      media: 4,
      unreadableMedia: 0,
      resumed: false,
    });
    expect(a.report.expired).toBe(0);

    const [draft] = await a.drafts.list();
    expect(draft).toMatchObject({
      client_submission_id: L1,
      owner_account_id: ACCOUNT_A,
      created_at: "2026-10-05T10:00:00.000Z",
      expires_at: "2026-10-07T10:00:00.000Z", // the 2-day lifetime still counts from the original creation
      category: "water",
      typed_description: "synthetic typed text",
      latitude: 31.52,
      submission_requested_at: null,
      submission_key: null,
    });
    const moved = await a.drafts.evidence(L1);
    expect(moved.map((e) => e.file_name).sort()).toEqual([
      "0000b001-0000-4000-8000-000000000001.jpg",
      "0000b001-0000-4000-8000-000000000002.jpg",
      "0000b001-0000-4000-8000-000000000003.m4a",
    ]);
    for (const e of moved) {
      const original = items.find((i) => i.id === e.evidence_id)?.bytes as Uint8Array;
      expect(Buffer.from(await readDraftMedia(e.file_name, e.sha256)).equals(Buffer.from(original))).toBe(
        true,
      );
      expect(e.source_uri).toBeNull();
    }
    expect(
      (await (await openLocalStore(ACCOUNT_B)).drafts.list()).map((d) => d.client_submission_id),
    ).toEqual([L2]);

    expect(oldStoreGone()).toBe(true);
    expect(hasPlaintextHeader(fs.readFileSync(pathOf(draftDatabaseFile().uri)).subarray(0, 16))).toBe(true);
    // The old database was read with its key applied first; the new one never gets a key.
    expect(control.statements.filter((s) => /PRAGMA\s+key/i.test(s))).toHaveLength(2); // one written here, one read
  });

  test("a second open finds nothing to move", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], []);
    await openLocalStore(ACCOUNT_A);
    await closeLocalStore();
    const again = await openLocalStore(ACCOUNT_A);
    expect(again.report.legacy).toEqual({ status: "none" });
    expect(await again.drafts.list()).toHaveLength(1);
  });

  test("drafts already older than 2 days are moved, then deleted by the lifetime rule — and that is reported", async () => {
    const old = "0000a001-0000-4000-8000-000000000003";
    const item = photo("0000b001-0000-4000-8000-000000000009", old);
    await oldStore([{ id: old, owner: ACCOUNT_A, createdAt: "2026-10-03T00:00:00.000Z" }], [item]);

    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toMatchObject({ status: "migrated", drafts: 1, media: 1 });
    expect(a.report.expired).toBe(1); // never silent
    expect(await a.drafts.list()).toEqual([]);
    expect(draftMediaFile("0000b001-0000-4000-8000-000000000009.jpg").exists).toBe(false);
    expect(await a.drafts.pendingServerCancellations()).toEqual([old]);
  });

  test("a submitted draft keeps its submission and its 48 hours from Submit; past them it is deleted and reported", async () => {
    const recent = "0000a001-0000-4000-8000-000000000004";
    const old = "0000a001-0000-4000-8000-000000000006";
    const keyOnly = "0000a001-0000-4000-8000-000000000005";
    await oldStore(
      [
        {
          id: recent,
          owner: ACCOUNT_A,
          createdAt: "2026-10-05T12:00:00.000Z",
          state: "SUBMISSION_FAILED",
          submissionKey: KEY_K,
          firstAttemptAt: "2026-10-06T06:00:00.000Z",
          attempts: 2,
        },
        // Submitted on 1 October: its 48 hours from Submit ended on 3 October (DG-67).
        {
          id: old,
          owner: ACCOUNT_A,
          createdAt: "2026-10-01T00:00:00.000Z",
          state: "SUBMISSION_FAILED",
          submissionKey: "0000eeee-0000-4000-8000-000000000002",
          firstAttemptAt: "2026-10-01T12:00:00.000Z",
          attempts: 5,
        },
        // A key alone was never a Submit: this draft must not be sent, and follows the lifetime.
        {
          id: keyOnly,
          owner: ACCOUNT_A,
          createdAt: "2026-10-06T06:00:00.000Z",
          state: "READY_TO_SUBMIT",
          submissionKey: KEY_K,
        },
      ],
      [],
    );

    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report).toMatchObject({ expired: 0, unconfirmedRemoved: 1 }); // never silent
    expect(await a.drafts.get(recent)).toMatchObject({
      submission_requested_at: "2026-10-06T06:00:00.000Z",
      submission_expires_at: "2026-10-08T06:00:00.000Z",
      first_submission_attempt_at: "2026-10-06T06:00:00.000Z",
      submission_key: KEY_K,
      submission_outcome: "unknown", // the server is asked before anything else
      attempts: 2,
    });
    expect(await a.drafts.get(old)).toBeNull();
    expect(await a.drafts.pendingServerCancellations()).toEqual([old]); // the server keeps any report
    expect(await a.drafts.get(keyOnly)).toMatchObject({
      submission_requested_at: null,
      submission_expires_at: null,
      submission_key: null,
      submission_outcome: null,
      expires_at: "2026-10-08T06:00:00.000Z",
    });
  });

  test("a half-initialised old database without an evidence table still gives up its drafts", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], [], {
      evidenceTable: false,
    });
    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toMatchObject({ status: "migrated", drafts: 1, media: 0 });
    expect(await a.drafts.list()).toHaveLength(1);
  });
});

describe("an old store that cannot be read is left exactly as it is (never wiped, never reset)", () => {
  test.each([
    ["its key is absent", "absent"],
    ["its key does not open it", "other"],
  ] as const)("when %s", async (_case, key) => {
    await oldStore(
      [{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }],
      [photo("0000b001-0000-4000-8000-000000000001", L1)],
      {
        key,
      },
    );
    const before = oldFiles();
    const storedKey = secureStoreContents().get(LEGACY_KEY_NAME);

    for (let open = 0; open < 2; open++) {
      const a = await openLocalStore(ACCOUNT_A);
      expect(a.report.legacy).toEqual({ status: "unreadable" });
      expect(await a.drafts.list()).toEqual([]);
      await closeLocalStore();
    }
    expect(oldFiles()).toEqual(before);
    expect(secureStoreContents().get(LEGACY_KEY_NAME)).toBe(storedKey);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled(); // no replacement key is ever made
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  test("when secure storage cannot be read", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], []);
    const before = oldFiles();
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keystore unavailable"));
    expect((await openLocalStore(ACCOUNT_A)).report.legacy).toEqual({ status: "unreadable" });
    expect(oldFiles()).toEqual(before);
    expect(secureStoreContents().has(LEGACY_KEY_NAME)).toBe(true);
  });

  test("items left without their database are kept, and a key left alone is removed", async () => {
    await oldStore(
      [{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }],
      [photo("0000b001-0000-4000-8000-000000000001", L1)],
    );
    fs.rmSync(pathOf(legacyDatabaseFile().uri));
    fs.rmSync(`${pathOf(legacyDatabaseFile().uri)}.rows`);
    const before = oldFiles();
    expect((await openLocalStore(ACCOUNT_A)).report.legacy).toEqual({ status: "unreadable" });
    expect(oldFiles()).toEqual(before);
    await closeLocalStore();

    resetFileSystem();
    secureStoreContents().clear();
    secureStoreContents().set(LEGACY_KEY_NAME, toHex(randomBytes(32))); // a key that protects nothing
    expect((await openLocalStore(ACCOUNT_A)).report.legacy).toEqual({ status: "none" });
    expect(secureStoreContents().has(LEGACY_KEY_NAME)).toBe(false);
  });

  test("rows the new store cannot hold keep the old store in place", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], [], {
      consentRow: true,
    });
    const before = oldFiles();
    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toEqual({ status: "kept", reason: "unsupported_rows" });
    expect(await a.drafts.list()).toEqual([]);
    expect(oldFiles()).toEqual(before);
  });
});

describe("an interrupted move resumes without loss or duplicates", () => {
  const items = () => [
    photo("0000b001-0000-4000-8000-000000000001", L1),
    photo("0000b001-0000-4000-8000-000000000002", L1),
  ];

  test("before the copy commits: nothing is lost, and the next open completes it once", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], items());
    const before = oldFiles();
    control.failOn = /^INSERT INTO legacy_migration/;

    const first = await openLocalStore(ACCOUNT_A);
    expect(first.report.legacy).toEqual({ status: "kept", reason: "error" });
    expect(await first.drafts.list()).toEqual([]); // rolled back with the marker
    expect(oldFiles()).toEqual(before);
    expect(draftMediaDirectory().list()).toHaveLength(0); // its half-written copies had no rows, so they were swept
    await closeLocalStore();

    const second = await openLocalStore(ACCOUNT_A);
    expect(second.report.legacy).toEqual({
      status: "migrated",
      drafts: 1,
      media: 2,
      unreadableMedia: 0,
      resumed: false,
    });
    expect(await second.drafts.list()).toHaveLength(1);
    expect(await second.drafts.evidence(L1)).toHaveLength(2);
    expect(oldStoreGone()).toBe(true);
  });

  test("a copy cut short mid-write is written again, never kept half-written", async () => {
    const list = items();
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], list);
    draftMediaDirectory().create({ intermediates: true, idempotent: true });
    draftMediaFile(`${list[0]?.id}.jpg`).write(new Uint8Array([1, 2, 3])); // as an interruption would leave it

    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toMatchObject({ status: "migrated", media: 2 });
    const [first] = (await a.drafts.evidence(L1)).filter((e) => e.evidence_id === list[0]?.id);
    expect(
      Buffer.from(await readDraftMedia(first?.file_name as string, first?.sha256 as string)).equals(
        Buffer.from(list[0]?.bytes as Uint8Array),
      ),
    ).toBe(true);
  });

  test("while the old store is being removed: finished on the next open, and a draft deleted meanwhile is not brought back", async () => {
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], items());
    control.failNextDelete = true;

    const first = await openLocalStore(ACCOUNT_A);
    expect(first.report.legacy).toMatchObject({ status: "migrated", drafts: 1, media: 2, resumed: false });
    expect(legacyDatabaseFile().exists).toBe(true); // its removal was interrupted
    await discardDraft(first.drafts, L1); // the citizen deletes the moved draft
    await closeLocalStore();

    const second = await openLocalStore(ACCOUNT_A);
    expect(second.report.legacy).toEqual({
      status: "migrated",
      drafts: 1,
      media: 2,
      unreadableMedia: 0,
      resumed: true,
    });
    expect(await second.drafts.list()).toEqual([]);
    expect(oldStoreGone()).toBe(true);
  });
});

describe("old items that cannot be read", () => {
  test("an item that fails its integrity check or is missing is not moved; the draft arrives without it, and the count is reported", async () => {
    const list = [
      photo("0000b001-0000-4000-8000-000000000001", L1),
      photo("0000b001-0000-4000-8000-000000000002", L1),
      photo("0000b001-0000-4000-8000-000000000003", L1),
    ];
    await oldStore([{ id: L1, owner: ACCOUNT_A, createdAt: "2026-10-05T10:00:00.000Z" }], list);
    const tampered = pathOf(legacyMediaFile(list[0]?.id as string).uri);
    const bytes = fs.readFileSync(tampered);
    bytes[30] = (bytes[30] ?? 0) ^ 1;
    fs.writeFileSync(tampered, bytes);
    fs.rmSync(pathOf(legacyMediaFile(list[1]?.id as string).uri));

    const a = await openLocalStore(ACCOUNT_A);
    expect(a.report.legacy).toEqual({
      status: "migrated",
      drafts: 1,
      media: 1,
      unreadableMedia: 2,
      resumed: false,
    });
    expect((await a.drafts.evidence(L1)).map((e) => e.evidence_id)).toEqual([list[2]?.id]);
  });
});
