# Parakh — API Contract

| Field | Value |
|---|---|
| **Version** | **3.1** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** No endpoint exists. |
| **Owner** | Hassan Jalal |
| **Authority** | **Mobile SRS v2.1.0** · **CR-61 rev 1.3** · CR-60 *(React Native, retained)* · **`PARAKH-IRP v1.0`** · **instruction of 3 Oct 2026** |
| **Supersedes** | v2.0 (30 Aug 2026) · v1.0 (21 Aug 2026) |
| **Governing source** | **Mobile SRS v2.1.0 now exists (13 Sep 2026) and governs the mobile client.** `CR-61 rev 1.3` continues to govern the identity foundation. Where this document differed from either, it is reconciled at v3.1 |

> **This is a logical contract catalogue**, not an OpenAPI document and not code. **No route has been built or tested.**

> **Scope.** Updated only far enough to make the approved architecture implementable. **It defines no click sequence and no user journey.** Behavioural detail belonging to a portal use case is marked `DEFERRED — define during the portal use-case phase`.

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 21 Aug 2026 | Initial catalogue |
| 2.0 | 30 Aug 2026 | Anonymous-reporting security repairs — upload-session token out of the URL, tracking token out of the body, corrected `Authorization` rationale, lost-response recovery |
| **3.1** | **3 Oct 2026** | **Reconciled against Mobile SRS v2.1.0.** **Two distinct idempotency headers (`DR-30`)** replace the single ambiguous `X-Idempotency-Key`. **OTP purpose-binding (`DR-31`)** stated as a validation rule on every verify endpoint. **Consent integrity (`DR-32`)** — server captures version and options. **`E_EVIDENCE_REQUIRED` withdrawn for citizen intake (`DR-28`)**; `evidence_completeness` added to reviewer reads. **`API-150s` added** for `STF-11`. All marked **PROPOSED — no endpoint is implemented** |
| **3.0** | **2 Sep 2026** | **BREAKING.** The **anonymous transport classes and endpoints are superseded in full** — `Public-anonymous`, `Report-grant-bound`, `API-030` *(anonymous form)*, `API-110`–`API-119`. Replaced by **authenticated citizen and staff classes**. **Draft resources separated from `CivicReport`.** **Rendering-version confirmation contract added.** **`CivicReport` creation preconditions specified — creation only at `SUBMITTED`.** **Privacy-filtered contractor response shape specified — no citizen audio, no ASR output, no identity.** **Staff official reporting added under `CAP_REPORT_OFFICIAL`.** TOTP endpoints withdrawn in favour of SMS OTP |

---

## 1. What v3.0 removes

**The identity-free citizen path is superseded in full.** These are **not deprecated-but-live**; they are **removed from the active contract**:

| Removed | Replaced by |
|---|---|
| Transport class **`Public-anonymous`** *(citizen reporting form)* | **`Citizen-authenticated`** |
| Transport class **`Report-grant-bound`** | **Authenticated ownership** — `ReportOwnership` |
| `Authorization: ReportGrant <tracking_token>` | **Bearer session** |
| `API-030` *(anonymous submission)* · `API-119` *(recovery)* | `API-140` · `API-141` |
| `API-110`–`API-114` *(`/reports/self/*`)* | `API-150`–`API-156` *(`/citizen/reports/*`)* |
| `API-115`–`API-117` *(anonymous upload)* | `API-130`–`API-132` *(draft-bound upload)* |
| `X-Submission-Recovery-Secret` · `SubmissionRecovery` · `AnonymousAccessGrant` | **Account ownership** + `idempotency_key` |
| `API-099`, `API-100`, `API-101`, `API-102` *(TOTP enrolment, challenge, recovery, admin reset)* | `API-124` · `API-125` *(SMS OTP)* |
| `E_IDENTITY_FIELD_REJECTED` · `E_GRANT_INVALID` · `E_RECOVERY_CONFLICT` | See §9 |

**Citizens are never described as anonymous, untraceable or identity-free anywhere in this contract.**

---

## 2. Transport classes — five

**Every endpoint belongs to exactly one class. A route with no declared class fails the build.**

| # | Class | Credential | Where carried | Notes |
|---|---|---|---|---|
| 1 | **Public-auth** | **None** — authentication entry points only | — | OTP request, OTP verify, invitation accept. **No privilege is ever returned to an unauthenticated caller other than a session** |
| 2 | **Citizen-authenticated** | Access token | `Authorization: Bearer <token>` | Subject type `citizen`. **No acting-role header** |
| 3 | **Staff-authenticated** | Access token **+ `X-Acting-Role-Assignment-ID`** | Headers | Subject type `staff`. **Exactly one acting assignment** |
| 4 | **Ticket-bound** | Single-use ticket, no privilege | Request body | Between the two staff login factors, and during activation |
| 5 | **Refresh-only** | Refresh token | `Authorization: Bearer <refresh>` | Rotation only |

