# Parakh — Street Representative Portal Use Cases

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Portal** | **Street Representative (`REP`)** — Django Templates + HTMX + Alpine.js |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 |
| **Screens** | Shared `STF-01` … `STF-10` · Own `REP-01` … `REP-04` |
| **Use cases** | `UC-REP-001` … `UC-REP-024` |

---

# A. Portal purpose

The Street Representative is the **ground truth** in Parakh. Somebody has to physically go and look. The Representative verifies that a reported problem exists, and later verifies that the work a contractor claims to have done was actually done.

**This is the role that makes Parakh evidence-first rather than complaint-only.** Without it, the platform is a suggestion box.

## Boundaries

| The Representative does | The Representative does not |
|---|---|
| Verify reports in their assigned ward or Union Council | Accept, reject or close a case |
| Verify contractor completion | Assign or reassign a contractor |
| Request clarification from the reporter | See the reporter's mobile number |
| Flag a bad Urdu rendering for review | **Confirm anybody's rendering but their own** |
| Recuse themselves from a case | Invite another Representative |
| Report an issue officially through `STF-10` | Act on a report they themselves filed |

## Prohibited actions — enforced server-side

**A Representative may never:** invite another Representative — **routine invitation belongs to the UC Officer** · accept, reject, assign, close or decide an appeal · see any citizen phone number, in any form · read the civic audit narrative · confirm a citizen's or another staff member's rendering · verify a report they filed, under any role · act outside their assigned geographic scope · silently delete a suspected duplicate.

> **`REP-05` no longer exists.** Official reporting moved to the shared `STF-10`. The identifier is **retired, not reassigned**.

---

# B. Actor and account summary

| Property | Value |
|---|---|
| **Actor code** | `REP` |
| **Who invites** | **A UC Officer**, within the officer's own authorised scope. **Never a Mayor/Ops user in routine operation** |
| **Account identifier** | **Official mobile number**, held only in `StaffCredential`. **`staff_reference` is optional, administrative, and never used for login** |
| **Authentication factors** | **Two — a user-created password (knowledge) + a six-digit SMS OTP (possession)** |
| **Activation** | Invitation → OTP verification of the **intended** number → **the user creates their own password** |
| **Password** | **Created by the account owner alone.** No administrator chooses, views, transmits or stores it. **Never sent by SMS, email, WhatsApp or on paper** |
| **RoleAssignment** | At least one **`ACTIVE` and unexpired** assignment is required before any privilege applies |
| **Scope** | Geographic — ward or Union Council, from `GeographicScope` |
| **Account statuses** | `INVITED` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `REVOKED` · `EXPIRED` |
| **Login blocked when** | Account `SUSPENDED`, `REVOKED` or `EXPIRED`; **or `ACTIVE` with no active `RoleAssignment`** — the account authenticates but receives **no portal privilege** |
| **Step-up** | Fresh SMS OTP, valid **10 minutes** from `recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)`. **The login OTP already satisfies the window** |
| **Logout** | `STF-09` — end this session or sign out everywhere |

---

# C. The 0-to-100 golden journey

*Actor: a community volunteer in Ward 4, UC 12, invited yesterday by the UC Officer.*

