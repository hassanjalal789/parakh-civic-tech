/**
 * LDS-2: the draft repository, bound to one account (FR-COMMON.25, SC-10).
 *
 * Every statement filters on owner_account_id, so a draft of another account
 * is indistinguishable from one that does not exist. A draft is not a
 * CivicReport and has no reference until the server creates the report.
 */
import * as Crypto from "expo-crypto";

import { addRefusal, EVIDENCE_RULES, type EvidenceKind, MIME_TYPES } from "../domain/evidenceRules";
import type { SqlDb, SqlValue } from "./sql";

export type PipelineState =
  | "LOCAL_DRAFT"
  | "WAITING_FOR_CONNECTION"
  | "UPLOADING"
  | "TRANSCRIPTION_PROCESSING"
  | "AWAITING_REPORTER_REVIEW"
  | "READY_TO_SUBMIT"
  | "SUBMISSION_FAILED";

export type DraftRow = {
  client_submission_id: string;
  owner_account_id: string;
  pipeline_state: PipelineState;
  category: string | null;
  description_mode: "voice" | "typed";
  typed_description: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  location_source: string | null;
  location_unverified: number;
  rendering_version: number | null;
  rendering_content_hash: string | null;
  submission_key: string | null;
  first_submission_attempt_at: string | null;
  next_attempt_at: string | null;
  attempts: number;
  last_error: string | null;
  report_id: string | null;
  report_reference: string | null;
  created_at: string;
  updated_at: string;
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
};

export type EvidenceRefusal =
  NonNullable<ReturnType<typeof addRefusal>> | "unknown_draft" | "not_editable" | "bad_type" | "bad_hash";

export class EvidenceRefused extends Error {
  constructor(readonly reason: EvidenceRefusal) {
    super(`This item cannot be added (${reason})`);
    this.name = "EvidenceRefused";
  }
}

/** The fields a screen or the queue may change. Identity, ownership and timestamps are not among them. */
const EDITABLE = [
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
  "submission_key",
  "first_submission_attempt_at",
  "next_attempt_at",
  "attempts",
  "last_error",
  "report_id",
  "report_reference",
] as const;

export type DraftPatch = Partial<Pick<DraftRow, (typeof EDITABLE)[number]>>;

const LIMIT: Record<EvidenceKind, { max: number; refusal: EvidenceRefusal }> = {
  photo: { max: EVIDENCE_RULES.photoMax, refusal: "photo_limit" },
  video: { max: EVIDENCE_RULES.videoMax, refusal: "video_limit" },
  voice_original: { max: EVIDENCE_RULES.voiceMax, refusal: "voice_limit" },
};

