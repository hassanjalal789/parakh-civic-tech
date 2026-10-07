# Citizen reporting — Phase 1 contract (PROPOSED)

| Field | Value |
|---|---|
| Status | **Implemented in the development backend and tested.** Routes, rules and the error catalogue follow the sources and Hassan Jalal's decisions of 2026-10-04 and 2026-10-06. **Body shapes, the extra error codes and the hash formats below are PROPOSED** (`T-036`) |
| Date | 2026-10-04, revised the same day for the owner decisions `DG-47`, `DG-53`, `DG-54`, `DG-55`, `DG-14`, `DG-56`; revised 2026-10-06 for `DG-61`, `DG-62`, `DG-65` and the separate server clean-up timing |
| Tasks | `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061`, `T-063`, `T-122`…`T-125`, `T-127` |
| Code | [`backend/parakh/drafts/`](../../backend/parakh/drafts/), [`backend/parakh/reports/`](../../backend/parakh/reports/) |
| Sources | Mobile SRS **v2.3.0** §3.4.2, §3.6, §4.3, §5.2, §6.2.8 · `SRS/API_CONTRACT.md` §5–§11 · `SRS/DATA_MODEL_AND_IDENTITY_SCHEMA.md` §5 · [`docs/planning/TEMPORARY_DATA_LIFECYCLE.md`](../planning/TEMPORARY_DATA_LIFECYCLE.md) |

The sources fix the routes, the rules and the nine catalogue errors. They do
not fix request and response bodies. This page records what the code does.
Nothing here is an approved requirement unless it names an owner decision.

## 1. Routes

All routes use the **Citizen-authenticated** transport class: a citizen bearer token, and no `X-Acting-Role-Assignment-ID`. A staff session gets `403`.

| ID | Route | Purpose |
|---|---|---|
| API-130 | `POST /citizen/drafts` | Open a draft, edit it before submission, or reopen an expired one. Idempotent on `client_submission_id` |
| API-131 | `POST /citizen/drafts/{client_submission_id}/evidence` | One evidence chunk |
| API-132 | `POST /citizen/drafts/{client_submission_id}/evidence/complete` | Finalise the manifest; start processing |
| API-133 | `GET /citizen/drafts/{client_submission_id}` | Poll the draft |
| *(no number, `DG-43`)* | `DELETE /citizen/drafts/{client_submission_id}` | **Cancel** before final submission (`DG-55`) |
| API-134 | `GET /citizen/drafts/{client_submission_id}/rendering` | The **active** rendering version |
| *(no number, `DG-43`)* | `POST /citizen/drafts/{client_submission_id}/rendering/corrections` | The reporter's correction → a new version |
| API-135 | `POST /citizen/drafts/{client_submission_id}/rendering/confirm` | Confirm one exact version |
| API-140 | `POST /citizen/reports` | Create the `CivicReport` and seal its evidence |
| API-150 | `GET /citizen/reports` | Own reports, plus active unsent server-side drafts, kept separate |
| API-151 | `GET /citizen/reports/{report_id}` | Own report detail |
| *(no number, `DG-43`)* | `GET /citizen/reports/{report_id}/evidence/{evidence_id}` | Own sealed evidence bytes, including the original recording |
| *(no number, `DG-43`)* | `GET /citizen/reports/summary` | Counts for CIT-06 |
| *(no number, `DG-43`)* | `GET /categories` | The six category keys for CIT-07 |

Every response on a draft or report route is `Cache-Control: no-store`. No route logs a request body.

## 2. Evidence rules — owner decisions of 2026-10-04

| Rule | Value | Decision |
|---|---|---|
| Photos per report | **At least 1, at most 3**, live from the in-app camera | `DG-47` |
| Video | **At most one**, live, **up to 60 seconds**. Optional, and it never counts as or replaces a photo | `DG-54` |
| Recording | Exactly one `voice_original` for a voice draft; none for a typed draft | SRS FR-PUB.9, FR-PUB.12 |

**Video encoding and size — routine technical choices, recorded:**