| Step | Screen | User sees | User action | System action | API | Data | Authorization | State | Audit | Success | Failure | Offline | Accessibility / language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0** | — | An SMS with a single-use invitation link | Taps the link | Browser opens the portal | — | — | — | `INVITED` | `rep_invited` *(written earlier)* | `STF-01` opens | Link expired → plain message, **no account detail disclosed** | **Online only** | Link text is plain, not a raw token |
| **1** | `STF-01` | *"You have been invited as a Street Representative for Ward 4, Union Council 12"* and a field to **confirm your mobile number** | Types the official number | Compares against `intended_phone_lookup_hmac` | `POST /auth/staff/invitation/accept` *(`API-123`)* | `AccountInvitation` read | Invitation validity | `INVITED` | — | `STF-02` opens | **A different number is refused.** Uniform message, invitation not consumed | **Online only** | **Scope stated in plain language, not as a code** |
| **2** | `STF-02` | Six digit boxes, resend timer | Enters the code | Verifies the challenge *(`purpose = staff_activation`)* | `POST /auth/staff/otp/verify` *(`API-124`)* | `OTPChallenge` consumed | Ticket-bound | `INVITED` → `PENDING_ACTIVATION` | `otp_verified` | `STF-03` opens | Wrong/expired → **uniform** message | **Online only** | Digits LTR; **attempts remaining announced** |
| **3** | `STF-03` | Password field, confirm field, plain strength guidance | **Creates their own password** | Hashes with **Argon2id**; stores hash only | `POST /auth/staff/password/set` *(`API-105`)* | `StaffCredential` written | Ticket-bound | → `ACTIVE` | `password_set` — **never the value** | `STF-04` opens | Too weak → plain guidance, no jargon | **Online only** | **No administrator ever sees this value** |
| **4** | `STF-04` | *"Sign in"* — mobile number and password | Enters both | Verifies the password hash | `POST /auth/staff/login` *(`API-005`)* | — | Public-auth | — | `login_first_factor` | `STF-05` opens with a `login_ticket` carrying **no privilege** | **Wrong number and wrong password are operationally indistinguishable** | **Online only** | Labelled **"First authentication factor"** |
| **5** | `STF-05` | Six digit boxes | Enters the code | Verifies *(`purpose = staff_login`)*; issues tokens and **the list of active role assignments** | `POST /auth/staff/login/otp` *(`API-125`)* | `AuthSession`, `RefreshTokenFamily`, `DeviceSession` | Ticket-bound | — | `otp_verified`, `session_created` | `STF-06` opens | Uniform failure | **Online only** | Labelled **"Second authentication factor"**. **This is two-factor, never three** |
| **6** | `STF-06` | One line: *"You are signed in as Street Representative for Ward 4, Union Council 12."* | Taps it | Binds **exactly one** `RoleAssignment` to the session | `POST /auth/role/select` *(`API-120`)* | `AuthSession.acting_role_assignment_id` set | **See D-04** | — | `acting_role_selected` | `REP-01` opens | No active assignment → **"Your account is active but you have no current role. Contact your UC Officer."** | **Online only** | **Plain sentence, not a matrix. No RBAC jargon** |
| **7** | `REP-01` | *My verifications* — a queue of items in Ward 4 | Opens the top item | Loads scope-filtered reports | `GET /reports?scope=...` | — | Role + geographic scope | `UNDER_VERIFICATION` | — | `REP-02` opens | Out-of-scope item → **not rendered, and refused server-side if requested** | **Online only** | **Own reports never appear in this queue** |
| **8** | `REP-02` | Category, location, **confirmed Urdu rendering labelled AI-generated**, photos, **original recording playable — scope-limited, for verification**, and **no citizen identity of any kind** | Reads and plays the recording | Serves privacy-filtered content | `GET /reports/{id}` | — | Scope + capability | `UNDER_VERIFICATION` | `report_viewed`, `audio_played` | Verification form appears | — | **Online only** | **No phone number, no account ID, no name — the name field does not exist** |
| **9** | `REP-02` | Five outcome options: verified · not verified · **duplicate suspected** · location inaccessible · needs clarification | Goes to the site, photographs it, selects **verified** and writes a mandatory reason | Attaches field evidence; checks the acting account is **not the reporter** | `POST /reports/{id}/field-verification` *(`API-160`)* | `Verification`, `EvidenceObject` | **`CAP_FIELD_VERIFY`** + scope + **account-level conflict check** | `UNDER_VERIFICATION` → **`VERIFIED`** | `field_verified` | Item leaves the queue; system routes to `UC_REVIEW` | Conflict → **`403 E_CONFLICT_EXCLUDED`**, *"You reported this issue, so you cannot act on it"* | **Online only** | **No option silently deletes a report.** A suspected duplicate is **flagged with a linked reference** |
| **10** | `REP-01` | Later: a completion-verification item on a different report | Opens it | Routed only to a **conflict-free** Representative | — | — | — | `COMPLETION_VERIFICATION` | `completion_routed` | `REP-03` opens | — | **Online only** | — |
| **11** | `REP-03` | Before/after evidence, the contractor's completion note | Visits, photographs, selects **Confirm completion** with a mandatory reason | Checks the actor is **neither the completer nor the reporter** | `POST /reports/{id}/completion-verification` *(`API-167`)* | `Verification` | **`CAP_COMPLETION_VERIFY`** + scope + conflict | `COMPLETION_VERIFICATION` → **`PENDING_CITIZEN_CONFIRMATION`** | `completion_verified` | Citizen is notified | Reject → back to `IN_PROGRESS` with a mandatory reason | **Online only** | Images described in text |
| **12** | `STF-09` | Device list, last seen | Taps **Sign out** | Server-side revocation | `POST /auth/logout` *(`API-004`)* | `AuthSession.revoked_at` | Own session | — | `session_revoked` | Returns to `STF-04` | — | **Online only** | **Client discard is not a logout** |

