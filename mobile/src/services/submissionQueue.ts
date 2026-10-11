/**
 * The submission queue (T-052; FR-PUB.28, FR-COMMON.11–13; DG-14, DG-65).
 *
 * - **Nothing is sent until the reporter presses Submit** after reviewing the
 *   report: a draft whose Submit was never pressed is never submitted, and is
 *   deleted when its 2-day lifetime ends.
 * - Pressing Submit is recorded, with the one idempotency key, **before** the
 *   first request leaves the phone, and every attempt is marked "outcome
 *   unknown" before it is sent. So a lost response is never mistaken for an
 *   unsubmitted draft, and the server is asked for the draft's status before
 *   the next attempt or before any local deletion.
 * - Failed attempts are retried automatically for 48 hours from the first
 *   press of Submit. Then the pending submission is deleted from the phone
 *   (DG-67, Hassan Jalal, 2026-10-07): after one last status check where the
 *   server can be reached, so a report that did arrive is shown; and with a
 *   note asking the server to drop its temporary copy. The server keeps any
 *   report that exists.
 * - Retries stop on confirmed success or cancellation. One attempt per draft
 *   runs at a time, every attempt reuses the key, and the server returns the
 *   original report to a replay, so no duplicate report can be created.
 * - On success the local copy is deleted; the report lives on the server.
 *
 * A queue is bound to one account's repository and stops when the session
 * ends, so it never acts with another account's credentials.
 */
import * as Crypto from "expo-crypto";
import { AppState, type NativeEventSubscription } from "react-native";

import {
  cancelDraftOnServer,
  type CancelOutcome,
  fetchDraftStatus,
  type ReportCreated,
  type ServerLifecycle,
  submitReport,
} from "../api/reporting";
import { onCitizenSessionTeardown } from "../auth/session";
import { type AttemptFailure, classifyFailure, nextAttemptAt, windowOpen } from "../domain/submissionRules";
import type { DraftRepository, DraftRow } from "../storage/drafts";
import { discardDraft } from "../storage/lifetime";
import { rememberReceived } from "./received";

export type SubmissionApi = {
  fetchDraftStatus(clientSubmissionId: string): Promise<ServerLifecycle>;
  submitReport(clientSubmissionId: string, submissionKey: string): Promise<ReportCreated>;
  cancelDraftOnServer(clientSubmissionId: string): Promise<CancelOutcome>;
};

const SERVER: SubmissionApi = { fetchDraftStatus, submitReport, cancelDraftOnServer };

export type SubmissionResult =
  | { kind: "submitted"; reportId: string; reportReference: string }
  | { kind: "retrying"; outcome: "unknown" | "failed"; code: string; nextAttemptAt: string }
  /** The 48 hours ended without confirmation, and the pending submission was deleted (DG-67). */
  | { kind: "removed_unconfirmed" }
  | { kind: "needs_action"; outcome: "rejected" | "needs_upload"; code: string }
  | { kind: "cancelled" }
  /** Cancel was asked for after Submit; the local copy is kept until the server answers. */
  | { kind: "cancel_pending" }
  /** Cancel came too late: the report exists, and is kept. Cancellation is never shown falsely. */
  | { kind: "already_submitted"; reportId: string; reportReference: string }
  | { kind: "refused"; reason: "unknown_draft" | "not_ready" | "cancel_pending" | "stopped" };

type Mode = "automatic" | "manual";

/** How often an unanswered cancellation is sent again while the app runs. */
const CANCEL_RETRY_MS = 5 * 60 * 1000;

