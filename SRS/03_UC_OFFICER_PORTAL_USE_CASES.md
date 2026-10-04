# Parakh — UC Officer Portal Use Cases

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Portal** | **UC Officer (`UCO`)** — Django Templates + HTMX + Alpine.js |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 |
| **Screens** | Shared `STF-01` … `STF-10` · Own `UCO-01` … `UCO-08` |
| **Use cases** | `UC-UCO-001` … `UC-UCO-029` |

---

# A. Portal purpose

The UC Officer is the **decision-maker of the Union Council**. Every verified report passes through this portal to be accepted or rejected, assigned to a contractor, and — after the citizen confirms — formally closed.

**This portal holds the only ordinary closure authority in Parakh.** Not the Mayor, not the contractor, not the Representative.

## Boundaries

| The UC Officer does | The UC Officer does not |
|---|---|
| Accept or reject a verified report | Verify a report in the field — that is the Representative |
| Assign an eligible contractor from `ACCEPTED` | Assign before the report reaches `ACCEPTED` |
| **Close a case — the only ordinary closure in the system** | Decide a formal appeal — that is Mayor & Ops |
| Invite a Street Representative **within their own scope** | Grant a scope wider than their own |
| Read the civic audit narrative, **scope-limited** | Provision a UC Officer or a Contractor |
| Report an issue officially through `STF-10` | Act on a report they themselves filed |

## Prohibited actions — enforced server-side

**A UC Officer may never:** provision another UC Officer, a Contractor or a contractor organisation · grant a scope wider than their own assignment · assign a contractor from `UC_REVIEW` — **acceptance cannot be skipped** · assign an ineligible contractor · see a citizen phone number in any form · confirm any rendering but their own official draft · decide a formal appeal · act on a report their account filed, under any assignment.

---

# B. Actor and account summary