**End of golden journey. 13 steps, Step 0 to Step 12.**

---

# D. Formal use cases

### UC-REP-001 — UC Officer initiates a Representative invitation

| Field | Detail |
|---|---|
| **Primary actor** | **UC Officer** *(the Representative is the beneficiary, not the actor)* |
| **Goal** | Bring a named community member into the platform for a specific ward |
| **Preconditions** | Officer authenticated, acting as `UCO`, holds **`CAP_REP_INVITE`**, target scope is **within the officer's own scope** |
| **Authorization** | **`CAP_REP_INVITE` — UC Officer only.** **Mayor/Ops does not invite Representatives in routine operation**; an emergency replacement is an exceptional, separately audited act |
| **Main flow** | **0.** Officer opens `UCO-07`. **1.** Enters the intended official mobile number, the ward and a mandatory expiry. **2.** **Step-up OTP required.** **3.** Server verifies the requested scope is **not wider than the officer's own**. **4.** Creates `StaffAccount` in `INVITED`, `RoleAssignment` in `PENDING` with a **mandatory `valid_until`**, and an `AccountInvitation` — single-use, short-lived, **hashed at rest**, **bound to `intended_phone_lookup_hmac`**. **5.** SMS sent |
| **Exception** | **E1** Requested scope exceeds the officer's own → **refused**, audited. **E2** Step-up stale → **`401 E_STEP_UP_REQUIRED`**. **E3** Number already a staff account → **uniform** message |
| **Security** | **The officer never sets a credential.** **Public signup does not exist as a route** |
| **Entities written** | `StaffAccount`, `RoleAssignment`, `AccountInvitation` |
| **APIs / Screens / Capabilities** | `POST /staff/accounts` *(`API-098`)* / `UCO-07` / `CAP_REP_INVITE` |
| **Audit / State** | `rep_invited` / → `INVITED` |
| **Given/When/Then** | *Given* a UC Officer scoped to UC 12, *when* they invite a Representative for UC 13, *then* the request is refused and audited |

### UC-REP-002 — Receive and open the single-use invitation · UC-REP-003 — Expiry or wrong-phone rejection

| Field | Detail |
|---|---|
| **Main flow (002)** | **0.** SMS arrives with a link. **1.** `STF-01` states the role and scope **in plain language**. **2.** The invitee confirms their official mobile number. **3.** Server compares against `intended_phone_lookup_hmac` |
| **Exception (003)** | **E1** Expired → plain message, **no account detail disclosed**. **E2** Already consumed → same uniform message. **E3** **A different number is refused** — the invitation is not consumed and can still be used by the correct person |
| **Offline** | **Impossible** |
| **Security** | The invitation token is **stored hashed**; the raw value never appears in a log |
| **APIs / Screens** | `API-123` / `STF-01` |
| **Given/When/Then** | *Given* an invitation bound to number X, *when* number Y attempts activation, *then* it is refused and the invitation remains unconsumed |

