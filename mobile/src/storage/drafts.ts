/**
 * LDS-2: the draft repository, bound to one account (FR-COMMON.25, SC-10).
 *
 * Every statement filters on owner_account_id, so a draft of another account
 * is indistinguishable from one that does not exist. A draft is not a
 * CivicReport and has no reference until the server creates the report.
 *
 * Lifetime (DG-64): `expires_at = created_at + 48 hours`, set once when the
 * draft is created and never changed by editing or reopening.
 *
 * A pending submission — Submit pressed (DG-65), receipt not yet confirmed —
 * follows the retry window instead: `submission_expires_at =
 * submission_requested_at + 48 hours`, set once at the first press. When it
 * passes, the pending submission is deleted (DG-67, Hassan Jalal, 2026-10-07).
 */
import * as Crypto from "expo-crypto";

import { addRefusal, EVIDENCE_RULES, type EvidenceKind, MIME_TYPES } from "../domain/evidenceRules";
import {
  type LocationSource,
  locationProblem,
  locationSource,
  type ReportLocation,
} from "../domain/location";
import { submissionDeadline } from "../domain/submissionRules";
import type { SqlDb, SqlValue } from "./sql";

/** 2 days, exactly (DG-64). */
export const DRAFT_LIFETIME_MS = 48 * 60 * 60 * 1000;

export function expiresAtFor(createdAt: Date): string {
  return new Date(createdAt.getTime() + DRAFT_LIFETIME_MS).toISOString();
}

export type PipelineState =
  | "LOCAL_DRAFT"
  | "WAITING_FOR_CONNECTION"
  | "UPLOADING"
  | "TRANSCRIPTION_PROCESSING"
  | "AWAITING_REPORTER_REVIEW"
  | "READY_TO_SUBMIT"
  | "SUBMISSION_FAILED";

/** What the device knows about a submission whose Submit was pressed. */
export type SubmissionOutcome =
  | "unknown" // a request may have reached the server: check before anything else (DG-65)
  | "failed" // the server definitely did not create a report; retry later
  | "rejected" // the server refused for a reason only the reporter can fix
  | "needs_upload"; // the server's temporary copy was cleared; upload again

export type DraftRow = {
  client_submission_id: string;
  owner_account_id: string;
  pipeline_state: PipelineState;
  category: string | null;
  description_mode: "voice" | "typed";
  typed_description: string | null;
  /** Superseded by the measured_ and reported_ columns (DG-73); never written by this app. */
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  location_unverified: number;
  /** The location (DG-73): written together by setLocation, never one field at a time. */
  location_source: LocationSource | null;
  measured_latitude: number | null;
  measured_longitude: number | null;
  measured_accuracy_m: number | null;
  measured_fix: "current" | "last_known" | null;
  measured_at: string | null;
  reported_latitude: number | null;
  reported_longitude: number | null;
  location_description: string | null;
  rendering_version: number | null;
  rendering_content_hash: string | null;
  created_at: string;
  expires_at: string;
  updated_at: string;
  submission_requested_at: string | null;
  submission_expires_at: string | null;
  submission_key: string | null;
  first_submission_attempt_at: string | null;
  next_attempt_at: string | null;
  attempts: number;
  submission_outcome: SubmissionOutcome | null;
  last_error: string | null;
  cancel_requested_at: string | null;
  report_id: string | null;
  report_reference: string | null;
};

export type EvidenceRow = {
  evidence_id: string;
  client_submission_id: string;
  kind: EvidenceKind;
  mime_type: string;
  byte_size: number;
  sha256: string;
  captured_at: string;
  duration_seconds: number | null;
  file_name: string;
  source_uri: string | null;
  uploaded: number;
  created_at: string;
};

export type NewEvidence = {
  evidenceId: string;
  kind: EvidenceKind;
  mimeType: string;
  byteSize: number;
  sha256: string;
  capturedAt: string;
  durationSeconds?: number | null;
  fileName: string;
  sourceUri: string;
};

export type EvidenceRefusal =
  | NonNullable<ReturnType<typeof addRefusal>>
  | "unknown_draft"
  | "not_editable"
  | "bad_type"
  | "bad_hash"
  | "too_large"
  | "unreadable_video"
  | "video_without_sound"
  | "unreadable_recording";

export class EvidenceRefused extends Error {
  constructor(readonly reason: EvidenceRefusal) {
    super(`This item cannot be added (${reason})`);
    this.name = "EvidenceRefused";
  }
}

