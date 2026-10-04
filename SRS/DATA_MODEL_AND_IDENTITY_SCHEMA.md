# Parakh — Data Model and Identity Schema

| Field | Value |
|---|---|
| **Version** | **1.4** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** No schema has been created or migrated. |
| **Authority** | **Mobile SRS v2.1.0** *(written 13 Sep 2026 — now exists and governs the mobile client)* · **CR-61 rev 1.3** *(identity foundation)* · **`PARAKH-IRP v1.0`** *(14 Sep 2026)* · **Hassan Jalal's reconciliation instruction of 3 October 2026** |
| **Supersedes** | v1.2 (2 Sep 2026) · v1.1 · v1.0 · the `AnonymousAccessGrant` / `SubmissionRecovery` model of Database Architecture v2.7 |

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1.0 | 31 Aug 2026 | Initial five-portal identity model |
| 1.1 | 1 Sep 2026 | Audit wording corrected; OTP purposes completed; `AuthSession` extended; `ProtectedContactRequest` and `ClientSubmission` added; entities 27 → 29 |
| 1.2 | 2 Sep 2026 | `VoiceTranscriptionArtifact` added (29 → 30); `subject_type` added to `RefreshTokenFamily` and `DeviceSession`; pre-authentication consent corrected; `ACCEPTED` and `CLOSED` added; `Dispute.appeal_status` added; `preferred_language` restricted to `ur` / `en` |
| **1.3** | **2 Sep 2026** | **`RenderingConfirmation` added** — exact-version confirmation binding; entities **30 → 31**. **`DRAFT` removed from `CivicReport.state`** — 15 enum values; a CivicReport is created atomically at `SUBMITTED`. **`AWAITING_CITIZEN_REVIEW` renamed `AWAITING_REPORTER_REVIEW`**, and `ClientSubmission` gains `reporter_subject_type`. **`official_identifier` renamed `staff_reference`** — optional, **not a login identifier**. **Contractor access to original audio and ASR output removed.** **AI-failure submission bypass withdrawn.** **Retention wording corrected** — immutable *while retained*, not permanently retained |

| **1.4** | **3 Oct 2026** | **Reconciled against Mobile SRS v2.1.0.** **Photo TBD closed (`DR-28`)** — optional, with `evidence_completeness` derived for the reviewer. **OTP hardening parameters fixed (`DR-29`)** — resend cooldown, lockout, caps. **OTP purpose-binding enforcement added (`DR-31`)**. **Consent integrity hardened (`DR-32`)** — the server stores the consent **version and selected options**, not only a client reference. **`ReporterConfirmation` generalisation recorded as RECOMMENDED, not applied.** Entities unchanged at **31**. |

> **Reconciliation, 3 October 2026.** The authority line above previously pointed at *"SRS v2.0.0 — not yet written"*. **That placeholder is now closed: Mobile SRS v2.0.0 and v2.1.0 exist.** This revision reconciles this document against them and against the Project Lead's instruction of 3 October 2026. **Recovered requirements and decisions made now are labelled separately in every section they touch.**

> **Conceptual model.** No SQL, no ORM code, no migration. Field lists are logical, not `CREATE TABLE` statements.

> **Scope.** Documentation-finalisation revision. **No use case, click-by-click journey or portal tutorial is created here.**

---

## 1. Identity separation — the central decision

Three concerns live in **three separate stores** with different access rules. Collapsing them is what makes phone numbers leak.

| Store | Holds | Readable by the application role? |
|---|---|---|
| **Operational** | Reports, evidence, renderings, assignments, workflow | **Yes** |
| **Identity vault** | `CitizenPhoneCredential`, `StaffCredential` | **No** — separate database role, separate schema |
| **Audit** | Append-only event chain | **Append-only via the audit service** |

> **The application role has no `SELECT` on the identity vault.** **A compromised application role does not yield the phone-number table.**

### 1.1 Audit store — precise rules

| Rule | Detail |
|---|---|
| **Civic users** | **No direct write, update or delete permission** on the audit table |
| **The audit-writing service** | **May append** structured events, and only append |
| **No actor, service or role** | May **edit or delete** an existing `AuditEvent` — including the audit service itself |
| **Civic audit reading** | `CAP_AUDIT_READ` — Mayor & Ops, scope-limited UC Officer |
| **Technical integrity verification** | `CAP_AUDIT_INTEGRITY_VERIFY` — Technical System Administrator. **Hash-chain results only: no report content, no citizen identity, no rendering text, no staff notes, no audit narrative** |

---

## 2. Identity and account entities

### 2.1 `CitizenAccount`

| Aspect | Detail |
|---|---|
| **Purpose** | The civic identity of a person who reports. **Created automatically on first successful OTP verification** |
| **Key fields** | `id` · `status` · **`preferred_language` — `ur` or `en` only** · `created_at` · `last_seen_at` · `deactivated_at` · `deactivation_reason` |
| **Relationships** | 1 → 1 `CitizenPhoneCredential` · 1 → n `CivicReport` · 1 → n `AuthSession` · 1 → n `ConsentRecord` · 1 → n `Notification` |
| **States** | `ACTIVE` · `TEMPORARILY_LOCKED` · `DEACTIVATED` |
| **Uniqueness** | `id`. **The phone number is not stored here** |
| **Indexes** | `status` · `last_seen_at` |
| **Retention** | Retained while active; on deactivation the row is retained and the credential destroyed |
| **Access** | Self · Mayor & Ops with `CAP_ACCOUNT_ADMIN` |
| **Audit** | `citizen_account_created` · `citizen_account_locked` · `citizen_account_deactivated` |

