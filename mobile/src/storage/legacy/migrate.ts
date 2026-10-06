/**
 * T-128: the drafts of the 5 October 2026 development build are moved once
 * into the unencrypted store (DG-63; Mobile SRS v2.3.0 §3.6.3, "Transition").
 *
 * - No old store: nothing to do.
 * - An old store whose key cannot be read, or that its key does not open, is
 *   left exactly as it is: never wiped, never reset, and reported.
 * - Otherwise each readable item is decrypted into the drafts folder and read
 *   back against the hash taken at capture; then every draft and item row is
 *   written in one transaction, together with a marker. Each draft keeps its
 *   original `created_at`, so its 2-day lifetime still counts from it (DG-64).
 * - Only after that are the old database, its media and its key removed.
 *
 * Every step can be repeated: an interrupted run resumes on the next open
 * without loss or duplicates, and once the marker exists nothing is copied
 * again, so a draft the citizen later deleted is never brought back.
 */
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import { expiresAtFor } from "../drafts";
import { draftMediaDirectory, draftMediaFile, mediaFileName, sha256Hex } from "../media";
import type { SqlDb, SqlValue } from "../sql";
import {
  decryptLegacyMedia,
  legacyDatabaseFile,
  legacyMediaDirectory,
  legacyMediaKey,
  openLegacyDatabase,
  readLegacyKey,
  removeLegacyStore,
} from "./legacyStore";

export type LegacyMigrationResult =
  | { status: "none" }
  /** The old store exists but cannot be read; it is left untouched. */
  | { status: "unreadable" }
  /** Copied as far as possible, but the old store is kept, so nothing is lost; retried on the next open. */
  | { status: "kept"; reason: "unsupported_rows" | "verification_failed" | "error" }
  /**
   * Moved, and the old store removed. `unreadableMedia` counts old items that were already missing or
   * failed their integrity check, so could not be moved; `resumed` means an earlier run had copied
   * everything and this one finished removing the old store.
   */
  | { status: "migrated"; drafts: number; media: number; unreadableMedia: number; resumed: boolean };

type LegacyDraft = {
  client_submission_id: string;
  owner_account_id: string;
  pipeline_state: string;
  category: string | null;
  description_mode: string | null;
  typed_description: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  location_source: string | null;
  location_unverified: number | null;
  rendering_version: number | null;
  rendering_content_hash: string | null;
  submission_key: string | null;
  first_submission_attempt_at: string | null;
  next_attempt_at: string | null;
  attempts: number | null;
  last_error: string | null;
  report_id: string | null;
  report_reference: string | null;
  created_at: string;
  updated_at: string;
};

type LegacyEvidence = {
  evidence_id: string;
  client_submission_id: string;
  kind: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  captured_at: string;
  duration_seconds: number | null;
  uploaded: number | null;
  created_at: string;
};

async function tables(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  return new Set(rows.map((r) => r.name));
}

type Marker = { drafts: number; media: number; unreadable_media: number };

async function marker(db: SqlDb): Promise<Marker | null> {
  return db.getFirstAsync<Marker>(
    "SELECT drafts, media, unreadable_media FROM legacy_migration WHERE id = 1",
  );
}

function resumedFrom(done: Marker): LegacyMigrationResult {
  return {
    status: "migrated",
    drafts: done.drafts,
    media: done.media,
    unreadableMedia: done.unreadable_media,
    resumed: true,
  };
}

function hasLegacyMedia(): boolean {
  const dir = legacyMediaDirectory();
  return dir.exists && dir.list().some((entry) => entry instanceof File && entry.name.endsWith(".pkm"));
}

/** A valid instant, or the migration time: an unreadable date never shortens a lifetime. */
function instant(text: string | null, fallback: Date): Date {
  const parsed = text ? new Date(text) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
}

/**
 * The new row of an old draft. Submit counts as pressed only if an attempt was made or a
 * report exists: a key alone was never a Submit (DG-65), so it never triggers a submission.
 */
function draftValues(d: LegacyDraft, now: Date): SqlValue[] {
  const created = instant(d.created_at, now);
  const submitted = d.first_submission_attempt_at !== null || d.report_id !== null;
  return [
    d.client_submission_id,
    d.owner_account_id,
    d.pipeline_state,
    d.category,
    d.description_mode ?? "voice",
    d.typed_description,
    d.latitude,
    d.longitude,
    d.accuracy_m,
    d.location_source,
    d.location_unverified ?? 0,
    d.rendering_version,
    d.rendering_content_hash,
    created.toISOString(),
    expiresAtFor(created),
    d.updated_at ?? created.toISOString(),
    submitted ? (d.first_submission_attempt_at ?? d.updated_at ?? created.toISOString()) : null,
    submitted ? (d.submission_key ?? Crypto.randomUUID()) : null,
    submitted ? d.first_submission_attempt_at : null,
    submitted ? d.next_attempt_at : null,
    submitted ? (d.attempts ?? 0) : 0,
    submitted ? "unknown" : null, // what happened on the server is checked before anything else
    submitted ? d.last_error : null,
    d.report_id,
    d.report_reference,
  ];
}