/**
 * The fields a screen or the queue may change. Identity, ownership, the
 * timestamps — the lifetime above all — and the once-only Submit record are not.
 */
const EDITABLE = [
  "pipeline_state",
  "category",
  "description_mode",
  "typed_description",
  "rendering_version",
  "rendering_content_hash",
  "first_submission_attempt_at",
  "next_attempt_at",
  "attempts",
  "submission_outcome",
  "last_error",
  "cancel_requested_at",
  "report_id",
  "report_reference",
] as const;

export type DraftPatch = Partial<Pick<DraftRow, (typeof EDITABLE)[number]>>;

/**
 * When a row's time on the phone ends: a draft's `expires_at`, or a pending submission's
 * `submission_expires_at` (computed from the press if a row lacks it, so no row can linger).
 */
function deadline(table = ""): string {
  const t = table ? `${table}.` : "";
  return `(CASE WHEN ${t}submission_requested_at IS NULL THEN ${t}expires_at
    ELSE COALESCE(${t}submission_expires_at, strftime('%Y-%m-%dT%H:%M:%fZ', ${t}submission_requested_at, '+48 hours'))
    END)`;
}

const LIMIT: Record<EvidenceKind, { max: number; refusal: EvidenceRefusal }> = {
  photo: { max: EVIDENCE_RULES.photoMax, refusal: "photo_limit" },
  video: { max: EVIDENCE_RULES.videoMax, refusal: "video_limit" },
  voice_original: { max: EVIDENCE_RULES.voiceMax, refusal: "voice_limit" },
  location_voice: { max: EVIDENCE_RULES.locationVoiceMax, refusal: "voice_limit" },
};

/** A draft's location as setLocation wrote it, or null when none is set yet. */
export function locationOf(row: DraftRow): ReportLocation | null {
  if (row.location_source === "written_description" && row.location_description !== null) {
    return { kind: "description", description: row.location_description };
  }
  if (row.location_source === "spoken_description") return { kind: "spoken" };
  if (
    row.measured_latitude === null ||
    row.measured_longitude === null ||
    row.reported_latitude === null ||
    row.reported_longitude === null ||
    (row.measured_fix !== "current" && row.measured_fix !== "last_known") ||
    row.measured_at === null
  ) {
    return null;
  }
  return {
    kind: "coordinates",
    measured: {
      latitude: row.measured_latitude,
      longitude: row.measured_longitude,
      accuracyM: row.measured_accuracy_m,
      fix: row.measured_fix,
      measuredAt: row.measured_at,
    },
    reported: { latitude: row.reported_latitude, longitude: row.reported_longitude },
  };
}

