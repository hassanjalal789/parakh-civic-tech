/**
 * The last list of reports the server gave this account, kept in memory so My Reports can show it with
 * no connection (FR-PUB.31). Memory only: it is not written to disk (SRS §3.4.1), belongs to one account,
 * and is destroyed when the session ends (SRS §3.4.3).
 */
import type { ReportSummary } from "../api/reporting";
import { onCitizenSessionTeardown } from "../auth/session";

let cached: { accountId: string; reports: ReportSummary[]; at: string } | null = null;

export function rememberReports(accountId: string, reports: ReportSummary[], at: Date = new Date()): void {
  cached = { accountId, reports, at: at.toISOString() };
}

/** The remembered list, only for the account that fetched it. */
export function cachedReports(accountId: string): { reports: ReportSummary[]; at: string } | null {
  return cached && cached.accountId === accountId ? { reports: cached.reports, at: cached.at } : null;
}

onCitizenSessionTeardown(async () => {
  cached = null;
});