- **Codec and container:** H.264 video with AAC audio. The container is MP4 (`video/mp4`, as Android records) or QuickTime (`video/quicktime`, as iOS records).
- **Recording settings:** 720p. The device caps a recording at 60 seconds and 40 MiB.
- **Server checks:**
  - it parses the container header (`moov/mvhd`) for the duration and refuses anything over **60 s + 0.5 s** container-rounding tolerance;
  - it requires a video track (`vide`);
  - it refuses items over 40 MiB.
- **A recording that contains a video track is refused.**

## 3. Bodies

### API-130 request

```json
{
  "client_submission_id": "uuid generated on the device",
  "category": "water | road | drainage | streetlight | waste | other",
  "description_mode": "voice | typed",
  "typed_description": "only when description_mode = typed; the reporter's own words",
  "captured_at": "ISO 8601 with offset — the operative time (BR-026)",
  "location": { "latitude": 31.52037, "longitude": 74.358749, "accuracy_m": 12.5, "source": "device | manual", "unverified": false }
}
```

- A manual pin is always stored as `unverified` (FR-PUB.24).
- **Repeats:**
  - the same id and the same body is a replay (`200`);
  - a different body, before a report exists, is an edit;
  - changing the typed text after the manifest is complete reopens the manifest, so the text is rendered again.
- **When an edit is refused (`409 E_STALE_STATE`):**
  - after the manifest is complete, `description_mode` cannot change;
  - after a report exists, nothing can change.
- **Expired and cancelled drafts:**
  - an **expired** draft is reopened by its own id: it becomes active again, and everything is uploaded again;
  - a **cancelled** draft gets `409 E_DRAFT_CANCELLED`.
- An id that belongs to another account gets the uniform `404`.

### Draft response (API-130, API-132, API-133)

- `client_submission_id`, **`lifecycle`** (`active | submitted | cancelled | expired`), `pipeline_state`, `reporter_subject_type`, `reporter_account_id`
- `category`, `description_mode`, `typed_description`, and `location` (`null` once purged)
- `captured_at` and `received_at`, kept separate
- `evidence[]`: `evidence_id`, `kind`, `status`, `byte_size`, `duration_seconds`, `received_chunks`, `chunk_count`
- `manifest_complete`, and `rendering` (API-134 shape, or `null`)
- `submitted`, and `temporary_data_expires_at` (`null` once submitted)

**A draft response never contains a report reference** (`TEST-API-016`).

### API-131 request

```json
{
  "evidence_id": "uuid generated on the device, one per captured item",
  "kind": "photo | voice_original | video",
  "mime_type": "image/jpeg | image/png | audio/mp4 | audio/m4a | audio/aac | ... | video/mp4 | video/quicktime",
  "byte_size": 108000,
  "sha256": "hex SHA-256 of the whole item, computed at capture",
  "captured_at": "ISO 8601",
  "chunk_index": 0,
  "chunk_count": 3,
  "chunk_sha256": "hex SHA-256 of this chunk",
  "chunk_base64": "the chunk bytes"
}
```

- The server recomputes the chunk hash **before** storing anything. A mismatch gets `422 E_CAPTURE_INTEGRITY`.
- The same chunk again is a replay; a different chunk at the same index gets `422`.
- The item's metadata must be identical on every chunk.
- **Item size limits:**

  | Kind | Limit |
  |---|---|
  | photo | 10 MiB |
  | recording | 20 MiB |
  | video | 40 MiB |

### API-132 request

```json
{
  "manifest": [{ "evidence_id": "uuid", "kind": "photo", "sha256": "hex", "byte_size": 108000 }],
  "manifest_sha256": "hex"
}
```

The server checks, in order:

1. **Counts**:
   - the recording rule; on failure `400`, field `manifest.voice_original`;
   - **at least one photo**; on failure `422 E_EVIDENCE_REQUIRED`, with `min_photos` and `max_photos`;
   - **at most three photos**; on failure `400`, field `manifest.photo_count`;
   - **at most one video**; on failure `400`, field `manifest.video_count`.