export function draftRepository(db: SqlDb, ownerAccountId: string, clock: () => Date = () => new Date()) {
  if (!/^[0-9a-f-]{36}$/.test(ownerAccountId)) throw new Error("drafts are bound to an account id");
  const now = () => clock().toISOString();

  // A draft, or a pending submission, whose time has ended is gone at once, before the purge runs.
  const LIVE = `${deadline()} > ?`;

  async function get(id: string): Promise<DraftRow | null> {
    return db.getFirstAsync<DraftRow>(
      `SELECT * FROM drafts WHERE client_submission_id = ? AND owner_account_id = ? AND ${LIVE}`,
      id,
      ownerAccountId,
      now(),
    );
  }

  async function evidence(id: string): Promise<EvidenceRow[]> {
    return db.getAllAsync<EvidenceRow>(
      `SELECT e.* FROM evidence e JOIN drafts d ON d.client_submission_id = e.client_submission_id
       WHERE e.client_submission_id = ? AND d.owner_account_id = ?
         AND ${deadline("d")} > ?
       ORDER BY e.created_at, e.evidence_id`,
      id,
      ownerAccountId,
      now(),
    );
  }

  return {
    ownerAccountId,

    /** FR-PUB.3: a client-generated id, LOCAL_DRAFT, and a lifetime fixed now (DG-64). */
    async create(): Promise<DraftRow> {
      const id = Crypto.randomUUID();
      const created = clock();
      const at = created.toISOString();
      await db.runAsync(
        `INSERT INTO drafts (client_submission_id, owner_account_id, pipeline_state, created_at, expires_at, updated_at)
         VALUES (?, ?, 'LOCAL_DRAFT', ?, ?, ?)`,
        id,
        ownerAccountId,
        at,
        expiresAtFor(created),
        at,
      );
      return (await get(id)) as DraftRow;
    },

    get,

    async list(): Promise<DraftRow[]> {
      return db.getAllAsync<DraftRow>(
        `SELECT * FROM drafts WHERE owner_account_id = ? AND ${LIVE} ORDER BY updated_at DESC`,
        ownerAccountId,
        now(),
      );
    },

    async update(id: string, patch: DraftPatch): Promise<DraftRow | null> {
      const keys = Object.keys(patch).filter((k): k is (typeof EDITABLE)[number] =>
        (EDITABLE as readonly string[]).includes(k),
      );
      if (keys.length !== Object.keys(patch).length) throw new Error("not an editable draft field");
      if (keys.length === 0) return get(id);
      const values = keys.map((k) => (patch[k] ?? null) as SqlValue);
      const at = now();
      await db.runAsync(
        `UPDATE drafts SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?
         WHERE client_submission_id = ? AND owner_account_id = ? AND ${LIVE}`,
        ...values,
        at,
        id,
        ownerAccountId,
        at,
      );
      return get(id);
    },

    /**
     * The report's location, all of it in one step (DG-73): the measurement and the reported position,
     * or the written description — never a mix, and never a part of one. Only while the draft is editable.
     */
    async setLocation(id: string, location: ReportLocation): Promise<DraftRow | null> {
      const problem = locationProblem(location);
      if (problem) throw new Error(`not a usable location (${problem})`);
      const c = location.kind === "coordinates" ? location : null;
      const at = now();
      await db.runAsync(
        `UPDATE drafts SET location_source = ?, measured_latitude = ?, measured_longitude = ?,
           measured_accuracy_m = ?, measured_fix = ?, measured_at = ?, reported_latitude = ?,
           reported_longitude = ?, location_description = ?, updated_at = ?
         WHERE client_submission_id = ? AND owner_account_id = ? AND pipeline_state = 'LOCAL_DRAFT' AND ${LIVE}`,
        locationSource(location),
        c?.measured.latitude ?? null,
        c?.measured.longitude ?? null,
        c?.measured.accuracyM ?? null,
        c?.measured.fix ?? null,
        c?.measured.measuredAt ?? null,
        c?.reported.latitude ?? null,
        c?.reported.longitude ?? null,
        location.kind === "description" ? location.description : null, // exactly as written
        at,
        id,
        ownerAccountId,
        at,
      );
      return get(id);
    },

    /** No location yet: what CIT-10 clears when the written description is emptied. Only while editable. */
    async clearLocation(id: string): Promise<DraftRow | null> {
      const at = now();
      await db.runAsync(
        `UPDATE drafts SET location_source = NULL, measured_latitude = NULL, measured_longitude = NULL,
           measured_accuracy_m = NULL, measured_fix = NULL, measured_at = NULL, reported_latitude = NULL,
           reported_longitude = NULL, location_description = NULL, updated_at = ?
         WHERE client_submission_id = ? AND owner_account_id = ? AND pipeline_state = 'LOCAL_DRAFT' AND ${LIVE}`,
        at,
        id,
        ownerAccountId,
        at,
      );
      return get(id);
    },

    /**
     * The reporter pressed Submit (DG-65). Recorded once, with the one idempotency key every
     * attempt reuses and the 48-hour deadline (DG-67), always before the first request leaves.
     */
    async recordSubmit(id: string, submissionKey: string): Promise<DraftRow | null> {
      if (!/^[0-9a-f-]{36}$/.test(submissionKey)) throw new Error("a submission key is a UUID");
      const pressed = clock();
      const at = pressed.toISOString();
      const ends = submissionDeadline(pressed);
      // Only a reviewed draft, and only within its lifetime: Submit can never revive an expired draft.
      await db.runAsync(
        `UPDATE drafts SET submission_requested_at = COALESCE(submission_requested_at, ?),
                           submission_expires_at = COALESCE(submission_expires_at, ?),
                           submission_key = COALESCE(submission_key, ?), updated_at = ?
         WHERE client_submission_id = ? AND owner_account_id = ? AND cancel_requested_at IS NULL
           AND pipeline_state IN ('READY_TO_SUBMIT', 'SUBMISSION_FAILED') AND ${LIVE}`,
        at,
        ends,
        submissionKey,
        at,
        id,
        ownerAccountId,
        at,
      );
      return get(id);
    },

    /** This account's pending submissions whose 48 hours have ended but which are not yet deleted. */
    async endedSubmissions(): Promise<DraftRow[]> {
      return db.getAllAsync<DraftRow>(
        `SELECT * FROM drafts WHERE owner_account_id = ? AND submission_requested_at IS NOT NULL
           AND ${deadline()} <= ? ORDER BY submission_requested_at`,
        ownerAccountId,
        now(),
      );
    },

    evidence,

    /**
     * Records a capture before its file is moved, so a crash in between can be finished on the
     * next start. The count check and the insert are one statement, so two quick captures
     * cannot both take the last place.
     */
    async registerEvidence(id: string, item: NewEvidence): Promise<EvidenceRow> {
      if (!MIME_TYPES[item.kind]?.includes(item.mimeType)) throw new EvidenceRefused("bad_type");
      if (!/^[0-9a-f]{64}$/.test(item.sha256)) throw new EvidenceRefused("bad_hash");
      const draft = await get(id);
      if (!draft) throw new EvidenceRefused("unknown_draft");
      if (draft.pipeline_state !== "LOCAL_DRAFT") throw new EvidenceRefused("not_editable");
      const counts: Partial<Record<EvidenceKind, number>> = {};
      for (const e of await evidence(id)) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      const refusal = addRefusal(item.kind, counts, item.durationSeconds);
      if (refusal) throw new EvidenceRefused(refusal);
      const at = now();
      const result = await db.runAsync(
        `INSERT INTO evidence (evidence_id, client_submission_id, kind, mime_type, byte_size, sha256,
                               captured_at, duration_seconds, file_name, source_uri, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM drafts WHERE client_submission_id = ? AND owner_account_id = ?
                       AND pipeline_state = 'LOCAL_DRAFT' AND expires_at > ?)
           AND (SELECT count(*) FROM evidence WHERE client_submission_id = ? AND kind = ?) < ?`,
        item.evidenceId,
        id,
        item.kind,
        item.mimeType,
        item.byteSize,
        item.sha256,
        item.capturedAt,
        item.durationSeconds ?? null,
        item.fileName,
        item.sourceUri,
        at,
        id,
        ownerAccountId,
        at,
        id,
        item.kind,
        LIMIT[item.kind].max,
      );
      if (result.changes !== 1) {
        const latest = await get(id);
        throw new EvidenceRefused(
          latest?.pipeline_state === "LOCAL_DRAFT" ? LIMIT[item.kind].refusal : "not_editable",
        );
      }
      await db.runAsync(
        "UPDATE drafts SET updated_at = ? WHERE client_submission_id = ? AND owner_account_id = ?",
        at,
        id,
        ownerAccountId,
      );
      return (await evidence(id)).find((e) => e.evidence_id === item.evidenceId) as EvidenceRow;
    },

    /** Forgets a capture whose file could not be moved; the file stays where the camera wrote it. */
    async forgetUnadopted(evidenceId: string): Promise<void> {
      await db.runAsync(
        `DELETE FROM evidence WHERE evidence_id = ? AND source_uri IS NOT NULL AND client_submission_id IN
           (SELECT client_submission_id FROM drafts WHERE owner_account_id = ?)`,
        evidenceId,
        ownerAccountId,
      );
    },

    /** The capture file is now in the drafts folder. */
    async markAdopted(evidenceId: string): Promise<void> {
      await db.runAsync(
        `UPDATE evidence SET source_uri = NULL WHERE evidence_id = ? AND client_submission_id IN
           (SELECT client_submission_id FROM drafts WHERE owner_account_id = ?)`,
        evidenceId,
        ownerAccountId,
      );
    },

    /** Ask the server, later, to cancel this account's draft (a content-free note). */
    async queueServerCancellation(id: string): Promise<void> {
      await queueServerCancellation(db, id, ownerAccountId, clock());
    },

    async pendingServerCancellations(): Promise<string[]> {
      return serverCancellationsFor(db, ownerAccountId);
    },

    async clearServerCancellation(id: string): Promise<void> {
      await db.runAsync(
        "DELETE FROM server_cancellations WHERE client_submission_id = ? AND owner_account_id = ?",
        id,
        ownerAccountId,
      );
    },

    /** Removes one item while the draft is still local (retake). Returns it so the caller deletes its file. */
    async removeEvidence(id: string, evidenceId: string): Promise<EvidenceRow | null> {
      const draft = await get(id);
      if (!draft || draft.pipeline_state !== "LOCAL_DRAFT") return null;
      const row = (await evidence(id)).find((e) => e.evidence_id === evidenceId) ?? null;
      if (row) await db.runAsync("DELETE FROM evidence WHERE evidence_id = ?", evidenceId);
      return row;
    },

    /** Deletes the draft's rows, live or past its time. Returns its evidence so the caller deletes the files. */
    async remove(id: string): Promise<EvidenceRow[]> {
      const items = await db.getAllAsync<EvidenceRow>(
        `SELECT e.* FROM evidence e JOIN drafts d ON d.client_submission_id = e.client_submission_id
         WHERE e.client_submission_id = ? AND d.owner_account_id = ?`,
        id,
        ownerAccountId,
      );
      await db.runAsync(
        "DELETE FROM drafts WHERE client_submission_id = ? AND owner_account_id = ?",
        id,
        ownerAccountId,
      );
      return items;
    },
  };
}

