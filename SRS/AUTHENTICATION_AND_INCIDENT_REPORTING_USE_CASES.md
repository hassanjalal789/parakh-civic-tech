# Parakh — Authentication and Incident Reporting Use Cases

| Field | Value |
|---|---|
| **Document title** | Authentication and Incident Reporting Use Cases (UC-07 … UC-26) |
| **Version** | **1.2** |
| **Date** | 20 August 2026 |
| **Status** | **APPROVED.** Anonymous reporting adopted (CR-59, SRS v1.4.0) — **the seven blocked use cases are unblocked.** **Markdown is now the authoritative use-case source; PDF is generated output** (TBD-A09, approved). **Specified, not implemented** |
| **Owner** | Hassan Jalal — Founder & Project Lead |
| **Governing source** | `Parakh_Prototype_SRS_v1.4.2.md` — **governs where this document differs** |
| **Companion document** | `docs/security/AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` v0.1 |
| **Source-control note** | New file. **No existing use case was renumbered, edited or deleted.** |

---

## Integration status — read first

The master Use Case Document is `Parakh_Use_Case_Document_v1.0.pdf`, generated from `usecase/uc1.md` and `usecase/uc2.md`, which contain build-pipeline HTML (`<span class="tag tag-p1">`). Editing those fragments risks breaking the PDF build and creating a second source of truth.

**Therefore:** these use cases were written to a separate file with IDs **UC-07 … UC-26**, which do not collide with the existing **UC-01 … UC-06**.

> ### **TBD-A09 RESOLVED: Markdown is the authoritative use-case source; the PDF is generated output.**
> **UC-01 … UC-26 are one logical set.** UC-01 … UC-06 remain in `usecase/uc1.md` / `uc2.md`; UC-07 … UC-26 are here. **No renumbering occurred.**
>
> **The PDF was not rebuilt.** No document-generation workflow is available in this environment, and **fabricating a rebuilt PDF would be dishonest.** `Parakh_Use_Case_Document_v1.0.pdf` is now **stale** and must be regenerated from Markdown before circulation.

### Existing use cases — unchanged

| ID | Name | Phase per the existing document |
|---|---|---|
| UC-01 | Citizen Reporting | Phase 1 |
| UC-02 | Street / Community Representative | Phase 1 |
| UC-03 | Union Council Officer / UC Operations | **Future institutional capability** |
| UC-04 | Contractor / Thekedar | **Future institutional capability** |
| UC-05 | Mayor & Operations Command | **Future institutional capability** |
| UC-06 | Human Moderation | Phase 1 — governance layer |

### New use cases and their build status

| ID | Name | Status |
|---|---|---|
| UC-07 | Submit Anonymous Civic Incident | **APPROVED — CR-59.** Specified, not implemented |
| UC-08 | Save and Submit Offline Incident Draft | **APPROVED.** Draft bound to the **app installation**, not a participant |
| UC-09 | Receive Anonymous Report Receipt | **APPROVED — CR-59** |
| UC-10 | Track Anonymous Report | **APPROVED — CR-59.** Gated by **reporter entitlement** |
| UC-11 | Respond to Clarification Request | **APPROVED.** Expiry **14 days** (TBD-A10) |
| UC-12 | Confirm Report Resolution | **APPROVED.** Reporter entitlement, not identity |
| UC-13 | Dispute Claimed Resolution | **APPROVED. No hard dispute cap** (TBD-A12) |
| UC-14 | Invite and Activate Staff User | **Release 0 — buildable now** |
| UC-15 | Authenticate Staff User | **Release 0 — buildable now** |
| UC-16 | Enrol and Verify MFA | **Release 0 — buildable now** |
| UC-17 | Assign Role and Geographic Scope | **Release 0 — buildable now** |
| UC-18 | Switch Between Multiple Authorized Roles | **Release 0 — buildable now** |
| UC-19 | Modify, Suspend, Expire or Revoke Role Assignment | **Release 0 — buildable now** |
| UC-20 | Recover Staff Credentials | **Release 0 — buildable now** |
| UC-21 | Register and Approve Contractor Organization | **Future — `SC-FUT-02`** |
| UC-22 | Invite Street Representative | **Release 0** (ADM/MOD invites); officer path is Future |
| UC-23 | Authenticated Staff Member Reports an Incident | **Release 0 — buildable now** |
| UC-24 | Prevent Self-Verification and Conflicts of Interest | **Release 0 — buildable now** |
| UC-25 | Handle Unauthorized Access Attempt | **Release 0 — buildable now** |
| UC-26 | Review Authentication and Permission Audit History | **Release 0 — buildable now** |

**All twenty are now specified and unblocked.** Thirteen were already buildable; the seven anonymous use cases were unblocked by CR-59. **None is implemented.**

---

# Part A — Anonymous citizen reporting (APPROVED — CR-59)

> **APPROVED at SRS v1.4.0 (CR-59).** `C-6` → **`C-6a`**, `BR-007` → **`BR-007a`**, `FR-AUTH-004` amended, and `TEST-AUTH-004` / `TEST-PRV-004` **rewritten** — they previously asserted the absence of this capability. Governed by **`FR-ANON-001`…`008`**, **`DR-20`** and entity `AnonymousAccessGrant`. **Specified; not implemented, not tested.**

---

## UC-07 — Submit Anonymous Civic Incident

| Field | Content |
|---|---|
| **ID** | UC-07 |
| **Name** | Submit Anonymous Civic Incident |
| **Goal** | A citizen reports a civic incident with evidence without creating an account or disclosing identity |
| **Primary actor** | Citizen (unauthenticated) |
| **Supporting actors** | Backend validation service · Evidence store · Moderator (downstream) |
| **Trigger** | Citizen observes a civic problem and opens Parakh |
| **Preconditions** | App installed; **no account, no login, no identifier of any kind**; device camera available for live capture |
| **Postconditions** | A `CivicReport` exists in `SUBMITTED`; an `EvidenceManifest` is committed with its context; a report reference and a one-time secret tracking token are issued; **no identity is recorded** |
| **Main success flow** | 1. Open Parakh — no authentication prompt. 2. Read privacy and **non-emergency** notice. 3. Select category. 4. Provide description (voice primary per `FR-VOI-001`; text alternative subject to TBD-A04). 5. Confirm location on map. 6. Capture evidence **live in-app only** (`BR-002`, `FR-EVD-001` — no gallery, no share intent). 7. Review privacy preview: faces, number plates, voices, house numbers. 8. Optionally redact; metadata stripped except capture time. 9. Review the whole report. 10. Submit. 11. Server validates, checks files, applies duplicate heuristics and rate limits. 12. Evidence committed atomically with its context. 13. Report created; reference + token issued once. |
| **Alternative flows** | **A1** Offline → UC-08. **A2** Location permission refused → manual pin, `location_unverified` (`FR-EVD-102`, `E_LOCATION_DENIED`). **A3** Poor accuracy → `E_LOCATION_INACCURATE`, citizen adjusts. **A4** Citizen declines redaction → submission proceeds; warning acknowledgement recorded. **A5** Device clock unverified → `E_TIME_UNVERIFIED`; report still accepted |
| **Exception flows** | **E1** Upload interrupted → same `UploadSession` resumes from last acknowledged chunk (`FR-OFF-007`); **no report created**. **E2** Manifest mismatch → `E_CAPTURE_INTEGRITY`; bundle **quarantined, retained, flagged**, never deleted (`FR-EVD-201`); no report created. **E3** Rate limit exceeded → generic refusal; **no indication whether the report was novel**. **E4** File type mismatch → rejected (mirrors `TEST-SEC-017`). **E5** Emergency category → emergency notice re-displayed; report flagged for priority moderation |
| **Business rules** | `BR-002` live capture only · `BR-003` evidence integrity · **`BR-007` — CONFLICT: currently requires a verified participant** · `BR-009` data minimisation |
| **Data created/modified** | `CivicReport` · `EvidenceItem` · `EvidenceManifest` · `UploadSession` · **`AnonymousAccessGrant` (NEW)** · `CaseStatusEvent` (T1) · `AuditEvent` |
| **Permissions required** | **None** — public, rate-limited endpoint |
| **Privacy controls** | No identity collected · privacy preview before submission · EXIF stripped except capture time · optional redaction as a **derived** evidence item, original retained · location coarsening option · explicit warning that content may still identify the reporter |
| **Security controls** | Rate limiting by IP and coarse geo-cell (IP hashed, short retention) · magic-byte file validation · size and dimension caps · TLS · server-side validation only · atomic evidence commitment |
| **Audit events** | `report_submitted` · `upload_session_opened` · `evidence_committed` |
| **Acceptance criteria** | **Given** no account and no login, **when** a citizen completes the flow, **then** a report exists in `SUBMITTED`, a reference and a ≥128-bit token are returned exactly once, the token is stored **hashed only**, and **no field in the record identifies the reporter**. **And** the privacy warning was displayed before capture |
| **Related requirements** | `FR-EVD-001` · `FR-EVD-004` · `FR-EVD-102` · `FR-EVD-201` · `FR-EVD-202` · `FR-VOI-001` · `FR-CIT-105` · **`FR-AUTH-004` — CONFLICT** · `C-6` — **CONFLICT** |
| **Related API operations** | `API-020` open upload session · `API-021` chunk · `API-022` finalise · `API-030` create report — **all currently require a bearer token** |
| **Open questions** | **TBD-A01** adopt anonymous reporting? · **TBD-A04** text alternative vs voice-primary · **TBD-A03** grant expiry |

---

## UC-08 — Save and Submit Offline Incident Draft

| Field | Content |
|---|---|
| **ID** | UC-08 |
| **Name** | Save and Submit Offline Incident Draft |
| **Goal** | A citizen composes a report without connectivity and transmits it later without duplication |
| **Primary actor** | Citizen |
| **Supporting actors** | Device keystore · Backend |
| **Trigger** | Citizen begins a report while offline, or connectivity drops mid-capture |
| **Preconditions** | Sufficient device storage; app permitted to use the camera |
| **Postconditions** | Draft encrypted on-device and queued; on reconnection exactly one report is created |
| **Main success flow** | 1. Citizen composes report offline. 2. Draft and media stored **encrypted at rest on the device using a key in the platform keystore**, never in shared storage (`FR-OFF-002`). 3. Queue item state `DRAFT` → `QUEUED`. 4. On reconnection, item moves to `UPLOADING`. 5. Client attaches a client-generated **idempotency key bound to a payload hash** (`FR-OFF-006`). 6. Chunks upload resumably. 7. Manifest verified server-side. 8. Report created. 9. Queue item → `SYNCED`; receipt delivered |
| **Alternative flows** | **A1** Connectivity drops mid-upload → **same session, same manifest**, resumes from last acknowledged chunk; **no new manifest**. **A2** Multiple queued items → transmitted in order, each with its own idempotency key. **A3** Session expired → new session, chunks re-sent, **new manifest referencing the superseded attempt** |
| **Exception flows** | **E1** Local integrity check fails → item → `QUARANTINED`, **not uploaded, not deleted**, citizen informed and offered replacement (`FR-OFF-010`, `E_HASH_MISMATCH_LOCAL`). **E2** Storage exhausted → capture blocked with a clear message; existing queue preserved. **E3** Retry after long offline period → idempotency record may have expired (`TBD-024` proposes 30 days, **still open**) → possible duplicate, surfaced to a Moderator. **E4** Permanent failure → `FAILED_PERMANENT`; item retained for diagnostics |
| **Business rules** | `BR-002` · `BR-003` · `BR-024` idempotency |
| **Data created/modified** | Device-local queue *(**not** a server entity — see `DATABASE_ARCHITECTURE.md` §7)* · `IdempotencyRecord` · `UploadSession` · `CivicReport` |
| **Permissions required** | None (anonymous) / own participant (authenticated variant) |
| **Privacy controls** | Queue encrypted on device; **queue belongs to one participant and is inaccessible to another on a shared device** (`FR-OFF-002`) |
| **Security controls** | Key in platform keystore · no shared-storage writes · idempotency bound to payload hash · resumable upload with acknowledged-offset tracking |
| **Audit events** | `report_submitted` on arrival · `queue_item_quarantined` on local failure |
| **Acceptance criteria** | **Given** three transmissions of one queued report, **when** all three arrive, **then** exactly one report exists and `NFR-REL-004` (*"duplicate cases created by retry shall be zero"*) holds. **And** a network retry creates **no** new manifest |
| **Related requirements** | `FR-OFF-002` · `FR-OFF-003` · `FR-OFF-006` · `FR-OFF-007` · `FR-OFF-010` · `NFR-REL-004` |
| **Related API operations** | `API-020` · `API-021` · `API-022` · `API-030` |
| **Open questions** | **TBD-024** idempotency retention window (SRS proposes 30 days, open) |

