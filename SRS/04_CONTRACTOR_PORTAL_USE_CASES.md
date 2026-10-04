# Parakh — Contractor Portal Use Cases

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Portal** | **Contractor (`CON`)** — Django Templates + HTMX + Alpine.js |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 |
| **Screens** | Shared `STF-01` … `STF-10` · Own `CON-01` … `CON-04` |
| **Use cases** | `UC-CON-001` … `UC-CON-024` |

---

# A. Portal purpose

The Contractor is the **only external commercial party** in Parakh. Everyone else is a citizen or a public servant. A contractor receives assigned work, does it, and provides evidence that it was done.

**The privacy boundary around this portal is the tightest in the system**, and it is deliberate. A contractor needs to know **what to fix and where** — not who reported it, what they sound like, or how to reach them.

## Boundaries

| The Contractor does | The Contractor does not |
|---|---|
| See work assigned to **their own organisation** | See any other organisation's work |
| Read the **confirmed Urdu civic rendering** | Hear the **original citizen recording** |
| See **redacted** photo/video evidence | See the **intermediate ASR output** |
| Accept or decline assigned work with an allowed reason | Verify their own completion |
| Post progress and submit completion evidence | Close a case, or decide a dispute or appeal |
| Report an **unrelated** issue through `STF-10` if authorised | Be assigned work their own account reported |

## Prohibited actions — enforced server-side, not by template omission

**A contractor may never:** receive a citizen mobile number, `citizen_account_id`, or name — **the name field does not exist** · access `voice_original` in any form, including a link or a signed URL · read `source_asr_text` · read internal staff notes or the audit narrative · verify their own completion · close a case · decide a dispute or appeal · accept work while their organisation is suspended, revoked or expired · see or act on work belonging to another organisation.

> **This changed at CR-61 rev 1.3.** Revision 1.2 gave contractors `assigned only` access to the original recording. **That access is withdrawn.** A voice recording is biometric-adjacent and identifies the speaker in a way text does not.

---

# B. Actor and account summary

