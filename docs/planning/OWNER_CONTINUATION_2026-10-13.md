# PARAKH — CONTINUE DEVELOPMENT, SET UP NEW ANDROID DEVICE, AND DEFER CLAUDE REVIEW UNTIL 16 OCTOBER

**Project:** PARAKH — Evidence-First Civic Reporting and Government Resolution Platform

**Repository:** `/Users/apple/Desktop/PARAKH`

**GitHub:** https://github.com/hassanjalal789/parakh-civic-tech

**Owner:** Hassan Jalal

**Final target:** 18 October 2026 — complete, functioning, internally tested Android application.

**Mandatory Claude Code handover and independent review:** 16 October 2026, at or after 1:00 PM Pakistan Standard Time (Asia/Karachi).

## 1. IMPORTANT — DO NOT STOP DEVELOPMENT WHILE WAITING FOR CLAUDE

I am clarifying the review schedule.

**All pending independent Claude Code reviews may be deferred until 16 October 2026, at or after 1:00 PM Pakistan time, when Claude is expected to resume development leadership.**

This includes CIT-15 and any other currently pending checkpoints requiring Claude's review.

Until then, ChatGPT/Codex must continue implementing, testing, documenting and preparing reviewable checkpoints.

Do not keep attempting Claude CLI authentication unnecessarily or repeatedly stop development because Claude is currently unavailable.

However:

- Do not mark unreviewed features as independently approved.
- Do not bypass security requirements.
- Do not merge unreviewed branches into `main`.
- Do not fabricate review verdicts.
- Preserve exact diffs and test evidence.
- Keep all review requests organized for Claude's return.

## 2. NEW ANDROID DEVICE — SET UP PARAKH FIRST

I will connect a **new Android testing device** to my Mac.

This is a new device, so do not assume it has the same configuration, Android version, development permissions, or PARAKH installation as the previously used Samsung device.

Once connected:

1. Detect the device using the authorized Mac/ADB connection.
2. Confirm its actual model, Android version, API level, supported architecture, USB authorization and connection status.
3. Check whether USB debugging and necessary developer permissions are enabled.
4. If any manual phone setting is required, give me exact step-by-step instructions.
5. Check the existing PARAKH Android build and development environment.
6. Identify the correct compatible development APK/build.
7. Build or install PARAKH on the new device.
8. Configure safe connectivity to the development backend.
9. Launch PARAKH and confirm that it starts without crashing.
10. Verify basic navigation and UI rendering before proceeding to deeper testing.

**Do not perform a factory reset, uninstall an existing application with user data, clear storage, alter unrelated apps, or delete any phone content.**

If the device already contains a PARAKH installation, inspect its data-preservation implications before upgrading or replacing it.

Do not assume that an APK is installable merely because automated tests passed.

Use actual installation and launch evidence.

## 3. PHYSICAL ANDROID TESTING — AFTER SUCCESSFUL INSTALLATION

Once PARAKH has been installed successfully, perform controlled testing using authorized synthetic accounts and evidence.

Test all currently implemented and testable workflows, including:

### Authentication
- OTP request and verification.
- Invalid OTP.
- Resend and expiry.
- Session persistence.
- Token refresh.
- Logout.
- Account isolation.
- Consent and re-consent where implemented.

### Citizen reporting
- Home screen.
- Category selection.
- Photo capture.
- Video recording.
- Media preview.
- Speak/Type description.
- Supported language selection.
- Original and rendered text confirmation.
- GPS location.
- Manual location fallback.
- Report review.
- Submit.
- Waiting to Send.
- Received screen.
- PRK reference.
- My Reports.

### CIT-15 — Report Detail
Test draft PR #4, commit `9953501`, in its correct isolated dependency context.

Specifically test:

- Opening a submitted report from My Reports.
- Loading the correct citizen-owned report.
- Displaying confirmed descriptions.
- Displaying measured and reported locations separately.
- Displaying the sanitized public timeline.
- Opening authenticated photos.
- Playing authenticated videos.
- Playing authenticated audio.
- Handling expired sessions and unauthorized access.
- Sharing the PRK reference only.
- Navigation and Android Back behavior.
- Loading, empty, offline and error states.
- Media cache and temporary file cleanup.

Note that the approved encrypted 30-day offline report-media cache was not included in the original CIT-15 WIP checkpoint. Track this as an unfinished requirement until actually implemented and tested.

### Reliability
- App foreground/background.
- App restart.
- Network interruption.
- Offline submission.
- Automatic retries.
- Lost server response.
- Expired pending submission recovery.
- Cancellation.
- Camera lifecycle.
- Safe navigation.
- Duplicate submission prevention.
- Device permissions.

Use synthetic data only.

Never modify or delete the unfinished Water draft on the previously used device.

Do not perform destructive tests without the necessary authorization.

For every tested feature, record PASS, FAIL, BLOCKED or NOT IMPLEMENTED, with supporting evidence.

If a test discovers a bug, reproduce it, identify the affected code, write regression coverage, fix it in an isolated branch and rerun the relevant tests.

## 4. CIT-15 — CURRENT STATUS AND NEXT ACTIONS

The latest reported CIT-15 checkpoint is:

- Draft PR #4: https://github.com/hassanjalal789/parakh-civic-tech/pull/4
- Commit: `9953501`
- Branch: `codex/cit15-report-detail`
- GitHub CI: successful at the previously checked commit.
- Independent Claude review: pending.
- Physical Android testing: pending.
- Final Urdu text approval: pending.
- Encrypted offline media cache: pending.
- `main`: unchanged at the previously verified checkpoint.

Verify these facts against the current repository before relying on them.

Continue the required CIT-15 work safely.

Prepare the provisional Urdu text as a complete, organized review package for my approval.

Do not silently approve Urdu consent, privacy or status wording on my behalf.

Preserve CIT-15 as In Review until the applicable acceptance conditions are met.

## 5. CONTINUE ALL REMAINING UNBLOCKED DEVELOPMENT

Do not wait idly for 16 October.

Work through the latest owner-approved master development directive and premium green-and-white interactive 3D UI/UX directive.

Prioritize the remaining critical path:

- CIT-15 completion.
- Citizen clarification and completion-confirmation screens.
- Confirm/Dispute.
- Profile and notifications.
- Interactive Google Maps.
- Real OpenAI voice/text integration and Punjabi support.
- Real SMS integration within approved testing budget.
- Automatic high-confidence duplicate complaint grouping.
- Union Council routing.
- Staff authentication and authorization.
- Street Representative workflows.
- UC Officer workflows.
- Contractor workflows.
- Mayor & Operations workflows.
- Independent appeals.
- Approved data privacy and audit controls.
- Encrypted offline media.
- Premium green-and-white design system.
- Interactive, dimensional components and polished animations.
- Android compatibility and visual testing.
- Integration and backend tests.

Do not treat this as permission to install arbitrary dependencies, incur financial charges, perform destructive migrations or bypass existing owner-approval boundaries.

Use safely isolated development branches/worktrees, maintain dependency tracking and continue implementation wherever requirements and permissions are already clear.

Avoid simultaneous conflicting changes.

## 6. PRESERVE ALL PENDING CHECKPOINTS

Reconcile and preserve:

- A-01 privacy fix and tracker canonical-data verification.
- A-02/A-03 backend robustness checkpoint.
- A-04 expiry recovery.
- F-6/F-8 navigation regression coverage.
- A-05 audit semantics.
- A-06 progress idempotency.
- CIT-15 draft PR #4.
- All existing handover documents.
- `REVIEW.md`.
- Owner-approved governance amendments.
- Updated Android testing evidence.
- Any newly discovered bugs.

Do not modify a review-frozen checkpoint merely to make another task pass.

Keep `main` unchanged unless I explicitly approve a reviewed merge.

## 7. CLAUDE CODE — MANDATORY 16 OCTOBER HANDOVER

Before **12:30 PM PKT on 16 October**, prepare the complete development handover.

Claude must receive:

1. The complete actual PARAKH repository.
2. All historical Claude work and previous handover records.
3. All ChatGPT/Codex development changes.
4. Every branch, worktree and commit SHA.
5. All owner-approved decisions.
6. All pending governance/security issues.
7. Every pending independent review.
8. Exact diffs for unreviewed checkpoints.
9. CI and regression-test results.
10. Physical Android device test evidence.
11. Known failed/skipped tests.
12. All remaining app features.
13. Premium green-and-white 3D UI/UX requirements.
14. External provider integration status.
15. The complete 18 October development and acceptance plan.

At or after **1:00 PM PKT on 16 October**, attempt the authorized Claude Code handover.

Claude must independently examine the actual repository and review the pending checkpoint diffs.

Do not treat a previous review of an older diff as approval of a newer diff.

After review, address substantiated required changes, rerun tests, and record the exact approval evidence.

Only after Claude has actually received the project state and acknowledged the continuation plan should Claude be described as having taken over development leadership.

If Claude remains unavailable, preserve the complete handover and report the blocker without inventing a successful transfer.

Once Claude takes over, stop conflicting Codex write activity.

## 8. IMMEDIATE EXECUTION ORDER

Start now.

**Step 1:** Check the real current repository, GitHub PRs, branches, worktrees and running processes.

**Step 2:** Check whether my new Android device is connected.

**Step 3:** Once the device is available and authorized, configure it and install PARAKH before performing physical app tests.

**Step 4:** Run safe, comprehensive tests of all currently implemented features.

**Step 5:** Record findings and correct reproducible bugs.

**Step 6:** Continue the next safely isolated and unblocked development tasks without waiting for Claude.

**Step 7:** Maintain full development, testing, review and governance documentation.

**Step 8:** Prepare the mandatory 16 October Claude handover.

**Step 9:** Transfer development leadership to Claude after 1:00 PM PKT on 16 October, subject to actual availability and acknowledgement.

**Step 10:** Continue toward the requested complete Android application target of 18 October, reporting actual verified progress and all remaining limitations.

### Final instruction

**Do not allow PARAKH development to stop simply because Claude cannot review the code until 16 October.**

Install and test PARAKH on the newly connected Android device, preserve all existing checkpoints, continue all authorized unblocked development, and ensure Claude receives the full verified project state on 16 October.

Do not mark incomplete or unreviewed work as complete.

START NOW.