---

## UC-09 — Receive Anonymous Report Receipt

| Field | Content |
|---|---|
| **ID** | UC-09 |
| **Name** | Receive Anonymous Report Receipt |
| **Goal** | The citizen receives the only credential that will ever grant access to their report |
| **Primary actor** | Citizen |
| **Supporting actors** | Backend token service |
| **Trigger** | Report creation succeeds |
| **Preconditions** | UC-07 or UC-08 completed |
| **Postconditions** | Reference and token displayed **once**; token hash stored; **plaintext token never persisted, logged or re-displayable** |
| **Main success flow** | 1. Server generates a non-sequential **report reference** (e.g. `PKH-7Q4M-2XR9`) — a public label. 2. Server generates a **≥128-bit tracking token** from a CSPRNG, encoded in an unambiguous base32 alphabet, grouped for transcription. 3. Server stores **SHA-256(token)** only. 4. Both returned in the response body — **never in a URL**. 5. Client displays with an unambiguous warning: *"Save this now. It cannot be recovered."* 6. Client offers: copy, printable receipt, and optional storage in the device keystore with consent |
| **Alternative flows** | **A1** Citizen declines keystore storage → displayed only; onus explicit. **A2** Citizen requests re-display **within the same session before dismissal** → permitted. **A3** Printable receipt → includes reference and token, plus a warning that anyone holding the paper holds the access |
| **Exception flows** | **E1** Screen dismissed before saving → **token is unrecoverable. This is by design** (see `docs/security/…` §8.2). The report still proceeds; the citizen loses tracking. **E2** Client crashes before display → token hash exists with no holder; report proceeds untrackable; **no recovery path may be offered** |
| **Business rules** | No short PIN · no identity-based recovery · reference ≠ token |
| **Data created/modified** | **`AnonymousAccessGrant` (NEW)** — report ref · token hash · issued_at · expires_at · rotated_from · revoked_at |
| **Permissions required** | None — issued as part of creation |
| **Privacy controls** | Token bound to one report only · no identity linkage · no delivery channel that would require contact details |
| **Security controls** | CSPRNG ≥128 bits · **SHA-256 hash at rest** (fast hash is correct at this entropy — a memory-hard hash adds latency without security benefit) · never in URL, log or error message · single display |
| **Audit events** | `anonymous_grant_issued` — records the grant, **never the token** |
| **Acceptance criteria** | **Given** a completed submission, **when** the receipt is issued, **then** the token has ≥128 bits of entropy, appears in no log or URL, is stored only as a hash, and cannot be retrieved again by any endpoint or any role including Administrator |
| **Related requirements** | `FR-CIT-105` tracking reference · **new requirements needed for grant issuance** |
| **Related API operations** | Response of `API-030` (extended) |
| **Open questions** | **TBD-A03** expiry after case closure · **TBD-A01** |

---

## UC-10 — Track Anonymous Report

| Field | Content |
|---|---|
| **ID** | UC-10 |
| **Name** | Track Anonymous Report |
| **Goal** | The token holder views the status and history of exactly one report |
| **Primary actor** | Citizen (token holder) |
| **Supporting actors** | Backend |
| **Trigger** | Citizen wishes to check progress |
| **Preconditions** | Holds a valid, unexpired, unrevoked token |
| **Postconditions** | Status and permitted history returned for **one** report; access logged without identifying the holder |
| **Main success flow** | 1. Citizen enters reference and token. 2. Server hashes the token and looks up the grant. 3. **The grant resolves to exactly one report identifier; any report identifier supplied by the client is ignored.** 4. Server returns plain-language status, permitted timeline events and the citizen-visible evidence set |
| **Alternative flows** | **A1** Case in `PENDING_CONFIRMATION` → confirm/dispute actions offered (UC-12, UC-13). **A2** Open clarification request → response action offered (UC-11). **A3** Citizen rotates the token → new token issued, old grant revoked |
| **Exception flows** | **E1** Wrong token → **uniform failure identical to "no such report."** Distinguishing them creates an existence oracle. **E2** Expired grant → uniform failure. **E3** Repeated failures → rate limit by IP **and** by reference. **E4** Token believed compromised → citizen may rotate if they still hold it; **if they do not, nothing can be done** |
| **Business rules** | One grant → one report · no enumeration · no cross-report access · **reviewer identity never disclosed** |
| **Data created/modified** | Read-only, plus `AuditEvent` |
| **Permissions required** | Valid anonymous access grant — **not authentication, and never exchangeable for a session** |
| **Privacy controls** | **Citizen never sees reviewer or moderator identity** · internal notes never returned · other reports never reachable |
| **Security controls** | Token hashed on lookup · uniform error responses · dual rate limiting · token in request body/header only · grant expiry · rotation |
| **Audit events** | `anonymous_report_viewed` · `anonymous_access_failed` |
| **Acceptance criteria** | **Given** a valid token for report A, **when** the holder attempts to read report B by any means, **then** access is refused and the refusal is indistinguishable from "no such report." **And** the response contains no reviewer identity |
| **Related requirements** | `FR-CASE-101` citizen status view · `FR-CASE-103` plain-language states · `TEST-PRV-007` reviewer identity withheld |
| **Related API operations** | New token-bound group; analogous to `API-031` / `API-032` |
| **Open questions** | **TBD-A03** · **TBD-A08** post-closure visibility duration |

---

## UC-11 — Respond to Clarification Request

| Field | Content |
|---|---|
| **ID** | UC-11 |
| **Name** | Respond to Clarification Request |
| **Goal** | Staff obtain missing detail; the citizen supplies it **without either party learning the other's identity** |
| **Primary actor** | Citizen (token holder) |
| **Supporting actors** | Street Representative · Moderator · UC Officer *(Future)* |
| **Trigger** | A reviewer needs information the report does not contain |
| **Preconditions** | Report exists; reviewer is in scope and is **not** the submitter; an open clarification request exists |
| **Postconditions** | Response attached to the report; workflow resumes; identities not exchanged |
| **Main success flow** | 1. Reviewer raises a clarification request with a specific question. 2. Request is attached to the report. 3. Citizen sees it on next token-bound access. 4. Citizen responds with text, voice or additional **live-captured** evidence. 5. Response is committed with the same integrity handling as original evidence. 6. Reviewer sees the response, attributed to *"the reporter,"* never to a person |
| **Alternative flows** | **A1** Citizen adds evidence → new manifest with clarification context. **A2** Citizen responds "I don't know" → recorded; workflow proceeds. **A3** Second clarification → each request and response is a separate record |
| **Exception flows** | **E1** **No response ever received** → request expires after a configured period; **the case proceeds on available evidence and the non-response is recorded. The report is never closed *because* the citizen did not answer.** **E2** Citizen lost the token → cannot respond; case proceeds. **E3** Reviewer's scope revoked mid-request → request remains; another in-scope reviewer inherits it |
| **Business rules** | Reviewer must not be the submitter · citizen identity never disclosed to staff · reviewer identity never disclosed to citizen · non-response is not evidence of falsity |
| **Data created/modified** | **`ClarificationRequest` (NEW, P1)** · `EvidenceItem` · `EvidenceManifest` · `CaseStatusEvent` · `AuditEvent` |
| **Permissions required** | Staff: role + geographic scope + workflow state + not-submitter. Citizen: valid grant |
| **Privacy controls** | Bidirectional identity shielding · no contact channel established · response evidence goes through the same privacy preview |
| **Security controls** | Token-bound response only · live capture only · integrity verification · request expiry |
| **Audit events** | `clarification_requested` · `clarification_answered` · `clarification_expired` |
| **Acceptance criteria** | **Given** an open clarification request, **when** the citizen responds, **then** the response is attached, the reviewer sees it without any reporter identifier, and the citizen sees no reviewer name. **And** when no response arrives, the case proceeds and the non-response is recorded |
| **Related requirements** | `FR-MOD-004` needs-info (**P1**) · `FR-EVD-001` live capture · `FR-CASE-101` |
| **Related API operations** | Staff side analogous to `API-051`; citizen side token-bound |
| **Open questions** | Clarification expiry period — **`TBD — Hassan decision required` (TBD-A10)** |

---

## UC-12 — Confirm Report Resolution

| Field | Content |
|---|---|
| **ID** | UC-12 |
| **Name** | Confirm Report Resolution |
| **Goal** | The reporter confirms the problem is actually fixed |
| **Primary actor** | Citizen (reporter) |
| **Supporting actors** | Moderator · Administrator (proxy completion) |
| **Trigger** | Case reaches `PENDING_CONFIRMATION` after a completion claim |
| **Preconditions** | Case in `PENDING_CONFIRMATION`; actor is the reporter; **actor is not the completion submitter** (`FR-FIX-006`) |
| **Postconditions** | Case moves to a resolved state; `CitizenResolutionDecision` recorded; transition T9 appended |
| **Main success flow** | 1. Citizen is notified (or discovers on tracking) that completion is claimed. 2. Citizen reviews the before/after comparison (`API-072`) — which explicitly returns `no_automated_check:true`. 3. Citizen confirms. 4. Server checks state version, reporter identity and separation of duties. 5. `CitizenResolutionDecision` recorded; T9 applied |
| **Alternative flows** | **A1** Citizen disputes instead → UC-13. **A2** Citizen does not respond within the window → window lapses per `FR-CASE-002`; case resolves unconfirmed and **is labelled as such, not as confirmed** |
| **Exception flows** | **E1** Stale state version → `E_STALE_STATE` (409); client refreshes. **E2** Non-reporter attempts confirmation → refused; `unauthorised_access_attempt`. **E3** Completion submitter attempts to confirm → refused by `FR-FIX-006`. **E4** Reporter withdrew (authenticated variant) → window lapses |
| **Business rules** | `BR-016` citizen confirmation · `BR-029` separation of duties · **a claimed completion is never a resolution without a human act** |
| **Data created/modified** | `CitizenResolutionDecision` · `Case` state and version · `CaseStatusEvent` (T9) · `AuditEvent` |
| **Permissions required** | Reporter only, on own report, in `PENDING_CONFIRMATION` |
| **Privacy controls** | Before/after evidence shown to the reporter only; no reviewer or contractor identity disclosed |
| **Security controls** | Optimistic concurrency on the case version · separation-of-duties check · **server-side reporter comparison, never client-asserted** |
| **Audit events** | `resolution_confirmed` |
| **Acceptance criteria** | **Given** a case in `PENDING_CONFIRMATION`, **when** the reporter confirms with the correct state version, **then** T9 is applied and recorded. **And** when the completion submitter attempts the same action, it is refused |
| **Related requirements** | `FR-FIX-101` · `FR-FIX-102` · `FR-FIX-006` · `FR-CASE-002` |
| **Related API operations** | `API-040` confirm · `API-072` comparison |
| **Open questions** | Confirmation window duration — **`TBD — Hassan decision required` (TBD-A11)** |