| Property | Value |
|---|---|
| **Actor code** | `CON` |
| **Who invites** | **A Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`, and only after the contractor organisation is `APPROVED`** |
| **Account identifier** | **Official mobile number**, in `StaffCredential` only. `staff_reference` is optional, administrative, **never used for login** |
| **Authentication factors** | **Two — user-created password + six-digit SMS OTP.** Identical to every other staff role |
| **Activation** | Organisation approved → invitation → OTP on the intended number → **the contractor creates their own password** |
| **RoleAssignment** | At least one `ACTIVE` and unexpired, **with `organization_id` set** |
| **Scope** | **Organisational, not geographic.** A contractor sees a report only if it is assigned to their organisation |
| **Organisation statuses** | `PENDING_APPROVAL` · `APPROVED` · `SUSPENDED` · `EXPIRED` · `REVOKED` |
| **Account statuses** | `INVITED` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `REVOKED` · `EXPIRED` |
| **Login blocked when** | Account suspended, revoked or expired; **or the organisation is suspended, revoked or expired — suspension cascades to its accounts immediately**; or no active `RoleAssignment` |
| **Step-up** | Fresh SMS OTP, 10-minute window. **No routine contractor action requires step-up.** Only `STF-10` official reporting shares the general staff rules |
| **Logout** | `STF-09` — this session or **sign out everywhere** |

## The employee hierarchy question

**A contractor organisation may have several staff accounts. Parakh does not model a hierarchy between them** — no foreman, no crew, no supervisor relationship. Every contractor account in an organisation has the same organisational scope. **A contractor employee hierarchy is explicitly future scope** and is not invented here.

---

# C. The 0-to-100 golden journey

*Actor: a drainage repair firm whose organisation was approved yesterday; the site supervisor was invited this morning.*

| Step | Screen | User sees | User action | System action | API | Data | Authorization | State | Audit | Success | Failure | Offline | Accessibility / language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0** | — | *(Before this journey)* Mayor/Ops approved the organisation at `MAY-05` with an approval reference, categories and service areas | — | `ContractorOrganization` → `APPROVED` | — | `ContractorOrganization` | `CAP_ACCOUNT_ADMIN` + step-up | `PENDING_APPROVAL` → `APPROVED` | `organisation_approved` | Invitation becomes possible | **A contractor account cannot be invited before approval** | **Online only** | Approval reference recorded, not invented |
| **1** | — | SMS with a single-use invitation link | Taps the link | Portal opens | — | — | — | `INVITED` | `contractor_provisioned` | `STF-01` | Expired → plain message, **no account detail disclosed** | **Online only** | Plain link text |
| **2** | `STF-01` | *"You have been invited as a Contractor for Drainage Repairs Ltd"* and a mobile-number field | Enters the official number | Compares against `intended_phone_lookup_hmac` | `API-123` | `AccountInvitation` read | Invitation validity | `INVITED` | — | `STF-02` | **A different number is refused; the invitation is not consumed** | **Online only** | Organisation named in plain text |
| **3** | `STF-02` | Six digit boxes | Enters the code | Verifies *(`purpose = staff_activation`)* | `API-124` | `OTPChallenge` consumed | Ticket-bound | → `PENDING_ACTIVATION` | `otp_verified` | `STF-03` | **Uniform** message | **Online only** | Digits LTR |
| **4** | `STF-03` | Password, confirm, plain guidance | **Creates their own password** | Argon2id, hash only | `API-105` | `StaffCredential` | Ticket-bound | → `ACTIVE` | `password_set` | `STF-04` | Weak → plain guidance | **Online only** | **No administrator ever sees this** |
| **5** | `STF-04` → `STF-05` | Sign in, then a six-digit code | Enters password, then OTP | **Two factors**; issues tokens and the assignment list | `API-005`, `API-125` | `AuthSession`, `RefreshTokenFamily`, `DeviceSession` | Public-auth → ticket-bound | — | `login_first_factor`, `otp_verified`, `session_created` | `STF-06` | Wrong number and wrong password are **operationally indistinguishable** | **Online only** | **First and second factor — never a third** |
| **6** | `STF-06` | *"You are signed in as Contractor for Drainage Repairs Ltd."* | Selects it | Binds **exactly one** `RoleAssignment` with `organization_id` | `API-120` | `AuthSession.acting_role_assignment_id` | **See D-04** | — | `acting_role_selected` | `CON-01` | No active assignment → plain screen, **no privilege** | **Online only** | **Organisation named plainly, no RBAC jargon** |
| **7** | `CON-01` | *Assigned work* — jobs assigned to **this organisation only** | Opens the top job | Loads assignments filtered by `organization_id` | `GET /reports?assigned_org=...` | — | Role + **organisational scope** | `CONTRACTOR_ASSIGNED` | — | `CON-02` opens | Another organisation's job → **not rendered, refused if requested directly** | **Online only** | Job list shows category, location and deadline in plain text |
| **8** | `CON-02` | **The work packet:** confirmed **Urdu civic rendering**, issue category, required location, **redacted** photo evidence, work instructions, safe access information, progress and completion requirements | Reads it | Serves a **privacy-filtered** response | `GET /reports/{id}` | — | Organisational scope | `CONTRACTOR_ASSIGNED` | `report_viewed` | Accept/Decline controls appear | — | **Online only** | **No citizen number, no account ID, no name, no `voice_original`, no `source_asr_text`, no staff notes, no audit narrative** |
| **9** | `CON-02` | **Accept** and **Decline with a reason** | Taps **Accept** | **Re-checks eligibility at the point of action:** account `ACTIVE`, organisation `APPROVED` and active, within `valid_from … valid_until` | `POST /reports/{id}/work/accept` *(`API-164`)* | `CaseAssignment.accepted_at`, `CivicReport.state` | **`CAP_WORK_ACCEPT`** + organisational scope | `CONTRACTOR_ASSIGNED` → **`IN_PROGRESS`** | `work_accepted` | UC Officer and citizen notified | Organisation suspended since assignment → **refused, even with a valid session** | **Online only** | Accept and Decline are visually and textually distinct |
| **10** | `CON-03` | Progress note field, percent, evidence upload | Types a note, attaches two photos, taps **Post update** | Appends to `ContractorProgress` — **append-only** | `POST /reports/{id}/progress` *(`API-165`)* | `ContractorProgress`, `EvidenceObject` | `CAP_WORK_PROGRESS` | `IN_PROGRESS` | `progress_updated` | Update visible to the UC Officer and, where approved, the citizen | Upload failure → **named failure, the draft note is preserved, retry offered** | **Online only** | Named upload state, **never a bare spinner** |
| **11** | `CON-04` | Completion note, **required** completion evidence | Attaches after-photos and submits | Evidence is **required** for completion | `POST /reports/{id}/completion` *(`API-166`)* | `CompletionEvidence`, `EvidenceObject` | `CAP_WORK_COMPLETE` | `IN_PROGRESS` → **`COMPLETION_SUBMITTED`** | `completion_submitted` | **System routes to a conflict-free Street Representative** | Missing evidence → refused | **Online only** | Images described in text |
| **12** | `CON-01` | The job leaves the active list; its status becomes *"Being confirmed"* | Reads | **The contractor plays no further part.** A Representative verifies; the citizen confirms; a UC Officer closes | — | — | — | `COMPLETION_VERIFICATION` → … → `CLOSED` | `completion_routed`, `completion_verified`, `resolution_confirmed`, `case_closed` | Case completes | Representative rejects completion → **back to `IN_PROGRESS`**, reappears at `CON-01` | **Online only** | **The contractor never verifies their own work** |
| **13** | `STF-09` | Device list | **Sign out** | Server-side revocation | `API-004` | `AuthSession.revoked_at` | Own session | — | `session_revoked` | Returns to `STF-04` | — | **Online only** | **Client discard is not a logout** |

**End of golden journey. 14 steps, Step 0 to Step 13.**

---

# D. Formal use cases

### UC-CON-001 — Contractor organisation registration

| Field | Detail |
|---|---|
| **Status** | **Documented only to the extent the sources approve** |
| **What the sources define** | `ContractorOrganization` with `legal_name`, `approval_reference`, `approved_by`, `approved_at`, `status`, `valid_from`, `valid_until`, `approved_categories[]`, `service_areas[]`. Statuses: `PENDING_APPROVAL` · `APPROVED` · `SUSPENDED` · `EXPIRED` · `REVOKED` |
| **What the sources do not define** | **There is no self-service organisation registration route, screen or API in any approved source.** No `POST /organisations` exists in API Contract v3.0 |
| **Consequence** | **An organisation record reaching `PENDING_APPROVAL` is an administrative act performed by Mayor & Operations**, not a contractor self-registration. **No public registration form is invented here** |
| **Prohibited** | **A UC Officer can never create a contractor organisation** |
| **Open decisions** | `DEFERRED — define during the portal use-case phase`: **this pack is that phase, and the sources still contain no registration surface.** Whether contractors may apply themselves, or are only entered by Mayor & Ops, is **`TBD — Hassan decision required`** |

### UC-CON-002 — Mayor/Ops reviews and approves the organisation

| Field | Detail |
|---|---|
| **Primary actor** | **Mayor & Operations user holding `CAP_ACCOUNT_ADMIN`** |
| **Preconditions** | Organisation record exists in `PENDING_APPROVAL` |
| **Authorization** | `CAP_ACCOUNT_ADMIN` + **step-up** |
| **Main flow** | **0.** `MAY-05`. **1.** Reviews the record. **2.** Records an `approval_reference`, the `approved_categories[]`, the `service_areas[]` and `valid_from … valid_until`. **3.** Step-up OTP. **4.** `PENDING_APPROVAL` → **`APPROVED`** |
| **Exception** | **E1** Step-up stale → `401 E_STEP_UP_REQUIRED`. **E2** Missing approval reference → refused |
| **Critical rule** | **No contractor staff account may be invited until the organisation is `APPROVED`** |
| **Entities written** | `ContractorOrganization` |
| **APIs / Screens / Capabilities** | Organisation approval route / `MAY-05`, `STF-08` / `CAP_ACCOUNT_ADMIN` |
| **Audit / State** | `organisation_approved` / → `APPROVED` |

### UC-CON-003 — Mayor/Ops invites a contractor staff account

| Field | Detail |
|---|---|
| **Preconditions** | **Organisation `APPROVED` and active** |
| **Authorization** | `CAP_ACCOUNT_ADMIN` + `CAP_ROLE_ASSIGN` + **step-up** |
| **Main flow** | **0.** `MAY-03`. **1.** Enters the intended official number, selects the approved organisation, sets a **mandatory expiry**. **2.** Step-up OTP. **3.** Creates `StaffAccount` `INVITED`, `RoleAssignment` `PENDING` with `organization_id` and `valid_until`, and a single-use, hashed, **phone-bound** `AccountInvitation` |
| **Exception** | **E1** Organisation not `APPROVED` → **refused**. **E2** Scope exceeds the assigner's own → refused, audited |
| **Security** | **The administrator never sets a credential. Public signup does not exist as a route** |
| **APIs / Screens** | `API-098` / `MAY-03` |
| **Audit** | `contractor_provisioned`, `role_assigned` |
| **Given/When/Then** | *Given* an organisation in `PENDING_APPROVAL`, *when* a contractor invitation is attempted, *then* it is refused |

### UC-CON-004 — Invitation acceptance · UC-CON-005 — OTP verification · UC-CON-006 — Create own password

| Field | Detail |
|---|---|
| **Main flow** | **0.** `STF-01` names the role **and the organisation** in plain language; the invitee confirms their official number. **1.** `STF-02` — OTP *(`purpose = staff_activation`)*. **2.** `STF-03` — **the contractor creates their own password**, Argon2id. **3.** Account → `ACTIVE` |
| **Exception** | **E1** Expired or consumed → uniform message. **E2** Wrong number → refused, **invitation not consumed** |
| **Offline** | **Impossible** |
| **Security** | **Identical authentication to every other staff role.** No contractor-specific login technology exists |
| **APIs / Screens** | `API-123`, `API-124`, `API-105` / `STF-01`, `STF-02`, `STF-03` |
| **Audit** | `otp_verified`, `password_set` |
| **Open decisions** | **D-07 PROPOSED** — purpose-bound tickets |

### UC-CON-007 — Password + OTP login · UC-CON-008 — Acting-role selection

| Field | Detail |
|---|---|
| **Main flow** | `STF-04` password → `STF-05` OTP → `STF-06` select exactly one assignment → `CON-01` |
| **Preconditions** | Account `ACTIVE`, ≥1 assignment `ACTIVE` and unexpired, **and the organisation `APPROVED` and active** |
| **Exception** | **E1** Organisation suspended → **login refused; suspension cascades to its accounts immediately**. **E2** No active assignment → plain screen, **no privilege**. **E3** Wrong credentials → **indistinguishable** outcomes |
| **APIs / Screens** | `API-005`, `API-125`, `API-120` / `STF-04`, `STF-05`, `STF-06` |
| **Audit** | `login_first_factor`, `otp_verified`, `session_created`, `acting_role_selected` |
| **Open decisions** | **D-04 / D-05 — Blocker, PROPOSED**: `API-120` is classed `Staff-authenticated` and therefore requires the acting-role header it exists to obtain. **Circular.** Recommendation: a `Staff-pre-role` class with zero capabilities |

### UC-CON-009 — View assigned work belonging only to this organisation

| Field | Detail |
|---|---|
| **Authorization** | Role + **organisational scope**. `CON` scope is **`assigned only`**, never geographic |
| **Main flow** | `CON-01` lists jobs where `CaseAssignment.contractor_organization_id` equals the acting assignment's `organization_id` |
| **Exception** | A direct request for another organisation's report returns the **same `404`** as a non-existent report — **not-found, not-owned and no-permission are indistinguishable**, so the route is not an enumeration oracle |
| **Screens / Audit** | `CON-01` / `unauthorised_access_attempt` on a cross-organisation attempt |
| **Given/When/Then** | *Given* contractor A's session and contractor B's assigned report ID, *when* it is requested, *then* the response is `404` and identical to a request for a fabricated ID |

### UC-CON-010 — Open the privacy-filtered work packet · UC-CON-011 — Confirm what is not displayed

| Field | Detail |
|---|---|
| **What `CON-02` contains** | Confirmed **Urdu civic rendering** · issue category · required location · **relevant redacted photo/video evidence** · work instructions · safe access information · progress and completion requirements |
| **What `CON-02` must never contain** | **Original citizen audio** *(`voice_original`, including any link or signed URL)* · **intermediate source-language ASR output** *(`source_asr_text`)* · citizen mobile number, masked or otherwise · `citizen_account_id` · **citizen name — the field does not exist** · internal staff notes · unrestricted audit narrative · the official reporter's staff identity |
| **Enforcement** | **Server-side.** The excluded fields are **absent from the serialiser, not merely hidden by the template.** A hidden field in a payload is a leak waiting for a curl command |
| **Why audio is excluded** | A voice recording is **biometric-adjacent** and identifies the speaker in a way text does not. **A contractor is an external commercial party who needs to know what to fix and where — not who said it or how they sound** |
| **APIs / Screens** | `GET /reports/{id}` privacy-filtered / `CON-02` |
| **Audit** | `report_viewed` |
| **Given/When/Then** | *Given* any contractor response, *when* the raw payload is inspected, *then* it contains no `voice_original` reference, no `source_asr_text`, no citizen phone number, no `citizen_account_id` and no name field |

### UC-CON-012 — Accept assigned work · UC-CON-013 — Decline with an allowed reason · UC-CON-014 — Eligibility recheck at acceptance

| Field | Detail |
|---|---|
| **Preconditions** | State `CONTRACTOR_ASSIGNED`; the job belongs to this organisation |
| **Authorization** | **`CAP_WORK_ACCEPT`** + organisational scope + **contractor must be active at the point of action** |
| **Main flow (012)** | **0.** `CON-02`. **1.** Taps **Accept**. **2.** **Server re-checks all eligibility conditions at the moment of the action**, not at assignment time: account `ACTIVE`, organisation `APPROVED` and active, current date within `valid_from … valid_until`. **3.** `CaseAssignment.accepted_at` set. **4.** `CONTRACTOR_ASSIGNED` → **`IN_PROGRESS`**. **5.** UC Officer and citizen notified |
| **Main flow (013)** | **Decline with an allowed reason** → `CONTRACTOR_ASSIGNED` → **`ACCEPTED`**, audited `work_declined`. The UC Officer reassigns |
| **Alternate** | **No response within `response_deadline`** → **system** returns the report to `ACCEPTED`, audited `assignment_lapsed`. **Automatic, not a human decision** |
| **Exception (014)** | **E1** Organisation suspended between assignment and acceptance → **refused, even with a still-valid session.** **E2** Approval expired → refused. **E3** Stale `state_version` → `409 E_STALE_STATE` |
| **APIs / Screens / Capabilities** | `API-164` / `CON-02` / `CAP_WORK_ACCEPT` |
| **Audit / State** | `work_accepted` / `work_declined` / `assignment_lapsed` |
| **Given/When/Then** | *Given* an organisation suspended after assignment, *when* the contractor accepts, *then* the request is refused despite the valid session |

### UC-CON-015 — Post progress updates · UC-CON-016 — Upload progress evidence · UC-CON-018 — Edit a draft update before submission

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_WORK_PROGRESS`** + organisational scope; state `IN_PROGRESS` |
| **Main flow** | **0.** `CON-03`. **1.** Types a note, optionally a percentage. **2.** Attaches evidence. **3.** Taps **Post update**. **4.** `ContractorProgress` appended |
| **Alternate (018)** | A note may be edited **before** it is posted. **`ContractorProgress` is append-only once submitted** — a posted update is never rewritten |
| **Exception** | Upload failure → **named failure, the composed note preserved, retry offered** |
| **Offline** | **Blocked.** The staff portal is server-rendered Django/HTMX with **no offline queue, no local database and no background sync** |
| **APIs / Screens** | `API-165` / `CON-03` |
| **Audit** | `progress_updated` |