**The `Public-anonymous` and `Report-grant-bound` classes of v2.0 no longer exist.**

### 2.1 Secret-handling rules — apply to every route

| Rule | Requirement |
|---|---|
| **Never in URLs** | No secret, OTP, token or phone number in a path segment, query parameter or fragment |
| **Header redaction** | Gateway, reverse proxy, application logger, APM and crash reporter redact the **entire** value of `Authorization` and `X-Idempotency-Key` |
| **Body logging** | **Disabled** on every route that carries an OTP, a password, a phone number or a rendering |
| **Caching** | `Cache-Control: no-store` on every token-issuing response and on every response containing a rendering or evidence URL |
| **Errors** | No secret, and no hash of a secret, in any error object |
| **Phone numbers** | **Never returned to any operational role, in any form.** A citizen may receive only their own masked number |

---

## 3. Authentication

### 3.1 Citizen — one possession factor

| ID | Route | Class | Purpose | Notes |
|---|---|---|---|---|
| **API-121** | `POST /auth/citizen/otp/request` | Public-auth | Request a six-digit SMS OTP | Body carries the mobile number and an optional **`pending_consent_ref`**. **Uniform response whether or not the number is registered.** Rate-limited per number, device and IP |
| **API-122** | `POST /auth/citizen/otp/verify` | Public-auth | Verify the OTP | **First success creates the `CitizenAccount`; later successes sign in.** On creation, the recorded consent version is **bound to the new account in the same transaction**. Returns access + refresh tokens |

**The mobile number is the account identifier, not an authentication factor. There is no citizen password in Release 0.** **Citizen login is single-factor using a possession factor.**

### 3.2 Staff — two factors, identical for all four civic portals