---

## UC-13 — Dispute Claimed Resolution

| Field | Content |
|---|---|
| **ID** | UC-13 |
| **Name** | Dispute Claimed Resolution |
| **Goal** | The reporter records that the claimed fix is inadequate, with evidence |
| **Primary actor** | Citizen (reporter) |
| **Supporting actors** | Moderator · Administrator |
| **Trigger** | Reporter disagrees with a completion claim |
| **Preconditions** | Case in `PENDING_CONFIRMATION`; actor is the reporter |
| **Postconditions** | `Dispute` recorded with evidence; case moves to `REOPENED` — **not** directly to `IN_PROGRESS** |
| **Main success flow** | 1. Citizen selects dispute and gives a reason. 2. Citizen captures dispute evidence **live**. 3. Reason and evidence session submitted together (`API-041` carries `{expected_state_version, reason, session_id}`). 4. `Dispute` and its evidence commit **atomically as one operation**. 5. Case → `REOPENED`. 6. Rework requires a **separate, separately audited decision** (T11d, `API-078`) |
| **Alternative flows** | **A1** Dispute without new evidence → permitted if the reason is substantive. **A2** Second dispute after rework → each is a separate record; the full cycle stays visible |
| **Exception flows** | **E1** Stale version → `E_STALE_STATE`. **E2** Non-reporter attempts → refused. **E3** Evidence integrity failure → quarantined; dispute reason still recorded. **E4** Missing reason → `E_REASON_REQUIRED` |
| **Business rules** | `BR-017` dispute path · `BR-035` proxy rework · **`API-041` returns `REOPENED`, not `IN_PROGRESS` — the intermediate state is auditable and must not be skipped** |
| **Data created/modified** | `Dispute` · `EvidenceManifest` (context `dispute`) · `ReopenEvent` · `Case` · `CaseStatusEvent` · `AuditEvent` |
| **Permissions required** | Reporter only, own report, `PENDING_CONFIRMATION` |
| **Privacy controls** | Dispute evidence subject to the same privacy preview; contractor identity not disclosed to the citizen |
| **Security controls** | Atomic commit of dispute + evidence · optimistic concurrency · mandatory reason · **rework is a separate authorised decision** |
| **Audit events** | `resolution_disputed` · `case_reopened` |
| **Acceptance criteria** | **Given** a case in `PENDING_CONFIRMATION`, **when** the reporter disputes with reason and evidence, **then** a `Dispute` and its evidence commit together, the case is `REOPENED`, and moving to `IN_PROGRESS` requires a further audited decision |
| **Related requirements** | `FR-FIX-103` · `FR-CASE-104` · `BR-017` · `BR-035` |
| **Related API operations** | `API-041` dispute · `API-078` proxy rework |
| **Open questions** | Whether a second dispute on one case is capped — **`TBD — Hassan decision required` (TBD-A12)** |

---

# Part B — Staff authentication and credential lifecycle (Release 0 buildable)

---

## UC-14 — Invite and Activate Staff User

| Field | Content |
|---|---|
| **ID** | UC-14 |
| **Name** | Invite and Activate Staff User |
| **Goal** | Create a staff account **without any administrator ever knowing the user's credential** |
| **Primary actor** | Administrator (Release 0) · Mayor & Ops / UC Officer *(Future)* |
| **Supporting actors** | Invited staff member · Out-of-band delivery channel |
| **Trigger** | An authorised person needs a Parakh account |
| **Preconditions** | Inviter authenticated with MFA satisfied; invitee's official details verified out of band; **inviter's authority is not exceeded by the role being granted** |
| **Postconditions** | Account exists in `pending_enrolment`; single-use enrolment token issued (hashed); **no credential set by the inviter** |
| **Main success flow** | 1. Inviter authenticates (UC-15) with MFA. 2. Inviter enters **verified official details and a username**; the server normalises it (NFKC + casefold + trim, unique). 3. Server creates the account and issues a **single-use, short-lived, account-bound enrolment token, stored hashed**. 4. Token delivered out of band. 5. Invitee consumes the token and **sets their own first-factor credential** (`API-104`). 6. Invitee enrols MFA (`API-099`, UC-16). 7. Scope granted with mandatory expiry (UC-17). 8. Account → `active` |
| **Alternative flows** | **A1** Two-person approval required (production) → account waits at `pending_approval`; **approver must differ from requester**. **A2** Token expires unused → inviter reissues; the old token is dead. **A3** Contractor Org Admin invites a worker → constrained to own `organization_id`, role ceiling `CON` only |
| **Exception flows** | **E1** Duplicate username → refused (`TEST-AUTH-012`). **E2** Inviter attempts a role above their own → refused; `unauthorised_access_attempt`. **E3** Invitee attempts a privileged action before MFA enrolment → `E_MFA_REQUIRED` (403). **E4** Token replayed → refused; single-use consumed. **E5** Inviter's MFA not satisfied → refused before any account is created |
| **Business rules** | **Administrators never choose, see, set or transmit a user's password** · authority delegates downward only · every grant carries a mandatory expiry (`FR-ADM-002`) |
| **Data created/modified** | `OperatorCredential` · `EnrolmentToken` · `RoleAssignment` · `CapabilityGrant` · `AuditEvent` |
| **Permissions required** | `manage_users` + step-up authentication |
| **Privacy controls** | Only official contact details stored; personal identifiers held in the identity vault under a separate database role |
| **Security controls** | Enrolment token single-use, hashed, expiring, account-bound · credential set by the invitee only · MFA mandatory before any privileged action · username normalised and unique |
| **Audit events** | `operator_created` · `enrolment_token_issued` · `credential_set` · `mfa_enrolled` · `role_assigned` |
| **Acceptance criteria** | **Given** an administrator creating an account, **when** the account is created, **then** no credential value exists that the administrator supplied or can read; **and** the invitee cannot perform any privileged action until MFA is enrolled |
| **Related requirements** | `FR-ADM-003` · `FR-AUTH-009` · `FR-AUTH-006` · `FR-AUTH-007` |
| **Related API operations** | `API-098` create/deactivate operator · `API-104` consume enrolment token, set first factor · `API-099` MFA enrol |
| **Open questions** | **TBD-A05** REP activation approval · **TBD-A02** SYSADMIN split |

---

## UC-15 — Authenticate Staff User

| Field | Content |
|---|---|
| **ID** | UC-15 |
| **Name** | Authenticate Staff User |
| **Goal** | Establish a privileged session with proof of two factors |
| **Primary actor** | Street Representative · Moderator · Administrator *(Release 0)*; UC Officer · Contractor · Mayor & Ops *(Future)* |
| **Supporting actors** | Authenticator device |
| **Trigger** | Staff member opens the console |
| **Preconditions** | Account `active`; MFA enrolled |
| **Postconditions** | Session issued carrying `active_role_assignment_id`; **no privileged scope existed before MFA succeeded** |
| **Main success flow** | 1. Staff submits username + first factor (`API-005`). 2. Server returns a short-lived **`login_ticket` carrying no privileged scope — never an access token**. 3. Server issues an MFA challenge (`API-100`). 4. Staff supplies TOTP or passkey. 5. Server verifies and issues access + refresh tokens. 6. If multiple role assignments exist, role selection occurs (UC-18). 7. Session carries the acting role assignment |
| **Alternative flows** | **A1** Single role assignment → selected automatically. **A2** MFA not yet enrolled → forced into enrolment (UC-16) before anything else. **A3** Authenticator unavailable → recovery code path (UC-20) |
| **Exception flows** | **E1** Invalid first factor → **uniform failure with no username enumeration; `400`/`429`, never `401`** on the public class. **E2** Repeated MFA failure → lockout — **duration is `TBD-052`, still open in the SRS**. **E3** Account suspended or revoked → refused; `E_ROLE_REVOKED`. **E4** Ticket replayed → refused; tickets are single-use. **E5** Privileged action attempted with only a `login_ticket` → refused |
| **Business rules** | `DR-9` MFA mandatory for privileged roles · `NFR-SEC-010` every REP/MOD/ADM session requires MFA · a ticket is not a session |
| **Data created/modified** | `AuthTicket` · `AuthFlowSession` · `Session` · `AuditEvent` |
| **Permissions required** | None to attempt; account must be active |
| **Privacy controls** | No username enumeration · failure responses uniform |
| **Security controls** | Two-step ticket→token flow · single-use tickets · rate limiting · token hashed at rest · rotating refresh family; replay of a consumed refresh token revokes the family |
| **Audit events** | `privileged_first_factor` · `mfa_challenge` · `mfa_failed` · `privileged_login` · `auth_failed` |
| **Acceptance criteria** | **Given** valid first-factor credentials, **when** MFA is not completed, **then** no access token is issued and no privileged action succeeds. **And** an invalid username and an invalid password produce indistinguishable responses |
| **Related requirements** | `FR-AUTH-006` · `FR-AUTH-007` · `FR-AUTH-003` · `NFR-SEC-010` |
| **Related API operations** | `API-005` first factor · `API-100` challenge/verify · `API-003` refresh · `API-004` logout |
| **Open questions** | **TBD-052** MFA lockout duration (SRS proposes 15 minutes, open) |

---

## UC-16 — Enrol and Verify MFA

| Field | Content |
|---|---|
| **ID** | UC-16 |
| **Name** | Enrol and Verify Multi-Factor Authentication |
| **Goal** | The staff member binds a second factor that only they control |
| **Primary actor** | Invited staff member |
| **Supporting actors** | Administrator (reset only) |
| **Trigger** | First sign-in after credential setup, or an administrator-initiated reset |
| **Preconditions** | Valid enrolment or reset ticket; first factor set |
| **Postconditions** | `MfaEnrolment` active; recovery codes issued once; account may now perform privileged actions |
| **Main success flow** | 1. Ticket consumed; server returns an `enrolment_session_id` and provisioning URI — **and no recovery codes at this step**. 2. Staff registers TOTP or passkey. 3. Staff submits a verification code. 4. Server confirms and activates the enrolment. 5. **Recovery codes issued once**, hashed at rest, never re-displayable. 6. Account may now act |
| **Alternative flows** | **A1** Passkey instead of TOTP — **preferred** per `DR-9` and [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final). **A2** Re-enrolment after reset → prior enrolment revoked first. **A3** Enrolment abandoned → account remains unable to act |
| **Exception flows** | **E1** Wrong verification code → retry with rate limiting. **E2** Session expires → restart with a new ticket. **E3** Privileged action before enrolment completes → `E_MFA_REQUIRED`. **E4** Enrolment ticket replayed → refused |
| **Business rules** | Two-step enrolment, ticket-bound · TOTP or passkey preferred over SMS (`DR-9`) · **an administrator may reset a factor but can never read one** |
| **Data created/modified** | `MfaEnrolment` (secret **encrypted**) · `MfaRecoveryCode` (**hashed, single-use**) · `AuthFlowSession` · `AuditEvent` |
| **Permissions required** | Valid enrolment ticket |
| **Privacy controls** | Secret never displayed after enrolment; recovery codes shown once |
| **Security controls** | Secret encrypted at rest · codes hashed and single-use · one `AuthFlowSession` per source ticket — the structural guarantee a ticket is consumed once · SMS not used as the primary second factor |
| **Audit events** | `mfa_enrolled` · `mfa_reset_by_admin` |
| **Acceptance criteria** | **Given** a newly created account, **when** MFA enrolment has not completed, **then** every privileged endpoint returns `E_MFA_REQUIRED`. **And** no endpoint or role, including Administrator, can read the enrolled secret |
| **Related requirements** | `FR-AUTH-007` · `FR-AUTH-009` · `FR-ADM-003` |
| **Related API operations** | `API-099` enrol + confirm · `API-104` consume enrolment token · `API-102` admin reset |
| **Open questions** | **TBD-015** second-factor mechanism (SRS proposes TOTP, open) |

---

## UC-17 — Assign Role and Geographic Scope

| Field | Content |
|---|---|
| **ID** | UC-17 |
| **Name** | Assign Role and Geographic Scope |
| **Goal** | Bind a role to a specific area or organisation, with a mandatory expiry |
| **Primary actor** | Administrator *(Release 0)*; Mayor & Ops *(Future)* |
| **Supporting actors** | Approver where two-person control applies |
| **Trigger** | A staff member needs authority over a defined area |
| **Preconditions** | Target account active with MFA enrolled; assigner's own scope covers the scope being granted |
| **Postconditions** | `RoleAssignment` active with `valid_from`/`valid_until`; capability grant recorded |
| **Main success flow** | 1. Assigner authenticates with MFA and step-up. 2. Assigner selects target, role, `scope_type`, `scope_id`, and **a mandatory expiry**. 3. Server verifies the assigner is not exceeding their own scope or privilege. 4. Where two-person control applies, a separate approver confirms. 5. Assignment activated; capability grant created |
| **Alternative flows** | **A1** Organisation scope for a contractor → `organization_id` set, geographic scope omitted. **A2** Multiple scopes → one assignment record per scope. **A3** Temporary cover → short `valid_until` |
| **Exception flows** | **E1** Expiry omitted → refused; expiry is mandatory (`FR-ADM-002`). **E2** Assigner attempts a wider scope than their own → refused. **E3** Assigner attempts to grant a more privileged role than their own → refused. **E4** Approver equals requester where two-person applies → refused |
| **Business rules** | Authority delegates downward only · every grant expires · **assigner ≠ approver** where two-person control applies |
| **Data created/modified** | `RoleAssignment` · `CapabilityGrant` · `AuditEvent` |
| **Permissions required** | `assign_roles` + `change_scope` + step-up |
| **Privacy controls** | Scope records contain no personal data beyond the account reference |
| **Security controls** | Downward-only delegation · mandatory expiry · **expiry evaluated at the point of action, never at session issue** · server-side scope containment check |
| **Audit events** | `role_assigned` · `grant_created` · `scope_changed` |
| **Acceptance criteria** | **Given** an assigner scoped to UC-A, **when** they attempt to grant a role scoped to UC-B, **then** it is refused and logged. **And** a grant created without an expiry is refused |
| **Related requirements** | `FR-ADM-002` · `FR-ADM-003` |
| **Related API operations** | `API-091` create grant · `API-098` operator lifecycle |
| **Open questions** | **TBD-A05** two-person approval for REP activation |

---

## UC-18 — Switch Between Multiple Authorized Roles

| Field | Content |
|---|---|
| **ID** | UC-18 |
| **Name** | Switch Between Multiple Authorized Roles |
| **Goal** | One account holding several assignments acts under exactly one at a time, always attributably |
| **Primary actor** | Multi-role staff member |
| **Supporting actors** | — |
| **Trigger** | User needs to work in a different authorised capacity |
| **Preconditions** | Two or more `active` role assignments on one account |
| **Postconditions** | Session carries a single `active_role_assignment_id`; the switch is recorded |
| **Main success flow** | 1. On login, user is presented with their active assignments. 2. User selects one. 3. Session records `active_role_assignment_id`. 4. All subsequent authorisation is evaluated **against that assignment only**. 5. Switching mid-session requires explicit re-selection and is audited |
| **Alternative flows** | **A1** Single assignment → selected automatically, still recorded. **A2** Switch to a higher-privilege assignment → **step-up authentication required**. **A3** An assignment expires mid-session → it disappears from the selector; if it was active, the session is downgraded and the user is notified |
| **Exception flows** | **E1** User attempts an action permitted only by a **non-active** assignment → **refused.** Permissions are never unioned. **E2** Assignment revoked mid-session → next action refused with `E_ROLE_REVOKED`. **E3** No active assignment remains → session becomes read-only |
| **Business rules** | **Permissions are never unioned across assignments** — this is the primary defence against quiet privilege escalation · every action records the acting assignment |
| **Data created/modified** | `Session.active_role_assignment_id` · `AuditEvent` |
| **Permissions required** | Holder of the assignments; step-up for privilege increase |
| **Privacy controls** | Role selection reveals nothing about other users |
| **Security controls** | Single active assignment · step-up on escalation · re-evaluation at the point of action · **`acting_role_assignment_id` on every audit event** |
| **Audit events** | `role_switched` · every subsequent event carries the acting assignment |
| **Acceptance criteria** | **Given** an account holding `REP` in UC-A and `MOD` in UC-B, **when** acting as `REP`, **then** no Moderator-only action succeeds; **and** the audit log shows which assignment authorised each action, not merely which user |
| **Related requirements** | `FR-AUTH-002` (roles returned at authentication) · `FR-AUD-001` |
| **Related API operations** | Role selection extends the `API-100` verify response |
| **Open questions** | None |

---

## UC-19 — Modify, Suspend, Expire or Revoke Role Assignment

| Field | Content |
|---|---|
| **ID** | UC-19 |
| **Name** | Modify, Suspend, Expire or Revoke Role Assignment |
| **Goal** | Withdraw or alter authority immediately, **without erasing history** |
| **Primary actor** | Administrator *(Release 0)*; Mayor & Ops *(Future)* |
| **Supporting actors** | — |
| **Trigger** | Staff member leaves, changes area, or authority is withdrawn |
| **Preconditions** | Actor holds `suspend_accounts` / `assign_roles`; target assignment exists |
| **Postconditions** | Status changed with a recorded reason; **history retained** |
| **Main success flow** | 1. Actor authenticates with MFA and step-up. 2. Actor selects the assignment and an action: modify, suspend, or revoke. 3. **A reason is mandatory for revocation.** 4. Status updated; `revoked_at`/`suspended_at` and reason recorded. 5. **Effect applies on the target's next action** — evaluated at the point of action, not at session issue |
| **Alternative flows** | **A1** Natural expiry → status `expired` automatically at `valid_until`. **A2** Suspension reversed → status returns to `active`; both events retained. **A3** Organisation suspended → **cascades to every worker in it, immediately** |
| **Exception flows** | **E1** Attempt to hard-delete → **no such capability exists for any role, including Administrator** (`BR-022`); `DELETE` is not offered on grants. **E2** Revoking the last Administrator assignment → refused; would leave the system unadministrable. **E3** Actor attempts to revoke an assignment above their own privilege → refused |
| **Business rules** | `BR-022` **no-deletion rule** — corrections append · `FR-ADM-004` revoked grants take effect on the next action and grant history is retained · mandatory reason |
| **Data created/modified** | `RoleAssignment` status fields · `CapabilityGrant` · `AuditEvent` |
| **Permissions required** | `suspend_accounts` / `assign_roles` + step-up |
| **Privacy controls** | Revocation reason visible only to administrators and audit readers |
| **Security controls** | Non-destructive lifecycle · point-of-action evaluation · cascade on organisation suspension · last-administrator protection |
| **Audit events** | `role_revoked` · `account_suspended` · `grant_revoked` · `scope_changed` |
| **Acceptance criteria** | **Given** an active assignment, **when** it is revoked, **then** the holder's very next action is refused, the assignment record still exists with its reason, and **no endpoint exists that would delete it** |
| **Related requirements** | `FR-ADM-004` · `BR-022` |
| **Related API operations** | `API-091b` revoke grant · `API-098` deactivate operator |
| **Open questions** | **TBD-A06** / `TBD-053` sole-administrator contingency |

---

## UC-20 — Recover Staff Credentials

| Field | Content |
|---|---|
| **ID** | UC-20 |
| **Name** | Recover Staff Credentials |
| **Goal** | Restore access after credential or device loss **without weakening the authentication guarantee** |
| **Primary actor** | Staff member who has lost a factor |
| **Supporting actors** | Administrator (reset path) |
| **Trigger** | Lost authenticator device, or forgotten first factor |
| **Preconditions** | Account active; identity verifiable out of band for the administrator path |
| **Postconditions** | Access restored under a **degraded session**; re-enrolment required |
| **Main success flow** | **Recovery-code path.** 1. First factor via `API-005` → `login_ticket`. 2. Staff submits **one unused recovery code** (`API-101`). 3. Code consumed; **degraded session** issued with `mfa_assurance = recovery`. 4. `Session.assurance_expires_at` = issued + **24 h**, and refresh may not extend beyond that instant. 5. Account owner notified. 6. **Re-enrolment required** before the window closes |
| **Alternative flows** | **A1 (administrator reset)** Administrator verifies identity out of band, calls `API-102` → existing enrolment revoked, reset token issued, staff re-enrols via `API-104` → `API-099`. **A2** Recovery codes exhausted → administrator path only. **A3** Passkey on a second device → normal authentication, no recovery needed |
| **Exception flows** | **E1** Recovery code replayed → refused; codes are single-use. **E2** 24-hour window elapses → session revoked; only re-enrolment proceeds. **E3** **Sole Administrator loses their own factor → no independent actor can reset it. `TBD-053`, blocking P1.** **E4** Reset token intercepted → single-use and short-lived, but out-of-band delivery integrity is assumed and **not verified by the system** |
| **Business rules** | An administrator may reset a factor but **never read one** · a recovery session is a degraded session, not an equivalent one |
| **Data created/modified** | `MfaRecoveryCode` (consumed) · `MfaEnrolment` · `EnrolmentToken` · `Session` · `AuditEvent` |
| **Permissions required** | Valid first factor + recovery code; or administrator with step-up |
| **Privacy controls** | Out-of-band verification does not create a new stored identifier |
| **Security controls** | Single-use hashed codes · 24-hour assurance cap · mandatory re-enrolment · owner notification · reset revokes the prior enrolment |
| **Audit events** | `mfa_recovery_used` · `mfa_reset_by_admin` · `mfa_enrolled` |
| **Acceptance criteria** | **Given** a valid unused recovery code, **when** it is submitted with the first factor, **then** a session is issued, the code cannot be reused, the account owner is notified, and the session expires no later than 24 hours after issue regardless of refresh |
| **Related requirements** | `FR-AUTH-008` · `FR-AUTH-009` |
| **Related API operations** | `API-101` recover · `API-102` admin reset · `API-104` re-enrol |
| **Open questions** | **`TBD-053` — blocking.** Recommendation: appoint a second Administrator |

---

# Part C — Organisation, conflict of interest and accountability

---

## UC-21 — Register and Approve Contractor Organization *(Future — `SC-FUT-02`)*

| Field | Content |
|---|---|
| **ID** | UC-21 |
| **Name** | Register and Approve Contractor Organization |
| **Goal** | Establish a verified vendor record so that work can only ever be assigned to an approved organisation |
| **Primary actor** | Mayor & Operations Command *(Future)* |
| **Supporting actors** | Contractor Organisation Administrator · System Administrator |
| **Trigger** | A vendor must be able to receive assigned civic work |
| **Preconditions** | Vendor identity and authority verified out of band through formal procurement or registration |
| **Postconditions** | `Organisation` record approved; an org administrator account may be invited |
| **Main success flow** | 1. Mayor/Ops enters verified vendor details. 2. Organisation created in `pending_approval`. 3. A **second** authorised approver confirms. 4. Organisation → `approved`. 5. An org administrator is invited (UC-14) bounded to that `organization_id`. 6. The org administrator may invite workers, **role ceiling `CON` only** |
| **Alternative flows** | **A1** Contract term set → organisation scope carries `valid_until`. **A2** Renewal → new validity period, prior record retained. **A3** Single-worker vendor → org admin and worker are the same person, still two records |
| **Exception flows** | **E1** **A UC Officer attempts to create a vendor → refused.** This is the single most important rule in the hierarchy: an officer who could invent a vendor could route public work to an unverified party. **E2** Duplicate registration → refused. **E3** Organisation suspended → **cascades to all workers immediately** |
| **Business rules** | **UC Officers may assign only to approved contractors and must never create contractor identities** · two-person approval for vendor records · org admin bounded to own organisation |
| **Data created/modified** | `Organisation` *(P2)* · `OrganisationMembership` · `RoleAssignment` · `AuditEvent` |
| **Permissions required** | `manage_users` at Mayor/Ops level + step-up; approver ≠ requester |
| **Privacy controls** | Vendor business details are organisational, not personal, except named contacts held minimally |
| **Security controls** | Two-person approval · separation of vendor creation from work assignment · cascade suspension · org-bounded invitation ceiling |
| **Audit events** | `organisation_created` · `organisation_approved` · `organisation_suspended` · `membership_created` |
| **Acceptance criteria** | **Given** a UC Officer with an assignment permission, **when** they attempt to create a contractor organisation, **then** it is refused and logged; **and** assignment is possible only to organisations already in `approved` |
| **Related requirements** | `SC-FUT-02` · `SC-OUT-02` · `SC-OUT-05` contractor selection out of scope · `DR-2` |
| **Related API operations** | Future — no Release 0 endpoint exists |
| **Open questions** | Whether Parakh stores contract values — **recommend no**, `SC-OUT-04`/`SC-OUT-06` place payments and procurement out of scope |

---

## UC-22 — Invite Street Representative

| Field | Content |
|---|---|
| **ID** | UC-22 |
| **Name** | Invite Street Representative |
| **Goal** | Onboard a community verifier for a defined area, without letting one person manufacture their own independent verifier |
| **Primary actor** | Administrator or Moderator *(Release 0)*; UC Officer *(Future)* |
| **Supporting actors** | Approver *(TBD-A05)* · Nominee |
| **Trigger** | An area needs independent verification capacity |
| **Preconditions** | Nominee's identity attested; inviter's scope covers the target area |
| **Postconditions** | Representative account active, scoped to specific UC/ward areas, with a mandatory expiry |
| **Main success flow** | 1. Inviter records the nominee's verified details. 2. Nominee invited (UC-14). 3. **Where two-person control applies, a separate approver activates.** 4. Nominee sets credential and enrols MFA. 5. Geographic scope assigned with expiry (UC-17). 6. Account active |
| **Alternative flows** | **A1** Release 0 → single-approver activation, because one Administrator and no UC Officer exist. **A2** Multiple areas → one assignment per area. **A3** Nominee declines → invitation lapses; account never activates |
| **Exception flows** | **E1** Inviter attempts to nominate outside their own scope → refused. **E2** Nominee already holds a conflicting assignment → recorded as a `DeclaredConflict` and the conflict rules of UC-24 apply. **E3** **Same person nominates and activates where two-person control applies → refused** |
| **Business rules** | **Independent verification is the property that makes a Parakh case more than an unverified claim; a single actor must not be able to create their own verifier** · scope containment · mandatory expiry |
| **Data created/modified** | `Participant` · `RepresentativeProfile` · `AttestationRecord` · `RoleAssignment` · `AuditEvent` |
| **Permissions required** | `manage_users` within scope + step-up |
| **Privacy controls** | Representative's identity is visible to staff, **never to the citizen** |
| **Security controls** | Scope containment · two-person control where enabled · conflict declaration at onboarding |
| **Audit events** | `operator_created` · `role_assigned` · `attestation_recorded` |
| **Acceptance criteria** | **Given** two-person control enabled, **when** the nominator attempts to also activate, **then** it is refused. **And** a Representative's scope never exceeds the inviter's own |
| **Related requirements** | `FR-ADM-001` · `FR-ADM-003` · `FR-REP-101` · `FR-REP-105` |
| **Related API operations** | `API-090a`/`API-090b` participant + attestation · `API-098` operator · `API-091` grant |
| **Open questions** | **TBD-A05 — does activation require a second approver?** Recommendation: yes in production, no in Release 0 |

---

## UC-23 — Authenticated Staff Member Reports an Incident

| Field | Content |
|---|---|
| **ID** | UC-23 |
| **Name** | Authenticated Staff Member Reports an Incident |
| **Goal** | A staff member reports a problem they discovered, without becoming its reviewer |
| **Primary actor** | Street Representative · Moderator · Administrator · UC Officer *(Future)* · Contractor *(Future)* |
| **Supporting actors** | Another qualified reviewer |
| **Trigger** | Staff member observes a civic problem while on duty |
| **Preconditions** | Authenticated session with an active role assignment |
| **Postconditions** | Report created and **visibly labelled as officially submitted**; submitter permanently excluded from reviewing it |
| **Main success flow** | 1. Staff enters an explicit **"Report an incident"** mode while remaining logged in. 2. Report captured through the same evidence pipeline (live capture, integrity, manifest). 3. Report stored with `submitted_by_official = true` and `reported_by_role_assignment_id`. 4. **Submitter is recorded as excluded from every reviewer role on that record — as a stored fact, not a runtime check.** 5. Report routed to a different qualified actor in scope. 6. Reviewers see the official-submission label |
| **Alternative flows** | **A1** No other qualified actor in scope → escalates one level up. **A2** No eligible actor anywhere → **case flagged unresolvable and held. It is not auto-approved and not assigned back.** **A3** Staff member prefers to report anonymously → **they must use the anonymous path while logged out; the system must not offer a "report anonymously" button inside an authenticated session**, because the session already identifies them |
| **Exception flows** | **E1** Submitter later attempts to verify → refused; `E_CONFLICT_OF_INTEREST`; logged. **E2** Submitter attempts to assign it to themselves → refused. **E3** Submitter is the only Moderator → **TBD-A07**; recommendation is to seed a second Moderator |
| **Business rules** | Officially submitted reports are labelled · submitter exclusion is permanent · routing must not silently return the report to the submitter |
| **Data created/modified** | `CivicReport` with official-submission fields · `DeclaredConflict` · `CaseStatusEvent` · `AuditEvent` |
| **Permissions required** | Any authenticated staff role |
| **Privacy controls** | Staff identity **is** recorded — this is deliberate. Officials do not report anonymously through an identified session |
| **Security controls** | Server-side submitter comparison at every reviewer action · exclusion stored, not recomputed · escalation path defined |
| **Audit events** | `report_submitted` with `submitted_by_official` and the acting assignment |
| **Acceptance criteria** | **Given** a Representative who submitted report R, **when** they attempt to verify R, **then** it is refused, logged as a conflict, and R is routed to a different Representative. **And** if none exists, R is flagged unresolvable rather than approved |
| **Related requirements** | `FR-FIX-006` · `BR-029` · `BR-030` · `FR-ADM-102` unresolvable-case precedent |
| **Related API operations** | `API-030` with official-submission fields; routing internal |
| **Open questions** | **TBD-A07** — who accepts a report submitted by the only Moderator? |

---

## UC-24 — Prevent Self-Verification and Other Conflicts of Interest

| Field | Content |
|---|---|
| **ID** | UC-24 |
| **Name** | Prevent Self-Verification and Other Conflicts of Interest |
| **Goal** | Guarantee that no person reviews, approves or decides on a record where they were a prior acting party |
| **Primary actor** | System (enforcement) |
| **Supporting actors** | All staff roles |
| **Trigger** | Any attempt to verify, approve, close, or decide |
| **Preconditions** | Record exists with a recorded acting history |
| **Postconditions** | Action permitted only if every conflict check passes; otherwise refused, logged and routed elsewhere |
| **Main success flow** | 1. Actor requests a reviewer-type action on record R. 2. Server evaluates, in order: role → geographic/organisational scope → workflow state → **prior-party check** → declared conflicts → step-up. 3. All pass → action executes and is audited with the acting assignment |
| **Alternative flows** | **A1** Conflict detected → refused, and R routed to another qualified actor. **A2** No alternative actor → escalate. **A3** Still none → **flag unresolvable and hold** |
| **Exception flows** | **E1** Submitter attempts verification → refused. **E2** Work submitter attempts to approve their own completion → refused by `FR-FIX-006`. **E3** Prior decision actor attempts to decide the resulting appeal → refused by `BR-030`. **E4** Actor holds a `DeclaredConflict` for the area or organisation → refused. **E5** Actor attempts self-assignment without authorisation → refused |
| **Business rules** | `FR-FIX-006` separation of duties · `BR-029` · `BR-030` appeal independence · `BR-025` mandatory reasons · **conflict checks are server-side and are not skippable by any role, including Administrator** |
| **Data created/modified** | `DeclaredConflict` · `AuditEvent` (`unauthorised_access_attempt`) |
| **Permissions required** | Evaluated, never assumed |
| **Privacy controls** | A refusal reveals to the actor only that they are conflicted, not the details of other actors' involvement |
| **Security controls** | Six-dimension evaluation · stored exclusions · point-of-action evaluation · deny by default |
| **Audit events** | `conflict_refused` · `unauthorised_access_attempt` |
| **Acceptance criteria** | **Given** any record, **when** a prior acting party attempts a reviewer action, **then** it is refused regardless of role or scope, and the refusal is recorded as a permission refusal rather than a validation error |
| **Related requirements** | `FR-FIX-006` · `BR-029` · `BR-030` · `TEST-REP-010` (a Representative cannot close their own verification) |
| **Related API operations** | Enforced across `API-052`, `API-055`, `API-062`, `API-071`, `API-078`, `API-058` |
| **Open questions** | **TBD-A07** single-Moderator conflict in Release 0 |

---

## UC-25 — Handle Unauthorized Access Attempt

| Field | Content |
|---|---|
| **ID** | UC-25 |
| **Name** | Handle Unauthorized Access Attempt |
| **Goal** | Refuse, record and reveal nothing |
| **Primary actor** | System |
| **Supporting actors** | Administrator · Moderator (review) |
| **Trigger** | Any request failing authentication, authorisation, scope, state or conflict checks |
| **Preconditions** | None |
| **Postconditions** | Request refused; a **permission-refusal** audit event written; no information disclosed |
| **Main success flow** | 1. Request arrives. 2. Server evaluates the transport class, then role, scope, state and conflict. 3. Any failure → refuse. 4. **Write `unauthorised_access_attempt`.** 5. Return a response that discloses nothing about existence, ownership or reason beyond what the actor already knows |
| **Alternative flows** | **A1** Anonymous token mismatch → uniform "not found," identical to a non-existent report. **A2** Valid session, out-of-scope record → refused, `403`, no record details. **A3** Expired grant → `E_ROLE_REVOKED`, view closes read-only. **A4** Repeated failures → rate limit, then lockout |
| **Exception flows** | **E1** Attempt to read the audit log by a non-permitted role → refused and itself audited. **E2** Attempt to write or delete an audit row → **no such capability exists for any role**; any direct attempt is denied at the database grant and logged. **E3** Direct API call bypassing the UI → treated identically; **frontend hiding is never the control** |
| **Business rules** | **Deny by default** · four audit outcomes are distinct: success → domain event; input-validation failure → nothing; **permission refusal → `unauthorised_access_attempt`**; concurrency refusal → `stale_state_rejected` |
| **Data created/modified** | `AuditEvent` only |
| **Permissions required** | None — this is the refusal path |
| **Privacy controls** | No enumeration · uniform responses · no reason disclosure that would confirm a record's existence |
| **Security controls** | Every route belongs to exactly one transport class (`TEST-SEC-001`) · rate limiting · lockout · **server-side enforcement of every §9 matrix row, tested by direct API call with a token that must be refused** |
| **Audit events** | `unauthorised_access_attempt` · `stale_state_rejected` (distinct) |
| **Acceptance criteria** | **Given** a valid token for role A, **when** an endpoint permitted only to role B is called directly, **then** it is refused, an `unauthorised_access_attempt` is written, and the response body reveals nothing about the target record |
| **Related requirements** | `FR-PRV-004` transport classes · `FR-AUD-001` · `TEST-SEC-001` |
| **Related API operations** | All |
| **Open questions** | **TBD-052** lockout duration |

---

## UC-26 — Review Authentication and Permission Audit History

| Field | Content |
|---|---|
| **ID** | UC-26 |
| **Name** | Review Authentication and Permission Audit History |
| **Goal** | Reconstruct who did what, under which authority, and whether it was permitted |
| **Primary actor** | Administrator · Moderator |
| **Supporting actors** | — |
| **Trigger** | Investigation, periodic review, or a case history request |
| **Preconditions** | Authenticated with MFA; `view_audit_logs` permission |
| **Postconditions** | Read-only history returned; the read is itself audited |
| **Main success flow** | 1. Reviewer authenticates with MFA and step-up. 2. Reviewer opens case history or the authentication log. 3. Server returns chronological events: actor, **acting role assignment**, action, reason, previous state, new state, timestamp, correlation reference and chain hash. 4. The read is audited |
| **Alternative flows** | **A1** Case-scoped history (`API-080`). **A2** Authentication-event history. **A3** Integrity verification run (`API-097`) recomputes segment chains and validates checkpoints — **read-only; it repairs nothing** |
| **Exception flows** | **E1** Non-permitted role attempts to read → refused and audited (UC-25). **E2** Any attempt to write, edit or delete → **no interface exists for any role**; denied at the database grant (`FR-AUD-004`). **E3** **Chain verification fails** → critical alert naming the segment and sequence; **records are not rewritten — a failure means the record is in question, not that it should be corrected** |
| **Business rules** | `FR-AUD-002` chain hashing with a gapless sequence **within each chain segment** · `FR-AUD-004` no write path for any role · `BR-022` no deletion · the audit log records **that** an action occurred and by whom, **not** a duplicate of its operational content |
| **Data created/modified** | Read-only; `audit_log_viewed` written |
| **Permissions required** | `view_audit_logs` — **Moderator and Administrator only**; no other role, and no role may write |
| **Privacy controls** | Reporter identity is **not** exposed in case history · vault access appears as an event, not as the identity itself · subgroup and personal data minimised |
| **Security controls** | Append-only · segmented hash chains with checkpoints · **on-host and unsigned in Release 0 — `SC-LIM-04` requires the verification tool to state this** · off-host signed checkpoints deferred to before pilot (`TBD-004`, `SC-PIL-09`) |
| **Audit events** | `audit_log_viewed` · `integrity_verified` · `integrity_failed` |
| **Acceptance criteria** | **Given** a completed workflow, **when** an Administrator reads the case history, **then** every state transition appears with actor, acting role assignment, reason and chain hash; **and** no role possesses any endpoint that modifies or deletes an audit row |
| **Related requirements** | `FR-AUD-001` … `FR-AUD-005` · `BR-022` · `SC-LIM-04` |
| **Related API operations** | `API-080` case history · `API-097` integrity verification |
| **Open questions** | **TBD-004** off-host signed checkpoints — SRS answers *"defer, and state the limitation,"* due **before pilot** |

---

## Cross-cutting open questions

| ID | Question | Blocks |
|---|---|---|
| **TBD-A01** | Adopt anonymous reporting and amend `C-6` / `BR-007` / `FR-AUTH-004`? | UC-07 … UC-11, and UC-12/13 in anonymous form |
| **TBD-A02** | Split `ADM` into `SYSADMIN` + `OPS_ADMIN`? | Role model |
| **TBD-A03** | Anonymous grant expiry after case closure | UC-09, UC-10 |
| **TBD-A04** | Text-only reporting alternative vs voice-primary `FR-VOI-001` | UC-07 |
| **TBD-A05** | Two-person activation for Street Representatives? | UC-17, UC-22 |
| **TBD-A06** | `TBD-053` sole-Administrator recovery | UC-19, UC-20 — **blocking P1 per the SRS** |
| **TBD-A07** | Who accepts a report submitted by the only Moderator? | UC-23, UC-24 |
| **TBD-A08** | Post-closure visibility duration for the reporter | UC-10 |
| **TBD-A09** | Use Case Document toolchain — extend the fragments or promote to Markdown? | Integration of this whole file |
| **TBD-A10** | Clarification request expiry period | UC-11 |
| **TBD-A11** | Citizen confirmation window duration | UC-12 |
| **TBD-A12** | Cap on repeated disputes for one case | UC-13 |

---

*Draft. Not integrated into the master Use Case Document. Nothing described here has been implemented, deployed, independently assessed or used by a real person. Parakh has no government adoption, no signed partnership, no real users and no demonstrated impact. Where this document differs from `Parakh_Prototype_SRS_v1.3.7.md`, the SRS governs.*


---

## v1.0 amendment record (CR-59, CR-60)

| Correction | Applied |
|---|---|
| **Blocked → approved** | UC-07 … UC-13 unblocked by CR-59 |
| **Reporter entitlement** | Replaces "anonymous ownership" / "reporter identity" in UC-10, UC-11, UC-12, UC-13 |
| **Offline draft** | Bound to the **application installation**, not a participant — no participant exists |
| **Token lifecycle** | ≥128-bit, hashed at rest, issued once, rotatable, **expires 90 days after final closure**; lost token unrecoverable |
| **Privacy wording** | `anonymous reporter identity` / `identity-free reporting`. **Never "completely anonymous data" or "untraceable"** |
| **HTTP status** | Absolute "never 401" withdrawn; **indistinguishability** is the requirement |
| **Passkey/TOTP** | One passkey is not two factors; TOTP is MFA but not phishing-resistant |
| **Staff misuse of the anonymous path** | Staff acting officially **must** use authenticated reporting mode. **The public path cannot know an unauthenticated person is an employee — this is a governance risk the software cannot fully detect** |
| **Evidence retention** | Audit history · provenance · raw media are three separate layers |
| **Mobile stack** | React Native / TypeScript (DR-19, CR-60) |
| **Master source** | **Markdown authoritative; PDF generated.** PDF **not** rebuilt — no generation workflow available |


---

# Part D — v1.1 canonical use cases (CR-59 §G)

**These thirteen use cases use the identifier scheme requested at v1.1.** They do **not** replace UC-07 … UC-26; they are the canonical statement of the same behaviour under the naming the specification now uses. **No existing use case was renumbered or deleted.**

| New ID | Equivalent to | Status |
|---|---|---|
| UC-AUTH-01 | UC-14 | Release 0 |
| UC-AUTH-02 | UC-16 | Release 0 |
| UC-ROLE-01 | UC-17 | Release 0 |
| UC-ROLE-02 | UC-18 | Release 0 |
| UC-ANON-01 | UC-07 | Release 0 |
| UC-ANON-02 | UC-10 | Release 0 |
| UC-ANON-03 | UC-11 | Release 0 |
| UC-ANON-04 | UC-12 | Release 0 |
| UC-ANON-05 | UC-13 | Release 0 |
| UC-ANON-06 | *(new — token rotation)* | Release 0 |
| UC-STAFF-REPORT-01 | UC-23 *(official mode)* | Release 0 |
| UC-STAFF-REPORT-02 | *(new — isolated anonymous mode)* | Release 0 |
| UC-CONFLICT-01 | UC-24 | Release 0 |

---

## UC-AUTH-01 — Administrator invites a staff member

**Actors** Administrator *(System Administrator role, combined into `ADM` for Release 0)* · invited staff member
**Trigger** An authorised person needs a Parakh staff account
**Preconditions** Inviter authenticated with MFA satisfied; invitee's official details verified out of band; **the role being granted does not exceed the inviter's own authority**
**Main flow** 1. Inviter supplies verified official details and a username; the server normalises it (NFKC + casefold + trim, unique). 2. Server creates a `StaffAccount` in `pending_enrolment`. 3. Server issues a **single-use, short-lived, account-bound enrolment token, stored hashed**. 4. Token delivered out of band. 5. Account awaits UC-AUTH-02.
**Alternate flows** **A1** Two-person approval (production) → account waits at `pending_approval`; **approver must differ from requester**. **A2** Token expires unused → reissue; the old token is dead.
**Exceptions** **E1** Duplicate username → refused. **E2** Role above inviter's own → refused, logged. **E3** Inviter's MFA not satisfied → refused **before any account is created**.
**Permissions** `manage_users` + step-up authentication
**Audit** `operator_created` · `enrolment_token_issued`
**Privacy** Only official contact details stored; personal identifiers held in the identity vault under a separate database role
**Postconditions** `StaffAccount` exists in `pending_enrolment`; **no credential exists that any administrator chose, saw or transmitted**

## UC-AUTH-02 — Staff member enrols password and TOTP

**Actors** Invited staff member · Administrator *(reset path only)*
**Trigger** First sign-in after invitation, or an administrator-initiated MFA reset
**Preconditions** Valid single-use enrolment or reset token
**Main flow** 1. Invitee consumes the token (`API-104`) and **sets their own password**. 2. Server returns an `mfa_enrolment` ticket and **no access token**. 3. Invitee registers TOTP (`API-099`). 4. Invitee confirms with a generated code. 5. **Recovery codes issued once**, hashed, never re-displayable. 6. Account becomes eligible for role assignment.
**Alternate flows** **A1** Re-enrolment after reset → prior enrolment revoked first. **A2** Enrolment abandoned → account remains unable to act.
**Exceptions** **E1** Wrong code → retry, rate-limited. **E2** Privileged action attempted before enrolment completes → `E_MFA_REQUIRED`. **E3** Token replayed → refused; single-use.
**Permissions** Valid enrolment ticket only
**Audit** `credential_set` · `mfa_enrolled`
**Privacy** TOTP secret encrypted at rest; **an administrator may reset a factor but can never read one**
**Postconditions** Account holds a self-created password and an enrolled second factor. **No administrator knows either.**

## UC-ROLE-01 — Administrator assigns role and geographic scope

**Actors** Authorised Administrator · approver *(where two-person control applies)*
**Trigger** A staff member needs authority over a defined area
**Preconditions** Account active with MFA enrolled; **the assigner's own scope covers the scope being granted**
**Main flow** 1. Assigner authenticates with MFA and step-up. 2. Selects target, role, `scope_type`, `scope_id` and **a mandatory expiry**. 3. Server verifies the assigner exceeds neither their own scope nor their own privilege. 4. `RoleAssignment` becomes `active`.
**Alternate flows** **A1** Organisation scope for a contractor → `organization_id` set, geographic scope omitted. **A2** Multiple areas → one assignment record per area.
**Exceptions** **E1** Expiry omitted → refused; expiry is mandatory (`FR-ADM-002`). **E2** Wider scope than the assigner's → refused. **E3** Approver equals requester where two-person applies → refused.
**Permissions** `assign_roles` + `change_scope` + step-up
**Audit** `role_assigned` · `grant_created` · `scope_changed`
**Privacy** Scope records carry no personal data beyond the account reference
**Postconditions** Exactly one new `RoleAssignment`, with `valid_from`/`valid_until`, **evaluated at the point of action, never at session issue**

## UC-ROLE-02 — Multi-role staff member switches active role

**Actors** Staff member holding two or more `RoleAssignment` records
**Trigger** The member needs to work in a different authorised capacity
**Preconditions** Two or more `active` assignments on one `StaffAccount`
**Main flow** 1. On login the member is presented with their active assignments. 2. They select one. 3. Session records `active_role_assignment_id`. 4. **All later authorisation is evaluated against that assignment only.**
**Alternate flows** **A1** Exactly one assignment → selected automatically, still recorded. **A2** Switch to higher privilege → **step-up authentication required**. **A3** An assignment expires mid-session → it disappears from the selector; if it was active the session is downgraded and the member is told.
**Exceptions** **E1** Action permitted only by a **non-active** assignment → **refused. Permissions are never unioned.** **E2** Assignment revoked mid-session → next action refused with `E_ROLE_REVOKED`.
**Permissions** Holder of the assignments; step-up on privilege increase
**Audit** `role_switched`; **every subsequent event carries `acting_role_assignment_id`**
**Privacy** Role selection reveals nothing about other users
**Postconditions** Exactly one active assignment governs the session

## UC-ANON-01 — Anonymous citizen submits an incident

**Actors** Citizen (unauthenticated) · Moderator (downstream)
**Trigger** A citizen observes a civic problem
**Preconditions** **None.** No account, login, name, phone, email, CNIC, username, password or OTP
**Main flow** 1. Open the app — no authentication prompt (`CZ-03a`). 2. **Privacy notice and non-emergency notice acknowledged before capture.** 3. Choose category. 4. Provide voice or text description. 5. Confirm GPS location or place a pin manually. 6. Capture evidence **live in-app only**. 7. **Privacy preview** warns about faces, plates, voices, house numbers. 8. Metadata handled per policy; optional **redaction creates a derived evidence item, original retained**. 9. Review. 10. Submit (`API-030`) or save an encrypted offline draft. 11. Server validates, **rejects any identity field**, runs abuse and duplicate heuristics. 12. Evidence hashed and integrity-recorded. 13. **`CivicReport` and one `AnonymousAccessGrant` created in one transaction.** 14. Report enters human moderation.
**Alternate flows** **A1** Offline → encrypted device draft, queued, idempotency key bound to payload hash. **A2** Location refused → manual pin, `location_unverified`. **A3** Redaction declined → proceeds; acknowledgement recorded.
**Exceptions** **E1** Identity field supplied → **422 `E_IDENTITY_FIELD_REJECTED`**, no report created. **E2** Manifest mismatch → `E_CAPTURE_INTEGRITY`; bundle **quarantined and retained**; no report created. **E3** Rate limit → generic refusal that **does not indicate whether the report was novel**. **E4** Emergency category → emergency notice re-shown; flagged for priority moderation.
**Permissions** **None.** Public transport class, rate-limited
**Audit** `report_submitted` with `actor_kind = anonymous_grant` — **no person identity, no token value**
**Privacy** No identity collected. **No `Participant` row is created.** Disclosure precedes capture
**Postconditions** Report in `SUBMITTED`; exactly one grant; **no person identity anywhere in the record**

## UC-ANON-02 — Grant holder tracks the incident

**Actors** Citizen holding the tracking token
**Trigger** The citizen wants to check progress
**Preconditions** Valid, unexpired, unrevoked grant
**Main flow** 1. Enter the token on `CZ-17`. 2. Server hashes it and looks up the grant. 3. **The grant resolves to exactly one report; any client-supplied report identifier is ignored.** 4. Server returns plain-language status, the citizen-visible timeline and evidence set.
**Alternate flows** **A1** `PENDING_CONFIRMATION` → confirm/dispute offered. **A2** Open clarification → response offered. **A3** Rotation offered.
**Exceptions** **E1** Wrong token → **uniform 404, identical to "no such report"**. **E2** Expired grant → same uniform response. **E3** Repeated failures → rate-limited by abuse identifier **and** report reference.
**Permissions** Valid grant — **not authentication, never exchangeable for a session**
**Audit** `anonymous_report_viewed` · `anonymous_access_failed`
**Privacy** **Reviewer and moderator identities are never returned. Internal notes are never returned. No other report is reachable.**
**Postconditions** Read-only; grant `last_used_at` updated

## UC-ANON-03 — Grant holder answers a clarification request

**Actors** Citizen (grant holder) · Street Representative / Moderator
**Trigger** A reviewer needs detail the report does not contain
**Preconditions** Open clarification request; reviewer in scope and **not the submitter**
**Main flow** 1. Reviewer raises a specific question. 2. Citizen sees it on next token-bound access. 3. Citizen responds with text, voice or additional **live-captured** evidence (`API-111`). 4. Response committed with the same integrity handling. 5. Reviewer sees it attributed to *"the reporter"*, **never to a person**.
**Alternate flows** **A1** Additional evidence → new manifest with clarification context. **A2** *"I don't know"* → recorded; workflow proceeds.
**Exceptions** **E1** **No response ever** → request expires after a configurable **14 days**; the case **proceeds on available evidence** and the non-response is recorded. **The report is never closed because the citizen did not answer.** **E2** Token lost → cannot respond; case proceeds.
**Permissions** Valid grant (citizen) · role + scope + state + not-submitter (staff)
**Audit** `clarification_requested` · `clarification_answered` · `clarification_expired`
**Privacy** **Bidirectional identity shielding.** No contact channel is established
**Postconditions** Response attached; workflow resumes

## UC-ANON-04 — Grant holder confirms resolution

**Actors** Citizen (grant holder)
**Trigger** Case reaches `PENDING_CONFIRMATION`
**Preconditions** Valid grant; **reporter entitlement**; **the confirming party is not the completion submitter** (`FR-FIX-006`)
**Main flow** 1. Citizen reviews the before/after comparison, which explicitly returns `no_automated_check:true`. 2. Confirms (`API-112`). 3. Server checks state version, entitlement and separation of duties. 4. `CitizenResolutionDecision` recorded; transition T9 applied.
**Alternate flows** **A1** Disputes instead → UC-ANON-05. **A2** No response in the window → window lapses; case resolves **unconfirmed and is labelled as such, not as confirmed**.
**Exceptions** **E1** Stale version → `E_STALE_STATE` (409). **E2** Completion submitter attempts to confirm → refused.
**Permissions** Reporter entitlement only, on that one report, in that one state
**Audit** `resolution_confirmed`
**Privacy** Before/after evidence shown to the entitled holder only; **no contractor or reviewer identity disclosed**
**Postconditions** Case resolved; decision recorded with `actor_kind = anonymous_grant`

## UC-ANON-05 — Grant holder disputes a claimed resolution

**Actors** Citizen (grant holder)
**Trigger** The citizen disagrees with a completion claim
**Preconditions** Valid grant; `PENDING_CONFIRMATION`
**Main flow** 1. Select dispute and give a reason. 2. Capture dispute evidence **live**. 3. Reason and evidence session submitted **together** (`API-113`). 4. `Dispute` and its evidence commit **atomically**. 5. Case → **`REOPENED`**. 6. **Rework requires a separate, separately audited decision** (T11d).
**Alternate flows** **A1** Dispute without new evidence → permitted if the reason is substantive. **A2** Second dispute after rework → **no hard cap**; each is a separate record and the full cycle stays visible.
**Exceptions** **E1** Stale version → `E_STALE_STATE`. **E2** Missing reason → `E_REASON_REQUIRED`. **E3** Evidence integrity failure → quarantined; **the dispute reason is still recorded**.
**Permissions** Reporter entitlement only
**Audit** `resolution_disputed` · `case_reopened`
**Privacy** Dispute evidence goes through the same privacy preview
**Postconditions** Case `REOPENED`; **not** `IN_PROGRESS` — the intermediate state is auditable and must not be skipped

## UC-ANON-06 — Grant holder rotates the tracking token

**Actors** Citizen (grant holder)
**Trigger** The citizen believes the token may have been seen by someone else
**Preconditions** Holder still possesses the **current** token
**Main flow** 1. Request rotation (`API-114`). 2. Server verifies the current grant. 3. **In one transaction:** issue a new grant, set `rotated_from_id`, and **revoke the predecessor**. 4. New plaintext token returned **once**.
**Alternate flows** **A1** Citizen re-saves via QR or printable receipt. **A2** Repeated rotation permitted; the chain is retained.
**Exceptions** **E1** Old token replayed after rotation → **uniform 404**. **E2** **Holder no longer possesses the token → rotation is impossible and there is no recovery.** This is by design: no identity exists to verify against, so any recovery route would be an attack path.
**Permissions** Valid current grant only
**Audit** `grant_rotated` — **records the rotation, never a token value**
**Privacy** The rotation chain links grants, **never a person**
**Postconditions** Exactly one active grant for the report; predecessor `revoked`

## UC-STAFF-REPORT-01 — Staff member reports officially

**Actors** Any staff role, **including a future UC Officer** · another qualified reviewer
**Trigger** A staff member observes a civic problem while on duty
**Preconditions** Authenticated session with **exactly one** active `RoleAssignment`
**Main flow** 1. Enter **Report officially** mode while remaining logged in. 2. Capture through the standard evidence pipeline. 3. Submit via `API-118` with `acting_role_assignment_id`. 4. Report stored with `actor_kind = staff_role_assignment` and **visibly labelled as officially submitted**. 5. **The submitter is recorded as excluded from every reviewer role on that record — a stored fact, not a runtime recomputation.** 6. Routed to a different qualified actor in scope.
**Alternate flows** **A1** No other qualified actor in scope → escalates one level. **A2** No eligible actor anywhere → **held unresolvable. Not auto-approved, not assigned back.**
**Exceptions** **E1** Submitter later attempts to verify → refused, `E_CONFLICT_OF_INTEREST`, logged. **E2** Attempts self-assignment → refused. **E3** Only one Moderator exists → seed a second before field test.
**Permissions** Any authenticated staff role with an active assignment
**Audit** `report_submitted` with the acting assignment
**Privacy** **Staff identity is recorded deliberately.** Officials do not report anonymously through an identified session
**Postconditions** Report labelled official; submitter permanently excluded; routed elsewhere

## UC-STAFF-REPORT-02 — Staff member enters isolated anonymous mode

**Actors** Staff member choosing to report as a citizen
**Trigger** A staff member wishes to report without official attribution
**Preconditions** Authenticated session exists; the member explicitly selects anonymous mode
**Main flow** 1. Member selects **Report anonymously**. 2. **The client opens an isolated public reporting context.** 3. **The client attaches no staff access token, no `acting_role_assignment_id`, no account identifier and no analytics identity.** 4. Submission proceeds exactly as UC-ANON-01 via `API-030`.
**Alternate flows** **A1** Member cancels → returns to the authenticated session unchanged.
**Exceptions** **E1** A stray `Authorization` header reaches `API-030` → **the server ignores and strips it, and does not log it.** It is **not** rejected, because rejecting would reveal that a valid token was present and make staff presence observable.
**Permissions** **None** — this is the public path
**Audit** `report_submitted` with `actor_kind = anonymous_grant`. **The audit contains nothing linking the report to the staff session**
**Privacy** **Unavoidable limitation, stated plainly.** Because the anonymous path records no person identity, **the server cannot prove that an anonymous reporter is also a staff member, and therefore cannot automatically enforce author-based conflict-of-interest on this path.** **Anonymity is not weakened to solve this.** The control is a **self-recusal warning and written policy** (`BR-038`): the client displays a recusal warning before submission, and **staff acting in an official capacity must use UC-STAFF-REPORT-01 whenever system-enforced recusal is required.**
**Postconditions** An identity-free report exists. **No technical link to the staff account exists, by design**

## UC-CONFLICT-01 — Official reporter is excluded from processing their own case

**Actors** System (enforcement) · all staff roles
**Trigger** Any attempt to verify, assign, approve completion, or close
**Preconditions** The record carries a recorded submitter
**Main flow** 1. Actor requests a reviewer-type action on record R. 2. Server evaluates in order: role → geographic/organisational scope → workflow state → **prior-party check** → declared conflicts → step-up. 3. All pass → execute and audit with `acting_role_assignment_id`.
**Alternate flows** **A1** Conflict detected → refused and R routed to another qualified actor. **A2** No alternative → escalate. **A3** Still none → **flag unresolvable and hold**.
**Exceptions** **E1** Submitter attempts verification → refused. **E2** Work submitter attempts to approve their own completion → refused (`FR-FIX-006`). **E3** Prior decision actor attempts to decide the resulting dispute or appeal → refused (`BR-030`). **E4** Declared conflict on the area or organisation → refused.
**Permissions** Evaluated, never assumed. **Deny by default**
**Audit** `conflict_refused` · `unauthorised_access_attempt` — recorded as a **permission refusal**, not a validation error
**Privacy** A refusal tells the actor only that they are conflicted, not the details of others' involvement
**Postconditions** No person ever reviews, approves or closes a record they submitted through the official path. **On the anonymous path this cannot be enforced technically — see UC-STAFF-REPORT-02 and `BR-038`**

---

*v1.1 · 21 August 2026 · aligned to SRS v1.4.1. **Specified; not implemented; not tested.** Parakh has no government adoption, no signed partnership, no deployment, no real users and no demonstrated impact.*


---

# Part E — v1.2 additions and screen-ID corrections

## Screen-ID correction — `CZ-16` restored

**v1.1 reused `CZ-16`, which was already the P1 case-reconsideration screen governed by `TBD-056` in v1.3.7.** That was an identifier collision, not a design choice. **`CZ-16` is restored to its original meaning and is not a Release 0 anonymous screen.** New citizen screens are allocated from the next genuinely unused identifier:

| Screen | Purpose | Rel |
|---|---|---|
| **`CZ-16`** | **Case reconsideration — RESTORED, unchanged from v1.3.7** | P1, conditional on `TBD-056` |
| `CZ-17` | Public reporting entry — privacy + non-emergency notice | P0 |
| `CZ-18` | Save your tracking code | P0 |
| `CZ-19` | Track a report | P0 |
| `CZ-20` | Answer a clarification | P1 |
| `CZ-21` | Recover a lost response | P0 |

Use cases referencing `CZ-03a` now reference **`CZ-17`**; those referencing the v1.1 `CZ-16` now reference **`CZ-18`**; `CZ-17` (v1.1 tracking) becomes **`CZ-19`**.

---

## UC-ANON-07 — Grant holder recovers a lost submission response

**Actors** Citizen (unauthenticated) · System
**Trigger** A submission was sent but no reference or token was received — connection dropped, app killed, or the response was lost
**Preconditions** The client holds the `submission_recovery_secret` it wrote to SecureStore **before** sending. The recovery window has not expired
**Main flow** 1. The client detects no acknowledged response. 2. It retries `POST /reports/recover` (`API-119`) with `X-Submission-Recovery-Secret` and the same `client_submission_id`, `payload_hash` and `manifest_hash`. 3. The server resolves the stored `recovery_hmac`. 4. Payload and manifest hashes match. 5. **In one transaction** the server revokes any previously issued grant, issues exactly one new grant, stores only its hash, and returns the new plaintext **once**. 6. The client shows `CZ-18` and, on acknowledgement, deletes the recovery secret.
**Alternate flow** **A1** The first response actually arrived late — the client already holds a token; recovery is skipped and the secret is deleted. **A2** The citizen retries manually from `CZ-21`.
**Exception flow** **E1** **Same secret, different payload** → `409 E_RECOVERY_CONFLICT`, uniform, disclosing nothing about what differs; the citizen is asked to start a new report. **E2** **Expired window** → uniform `404`, identical to an unknown secret. **E3** **Secret lost from the device** → **unrecoverable.** No identity exists to verify against, so no support path can restore it; the report still proceeds without citizen tracking. **E4** **Concurrent retries** → serialised on `client_submission_id`; exactly one grant ends active.
**Permissions** None — public route, rate-limited
**Audit** `grant_reissued_on_recovery`. **Never the secret, never the token**
**Privacy** The recovery secret is bound to one submission and to no person. **Recovery never reveals whether an unrelated report exists**
**Postconditions** **Exactly one `CivicReport` and exactly one active `AnonymousAccessGrant`**, however many retries occurred
**Screens** `CZ-21` → `CZ-18` · **APIs** `API-119` · **Requirements** `FR-ANON-009`, `FR-ANON-010` · **Tests** `TEST-ANON-015`…`019`, `025`

## UC-CONFLICT-02 — Cross-role conflict prevention at account level

**Actors** System (enforcement) · staff member holding multiple assignments
**Trigger** A staff member who submitted an official report attempts a reviewer action on it **under a different role assignment**
**Preconditions** The record carries `official_reporter_account_id`
**Main flow** 1. Officer submits officially under a UC Officer assignment (`API-118`). 2. The server stores the conflict against the **`StaffAccount`**, not the assignment. 3. The member later switches to a Moderator assignment (`API-120`). 4. They attempt `API-052` on that record. 5. **Check 5 of the six acting-role checks compares the acting *account*** to `official_reporter_account_id`. 6. **Denied**, routed to another qualified actor.
**Alternate flow** **A1** No independent actor in scope → escalate one level. **A2** None anywhere → **held unresolvable, never self-approved**
**Exception flow** **E1** A **new** assignment is granted to the same account afterwards → still denied; the conflict is stored against the account, so it binds future assignments too. **E2** A different account with the same role → permitted, as it should be
**Permissions** Evaluated, never assumed. **Deny by default**
**Audit** `conflict_refused` with the acting assignment **and** the account
**Privacy** The refusal tells the actor only that they are conflicted
**Postconditions** **No account reviews, approves or closes a record it submitted officially — under any role it holds, present or future**
**APIs** `API-052`, `API-053`, `API-055`, `API-058`, `API-062`, `API-071`, `API-078` · **Requirements** `FR-CONF-001`, `FR-CONF-002` · **Tests** `TEST-CONF-002`, `TEST-CONF-003`

## UC-ROLE-03 — Server verifies the acting role assignment

**Actors** System · staff member
**Trigger** Any bearer-protected request
**Preconditions** Authenticated session; `X-Acting-Role-Assignment-ID` present
**Main flow** The server runs six checks in order, denying on the first failure: **(1)** assignment belongs to the authenticated account · **(2)** active and unexpired at the point of action · **(3)** role permitted for this endpoint · **(4)** scope covers the target record · **(5)** account not conflicted or excluded · **(6)** MFA assurance and step-up satisfied.
**Alternate flow** **A1** Header absent and the account holds exactly one active assignment → resolved automatically, still recorded
**Exception flow** **E1** Assignment belongs to **another account** → denied at check 1, audited as `unauthorised_access_attempt`. **E2** Expired mid-session → denied at check 2; session downgraded. **E3** Revoked → denied on the **next action**, not at session issue
**Permissions** Per active assignment only. **Permissions are never unioned across assignments**
**Audit** Every event records `acting_role_assignment_id` **and** `staff_account_id`
**Privacy** — **Postconditions** Exactly one assignment governs the request
**Requirements** `FR-ROLE-001`, `FR-ROLE-002`, `FR-ROLE-003` · **Tests** `TEST-ROLE-001`…`003`

---

*v1.2 · 30 August 2026 · aligned to SRS v1.4.2. **Specified; not implemented; not tested.***