export type DraftRepository = ReturnType<typeof draftRepository>;

// --- Across accounts: only the clean-up uses these, and they read no content ---------------

/** Marks a capture whose file has been moved into the drafts folder. */
export async function markAdopted(db: SqlDb, evidenceId: string): Promise<void> {
  await db.runAsync("UPDATE evidence SET source_uri = NULL WHERE evidence_id = ?", evidenceId);
}

/** Captures recorded but not yet moved: a crash between the row and the move. */
export async function unadoptedEvidence(db: SqlDb): Promise<EvidenceRow[]> {
  return db.getAllAsync<EvidenceRow>("SELECT * FROM evidence WHERE source_uri IS NOT NULL");
}

export async function deleteEvidenceRow(db: SqlDb, evidenceId: string): Promise<void> {
  await db.runAsync("DELETE FROM evidence WHERE evidence_id = ?", evidenceId);
}

/** Every file name a row refers to, of every account: a file nobody refers to is an orphan. */
export async function referencedFileNames(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ file_name: string }>("SELECT file_name FROM evidence");
  return new Set(rows.map((r) => r.file_name));
}

export type ExpiredDraft = {
  clientSubmissionId: string;
  ownerAccountId: string;
  /** "draft": Submit never pressed (DG-64). "pending_submission": not confirmed within 48 hours of Submit (DG-67). */
  kind: "draft" | "pending_submission";
  fileNames: string[];
};

