/**
 * The calls the device makes about its own submissions
 * (docs/api/CITIZEN_REPORTING_CONTRACT.md §1, §4).
 */
import type { LocationBody } from "../domain/location";
import { citizenEvidenceSource, request } from "./client";
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

/** One submitted report as API-150 lists it: no staff, no audit detail (API Contract §9.2). */
export type ReportSummary = {
  report_id: string;
  report_reference: string;
  category: string;
  state: string;
  state_version: number;
  created_at: string;
  captured_at: string;
};

/** API-150. The unsent drafts it also returns are the phone's own; the phone lists its local copies. */
export async function fetchMyReports(): Promise<ReportSummary[]> {
  const body = await request<{ reports: ReportSummary[] }>("reportsList");
  return Array.isArray(body.reports) ? body.reports : [];
}

export type ReportEvidence = {
  evidence_id: string;
  kind: "photo" | "video" | "voice_original" | "location_voice";
  mime_type: string;
  captured_at: string;
  duration_seconds: number | null;
};

export type ReportDetail = ReportSummary & {
  description: {
    mode: "voice" | "typed";
    bilingual: boolean;
    transcription: string | null;
    typed_description?: string | null;
    urdu_civic_rendering: string;
    english_rendering: string | null;
  };
  location: {
    source: string;
    unverified: boolean;
    measured: { latitude: number; longitude: number } | null;
    reported: { latitude: number; longitude: number } | null;
    description: string | null;
    spoken_description: boolean;
  };
  evidence: ReportEvidence[];
  timeline: { state: string; occurred_at: string }[];
};

/** API-151. The server applies ownership and privacy filtering before returning this projection. */
export function fetchReportDetail(reportId: string): Promise<ReportDetail> {
  return request<ReportDetail>("reportDetail", { params: { report_id: reportId } });
}

/** Authenticated, no-store media source. Never put its Authorization header in logs or persistence. */
export { citizenEvidenceSource };

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

/** API-130 request (docs/api/CITIZEN_REPORTING_CONTRACT.md). */
export type DraftBody = {
  client_submission_id: string;
  category: string;
  description_mode: "voice" | "typed";
  typed_description?: string;
  captured_at: string;
  location: LocationBody;
};

/** API-130: opens the draft on the server, or edits it; the same id and body again is a replay. */
export function openDraftOnServer(body: DraftBody): Promise<ServerDraft> {
  return request<ServerDraft>("draftOpen", { body });
}

export type TextKey = "transcription" | "ur" | "en";

/** API-134: the active rendering version. Its texts are null until it is COMPLETED. */
export type Rendering = {
  voice_transcription_artifact_id: string;
  client_submission_id: string;
  source_kind: "voice" | "typed";
  rendering_version: number;
  rendering_content_hash: string | null;
  source_language: string | null;
  transcription: string | null;
  urdu_civic_rendering: string | null;
  english_rendering: string | null;
  text_origins: Partial<Record<TextKey, string>>;
  ai_generated_texts: Partial<Record<TextKey, boolean>>;
  processing_status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REVIEW_REQUIRED";
  /** Critical fields; a low-confidence one is asked about, never guessed (FR-PUB.18). */
  fields?: { key: string; value: string; confidence: number; low_confidence: boolean }[];
  failure_code: string | null;
  ai_generated: boolean;
  simulated: boolean;
  /** The version this one replaced, if any. */
  supersedes_rendering_version?: number | null;
};

/** The field of each text in API-134 and in a correction. */
export const TEXT_FIELD: Record<TextKey, "transcription" | "urdu_civic_rendering" | "english_rendering"> = {
  transcription: "transcription",
  ur: "urdu_civic_rendering",
  en: "english_rendering",
};

/** API-134; null when no version exists yet. */
export async function fetchRendering(clientSubmissionId: string): Promise<Rendering | null> {
  try {
    return await request<Rendering>("rendering", { params: { client_submission_id: clientSubmissionId } });
  } catch (error) {
    if (error instanceof ApiError && error.code === "E_NOT_FOUND") return null;
    throw error;
  }
}

/** API-135 request: the nine fields; the reporter reviewed all three texts (DG-62). */
export type Confirmation = {
  voice_transcription_artifact_id: string;
  client_submission_id: string;
  rendering_version: number;
  rendering_content_hash: string;
  reporter_subject_type: "citizen";
  reporter_account_id: string;
  confirmed_at: string;
  reviewed_texts: TextKey[];
};

/** API-135. A replay of the key returns the original confirmation. */
export function confirmRendering(
  clientSubmissionId: string,
  confirmation: Confirmation,
  key: string,
): Promise<unknown> {
  return request<unknown>("renderingConfirm", {
    params: { client_submission_id: clientSubmissionId },
    body: confirmation,
    headers: { "X-Confirmation-Idempotency-Key": key },
  });
}

/** A correction by the reporter: the corrected texts become the reporter's own; a new version follows. */
export type Correction = {
  voice_transcription_artifact_id: string;
  rendering_version: number;
  rendering_content_hash: string;
  transcription?: string;
  urdu_civic_rendering?: string;
  english_rendering?: string;
  corrected_fields: string[];
};

/** `POST …/rendering/corrections` (path-named, DG-43). Returns the new active version. */
export function correctRendering(clientSubmissionId: string, correction: Correction): Promise<Rendering> {
  return request<Rendering>("renderingCorrect", {
    params: { client_submission_id: clientSubmissionId },
    body: correction,
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