> **`preferred_language` is the *interface* language and is restricted to Urdu or English.** It has **no effect on the language the citizen speaks** and **no effect on the script of the civic rendering**, which is always Urdu.

### 2.2 `CitizenPhoneCredential` — the protected identity record

| Aspect | Detail |
|---|---|
| **Purpose** | Binds one normalised mobile number to one `CitizenAccount`. **The only place a citizen phone number exists** |
| **Key fields** | `id` · `citizen_account_id` · `phone_e164_encrypted` · `phone_lookup_hmac` · `phone_masked_display` · `verified_at` · `previous_phone_lookup_hmac` · `changed_at` |
| **Uniqueness** | **`phone_lookup_hmac` UNIQUE** — one citizen account per number after E.164 normalisation |
| **Indexes** | `phone_lookup_hmac` only. **No index on the ciphertext** |
| **Encryption** | Authenticated encryption, key in a KMS, **not** in the application database. `phone_lookup_hmac` = `HMAC(server_key, normalised_e164)` |
| **Why HMAC, not a plain hash** | The E.164 space for one country is small enough to enumerate exhaustively. **A plain SHA-256 of a phone number is reversible by brute force in minutes.** A keyed HMAC is not, unless the key also leaks |
| **Sensitive** | **Entire record.** Never in logs, analytics, exports, evidence filenames, rendering text, audit text, contractor packets or error messages |
| **Retention** | Destroyed on account deletion. `phone_lookup_hmac` may be retained briefly against re-registration abuse — **duration `TBD — legal or institutional review required`** |
| **Access** | **Authentication and notification services only, for an authorised system operation.** **No human-facing endpoint returns it to any operational role** |
| **Audit** | `phone_verified` · `phone_changed` — **never the number** |

### 2.3 `StaffAccount`

| Aspect | Detail |
|---|---|
| **Purpose** | An invited official user. **The unit of identity and of conflict exclusion** |
| **Key fields** | `id` · **`staff_reference`** *(optional)* · `display_name` · `status` · `organization_id` *(nullable)* · `invited_by` · `invited_at` · `activated_at` · `suspended_at` · `revoked_at` · `expires_at` · `reason` |
| **States** | `INVITED` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `REVOKED` · `EXPIRED` |
| **Critical rules** | **An `ACTIVE` account with no active `RoleAssignment` receives no staff-portal privileges.** **Suspended, revoked or expired accounts cannot authenticate**, and suspension or revocation **invalidates active sessions**. **Public staff signup is impossible** |
| **Audit** | Every state change |

#### 2.3.1 `staff_reference` — the identifier ambiguity resolved

**Revision 1.2 carried `official_identifier` on `StaffAccount` *and* a protected mobile number in `StaffCredential`. Two ambiguous login identifiers is a defect, and it is corrected here.**

| Question | Answer |
|---|---|
| What is the **login identifier**? | **The official mobile number**, held only in `StaffCredential` |
| What is `staff_reference`? | An **administrative or employee reference** — a payroll ID, department code or equivalent |
| Is it used for login? | **No. Never.** No authentication path reads it |
| Is it required? | **Optional.** Nullable. An account is fully functional without one |
| Is it unique? | Unique **when present**; null values do not collide |
| Is it returned by default? | **No.** Returned only where a caller demonstrably needs it, and never to a citizen or contractor |
| Why not simply remove it? | Institutions that later adopt Parakh may need to reconcile a Parakh account against their own personnel register. Keeping it **optional and non-authenticating** costs nothing; **making it a second login identifier would be a security defect** |

### 2.4 `StaffCredential`

| Aspect | Detail |
|---|---|
| **Purpose** | The staff password and phone binding. **One shape for all four civic staff portals** |
| **Key fields** | `id` · `staff_account_id` · `password_hash` · `password_algo` · `password_set_at` · `phone_e164_encrypted` · `phone_lookup_hmac` · `phone_verified_at` · `must_reset` |
| **Hashing** | **Argon2id** with documented parameters. **Never reversible, never logged, never displayed** |
| **Uniqueness** | `phone_lookup_hmac` UNIQUE across staff |
| **Critical rules** | **Created only by the account owner.** No administrator chooses, views, transmits or stores it. **Never sent by SMS, WhatsApp, email, spreadsheet or printed document.** A password reset **revokes all existing sessions** |
| **Audit** | `password_set` · `password_reset` — **never the value** |

> **No TOTP secret, passkey credential or WebAuthn public key exists in this model.** The approved second factor is **SMS OTP**, which stores no per-user secret.
>
> **The Technical System Administrator has no row in either credential table.** Its authentication is out-of-band infrastructure authentication controlled by the deployment environment.

## 3. Authorisation entities

### 3.1 `Role`
`id` · `code` (`CIT` / `REP` / `UCO` / `CON` / `MAY`) · `display_name` · `capabilities[]`. Reference data. **`SYSADMIN` is not a civic role and has no row.**