| Property | Value |
|---|---|
| **Actor code** | `UCO` |
| **Who invites** | **A Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`.** Never self-service, never a Representative |
| **Account identifier** | **Official mobile number**, in `StaffCredential` only. `staff_reference` is optional, administrative, **never used for login** |
| **Authentication factors** | **Two — user-created password (knowledge) + six-digit SMS OTP (possession)** |
| **Activation** | Invitation → OTP on the **intended** number → **the officer creates their own password** |
| **RoleAssignment** | At least one **`ACTIVE` and unexpired**. **`valid_until` is mandatory** |
| **Scope** | Geographic — typically a Union Council, from `GeographicScope` |
| **Account statuses** | `INVITED` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `REVOKED` · `EXPIRED` |
| **Login blocked when** | `SUSPENDED`, `REVOKED`, `EXPIRED`; or `ACTIVE` **with no active `RoleAssignment`** — authenticates, **no portal privilege** |
| **Step-up** | Fresh SMS OTP, 10 minutes from `recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)`. **Required for:** reject · assign · reassign · **close** · invite a Representative |
| **Logout** | `STF-09` — this session or **sign out everywhere** |

---

# C. The 0-to-100 golden journey

*Actor: a newly appointed UC Officer for Union Council 12, invited this morning by Mayor & Operations.*

| Step | Screen | User sees | User action | System action | API | Data | Authorization | State | Audit | Success | Failure | Offline | Accessibility / language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0** | — | SMS with a single-use invitation link | Taps the link | Portal opens | — | — | — | `INVITED` | `officer_provisioned` *(written earlier)* | `STF-01` | Expired → plain message, **no account detail disclosed** | **Online only** | Link text is plain, not a raw token |
| **1** | `STF-01` | *"You have been invited as UC Officer for Union Council 12"* and a mobile-number field | Enters the official number | Compares against `intended_phone_lookup_hmac` | `API-123` | `AccountInvitation` read | Invitation validity | `INVITED` | — | `STF-02` | **A different number is refused; the invitation is not consumed** | **Online only** | **Scope in plain language, not a code** |
| **2** | `STF-02` | Six digit boxes | Enters the code | Verifies *(`purpose = staff_activation`)* | `API-124` | `OTPChallenge` consumed | Ticket-bound | → `PENDING_ACTIVATION` | `otp_verified` | `STF-03` | **Uniform** wrong/expired message | **Online only** | Digits LTR; attempts remaining announced |
| **3** | `STF-03` | Password, confirm, plain strength guidance | **Creates their own password** | **Argon2id**, hash only | `API-105` | `StaffCredential` | Ticket-bound | → `ACTIVE` | `password_set` — **never the value** | `STF-04` | Too weak → plain guidance | **Online only** | **No administrator ever sees this** |
| **4** | `STF-04` | Sign in — number and password | Enters both | Verifies the hash | `API-005` | — | Public-auth | — | `login_first_factor` | `STF-05`, `login_ticket` with **no privilege** | **Wrong number and wrong password are operationally indistinguishable** | **Online only** | **"First authentication factor"** |
| **5** | `STF-05` | Six digit boxes | Enters the code | Verifies *(`purpose = staff_login`)*; issues tokens **and the assignment list** | `API-125` | `AuthSession`, `RefreshTokenFamily`, `DeviceSession` | Ticket-bound | — | `otp_verified`, `session_created` | `STF-06` | Uniform failure | **Online only** | **"Second authentication factor" — two-factor, never three** |
| **6** | `STF-06` | *"You are signed in as UC Officer for Union Council 12."* | Selects it | Binds **exactly one** `RoleAssignment` | `API-120` | `AuthSession.acting_role_assignment_id` | **See D-04** | — | `acting_role_selected` | `UCO-01` | No active assignment → plain explanatory screen, **no privilege** | **Online only** | **Plain sentence, no RBAC jargon** |
| **7** | `UCO-01` | Dashboard: volume, overdue, awaiting action, scoped to UC 12 | Opens the review queue | Loads scope-filtered reports in `UC_REVIEW` | `GET /reports?state=UC_REVIEW&scope=...` | — | Role + geographic scope | `UC_REVIEW` | — | Queue list | Out-of-scope → **not rendered, refused if requested** | **Online only** | Counts have text labels |
| **8** | `UCO-02` | Category, location, **confirmed Urdu rendering labelled AI-generated**, evidence, Representative's verification note, **original recording — scope-limited, for verification** | Reads and plays the recording | Serves privacy-filtered content | `GET /reports/{id}` | — | Scope + capability | `UC_REVIEW` | `report_viewed`, `audio_played` | Decision controls appear | — | **Online only** | **No citizen phone number, no `citizen_account_id`, no name — the field does not exist** |
| **9** | `UCO-02` | **Accept · Reject · Request clarification · Flag rendering for review** | Taps **Accept** with an optional note | Checks `CAP_CASE_ACCEPT`, scope, and that the acting **account** is not the reporter | `POST /reports/{id}/accept` *(`API-161`)* | `CivicReport.state`, `state_version` | **`CAP_CASE_ACCEPT`** + scope + account conflict | `UC_REVIEW` → **`ACCEPTED`** | `case_accepted` | Citizen notified *"Accepted for action"*; assignment becomes reachable | Conflict → **`403 E_CONFLICT_EXCLUDED`** | **Online only** | Accept and Reject are visually and textually distinct |
| **10** | `UCO-03` | **Only eligible contractors** — active account, approved and active organisation, in-date approval, matching category, matching area | Selects one | **Step-up check:** `recent_auth_at` older than 10 minutes? | — | — | `CAP_CASE_ASSIGN` | `ACCEPTED` | — | Assign control enabled | Ineligible contractor **is not rendered** | **Online only** | List shows organisation name and approved categories in plain text |
| **11** | `STF-08` | *"Please confirm the code we just sent you — you are assigning work."* | Enters a fresh OTP | Updates `step_up_satisfied_at` | `POST /auth/step-up` *(`API-126`)* | `AuthSession` | Step-up | — | `step_up_satisfied` | Returns to `UCO-03` | **`401 E_STEP_UP_REQUIRED`** if skipped | **Online only** | **The screen explains why a fresh code is needed** |
| **12** | `UCO-03` | Assignment note field | Taps **Assign** | **Server re-checks eligibility regardless of what the client displayed**; checks state is `ACCEPTED` | `POST /reports/{id}/assign` *(`API-163`)* | `CaseAssignment`, `CivicReport.state` | `CAP_CASE_ASSIGN` + scope + conflict + step-up | `ACCEPTED` → **`CONTRACTOR_ASSIGNED`** | `contractor_assigned` | Contractor and citizen notified | Assignment from `UC_REVIEW` → **refused; acceptance cannot be skipped** | **Online only** | Contractor identity shown as organisation, not a personal number |
| **13** | `UCO-01` | Later: progress updates, then completion, then Representative verification, then citizen confirmation | Monitors | Contractor accepted → `IN_PROGRESS` → `COMPLETION_SUBMITTED` → system routes → Representative verifies → `PENDING_CITIZEN_CONFIRMATION` → citizen confirms → `RESOLVED_CONFIRMED` | — | — | — | multiple | `work_accepted`, `progress_updated`, `completion_submitted`, `completion_routed`, `completion_verified`, `resolution_confirmed` | Case reaches `RESOLVED_CONFIRMED` | Citizen disputes → `REOPENED`, appears at `UCO-05` | **Online only** | Plain status wording throughout |
| **14** | `UCO-06` | **Close case** — the only ordinary closure screen in Parakh | Enters a **mandatory closure reason or checklist**, taps **Close** | Step-up check; conflict check; state precondition | `POST /reports/{id}/close` *(`API-168`)* | `CivicReport.state` | **`CAP_CASE_CLOSE` — `UCO` only** + step-up | `RESOLVED_CONFIRMED` → **`CLOSED`** | `case_closed` | Citizen sees *"This report is finished and closed"* | Missing reason → refused. **Mayor/Ops has no close route at all** | **Online only** | Reason field is required and plainly labelled |
| **15** | `STF-09` | Device list, last seen | **Sign out** | Server-side revocation | `API-004` | `AuthSession.revoked_at` | Own session | — | `session_revoked` | Returns to `STF-04` | — | **Online only** | **Client discard is not a logout** |

**End of golden journey. 16 steps, Step 0 to Step 15.**

---

# D. Formal use cases

### UC-UCO-001 — Mayor/Ops initiates the UC Officer invitation

| Field | Detail |
|---|---|
| **Primary actor** | **Mayor & Operations user holding `CAP_ACCOUNT_ADMIN`** |
| **Goal** | Provision an officer for a named Union Council |
| **Preconditions** | Mayor/Ops authenticated, acting role selected, holds **`CAP_ACCOUNT_ADMIN`** |
| **Authorization** | **`CAP_ACCOUNT_ADMIN` — explicitly granted, never automatic.** **A UC Officer with `CAP_CASE_TRIAGE` cannot provision another UC Officer.** *Case-management authority never implies account-administration authority* |
| **Main flow** | **0.** `MAY-03`. **1.** Enters the intended official number, the Union Council and a **mandatory expiry**. **2.** **Step-up OTP.** **3.** Creates `StaffAccount` `INVITED`, `RoleAssignment` `PENDING` with `valid_until`, and a single-use, short-lived, **hashed**, **phone-bound** `AccountInvitation`. **4.** SMS sent |
| **Exception** | **E1** Requested scope exceeds the assigner's own → refused, audited. **E2** Step-up stale → `401 E_STEP_UP_REQUIRED`. **E3** Number already a staff account → **uniform** message |
| **Security** | **The administrator never sets a credential. Public signup does not exist as a route** |
| **Entities written** | `StaffAccount`, `RoleAssignment`, `AccountInvitation` |
| **APIs / Screens / Capabilities** | `API-098` / `MAY-03`, `MAY-04` / `CAP_ACCOUNT_ADMIN`, `CAP_ROLE_ASSIGN` |
| **Audit / State** | `officer_provisioned`, `role_assigned` / → `INVITED` |
| **Given/When/Then** | *Given* a UC Officer without `CAP_ACCOUNT_ADMIN`, *when* they attempt to provision another officer, *then* the request is refused and audited |

### UC-UCO-002 — Invitation acceptance, OTP verification and password creation

| Field | Detail |
|---|---|
| **Main flow** | **0.** `STF-01` states role and scope in plain language; the invitee confirms the official number. **1.** `STF-02` — OTP *(`purpose = staff_activation`)*, 6 digits, 5-minute expiry, max 5 attempts, **`code_hash` only**. **2.** `STF-03` — **the invitee creates their own password**, hashed with Argon2id. **3.** Account → `ACTIVE` |
| **Exception** | **E1** Expired or consumed invitation → uniform message, **no account detail disclosed**. **E2** Wrong number → refused, **invitation not consumed**. **E3** Weak password → plain guidance |
| **Offline** | **Impossible at every step** |
| **Security** | **No administrator chooses, views, transmits or stores the password.** It is **never** sent by SMS, email, WhatsApp, spreadsheet or printed document |
| **APIs / Screens** | `API-123`, `API-124`, `API-105` / `STF-01`, `STF-02`, `STF-03` |
| **Audit** | `otp_verified`, `password_set` |
| **Open decisions** | **D-07 PROPOSED** — every OTP flow should be a request→verify pair with the ticket **stamped with the same `purpose`** and rejected at an endpoint expecting a different one |

### UC-UCO-003 — Password + OTP login · UC-UCO-004 — Acting-role selection

| Field | Detail |
|---|---|
| **Main flow** | **0.** `STF-04` — number + password → `login_ticket`, **no privilege**. **1.** `STF-05` — SMS OTP → tokens **and the assignment list**. **2.** `STF-06` — **explicitly selects exactly one** assignment. **3.** `UCO-01` opens scoped to that assignment |
| **Preconditions** | `StaffAccount.status = ACTIVE` **and** ≥1 `RoleAssignment` `ACTIVE` and unexpired |
| **Exception** | **E1** Active, no assignment → *"Your account is active but you have no current role."* **No privilege granted.** **E2** Suspended → login refused. **E3** Wrong credentials → **operationally indistinguishable** outcomes |
| **Security** | **Exactly one assignment acts. Capabilities are never combined across assignments** |
| **APIs / Screens** | `API-005`, `API-125`, `API-120` / `STF-04`, `STF-05`, `STF-06` |
| **Audit** | `login_first_factor`, `otp_verified`, `session_created`, `acting_role_selected` |
| **Open decisions** | **D-04 / D-05 — Blocker, PROPOSED.** `API-120` is classed `Staff-authenticated`, which requires the acting-role header it exists to obtain. **Circular and unimplementable as written.** Recommendation: a **`Staff-pre-role`** class with **zero capabilities** and exactly three routes — `API-125`, `API-120`, `API-004` — and `AuthSession.acting_role_assignment_id` **explicitly nullable**. **Not approved** |

### UC-UCO-005 — UC dashboard and scoped queues

| Field | Detail |
|---|---|
| **Main flow** | `UCO-01` shows volume, overdue and awaiting-action counts **scoped to the officer's Union Council**, with queues for `UC_REVIEW`, `ACCEPTED` awaiting assignment, `REOPENED` disputes and completion outcomes |
| **Authorization** | Role + **geographic scope**. **Out-of-scope items are not rendered, and a direct request is refused server-side.** Hiding a control is never sufficient |
| **Screens / APIs** | `UCO-01` / scoped report reads |
| **Accessibility** | Counts carry text labels; **colour is never the sole carrier of meaning** |

### UC-UCO-006 — Review a verified report

| Field | Detail |
|---|---|
| **Preconditions** | State `UC_REVIEW`; in scope |
| **Privacy — what a UC Officer sees** | Report content · category · location · **confirmed Urdu rendering, labelled AI-generated** · **intermediate ASR output where required for verification or review** · **original recording, scope-limited, for verification** · photo/video evidence · internal staff notes · **the official reporter's staff identity — for the conflict check only** |
| **Privacy — never sees** | **Citizen mobile number in any form** · `citizen_account_id` · **citizen name — no such field exists** · staff personal contact details · hash-chain integrity results |
| **Main flow** | **0.** `UCO-02`. **1.** Reads the rendering and the Representative's verification note. **2.** Plays the original recording. **3.** Reviews evidence. **4.** Chooses Accept, Reject, Request clarification or Flag rendering |
| **Audit** | `report_viewed`, `audio_played`, `asr_output_viewed` |
| **Given/When/Then** | *Given* any UC Officer response, *when* inspected, *then* it contains no citizen phone number and no name field |
| **Open decisions** | **D-13** — the RBAC privacy matrix lists a "Citizen name" row for Mayor/Ops, but **the data model has no name field anywhere.** These use cases follow the data model, which is the narrower and safer reading |

### UC-UCO-007 — Accept a report

| Field | Detail |
|---|---|
| **Goal** | Commit the office to acting on the report |
| **Preconditions** | State `UC_REVIEW`; in scope; **the acting account is not the reporter** |
| **Authorization** | **`CAP_CASE_ACCEPT`** + scope + **account-level conflict check** |
| **Main flow** | **0.** `UCO-02`. **1.** Taps **Accept**, optional note. **2.** Server checks capability, scope, `ConflictExclusion` and `state_version`. **3.** `UC_REVIEW` → **`ACCEPTED`**. **4.** Citizen notified *"Accepted for action"* |
| **Exception** | **E1** Conflict → `403 E_CONFLICT_EXCLUDED`. **E2** Stale `state_version` → `409 E_STALE_STATE`. **E3** Expired assignment → `403 E_ROLE_ASSIGNMENT_INVALID`, **checked at the point of action** |
| **Step-up** | **Not required for acceptance.** Required for rejection |
| **APIs / Screens / Capabilities** | `API-161` / `UCO-02` / `CAP_CASE_ACCEPT` |
| **Audit / State** | `case_accepted` / `UC_REVIEW` → `ACCEPTED` |
| **Given/When/Then** | *Given* a report in `UC_REVIEW`, *when* accepted, *then* the state becomes `ACCEPTED` and assignment becomes reachable |

### UC-UCO-008 — Reject a report with a reason

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_CASE_REJECT`** + scope + conflict + **step-up** |
| **Input data** | **Mandatory coded rejection reason** |
| **Main flow** | **0.** `UCO-02` → **Reject**. **1.** Selects a coded reason and writes an explanation. **2.** **Step-up OTP** at `STF-08`, with a plain explanation of why. **3.** `UC_REVIEW` → **`REJECTED`**. **4.** Citizen sees *"Not taken forward"* **with the reason** |
| **Exception** | **E1** No reason → refused. **E2** Step-up stale → `401 E_STEP_UP_REQUIRED` |
| **Critical rule** | **Mayor & Operations cannot reject.** The permission matrix records `no` for `MAY` on rejection |
| **APIs / Screens** | `API-162` / `UCO-02`, `STF-08` |
| **Audit / State** | `case_rejected` / → `REJECTED` |

