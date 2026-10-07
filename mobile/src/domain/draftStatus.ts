/**
 * What a local item is, for the screens that list it (Hassan Jalal, 2026-10-07):
 * a saved draft and a pending submission are always told apart, and a
 * pending submission always says that its submission is not yet confirmed.
 */
import type { DraftRow } from "../storage/drafts";

export type LocalStatus =
  /** Submit never pressed. Deleted at `deletesAt`, 48 hours after it was created (DG-64). */
  | { kind: "draft"; deletesAt: string }
  /**
   * Submit pressed; the server has not confirmed the report. Retried until `deletesAt`, 48 hours
   * after the first press, then deleted (DG-67). `needsReporter`: the server refused it for a
   * reason only the reporter can fix; `cancelling`: a cancellation awaits the server's answer.
   */
  | {
      kind: "pending_submission";
      confirmed: false;
      deletesAt: string;
      needsReporter: boolean;
      cancelling: boolean;
    }
  /** The server confirmed the report; the local copy is about to be deleted. */
  | { kind: "received"; reportReference: string };

export function localStatus(draft: DraftRow): LocalStatus {
  if (draft.report_reference) return { kind: "received", reportReference: draft.report_reference };
  if (draft.submission_requested_at === null) return { kind: "draft", deletesAt: draft.expires_at };
  return {
    kind: "pending_submission",
    confirmed: false,
    deletesAt:
      draft.submission_expires_at ??
      new Date(Date.parse(draft.submission_requested_at) + 48 * 60 * 60 * 1000).toISOString(),
    needsReporter: draft.submission_outcome === "rejected" || draft.submission_outcome === "needs_upload",
    cancelling: draft.cancel_requested_at !== null,
  };
}