### 3.2 `RoleAssignment`

| Aspect | Detail |
|---|---|
| **Key fields** | `id` · `staff_account_id` · `role` · `scope_type` · `scope_id` · `organization_id` · `status` · `valid_from` · `valid_until` · `assigned_by` · `assigned_at` · `revoked_by` · `revoked_at` · `reason` |
| **States** | `PENDING` · `ACTIVE` · `SUSPENDED` · `EXPIRED` · `REVOKED` |
| **Uniqueness** | No duplicate active (`staff_account_id`, `role`, `scope_id`) |
| **Indexes** | (`staff_account_id`, `status`) · (`role`, `scope_id`, `status`) |
| **Critical rules** | `valid_until` **mandatory**. Validity evaluated **at the point of action**. **Never hard-deleted**. **Exactly one assignment acts per session; capabilities are never unioned across assignments** |
| **Audit** | `role_assigned` · `scope_changed` · `role_suspended` · `role_revoked` |

### 3.3 `GeographicScope`
`id` · `type` (`city` / `district` / `tehsil` / `union_council` / `ward`) · `parent_id` · `name` · `boundary` (PostGIS). Hierarchical containment.

### 3.4 `Organization` / `ContractorOrganization`

| Aspect | Detail |
|---|---|
| **Key fields** | `id` · `legal_name` · `approval_reference` · `approved_by` · `approved_at` · `status` · `valid_from` · `valid_until` · `approved_categories[]` · `service_areas[]` |
| **States** | `PENDING_APPROVAL` · `APPROVED` · `SUSPENDED` · `EXPIRED` · `REVOKED` |
| **Critical rules** | **A UC Officer can never create one.** **Suspending the organisation cascades to its accounts immediately.** A contractor employee hierarchy is **explicitly future scope** |

## 4. Authentication entities

### 4.1 `AccountInvitation`
`id` · `staff_account_id` · `token_hash` · `intended_phone_lookup_hmac` · `role` · `scope_id` · `issued_by` · `issued_at` · `expires_at` · `consumed_at` · `status`.

**Single-use, short-lived, hashed at rest.** **Bound to the intended phone** — activating with a different number is **refused**. **Activation cannot occur offline.**

### 4.2 `OTPChallenge`

| Aspect | Detail |
|---|---|
| **Key fields** | `id` · **`purpose`** · `phone_lookup_hmac` · `code_hash` · `created_at` · `expires_at` · `attempts` · `max_attempts` · `consumed_at` · `superseded_by` · `request_ip_hmac` · `device_hint` · **`pending_consent_ref`** *(nullable — citizen signup only, §4.7)* |
| **`purpose` enum** | `citizen_signup_login` · `staff_activation` · `staff_login` · `password_reset` · `citizen_phone_change_old` · `citizen_phone_change_new` · `staff_phone_change_new` · `step_up` |
| **Controls** | 6 numeric digits · **5-minute expiry** · single use · **max 5 attempts** · **resend cooldown 60 s** · **per number 3/hour and 10/day** · **per device 5/hour** · **per IP 20/hour** *(`DR-29`, set 3 Oct 2026 — the first four were recovered from rev 1.1; the numeric caps are decided now)* |
| **Lockout** (`DR-29`) | **Exhausting 5 attempts consumes the challenge** and requires a **fresh request**, subject to the caps above. **There is no account lock** — locking an account on OTP failure would let anyone lock any citizen out by entering their number. **Rate limiting is the control; account locking is not** |
| **Purpose binding** (`DR-31`) | The ticket issued on verification is **stamped with the verifying challenge's `purpose`** and is **rejected by any endpoint expecting a different purpose**. A `staff_activation` OTP can never satisfy a `step_up`. **A validation rule — no new endpoint** |
| **Storage** | **`code_hash` only.** Never plaintext, never logged |
| **Resend** | Sets `superseded_by` on the previous challenge and **invalidates it immediately** |
| **Enumeration** | **Uniform responses** whether or not the number is registered |
| **Offline** | **Impossible.** An OTP is never stored on the device for later verification |
| **Audit** | `otp_requested` · `otp_verified` · `otp_failed` · `otp_rate_limited` — **never the code, never the number** |

### 4.3 `AuthSession`

| Field | Purpose |
|---|---|
| `id` | Session identifier |
| `subject_type` | `citizen` / `staff` |
| `subject_id` | `CitizenAccount.id` or `StaffAccount.id` |
| `acting_role_assignment_id` | **Staff only. Exactly one. Never a union of roles** |
| `issued_at` · `expires_at` · `revoked_at` · `revocation_reason` | Lifecycle |
| **`mfa_satisfied_at`** | When the login OTP succeeded |
| **`step_up_satisfied_at`** | When the most recent step-up OTP succeeded |
| **`authentication_method`** | `citizen_otp` *(one possession factor)* / `staff_password_otp` *(two factors)* |
| `device_session_id` · `refresh_token_family_id` | Links |

**Derived, not stored:**
```text
recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)
```
**Step-up is required only when `recent_auth_at` is older than 10 minutes.**

**Suspension, revocation or role revocation forces session revocation on the next action.** Tokens are stored as hashes only.

