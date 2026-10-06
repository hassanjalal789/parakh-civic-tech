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