### UC-UCO-009 — Request clarification · UC-UCO-010 — Flag an incorrect rendering

| Field | Detail |
|---|---|
| **Main flow (009)** | `UCO-02` → **Request clarification** with a mandatory question. State **unchanged**. The citizen receives it at `CIT-16`, **translated and playable aloud** |
| **Main flow (010)** | Officer marks the Urdu rendering as wrong → `human_review_status = PENDING`. Under **`CAP_TRANSCRIPT_REVIEW`** the officer may **produce or correct a new rendering version** |
| **The rule that must not bend** | **The corrected version returns to the original reporter for confirmation. A reviewer never confirms on the reporter's behalf.** `CAP_RENDERING_CONFIRM_OWN` is **not delegable** |
| **Capabilities** | `CAP_CASE_CLARIFY` · `CAP_TRANSCRIPT_REVIEW` |
| **APIs** | `API-152` *(citizen reply)* · `API-136` *(review)* |
| **Audit** | `clarification_requested` · `transcript_reviewed` |
| **Given/When/Then** | *Given* an officer corrects a rendering, *when* the correction is saved, *then* a new version is created, the citizen must confirm it, and **no staff confirmation is recorded** |

### UC-UCO-011 — View eligible contractors only

| Field | Detail |
|---|---|
| **Eligibility — all five must hold** | Contractor account `ACTIVE` · organisation `APPROVED` and active · **current date within `valid_from … valid_until`** · report category in `approved_categories` · report location inside `service_areas` |
| **Main flow** | `UCO-03` renders **only** contractors passing every check |
| **Critical rule** | **An ineligible contractor is not rendered and cannot be selected — and the server re-checks on submit regardless.** Client-side filtering is a convenience, never the control |
| **Screens** | `UCO-03` |
| **Open decisions** | **D-06 — Blocker, `TBD — Hassan decision required`.** If a **contractor-affiliated staff account** filed the report, the **account** is excluded but **the organisation is not**. A UC Officer could assign the repair to the very organisation whose employee requested it. **Recommendation (not approved):** write a second, organisation-level exclusion, filter it out of `API-163`, and re-check at `API-164` acceptance |

