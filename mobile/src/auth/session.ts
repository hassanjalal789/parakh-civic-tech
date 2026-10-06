/**
 * Ending a citizen session on the device (FR-AUTH.13).
 *
 * Clears the two tokens, runs the registered teardown work (the local store
 * releases its database connection, SRS §3.4.3 step 5; the submission queue
 * stops), and only then tells the principal store, which sends the gateway
 * back to sign-in. Nothing else is wiped: local drafts, recordings and
 * evidence stay on the device, app-private, for the same account to resume
 * within their lifetime (DG-63, DG-64).
 */
import { clearCitizenTokens } from "../services/secureStorage";

export type SessionEndReason = "session_expired";

type Listener = (reason: SessionEndReason) => void;

const listeners = new Set<Listener>();

export function onCitizenSessionEnded(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Teardown = () => Promise<void>;

const teardowns = new Set<Teardown>();

/** Work that must finish before the gateway leaves the citizen group. */
export function onCitizenSessionTeardown(teardown: Teardown): () => void {
  teardowns.add(teardown);
  return () => {
    teardowns.delete(teardown);
  };
}

/** Runs every teardown; a failing one does not stop the others or the return to sign-in. */
export async function runCitizenSessionTeardown(): Promise<void> {
  for (const teardown of [...teardowns]) await teardown().catch(() => undefined);
}

export async function endCitizenSession(reason: SessionEndReason): Promise<void> {
  await clearCitizenTokens();
  await runCitizenSessionTeardown();
  for (const listener of [...listeners]) listener(reason);
}