2. **Missing items or chunks**: `409 E_UPLOAD_INCOMPLETE` with `missing_chunks`.
3. **Each item**:
   - assembled, with SHA-256 recomputed: `422 E_CAPTURE_INTEGRITY`;
   - magic bytes and container checks, including track types: `400`, field `evidence_type`;
   - video duration: `400`, field `video_duration`, with `max_seconds`.
4. **The manifest hash**: `422 E_CAPTURE_INTEGRITY` with `reason: "manifest"`.

Then:

- Assembled items go to the **processing area**: **temporary processing data, not sealed evidence** (`DG-55`).
- Items received but not listed are discarded. That covers a retake, or a delete before submission.
- A **voice** draft queues a rendering of the recording. A **typed** draft queues a rendering of the typed text (`DG-53`).
- A replay of the same manifest after a processing failure queues a new attempt: the citizen's "Retry".

### API-134 response

```json
{
  "voice_transcription_artifact_id": "uuid",
  "client_submission_id": "uuid",
  "source_kind": "voice | typed",
  "rendering_version": 1,
  "rendering_content_hash": "hex over all three texts (§7), or null until COMPLETED",
  "source_language": "ur | en | und, or null until COMPLETED",
  "transcription": "the reporter's own words as text, or null until COMPLETED",
  "urdu_civic_rendering": "Urdu-script text, or null until COMPLETED",
  "english_rendering": "English text, or null until COMPLETED",
  "text_origins": { "transcription": "reporter | ai_transcription | ai_translation | ai_rendering", "ur": "…", "en": "…" },
  "ai_generated_texts": { "transcription": false, "ur": false, "en": true },
  "fields": [{ "key": "location", "value": "…", "confidence": 0.4, "low_confidence": true }],
  "overall_confidence": 0.6,
  "processing_status": "QUEUED | PROCESSING | COMPLETED | FAILED | REVIEW_REQUIRED",
  "failure_code": null,
  "origin": "ai | reporter_correction",
  "supersedes_rendering_version": null,
  "ai_generated": true,
  "simulated": true
}
```

- **Three texts, one confirmation (`DG-62`).** Every version holds the **transcription**, the **Urdu text** and the **English text**. The reporter reviews and confirms all three together.
- **`text_origins`** says, per text, whether the reporter wrote it (`reporter`) or AI produced it. `ai_generated_texts` is the per-text AI label (FR-PUB.17). The top-level `ai_generated` is `true` while any text is AI-produced.
- **A typed text is kept verbatim** as the transcription (`DG-61`). It is stored after Unicode NFC normalisation, with line endings and outer whitespace normalised. The version in the typed language is that same text, marked `reporter`; the other language is an AI translation.
- **`source_asr_text`, the raw intermediate speech-recognition output, is never present** on any citizen route (FR-PUB.16). A typed source has no ASR step at all.
- **Complete or nothing.** A version whose output lacks any of the three texts is `FAILED` with `failure_code: "INCOMPLETE_OUTPUT"`. No text is invented to fill the gap.
- **Versions made before 2026-10-06 (R-007).** They hold an Urdu text with an Urdu-only hash, and their confirmations name no texts. **Neither can become a report.**
  - Migration `0004_regenerate_legacy_renderings` gives each unsubmitted active draft with such a version a new `QUEUED` version that supersedes it. The old version and its confirmation are kept unchanged as history, and the reporter must confirm the new version afresh.
  - The queued version is processed by `manage.py process_queued_renderings`, or when the device replays its manifest (API-132), which also starts any queued version that never started.
  - **A submitted report is never touched**, and its API-140 replay still returns the original report.
- Fields under `PARAKH_LOW_CONFIDENCE_THRESHOLD` are marked (default 0.6; no source value exists).

### Correction, and API-135 confirmation

**Correction** — `POST …/rendering/corrections`:

```json
{
  "voice_transcription_artifact_id": "uuid of the version being corrected",
  "rendering_version": 1,
  "rendering_content_hash": "its hash",
  "transcription": "optional",
  "urdu_civic_rendering": "optional",
  "english_rendering": "optional",
  "derive_from": "optional: transcription | ur | en — one of the texts sent",
  "corrected_fields": ["location"]
}
```