export function draftRepository(db: SqlDb, ownerAccountId: string, clock: () => Date = () => new Date()) {
  if (!/^[0-9a-f-]{36}$/.test(ownerAccountId)) throw new Error("drafts are bound to an account id");
  const now = () => clock().toISOString();

  async function get(id: string): Promise<DraftRow | null> {
    return db.getFirstAsync<DraftRow>(
      "SELECT * FROM drafts WHERE client_submission_id = ? AND owner_account_id = ?",
      id,
      ownerAccountId,
    );
  }

  async function evidence(id: string): Promise<EvidenceRow[]> {
    return db.getAllAsync<EvidenceRow>(
      `SELECT e.* FROM evidence e JOIN drafts d ON d.client_submission_id = e.client_submission_id
       WHERE e.client_submission_id = ? AND d.owner_account_id = ? ORDER BY e.created_at, e.evidence_id`,
      id,
      ownerAccountId,
    );
  }

  return {
    ownerAccountId,

    /** FR-PUB.3: a client-generated id, LOCAL_DRAFT, used for every later operation. */
    async create(): Promise<DraftRow> {
      const id = Crypto.randomUUID();
      const at = now();
      await db.runAsync(
        `INSERT INTO drafts (client_submission_id, owner_account_id, pipeline_state, created_at, updated_at)
         VALUES (?, ?, 'LOCAL_DRAFT', ?, ?)`,
        id,
        ownerAccountId,
        at,
        at,
      );
      return (await get(id)) as DraftRow;
    },

    get,

    async list(): Promise<DraftRow[]> {
      return db.getAllAsync<DraftRow>(
        "SELECT * FROM drafts WHERE owner_account_id = ? ORDER BY updated_at DESC",
        ownerAccountId,
      );
    },

    async update(id: string, patch: DraftPatch): Promise<DraftRow | null> {
      const keys = Object.keys(patch).filter((k): k is (typeof EDITABLE)[number] =>
        (EDITABLE as readonly string[]).includes(k),
      );
      if (keys.length !== Object.keys(patch).length) throw new Error("not an editable draft field");
      if (keys.length === 0) return get(id);
      const values = keys.map((k) => (patch[k] ?? null) as SqlValue);
      await db.runAsync(
        `UPDATE drafts SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?
         WHERE client_submission_id = ? AND owner_account_id = ?`,
        ...values,
        now(),
        id,
        ownerAccountId,
      );
      return get(id);
    },

    evidence,

    /**
     * Records an item already written encrypted to LDS-4. The count check and
     * the insert are one statement, so two quick captures cannot both take
     * the last place.
     */
    async registerEvidence(id: string, item: NewEvidence): Promise<EvidenceRow> {
      if (!MIME_TYPES[item.kind]?.includes(item.mimeType)) throw new EvidenceRefused("bad_type");
      if (!/^[0-9a-f]{64}$/.test(item.sha256)) throw new EvidenceRefused("bad_hash");
      const draft = await get(id);
      if (!draft) throw new EvidenceRefused("unknown_draft");
      if (draft.pipeline_state !== "LOCAL_DRAFT") throw new EvidenceRefused("not_editable");
      const existing = await evidence(id);
      const counts: Partial<Record<EvidenceKind, number>> = {};
      for (const e of existing) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      const refusal = addRefusal(item.kind, counts, item.durationSeconds);
      if (refusal) throw new EvidenceRefused(refusal);
      const at = now();
      const result = await db.runAsync(
        `INSERT INTO evidence (evidence_id, client_submission_id, kind, mime_type, byte_size, sha256,
                               captured_at, duration_seconds, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM drafts WHERE client_submission_id = ? AND owner_account_id = ?
                       AND pipeline_state = 'LOCAL_DRAFT')
           AND (SELECT count(*) FROM evidence WHERE client_submission_id = ? AND kind = ?) < ?`,
        item.evidenceId,
        id,
        item.kind,
        item.mimeType,
        item.byteSize,
        item.sha256,
        item.capturedAt,
        item.durationSeconds ?? null,
        at,
        id,
        ownerAccountId,
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

    /** Removes one item while the draft is still local (retake). Returns it so the caller deletes its file. */
    async removeEvidence(id: string, evidenceId: string): Promise<EvidenceRow | null> {
      const draft = await get(id);
      if (!draft || draft.pipeline_state !== "LOCAL_DRAFT") return null;
      const row = (await evidence(id)).find((e) => e.evidence_id === evidenceId) ?? null;
      if (row) await db.runAsync("DELETE FROM evidence WHERE evidence_id = ?", evidenceId);
      return row;
    },

    /** Deletes the draft (cancellation, DG-55). Returns its evidence so the caller deletes the files. */
    async remove(id: string): Promise<EvidenceRow[]> {
      const items = await evidence(id);
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

/**
 * Every stored evidence id, of every account. Only the orphan sweep uses it:
 * an encrypted file that no row references (a crash between the write and
 * the insert) is removed, and a file another account owns is never touched.
 */
export async function allEvidenceIds(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ evidence_id: string }>("SELECT evidence_id FROM evidence");
  return new Set(rows.map((r) => r.evidence_id));
}
