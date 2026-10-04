# Temporary processing data and evidence sealing — reconciliation

| Field | Value |
|---|---|
| Date | 2026-10-04 (Asia/Karachi) |
| Owner | Hassan Jalal |
| Decision | `DG-55` — Hassan Jalal's decision of 2026-10-04 on drafts and cancellation. Related: `DG-14` (retry window), `DG-57` (expiry of abandoned temporary data, **PROPOSED**) |
| Sources reconciled | Mobile SRS v2.2.0 FR-PUB.6, FR-PUB.11, FR-PUB.20, FR-PUB.28, FR-PUB.29, FR-COMMON.12, FR-COMMON.13, §3.6.1, §6.4.1, §6.4.2 · Data Model §5.1, §5.7 · API Contract §5, §7.3 |

This page was written **before** the lifecycle was implemented, so that the
cancellation rule and the evidence-sealing and retention rules agree.

## 1. What the owner decided (`DG-55`)

1. Unfinished drafts stay on the device wherever possible.
2. Only a final, explicitly submitted complaint becomes an official `CivicReport` and receives a reference.
3. Server uploads that transcription, Urdu rendering or upload preparation need are **temporary processing data**, not reports.
4. When the citizen cancels before final submission:
   - processing stops;
   - the temporary draft content and the uploaded media are removed, **including derived content**.
5. Submitted reports and their protected evidence are preserved.
6. If cancellation races with a successful submission, the existing report reference is returned. The submitted report is never deleted, and cancellation is never falsely shown.

## 2. What the sources already say, and how each rule is kept

| Source rule | Applies to | How the lifecycle keeps it |
|---|---|---|
| Evidence is **write-once** (DR-6; Data Model §5.7) | Evidence of a report | Sealing happens in the report-creation transaction (§3, stage C). Write-once protection starts there |
| *"Once an item is part of a submitted report it can never be modified or deleted"* (FR-PUB.6, BR-003, BR-022) | Items of a submitted report | A sealed item has no delete path except the approved retention policy |
| *"Review, retake and delete a not-yet-submitted evidence item"* (FR-PUB.6); *"re-recording replaces the draft recording only before submission"* (FR-PUB.11) | Unsubmitted items | Before submission, items are temporary and can be discarded. That is also what makes cancellation possible |
| *"Original audio is immutable while retained"* (§6.4.2) | Original recording | The bytes are never altered at any stage. Deleting an **unsubmitted** recording on cancellation is deletion, not alteration |
| Raw media and audio retention: **TBD — legal or institutional review** (§6.4.1) | Sealed evidence | Unchanged. The legal TBD governs sealed evidence only. Temporary data is deleted sooner, which only shortens retention |
| *"A permitted non-reversible hash, deletion tombstone and audit event may remain after deletion"* (§6.4.2) | Any deletion | Cancellation keeps a content-free tombstone row and an audit event with counts only. No media, text or location is kept |
| AI failure *"preserves the encrypted draft and the original recording"* (FR-PUB.20); *"a recording waiting for processing is never discarded"* (§3.6.1) | Drafts | Failure never deletes anything. Only an explicit cancellation, or expiry of abandoned temporary data, does — and the device copy is kept until the report exists |
| *"Delete a local item only after confirmed server receipt"* (FR-COMMON.12) | The device copy | "Receipt" is the successful report creation (API-140), not an upload. The device keeps its draft through processing, review and retries |
| `ClientSubmission` retention *"while the retry window is open"* (§6.4.1) | Server draft row | Replaced: temporary content is deleted on cancellation or expiry. A submitted draft row is kept with its report as the idempotency anchor (FR-PUB.28) |

No source rule had to be broken. The one change is **when** write-once
protection starts: at final submission, not at upload.

## 3. The lifecycle

| Stage | Where the data is | What it is | What can remove it |
|---|---|---|---|
| **A. Device draft** — LOCAL_DRAFT, WAITING_FOR_CONNECTION | The device only, encrypted (LDS-2, LDS-4) | The citizen's unfinished draft | The citizen, on the device |
| **B. Temporary processing data** — UPLOADING … READY_TO_SUBMIT | Server: deletable staging and processing areas, plus database rows of the `ClientSubmission`. The device keeps its copy | Uploaded media, typed text, AI outputs (ASR text, renderings, field confidence) and confirmations. **Not a report, no reference, not sealed evidence** | Cancellation (D) or expiry (E) |
| **C. Sealed report evidence** — after API-140 succeeds | Server: write-once evidence store, bound to the report | The report's protected evidence: every listed photo, the recording and any video, re-verified by SHA-256 and sealed in the creation transaction. Kept with them: the confirmed rendering version and the `RenderingConfirmation` | Only the approved retention policy (TBD, legal), with a tombstone and an audit event |
| **D. Cancelled** | Server: content-free tombstone row and audit event | Nothing of the draft's content | — |
| **E. Expired** | Same as D | Abandoned temporary data, purged after no activity for `PARAKH_TEMPORARY_DATA_TTL_HOURS` (**PROPOSED default 72 h** = the 48-hour submission window plus a 24-hour margin, `DG-57`) | — |

**What cancellation and expiry delete:**

- received chunks and assembled media in the processing area;
- any copy written to the sealed store by a submission attempt that did not commit;
- the typed text and the location;
- every AI-derived field of every rendering version: source text, ASR text, rendering, critical fields and confidence;
- the confirmations.

A queued or running processing job is stopped: its result is discarded when it finishes.

**Expiry is not cancellation.** The device still holds the draft. A later attempt with the same `client_submission_id` reopens the expired tombstone and uploads again. **A cancelled draft cannot be reopened**: the citizen starts a new draft.

## 4. Races, retries and replays

| Situation | Answer |
|---|---|
| Cancel after the report was created | `409 E_ALREADY_SUBMITTED`, with `report_id` and `report_reference`. **Nothing is deleted.** The device shows *Received*, not *Cancelled* |
| Submit after cancellation committed | `409 E_DRAFT_CANCELLED`. No report |
| Cancel twice | `204` both times |
| Submit, cancel and process at the same time | All three lock the `ClientSubmission` row, so one commits first and the others see its result. A processing job that finishes after cancellation stores nothing |
| Submission fails, then automatic retries (`DG-14`) | The device retries for **48 hours** from the citizen's first final-submission attempt. Every retry uses the same `client_submission_id` and submission idempotency key. A replay returns the original report and never a second one |
| 48 hours pass without confirmation (`DG-14`) | Automatic retries stop. The device keeps the draft and tells the citizen plainly that submission was **not confirmed**. Before offering another attempt, it asks the server whether a report already exists: an API-140 replay returns the original report if one does |

## 5. Consequences for the code

| Where | Change |
|---|---|
| Storage | Three areas: **staging** (chunks, deletable), **processing** (assembled items, deletable), **sealed** (write-once) |
| API-132 | Assembles into the processing area, no longer into write-once storage |
| API-140 | Seals each item in the creation transaction: re-reads it, re-checks SHA-256, writes it once, and marks `sealed_at`. The processing copies are removed after the commit |
| New route | `DELETE /citizen/drafts/{client_submission_id}` — cancellation, as in §4. Named by path; no API number exists (`DG-43` rule) |
| Expiry | A management command purges abandoned temporary data after the configured inactivity time (`DG-57`) |
| Processing | Discards its result if the draft was cancelled or expired while it ran |
| Mobile | Keeps the draft on the device until API-140 succeeds; runs the 48-hour retry window; offers Cancel until final submission |
