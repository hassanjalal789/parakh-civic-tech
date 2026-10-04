/**
 * Ending a citizen session on the device (FR-AUTH.13).
 *
 * Clears the two tokens and tells the principal store, which sends the
 * gateway back to sign-in. Nothing else is wiped: local drafts, recordings
 * and evidence stay on the device for the same account to resume.
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

export async function endCitizenSession(reason: SessionEndReason): Promise<void> {
  await clearCitizenTokens();
  for (const listener of [...listeners]) listener(reason);
}