### UC-CON-017 — Submit completion evidence · UC-CON-019 — Handle upload failure

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_WORK_COMPLETE`** + organisational scope; state `IN_PROGRESS` |
| **Input data** | Completion note · **evidence is required** |
| **Main flow** | **0.** `CON-04`. **1.** Attaches after-photos and a completion note. **2.** Submits. **3.** `CompletionEvidence` written with `submitted_by_account_id`. **4.** `IN_PROGRESS` → **`COMPLETION_SUBMITTED`**. **5.** **The system routes to a conflict-free Street Representative** |
| **Exception (019)** | **E1** Missing evidence → refused. **E2** Chunk hash mismatch → `422 E_CAPTURE_INTEGRITY`, retry that chunk. **E3** Connection lost mid-upload → resumable upload continues from the last confirmed chunk |
| **Critical rule** | **The submitter is excluded from verifying their own completion.** No actor both does the work and approves it |
| **APIs / Screens / Capabilities** | `API-166` / `CON-04` / `CAP_WORK_COMPLETE` |
| **Audit / State** | `completion_submitted` / `IN_PROGRESS` → `COMPLETION_SUBMITTED` |
| **Given/When/Then** | *Given* a contractor who submitted completion, *when* they attempt to verify it, *then* no such capability exists for `CON` and the attempt fails |

### UC-CON-020 — Expired, suspended or revoked organisation

| Field | Detail |
|---|---|
| **Rule** | **Suspending the organisation cascades to its accounts immediately** |
| **Effect on login** | Refused |
| **Effect on an active session** | The **next action fails**, not the next login. Eligibility is **checked at the point of action** |
| **Effect on assignment** | The organisation **disappears from the eligible list** at `UCO-03`, and the server refuses assignment regardless of what the client displayed |
| **Effect on an accepted job** | The contractor **cannot post progress or submit completion**. The UC Officer reassigns |
| **Audit** | `organisation_approved` on approval; suspension and revocation are audited on the organisation record |

### UC-CON-021 — Handle reassignment

| Field | Detail |
|---|---|
| **Trigger** | A UC Officer reassigns the job to a different organisation |
| **Main flow** | **0.** The previous `CaseAssignment` is closed. **1.** A new `CaseAssignment` is created for the new organisation. **2.** The job **disappears from the previous contractor's `CON-01`**. **3.** Any progress already recorded **remains on the report** — `ContractorProgress` is append-only and is not deleted |
| **Privacy** | The **previous** contractor loses read access to the report from the moment the assignment closes |
| **Audit** | `contractor_assigned` for the new assignment |

### UC-CON-022 — Report an unrelated issue officially through `STF-10`

| Field | Detail |
|---|---|
| **Preconditions** | Authenticated, acting role selected, **holds `CAP_REPORT_OFFICIAL`** |
| **Authorization** | **`CAP_REPORT_OFFICIAL`.** **Service accounts and automated integrations are excluded.** A contractor holds it only if explicitly granted |
| **Main flow** | **0.** `STF-10` — **the same shared screen used by all four staff roles**; four duplicate reporting systems do not exist. **1.** The screen states plainly, before submission, that **the reporter will be excluded from acting on this report**. **2.** Category · evidence · voice recording. **3.** AI produces an Urdu rendering, **labelled AI-generated**, with a version indicator. **4.** The contractor **confirms their own rendering** under `CAP_RENDERING_CONFIRM_OWN`. **5.** Atomic creation at `SUBMITTED`, reference issued in the same transaction, **`ConflictExclusion` written** |
| **Security** | **A contractor cannot confirm a citizen's rendering or another staff user's rendering** |
| **Offline** | **Blocked in every respect** — see **D-11** |
| **Entities written** | `ClientSubmission` *(`reporter_subject_type = staff`)* · `VoiceTranscriptionArtifact` · `RenderingConfirmation` · `CivicReport` · `ReportOwnership` · **`ConflictExclusion`** |
| **APIs / Screens / Capabilities** | `API-130`, `API-131/132`, `API-135`, **`API-141`** / `STF-10` / `CAP_REPORT_OFFICIAL`, `CAP_RENDERING_CONFIRM_OWN` |
| **Audit / State** | `report_submitted` *(`staff_role_assignment`)* / → `SUBMITTED` |
| **Open decisions** | **D-02 / D-03** — no staff screen shows a contractor their own reports. **D-09** — **staff receive no versioned voice-processing notice**, and `ConsentRecord` cannot hold a staff consent because it is keyed on `citizen_account_id`. **D-11** — the offline claim on `STF-10` contradicts the Django/HTMX stack. **D-14** — mandatory photo remains open |

### UC-CON-023 — Preventing assignment to the reporter's own organisation

| Field | Detail |
|---|---|
| **Status** | **Blocked by an open decision. This is presented as a labelled branch, not a flow** |
| **The problem, stated plainly** | A contractor staff account reports a blocked drain through `STF-10`. **That account is excluded** by `ConflictExclusion`. **Their organisation is not.** A UC Officer may then assign the repair to the very organisation whose employee requested the work, which bills for it |
| **What the sources say** | `ConflictExclusion` is keyed on **`excluded_staff_account_id`** only. Contractor eligibility at `UCO-03` checks account status, organisation approval, dates, category and area — **but not conflict**. **No source addresses organisation-level conflict** |
| **Branch A — recommended, not approved** | When `reporter_kind = staff_official` **and** the reporting account belongs to a `ContractorOrganization`, write **two** exclusions: the account-level row, **plus an organisation-level row**. `API-163` filters that organisation out of the eligible list; the server re-checks at `API-164` acceptance |
| **Branch B** | Leave the gap. **Documented as the current state, not recommended** |
| **Open decisions** | **D-06 — Blocker, `TBD — Hassan decision required`** |

### UC-CON-024 — Password reset, session management and logout

| Field | Detail |
|---|---|
| **Main flow** | `STF-07` reset — number → OTP *(`purpose = password_reset`)* → new password. **Revokes all existing sessions.** Notifies the contractor and the appropriate administrator. **Cannot reactivate a suspended, revoked or expired account, or one whose organisation is suspended.** `STF-09` lists devices and offers **sign out everywhere**. Logout is **server-side revocation** |
| **Mobile-number change** | **Not self-service.** Requires Mayor/Ops approval at `MAY-03` with a reason, OTP on the new number, session revocation and audit |
| **Security** | **Replay of a consumed refresh token revokes the whole family** |
| **APIs / Screens** | `API-127`, `API-128`, `API-004` / `STF-07`, `STF-09` |
| **Audit** | `password_reset`, `session_revoked` |

---

## Privacy verification checklist for this portal

| Check | Where enforced | Test |
|---|---|---|
| No citizen mobile number in any contractor response | Server-side serialiser | `AT-PRV-003` |
| No `citizen_account_id` | Server-side serialiser | `AT-PRV-003` |
| **No citizen name — the field does not exist** | Data model | `AT-PRV-009` |
| **No `voice_original` reference, link or signed URL** | Server-side serialiser | `AT-PRV-001` |
| **No `source_asr_text`** | Server-side serialiser | `AT-PRV-002` |
| No internal staff notes | Server-side serialiser | `AT-PRV-004` |
| No unrestricted audit narrative | `CAP_AUDIT_READ` denied to `CON` | `AT-PRV-005` |
| No cross-organisation visibility | Organisational scope | `AT-SCOPE-004` |
| Contractor cannot verify own completion | Capability absent for `CON` | `AT-PERM-007` |
| Contractor cannot close a case | `CAP_CASE_CLOSE` is `UCO` only | `AT-PERM-008` |

---

## Coverage summary

| Requirement | Use case |
|---|---|
| 1 organisation registration | `001` *(documented as unspecified in the sources)* |
| 2 approval · 3 invitation · 4 acceptance · 5 OTP · 6 password | `002`–`006` |
| 7 login · 8 role selection | `007`, `008` |
| 9 assigned work · 10 work packet · 11 privacy confirmation | `009`–`011` |
| 12 accept · 13 decline · 14 eligibility recheck | `012`–`014` |
| 15 progress · 16 evidence · 17 completion · 18 edit draft · 19 upload failure | `015`–`019` |
| 20 organisation status · 21 reassignment | `020`, `021` |
| 22 `STF-10` · 23 organisation self-dealing | `022`, `023` |
| 24 reset, sessions, logout | `024` |

## Open decisions affecting this portal

| ID | Severity | Decision |
|---|---|---|
| **D-06** | **Blocker** | Contractor **organisation**-level self-dealing — **`TBD`** |
| **D-04 / D-05** | **Blocker** | Acting-role selection circularity — **PROPOSED** |
| **D-02 / D-03** | **Blocker / High** | Staff report tracking and `STF-11` — **`TBD` / PROPOSED** |
| **D-07** | High | Purpose-bound OTP tickets — **PROPOSED** |
| **D-09** | High | Staff voice-processing notice — **PROPOSED** |
| **D-11** | High | `STF-10` offline claim — **PROPOSED: online-only** |
| **D-13** | **Blocker** | Citizen name does not exist — followed here |
| **D-14** | High | Mandatory photo — **`TBD`** |
| — | — | Contractor organisation self-registration surface — **`TBD`** · contractor employee hierarchy — **explicitly future scope** |

---

*Specified; not implemented; not tested. No work has been assigned, accepted or completed by any contractor.*