### UC-UCO-012 — Assign a contractor from `ACCEPTED` · UC-UCO-013 — Server-side eligibility recheck

| Field | Detail |
|---|---|
| **Preconditions** | **State is `ACCEPTED`.** Not `UC_REVIEW`, not `VERIFIED` |
| **Authorization** | **`CAP_CASE_ASSIGN`** + scope + conflict + **step-up** |
| **Main flow** | **0.** `UCO-03`. **1.** Selects an eligible contractor and writes an assignment note. **2.** Step-up OTP if `recent_auth_at` is older than 10 minutes. **3.** **The server re-runs all five eligibility checks**. **4.** `CaseAssignment` created with a `response_deadline`. **5.** `ACCEPTED` → **`CONTRACTOR_ASSIGNED`**. **6.** Contractor and citizen notified |
| **Exception** | **E1** State is `UC_REVIEW` → **refused. Acceptance cannot be skipped.** **E2** Contractor became ineligible between render and submit → refused with the failing check named. **E3** Step-up stale → `401 E_STEP_UP_REQUIRED`. **E4** Conflict → `403 E_CONFLICT_EXCLUDED` |
| **Entities written** | `CaseAssignment`, `CivicReport.state` |
| **APIs / Screens / Capabilities** | `API-163` / `UCO-03`, `STF-08` / `CAP_CASE_ASSIGN` |
| **Audit / State** | `contractor_assigned` / `ACCEPTED` → `CONTRACTOR_ASSIGNED` |
| **Given/When/Then** | *Given* a report in `UC_REVIEW`, *when* assignment is attempted, *then* it is refused. *Given* a contractor whose organisation was suspended after the page rendered, *when* assignment is submitted, *then* the server refuses it |

