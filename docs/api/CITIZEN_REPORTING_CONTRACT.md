# Citizen reporting — Phase 1 contract (PROPOSED)

| Field | Value |
|---|---|
| Status | **Implemented in the development backend and tested.** Routes, rules and the error catalogue follow the sources. **Body shapes, the extra error codes and the hash formats below are PROPOSED** (`T-036`) |
| Date | 2026-10-04 |
| Tasks | `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061`, `T-063` |
| Code | [`backend/parakh/drafts/`](../../backend/parakh/drafts/), [`backend/parakh/reports/`](../../backend/parakh/reports/) |
| Sources | `SRS/API_CONTRACT.md` §5–§11, R.3, R.5 · `SRS/DATA_MODEL_AND_IDENTITY_SCHEMA.md` §5 · Mobile SRS §3.4.2, §3.6, §4.3, §5.2 |

The sources fix the routes, the rules and the nine catalogue errors. They do
not fix request and response bodies. This page records what the code does.
Nothing here is an approved requirement.

## 1. Routes

All routes use the **Citizen-authenticated** transport class: a citizen bearer token, and no `X-Acting-Role-Assignment-ID`. A staff session gets `403`.

| ID | Route | Purpose |
|---|---|---|
| API-130 | `POST /citizen/drafts` | Open a draft, or edit it before submission. Idempotent on `client_submission_id` |
| API-131 | `POST /citizen/drafts/{client_submission_id}/evidence` | One evidence chunk |
| API-132 | `POST /citizen/drafts/{client_submission_id}/evidence/complete` | Finalise the manifest |
| API-133 | `GET /citizen/drafts/{client_submission_id}` | Poll the draft |
| API-134 | `GET /citizen/drafts/{client_submission_id}/rendering` | The **active** rendering version |
| *(no number, `DG-43`)* | `POST /citizen/drafts/{client_submission_id}/rendering/corrections` | The reporter's correction → a new version |
| API-135 | `POST /citizen/drafts/{client_submission_id}/rendering/confirm` | Confirm one exact version |
| API-140 | `POST /citizen/reports` | Create the `CivicReport` |
| API-150 | `GET /citizen/reports` | Own reports, plus unsent server-side drafts, kept separate |
| API-151 | `GET /citizen/reports/{report_id}` | Own report detail |
| *(no number, `DG-43`)* | `GET /citizen/reports/{report_id}/evidence/{evidence_id}` | Own evidence bytes, including the original recording |
| *(no number, `DG-43`)* | `GET /citizen/reports/summary` | Counts for CIT-06 |
| *(no number, `DG-43`)* | `GET /categories` | The six category keys for CIT-07 |

Every response on a draft or report route is `Cache-Control: no-store`. No route logs a request body.

## 2. Bodies

### API-130 request

```json
{
  "client_submission_id": "uuid generated on the device",
  "category": "water | road | drainage | streetlight | waste | other",
  "description_mode": "voice | typed",
  "typed_description": "only when description_mode = typed; the reporter's own words",
  "captured_at": "ISO 8601 with offset — the operative time (BR-026)",
  "location": {
    "latitude": 31.52037,
    "longitude": 74.358749,
    "accuracy_m": 12.5,
    "source": "device | manual",
    "unverified": false
  }
}
```

- A manual pin is always stored as `unverified` (FR-PUB.24).
- A repeat with the same id and the same body returns the draft (`200`).
- A repeat with a different body, before a report exists, is an edit: last write wins.
- After the manifest is complete, `description_mode` cannot change. After a report exists, nothing can change. Both get `409 E_STALE_STATE`.
- An id that belongs to another account gets the uniform `404`.

### Draft response (API-130, API-132, API-133)

The response holds:

- `client_submission_id`, `pipeline_state`, `reporter_subject_type`, `reporter_account_id`;
- `category`, `description_mode`, `typed_description`, `location`;
- `captured_at` and `received_at`, kept separate;
- `evidence[]` — `evidence_id`, `kind`, `status`, `byte_size`, `received_chunks`, `chunk_count`;
- `manifest_complete`;
- `rendering`, the active rendering in the API-134 shape, or `null`;
- `submitted` (a boolean) and `retry_window_ends_at`.

