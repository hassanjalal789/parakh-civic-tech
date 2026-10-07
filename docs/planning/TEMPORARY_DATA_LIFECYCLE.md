# Temporary processing data and evidence sealing — reconciliation

| Field | Value |
|---|---|
| Date | 2026-10-04 (Asia/Karachi); updated 2026-10-06 and 2026-10-07 for the decisions of those days, and 2026-10-07 when the device side was built |
| Owner | Hassan Jalal |
| Decision | `DG-55` — Hassan Jalal's decision of 2026-10-04 on drafts and cancellation. **2026-10-06:** `DG-63` (no app encryption for drafts), `DG-64` (2-day draft lifetime on the device), `DG-65` (explicit submission, status checks). Related: `DG-14` (retry window), `DG-57` (expiry of abandoned temporary data on the server, **PROPOSED**), `DG-67` (**PROPOSED**). **2026-10-07:** `DG-57` approved (72 hours without activity), `DG-67` (a pending submission is deleted 48 hours after Submit), `DG-59` (no backups) |
| Sources reconciled | Mobile SRS v2.4.0 (first written against v2.2.0) FR-PUB.6, FR-PUB.11, FR-PUB.20, FR-PUB.28, FR-PUB.29, FR-COMMON.12, FR-COMMON.13, §3.6.1, §6.4.1, §6.4.2 · Data Model §5.1, §5.7 · API Contract §5, §7.3 |

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

**Added on 2026-10-06:**

7. Incomplete reports may stay on the phone temporarily, **never indefinitely**: an unsubmitted draft and its local media are deleted 2 days after the draft was created (`DG-64`). Editing or reopening never extends that.
8. **Nothing is submitted until the citizen presses Submit after reviewing.** Then a failed submission is retried for 48 hours from the first attempt; retries stop on confirmed success or cancellation; no duplicate report is created; and the server is asked for the submission's status before a retry after a lost response, or before the device deletes data (`DG-65`).
9. Drafts and their media are **not encrypted by the app**; the captured file is used directly (`DG-63`).
10. **Server clean-up timing is separate** from the 48-hour submission retry rule and from the device's 2-day lifetime (`DG-57`).

**Added on 2026-10-07:**

11. **Server clean-up: 72 hours without activity, approved** (`DG-57`). Activity is an upload chunk, an edit, a manifest update, a correction, a confirmation, or the start or end of a processing job, so data still being transferred or processed is never purged because of its age. The two periods are separate rules: neither is derived from the other.
12. **A pending submission is deleted from the phone 48 hours after the first press of Submit** if the server has not confirmed it (`DG-67`). Until then it is shown apart from saved drafts and marked not yet confirmed.
13. **No Parakh data in device or cloud backups** where the platform allows control (`DG-59`).

## 2. What the sources already say, and how each rule is kept

| Source rule | Applies to | How the lifecycle keeps it |
|---|---|---|
| Evidence is **write-once** (DR-6; Data Model §5.7) | Evidence of a report | Sealing happens in the report-creation transaction (§3, stage C). Write-once protection starts there |
| *"Once an item is part of a submitted report it can never be modified or deleted"* (FR-PUB.6, BR-003, BR-022) | Items of a submitted report | A sealed item has no delete path except the approved retention policy |
| *"Review, retake and delete a not-yet-submitted evidence item"* (FR-PUB.6); *"re-recording replaces the draft recording only before submission"* (FR-PUB.11) | Unsubmitted items | Before submission, items are temporary and can be discarded. That is also what makes cancellation possible |
| *"Original audio is immutable while retained"* (§6.4.2) | Original recording | The bytes are never altered at any stage. Deleting an **unsubmitted** recording on cancellation is deletion, not alteration |
| Raw media and audio retention: **TBD — legal or institutional review** (§6.4.1) | Sealed evidence | Unchanged. The legal TBD governs sealed evidence only. Temporary data is deleted sooner, which only shortens retention |
| *"A permitted non-reversible hash, deletion tombstone and audit event may remain after deletion"* (§6.4.2) | Any deletion | Cancellation keeps a content-free tombstone row and an audit event with counts only. No media, text or location is kept |
| AI failure *"preserves the draft and the original recording"* (FR-PUB.20; v2.2.0 said "the encrypted draft"); *"a recording waiting for processing is never discarded"* (§3.6.1) | Drafts | Failure never deletes anything. Only an explicit cancellation, expiry of abandoned temporary data on the server, or the end of the device's 2-day lifetime of an unsubmitted draft does |
| *"Delete the local copy of a submitted item only after confirmed server receipt"* (FR-COMMON.12, v2.3.0) | The device copy | "Receipt" is the successful report creation (API-140), not an upload. The device keeps a submitted draft through processing, review and retries. **An unsubmitted draft is deleted at the end of its 2-day lifetime** (`DG-64`) |
| `ClientSubmission` retention *"while the retry window is open"* (§6.4.1) | Server draft row | Replaced: temporary content is deleted on cancellation or expiry. A submitted draft row is kept with its report as the idempotency anchor (FR-PUB.28) |

No source rule had to be broken. The one change is **when** write-once
protection starts: at final submission, not at upload.

## 3. The lifecycle

