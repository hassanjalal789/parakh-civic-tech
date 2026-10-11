/**
 * The local draft schema (LDS-2) — app-private, with no application
 * encryption (DG-63). Drafts are bound to the account that created them:
 * another account on the same phone never sees them (FR-COMMON.25).
 *
 * Each migration runs in one transaction together with its version record,
 * so an interruption leaves the database exactly as it was before (R-005).
 * Every migration only adds what is missing, so a half-initialised database
 * is completed in place and a repeated step changes nothing. Nothing here
 * ever drops, clears or rewrites a table: a schema this app does not
 * recognise is refused, and the data stays.
 */
import type { SqlDb } from "./sql";

/** A migration is SQL, or a step that first looks at what exists, so a repeat changes nothing. */
type Migration = string | ((db: SqlDb) => Promise<void>);

async function columnsOf(db: SqlDb, table: string): Promise<Set<string>> {
  return new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name));
}

const LOCATION_COLUMNS: readonly (readonly [string, string])[] = [
  ["measured_latitude", "REAL"],
  ["measured_longitude", "REAL"],
  ["measured_accuracy_m", "REAL"],
  ["measured_fix", "TEXT"],
  ["measured_at", "TEXT"],
  ["reported_latitude", "REAL"],
  ["reported_longitude", "REAL"],
  ["location_description", "TEXT"],
];

const MIGRATIONS: readonly Migration[] = [
  `CREATE TABLE IF NOT EXISTS drafts (
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
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     submission_requested_at TEXT,
     submission_key TEXT,
     first_submission_attempt_at TEXT,
     next_attempt_at TEXT,
     attempts INTEGER NOT NULL DEFAULT 0,
     submission_outcome TEXT,
     last_error TEXT,
     cancel_requested_at TEXT,
     report_id TEXT,
     report_reference TEXT
   );
   CREATE INDEX IF NOT EXISTS drafts_by_owner ON drafts (owner_account_id, updated_at);
   CREATE INDEX IF NOT EXISTS drafts_by_expiry ON drafts (expires_at);
   CREATE TABLE IF NOT EXISTS evidence (
     evidence_id TEXT PRIMARY KEY,
     client_submission_id TEXT NOT NULL REFERENCES drafts (client_submission_id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     byte_size INTEGER NOT NULL,
     sha256 TEXT NOT NULL,
     captured_at TEXT NOT NULL,
     duration_seconds REAL,
     file_name TEXT NOT NULL,
     source_uri TEXT,
     uploaded INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS evidence_by_draft ON evidence (client_submission_id);
   CREATE TABLE IF NOT EXISTS server_cancellations (
     client_submission_id TEXT PRIMARY KEY,
     owner_account_id TEXT NOT NULL,
     requested_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS legacy_migration (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     completed_at TEXT NOT NULL,
     drafts INTEGER NOT NULL,
     media INTEGER NOT NULL,
     unreadable_media INTEGER NOT NULL
   );`,
  // 2 (DG-67, Hassan Jalal, 2026-10-07): a pending submission is deleted 48 hours after Submit was
  // first pressed. The deadline is stored like expires_at, and filled in for rows that already exist.
  async (db) => {
    if (!(await columnsOf(db, "drafts")).has("submission_expires_at")) {
      await db.execAsync("ALTER TABLE drafts ADD COLUMN submission_expires_at TEXT;");
    }
    await db.execAsync(
      `UPDATE drafts SET submission_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', submission_requested_at, '+48 hours')
        WHERE submission_requested_at IS NOT NULL AND submission_expires_at IS NULL;
       CREATE INDEX IF NOT EXISTS drafts_by_submission_expiry ON drafts (submission_expires_at);`,
    );
  },
  // 3 (DG-73, Hassan Jalal, 2026-10-11): the location keeps what the phone measured beside the position
  // the reporter confirms, or the reporter's written description when there are no coordinates. The
  // columns of migration 1 (latitude, longitude, accuracy_m, location_unverified) stay, never written:
  // no version of the app wrote them, as CIT-10 did not exist.
  async (db) => {
    const have = await columnsOf(db, "drafts");
    for (const [name, type] of LOCATION_COLUMNS) {
      if (!have.has(name)) await db.execAsync(`ALTER TABLE drafts ADD COLUMN ${name} ${type};`);
    }
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** The columns every table has after the last migration; checked on each open. */
const EXPECTED_COLUMNS: Record<string, readonly string[]> = {
  drafts: [
    "client_submission_id",
    "owner_account_id",
    "pipeline_state",
    "category",
    "description_mode",
    "typed_description",
    "latitude",
    "longitude",
    "accuracy_m",
    "location_source",
    "location_unverified",
    "rendering_version",
    "rendering_content_hash",
    "created_at",
    "expires_at",
    "updated_at",
    "submission_requested_at",
    "submission_expires_at",
    "submission_key",
    "first_submission_attempt_at",
    "next_attempt_at",
    "attempts",
    "submission_outcome",
    "last_error",
    "cancel_requested_at",
    "report_id",
    "report_reference",
    ...LOCATION_COLUMNS.map(([name]) => name),
  ],
  evidence: [
    "evidence_id",
    "client_submission_id",
    "kind",
    "mime_type",
    "byte_size",
    "sha256",
    "captured_at",
    "duration_seconds",
    "file_name",
    "source_uri",
    "uploaded",
    "created_at",
  ],
  server_cancellations: ["client_submission_id", "owner_account_id", "requested_at"],
  legacy_migration: ["id", "completed_at", "drafts", "media", "unreadable_media"],
};

export class SchemaMismatch extends Error {
  constructor(readonly table: string) {
    super(`The local database has an unexpected ${table} table`);
    this.name = "SchemaMismatch";
  }
}

async function inTransaction(db: SqlDb, work: () => Promise<void>): Promise<void> {
  await db.execAsync("BEGIN IMMEDIATE;");
  try {
    await work();
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;").catch(() => undefined);
    throw error;
  }
}

async function recordedVersion(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ version: number | null }>(
    "SELECT max(version) AS version FROM schema_version",
  );
  return row?.version ?? 0;
}

async function assertSchema(db: SqlDb): Promise<void> {
  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    const present = await columnsOf(db, table);
    if (!columns.every((c) => present.has(c))) throw new SchemaMismatch(table);
  }
}

export async function migrate(db: SqlDb): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;"); // has no effect inside a transaction, so first
  await db.execAsync("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);");
  const current = await recordedVersion(db);
  if (current > SCHEMA_VERSION) throw new Error("the local database is newer than this app");
  for (let v = current; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v] as Migration;
    await inTransaction(db, async () => {
      if (typeof step === "string") await db.execAsync(step);
      else await step(db);
      await db.runAsync("DELETE FROM schema_version");
      await db.runAsync("INSERT INTO schema_version (version) VALUES (?)", v + 1);
    });
  }
  await assertSchema(db);
}
