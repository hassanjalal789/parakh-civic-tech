/**
 * The calls the device makes about its own submissions
 * (docs/api/CITIZEN_REPORTING_CONTRACT.md §1, §4).
 */
import { request } from "./client";
import { ApiError } from "./errors";

/** The server's view of a draft. "absent" means the server has never seen it. */
export type ServerLifecycle = "active" | "submitted" | "cancelled" | "expired" | "absent";

export type ReportCreated = {
  report_id: string;
  report_reference: string;
  state: "SUBMITTED";
  created_at: string;
};

export type CancelOutcome =
  { kind: "cancelled" } | { kind: "already_submitted"; reportId: string; reportReference: string };

function text(details: Readonly<Record<string, unknown>>, key: string): string {
  const value = details[key];
  if (typeof value !== "string" || !value) throw new Error(`the server's answer lacks ${key}`);
  return value;
}

/** API-133. A draft body never carries a report reference (TEST-API-016). */
export async function fetchDraftStatus(clientSubmissionId: string): Promise<ServerLifecycle> {
  try {
    const body = await request<{ lifecycle: ServerLifecycle }>("draftStatus", {
      params: { client_submission_id: clientSubmissionId },
    });
    return body.lifecycle;
  } catch (error) {
    if (error instanceof ApiError && error.code === "E_NOT_FOUND") return "absent";
    throw error;
  }
}

/** One evidence item as the server holds it (API-133 `evidence[]`). */
export type ServerEvidence = {
  evidence_id: string;
  kind: string;
  status: "RECEIVING" | "COMPLETE";
  byte_size: number;
  duration_seconds: number | null;
  received_chunks: number;
  chunk_count: number;
};

/** The parts of the draft response (API-130, API-132, API-133) the device reads. Never a report reference. */
export type ServerDraft = {
  client_submission_id: string;
  lifecycle: Exclude<ServerLifecycle, "absent">;
  pipeline_state: string;
  evidence: ServerEvidence[];
  manifest_complete: boolean;
};

/** API-131 request: one chunk of one item, with the item's hash at capture. */
export type EvidenceChunk = {
  evidence_id: string;
  kind: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  captured_at: string;
  chunk_index: number;
  chunk_count: number;
  chunk_sha256: string;
  chunk_base64: string;
};

export type ChunkReceipt = {
  evidence_id: string;
  chunk_index: number;
  received_chunks: number;
  chunk_count: number;
  all_chunks_received: boolean;
};

export type EvidenceManifest = {
  manifest: { evidence_id: string; kind: string; sha256: string; byte_size: number }[];
  manifest_sha256: string;
};

/** API-133, the whole draft; null when the server has never seen it. */
export async function fetchDraft(clientSubmissionId: string): Promise<ServerDraft | null> {
  try {
    return await request<ServerDraft>("draftStatus", {
      params: { client_submission_id: clientSubmissionId },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "E_NOT_FOUND") return null;
    throw error;
  }
}

/** API-131. Per-chunk idempotent: the same chunk again is a replay. */
export function sendEvidenceChunk(clientSubmissionId: string, chunk: EvidenceChunk): Promise<ChunkReceipt> {
  return request<ChunkReceipt>("evidenceChunk", {
    params: { client_submission_id: clientSubmissionId },
    body: chunk,
  });
}

/** API-132. Replay-safe; assembles every listed item on the server and starts processing. */
export function completeEvidenceManifest(
  clientSubmissionId: string,
  manifest: EvidenceManifest,
): Promise<ServerDraft> {
  return request<ServerDraft>("evidenceComplete", {
    params: { client_submission_id: clientSubmissionId },
    body: manifest,
  });
}

/** API-140 with the draft's one submission key. A replay returns the original report, never a second one. */
export function submitReport(clientSubmissionId: string, submissionKey: string): Promise<ReportCreated> {
  return request<ReportCreated>("reportSubmit", {
    body: { client_submission_id: clientSubmissionId },
    headers: { "X-Submission-Idempotency-Key": submissionKey },
  });
}

/** `DELETE /citizen/drafts/{id}`. After a successful submission the server keeps the report and says so. */
export async function cancelDraftOnServer(clientSubmissionId: string): Promise<CancelOutcome> {
  try {
    await request<void>("draftCancel", { params: { client_submission_id: clientSubmissionId } });
    return { kind: "cancelled" };
  } catch (error) {
    if (error instanceof ApiError && error.code === "E_ALREADY_SUBMITTED") {
      return {
        kind: "already_submitted",
        reportId: text(error.details, "report_id"),
        reportReference: text(error.details, "report_reference"),
      };
    }
    if (error instanceof ApiError && error.code === "E_NOT_FOUND") return { kind: "cancelled" }; // nothing there
    throw error;
  }
}