- At least one text. The base version must be active, and its hash must match; otherwise `409`.
- **A corrected text becomes the reporter's own (`reporter`), and AI never overwrites it.**
- **`derive_from`** asks the server to re-derive the other language texts from the named text. It replaces only texts whose origin is AI, never the transcription, and never a text the reporter wrote. The result is a new version, `QUEUED` until processing finishes, labelled AI-generated, which the reporter must confirm. Without `derive_from`, the other texts are kept unchanged.
- **A typed report's transcription is the typed text.** Changing it here gets `400` (`field: "transcription"`); the reporter changes the draft's text instead, which starts a new rendering.
- A correction after the report exists gets `409`. **A confirmed or submitted version is never changed by any process.**

**Confirmation:** the **nine** fields, and the six checks of API Contract §6.2. The ninth, `reviewed_texts`, must list exactly `transcription`, `ur` and `en`, in any order; anything else gets `400` (`field: "reviewed_texts"`). It is stored with the confirmation. A superseded version gets `409 E_RENDERING_SUPERSEDED`; a hash mismatch gets `409 E_RENDERING_HASH_MISMATCH`. A replay of the key returns the original confirmation.
- **Both** refuse a cancelled (`E_DRAFT_CANCELLED`) or expired (`E_DRAFT_EXPIRED`) draft.

### Cancellation — `DELETE /citizen/drafts/{id}` (`DG-55`)

| Case | Answer |
|---|---|
| Before final submission | `204`. Processing stops. These are deleted: chunks, assembled media, any copy a submission attempt sealed without committing, every rendering version, the confirmations, the typed text and the location. A content-free row (lifecycle `cancelled`) and a `draft_cancelled` audit event with counts remain |
| Again | `204` |
| After a successful submission | `409 E_ALREADY_SUBMITTED` with `report_id` and `report_reference`. **Nothing is deleted** |
| Another account's draft | The uniform `404` |

A processing job that finishes after cancellation stores nothing.

### API-140

The request is `{"client_submission_id": "uuid"}` plus the idempotency header (§5). One transaction does all of the following, or none of it:

- checks that the draft is not cancelled or expired;
- checks the confirmation of the **current** active version, for voice and typed drafts alike. That version must hold all three texts under the current three-text hash (else `409 E_RENDERING_INCOMPLETE`), and the confirmation must name all three texts (R-007);
- checks **1–3 photos**, again, and that the assembled items still match the last completed manifest hash;
- creates the `CivicReport` in `SUBMITTED` and issues the reference;
- binds the rendering;
- writes ownership and the first timeline entry;
- **seals** each item: reads it back, re-checks SHA-256 and writes it once to the sealed store;
- appends the audit event.

After the commit, the processing copies are removed. An item uploaded after the last manifest and never completed is **discarded at submission**: it is never attached, and no temporary data outlives the report.

| Case | Answer |
|---|---|
| Success | `201 {report_id, report_reference, state: "SUBMITTED", created_at}` |
| Replay, with the same or a new key, after the report exists | `200`, the **original** report |
| Key already used for another draft | `409 E_IDEMPOTENCY_CONFLICT` |
| No confirmation of the current version | `422 E_RENDERING_NOT_CONFIRMED` |
| Fewer than one or more than three photos | `422 E_EVIDENCE_REQUIRED` |
| Manifest not complete | `409 E_UPLOAD_INCOMPLETE` |
| Cancelled or expired draft | `409 E_DRAFT_CANCELLED` / `E_DRAFT_EXPIRED` |

`report_reference` looks like `PRK-7Q2X-91KD`: random, non-sequential, Crockford base32. `evidence_completeness` is derived on the server. Every new report has photos, so it is `photographic`.

### API-150 / API-151