| Stage | Where the data is | What it is | What can remove it |
|---|---|---|---|
| **A. Device draft** — LOCAL_DRAFT, WAITING_FOR_CONNECTION | The device only, app-private, **not encrypted by the app** (LDS-2, LDS-4; `DG-63`), kept out of backups (`DG-59`). The media are the capture files themselves | The citizen's unfinished draft | The citizen, on the device; or the **2-day lifetime** — `expires_at = created_at + 48 h` — unless Submit was pressed (`DG-64`). After Submit: confirmed receipt, cancellation, or **48 hours from the first press of Submit** — `submission_expires_at` (`DG-67`) |
| **B. Temporary processing data** — UPLOADING … READY_TO_SUBMIT | Server: deletable staging and processing areas, plus database rows of the `ClientSubmission`. The device keeps its copy | Uploaded media, typed text, AI outputs (ASR text, renderings, field confidence) and confirmations. **Not a report, no reference, not sealed evidence** | Cancellation (D) or expiry (E) |
| **C. Sealed report evidence** — after API-140 succeeds | Server: write-once evidence store, bound to the report | The report's protected evidence: every listed photo, the recording and any video, re-verified by SHA-256 and sealed in the creation transaction. Kept with them: the confirmed rendering version and the `RenderingConfirmation` | Only the approved retention policy (TBD, legal), with a tombstone and an audit event |
| **D. Cancelled** | Server: content-free tombstone row and audit event | Nothing of the draft's content | — |
| **E. Expired** | Same as D | Abandoned temporary data, purged after **72 hours without activity** (`PARAKH_TEMPORARY_DATA_TTL_HOURS = 72`, approved 2026-10-07, `DG-57`). An upload still arriving or a job still running is activity, so it is never purged because of its age. **This period is a separate rule** from the 48-hour submission retry window and from the device's 2-day draft lifetime, and is not derived from either (Hassan Jalal, 2026-10-06 and 2026-10-07) | — |

**What cancellation and expiry delete:**

- received chunks and assembled media in the processing area;
- any copy written to the sealed store by a submission attempt that did not commit;
- the typed text and the location;
- every AI-derived field of every rendering version: source text, ASR text, rendering, critical fields and confidence;
- the confirmations.

A queued or running processing job is stopped: its result is discarded when it finishes.

**Expiry is not cancellation.** While its lifetime lasts, the device still holds the draft. A later attempt with the same `client_submission_id` reopens the expired tombstone and uploads again. **A cancelled draft cannot be reopened**: the citizen starts a new draft.

## 4. Races, retries and replays

| Situation | Answer |
|---|---|
| Cancel after the report was created | `409 E_ALREADY_SUBMITTED`, with `report_id` and `report_reference`. **Nothing is deleted.** The device shows *Received*, not *Cancelled* |
| Submit after cancellation committed | `409 E_DRAFT_CANCELLED`. No report |
| Cancel twice | `204` both times |
| Submit, cancel and process at the same time | All three lock the `ClientSubmission` row, so one commits first and the others see its result. A processing job that finishes after cancellation stores nothing |
| Submission fails, then automatic retries (`DG-14`) | The device retries for **48 hours** from the citizen's first final-submission attempt. Every retry uses the same `client_submission_id` and submission idempotency key. A replay returns the original report and never a second one |
| 48 hours pass without confirmation (`DG-67`, 2026-10-07; the earlier rule of `DG-14` kept the draft) | Automatic retries stop and **the pending submission and its media are deleted from the phone**. Where the server can be reached, the device first asks for the status: a report that did arrive is shown with its reference. The device then asks the server to drop its temporary copy; **a report that exists is kept** (`E_ALREADY_SUBMITTED`) and appears under My Reports. ~~The device keeps the draft and tells the citizen plainly that submission was not confirmed~~ |
| Submit never pressed (`DG-64`, `DG-65`) | **Nothing is ever submitted.** At `created_at + 48 h` the device deletes the draft and its media. The server's temporary data for it expires on its own clock (`DG-57`); if the device is online, it also asks the server to cancel the draft |
| A submission's response was lost (`DG-65`) | The device knows Submit was pressed: it records that **before** sending the first request, so a lost response is never mistaken for an unsubmitted draft. Before the next attempt it asks the server for the draft's status: `submitted` → an API-140 replay with the same key returns the reference; `active` → retry; `cancelled` → stop |
| Cancel while a submission is unconfirmed (`DG-65`) | Retries stop at once. The device deletes its copy only after the server answers: `204` (cancelled) or `409 E_ALREADY_SUBMITTED` (the report exists; its reference is shown) |

## 5. Consequences for the code

| Where | Change |
|---|---|
| Storage | Three areas: **staging** (chunks, deletable), **processing** (assembled items, deletable), **sealed** (write-once) |
| API-132 | Assembles into the processing area, no longer into write-once storage |
| API-140 | Seals each item in the creation transaction: re-reads it, re-checks SHA-256, writes it once, and marks `sealed_at`. The processing copies are removed after the commit |
| New route | `DELETE /citizen/drafts/{client_submission_id}` — cancellation, as in §4. Named by path; no API number exists (`DG-43` rule) |
| Expiry | A management command purges abandoned temporary data after the configured inactivity time (`DG-57`) |
| Processing | Discards its result if the draft was cancelled or expired while it ran |
| Mobile | Keeps a submitted draft on the device until API-140 succeeds; deletes an unsubmitted draft and its media at `created_at + 48 h`; submits only after Submit; checks the status before a retry or a deletion; runs the 48-hour retry window; offers Cancel until final submission. **Implemented 2026-10-07** in `mobile/src/storage/` and `mobile/src/services/submissionQueue.ts` (`T-047`, `T-128`, `T-052`); no screen uses them yet |
| Settings | `PARAKH_TEMPORARY_DATA_TTL_HOURS` no longer has to be at least the retry window: the two rules are separate (2026-10-06) |