### 4.4 `RefreshTokenFamily`
`id` · **`subject_type`** · `subject_id` · `created_at` · `revoked_at` · `revocation_reason`. Rotating family; **replay of a consumed token revokes the whole family**.

### 4.5 `DeviceSession`
`id` · **`subject_type`** · `subject_id` · `device_label` · `first_seen_at` · `last_seen_at` · `revoked_at`. Supports the citizen requirement to **log out from all devices**.

### 4.6 `ConsentRecord`
`id` · `citizen_account_id` · `consent_type` · `consent_version` · `granted_at` · `withdrawn_at` · `locale`.

**`consent_type` values:** `account_creation_and_processing` *(required)* · `voice_processing` *(required)* · `sms_notification` *(optional, withdrawable)*.

> **These must never be combined into one checkbox.** Required processing and optional SMS notification are different decisions with different consequences. **Withdrawing SMS consent does not deactivate the account.**

### 4.7 Pre-authentication consent

**`ConsentRecord` requires a `citizen_account_id` — and no account exists before OTP verification. An authenticated `POST /citizen/consent` at that point is impossible.**

**The corrected flow:**

1. `CIT-01` — choose Urdu or English
2. `CIT-02` — read why the mobile number **and the voice recording** are required
3. `CIT-03` — make the required and optional consent choices
4. **Choices are held as a `pending_consent` payload on the device**, carrying `consent_version`, the selected options and a client-generated `pending_consent_ref`
5. Citizen enters the mobile number — `pending_consent_ref` accompanies the OTP request and is stored on `OTPChallenge`
6. Citizen verifies the OTP
7. Backend creates **or** authenticates the `CitizenAccount`
8. **In the same transaction, or immediately afterward, the recorded consent version is bound to the authenticated account**, creating the `ConsentRecord` rows
9. **Required** and **optional SMS** consents are stored as **separate rows**

| Concern | Rule |
|---|---|
| **Abandonment** | If the OTP is never verified, the challenge expires and **no `CitizenAccount` and no `ConsentRecord` are created**. The device payload is discarded |
| **Retry** | Re-requesting an OTP reuses the same `pending_consent_ref`. **A changed consent selection produces a new ref** |
| **Audit** | `consent_recorded` is written **after** account creation. **No consent event exists before an account does** |
| **Withdrawal** | `sms_notification` may be withdrawn at any time **without losing the account** |

**Voice-processing disclosure at `CIT-02` must state:** the original voice recording is stored · AI processes the voice · **the AI output may contain errors** · the citizen reviews the Urdu rendering before submission · **use of an external AI provider is `TBD — Hassan decision required`**.

> **No document in this set names an AI provider, a hosting location or a legal approval.** None has been selected or obtained.

## 5. Draft pipeline and reporting entities

### 5.1 `ClientSubmission` — the draft pipeline

| Aspect | Detail |
|---|---|
| **Purpose** | The **pre-submission draft**. Idempotency and duplicate prevention. **A queued draft is not a report** |
| **Key fields** | `client_submission_id` *(client-generated uuid)* · **`reporter_subject_type`** (`citizen` / `staff`) · `reporter_account_id` · `acting_role_assignment_id` *(staff only)* · `payload_hash` · `first_seen_at` · `resulting_report_id` *(nullable)* · **`pipeline_state`** |
| **`pipeline_state` enum** | `LOCAL_DRAFT` · `WAITING_FOR_CONNECTION` · `UPLOADING` · `TRANSCRIPTION_PROCESSING` · **`AWAITING_REPORTER_REVIEW`** · `READY_TO_SUBMIT` · `SUBMISSION_FAILED` |
| **Uniqueness** | **`client_submission_id` UNIQUE** |
| **Critical rules** | **These are draft/pipeline states, not civic case states.** A retry with the same id and identical payload returns the original result and **creates no second report**. **No official report reference exists until the backend creates the `CivicReport`** |
| **Retention** | Retained while the retry window is open — **window length `TBD — Hassan decision required`** |

> **Renamed at rev 1.3.** `AWAITING_CITIZEN_REVIEW` → **`AWAITING_REPORTER_REVIEW`**, because the same pipeline serves citizen reporters and authorised staff official reporters. **`reporter_subject_type` is added** so the pipeline is never ambiguous about who must confirm.

### 5.2 `VoiceTranscriptionArtifact`

| Aspect | Detail |
|---|---|
| **Purpose** | Holds the AI outputs derived from the reporter's speech, **versioned and clearly separated from the original recording** |
| **Key fields** | `id` · `client_submission_id` · **`source_audio_evidence_id`** · `detected_languages[]` · **`source_asr_text`** · **`urdu_civic_rendering`** · **`rendering_content_hash`** · `critical_fields_json` · `field_confidence_json` · `overall_confidence` · `model_name` · `model_version` · `processing_started_at` · `processing_completed_at` · `processing_status` · `failure_code` · **`rendering_version`** · **`is_active_version`** · `human_review_status` · `human_reviewed_by_account_id` · **`supersedes_artifact_id`** · `created_at` |
| **`processing_status`** | `QUEUED` · `PROCESSING` · `COMPLETED` · `FAILED` · **`REVIEW_REQUIRED`** |
| **`human_review_status`** | `NOT_REQUIRED` · `PENDING` · `IN_REVIEW` · `COMPLETED` |
| **Uniqueness** | **Exactly one artefact per `client_submission_id` has `is_active_version = true`**; superseded versions retained via `supersedes_artifact_id` |
| **Indexes** | (`client_submission_id`, `rendering_version`) · (`client_submission_id`, `is_active_version`) · `processing_status` |