**A draft response never contains a report reference** (`TEST-API-016`). When `submitted` is `true`, an API-140 replay returns the reference.

### API-131 request

```json
{
  "evidence_id": "uuid generated on the device, one per captured item",
  "kind": "photo | voice_original",
  "mime_type": "image/jpeg | image/png | audio/mp4 | audio/m4a | audio/aac | ...",
  "byte_size": 108000,
  "sha256": "hex SHA-256 of the whole item, computed at capture",
  "captured_at": "ISO 8601",
  "chunk_index": 0,
  "chunk_count": 3,
  "chunk_sha256": "hex SHA-256 of this chunk",
  "chunk_base64": "the chunk bytes"
}
```

- The server recomputes the chunk hash **before** storing anything. A mismatch gets `422 E_CAPTURE_INTEGRITY` with `evidence_ids` and `chunk_index`.
- The same chunk again is a replay. A different chunk at the same index gets `422`.
- The item's metadata must be identical on every chunk.
- Response: `{evidence_id, chunk_index, received_chunks, chunk_count, all_chunks_received}`.
- Video is not accepted in Phase 1 (`DG-54`).

### API-132 request

```json
{
  "manifest": [{ "evidence_id": "uuid", "kind": "voice_original", "sha256": "hex", "byte_size": 108000 }],
  "manifest_sha256": "hex"
}
```

The server checks, in order:

1. **Missing items or chunks.** It answers `409 E_UPLOAD_INCOMPLETE` with `evidence_ids` and `missing_chunks`. The client resumes the upload.
2. **Each item.** It assembles the item and recomputes its SHA-256, which must equal the capture hash. A mismatch gets `422 E_CAPTURE_INTEGRITY` with `evidence_ids`. That item's chunks are discarded, so the client re-uploads it.
3. **The manifest.** It recomputes the manifest hash (§3). A mismatch gets `422 E_CAPTURE_INTEGRITY` with `reason: "manifest"`.

Then:

- A **voice** draft lists exactly one `voice_original`. A **typed** draft lists none. Photos are optional (`DG-09`).
- Items received but not listed are discarded. This is how a retake or a delete before submission works (FR-PUB.6).
- **Replay** of the same manifest returns the draft. If the last processing attempt failed, the replay queues a new attempt. That is the reporter's "Retry".
- Assembled items go to **write-once** storage. Items that arrived intact stay assembled even when another item fails.

### API-134 response