### UC-UCO-014 — Reassign a contractor · UC-UCO-015 — Escalate · UC-UCO-016 — Handle a contractor decline

| Field | Detail |
|---|---|
| **Main flow (014)** | `UCO-04` → **Reassign** with a mandatory reason and **step-up**. The previous `CaseAssignment` is closed; a new one is created |
| **Main flow (015)** | `UCO-04` → **Escalate to Mayor & Operations** under `CAP_ESCALATION`. Appears at `MAY-02` |
| **Main flow (016)** | Contractor declines with an allowed reason → **`CONTRACTOR_ASSIGNED` → `ACCEPTED`**, audited `work_declined`. The officer reassigns |
| **Alternate (016)** | **No response within the window** → **system** returns the report to `ACCEPTED`, audited `assignment_lapsed`. **This is automatic, not a human decision** |
| **Exception** | **No eligible contractor remains** → escalate one level; if still none, **flag unresolvable and hold**. **Never auto-approved, never routed back to a conflicted account** |
| **APIs / Screens / Capabilities** | `API-163`, escalation route / `UCO-04` / `CAP_CASE_ASSIGN`, `CAP_ESCALATION` |
| **Audit** | `contractor_assigned`, `case_escalated`, `work_declined`, `assignment_lapsed`, `case_unresolvable` |