| ID | Route | Class | Purpose | Notes |
|---|---|---|---|---|
| **API-098** | `POST /staff/accounts` | Staff-authenticated | **Invite** — create the account and issue a single-use invitation | Requires `CAP_ACCOUNT_ADMIN` *(or `CAP_REP_INVITE` for a Representative within the officer's own scope)*. **The administrator never sets a credential.** **Public signup does not exist as a route** |
| **API-123** | `POST /auth/staff/invitation/accept` | Ticket-bound | Consume the invitation | **Bound to the intended phone.** A different number is refused |
| **API-124** | `POST /auth/staff/otp/verify` | Ticket-bound | Verify the official number | Activation and login share the OTP verifier; `purpose` distinguishes them |
| **API-105** | `POST /auth/staff/password/set` | Ticket-bound | **The invitee sets their own password** | **No administrator may choose, view, transmit or store it.** Never sent by SMS, email, WhatsApp or paper |
| **API-005** | `POST /auth/staff/login` | Public-auth | **First factor — password (knowledge)** | Returns a `login_ticket`, **no privilege**. Wrong-identifier and wrong-password outcomes are **operationally indistinguishable** |
| **API-125** | `POST /auth/staff/login/otp` | Ticket-bound | **Second factor — SMS OTP (possession)** | Returns tokens **and the role-assignment list for explicit selection** |
| **API-120** | `POST /auth/role/select` | Staff-authenticated | **Select or switch the acting role assignment** | **Exactly one.** Step-up when the target is higher-privilege. Audited |
| **API-126** | `POST /auth/step-up` | Staff-authenticated | Fresh OTP for a sensitive action | Updates `step_up_satisfied_at` |
| **API-127** | `POST /auth/staff/password/reset` | Public-auth → Ticket-bound | Recover via OTP | **Revokes all existing sessions.** **Cannot reactivate a suspended, revoked or expired account** |
| **API-003** | `POST /auth/refresh` | Refresh-only | Rotate | **Replay of a consumed token revokes the family** |
| **API-004** | `POST /auth/logout` | Bearer | Server-side revocation | Client discard is not a logout |
| **API-128** | `GET` · `DELETE /auth/sessions` | Bearer | List and end sessions | Supports "sign out everywhere" for both subject types |

**This is two-factor authentication.** **The mobile number is not a third factor, and no response, error or documentation string may describe it as three-factor.**

**Excluded from Release 0 and absent from this contract:** TOTP enrolment, TOTP challenge, TOTP recovery codes, administrator second-factor reset, passkey registration, WebAuthn assertion, hardware-key attestation, server-side biometric verification.

### 3.3 Authorisation preconditions — evaluated on every staff request

| # | Precondition |
|---|---|
| 1 | `StaffAccount.status = ACTIVE` |
| 2 | **At least one `RoleAssignment` is `ACTIVE` and unexpired** |
| 3 | The `X-Acting-Role-Assignment-ID` header names one of them |
| 4 | The acting assignment authorises **this endpoint** |
| 5 | Its scope covers **this record** |
| 6 | The **account** is not in `ConflictExclusion` for this record |
| 7 | Step-up is satisfied where the endpoint requires it |

> **An `ACTIVE` `StaffAccount` with no active `RoleAssignment` receives no staff-portal privilege.** Precondition 2 fails and every staff route returns the standard authorisation failure.

### 3.4 Technical System Administrator

**No route in this contract authenticates a Technical System Administrator.** **Out-of-band infrastructure authentication controlled by the deployment environment — not specified as part of the civic application login.** Integrity-verification tooling is outside the civic API surface.

---

## 4. Acting-role enforcement

**Every staff request carries `X-Acting-Role-Assignment-ID: <uuid>`.** The header is a **claim, never a grant**. The server performs **all six** checks, in order, and denies on the first failure:

| # | Check |
|---|---|
| 1 | The assignment **belongs to the authenticated account** |
| 2 | It is **active and unexpired**, evaluated at the point of action |
| 3 | The **role is permitted for this endpoint** |
| 4 | Its **geographic/organisational scope covers the target record** |
| 5 | The **account is not conflicted or excluded** — at account level, not assignment level |
| 6 | **OTP assurance and any step-up requirement are satisfied** |

> **Never trust the role-assignment ID because the client sent it.** A client that sends an assignment belonging to another account is denied at check 1 and the attempt is audited as `unauthorised_access_attempt`.

**Capabilities are never unioned across assignments.** **A role assignment expiring mid-session downgrades the session on the next request, not at the next login.**

---

## 5. Draft resources — separate from `CivicReport`

**A draft is a `ClientSubmission`. It is not a report, has no report reference, and appears in no civic queue.**

| ID | Route | Class | Purpose | Idempotency | Notes |
|---|---|---|---|---|---|
| **API-130** | `POST /citizen/drafts` · `POST /staff/drafts` | Citizen- / Staff-authenticated | Open a draft | **`client_submission_id`** | Returns `pipeline_state = LOCAL_DRAFT`. **Staff route additionally records the acting `RoleAssignment`** |
| **API-131** | `POST /{subject}/drafts/{client_submission_id}/evidence` | Same | Upload evidence, including `voice_original` | Per-chunk idempotent | Client sends a per-chunk SHA-256; **the server recomputes and rejects on mismatch.** A client-declared hash is never trusted as proof |
| **API-132** | `POST /{subject}/drafts/{client_submission_id}/evidence/complete` | Same | Finalise the manifest | Replay-safe | Server recomputes the whole-manifest hash |
| **API-133** | `GET /{subject}/drafts/{client_submission_id}` | Same | Poll the draft | — | Returns `pipeline_state` and, when available, the **active** rendering |
| **API-134** | `GET /{subject}/drafts/{client_submission_id}/rendering` | Same | Fetch the **active** rendering version | — | Returns `voice_transcription_artifact_id`, `rendering_version`, `rendering_content_hash`, `urdu_civic_rendering`, per-field confidence, `processing_status`, and an **`ai_generated: true`** marker |

**`pipeline_state` values:** `LOCAL_DRAFT` · `WAITING_FOR_CONNECTION` · `UPLOADING` · `TRANSCRIPTION_PROCESSING` · **`AWAITING_REPORTER_REVIEW`** · `READY_TO_SUBMIT` · `SUBMISSION_FAILED`.

**Ownership rule.** Every draft route resolves the draft **from the authenticated subject**. **A client-supplied draft ID never authorises access** — a draft belonging to another subject returns the same not-found response as a draft that does not exist.

**The intermediate source-language ASR output is never returned on a citizen draft route.** It is available only to authorised staff reviewers on `API-136`.

---

## 6. Rendering confirmation — exact-version binding

### 6.1 The contract

| ID | Route | Class | Purpose |
|---|---|---|---|
| **API-135** | `POST /{subject}/drafts/{client_submission_id}/rendering/confirm` | Citizen- / Staff-authenticated | **Confirm one exact rendering version** |

**Required request fields — all eight:**

| Field | Purpose |
|---|---|
| `voice_transcription_artifact_id` | Which artefact |
| `client_submission_id` | Which draft |
| `rendering_version` | Which version |
| **`rendering_content_hash`** | Proof the client displayed **this exact text** |
| `reporter_subject_type` | `citizen` / `staff` — **taken from the session, and rejected if the body disagrees** |
| `reporter_account_id` | **Taken from the session, and rejected if the body disagrees** |
| `confirmed_at` | Client timestamp, advisory only |
| **`X-Submission-Idempotency-Key`** | Header, client-generated UUIDv4, persisted. Prevents a duplicate `CivicReport` on `API-140`/`API-141` |
| **`X-Confirmation-Idempotency-Key`** | Header, client-generated UUIDv4, persisted. Guards the rendering confirmation on `API-135` |

> **`DR-30` — why two headers, decided 3 October 2026 under delegation.** `RenderingConfirmation.idempotency_key` carries a UNIQUE constraint. A **single** header shared between "confirm this rendering" and "create this report" makes one operation's replay key collide with the other's uniqueness guarantee — a retry of the submission would be refused as a duplicate confirmation. **Two keys, never reused across the two operations.** No endpoint, field name or route changes.

**Required capability: `CAP_RENDERING_CONFIRM_OWN`.**

### 6.2 Server verification — all six must pass

| # | Check | Failure |
|---|---|---|
| 1 | The artefact belongs to the **authenticated reporter's own draft** | `404` — uniform, same as not-found |
| 2 | The rendering is the **active version** | **`409 E_RENDERING_SUPERSEDED`** |
| 3 | The supplied **content hash matches** the stored rendering | **`409 E_RENDERING_HASH_MISMATCH`** |
| 4 | The rendering **has not been superseded** | **`409 E_RENDERING_SUPERSEDED`** |
| 5 | The confirmation **has not already produced another report** | Idempotent replay returns the **original** result |
| 6 | The **idempotency key cannot create a duplicate `CivicReport`** | Idempotent replay returns the **original** result |

**On a `409`, the client must re-fetch `API-134` and present the newest version before retrying.** **The server never silently accepts an older version and never silently upgrades the confirmation to a newer one.**

> **`CAP_RENDERING_CONFIRM_OWN` never permits confirmation on another person's behalf.** A citizen confirms only their own citizen draft; an authorised staff reporter confirms only their own official draft. **A transcript reviewer may produce a new version but may never confirm it.**

`DEFERRED — define during the portal use-case phase`: the exact screen interaction after a `409`.

---

## 7. `CivicReport` creation

### 7.1 Preconditions — all four required

| # | Precondition |
|---|---|
| 1 | The **Urdu-script civic rendering exists** |
| 2 | The **reporter has confirmed the current active rendering version** — §6 |
| 3 | **Required evidence validation has passed** — see §7.4 |
| 4 | The **backend accepts the submission** |

### 7.2 The endpoints

| ID | Route | Class | Purpose | Idempotency | Notes |
|---|---|---|---|---|---|
| **API-140** | `POST /citizen/reports` | Citizen-authenticated | Create a citizen `CivicReport` | **`client_submission_id` + `X-Idempotency-Key`** | Returns `{report_reference, state:"SUBMITTED", created_at}` |
| **API-141** | `POST /staff/reports/official` | Staff-authenticated | Create a staff-official `CivicReport` | Same | Requires **`CAP_REPORT_OFFICIAL`**. **Service accounts and automated integrations are excluded** |

### 7.3 Atomic creation

In **one transaction**: verify the `RenderingConfirmation` · verify required evidence · create `CivicReport` **in `SUBMITTED`** · issue the **human-readable, non-sequential `report_reference`** · bind `confirmed_rendering_artifact_id` and `confirmed_rendering_version` · record `ReportOwnership` · **create a `ConflictExclusion` when `reporter_kind = staff_official`** · append the audit event. **All succeed, or none happens.**

> **`DRAFT` is not a `CivicReport` state.** The transition `pipeline → DRAFT → SUBMITTED` is **withdrawn**. **A `CivicReport` cannot be created in any state other than `SUBMITTED`**, and a request that would do so fails the build, not merely the request.
>
> **The report reference is issued in the same transaction.** **No reference exists before it commits, and no queued draft carries one.**

### 7.4 Evidence validation

> **`TBD — Hassan decision required`: is at least one live photo required for every Release 0 report, or may named categories be submitted without one?**

Both branches are contract-ready: **A** — creation rejects with `422 E_EVIDENCE_REQUIRED` when no photo is present; **B** — validation is **category-conditional**, and the category list is configuration, not code. **Until decided, no document may state that the validation is final.**

### 7.5 AI-processing failure

**`processing_status = REVIEW_REQUIRED` does not create a `CivicReport` and does not bypass §6.**

| # | Rule |
|---|---|
| 1 | Failure preserves the encrypted draft and the original recording |
| 2 | The draft **remains a `ClientSubmission`** |
| 3 | The reporter may retry or re-record |
| 4 | An authorised reviewer may produce or correct a **new rendering version** — `API-136` |
| 5 | **The new version returns to the original reporter for confirmation** |
| 6 | **No staff reviewer confirms on the reporter's behalf** |
| 7 | Creation occurs **only after** the original reporter confirms the current active version |
| 8 | **No plausible replacement text is ever generated** |
| 9 | **Audio-only official submission is not part of Release 0** |

---

## 8. Authenticated report operations

### 8.1 Citizen — ownership-scoped

| ID | Route | Method | Class | State | Response | Errors |
|---|---|---|---|---|---|---|
| **API-150** | `GET /citizen/reports` | GET | Citizen-auth | Any | Own reports **plus queued drafts, clearly distinguished** | 401 · 429 |
| **API-151** | `GET /citizen/reports/{id}` | GET | Citizen-auth | Any | Reference, state, **sanitised timeline**, own evidence, own recording, confirmed rendering | **404 uniform** |
| **API-152** | `POST /citizen/reports/{id}/clarify` | POST | Citizen-auth | Open clarification | `{accepted:true}` | 404 · 409 |
| **API-153** | `POST /citizen/reports/{id}/confirm` | POST | Citizen-auth | `PENDING_CITIZEN_CONFIRMATION` | `{state:"RESOLVED_CONFIRMED"}` | 404 · **409 `E_STALE_STATE`** |
| **API-154** | `POST /citizen/reports/{id}/dispute` | POST | Citizen-auth | `PENDING_CITIZEN_CONFIRMATION` | `{state:"REOPENED"}` | 400 · 404 · 409 |
| **API-155** | `GET`/`PATCH /citizen/profile` | — | Citizen-auth | — | **Own masked number only.** `preferred_language ∈ {ur, en}` | 401 |
| **API-156** | `POST /citizen/phone/change` | POST | Citizen-auth | — | Two OTPs — old number, then new | 401 · 409 · 429 |

**Ownership is a first-class check.** A report belonging to another account returns the **same `404`** as a report that does not exist. **A client-supplied report identifier never authorises access.**

### 8.2 Staff — role- and scope-scoped

| ID | Route | Role / capability | State | Conflict check | Step-up | Audit |
|---|---|---|---|---|---|---|
| **API-136** | `POST /staff/drafts/{id}/rendering/review` | `CAP_TRANSCRIPT_REVIEW` | flagged | — | — | `transcript_reviewed` — **produces a new version; never a confirmation** |
| **API-160** | `POST /reports/{id}/field-verification` | `REP` + `CAP_FIELD_VERIFY` | `UNDER_VERIFICATION` | **Account-level** | — | `field_verified` |
| **API-161** | `POST /reports/{id}/accept` | `UCO` + `CAP_CASE_ACCEPT` | `UC_REVIEW` | **Account-level** | — | `case_accepted` |
| **API-162** | `POST /reports/{id}/reject` | `UCO` + `CAP_CASE_REJECT` | `UC_REVIEW` | **Account-level** | **✓** | `case_rejected` |
| **API-163** | `POST /reports/{id}/assign` | `UCO` + `CAP_CASE_ASSIGN` | **`ACCEPTED`** | **Account-level** + contractor eligibility | **✓** | `contractor_assigned` |
| **API-164** | `POST /reports/{id}/work/accept` · `/decline` | `CON` + `CAP_WORK_ACCEPT` | `CONTRACTOR_ASSIGNED` | Contractor must be active **at the point of action** | — | `work_accepted` / `work_declined` |
| **API-165** | `POST /reports/{id}/progress` | `CON` + `CAP_WORK_PROGRESS` | `IN_PROGRESS` | — | — | `progress_updated` |
| **API-166** | `POST /reports/{id}/completion` | `CON` + `CAP_WORK_COMPLETE` | `IN_PROGRESS` | — | — | `completion_submitted` |
| **API-167** | `POST /reports/{id}/completion-verification` | `REP` + `CAP_COMPLETION_VERIFY` | `COMPLETION_VERIFICATION` | **Not the completer, not the reporter** | — | `completion_verified` |
| **API-168** | `POST /reports/{id}/close` | **`UCO` only** + `CAP_CASE_CLOSE` | `RESOLVED_CONFIRMED` or eligible | **Account-level** | **✓** | `case_closed` |
| **API-169** | `POST /reports/{id}/reopen` | `UCO` / `MAY` + `CAP_CASE_REOPEN` | closed / disputed | **Account-level** | ✓ | `case_reopened` |
| **API-170** | `POST /disputes/{id}/appeal/decide` | `MAY` + `CAP_APPEAL_DECIDE` | `appeal_status ∈ {FILED, UNDER_REVIEW}` | **Not a prior actor on that case** | ✓ | `appeal_decided` |
| **API-171** | `POST /reports/{id}/protected-contact` | `MAY` + `CAP_PROTECTED_CONTACT` | Any | — | **✓** | `protected_contact_sent` — **no phone number in the event** |
| **API-172** | `POST /staff/accounts/{id}/suspend` · `/revoke` | `MAY` + `CAP_ACCOUNT_ADMIN` | — | Cannot revoke the last account admin | **✓** | `account_suspended` |
| **API-173** | `POST /staff/role-assignments` | `MAY` + `CAP_ROLE_ASSIGN` | — | **Never above the assigner's own scope or role** | **✓** | `role_assigned` |
| **API-080** | `GET /reports/{id}/history` | `CAP_AUDIT_READ` | Any | — | ✓ | `audit_log_viewed` |

**Ordinary closure is `UCO` only.** **`MAY` has no close route.** Exceptional intervention is a separate, separately audited endpoint and is **never recorded as an ordinary closure**.

`DEFERRED — define during the portal use-case phase`: queue endpoints, notification payload shapes, and the ordering in which a portal calls these routes.

---

## 9. Privacy-filtered response shapes

**Filtering is server-side. Template omission is not filtering.**

### 9.1 Contractor work packet — `API-164`, `API-165`, `API-166`

| **Included** | **Excluded — and absent from the serialiser, not merely hidden** |
|---|---|
| `report_reference` | **`voice_original` evidence reference or URL** |
| `category` | **`source_asr_text`** |
| `location` *(required precision only)* | `citizen_account_id` |
| **`urdu_civic_rendering`** *(confirmed version)* | Citizen mobile number, masked or otherwise |
| **Redacted photo/video evidence** | Citizen name |
| Work instructions | Internal staff notes |
| Safe access information | Unrestricted audit narrative |
| Progress and completion requirements | Official reporter's staff identity |

> **A voice recording identifies the speaker in a way text does not.** A contractor needs to know **what to fix and where** — not who said it or how they sound. **This was permitted in v2.0 and is now removed.**

### 9.2 Citizen response

Own report only · own recording · confirmed rendering · **sanitised timeline** · **own masked number only**.
**Excluded:** `source_asr_text` · internal staff notes · staff personal contact details · which named officer acted · **the staff identity of an official reporter** · security or audit internals.

### 9.3 Representative and UC Officer responses

Scope-limited report content · **original recording, scope-limited, for verification** · **`source_asr_text` where required for verification or review** · internal staff notes.
**Excluded:** citizen mobile number **in any form** · citizen name · `citizen_account_id`.

### 9.4 Mayor & Operations

As above plus `citizen_account_id`, staff identity and civic audit narrative. **Original-recording access is authorised, scope-limited and audited.** **Still no citizen phone number.**

### 9.5 The universal rule

> **No operational role receives a citizen phone number in any response, masked or otherwise.** The authentication and notification services access the encrypted number only to perform an authorised system operation and **never render it to a person**.

---

## 10. Idempotency

| Concern | Rule |
|---|---|
| **Draft creation** | Keyed on `client_submission_id`. A repeat returns the existing draft |
| **Evidence chunks** | Chunk `n` is idempotent; the server recomputes the hash |
| **Rendering confirmation** | Keyed on `X-Idempotency-Key`. A replay returns the **original** result |
| **Report creation** | Keyed on `client_submission_id` **and** `X-Idempotency-Key`. **A replay can never create a second `CivicReport`** |
| **Workflow transitions** | Guarded by `state_version`; a stale version returns **`409 E_STALE_STATE`** |
| **Concurrency** | Concurrent retries are serialised on `client_submission_id`; **exactly one `CivicReport` results** |
| **Lost response** | The client retries with the **same** `client_submission_id` and idempotency key and receives the original `report_reference`. **No recovery secret and no anonymous grant is involved — the account is the recovery mechanism** |

---

## 11. Error catalogue

| Code | HTTP | Cause | Reporter-facing text |
|---|---|---|---|
| **`E_RENDERING_SUPERSEDED`** | 409 | The confirmed version is no longer active | *"This text has been updated. Please read the new version."* |
| **`E_RENDERING_HASH_MISMATCH`** | 409 | The supplied content hash does not match the stored rendering | *"This text has changed. Please read it again."* |
| **`E_RENDERING_NOT_CONFIRMED`** | 422 | Report creation attempted without a valid confirmation | *"Please check and confirm the text before sending."* |
| **`E_EVIDENCE_REQUIRED`** | 422 | Required evidence missing — **branch A or a listed category under branch B** | *"Please add a photo before sending."* |
| **`E_STALE_STATE`** | 409 | `state_version` mismatch | *"This has changed since you last looked. Refreshing."* |
| **`E_CAPTURE_INTEGRITY`** | 422 | Server-recomputed manifest hash mismatch | *"Some of your evidence did not arrive correctly."* |
| **`E_ROLE_ASSIGNMENT_INVALID`** | 403 | Acting assignment absent, expired, revoked or not owned | Staff-facing: *"Your role has changed. Please sign in again."* |
| **`E_CONFLICT_EXCLUDED`** | 403 | The **account** is excluded from acting on this record | Staff-facing: *"You reported this issue, so you cannot act on it."* |
| **`E_STEP_UP_REQUIRED`** | 401 | `recent_auth_at` older than 10 minutes | Staff-facing: *"Please confirm the code we just sent you."* |

**Uniform-response rules.** Not-found, not-owned and no-permission-to-read all return the **same `404`** with the same body and timing class, so that no route becomes an enumeration oracle. **OTP request and verify responses are uniform whether or not the number is registered.** Wrong-identifier and wrong-password outcomes are **operationally indistinguishable**.

---

## 12. Not specified here

| Item | Status |
|---|---|
| OpenAPI / JSON Schema documents | **Not written** |
| Any implementation | **None** |
| Any executed test | **None** |
| **SRS v2.0.0** | **Not written.** CR-61 rev 1.3 governs until it exists |
| Queue, notification and dashboard endpoints | `DEFERRED — define during the portal use-case phase` |
| Numeric rate-limit thresholds | **`TBD — Hassan decision required`** — field evidence needed |
| SMS / OTP provider, cost and delivery policy | **`TBD — Hassan decision required`** — **no provider integration exists or is claimed** |
| AI provider and processing location | **`TBD — Hassan decision required`** — **none selected** |
| Raw-audio retention duration | **`TBD — legal or institutional review required`** |
| `ClientSubmission` retry-window duration | **`TBD — Hassan decision required`** |

## 13. Related tests

`TEST-API-001` citizen login requires OTP and accepts no password · `002` all four staff roles authenticate with password + OTP · `003` no route accepts a staff password set by an administrator · `004` **no public staff-signup route exists** · `005` an active `StaffAccount` with no `RoleAssignment` is denied on every staff route · `006` capabilities are never unioned across assignments · `007` **`API-141` requires `CAP_REPORT_OFFICIAL`** · `008` **a staff reporter can confirm only their own official draft** · `009` **a staff user cannot confirm a citizen draft** · `010` **a transcript reviewer cannot confirm** · `011` **a superseded `rendering_version` returns `409 E_RENDERING_SUPERSEDED`** · `012` **a mismatched content hash returns `409 E_RENDERING_HASH_MISMATCH`** · `013` **a replayed idempotency key returns the original report** · `014` **report creation without confirmation returns `422 E_RENDERING_NOT_CONFIRMED`** · `015` **no route can create a `CivicReport` in a state other than `SUBMITTED`** · `016` **a queued draft response carries no `report_reference`** · `017` **the contractor packet contains no `voice_original` and no `source_asr_text`** · `018` **no response returns a citizen phone number to any operational role** · `019` a not-owned report returns the same `404` as a non-existent one · `020` **no route authenticates a Technical System Administrator** · `021` **no TOTP, passkey or WebAuthn route exists** · `022` step-up is not demanded within 10 minutes of the login OTP.

**Every test above: `Specified; not implemented; not executed`.**

---

*Specified; not implemented; not tested. No endpoint in this document exists.*

---

# Reconciliation additions — 3 October 2026 (v3.1)

> **Every contract in this section is `PROPOSED`. No endpoint in this document has been implemented, deployed or called.** Labels: **`[RECOVERED]`** · **`[INSTRUCTED]`** · **`[DELEGATED]`**.

## R.1 OTP purpose-binding — validation rule on every verify endpoint

**`DR-31` `[DELEGATED]`.** `OTPChallenge.purpose` already existed as an 8-value enum **`[RECOVERED]`**; what was missing was the **enforcement rule**.

| Rule | Detail |
|---|---|
| **Issue** | On successful verification the server issues a short-lived ticket **stamped with the verifying challenge's `purpose`** |
| **Consume** | Every consuming endpoint declares the purpose it accepts and **rejects any other** with `400 E_OTP_PURPOSE_MISMATCH` |
| **Pairs** | `citizen_signup_login` → `API-004` · `staff_activation` → `API-120` · `staff_login` → `API-125` · `password_reset` → `API-127` · `step_up` → step-up-guarded routes only · the three phone-change purposes → their own confirm routes |
| **Why** | Without it, an **activation** OTP could satisfy a **step-up** challenge — the weakest flow would set the strength of the strongest. **A validation rule, not a new route** |
| **Tests** | `TEST-OTP-010` … `TEST-OTP-013` |

## R.2 Consent integrity

**`DR-32` `[DELEGATED]`.** Rev 1.1 stored `pending_consent_ref` on `OTPChallenge` **`[RECOVERED]`** — a client-generated reference. A reference alone does not prove **what was shown**.

| Change | Detail |
|---|---|
| **Server stores** | `consent_version` **and the selected option set** on the `OTPChallenge` **at request time** — not only the client's ref |
| **Device copy** | Becomes a **convenience for resume**, not the record of record |
| **On verification** | `ConsentRecord` rows are written **from the server-held values**, in the same transaction as account creation |
| **Changed selection** | Produces a **new** `pending_consent_ref` **`[RECOVERED]`** and a new server-side snapshot |
| **Tests** | `TEST-CONSENT-005` … `TEST-CONSENT-008` |

## R.3 Evidence validation — `DR-28`

**`[INSTRUCTED]`** — a photo is **not** required for citizen intake.

| Endpoint | Change |
|---|---|
| `API-140` / `API-141` create report | **`E_EVIDENCE_REQUIRED` is withdrawn for citizen intake.** Required: a resolvable location **and** an intelligible description in **one** modality — a confirmed rendering **or** typed text. **Never both** |
| Reviewer reads (`API-160`, `API-161`, `API-150s`) | Response gains **`evidence_completeness`: `"none" \| "partial" \| "photographic"`** — **derived server-side**, never client-asserted |
| `API-162` clarification | Unchanged. This is the path a reviewer uses to **ask for a photo** |
| **Unchanged** | **`API-165` contractor completion evidence stays required.** **`API-166` completion-verification evidence stays required** |

## R.4 `API-150s` — staff ownership read

**`[DELEGATED]`** — backs `STF-11`, closes `RC-18`.

| Field | Value |
|---|---|
| **Route** | `GET /staff/reports/own` |
| **Transport class** | **`Staff-authenticated`** (bearer + `X-Acting-Role-Assignment-ID`) |
| **Authorization** | `CAP_REPORT_VIEW_OWN`. **Read-only ownership exemption** bypasses scope check 4 and conflict check 5; checks 1, 2, 3 and 6 still apply |
| **Filter** | `official_reporter_account_id = authenticated staff account`. **Never a scope query** |
| **Response (per item)** | `report_reference` · `state` · `category` · `submitted_at` · `evidence_completeness` · `open_clarification_count` · `conflict_excluded: true` |
| **Enumerated companion routes** | `GET …/own/{ref}` · `GET …/own/{ref}/timeline` · `GET …/own/{ref}/completion-evidence` · `POST …/own/{ref}/clarification` · `POST …/own/{ref}/confirm` · `POST …/own/{ref}/dispute` |
| **Everything else** | **`403 E_CONFLICT_EXCLUDED`** — verify, accept, reject, assign, approve, close, decide. **Under every role the account holds** |
| **Another account's report** | **Uniform `404`** — never `403`, which would confirm the report exists |
| **Idempotency** | `confirm` and `dispute` take `X-Confirmation-Idempotency-Key` |
| **Tests** | `TEST-OWN-001` … `TEST-OWN-008` |

## R.5 Retry and offline behaviour

**`[DELEGATED]`**

| Concern | Rule |
|---|---|
| **Retry window** | A queued `ClientSubmission` retries for **7 days**; then marked expired and kept read-only for a further **7 days** before local deletion |
| **Backoff** | Exponential with jitter. **Foreground-first** — background sync is best-effort on low-end Android |
| **Replay** | A retry carrying the **same** `X-Submission-Idempotency-Key` returns the **original** `CivicReport`, never a second one **`[RECOVERED]`** |
| **OTP and AI offline** | **Impossible, and named plainly on screen** — never a silent queue **`[RECOVERED]`** |