### UC-REP-004 — OTP verification of the intended official number · UC-REP-005 — Create own password

| Field | Detail |
|---|---|
| **Main flow (004)** | `STF-02`, `purpose = staff_activation`, 6 digits, 5-minute expiry, max 5 attempts, **`code_hash` stored only**. Account → `PENDING_ACTIVATION` |
| **Main flow (005)** | `STF-03`. **The invitee creates their own password.** Hashed with **Argon2id**. Account → `ACTIVE` |
| **Security** | **No administrator chooses, views, transmits or stores the password.** It is **never** sent by SMS, email, WhatsApp, spreadsheet or printed document |
| **Entities written** | `StaffCredential` |
| **APIs / Screens** | `API-124`, `API-105` / `STF-02`, `STF-03` |
| **Audit** | `otp_verified`, `password_set` — **never the value** |
| **Given/When/Then** | *Given* any administrative screen, *when* an administrator looks for a way to set another user's password, *then* no such route or control exists |
| **Open decisions** | **D-07 PROPOSED**: every OTP flow should be a request→verify pair with the ticket **stamped with the same `purpose`** and rejected if presented to an endpoint expecting a different purpose |

### UC-REP-006 — First login and acting-role selection

| Field | Detail |
|---|---|
| **Main flow** | **0.** `STF-04` — number + password → `login_ticket`, **no privilege**. **1.** `STF-05` — SMS OTP → tokens **and the role-assignment list**. **2.** `STF-06` — the user **explicitly selects exactly one** assignment. **3.** The portal opens according to that role and scope |
| **Preconditions** | `StaffAccount.status = ACTIVE` **and** at least one `RoleAssignment` **`ACTIVE` and unexpired** |
| **Exception** | **E1** Active account, **no active assignment** → *"Your account is active but you have no current role."* **No portal privilege is granted.** **E2** Suspended → login refused. **E3** Wrong password → **operationally indistinguishable** from a wrong number |
| **Security** | **Exactly one assignment acts.** **Capabilities are never combined across assignments** |
| **APIs / Screens** | `API-005`, `API-125`, `API-120` / `STF-04`, `STF-05`, `STF-06` |
| **Audit** | `login_first_factor`, `otp_verified`, `session_created`, `acting_role_selected` |
| **Open decisions** | **D-04 / D-05 — Blocker, PROPOSED.** `API-120` is classed `Staff-authenticated`, which requires the acting-role header it is being called to obtain. **This is circular and unimplementable as written.** The recommendation is a **`Staff-pre-role`** class holding **zero capabilities** and access to exactly three routes — `API-125`, `API-120`, `API-004` — with `AuthSession.acting_role_assignment_id` **explicitly nullable**. **Not approved** |

### UC-REP-007 — Representative dashboard · UC-REP-008 — View reports in scope · UC-REP-009 — Privacy-permitted reporter information

| Field | Detail |
|---|---|
| **Main flow** | `REP-01` lists items in the assigned ward or UC. Opening one shows category, location, **confirmed Urdu rendering labelled AI-generated**, photo/video evidence and — **scope-limited, for verification only** — the **original recording** |
| **Authorization** | Role + **geographic scope**. **Out-of-scope items are not rendered and are refused server-side if requested directly** |
| **Privacy — what a Representative sees** | Report content · category · location · confirmed Urdu rendering · **intermediate ASR output, where required for verification** · original recording, scope-limited · photo/video evidence · internal staff notes |
| **Privacy — what a Representative never sees** | **Citizen mobile number, in any form** · `citizen_account_id` · **citizen name — the field does not exist** · staff personal contact details · **the official reporter's staff identity** · civic audit narrative · hash-chain integrity results |
| **APIs / Screens** | `GET /reports/{id}` / `REP-01`, `REP-02` |
| **Audit** | `report_viewed`, `audio_played`, `asr_output_viewed` |
| **Given/When/Then** | *Given* any Representative response, *when* it is inspected, *then* it contains no citizen phone number, no `citizen_account_id` and no name field |