### UC-UCO-017 — Review contractor progress · UC-UCO-018 — Review completion evidence

| Field | Detail |
|---|---|
| **Main flow (017)** | `UCO-01` shows append-only `ContractorProgress` entries with evidence. **Read-only for the officer** |
| **Main flow (018)** | On `COMPLETION_SUBMITTED` the **system** routes to a **conflict-free** Representative for `COMPLETION_VERIFICATION`. **The UC Officer does not verify completion** — that is `CAP_COMPLETION_VERIFY`, held by `REP` |
| **Critical rule** | **No actor both does the work and approves it.** The completer is excluded from verifying |
| **Audit** | `progress_updated`, `completion_submitted`, `completion_routed` |
| **Open decisions** | **D-01 — Blocker, `TBD`.** After Representative verification the state becomes `PENDING_CITIZEN_CONFIRMATION`. **If the report was filed by a staff official, there is no citizen to act and the case stalls permanently.** **Branch A (recommended, not approved):** rename to `PENDING_REPORTER_CONFIRMATION` and generalise `CitizenConfirmation` to carry `subject_type` + `subject_id`. **Branch B:** auto-advance — **rejected as a recommendation**, because it strips the reporter's right to dispute |

### UC-UCO-019 — Handle a dispute · UC-UCO-020 — Order rework

| Field | Detail |
|---|---|
| **Preconditions** | State `REOPENED`; in scope; **the acting account is not the reporter** |
| **Authorization** | Dispute handling + **step-up** |
| **Main flow** | **0.** `UCO-05` shows the dispute reason, the citizen's explanation and any added evidence. **1.** Officer chooses **Rework**, **Reassign** or **Escalate**. **2.** Rework → **`REOPENED` → `IN_PROGRESS`**; Reassign → **`REOPENED` → `ACCEPTED`**. **3.** Mandatory reason recorded |
| **Critical rule** | **Rework and reassignment are separate, separately audited decisions.** The officer handles the dispute; **a formal appeal is decided by an independent Mayor/Ops actor** |
| **APIs / Screens** | dispute-handling route / `UCO-05` |
| **Audit / State** | `dispute_handled` / `REOPENED` → `IN_PROGRESS` or `ACCEPTED` |
| **Open decisions** | **`TBD — Hassan decision required`: is repeated reopening capped, and what happens at the cap?** **No policy is invented here** |

### UC-UCO-021 — Close a case