```json
{
  "voice_transcription_artifact_id": "uuid",
  "client_submission_id": "uuid",
  "rendering_version": 1,
  "rendering_content_hash": "hex, or null until COMPLETED",
  "urdu_civic_rendering": "Urdu-script text, or null until COMPLETED",
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

- **`source_asr_text` is never present** on any citizen route (FR-PUB.16).
- A field whose confidence is under `PARAKH_LOW_CONFIDENCE_THRESHOLD` (default 0.6; no source value exists) is marked `low_confidence`. The client asks a targeted question about it (FR-PUB.18).

### Correction request

The request carries:

- `voice_transcription_artifact_id`, `rendering_version` and `rendering_content_hash` of the version being corrected;
- the full corrected `urdu_civic_rendering`;
- `corrected_fields[]`.

The checks are the same as for a confirmation: a superseded version or a hash mismatch gets `409`. The response is `201` with the new active version. The previous version is kept and linked by `supersedes_artifact_id` (FR-PUB.19).

### API-135 request

These are the eight fields of API Contract §6.1:

- `voice_transcription_artifact_id`, `client_submission_id`, `rendering_version`, `rendering_content_hash`;
- `reporter_subject_type` and `reporter_account_id` — both must equal the session's values, or the request gets `400`;
- `confirmed_at` — advisory only;
- the idempotency header (§4).

The six checks, in order:

1. **Ownership.** Another account's draft gets the uniform `404`.
2. **A replay** of the key with the same body returns the original confirmation (`200`). The key with a different body gets `409 E_IDEMPOTENCY_CONFLICT`.
3. **A report already exists.** The original confirmation is returned.
4. **The active version.** A version that is not active gets `409 E_RENDERING_SUPERSEDED`.
5. **A finished rendering.** A rendering that is not COMPLETED gets `409 E_STALE_STATE`.
6. **The content hash.** A different hash gets `409 E_RENDERING_HASH_MISMATCH`.

The server never accepts an older version and never moves a confirmation to a newer one. On a `409`, the client re-fetches API-134 (FR-PUB.22).

### API-140

The request is `{"client_submission_id": "uuid"}` plus the idempotency header (§4). One transaction does all of the following, or none of it:

- checks the confirmation of the **current** active version, or that the typed text exists;
- creates the `CivicReport` in `SUBMITTED`;
- issues the reference;
- binds the confirmed rendering;
- writes `ReportOwnership`;
- writes the first timeline entry;
- links the evidence;
- appends the audit event.

| Case | Answer |
|---|---|
| Success | `201 {report_id, report_reference, state: "SUBMITTED", created_at}` |
| Replay, with the same or a new key, after the report exists | `200`, the **original** report. Exactly one report exists (`TEST-API-013`) |
| Key already used for another draft | `409 E_IDEMPOTENCY_CONFLICT` |
| Voice draft without a confirmation of the current version | `422 E_RENDERING_NOT_CONFIRMED` (`TEST-API-014`) |
| Manifest not complete | `409 E_UPLOAD_INCOMPLETE` |
| No photo | Accepted (`DG-09`). `E_EVIDENCE_REQUIRED` is withdrawn for citizen intake (API Contract R.3) |

- `report_reference` looks like `PRK-7Q2X-91KD`: random, non-sequential, Crockford base32 with no I, L, O or U.
- `evidence_completeness` is derived on the server:
  - `photographic` — at least one photo;
  - `partial` — a recording, no photo;
  - `none` — typed text only.

### API-150 / API-151

- **API-150** returns `{"reports": [...], "unsent_drafts": [...]}`. Unsent drafts carry no reference.
- **API-151** returns:
  - the reference, state, category, times and location;
  - `description`: the confirmed Urdu rendering with `rendering_status: "reporter_confirmed"`, or the typed text;
  - own `evidence[]` and `evidence_completeness`;
  - a `timeline` of states and times only.
- API-151 never returns `source_asr_text`, a staff identity, a staff note or audit detail.
- Not-owned and not-found get the same `404` body (`TEST-API-019`).

## 3. Hash formats — PROPOSED

| Hash | Computed over |
|---|---|
| `rendering_content_hash` | SHA-256 of the UTF-8 bytes of the **canonical rendering**: Unicode NFC, `\r\n` and `\r` turned into `\n`, leading and trailing whitespace removed. The client computes it over the text it displays and must get the server's value |
| `manifest_sha256` | SHA-256 of one line `evidence_id:kind:sha256:byte_size\n` per item, sorted by `evidence_id` (lower-case UUID) |
| Item and chunk `sha256` | SHA-256 of the raw bytes, lower-case hex |

## 4. Idempotency headers — `DG-10` open

- **API-135** reads `X-Confirmation-Idempotency-Key`. **API-140** reads `X-Submission-Idempotency-Key`.
- Each falls back to the single `X-Idempotency-Key` that API Contract §10 still names. Both forms work until Hassan decides.
- The two keys are stored in separate unique columns, so one value can never collide with the other operation's guarantee.
- Keys are UUIDv4. A missing or malformed key gets `400 E_VALIDATION` with `field: "idempotency_key"`.

## 5. Error codes

| Code | HTTP | Status |
|---|---|---|
| `E_RENDERING_SUPERSEDED`, `E_RENDERING_HASH_MISMATCH`, `E_RENDERING_NOT_CONFIRMED`, `E_STALE_STATE`, `E_CAPTURE_INTEGRITY` | as in API Contract §11 | **Specified** |
| `E_NOT_FOUND` | 404 | The uniform not-found / not-owned answer |
| `E_VALIDATION` | 400 | PROPOSED, with a `field` name. Submitted values are never echoed |
| `E_UPLOAD_INCOMPLETE` | 409 | **PROPOSED.** Carries `evidence_ids` and `missing_chunks` |
| `E_IDEMPOTENCY_CONFLICT` | 409 | **PROPOSED.** A key reused for a different request |

## 6. Pipeline states on the server

Each step below shows the state a draft moves to:

| Step | State |
|---|---|
| API-130 | `LOCAL_DRAFT` |
| First chunk received | `UPLOADING` |
| API-132, voice draft | `TRANSCRIPTION_PROCESSING` |
| API-132, typed draft | `READY_TO_SUBMIT` |
| Rendering COMPLETED | `AWAITING_REPORTER_REVIEW` |
| Rendering FAILED or REVIEW_REQUIRED | `SUBMISSION_FAILED`. The recording and draft are kept, and no report exists |
| A correction | `AWAITING_REPORTER_REVIEW` |
| API-135 | `READY_TO_SUBMIT` |
| API-140 | No state change: the draft gains `submitted: true`, and the report starts in `SUBMITTED` |

- `WAITING_FOR_CONNECTION` exists only on the device.
- **REVIEW_REQUIRED** shows no text and cannot be confirmed. Human transcript review (API-136) is Phase 2.

## 7. The development AI adapter — SIMULATED (`DG-48`)

- `SimulatedRenderingAdapter` does **not** listen to the recording. Its fixed text starts with `[SIMULATED · نقلی متن]` and says it was not produced from any voice.
- Every artefact it makes carries `simulated: true`. The adapter refuses to load outside development and test, and production refuses to start with it.
- `PARAKH_SIMULATED_AI_OUTCOME` (`complete`, `fail` or `review_required`) exercises the failure paths.
- Processing runs **inline**, straight after the commit. A queue worker (Celery and Redis) replaces this with `T-023`.

## 8. Limits — technical safeguards, not product rules

| Setting | Value | Note |
|---|---|---|
| `CHUNK_MAX_BYTES` | 512 KiB | Provisional technical safeguard |
| `ITEM_MAX_BYTES` | 20 MiB | Provisional technical safeguard |
| `MAX_ITEMS` (`PARAKH_EVIDENCE_MAX_ITEMS`) | 12 per draft, photos plus the one recording | **Provisional technical safeguard, not a product rule.** Configurable. Start-up refuses a value that leaves no room for an approved photo maximum |
| `PARAKH_PHOTO_COUNT_MAX` | **Unset — undecided** | The product photo-count bound is Hassan's decision (`TBD-M9`, `DG-47`). While unset, no product bound is enforced. When set, API-132 refuses more photos (`E_VALIDATION`, `field: "manifest.photo_count"`). No minimum exists: photos are optional (`DG-09`) |
| Typed description | 4,000 characters | |
| Corrected rendering | 5,000 characters | |
| `PARAKH_DRAFT_RETRY_WINDOW_DAYS` | 7 | **PROVISIONAL.** A proposal in the incoming documents (R.5), used as a labelled default until Hassan decides (`DG-14`) |

The magic-byte check is container-level. An MP4 container passes as `audio/mp4` whether or not it holds video; a stricter check would inspect the track types. Files are served back only with their allow-listed media type, `nosniff` and `inline`, never as HTML. **Malware scanning is not implemented** — a stated residual risk (`NFR-55`, `TBD-035`).

## 9. Not done here

- API-152…API-154 (clarification, confirm, dispute), notifications, `PATCH /citizen/profile` and API-156.
- Cancelling a server-side draft. A draft that is never submitted stays until its retry window ends; nothing deletes it yet.
- Staff routes, API-136 transcript review and API-141.
- A real AI provider (`DG-16`), PostgreSQL / PostGIS and a queue worker (`T-023`), a write-once object store, and `GET /geo/reverse` (`DG-30`).
- Concurrency under real parallel load. SQLite serialises writes. A unique constraint backs the replay rule, but no parallel test against PostgreSQL has run.