### UC-REP-010 — Field verification

| Field | Detail |
|---|---|
| **Goal** | Record whether the reported problem actually exists on the ground |
| **Preconditions** | State is `UNDER_VERIFICATION`; item is in scope; **the acting account is not the reporter** |
| **Authorization** | **`CAP_FIELD_VERIFY`** + scope + **account-level conflict check** |
| **Input data** | Outcome · **mandatory reason** · field evidence |
| **Main flow** | **0.** `REP-02` shows five outcomes. **1.** Representative visits the site. **2.** Captures field evidence. **3.** Selects an outcome and writes the mandatory reason. **4.** Submits. **5.** Server checks capability, scope and `ConflictExclusion` **at the point of action**. **6.** `Verification` written with `verified_by_account_id ≠ reporter`. **7.** `UNDER_VERIFICATION` → **`VERIFIED`**. **8.** System routes to `UC_REVIEW` |
| **Alternate flows** | **A1** *Not verified* → `UC_REVIEW` with a mandatory reason, audited `field_verification_failed`. **A2** *Location inaccessible* → `UC_REVIEW`, `location_inaccessible`. **A3** *Duplicate suspected* → `UC_REVIEW` with a **linked reference**, audited `duplicate_suspected` — **flagged, never silently deleted**. **A4** *Needs clarification* → `clarification_requested`, state unchanged |
| **Exception** | **E1** Conflict → **`403 E_CONFLICT_EXCLUDED`**. **E2** Role expired mid-session → **`403 E_ROLE_ASSIGNMENT_INVALID`**, checked **at the point of action, not at login**. **E3** Stale `state_version` → **`409 E_STALE_STATE`** |
| **Offline** | **Blocked.** The staff portal is server-rendered Django/HTMX with no offline queue |
| **Entities written** | `Verification`, `EvidenceObject` |
| **APIs / Screens / Capabilities** | `API-160` / `REP-02` / `CAP_FIELD_VERIFY` |
| **Audit / State** | `field_verified` / `UNDER_VERIFICATION` → `VERIFIED` |
| **Given/When/Then** | *Given* an account that filed the report, *when* it attempts verification under a Representative assignment, *then* it is refused with `E_CONFLICT_EXCLUDED` |

### UC-REP-011 — Verify contractor completion

| Field | Detail |
|---|---|
| **Preconditions** | State is `COMPLETION_VERIFICATION`; **the actor is neither the completer nor the reporter** |
| **Authorization** | **`CAP_COMPLETION_VERIFY`** + scope + **double conflict check** |
| **Main flow** | **0.** System routed the item to a **conflict-free** Representative. **1.** `REP-03` shows before/after evidence and the contractor's note. **2.** Representative visits and photographs. **3.** **Confirm completion** with a mandatory reason → **`PENDING_CITIZEN_CONFIRMATION`**, citizen notified |
| **Alternate** | **A1** **Reject completion** → back to **`IN_PROGRESS`** with a mandatory reason, audited `completion_rejected` |
| **Exception** | **E1** No conflict-free Representative exists → **escalate one level; if still none, flag unresolvable and hold**. **Never auto-approved, never routed back to the conflicted account** |
| **APIs / Screens / Capabilities** | `API-167` / `REP-03` / `CAP_COMPLETION_VERIFY` |
| **Audit / State** | `completion_verified` or `completion_rejected` |
| **Open decisions** | **D-01 — Blocker, `TBD — Hassan decision required`.** If the report was filed by a **staff official**, the next state `PENDING_CITIZEN_CONFIRMATION` has **no citizen to act**, and the case stalls. **Branch A (recommended, not approved):** rename to `PENDING_REPORTER_CONFIRMATION` and generalise `CitizenConfirmation`. **Branch B:** auto-advance staff-official reports to `RESOLVED_CONFIRMED` — **rejected as a recommendation**, because it removes the reporter's right to dispute |

