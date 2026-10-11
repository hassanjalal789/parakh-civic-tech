/**
 * CIT-13 is reachable only after a successful server response (FR-PUB.30): the
 * reference shown there is read from here, where only the submission queue puts
 * the server's answer, never from a URL. So no link can show a reference that the
 * server did not create. Kept in memory for the app session only.
 */
const received = new Map<string, string>();

/** The server created the report for this draft. */
export function rememberReceived(clientSubmissionId: string, reportReference: string): void {
  received.set(clientSubmissionId, reportReference);
}

/** The reference the server returned for this draft in this app session, or null. */
export function receivedReference(clientSubmissionId: string): string | null {
  return received.get(clientSubmissionId) ?? null;
}
