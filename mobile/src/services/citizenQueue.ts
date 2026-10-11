/**
 * One submission queue per signed-in citizen, shared by every screen (T-052).
 *
 * A draft is sent by one queue only, so two screens can never send it twice. The
 * queue starts when the citizen's local store opens and runs until sign-out or
 * session expiry stops it (startSubmissionQueue); a later session, or another
 * account, gets a new one.
 */
import type { DraftRepository } from "../storage/drafts";
import { startSubmissionQueue, submissionQueue, type SubmissionQueue } from "./submissionQueue";

let current: { accountId: string; queue: SubmissionQueue } | null = null;

export function citizenQueue(accountId: string, drafts: DraftRepository): SubmissionQueue {
  if (current && current.accountId === accountId && !current.queue.stopped) return current.queue;
  current?.queue.stop();
  const queue = submissionQueue(drafts);
  startSubmissionQueue(queue);
  current = { accountId, queue };
  return queue;
}