**Rules:**

| # | Rule |
|---|---|
| 1 | **The original recording is never overwritten.** `source_audio_evidence_id` points at an immutable `EvidenceObject` |
| 2 | **AI outputs are versioned.** A correction creates a **new version**, linked by `supersedes_artifact_id` |
| 3 | **Previous versions remain traceable.** Nothing is deleted or silently replaced |
| 4 | **`rendering_content_hash` is computed over the canonicalised `urdu_civic_rendering`** and is what a confirmation must match — §5.3 |
| 5 | **`model_name` and `model_version` are recorded** on every artefact |
| 6 | **Low-confidence fields remain identifiable** through `field_confidence_json` |
| 7 | Staff can see whether a rendering is **AI-generated, reporter-confirmed, or human-reviewed** |
| 8 | **No AI output is ever labelled as the original speech** |
| 9 | **`processing_status = REVIEW_REQUIRED` never permits a `CivicReport` to be created.** It marks a draft needing authorised human review; **the original reporter must still confirm the resulting version** — §5.4 |
| 10 | Access follows §11 of the RBAC matrix. **The intermediate ASR output is not returned to citizens or contractors** |
| 11 | Retention follows the approved policy — **`TBD — legal or institutional review required`** |

**Three artefacts, three meanings — never conflated:**

| Artefact | Field | What it is |
|---|---|---|
| **Original voice recording** | `source_audio_evidence_id` → `EvidenceObject` | What the reporter actually said. **Immutable while retained. The authoritative source** |
| **Intermediate source-language ASR output** | `source_asr_text` | AI speech-to-text. **The text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output.** AI-generated, not a verified human statement. **Withheld from citizens and contractors** |
| **Urdu-script civic rendering** | `urdu_civic_rendering` | The standardised Urdu-script representation. **May involve transcription, transliteration, normalisation or translation.** Labelled AI-generated until reporter confirmation |

> **An English-to-Urdu transformation is translation and normalisation, not word-for-word transcription.**
>
> **Roman Urdu is a written representation of Urdu in Latin script, not a spoken language.** Spoken input is **Urdu, Punjabi, English or natural code-switched speech**.

**Critical fields captured in `critical_fields_json`:** location · street, ward, village or UC · issue category · severity · time · dates · quantities · **negation** · affected infrastructure · safety risk · affected people · evidence references.

**On low confidence:** preserve the original recording → mark the uncertain field → ask a **short targeted confirmation question** → allow replay or re-recording → **never guess** → set `human_review_status = PENDING` if unresolved.

### 5.3 `RenderingConfirmation` — new at rev 1.3

| Aspect | Detail |
|---|---|
| **Purpose** | Binds a reporter's confirmation to **one exact rendering version**, so a cached or offline client cannot confirm obsolete text |
| **Key fields** | `id` · **`voice_transcription_artifact_id`** · **`client_submission_id`** · **`rendering_version`** · **`rendering_content_hash`** · **`reporter_subject_type`** (`citizen` / `staff`) · **`reporter_account_id`** · `acting_role_assignment_id` *(staff only)* · **`confirmed_at`** · **`idempotency_key`** · `resulting_report_id` *(nullable)* · `client_app_version` |
| **Uniqueness** | **`idempotency_key` UNIQUE** · **at most one confirmation per (`client_submission_id`) may hold a non-null `resulting_report_id`** |
| **Indexes** | `idempotency_key` · (`client_submission_id`, `rendering_version`) |

**Server-side verification — all six must pass:**

| # | Check | On failure |
|---|---|---|
| 1 | The artefact **belongs to the authenticated reporter's own draft** | Denied — ownership |
| 2 | The rendering is the **active version** (`is_active_version = true`) | **Documented conflict error** |
| 3 | The supplied **`rendering_content_hash` matches** the stored value | **Documented conflict error** |
| 4 | The rendering **has not been superseded** | **Documented conflict error** |
| 5 | The confirmation **has not already produced another report** | Idempotent replay returns the original result |
| 6 | The **`idempotency_key` cannot create a duplicate `CivicReport`** | Idempotent replay returns the original result |

> **A stale confirmation is rejected with a documented conflict error, and the client must retrieve the latest rendering before retrying.** **The server never silently accepts an older version and never silently upgrades the confirmation to a newer one.**

> **Authority:** `CAP_RENDERING_CONFIRM_OWN`. **A citizen may confirm only their own citizen draft; an authorised staff reporter may confirm only their own official draft. Nobody confirms on another person's behalf** — not a reviewer, not an administrator, not a Mayor & Ops user, not the Technical System Administrator.

`DEFERRED — define during the portal use-case phase`: the exact screen interaction when a stale confirmation is rejected.

### 5.4 AI-processing failure — the contradiction resolved

**Revision 1.2 allowed submission flagged `TRANSCRIPTION_REVIEW_REQUIRED` while also requiring reporter confirmation. Those cannot both hold. The submission bypass is withdrawn.**

