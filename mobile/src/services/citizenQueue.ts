/**
 * One submission queue per signed-in citizen. Store expiry recovery and screens
 * share it, so foreground cleanup joins an in-flight job rather than racing it.
 */
import type { DraftRepository } from "../storage/drafts";
import { startSubmissionQueue, submissionQueue, type SubmissionQueue } from "./submissionQueue";

let current: { accountId: string; queue: SubmissionQueue; started: boolean } | null = null;

/** Prepare without scheduling uploads: store opening must settle expiry before its purge. */
export function prepareCitizenQueue(
  accountId: string,
  drafts: DraftRepository,
  clock: () => Date = () => new Date(),
): SubmissionQueue {
  if (current && current.accountId === accountId && !current.queue.stopped) return current.queue;
  current?.queue.stop();
  current = { accountId, queue: submissionQueue(drafts, undefined, clock), started: false };
  return current.queue;
}

export function citizenQueue(accountId: string, drafts: DraftRepository): SubmissionQueue {
  const queue = prepareCitizenQueue(accountId, drafts);
  if (current && !current.started) {
    current.started = true;
    startSubmissionQueue(queue);
  }
  return queue;
}