| Field | Detail |
|---|---|
| **Goal** | Formally end the case |
| **Preconditions** | State `RESOLVED_CONFIRMED` or another eligible state; in scope; **not the reporter account** |
| **Authorization** | **`CAP_CASE_CLOSE` — `UCO` only** + **step-up** |
| **Input data** | **Mandatory closure reason or checklist** |
| **Main flow** | **0.** `UCO-06`. **1.** Officer enters the mandatory reason. **2.** Step-up OTP if stale. **3.** Server checks capability, scope, conflict and state. **4.** `RESOLVED_CONFIRMED` → **`CLOSED`**. **5.** Citizen sees *"This report is finished and closed"* |
| **Exception** | **E1** No reason → refused. **E2** Wrong state → `409 E_STALE_STATE`. **E3** Conflict → `403 E_CONFLICT_EXCLUDED` |
| **Critical rule** | **`UCO-06` is the only ordinary closure screen in the system. Mayor & Operations has no equivalent screen and no close route.** Mayor/Ops may reopen, escalate, or use exceptional intervention — **never recorded as an ordinary closure** |
| **APIs / Screens / Capabilities** | `API-168` / `UCO-06`, `STF-08` / `CAP_CASE_CLOSE` |
| **Audit / State** | `case_closed` / → `CLOSED` |
| **Given/When/Then** | *Given* a Mayor/Ops session, *when* an ordinary closure is attempted, *then* no such route exists and the attempt fails |

### UC-UCO-022 — Invite a Street Representative · UC-UCO-023 — Scope cannot be widened

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_REP_INVITE` — UC Officer only, own scope.** Mayor/Ops does **not** invite Representatives in routine operation |
| **Main flow** | **0.** `UCO-07`. **1.** Enters the intended number, the ward and a **mandatory expiry**. **2.** **Step-up OTP.** **3.** **Server verifies the requested scope is contained within the officer's own assignment scope.** **4.** Creates the account, assignment and phone-bound single-use invitation |
| **Exception (023)** | Requested scope wider than the officer's own → **refused and audited**. **No actor may grant a scope broader than its own, or a role more privileged than its own** |
| **Scope hierarchy** | `city ⊃ district ⊃ tehsil ⊃ union_council ⊃ ward` |
| **APIs / Screens / Capabilities** | `API-098` / `UCO-07`, `STF-08` / `CAP_REP_INVITE` |
| **Audit** | `rep_invited` |
| **Given/When/Then** | *Given* an officer scoped to UC 12, *when* they invite a Representative for a ward in UC 13, *then* the request is refused and audited |

### UC-UCO-024 — Review scoped case history

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_AUDIT_READ` — scope-limited** for `UCO`; unrestricted civic read belongs to `MAY` |
| **Main flow** | `UCO-08` shows the audit narrative for cases in the officer's scope, **read-only** |
| **Security** | **No audit event text may contain a phone number, OTP, password, token or unrestricted rendering content.** **No actor may edit or delete an `AuditEvent` — including the audit service itself** |
| **Screens / Audit** | `UCO-08` / `audit_log_viewed` |