| # | Rule |
|---|---|
| 1 | AI-processing failure **preserves the encrypted draft and the original recording** |
| 2 | The draft **remains a `ClientSubmission`** — no `CivicReport` is created |
| 3 | The reporter may later **retry or re-record** |
| 4 | Where authorised human transcript review is available, the reviewer may **produce or correct a new Urdu-rendering version** |
| 5 | **The rendering returns to the original reporter for confirmation** |
| 6 | **No staff reviewer confirms on the reporter's behalf** |
| 7 | A `CivicReport` is created **only after the original reporter confirms the current active version** |
| 8 | AI failure **must never create plausible replacement text** |
| 9 | **Audio-only official submission is not part of Release 0** |

**`REVIEW_REQUIRED` is a `VoiceTranscriptionArtifact.processing_status` and a draft-review status only. It is never a `CivicReport` lifecycle state.**

### 5.5 `CivicReport` — the single lifecycle record

`id` · `report_reference` *(human-readable, non-sequential, **issued in the same transaction that creates this row**)* · `client_submission_id` · `reporter_kind` (`citizen` / `staff_official`) · `citizen_account_id` *(nullable)* · `official_reporter_account_id` *(nullable)* · `official_reporter_role_assignment_id` *(nullable)* · `category` · **`confirmed_rendering_artifact_id`** · **`confirmed_rendering_version`** · **`rendering_confirmation_id`** · `location` · `uc_scope_id` · **`state`** · `state_version` · `created_at`.

**`state` enum — 15 values, `DRAFT` removed:**
`SUBMITTED` · `UNDER_VERIFICATION` · `VERIFIED` · `UC_REVIEW` · `ACCEPTED` · `CONTRACTOR_ASSIGNED` · `IN_PROGRESS` · `COMPLETION_SUBMITTED` · `COMPLETION_VERIFICATION` · `PENDING_CITIZEN_CONFIRMATION` · `RESOLVED_CONFIRMED` · `CLOSED` · `REOPENED` · `REJECTED` · `CANCELLED`.

**Twelve of these are the canonical happy-path lifecycle; `REOPENED`, `REJECTED` and `CANCELLED` are exception states.**

#### 5.5.1 Atomic creation

```text
ClientSubmission.READY_TO_SUBMIT
        │
        └──▶  one server transaction
                 ├─ verify the RenderingConfirmation (all six checks, §5.3)
                 ├─ verify required evidence
                 ├─ create CivicReport(state = SUBMITTED)
                 ├─ issue report_reference
                 ├─ bind confirmed_rendering_artifact_id + confirmed_rendering_version
                 ├─ record ReportOwnership
                 ├─ create ConflictExclusion when reporter_kind = staff_official
                 └─ append AuditEvent
        All succeed, or none happens.
```

**`DRAFT` is not a `CivicReport` state.** **The transition `pipeline → DRAFT → SUBMITTED` is withdrawn.** **A `CivicReport` cannot be created in any state other than `SUBMITTED`.**

> **Exactly one attribution shape is valid**, enforced by CHECK: `citizen` ⇒ `citizen_account_id` NOT NULL and both official fields NULL; `staff_official` ⇒ both official fields NOT NULL and `citizen_account_id` NULL. **No placeholder or shared account may be created to satisfy a foreign key.**

> **`CivicReport` is the principal record throughout the entire lifecycle.** After acceptance it may be **described to users** as an accepted case. **There is no separate `CivicCase` entity.**

**Indexes:** `report_reference` UNIQUE · `client_submission_id` UNIQUE · (`citizen_account_id`, `created_at`) · (`uc_scope_id`, `state`).
**Critical rule:** **`citizen_account_id` is never returned to `REP`, `CON` or `UCO`.**

### 5.6 `ReportOwnership`
`report_id` · `subject_type` · `subject_id` · `established_at`. Ownership is a **first-class check, not an inference**. **A client-supplied report ID never authorises access.**

### 5.7 `EvidenceObject`
`id` · `report_id` / `client_submission_id` · `kind` (`photo` / `video` / **`voice_original`**) · `storage_key` *(opaque — **never contains a phone number, account ID or name**)* · `sha256` · `mime_type` · `bytes` · `captured_at` · `capture_confidence` · `derived_from_id` · `uploaded_by_kind` · `deleted_at` · `deletion_tombstone_id`.

Write-once storage; access via **short-lived, single-use, session-bound URLs**. **No public bucket URL, ever.**

**Retention wording — exact:**

- **Original audio is immutable while retained.**
- **Original audio and the confirmed rendering remain traceably linked throughout the approved retention period.**
- **Raw audio is deleted according to the approved retention policy.**
- **A permitted non-reversible hash, deletion tombstone and audit event may remain after deletion.**
- **A hash or tombstone must never be described as recoverable audio.**

> **`TBD — legal or institutional review required`: the raw-audio retention duration.** No duration is stated, implied or assumed.