### UC-REP-012 — Request clarification · UC-REP-013 — Flag the rendering for review

| Field | Detail |
|---|---|
| **Main flow (012)** | `REP-02` → **Needs clarification** with a mandatory question. The citizen receives it at `CIT-16`, **playable aloud and translated** |
| **Main flow (013)** | Representative marks the Urdu rendering as wrong. **This does not correct it and does not confirm it.** It sets `human_review_status = PENDING` for an authorised reviewer holding **`CAP_TRANSCRIPT_REVIEW`** |
| **Critical rule** | **A reviewer may produce or correct a rendering version. The reviewer may never confirm it. The rendering returns to the original reporter for confirmation.** **`CAP_RENDERING_CONFIRM_OWN` is never delegable** |
| **Capabilities** | `CAP_CASE_CLARIFY` · `CAP_TRANSCRIPT_REVIEW` *(UCO/MAY hold the review capability; the Representative flags)* |
| **Audit** | `clarification_requested` · `transcript_reviewed` |
| **Given/When/Then** | *Given* a Representative flags a rendering, *when* a reviewer corrects it, *then* the new version returns to the citizen and **no staff confirmation is recorded** |

### UC-REP-014 — Declare a conflict and recuse

| Field | Detail |
|---|---|
| **Goal** | Step aside voluntarily where the system cannot detect the conflict |
| **Main flow** | **0.** `REP-04`. **1.** Representative selects the item and gives a reason. **2.** A `ConflictExclusion` is created for **this account** on **this report**. **3.** The item reroutes to another eligible Representative |
| **Why it exists** | The system detects **reporter conflicts** automatically. It cannot detect that the Representative is the contractor's cousin. **Self-recusal is a governance control, not a technical one, and calling it anything else would be dishonest** |
| **Exception** | **E1** No other eligible Representative → escalate; if still none, **flag unresolvable and hold** |
| **Entities written** | `ConflictExclusion` — **retained permanently; a later role grant does not clear it** |
| **Screens** | `REP-04` |

### UC-REP-015 — Report an issue officially through `STF-10`

| Field | Detail |
|---|---|
| **Goal** | File an official report about something seen while on duty |
| **Preconditions** | Authenticated, acting role selected, holds **`CAP_REPORT_OFFICIAL`** |
| **Authorization** | **`CAP_REPORT_OFFICIAL`.** **Service accounts and automated integrations are excluded** |
| **Main flow** | **0.** `STF-10` — **one shared screen for all four staff roles.** **Four duplicate reporting screens do not exist.** **1.** The screen states plainly, before submission, that **the reporter will be excluded from acting on this report**. **2.** Category · evidence · voice recording. **3.** AI produces an Urdu rendering, **labelled AI-generated**, with a version indicator. **4.** The staff reporter reviews and **confirms their own rendering** under **`CAP_RENDERING_CONFIRM_OWN`**. **5.** Atomic creation: `CivicReport(state = SUBMITTED)` · report reference issued in the same transaction · `official_reporter_account_id` and `official_reporter_role_assignment_id` recorded · **`ConflictExclusion` created** |
| **Exception** | **E1** Missing evidence under **branch A** → `422 E_EVIDENCE_REQUIRED` *(D-14)*. **E2** No confirmation → `422 E_RENDERING_NOT_CONFIRMED`. **E3** Connection lost → **named failure with retry** |
| **Offline** | **Blocked in every respect** — see **D-11** |
| **Security** | **A staff user cannot confirm a citizen's rendering or another staff user's rendering** |
| **Entities written** | `ClientSubmission` *(`reporter_subject_type = staff`)* · `VoiceTranscriptionArtifact` · `RenderingConfirmation` · `CivicReport` · `ReportOwnership` · **`ConflictExclusion`** |
| **APIs / Screens / Capabilities** | `API-130`, `API-131/132`, `API-135`, **`POST /staff/reports/official` (`API-141`)** / `STF-10` / `CAP_REPORT_OFFICIAL`, `CAP_RENDERING_CONFIRM_OWN` |
| **Audit / State** | `report_submitted` *(`staff_role_assignment`)* / *(none)* → **`SUBMITTED`** |
| **Open decisions** | **D-09 PROPOSED**: staff receive **no versioned voice-processing notice** before recording. Citizens get `CIT-02`/`CIT-03`; **staff get nothing, and `ConsentRecord` cannot hold a staff consent because it is keyed on `citizen_account_id`.** Recommendation: a versioned notice on first use, acknowledged once, recorded — **informational, not a consent gate**, because official reporting is a duty of the role. **D-11 PROPOSED**: `STF-10` is **online-only**; the Screen Inventory's offline claim was copied from the React Native client to a Django/HTMX portal that has **no offline queue, no local database and no background sync** |