- API-150 returns `{"reports": [...], "unsent_drafts": [...]}`. Unsent drafts are **active** server-side drafts only, and carry no reference.
- API-151 `description` holds exactly what the reporter confirmed: `transcription`, `urdu_civic_rendering`, `english_rendering`, `source_language` and `text_origins`, with `rendering_status: "reporter_confirmed"` and `bilingual: true`. A report made before 2026-10-06 has `bilingual: false` and `null` for the transcription and the English text: it is shown as it was, never filled in. For a typed report it also holds the reporter's `typed_description`.
- Evidence entries include `duration_seconds`. Only **sealed** items are listed and served.
- Not-owned and not-found get the same `404`.

## 4. Retry window, temporary data and expiry

| Rule | Value | Where |
|---|---|---|
| **Submission** | **Only after the reporter presses Submit** (`DG-65`). Uploads and processing before that are temporary, not submission | Device |
| **Automatic submission retry** | **48 hours from the citizen's first final-submission attempt, the first press of Submit** (`submission_expires_at = submission_requested_at + 48 h`). Same identifier and idempotency key; retries stop on confirmed success or cancellation. While pending, the item is shown as a pending submission, not yet confirmed. **When the 48 hours end without confirmation, the pending submission is deleted from the phone**, after a last status check where the server can be reached, and the device asks the server to cancel the draft (`DELETE /citizen/drafts/{id}`). The server keeps any report that exists (`409 E_ALREADY_SUBMITTED`) | Device (`DG-14`, `DG-65`, `DG-67`). The server answers every replay with the original report |
| **Status check** | Before a retry after a lost response, and before deleting the local copy of a draft whose Submit was pressed: `GET /citizen/drafts/{id}`. `lifecycle: "submitted"` means the report exists, and an API-140 replay with the same key returns it; `active` means retry; `cancelled` means stop. **At the end of the 48 hours the copy is deleted even when the server cannot be reached** | Device (`DG-65`, `DG-67`) |
| **Local draft lifetime** | An unsubmitted draft and its local media are deleted on the device at `created_at + 48 h`, fixed at creation (`DG-64`) | Device |
| **Expiry of abandoned temporary data** | Unsubmitted temporary data with **no activity for 72 hours** is purged, the same way a cancellation purges it, by `manage.py purge_temporary_drafts`. Activity is an upload chunk, an edit, a manifest update, a correction, a confirmation, or the start or end of a processing job; each restarts the 72 hours, so an upload still arriving or a job still running is never purged because of its age. A submitted report and its sealed evidence are never purged. **A separate rule from the device's 48-hour retry window and draft lifetime, not derived from them** (Hassan Jalal, 2026-10-06 and 2026-10-07) | Server. **Approved by Hassan Jalal, 2026-10-07 (`DG-57`)**. `PARAKH_TEMPORARY_DATA_TTL_HOURS = 72`; the environment may override it; start-up refuses a value below 1 |

## 5. Idempotency headers — `DG-10` open

API-135 reads `X-Confirmation-Idempotency-Key`, and API-140 reads `X-Submission-Idempotency-Key`. Each falls back to `X-Idempotency-Key`. The two keys are stored in separate unique columns. They must be UUIDv4.

## 6. Error codes

| Code | HTTP | Status |
|---|---|---|
| `E_RENDERING_SUPERSEDED`, `E_RENDERING_HASH_MISMATCH`, `E_RENDERING_NOT_CONFIRMED`, `E_STALE_STATE`, `E_CAPTURE_INTEGRITY` | as in API Contract §11 | **Specified** |
| `E_EVIDENCE_REQUIRED` | 422 | **Specified. Applies again** since `DG-47`. Carries `min_photos` and `max_photos` |
| `E_NOT_FOUND` | 404 | The uniform not-found / not-owned answer |
| `E_VALIDATION` | 400 | PROPOSED, with a `field`. Submitted values are never echoed. A wrong type in any field, an impossible calendar date or an unreadable media header is a `400`, never a `500`. A test sweeps every field of every route with wrong types |
| `E_UPLOAD_INCOMPLETE` | 409 | **PROPOSED** |
| `E_IDEMPOTENCY_CONFLICT` | 409 | **PROPOSED** |
| `E_DRAFT_CANCELLED` | 409 | **PROPOSED** (`DG-55`) |
| `E_DRAFT_EXPIRED` | 409 | **PROPOSED** (`DG-57`) |
| `E_ALREADY_SUBMITTED` | 409 | **PROPOSED** (`DG-55`). Carries `report_id` and `report_reference` |
| `E_TRANSITION_NOT_ALLOWED` | 409 | **PROPOSED.** The state machine below; no route reaches it yet |
| `E_RENDERING_INCOMPLETE` | 409 | **PROPOSED** (R-007, 2026-10-06). The version lacks the transcription or the English text, or its hash is not the three-text hash — a version made before 2026-10-06. API-135, corrections and API-140 refuse it; the device fetches the draft again, and the new version is prepared in both languages |