### UC-UCO-025 — Report an issue officially through `STF-10` · UC-UCO-026 — Conflict exclusion after self-reporting

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_REPORT_OFFICIAL`.** Service accounts and automated integrations are excluded |
| **Main flow** | **0.** `STF-10` — **one shared screen for all four staff roles**; four duplicate reporting screens do not exist. **1.** The screen states plainly, before submission, that **the reporter will be excluded from acting on this report**. **2.** Category · evidence · voice recording. **3.** AI produces an Urdu rendering, **labelled AI-generated**, with a version indicator. **4.** The officer **confirms their own rendering** under `CAP_RENDERING_CONFIRM_OWN`. **5.** Atomic creation at `SUBMITTED`, reference issued in the same transaction, `official_reporter_account_id` and `official_reporter_role_assignment_id` recorded, **`ConflictExclusion` written** |
| **Exception** | **E1** Missing evidence under branch A → `422 E_EVIDENCE_REQUIRED`. **E2** No confirmation → `422 E_RENDERING_NOT_CONFIRMED`. **E3** Connection lost → **named failure with retry** |
| **Offline** | **Blocked in every respect** — see **D-11** |
| **Conflict (026)** | The exclusion is keyed on **`excluded_staff_account_id`**, not the assignment. *"A UC Officer who submits an official report remains excluded from verifying, accepting, assigning, approving, closing or deciding a dispute on that report — even after switching to a Street Representative or Mayor/Ops assignment."* |
| **Entities written** | `ClientSubmission` *(`reporter_subject_type = staff`)* · `VoiceTranscriptionArtifact` · `RenderingConfirmation` · `CivicReport` · `ReportOwnership` · **`ConflictExclusion`** |
| **APIs / Screens / Capabilities** | `API-130`, `API-131/132`, `API-135`, **`API-141`** / `STF-10` / `CAP_REPORT_OFFICIAL`, `CAP_RENDERING_CONFIRM_OWN` |
| **Audit / State** | `report_submitted` *(`staff_role_assignment`)* / → `SUBMITTED` |
| **Open decisions** | **D-02 / D-03** — there is **no staff screen showing a staff user their own reports**. **D-09** — staff receive **no versioned voice-processing notice** before recording, and `ConsentRecord` cannot hold a staff consent because it is keyed on `citizen_account_id`. **D-11** — the offline claim on `STF-10` contradicts the Django/HTMX stack. **D-14** — mandatory photo remains open |

### UC-UCO-027 — Multi-role switching

| Field | Detail |
|---|---|
| **Main flow** | **0.** The account holds a UC Officer assignment and a Street Representative assignment. **1.** `STF-06`. **2.** Selects the other. **3.** The session acts under **exactly that one**. **4.** Switching **upward** requires a fresh OTP |
| **Critical rules** | **Capabilities are never combined.** **Account-level conflict exclusions apply regardless of the currently selected role.** **Role and scope validity are checked at the point of action, not at login** |
| **APIs / Screens** | `API-120` / `STF-06` |
| **Audit** | `acting_role_selected` |
| **Given/When/Then** | *Given* an account holding both `UCO` and `REP` assignments, *when* acting as `REP`, *then* no `UCO` capability is available in that session |

### UC-UCO-028 — Password reset, session management and logout

| Field | Detail |
|---|---|
| **Main flow** | `STF-07` reset — number → OTP *(`purpose = password_reset`)* → new password. **Revokes all existing sessions.** Notifies the officer and the appropriate administrator. **Cannot reactivate a suspended, revoked or expired account.** `STF-09` lists devices and offers **sign out everywhere**. Logout is **server-side revocation** — client discard is not a logout |
| **Security** | **Replay of a consumed refresh token revokes the whole family** |
| **Mobile-number change** | **Not self-service.** Requires an authorised Mayor/Ops approval at `MAY-03` with a reason, OTP on the new number, session revocation and audit |
| **APIs / Screens** | `API-127`, `API-128`, `API-004` / `STF-07`, `STF-09` |
| **Audit** | `password_reset`, `session_revoked` |

### UC-UCO-029 — Suspended, revoked, expired and out-of-scope behaviour

| Field | Detail |
|---|---|
| **Suspended / revoked** | Login refused; **active sessions invalidated at the next action** |
| **Expired assignment** | Checked **at the point of action**; session **downgrades on the next request** with `403 E_ROLE_ASSIGNMENT_INVALID` |
| **Out of scope** | Not rendered; a direct request is **refused server-side** |
| **Active, no assignment** | Authenticates but receives **no portal privilege** |
| **Given/When/Then** | *Given* an officer mid-review, *when* the account is suspended, *then* the next action fails and the session is revoked |

---

## Coverage summary

| Requirement | Use case |
|---|---|
| 1 invitation · 2 acceptance/OTP/password · 3 login · 4 role selection | `001`–`004` |
| 5 dashboard · 6 review · 7 accept · 8 reject · 9 clarification · 10 flag rendering | `005`–`010` |
| 11 eligible contractors · 12 assign · 13 recheck · 14 reassign · 15 escalate · 16 decline | `011`–`016` |
| 17 progress · 18 completion · 19 dispute · 20 rework · 21 close | `017`–`021` |
| 22 invite Rep · 23 scope limit · 24 history | `022`–`024` |
| 25 `STF-10` · 26 conflict exclusion · 27 multi-role | `025`–`027` |
| 28 reset/session/logout · 29 suspended/expired/out-of-scope | `028`, `029` |

## Open decisions affecting this portal

| ID | Severity | Decision |
|---|---|---|
| **D-01** | **Blocker** | Confirmation state for staff-official reports — **`TBD`** |
| **D-02 / D-03** | **Blocker / High** | Staff report tracking and `STF-11` — **`TBD` / PROPOSED** |
| **D-04 / D-05** | **Blocker** | Acting-role selection circularity — **PROPOSED** |
| **D-06** | **Blocker** | Contractor organisation self-dealing — **`TBD`** |
| **D-07** | High | Purpose-bound OTP tickets — **PROPOSED** |
| **D-09** | High | Staff voice-processing notice — **PROPOSED** |
| **D-11** | High | `STF-10` offline claim — **PROPOSED: online-only** |
| **D-13** | **Blocker** | Citizen name does not exist — followed here |
| **D-14** | High | Mandatory photo — **`TBD`** |
| — | — | Repeated-reopening cap · no-response closure policy — **`TBD`** |

---

*Specified; not implemented; not tested. No case has been accepted, assigned or closed by any officer.*