### UC-REP-016 — Account-level conflict exclusion after reporting

| Field | Detail |
|---|---|
| **Main flow** | **0.** The Representative files an official report. **1.** A `ConflictExclusion` is written keyed on **`excluded_staff_account_id`**, not on the role assignment. **2.** Every subsequent attempt by that account to verify, accept, assign, approve evidence, approve completion, resolve, close, or decide a dispute or appeal on that record is **refused under every assignment it holds, present or future** |
| **The scenario this closes** | *"A UC Officer who submits an official report remains excluded from verifying, accepting, assigning, approving, closing or deciding a dispute on that report — even after switching to a Street Representative or Mayor/Ops assignment."* **Role-level checking would permit that. Account-level checking denies it** |
| **Entities** | `ConflictExclusion` · `CivicReport.official_reporter_account_id` |
| **Given/When/Then** | *Given* an account that filed a report, *when* it switches to any other assignment and attempts any action on that report, *then* it is refused with `E_CONFLICT_EXCLUDED` |

### UC-REP-017 — Track the Representative's own official report

| Field | Detail |
|---|---|
| **Goal** | See what happened to a report they filed |
| **Status** | **Blocked by two open decisions. This use case is presented as a labelled branch, not a flow** |
| **The problem** | There is **no staff screen that shows a staff user their own reports.** `STF-01…STF-10` contains no equivalent of `CIT-14`. Scope-based read may not surface the report, and `ConflictExclusion` bars the account from acting on it |
| **Branch A — PROPOSED, not approved** | Add **read-only ownership** to the acting-role check: an account may always **read** a report where `official_reporter_account_id = self`, **regardless of scope and regardless of `ConflictExclusion`** — reading is not acting. Surface it through **`STF-11 — My Official Reports`**, read-only, showing reference, plain status, sanitised timeline and any open clarification. **This would change the approved screen total from 58 to 59** |
| **Branch B** | Leave it unsolved: the staff reporter files and hears nothing. **Documented as the current state, not recommended** |
| **Open decisions** | **D-02 — Blocker, `TBD — Hassan decision required`** · **D-03 — `STF-11` PROPOSED, not in the approved inventory** |

### UC-REP-018 — Role switching · UC-REP-019 — Step-up authentication

| Field | Detail |
|---|---|
| **Main flow (018)** | **0.** The account holds two assignments. **1.** `STF-06`. **2.** Selects the other. **3.** **The session now acts under exactly that one.** **Capabilities are never combined.** **4.** Switching **upward** requires a fresh OTP |
| **Main flow (019)** | **0.** A sensitive action is attempted. **1.** Server computes `recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)`. **2.** If older than **10 minutes** → `STF-08` with a **plain explanation of why a fresh code is needed**. **3.** Fresh OTP → `step_up_satisfied_at` updated |
| **Key correctness point** | **The login OTP at `STF-05` already satisfies the window.** A sensitive action taken immediately after signing in **prompts nothing** |
| **Not required for** | Routine queue viewing, ordinary progress viewing, non-sensitive navigation, **and confirming one's own rendering** |
| **Offline** | **Impossible** |
| **APIs / Screens** | `API-120`, `API-126` / `STF-06`, `STF-08` |
| **Audit** | `acting_role_selected`, `step_up_satisfied` |
| **Given/When/Then** | *Given* a login OTP one minute ago, *when* a step-up action is attempted, *then* no second OTP is demanded |