> **`DR-28` — RESOLVED 3 October 2026 by the Project Lead's instruction. A photo is NOT required.**
>
> **Decision made now under instruction, not recovered from an earlier source.** Previous text: *"`TBD — Hassan decision required`: is at least one live photo required…"* — retained here as the superseded question.
>
> | Rule | Detail |
> |---|---|
> | **Citizen submission** | **At least one photo is encouraged and prompted, but never required.** A report with a sufficient description and a resolvable location is submittable with **no photo** |
> | **Minimum submittable content** | **A locatable position + an intelligible description in at least one modality** — confirmed voice rendering **or** typed text. **Both are never required together** |
> | **Reviewer visibility** | `CivicReport.evidence_completeness` ∈ `{none, partial, photographic}` is **derived server-side and shown to the Street Representative and UC Officer**. **Absent evidence is surfaced, never hidden** |
> | **Request for more** | A reviewer may raise a clarification requesting a photo. This uses the **existing** clarification path — **no new state, no new entity** |
> | **Unchanged** | **Contractor completion evidence remains REQUIRED** (`T8`) and **completion verification evidence remains REQUIRED** (`T10`). `DR-28` changes citizen intake only |
>
> **"Optional photo" does not mean "evidence irrelevant."** The voice recording, the confirmed Urdu rendering, the location and the timestamp are all evidence and all still captured.

### 5.8 Workflow entities

| Entity | Key fields | Notes |
|---|---|---|
| `CaseAssignment` | `id` · `report_id` · `contractor_organization_id` · `assigned_by` · `assigned_at` · `accepted_at` · `declined_at` · `decline_reason` · `response_deadline` · `status` | Eligibility re-checked at assignment **and** acceptance |
| `Verification` | `id` · `report_id` · `verification_kind` (`field` / `completion`) · `verified_by_account_id` · `role_assignment_id` · `outcome` · `note` · `evidence_ids[]` · `created_at` | **`verified_by_account_id` ≠ the reporter account** |
| `ContractorProgress` | `id` · `report_id` · `note` · `percent` · `evidence_ids[]` · `created_at` | Append-only |
| `CompletionEvidence` | `id` · `report_id` · `submitted_by_account_id` · `evidence_ids[]` · `note` · `submitted_at` | **Submitter excluded from verifying it** |
| `CitizenConfirmation` | `id` · `report_id` · `citizen_account_id` · `outcome` · `reason` · `created_at` | Reporter only |
| `Dispute` | `id` · `report_id` · `raised_by_account_id` · `reason` · `evidence_ids[]` · `handled_by_account_id` · `handling` · **`appeal_status`** · `appeal_decided_by_account_id` · `appeal_outcome` · `appeal_decided_at` | **`appeal_status ∈ { NOT_FILED · FILED · UNDER_REVIEW · DECIDED }`.** Initial handling: UC Officer. **Formal appeal: an independent Mayor/Ops actor who was not a prior actor.** **No pseudo-state such as `REOPENED → (appeal)` exists** |
| `Notification` | `id` · `recipient_kind` · `recipient_id` · `channel` (`in_app` / `sms`) · `template_key` · `sent_at` · `read_at` | **SMS only with consent. Body never contains the phone number or report content** |

### 5.9 `ProtectedContactRequest`

| Aspect | Detail |
|---|---|
| **Purpose** | Lets an authorised Mayor/Ops user message a citizen **without ever seeing a number** |
| **Key fields** | `id` · `report_id` · `requested_by_account_id` · `acting_role_assignment_id` · `purpose_code` · `template_key` · `message_body_ref` · `channel_used` · `sent_at` · `delivery_status` |
| **Channel rule** | **If the citizen consented to SMS notification, an authorised message may go by SMS. Otherwise in-app notification only.** Emergency or legally required messaging without consent is **`TBD — legal or institutional review required`** |
| **Authorisation** | `CAP_PROTECTED_CONTACT` + **step-up OTP** |
| **Audit** | `protected_contact_sent`. **No phone number in the event** |

### 5.10 `ConflictExclusion`
`id` · `report_id` · `excluded_staff_account_id` · `reason` · `created_at`.
**Keyed on the account, never the role assignment.** **Retained permanently — a later role grant does not clear it.** **Created automatically when `reporter_kind = staff_official`.**

### 5.11 `AuditEvent`
`id` · `sequence` · `chain_segment` · `prev_hash` · `hash` · `actor_kind` (`citizen` / `staff` / `system`) · `actor_account_id` · `acting_role_assignment_id` · `action` · `report_id` · `client_submission_id` · `reason` · `prev_state` · `new_state` · `correlation_id` · `created_at`.

**Append-only via the audit-writing service.** **No actor, service or role may edit or delete an existing event.** **No audit event text may contain a phone number, OTP, password, token or unrestricted rendering content.**

## 6. Legacy entities — removed from active design

| Entity | Disposition |
|---|---|
| `AnonymousAccessGrant` · `SubmissionRecovery` | **Removed.** Retained in Database Architecture v2.7 as superseded records |
| `UploadSession` *(anonymous form)* | **Replaced** by an upload session bound to the authenticated session |
| `MfaEnrolment` · `MfaRecoveryCode` | **Removed.** SMS OTP stores no per-user secret |
| `Participant` · `IdentityVaultRecord` · `AttestationRecord` | **Replaced** by the account + credential pairs above |
| `CivicCase` | **Never created.** `CivicReport` holds the whole lifecycle |

**No claim is made that data exists in any of these.**

## 7. Entity totals — recalculated

