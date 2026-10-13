# A-04 — Pending submission expiry recovery (T-131)

## Authority and scope

Hassan authorized this isolated corrective checkpoint on 13 October 2026. Governing requirements are Mobile SRS v2.11.0 FR-PUB.28, FR-COMMON.12–13/25, section 3.6.4, DG-64, DG-65 and DG-67. The first explicit Submit fixes the 48-hour deadline. A final server-status check where reachable precedes removing an expired pending copy; an existing server report is never deleted. No new product policy, screen, migration, provider or dependency is introduced.

Branch `fix/a04-pending-expiry-recovery` is based on committed A-01 `e0caf92`. A-01's original worktree and A-02/A-03's separate frozen worktree/review schedules remain independent. This branch does not contain the separately published A-02/A-03 implementation.

## Defect reproduced

Regression tests were written first. Cold store reopen, foreground return and reachable-but-unsubmitted cleanup never called the final status API because the store purged expired rows before the submission queue could inspect them. The first focused A-04 run produced three expected failures and one passing cross-account control. Evidence: ignored `.local/a04-before.log`.

## Implementation

- Store opening prepares the current owner's shared submission queue without starting uploads, settles expired submissions, then runs the all-account local purge and orphan sweep.
- Store foreground/manual cleanup refreshes its prepared queue from the shared queue registry and uses per-submission exclusive jobs as screen-driven submission, rather than racing an in-flight request.
- Status `submitted` permits only a replay with the existing identifier/key to retrieve the original report. Status `active` or offline/refused status never causes a new post-deadline submission.
- Expired rows remain hidden from ordinary repository reads immediately at their unchanged deadline. Unconfirmed rows and media are removed; only existing content-free cancellation notes remain. Other-account expired content is purged locally without starting a status request for that owner. The shared API client has a pre-existing 401 token-switch retry risk; see limitations below.
- Close, failed open and account switch stop/fence old recovery. Late responses cannot start a replay under a later session or publish a recovered receipt after timeout/removal.
- A final recovery job has a 10-second technical liveness bound (not a new retry window or changed expiry timestamp). It prevents a hung status/replay or pre-deadline in-flight send from retaining expired media indefinitely. This bound must be challenged in independent review. A request already sent before expiry may still finish on the server; its report remains and My Reports may retrieve it. The client does not claim an unconfirmed late response as receipt.
- No original media bytes are re-encoded or changed.

## Initial regression coverage (superseded by review repairs below)

The initial 13 new regressions cover cold reopen after expiry (media still present at the check), foreground check before row deletion, reachable unsubmitted status, offline deletion, close during cold recovery, owner switch during foreground recovery, another owner's expiry, hung final status/late response, joined successful in-flight send, hung pre-deadline send/late receipt, stopped-session fencing, a status request crossing the deadline without a new send, and Cancel on an already-hidden expired row without false cancellation.

Existing cancellation, My Reports, storage/capture/legacy migration, reporting and API tests remain part of the full suite.

## Initial validation and limitations (superseded counts; failures retained)

- Sequential final full mobile suite: 397 passed, 4 opt-in skipped; 25 suites passed, 3 suites skipped. TypeScript, ESLint and Prettier passed.
- Backend at this branch's A-01 base: 257 passed, disposable Django test database; zero system-check issues.
- Initial parallel mobile run while other validation work was active: 9 failed, 387 passed, 4 skipped. Failure log retained as `.local/a04-mobile-check.log`; this is not erased or assumed unrelated merely because the sequential run passed. A non-overlapping standard `npm run check` subsequently passed all 397 tests (4 skipped) in 18.326s. It emitted a React `act(...)` warning in QueuedScreen's test; the warning is retained and is not described as a product failure. The precise cause of the initial loaded-run failures was not independently isolated.
- Requirement index matches v2.11.0 (124 FR, 86 NFR, 12 SC).
- Tests use synthetic data, Node SQLite and temporary filesystem/native stand-ins. No emulator, physical phone, Water draft, development DB, live server or actual network/device behavior was exercised.
- Claude independent review, commit/push and remote CI are pending. Do not mark this checkpoint accepted until those gates complete. No main merge is authorized.


## Independent review repair checkpoint, 13 October 2026

First actual Claude verdict: **REQUEST CHANGES**. Four new tests reproduced all three code findings (B1, two B2 cases, B3): 4 failed before repairs. After repairs, all 104 storage/submission tests passed.

- B1: capture the purge cutoff before the final recovery sweep, and reuse it for the all-account deletion query. A pending row crossing expiry during that sweep remains invisible but is not deleted unchecked; the next sweep performs its final check before media deletion.
- B2: foreground cleanup reacquires the shared prepared queue; stopped queues are replaced. A queue stopped during a sweep fences the deletion phase. The three explicit self-check/retention fixture owner IDs are local-only: they do not create queues, replace the real citizen queue or make synthetic status calls. No fixture ran on a device.
- B3: new final checks use their existing network bound, without a competing outer timer over receipt storage. Only already-running jobs need the outer bound. A confirmed receipt already being stored is awaited, not abandoned. Concurrent final checks share a job.
- B4: foreground tests await the actual listener promise. New submission regressions now wait for explicit fake-server call events instead of assuming 30 microtask turns. No increased test timeout conceals a failure.