### UC-REP-020 — Password reset · UC-REP-021 — Session management · UC-REP-022 — Logout

| Field | Detail |
|---|---|
| **Main flow (020)** | `STF-07` — mobile number → OTP *(`purpose = password_reset`)* → new password. **Revokes all existing sessions.** Notifies the staff member and the appropriate administrator. **Cannot reactivate a suspended, revoked or expired account** |
| **Main flow (021)** | `STF-09` — device list, last seen, **sign out everywhere** |
| **Main flow (022)** | Server-side revocation. **Client discard is not a logout** |
| **Security** | **Replay of a consumed refresh token revokes the whole family** |
| **APIs / Screens** | `API-127`, `API-128`, `API-004` / `STF-07`, `STF-09` |
| **Audit** | `password_reset`, `session_revoked` |

### UC-REP-023 — Staff mobile-number change

| Field | Detail |
|---|---|
| **Main flow** | **Not self-service.** The Representative requests it; a Mayor/Ops user with `CAP_ACCOUNT_ADMIN` approves at `MAY-03` with a reason and **step-up**; OTP verifies the **new** number; **all sessions are revoked**; the change is audited |
| **Security** | **The audit event contains no phone number** |
| **Screens** | `MAY-03` *(the approval)* |

### UC-REP-024 — Suspended, revoked, expired or out-of-scope behaviour

| Field | Detail |
|---|---|
| **Suspended or revoked** | **Login refused.** **Active sessions are invalidated** — a Representative mid-verification is stopped at the next action, not at the next login |
| **Expired `RoleAssignment`** | **Checked at the point of action.** The session **downgrades on the next request**, returning `403 E_ROLE_ASSIGNMENT_INVALID` |
| **Out of scope** | The item is **not rendered**, and a direct request is **refused server-side**. **Hiding a button is never sufficient** |
| **Active account, no assignment** | Authenticates, but **receives no portal privilege** and sees a plain explanatory screen |
| **Given/When/Then** | *Given* a Representative signed in, *when* the account is suspended, *then* the next action fails and the session is revoked |

---

## Coverage summary

| Requirement | Use case |
|---|---|
| 1 UC Officer invites · 2 receive invitation · 3 expiry/wrong phone | `001`–`003` |
| 4 OTP · 5 password · 6 login + role selection | `004`–`006` |
| 7 dashboard · 8 scope · 9 privacy · 10 evidence review | `007`–`009` |
| 11 field verification · 12 clarification · 13 flag rendering | `010`, `012`, `013` |
| 14 completion verification · 15 recusal | `011`, `014` |
| 16 `STF-10` · 17 conflict exclusion · 18 own-report tracking | `015`–`017` |
| 19 role switching · 20 step-up | `018`, `019` |
| 21 reset · 22 sessions · 23 logout · 24 number change | `020`–`023` |
| 25 suspended/revoked/expired/out-of-scope | `024` |

## Open decisions affecting this portal

| ID | Severity | Decision |
|---|---|---|
| **D-01** | **Blocker** | Staff-official report confirmation state — **`TBD`** |
| **D-02** | **Blocker** | How a staff reporter tracks their own report — **`TBD`** |
| **D-03** | High | `STF-11 — My Official Reports` — **PROPOSED** |
| **D-04 / D-05** | **Blocker** | Acting-role selection circularity — **PROPOSED** |
| **D-07** | High | Purpose-bound OTP tickets — **PROPOSED** |
| **D-09** | High | Staff voice-processing notice — **PROPOSED** |
| **D-11** | High | `STF-10` offline claim contradicts the stack — **PROPOSED: online-only** |
| **D-13** | **Blocker** | No citizen name exists — followed here |
| **D-14** | High | Mandatory photo — **`TBD`** |

---

*Specified; not implemented; not tested. No screen has been built. No verification has been performed by any Representative.*