const DRAFT_COLUMNS = `client_submission_id, owner_account_id, pipeline_state, category, description_mode,
  typed_description, latitude, longitude, accuracy_m, location_source, location_unverified, rendering_version,
  rendering_content_hash, created_at, expires_at, updated_at, submission_requested_at, submission_key,
  first_submission_attempt_at, next_attempt_at, attempts, submission_outcome, last_error, report_id,
  report_reference`;

/** Writes one old item into the drafts folder, decrypted, and proves it reads back as captured. */
async function moveItem(key: Crypto.AESEncryptionKey, e: LegacyEvidence): Promise<string | null> {
  let fileName: string;
  try {
    fileName = mediaFileName(e.evidence_id, e.mime_type);
  } catch {
    return null; // not a capture type this app accepts
  }
  const target = draftMediaFile(fileName);
  if (target.exists) {
    if ((await sha256Hex(await target.bytes())) === e.sha256) return fileName; // done by an earlier run
    target.delete(); // a write that an interruption cut short
  }
  const bytes = await decryptLegacyMedia(key, e.evidence_id, e.sha256);
  if (!bytes) return null; // missing, or it fails its integrity check
  const dir = draftMediaDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  target.create();
  target.write(bytes);
  if ((await sha256Hex(await target.bytes())) !== e.sha256) {
    target.delete();
    throw new VerificationFailed();
  }
  return fileName;
}

class VerificationFailed extends Error {}

export async function migrateLegacyStore(db: SqlDb, now: Date = new Date()): Promise<LegacyMigrationResult> {
  const done = await marker(db);
  if (!legacyDatabaseFile().exists) {
    const media = hasLegacyMedia();
    const key = (await readLegacyKey()) !== null;
    if (!media && !key) return { status: "none" };
    if (done) {
      await removeLegacyStore(); // an earlier run copied everything, then stopped while removing
      return resumedFrom(done);
    }
    if (media) return { status: "unreadable" }; // items without their rows: left as they are
    await removeLegacyStore(); // a key with no database and no media protects nothing
    return { status: "none" };
  }
  if (done) {
    await removeLegacyStore();
    return resumedFrom(done);
  }
  const key = await readLegacyKey();
  if (!key) return { status: "unreadable" };
  let legacy: SqlDb;
  try {
    legacy = await openLegacyDatabase(key);
  } catch {
    key.fill(0);
    return { status: "unreadable" };
  }
  let mediaKey: Crypto.AESEncryptionKey | null = null;
  try {
    mediaKey = await legacyMediaKey(key);
    const present = await tables(legacy);
    if (present.has("pending_consent")) {
      const held = await legacy.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM pending_consent");
      if ((held?.n ?? 0) > 0) return { status: "kept", reason: "unsupported_rows" }; // never written by that build
    }
    const drafts = present.has("drafts") ? await legacy.getAllAsync<LegacyDraft>("SELECT * FROM drafts") : [];
    const items = present.has("evidence")
      ? await legacy.getAllAsync<LegacyEvidence>("SELECT * FROM evidence ORDER BY created_at, evidence_id")
      : [];
    const draftIds = new Set(drafts.map((d) => d.client_submission_id));

    const moved: { item: LegacyEvidence; fileName: string }[] = [];
    let unreadableMedia = 0;
    for (const item of items.filter((e) => draftIds.has(e.client_submission_id))) {
      const fileName = await moveItem(mediaKey, item);
      if (fileName) moved.push({ item, fileName });
      else unreadableMedia++;
    }

    await db.execAsync("BEGIN IMMEDIATE;");
    try {
      for (const d of drafts) {
        await db.runAsync(
          `INSERT OR IGNORE INTO drafts (${DRAFT_COLUMNS}) VALUES (${Array(25).fill("?").join(", ")})`,
          ...draftValues(d, now),
        );
      }
      for (const { item, fileName } of moved) {
        await db.runAsync(
          `INSERT OR IGNORE INTO evidence (evidence_id, client_submission_id, kind, mime_type, byte_size, sha256,
             captured_at, duration_seconds, file_name, source_uri, uploaded, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          item.evidence_id,
          item.client_submission_id,
          item.kind,
          item.mime_type,
          item.byte_size,
          item.sha256,
          item.captured_at,
          item.duration_seconds,
          fileName,
          item.uploaded ?? 0,
          item.created_at,
        );
      }
      await db.runAsync(
        "INSERT INTO legacy_migration (id, completed_at, drafts, media, unreadable_media) VALUES (1, ?, ?, ?, ?)",
        now.toISOString(),
        drafts.length,
        moved.length,
        unreadableMedia,
      );
      await db.execAsync("COMMIT;");
    } catch (error) {
      await db.execAsync("ROLLBACK;").catch(() => undefined);
      throw error;
    }
    await legacy.closeAsync();
    // The copy is complete and recorded; if removing the old store is interrupted, the next open finishes it.
    await removeLegacyStore().catch(() => undefined);
    return {
      status: "migrated",
      drafts: drafts.length,
      media: moved.length,
      unreadableMedia,
      resumed: false,
    };
  } catch (error) {
    return { status: "kept", reason: error instanceof VerificationFailed ? "verification_failed" : "error" };
  } finally {
    key.fill(0);
    (mediaKey as { release?: () => void } | null)?.release?.(); // frees the native key object
    await legacy.closeAsync().catch(() => undefined);
  }
}