const ENDED = `${deadline()} <= ?`;

/**
 * Deletes, for every account on this phone, each draft whose lifetime has ended (DG-64) and each
 * pending submission not confirmed within 48 hours of Submit (DG-67). Returns what was deleted so
 * the caller removes the files and asks the server to cancel each one's temporary uploads; the
 * server keeps any report that does exist (E_ALREADY_SUBMITTED).
 */
export async function deleteExpiredDrafts(db: SqlDb, now: Date): Promise<ExpiredDraft[]> {
  const at = now.toISOString();
  const due = await db.getAllAsync<{
    client_submission_id: string;
    owner_account_id: string;
    submission_requested_at: string | null;
  }>(`SELECT client_submission_id, owner_account_id, submission_requested_at FROM drafts WHERE ${ENDED}`, at);
  const deleted: ExpiredDraft[] = [];
  for (const d of due) {
    const files = await db.getAllAsync<{ file_name: string }>(
      "SELECT file_name FROM evidence WHERE client_submission_id = ?",
      d.client_submission_id,
    );
    await db.runAsync(
      `DELETE FROM drafts WHERE client_submission_id = ? AND ${ENDED}`,
      d.client_submission_id,
      at,
    );
    deleted.push({
      clientSubmissionId: d.client_submission_id,
      ownerAccountId: d.owner_account_id,
      kind: d.submission_requested_at === null ? "draft" : "pending_submission",
      fileNames: files.map((f) => f.file_name),
    });
  }
  return deleted;
}

/** A content-free note to ask the server, later, to cancel a draft's temporary uploads. */
export async function queueServerCancellation(
  db: SqlDb,
  clientSubmissionId: string,
  ownerAccountId: string,
  now: Date,
): Promise<void> {
  await db.runAsync(
    "INSERT OR IGNORE INTO server_cancellations (client_submission_id, owner_account_id, requested_at) VALUES (?, ?, ?)",
    clientSubmissionId,
    ownerAccountId,
    now.toISOString(),
  );
}

export async function serverCancellationsFor(db: SqlDb, ownerAccountId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ client_submission_id: string }>(
    "SELECT client_submission_id FROM server_cancellations WHERE owner_account_id = ? ORDER BY requested_at",
    ownerAccountId,
  );
  return rows.map((r) => r.client_submission_id);
}

export async function clearServerCancellation(db: SqlDb, clientSubmissionId: string): Promise<void> {
  await db.runAsync("DELETE FROM server_cancellations WHERE client_submission_id = ?", clientSubmissionId);
}
