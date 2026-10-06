/**
 * When a submission is tried again, and what a failed attempt means
 * (FR-PUB.28; DG-14, DG-65; docs/api/CITIZEN_REPORTING_CONTRACT.md §3, §4).
 */
import { ApiError, OfflineError, UnmatchedRequestError } from "../api/errors";

/** Automatic retries run for 48 hours from the first final-submission attempt (DG-14). */
export const RETRY_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The waits between automatic attempts; the last one repeats until the window ends. */
export const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000] as const;

export function windowEndsAt(firstAttemptAt: string): number {
  return Date.parse(firstAttemptAt) + RETRY_WINDOW_MS;
}

/** Open until the first attempt has been made, then for 48 hours. */
export function windowOpen(firstAttemptAt: string | null, now: Date): boolean {
  return firstAttemptAt === null || now.getTime() < windowEndsAt(firstAttemptAt);
}

/** When the next automatic attempt is due after `attempts` attempts; never after the window ends. */
export function nextAttemptAt(
  now: Date,
  attempts: number,
  firstAttemptAt: string,
  retryAfterSeconds = 0,
): string {
  const backoff = BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1] as number;
  const wait = Math.max(backoff, retryAfterSeconds * 1000);
  return new Date(Math.min(now.getTime() + wait, windowEndsAt(firstAttemptAt))).toISOString();
}

export type AttemptFailure =
  /** The request may have reached the server: its status is checked before anything else. */
  | { outcome: "unknown"; code: string }
  /** The server certainly created no report: try again later. */
  | { outcome: "failed"; code: string; retryAfterSeconds?: number }
  /** Only the reporter can fix it (confirm the text again, add a photo, …). */
  | { outcome: "rejected"; code: string }
  /** The server no longer holds the uploads, or never received them: upload again. */
  | { outcome: "needs_upload"; code: string }
  /** The draft was cancelled on the server. */
  | { outcome: "cancelled"; code: string };

const NEEDS_UPLOAD = new Set(["E_DRAFT_EXPIRED", "E_UPLOAD_INCOMPLETE", "E_NOT_FOUND"]);
const SIGNED_OUT = new Set(["E_UNAUTHENTICATED", "E_REFRESH_INVALID"]);

/** What a failed API-133 or API-140 call says about the submission. */
export function classifyFailure(error: unknown): AttemptFailure {
  if (error instanceof OfflineError) return { outcome: "unknown", code: "offline" };
  if (error instanceof UnmatchedRequestError) return { outcome: "failed", code: "not_sent" };
  if (!(error instanceof ApiError)) return { outcome: "unknown", code: "unreadable_answer" };
  const { code, status } = error;
  if (status >= 500) return { outcome: "unknown", code };
  if (code === "E_DRAFT_CANCELLED") return { outcome: "cancelled", code };
  if (NEEDS_UPLOAD.has(code)) return { outcome: "needs_upload", code };
  if (status === 429 || code === "E_RATE_LIMITED") {
    return { outcome: "failed", code, retryAfterSeconds: error.numberDetail("retry_after_seconds") };
  }
  if (status === 401 || SIGNED_OUT.has(code)) return { outcome: "failed", code }; // resumes in the next session
  return { outcome: "rejected", code };
}