export function submissionQueue(
  drafts: DraftRepository,
  api: SubmissionApi = SERVER,
  clock: () => Date = () => new Date(),
) {
  const attempts = new Map<string, Promise<SubmissionResult>>();
  const cancelling = new Set<string>();
  let stopped = false;

  /** At most one job per draft: a second request joins the one already running. */
  function exclusive(id: string, job: () => Promise<SubmissionResult>): Promise<SubmissionResult> {
    const running = attempts.get(id);
    if (running) return running;
    const run = job().finally(() => attempts.delete(id));
    attempts.set(id, run);
    return run;
  }

  function once(id: string, mode: Mode): Promise<SubmissionResult> {
    return exclusive(id, () => attempt(id, mode));
  }

  async function finish(id: string, reportId: string, reportReference: string): Promise<SubmissionResult> {
    // Recorded first, so an interruption before the deletion still knows the report exists.
    await drafts.update(id, {
      report_id: reportId,
      report_reference: reportReference,
      next_attempt_at: null,
    });
    await discardDraft(drafts, id);
    rememberReceived(id, reportReference); // what CIT-13 shows: only ever the server's answer
    return { kind: "submitted", reportId, reportReference };
  }

  /**
   * The 48 hours ended without confirmation (DG-67). One last look where the server can be
   * reached, so a report that did arrive is shown rather than lost from view; then the local copy
   * is deleted in any case, with a note asking the server to drop its temporary data.
   */
  async function endWindow(draft: DraftRow): Promise<SubmissionResult> {
    const id = draft.client_submission_id;
    try {
      if (!stopped && draft.submission_key && (await api.fetchDraftStatus(id)) === "submitted") {
        const created = await api.submitReport(id, draft.submission_key); // a replay: the original report
        if (created?.report_id && created.report_reference) {
          return finish(id, created.report_id, created.report_reference);
        }
      }
    } catch {
      // Not reachable now: the deadline still applies, and the note asks the server later.
    }
    await drafts.queueServerCancellation(id);
    await discardDraft(drafts, id);
    return { kind: "removed_unconfirmed" };
  }

  /** `tries` counts every try, a status check included, so the wait grows while the phone is offline. */
  async function afterFailure(
    draft: DraftRow,
    failure: AttemptFailure,
    tries: number,
  ): Promise<SubmissionResult> {
    const id = draft.client_submission_id;
    if (failure.outcome === "cancelled") {
      await discardDraft(drafts, id); // only the account itself can cancel its draft (DG-55)
      return { kind: "cancelled" };
    }
    if (failure.outcome === "rejected" || failure.outcome === "needs_upload") {
      await drafts.update(id, {
        pipeline_state: "SUBMISSION_FAILED",
        submission_outcome: failure.outcome,
        last_error: failure.code,
        next_attempt_at: null,
        attempts: tries,
      });
      return { kind: "needs_action", outcome: failure.outcome, code: failure.code };
    }
    const now = clock();
    const deadline = draft.submission_expires_at;
    if (deadline === null || !windowOpen(deadline, now)) return endWindow(draft);
    const retryAfter = failure.outcome === "failed" ? failure.retryAfterSeconds : undefined;
    const next = nextAttemptAt(now, tries, deadline, retryAfter);
    await drafts.update(id, {
      pipeline_state: "SUBMISSION_FAILED",
      submission_outcome: failure.outcome,
      last_error: failure.code,
      next_attempt_at: next,
      attempts: tries,
    });
    return { kind: "retrying", outcome: failure.outcome, code: failure.code, nextAttemptAt: next };
  }

  async function attempt(id: string, mode: Mode): Promise<SubmissionResult> {
    if (stopped) return { kind: "refused", reason: "stopped" };
    let draft = await drafts.get(id);
    if (!draft) return { kind: "refused", reason: "unknown_draft" };
    if (draft.submission_requested_at === null || draft.submission_key === null) {
      return { kind: "refused", reason: "not_ready" }; // never a draft whose Submit was not pressed
    }
    if (draft.cancel_requested_at || cancelling.has(id)) return { kind: "cancel_pending" };
    if (draft.report_id && draft.report_reference) return finish(id, draft.report_id, draft.report_reference);
    const outcome = draft.submission_outcome;
    if (!windowOpen(draft.submission_expires_at, clock())) return endWindow(draft);
    if (mode === "automatic" && (outcome === "rejected" || outcome === "needs_upload")) {
      return { kind: "needs_action", outcome, code: draft.last_error ?? outcome };
    }

    const tries = draft.attempts + 1;
    // A lost response is told apart from a failed one: ask the server before sending again (DG-65).
    if (outcome === "unknown") {
      let lifecycle: ServerLifecycle;
      try {
        lifecycle = await api.fetchDraftStatus(id);
      } catch (error) {
        // An unanswered check says nothing about the submission: it stays unknown and is asked again.
        return afterFailure(draft, { outcome: "unknown", code: classifyFailure(error).code }, tries);
      }
      if (lifecycle === "cancelled") {
        return afterFailure(draft, { outcome: "cancelled", code: "E_DRAFT_CANCELLED" }, tries);
      }
      if (lifecycle === "expired")
        return afterFailure(draft, { outcome: "needs_upload", code: "E_DRAFT_EXPIRED" }, tries);
      if (lifecycle === "absent")
        return afterFailure(draft, { outcome: "needs_upload", code: "E_NOT_FOUND" }, tries);
      // "submitted": the replay below returns the original report. "active": a new attempt.
    }

    // Recorded before the request leaves, so an interruption mid-request is treated as unknown.
    const first = draft.first_submission_attempt_at ?? clock().toISOString();
    draft =
      (await drafts.update(id, {
        submission_outcome: "unknown",
        first_submission_attempt_at: first,
        attempts: tries,
        next_attempt_at: null,
        last_error: null,
      })) ?? draft;
    if (stopped) return { kind: "refused", reason: "stopped" };
    if (cancelling.has(id)) return { kind: "cancel_pending" }; // checked with no await before the send
    let created: ReportCreated;
    try {
      created = await api.submitReport(id, draft.submission_key as string);
      if (!created?.report_id || !created.report_reference) throw new Error("an answer without a report");
    } catch (error) {
      if (stopped) return { kind: "refused", reason: "stopped" };
      return afterFailure(draft, classifyFailure(error), tries);
    }
    return finish(id, created.report_id, created.report_reference);
  }

  /** Sends the content-free notes that ask the server to drop an abandoned draft's temporary data. */
  async function flushServerCancellations(): Promise<void> {
    for (const id of await drafts.pendingServerCancellations()) {
      if (stopped) return;
      try {
        // Either answer settles the note: cancelled, or "already submitted", where the report stays.
        await api.cancelDraftOnServer(id);
        await drafts.clearServerCancellation(id);
      } catch {
        return; // offline or refused for now: kept for the next run
      }
    }
  }

  return {
    /** The reporter pressed Submit after reviewing the report (DG-65). */
    async requestSubmission(id: string): Promise<SubmissionResult> {
      if (stopped) return { kind: "refused", reason: "stopped" };
      const draft = await drafts.get(id);
      if (!draft) return { kind: "refused", reason: "unknown_draft" };
      if (draft.cancel_requested_at || cancelling.has(id))
        return { kind: "refused", reason: "cancel_pending" };
      const recorded = await drafts.recordSubmit(id, draft.submission_key ?? Crypto.randomUUID());
      if (!recorded?.submission_requested_at) return { kind: "refused", reason: "not_ready" };
      return once(id, "manual");
    },

    /** "Try again" on a draft whose Submit was pressed; the server is checked first where needed. */
    retryNow(id: string): Promise<SubmissionResult> {
      return once(id, "manual");
    },

    /**
     * Cancels a draft. Never submitted: deleted from the phone at once, and the server asked to drop
     * its temporary copy. Submit pressed: retries stop at once, and the local copy is deleted only
     * when the server answers — cancelled, or "already submitted", in which case the report stays.
     */
    async cancel(id: string): Promise<SubmissionResult> {
      cancelling.add(id); // before any await, so no attempt starts sending after this
      try {
        const draft = await drafts.get(id);
        if (!draft) return { kind: "refused", reason: "unknown_draft" }; // nothing of this account's to cancel
        if (draft.submission_requested_at === null) {
          await drafts.queueServerCancellation(id);
          await discardDraft(drafts, id);
          await flushServerCancellations();
          return { kind: "cancelled" };
        }
        if (!draft.cancel_requested_at) {
          await drafts.update(id, { cancel_requested_at: clock().toISOString(), next_attempt_at: null });
        }
        const prior = await attempts.get(id)?.catch(() => null); // an attempt already sending ends first
        if (prior?.kind === "submitted") return { ...prior, kind: "already_submitted" };
        const latest = await drafts.get(id);
        if (!latest) return { kind: "cancelled" };
        if (latest.report_id && latest.report_reference) {
          await finish(id, latest.report_id, latest.report_reference);
          return {
            kind: "already_submitted",
            reportId: latest.report_id,
            reportReference: latest.report_reference,
          };
        }
        let answer: CancelOutcome;
        try {
          answer = await api.cancelDraftOnServer(id);
        } catch {
          return { kind: "cancel_pending" }; // retried by run(); nothing is deleted meanwhile
        }
        if (answer.kind === "already_submitted") {
          await finish(id, answer.reportId, answer.reportReference);
          return {
            kind: "already_submitted",
            reportId: answer.reportId,
            reportReference: answer.reportReference,
          };
        }
        await discardDraft(drafts, id);
        return { kind: "cancelled" };
      } finally {
        cancelling.delete(id);
      }
    },

    /** One pass: windows that ended, due attempts, pending cancellations, server notes. */
    async run(): Promise<void> {
      for (const draft of await drafts.endedSubmissions()) {
        if (stopped) return;
        await exclusive(draft.client_submission_id, () => endWindow(draft));
      }
      for (const draft of await drafts.list()) {
        if (stopped) return;
        const id = draft.client_submission_id;
        if (draft.submission_requested_at === null) continue; // never submitted, never sent
        if (draft.cancel_requested_at) {
          await this.cancel(id);
          continue;
        }
        const outcome = draft.submission_outcome;
        const retryable = outcome === null || outcome === "unknown" || outcome === "failed";
        const due = draft.next_attempt_at === null || Date.parse(draft.next_attempt_at) <= clock().getTime();
        if ((draft.report_id && draft.report_reference) || (retryable && due)) await once(id, "automatic");
      }
      await flushServerCancellations();
    },

    /** The earliest time run() has work to do, or null. */
    async nextWakeAt(): Promise<number | null> {
      const times: number[] = [];
      let unanswered = (await drafts.pendingServerCancellations()).length > 0;
      for (const draft of await drafts.list()) {
        if (draft.submission_requested_at === null) continue;
        if (draft.cancel_requested_at) unanswered = true;
        if (draft.submission_expires_at) times.push(Date.parse(draft.submission_expires_at)); // the last look
        const outcome = draft.submission_outcome;
        if (draft.next_attempt_at !== null && (outcome === "unknown" || outcome === "failed")) {
          times.push(Date.parse(draft.next_attempt_at));
        }
      }
      if (unanswered) times.push(clock().getTime() + CANCEL_RETRY_MS);
      return times.length ? Math.min(...times) : null;
    },

    stop(): void {
      stopped = true;
    },

    get stopped(): boolean {
      return stopped;
    },
  };
}

export type SubmissionQueue = ReturnType<typeof submissionQueue>;

/**
 * Runs a queue while the session lasts: now, at each due time, and whenever the app returns
 * to the foreground. Stops on sign-out or session expiry, before sign-in is shown.
 */
export function startSubmissionQueue(
  queue: SubmissionQueue,
  clock: () => Date = () => new Date(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let foreground: NativeEventSubscription | null = null;
  let removeTeardown: () => void = () => undefined;

  const stop = () => {
    queue.stop();
    if (timer) clearTimeout(timer);
    timer = null;
    foreground?.remove();
    foreground = null;
    removeTeardown();
  };

  const schedule = async () => {
    const at = await queue.nextWakeAt();
    if (queue.stopped || at === null) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), Math.max(0, at - clock().getTime()));
  };

  const tick = (): Promise<void> => {
    running ??= queue
      .run()
      .then(schedule)
      .catch(() => undefined) // a closed store or no network: the next trigger tries again
      .finally(() => {
        running = null;
      });
    return running;
  };

  foreground = AppState.addEventListener("change", (state) => {
    if (state === "active") void tick();
  });
  removeTeardown = onCitizenSessionTeardown(async () => stop());
  void tick();
  return stop;
}