## 7. Hash formats — PROPOSED

- **`rendering_content_hash`** *(revised 2026-10-06, `DG-62`)*: SHA-256 of the UTF-8 bytes of the JSON object `{"en":…,"transcription":…,"ur":…}`. The keys are sorted, there are no spaces, non-ASCII is unescaped, and each text is canonical: NFC, `\r\n` and `\r` turned into `\n`, and leading and trailing whitespace removed. Example: `{"en":"Water","transcription":"پانی","ur":"پانی"}` → `f73a2c3b62afc52fe9e12fc02509e8f6f76cdc7ebdd4a4065c1a2ef4fbb52c75`. Before 2026-10-06 it covered the Urdu text alone.
- **`manifest_sha256`:** SHA-256 over one line `evidence_id:kind:sha256:byte_size\n` per item, sorted by `evidence_id`.
- **Item and chunk hashes:** SHA-256 of the raw bytes.

## 8. Storage areas (`DG-55`)

| Area | Holds | Deletable |
|---|---|---|
| staging | Received chunks | Yes |
| processing | Assembled items of an unsubmitted draft — temporary processing data | Yes: on retake, cancellation, expiry, and after sealing |
| evidence (sealed) | A report's evidence, written once by API-140 | **No.** Only a copy that no report uses — an attempt that did not commit — is removed on cancellation |

Only a local development store exists. Production refuses to start without a write-once object store.

## 9. The report state machine (`DG-56`)

`backend/parakh/reports/lifecycle.py` holds the only transition table: SRS v2.3.0 §6.2.8 (unchanged from v2.2.0).

- **The required order:** Street Representative verification (`SUBMITTED → UNDER_VERIFICATION → VERIFIED`, or `UNDER_VERIFICATION → UC_REVIEW` when verification fails), then UC Officer review and acceptance (`UC_REVIEW → ACCEPTED`), then contractor assignment.
- **Refused:** every skip, every step by the wrong role, and every prohibited transition in §6.2.8.
- **Guards:** every step checks `state_version` and writes the timeline and an audit event.
- No staff route calls it yet (Phase 3).

## 10. The development AI adapter — SIMULATED (`DG-48`)

- `SimulatedRenderingAdapter` does not listen to the recording and does not translate. For a recording it returns a fixed Urdu text starting `[SIMULATED · نقلی متن]` (the transcription and the Urdu text) and a fixed English text. For typed text it keeps the text and fills the other language with a labelled echo starting `[SIMULATED · نقلی ترجمہ]` or `[SIMULATED translation — not a real translation]`; re-derivations do the same. Its language guess comes from the script alone, so it cannot tell Roman Urdu from English.
- Every artefact it makes carries `simulated: true`. It refuses to load outside development and test.
- Processing runs **inline**. A queue worker replaces this with `T-023`.

## 11. Not done here

- API-152…API-154, notifications and API-156.
- Staff routes, API-136 transcript review and API-141.
- A real AI provider (`DG-16`); PostgreSQL / PostGIS and a queue worker (`T-023`); a write-once object store; `GET /geo/reverse` (`DG-30`).
- Scheduling of the expiry command, which needs the worker.
- **Binary chunk transport.** JSON with base64 adds about a third to every upload — notable for a 40 MiB video on a weak connection. A raw-bytes variant of API-131 is the planned improvement.
- Concurrency under real parallel load. SQLite serialises writes; row locks and unique constraints back the rules, but no parallel test has run.