| Group | Entities | Count |
|---|---|---|
| Identity and account | `CitizenAccount`, `CitizenPhoneCredential`, `StaffAccount`, `StaffCredential`, `Organization`, `ContractorOrganization` | **6** |
| Authorisation | `Role`, `RoleAssignment`, `GeographicScope` | **3** |
| Authentication | `AccountInvitation`, `OTPChallenge`, `AuthSession`, `RefreshTokenFamily`, `DeviceSession`, `ConsentRecord` | **6** |
| Draft, reporting and workflow | `ClientSubmission`, `VoiceTranscriptionArtifact`, **`RenderingConfirmation`**, `CivicReport`, `ReportOwnership`, `EvidenceObject`, `CaseAssignment`, `Verification`, `ContractorProgress`, `CompletionEvidence`, `CitizenConfirmation`, `Dispute`, `Notification`, `ProtectedContactRequest`, `ConflictExclusion` | **15** |
| Audit | `AuditEvent` | **1** |
| **Total active** | | **31** |

**Arithmetic shown:** `6 + 3 + 6 + 15 + 1 = 31`. **Change from rev 1.2: 30 → 31.** Only `RenderingConfirmation` was added. **Renaming `official_identifier` to `staff_reference` and removing `DRAFT` from an enum add no entity.**

## 8. Account realms — unresolved

> **`TBD — Hassan decision required`: may an official staff user use the same mobile number for a separate citizen account?**

| Option | For | Against |
|---|---|---|
| **Allow in both realms** | Staff are also residents and should be able to report personal civic issues | Complicates conflict detection; a shared family phone can create false identity assumptions |
| **Automatically link the accounts** | Makes conflict detection trivial | **Reduces privacy** — personal reports become linkable to the official identity |
| **Forbid in both realms** | Clean separation | Forces a second SIM, which many will not obtain; they simply will not report |

**Regardless of the answer:** official staff reporting is supported through `STF-10` and **permanently creates an account-level `ConflictExclusion`**. That mechanism does not depend on this decision.

**Until decided:** uniqueness is **scoped per realm** — unique among citizens, unique among staff. **Cross-realm uniqueness is neither enforced nor prohibited.**

## 9. Retention

| Data | Retention | Basis |
|---|---|---|
| `AuditEvent` | **Never deleted** | Accountability |
| Evidence provenance (hash, manifest, tombstone) | **Retained after raw-media disposal.** **Never described as recoverable audio** | Integrity |
| **Original voice audio** | **Immutable while retained.** Deleted according to the approved retention policy | **`TBD — legal or institutional review required`** |
| **`VoiceTranscriptionArtifact` versions** | Retained with the report; superseded versions traceable | **`TBD — legal or institutional review required`** |
| **`RenderingConfirmation`** | Retained with the report — it is the evidence that the reporter approved this exact text | Accountability |
| Raw photo/video evidence | Deleted according to the approved retention policy, with a tombstone | **`TBD — legal or institutional review required`** |
| `CitizenPhoneCredential` | Destroyed on account deletion | **`TBD — legal or institutional review required`** |
| `OTPChallenge` | Deleted shortly after consumption or expiry | Minimisation |
| `ClientSubmission` | Retained while the retry window is open | **`TBD — Hassan decision required`** |
| IP / abuse identifiers | Short bounded window, keyed HMAC only | Minimisation |

## 10. Related tests

`TEST-DATA-001` duplicate OTP verification creates no duplicate `CitizenAccount` · `002` offline retry creates no duplicate report · `003` queued draft holds no `CivicReport` and no official reference · `004` `citizen_account_id` absent from `REP`/`UCO`/`CON` responses · `005` contractor packet contains no citizen identity · `006` phone number absent from all logs · `007` protected contact respects SMS consent · `008` audit event contains no phone number, OTP, password or unrestricted rendering content · `009` no actor can update or delete an `AuditEvent` · `010` SYSADMIN integrity check returns no civic content · `011` original recording is never overwritten by AI output · `012` a correction creates a new `rendering_version`, prior versions traceable · `013` `model_name` and `model_version` recorded on every artefact · `014` low-confidence fields are individually identifiable · `015` AI failure preserves draft and original recording and creates no report · `016` abandoned pre-auth consent creates no `CitizenAccount` and no `ConsentRecord` · `017` required and optional consent stored as separate rows · `018` withdrawing SMS consent leaves the account active · `019` `preferred_language` accepts only `ur` and `en` · `020` `RefreshTokenFamily` and `DeviceSession` carry `subject_type` · `021` **`CivicReport.state` has no `DRAFT` value** · `022` **a `CivicReport` can be created only in `SUBMITTED`** · `023` **a stale `rendering_content_hash` is rejected with a conflict error** · `024` **a superseded `rendering_version` cannot be confirmed** · `025` **a replayed `idempotency_key` returns the original report, never a second one** · `026` **`staff_reference` is never accepted as a login identifier** · `027` **`REVIEW_REQUIRED` cannot produce a `CivicReport` without reporter confirmation** · `028` **contractor response contains no `voice_original` reference and no `source_asr_text`**.

**Every test above: `Specified; not implemented; not executed`.**

---

*Specified; not implemented; not tested. No schema exists, no migration has been written or run. No AI model, provider or hosting location has been selected.*
