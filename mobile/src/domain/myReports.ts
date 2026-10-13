/**
 * What My Reports (CIT-14) lists, and how each row is worded (FR-PUB.31; SRS §4.1.4, reproduced without change).
 *
 * - Three kinds of row, always told apart: a report the server created (a reference, a civic status), a
 *   submission waiting to send (no reference, "Waiting to send"), and a draft not yet finished.
 * - Status is a word and a picture, never colour alone.
 * - Citizens never see internal state codes: every state maps to its approved label.
 */
import type { ReportSummary } from "../api/reporting";
import { type DraftRow } from "../storage/drafts";

/** Civic states → the label keys of SRS §4.1.4 and a picture. The distinction between some states is internal. */
const CIVIC: Record<string, { label: string; icon: string }> = {
  SUBMITTED: { label: "received", icon: "📥" },
  UNDER_VERIFICATION: { label: "beingChecked", icon: "🔍" },
  VERIFIED: { label: "beingChecked", icon: "🔍" },
  UC_REVIEW: { label: "beingChecked", icon: "🔍" },
  ACCEPTED: { label: "accepted", icon: "✅" },
  CONTRACTOR_ASSIGNED: { label: "workArranged", icon: "🛠️" },
  IN_PROGRESS: { label: "workStarted", icon: "🚧" },
  COMPLETION_SUBMITTED: { label: "workReportedDone", icon: "📝" },
  COMPLETION_VERIFICATION: { label: "beingConfirmed", icon: "🔎" },
  PENDING_CITIZEN_CONFIRMATION: { label: "answerNeeded", icon: "❓" },
  RESOLVED_CONFIRMED: { label: "fixed", icon: "✔️" },
  CLOSED: { label: "closed", icon: "🔒" },
  REOPENED: { label: "lookedAtAgain", icon: "🔁" },
  REJECTED: { label: "notTakenForward", icon: "⛔" },
  CANCELLED: { label: "cancelled", icon: "✖️" },
};

export type Row =
  | {
      kind: "pending";
      id: string;
      category: string | null;
      at: string;
      cancelling: boolean;
      needsReporter: boolean;
    }
  | { kind: "draft"; id: string; category: string | null; at: string }
  | {
      kind: "report";
      id: string;
      reference: string;
      category: string;
      at: string;
      label: string;
      icon: string;
    };

/** A state this build does not know is shown as "Received": never a code, never a guess about progress. */
export function civicStatus(state: string): { label: string; icon: string } {
  return CIVIC[state] ?? CIVIC.SUBMITTED!;
}

/** Pending submissions first, then unfinished drafts, then reports, newest first within each kind. */
export function buildRows(reports: readonly ReportSummary[], local: readonly DraftRow[]): Row[] {
  const newestFirst = (a: { at: string }, b: { at: string }) => Date.parse(b.at) - Date.parse(a.at);
  const pending: Row[] = [];
  const drafts: Row[] = [];
  for (const d of local) {
    if (d.report_reference) continue; // the server confirmed it: it is listed as a report
    if (d.submission_requested_at !== null) {
      pending.push({
        kind: "pending",
        id: d.client_submission_id,
        category: d.category,
        at: d.submission_requested_at,
        cancelling: d.cancel_requested_at !== null,
        needsReporter: d.submission_outcome === "rejected" || d.submission_outcome === "needs_upload",
      });
    } else {
      drafts.push({ kind: "draft", id: d.client_submission_id, category: d.category, at: d.created_at });
    }
  }
  const submitted: Row[] = reports.map((r) => ({
    kind: "report",
    id: r.report_id,
    reference: r.report_reference,
    category: r.category,
    at: r.created_at,
    ...civicStatus(r.state),
  }));
  return [...pending.sort(newestFirst), ...drafts.sort(newestFirst), ...submitted.sort(newestFirst)];
}