The initial nine loaded-run failures were:

- My Reports: the three kinds of row (FR-PUB.31) › a pending submission, an unfinished draft and sent reports are listed apart; only sent ones carry a reference
- My Reports: the three kinds of row (FR-PUB.31) › no state code is ever shown, and every status is a word beside a picture
- CIT-12: waiting to send (FR-PUB.29) › named and announced; no reference anywhere; no claim of receipt
- CIT-01 language › choosing a language switches the interface and records the choice
- CIT-11: before the texts exist › missing parts are named, each with a way to add it, and nothing is sent
- CIT-08: the camera is open only while this screen is in front (phone, 2026-10-13) › covered by another screen, the preview is closed; in front again, it is open
- CIT-09: two equal ways, no language picker (FR-PUB.9, FR-PUB.13) › Speak and Type are offered side by side; neither is chosen for the citizen and Continue waits
- CIT-10: the current GPS position (FR-PUB.24, DG-30) › found at once when location is allowed: coordinates, accuracy, and nothing but the GPS
- CIT-10: the current GPS position (FR-PUB.24, DG-30) › explained before Android asks, and asked only when the reporter taps

None were the A-04 storage/submission tests. Seven failures report 5-second test timeouts; the other two are assertions in the same My Reports/location suites. Resource contention is plausible but not independently proven as the sole cause. The original failure log remains preserved. A clean isolated baseline at e0caf92 ran all 11 queued/received tests successfully without the React act warning. The repaired 401-test run emitted no act warning. The final 403-test standard run emitted it again, in QueuedScreen's test (QueuedScreen.tsx:62, setDraft). The warning is intermittent and is not attributed to either the baseline or A-04. It is not resolved.

### Technical choices and unresolved owner points

- The existing 10-second implementation bound limits waiting for status plus same-key replay as one budget, not the network request itself. No AbortController was added: late results are fenced. Network work may continue after the wait ends.
- The bound applies sequentially per expired draft; N unresponsive drafts can delay opening by approximately N times 10 seconds, plus local database/filesystem work. Once server confirmation has arrived, receipt storage is awaited; the network bound is not a hard bound on all local I/O.
- **Open owner/security point A04-P1:** confirm the 10-second shared final-check budget and resulting slow-link reachability tradeoff. No deadline extension or new product approval is inferred; stored expiry timestamps and immediate visibility cutoff remain unchanged.
- **Open owner point A04-P2:** document final-check unavailability when the owning session has ended, or another account is active. Cross-owner status requests are forbidden; expired foreign-owner content is deleted locally. Tests encode isolation, not an invented owner acceptance.
- Pre-existing API-client limitation: a late 401 may retry through the current token after a principal switch. Queue fences prevent local receipt publication after stop, but do not claim transport credential pinning. This is outside the allowed A-04 file set and remains a security follow-up; server ownership checks remain mandatory.
- Source inspection confirms API-140 uses transaction.atomic and owned_draft(for_update=True); cancellation does likewise, refuses cancellation once resulting_report_id exists, and submit requires an active draft. This is source evidence, not a PostgreSQL concurrency test. Whether an in-flight submit creates a report depends on which operation obtains the row lock first.
- No A-01/A-02/A-03/UI worktree, original handover, Water draft, physical phone, development database or governance register was changed by this repair.

Fresh independent Claude approval is required for this repaired diff. T-131 / VAL-098 do not collide with T-130 / VAL-097. Future integration must regenerate the tracker from reconciled canonical rows; never hand-merge the binary workbook.


## Final R1 correction and publication gates
The second Claude verdict was APPROVE WITH REQUIRED CHANGES: B1–B4 were accepted, but Cancel could falsely return cancelled after expiry abandonment and late server success. Two tests reproduced that error before the fix. Cancel now returns removed_unconfirmed for abandonment or expiry between reads; already_submitted still requires a confirmed prior success. Final focused storage/submission tests: 106 passed. Final standard check: 403 passed, four opt-in skipped; TypeScript, ESLint and formatting pass. The previous sequential run before these two extra tests passed 401 tests, four skipped. Backend revalidation: 257 passed in 29.554 seconds; tracker: 16 passed. No native or live-server run.

There are now 19 added A-04 regression cases. Existing English/Urdu queued.removed wording explicitly says removal from this phone and makes no claim that the server report was deleted. A joined job entering its own final check can receive less than a fresh 10-second budget; this remains part of A04-P1. A04-P1/P2 remain OPEN and T-131 stays In Review even after reviewed branch publication and green CI. This checkpoint cannot be accepted or merged until Hassan decides those points. Separate owner authorization is required for transport credential pinning in client.ts; no out-of-scope fix was made.

Targeted final independent review of R1 and corrected records is pending at this write. The actual publication verdict will be recorded with the PR and local completion receipt; no earlier verdict is treated as unconditional approval.
