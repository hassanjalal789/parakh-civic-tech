# Parakh — Mayor & Operations Portal Use Cases

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Portal** | **Mayor & Operations (`MAY`)** — Django Templates + HTMX + Alpine.js |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 |
| **Screens** | Shared `STF-01` … `STF-10` · Own `MAY-01` … `MAY-09` |
| **Use cases** | `UC-MAY-001` … `UC-MAY-028` |

---

# A. Portal purpose

Mayor & Operations holds **city-wide oversight and account administration**. It provisions officers and contractors, approves organisations, reads the civic audit record, handles escalations, and decides formal appeals.

**It is not a superuser.** Every action requires an explicit capability, a scope, and an audit event. There are things this portal deliberately cannot do, and the list matters more than the list of things it can.

## Boundaries — what Mayor & Operations cannot do

| Prohibited | Why | Who does it instead |
|---|---|---|
| **Ordinary case closure** | Closure is a Union Council decision, made by the officer who accepted and assigned the case | **UC Officer** — `CAP_CASE_CLOSE`, `UCO-06` |
| **Reject a report** | Same reason. The permission matrix records `no` for `MAY` | **UC Officer** — `CAP_CASE_REJECT` |
| **Assign a contractor** | Same reason | **UC Officer** — `CAP_CASE_ASSIGN` |
| **Invite a Street Representative in routine operation** | Representatives belong to a UC Officer's scope | **UC Officer** — `CAP_REP_INVITE` |
| **Verify a report or a completion** | Requires being on the ground | **Street Representative** |
| **See a citizen mobile number** | No operational role receives it, in any form | **Nobody** |
| **Confirm anyone's rendering but their own** | `CAP_RENDERING_CONFIRM_OWN` is subject-type aware and never delegable | **The reporter** |
| **Decide an appeal on a case they previously acted on** | Independence is the point of an appeal | **A different Mayor/Ops actor** |
| **Read hash-chain integrity results as a civic act** | That is technical, not civic | **Technical System Administrator**, out of band |

> **A Mayor/Ops user with `CAP_CASE_TRIAGE` still cannot create an account.** *Case-management authority never implies account-administration authority.* `CAP_ACCOUNT_ADMIN` is **explicitly granted, never automatic**.

---

# B. Actor and account summary

| Property | Value |
|---|---|
| **Actor code** | `MAY` |
| **Who creates the first account** | **Secure out-of-band bootstrap at deployment.** Not through any civic screen |
| **Who creates later accounts** | **An authorised Mayor/Ops Account Administrator holding `CAP_ACCOUNT_ADMIN`** |
| **Account identifier** | **Official mobile number**, in `StaffCredential` only. `staff_reference` is optional, administrative, **never used for login** |
| **Authentication factors** | **Two — user-created password + six-digit SMS OTP.** Identical to every other staff role |
| **Activation** | Invitation → OTP on the intended number → **the user creates their own password** |
| **RoleAssignment** | At least one `ACTIVE` and unexpired, with **mandatory `valid_until`** |
| **Scope** | Typically `city` or `district`. **Never unlimited** |
| **Account statuses** | `INVITED` · `PENDING_ACTIVATION` · `ACTIVE` · `SUSPENDED` · `REVOKED` · `EXPIRED` |
| **Login blocked when** | `SUSPENDED`, `REVOKED`, `EXPIRED`; or `ACTIVE` with no active `RoleAssignment` |
| **Step-up** | Fresh SMS OTP, 10-minute window. **Required for:** exceptional intervention · protected contact · account admin · role and scope assignment · suspend/revoke · organisation approval and suspension · export · reopen · appeal decision · audit read where policy requires |
| **Logout** | `STF-09` — this session or **sign out everywhere** |

## The bootstrap problem, stated honestly

**The first Mayor/Ops account cannot be invited, because no account exists to invite it.** The sources specify *"Initial account bootstrapped out-of-band; later accounts invited by an authorised Mayor/Ops Account Administrator"* and *"Provisioned out-of-band through the deployment environment"* for the Technical System Administrator.

**What is specified:** the bootstrap happens outside the civic application, through the deployment environment.
**What is not specified:** the exact bootstrap procedure, who performs it, what evidence is retained, or how it is audited given that the audit chain itself is being started.

**No bootstrap procedure is invented here.** See `UC-MAY-001`.

---

# C. The 0-to-100 golden journey

*Actor: a Deputy Director of Operations, invited last week by the bootstrapped Mayor/Ops administrator, city-wide scope.*

| Step | Screen | User sees | User action | System action | API | Data | Authorization | State | Audit | Success | Failure | Offline | Accessibility / language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0** | — | SMS with a single-use invitation link | Taps it | Portal opens | — | — | — | `INVITED` | `account_invited` | `STF-01` | Expired → plain message, **no account detail disclosed** | **Online only** | Plain link text |
| **1** | `STF-01` | *"You have been invited to Mayor & Operations, city-wide scope"* and a number field | Enters the official number | Compares against `intended_phone_lookup_hmac` | `API-123` | `AccountInvitation` read | Invitation validity | `INVITED` | — | `STF-02` | **A different number is refused; the invitation is not consumed** | **Online only** | **Scope in plain language** |
| **2** | `STF-02` | Six digit boxes | Enters the code | Verifies *(`purpose = staff_activation`)* | `API-124` | `OTPChallenge` consumed | Ticket-bound | → `PENDING_ACTIVATION` | `otp_verified` | `STF-03` | **Uniform** message | **Online only** | Digits LTR |
| **3** | `STF-03` | Password, confirm, plain guidance | **Creates their own password** | Argon2id, hash only | `API-105` | `StaffCredential` | Ticket-bound | → `ACTIVE` | `password_set` | `STF-04` | Weak → plain guidance | **Online only** | **No administrator ever sees this, including the one who invited them** |
| **4** | `STF-04` → `STF-05` | Sign in, then a six-digit code | Password, then OTP | **Two factors**; issues tokens and the assignment list | `API-005`, `API-125` | `AuthSession`, `RefreshTokenFamily`, `DeviceSession` | Public-auth → ticket-bound | — | `login_first_factor`, `otp_verified`, `session_created` | `STF-06` | **Wrong number and wrong password are operationally indistinguishable** | **Online only** | **First and second factor — never a third** |
| **5** | `STF-06` | *"You are signed in as Mayor & Operations for Lahore."* | Selects it | Binds **exactly one** `RoleAssignment` | `API-120` | `AuthSession.acting_role_assignment_id` | **See D-04** | — | `acting_role_selected` | `MAY-01` | No active assignment → plain screen, **no privilege** | **Online only** | **Plain sentence, no RBAC jargon** |
| **6** | `MAY-01` | Operations dashboard — city-wide volume, overdue, reopened, escalation counts | Reviews | Loads scope-limited indicators | scoped reads | — | Role + scope | — | — | Drill-down available | Out-of-scope data → **not rendered** | **Online only** | Counts carry text labels |
| **7** | `MAY-02` | Escalations — cases a UC Officer could not resolve | Opens one | Loads the case with full civic context | `GET /reports/{id}` | — | Role + scope | any | `report_viewed` | Case detail | — | **Online only** | **No citizen phone number, no name — the field does not exist** |
| **8** | `MAY-03` | Account administration | Taps **Invite UC Officer** | Requires `CAP_ACCOUNT_ADMIN` | — | — | `CAP_ACCOUNT_ADMIN` | — | — | Form opens | Without the capability the control is absent **and the route refuses** | **Online only** | Only authorised actions are displayed |
| **9** | `MAY-04` | Role and scope form: intended number, Union Council, **mandatory expiry** | Fills it | **Verifies the requested scope is not wider than the assigner's own** | — | — | `CAP_ROLE_ASSIGN` | — | — | Step-up prompted | Wider scope → **refused and audited** | **Online only** | Expiry is required and plainly labelled |
| **10** | `STF-08` | *"Please confirm the code we just sent you — you are creating an official account."* | Enters a fresh OTP | Updates `step_up_satisfied_at` | `API-126` | `AuthSession` | Step-up | — | `step_up_satisfied` | Returns to `MAY-04` | `401 E_STEP_UP_REQUIRED` if skipped | **Online only** | **The screen explains why** |
| **11** | `MAY-03` | Confirmation | Taps **Send invitation** | Creates `StaffAccount` `INVITED`, `RoleAssignment` `PENDING` with `valid_until`, single-use hashed **phone-bound** `AccountInvitation` | `POST /staff/accounts` *(`API-098`)* | `StaffAccount`, `RoleAssignment`, `AccountInvitation` | `CAP_ACCOUNT_ADMIN` + `CAP_ROLE_ASSIGN` + step-up | → `INVITED` | `officer_provisioned`, `role_assigned` | SMS sent | Number already a staff account → **uniform** message | **Online only** | **The administrator never sets a credential** |
| **12** | `MAY-05` | Contractor organisations — one in `PENDING_APPROVAL` | Reviews, records approval reference, categories, service areas, validity dates | Step-up already satisfied within the window | organisation approval route | `ContractorOrganization` | `CAP_ACCOUNT_ADMIN` + step-up | `PENDING_APPROVAL` → **`APPROVED`** | `organisation_approved` | Contractor invitation becomes possible | Missing approval reference → refused | **Online only** | Categories and areas in plain text |
| **13** | `MAY-08` | **Send protected message** — a citizen must be told the work needs site access | Chooses a template, writes permitted text, sends | **No citizen number is rendered anywhere on this screen — not masked, not partial, not on hover.** The notification service sends it. **SMS only if the citizen consented; otherwise in-app only** | `POST /reports/{id}/protected-contact` *(`API-171`)* | `ProtectedContactRequest` | **`CAP_PROTECTED_CONTACT`** + step-up | unchanged | `protected_contact_sent` — **no phone number in the event** | Citizen receives it | No SMS consent → **delivered in-app only** | **Online only** | **Message body never contains the phone number or report content** |
| **14** | `MAY-09` | A formal appeal on a case this user has never touched | Reviews the dispute record and evidence | **Checks the actor is not a prior actor on that case** | `POST /disputes/{id}/appeal/decide` *(`API-170`)* | `Dispute.appeal_status`, `appeal_outcome` | **`CAP_APPEAL_DECIDE`** + not-a-prior-actor + step-up | `appeal_status: FILED` → **`DECIDED`** | `appeal_decided` | Decision recorded; **the resulting case transition is recorded explicitly** | Prior actor → **`403 E_CONFLICT_EXCLUDED`** | **Online only** | **The case itself remains `REOPENED` — there is no "(appeal)" state** |
| **15** | `MAY-06` | Civic audit review — filter and read | Reads a case history | Scope-limited read | `GET /reports/{id}/history` *(`API-080`)* | — | **`CAP_AUDIT_READ`** | — | `audit_log_viewed` | Narrative displayed | — | **Online only** | **No phone number, OTP, password, token or unrestricted rendering appears in any audit text** |
| **16** | `STF-09` | Device list | **Sign out** | Server-side revocation | `API-004` | `AuthSession.revoked_at` | Own session | — | `session_revoked` | Returns to `STF-04` | — | **Online only** | **Client discard is not a logout** |

**End of golden journey. 17 steps, Step 0 to Step 16.**

---

# D. Formal use cases

### UC-MAY-001 — Secure out-of-band bootstrap of the first Mayor/Ops account

| Field | Detail |
|---|---|
| **Status** | **Partially specified. The procedure is not invented here** |
| **What the sources state** | *"Initial account bootstrapped out-of-band; later accounts invited by an authorised Mayor/Ops Account Administrator."* The Technical System Administrator is *"provisioned out-of-band through the deployment environment"* and **is not a civic portal** |
| **What is therefore true** | The first `StaffAccount` with a Mayor/Ops `RoleAssignment` is created **outside the civic application**, through the deployment environment. **There is no civic screen and no civic API for it** |
| **What is not specified** | Who performs it · what authorisation evidence is retained · how it is audited when the audit chain is itself being initialised · whether the bootstrapped account must immediately set its own password through `STF-03`, or arrives with one already set |
| **The security point that must not be lost** | **Even at bootstrap, no administrator may choose, view, transmit or store the user's password.** If the bootstrap creates an account, **the human owner must still set their own password through `STF-03`**, exactly as an invited user does |
| **Prohibited regardless** | Public signup · a password transmitted by SMS, email, WhatsApp, spreadsheet or paper · a shared or default credential |
| **Open decisions** | **`TBD — Hassan decision required`: the exact bootstrap procedure, its authorisation evidence and its audit treatment.** This is an operational security procedure, not a screen design, and inventing one here would be worse than naming the gap |

### UC-MAY-002 — Invite a later Mayor/Ops account

| Field | Detail |
|---|---|
| **Primary actor** | An authorised Mayor/Ops Account Administrator |
| **Authorization** | **`CAP_ACCOUNT_ADMIN` + `CAP_ROLE_ASSIGN` + step-up** |
| **Main flow** | **0.** `MAY-03`. **1.** Enters the intended official number and the scope, with a **mandatory expiry**. **2.** Step-up OTP. **3.** **Server verifies the requested scope is not wider than the assigner's own, and the role not more privileged than their own.** **4.** Creates `StaffAccount` `INVITED`, `RoleAssignment` `PENDING`, single-use hashed phone-bound `AccountInvitation` |
| **Exception** | **E1** Scope wider than the assigner's → refused, audited. **E2** Step-up stale → `401 E_STEP_UP_REQUIRED`. **E3** Number already a staff account → uniform message |
| **Critical rule** | **`CAP_ACCOUNT_ADMIN` is explicitly granted, never automatic.** A Mayor/Ops user without it cannot invite anyone |
| **APIs / Screens** | `API-098` / `MAY-03`, `MAY-04`, `STF-08` |
| **Audit** | `account_invited`, `role_assigned` |

### UC-MAY-003 — Invitation acceptance, OTP and password · UC-MAY-004 — Login · UC-MAY-005 — Acting-role selection

| Field | Detail |
|---|---|
| **Main flow** | `STF-01` accept → `STF-02` OTP *(`purpose = staff_activation`)* → `STF-03` **the user creates their own password** → account `ACTIVE` → `STF-04` password → `STF-05` login OTP → `STF-06` **select exactly one assignment** → `MAY-01` |
| **Preconditions** | Account `ACTIVE` **and** ≥1 `RoleAssignment` `ACTIVE` and unexpired |
| **Exception** | **E1** Active, no assignment → plain screen, **no privilege**. **E2** Suspended → login refused. **E3** Wrong credentials → **operationally indistinguishable** |
| **Security** | **Identical authentication to every other staff role.** No Mayor-specific login technology exists. **No TOTP, passkey, WebAuthn or hardware key** |
| **APIs / Screens** | `API-123`, `API-124`, `API-105`, `API-005`, `API-125`, `API-120` / `STF-01` … `STF-06` |
| **Audit** | `otp_verified`, `password_set`, `login_first_factor`, `session_created`, `acting_role_selected` |
| **Open decisions** | **D-04 / D-05 — Blocker, PROPOSED.** `API-120` is classed `Staff-authenticated`, requiring the acting-role header it exists to obtain. **Circular.** Recommendation: a `Staff-pre-role` class holding **zero capabilities**, with `AuthSession.acting_role_assignment_id` **explicitly nullable**. **D-07 PROPOSED**: purpose-bound tickets |

### UC-MAY-006 — Operations dashboard · UC-MAY-007 — Scope-limited indicators

| Field | Detail |
|---|---|
| **Main flow** | `MAY-01` shows volume, overdue, reopened and escalation indicators **within the acting assignment's scope** |
| **Critical rule** | **Scope is never unlimited.** A Mayor/Ops assignment is scoped to a city or district, and **out-of-scope data is not rendered and is refused server-side if requested** |
| **Screens** | `MAY-01` |
| **Accessibility** | Indicators carry text labels; **colour is never the sole carrier of meaning** |

### UC-MAY-008 — Review escalations

| Field | Detail |
|---|---|
| **Trigger** | A UC Officer escalated a case under `CAP_ESCALATION`, or a case was flagged unresolvable |
| **Main flow** | **0.** `MAY-02` lists escalations. **1.** Opens one. **2.** Reads the full civic context: rendering, evidence, verification notes, timeline. **3.** Chooses an action — reassignment is **not** available to `MAY`; the options are to return guidance to the UC Officer, reopen, or use exceptional intervention |
| **Exception** | **Case flagged unresolvable** — no eligible Representative or Contractor remains. **It is held, never auto-approved and never routed back to a conflicted account** |
| **APIs / Screens** | `GET /reports/{id}` / `MAY-02` |
| **Audit** | `report_viewed`, `case_escalated` *(written by the officer)*, `case_unresolvable` |

### UC-MAY-009 — Exceptional intervention · UC-MAY-010 — Mayor/Ops does not perform ordinary closure

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_EXCEPTIONAL_INTERVENTION`** + **not a prior actor** + **step-up** |
| **Input data** | **Mandatory reason** |
| **Main flow** | **0.** `MAY-07`. **1.** Selects the case and the intervention. **2.** Writes the mandatory reason. **3.** Step-up OTP. **4.** The act is recorded as `exceptional_intervention` — **separately audited, and never recorded as an ordinary closure** |
| **Critical rule (010)** | **`UCO-06` is the only ordinary closure screen in the system. Mayor & Operations has no equivalent screen and no close route.** `MAY` may **reopen**, **escalate**, or use exceptional intervention. The permission matrix records **`no`** for `MAY` on ordinary closure, rejection and assignment |
| **Exception** | **E1** Prior actor on that case → `403 E_CONFLICT_EXCLUDED`. **E2** No reason → refused. **E3** Step-up stale → `401 E_STEP_UP_REQUIRED` |
| **Screens / Capabilities** | `MAY-07`, `STF-08` / `CAP_EXCEPTIONAL_INTERVENTION` |
| **Audit** | `exceptional_intervention` |
| **Given/When/Then** | *Given* a Mayor/Ops session, *when* an ordinary closure is attempted, *then* no route exists and the attempt fails. *Given* an exceptional intervention, *when* it is recorded, *then* the audit event is `exceptional_intervention`, never `case_closed` |

### UC-MAY-011 — Provision a UC Officer · UC-MAY-012 — Invite later Mayor/Ops staff · UC-MAY-013 — Assign role and scope with mandatory expiry

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_ACCOUNT_ADMIN`** *(create/invite)* + **`CAP_ROLE_ASSIGN`** *(role and scope)* + **step-up** |
| **Main flow** | **0.** `MAY-03` for the account, `MAY-04` for the role and scope. **1.** Intended official number, role, geographic scope, **mandatory `valid_until`**. **2.** Step-up OTP. **3.** Server verifies **the scope is not wider and the role not more privileged than the assigner's own**. **4.** Account `INVITED`, assignment `PENDING`, invitation issued |
| **Critical rules** | **`valid_until` is mandatory** — a role assignment never runs indefinitely. **A `RoleAssignment` is never hard-deleted**; `revoked_by`, `revoked_at` and `reason` are retained. **Scope hierarchy:** `city ⊃ district ⊃ tehsil ⊃ union_council ⊃ ward` |
| **Exception** | Wider scope or higher role → **refused and audited** |
| **Entities written** | `StaffAccount`, `RoleAssignment`, `AccountInvitation` |
| **APIs / Screens / Capabilities** | `API-098`, `POST /staff/role-assignments` *(`API-173`)* / `MAY-03`, `MAY-04`, `STF-08` / `CAP_ACCOUNT_ADMIN`, `CAP_ROLE_ASSIGN` |
| **Audit** | `officer_provisioned`, `account_invited`, `role_assigned`, `scope_changed` |
| **Given/When/Then** | *Given* a district-scoped Mayor/Ops user, *when* they assign a city-wide role, *then* it is refused and audited |

### UC-MAY-014 — Suspend or revoke an account

| Field | Detail |
|---|---|
| **Authorization** | `CAP_ACCOUNT_ADMIN` + **step-up** |
| **Main flow** | **0.** `MAY-03`. **1.** Selects the account, chooses Suspend or Revoke, writes a reason. **2.** Step-up OTP. **3.** Status changes. **4.** **Active sessions are invalidated** — the affected user's next action fails, not their next login |
| **Exception** | **E1 Cannot revoke the last account administrator.** A system with no one able to grant authority is a system nobody can fix |
| **Effect** | **Login is refused.** For a contractor account, **suspending the organisation cascades to its accounts immediately** |
| **APIs / Screens / Capabilities** | `POST /staff/accounts/{id}/suspend` · `/revoke` *(`API-172`)* / `MAY-03`, `STF-08` / `CAP_ACCOUNT_ADMIN` |
| **Audit** | `account_suspended` |
| **Given/When/Then** | *Given* an officer signed in and mid-review, *when* their account is suspended, *then* their next action fails and the session is revoked |

### UC-MAY-015 — Approve a staff mobile-number change

| Field | Detail |
|---|---|
| **Why it is not self-service** | The mobile number **is the staff login identifier**. Self-service change would let a compromised session move the account to an attacker's handset |
| **Main flow** | **0.** The staff member requests the change out of band. **1.** `MAY-03` — the administrator records a **reason**. **2.** **Step-up OTP** for the administrator. **3.** An OTP *(`purpose = staff_phone_change_new`)* verifies the **new** number. **4.** `StaffCredential` updated. **5.** **All sessions for that account are revoked** |
| **Security** | **The audit event contains no phone number** |
| **APIs / Screens** | `MAY-03`, `STF-08` |
| **Audit** | `phone_changed` |

### UC-MAY-016 — Approve a contractor organisation · UC-MAY-017 — Suspend or revoke one · UC-MAY-018 — Invite a contractor after approval

| Field | Detail |
|---|---|
| **Authorization** | `CAP_ACCOUNT_ADMIN` + **step-up** |
| **Main flow (016)** | **0.** `MAY-05`. **1.** Records `approval_reference`, `approved_categories[]`, `service_areas[]`, `valid_from … valid_until`. **2.** Step-up. **3.** `PENDING_APPROVAL` → **`APPROVED`** |
| **Main flow (017)** | Suspend or revoke → **cascades to every account in that organisation immediately**; the organisation disappears from `UCO-03` eligibility; accepted jobs cannot be progressed |
| **Main flow (018)** | **Only after `APPROVED`** — `MAY-03` invites a contractor staff account with `organization_id` set |
| **Critical rules** | **A UC Officer can never create or approve a contractor organisation.** **No contractor account may be invited before approval** |
| **Screens / Capabilities** | `MAY-05`, `MAY-03`, `STF-08` / `CAP_ACCOUNT_ADMIN` |
| **Audit** | `organisation_approved`, `contractor_provisioned` |
| **Open decisions** | **`TBD — Hassan decision required`: how an organisation record reaches `PENDING_APPROVAL`.** **No self-service registration route exists in any approved source**, and none is invented |

### UC-MAY-019 — Review civic audit records

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_AUDIT_READ`** — Mayor & Ops unrestricted within scope; UC Officer **scope-limited** |
| **Main flow** | `MAY-06` filters and reads the civic audit narrative for cases in scope. **Read-only for every role** |
| **Critical rules** | **No actor, service or role may edit or delete an `AuditEvent` — including the audit service itself.** Civic users have **no direct write, update or delete permission** on the audit table; only the audit-writing service appends. **No audit event text may contain a phone number, OTP, password, token or unrestricted rendering content** |
| **What `MAY` does not get** | **Hash-chain integrity results.** Those belong to `CAP_AUDIT_INTEGRITY_VERIFY`, held **only** by the Technical System Administrator, which **holds no civic capability and appears in no use case in this pack** |
| **APIs / Screens** | `API-080` / `MAY-06` |
| **Audit** | `audit_log_viewed` |

### UC-MAY-020 — Send a protected message · UC-MAY-021 — Respect SMS-notification consent

| Field | Detail |
|---|---|
| **Goal** | Contact a citizen **without ever seeing a number** |
| **Authorization** | **`CAP_PROTECTED_CONTACT`** + **step-up** |
| **Main flow** | **0.** `MAY-08`. **1.** Selects the report and a purpose code. **2.** Chooses a template or writes permitted text. **3.** Step-up OTP. **4.** The **notification service** sends it. **5.** `ProtectedContactRequest` records actor, acting assignment, report, purpose, channel and timestamp |
| **Channel rule (021)** | **If the citizen consented to SMS notification, the message may go by SMS. Otherwise it is delivered in-app only.** Emergency or legally required messaging without consent is **`TBD — legal or institutional review required`** |
| **Critical rule** | **`MAY-08` renders no citizen phone number in any form — not masked, not partial, not on hover.** A masked number cannot be dialled, so displaying one was a contradiction, and `CAP_IDENTITY_VIEW_MASKED` was withdrawn |
| **Privacy** | **The audit event contains no phone number.** The message body never contains the number or report content |
| **APIs / Screens / Capabilities** | `API-171` / `MAY-08`, `STF-08` / `CAP_PROTECTED_CONTACT` |
| **Audit** | `protected_contact_sent` |
| **Given/When/Then** | *Given* a citizen who withdrew SMS consent, *when* a protected message is sent, *then* it is delivered in-app only and no SMS is dispatched |

### UC-MAY-022 — Review and decide a formal appeal · UC-MAY-023 — Decision-maker conflict exclusion

| Field | Detail |
|---|---|
| **Preconditions** | `Dispute.appeal_status ∈ {FILED, UNDER_REVIEW}` |
| **Authorization** | **`CAP_APPEAL_DECIDE`** + **not a prior actor on that case** + step-up |
| **Main flow** | **0.** `MAY-09`. **1.** Server checks the acting **account** against every prior action on that case. **2.** Reviews the dispute record, the citizen's reason and the evidence. **3.** Records the decision. **4.** `appeal_status` → **`DECIDED`**, with `appeal_decided_by_account_id`, `appeal_outcome`, `appeal_decided_at`. **5.** **The resulting case transition is recorded explicitly** — a return to `IN_PROGRESS` or `ACCEPTED` for rework, or `CLOSED` by a UC Officer. **Never implicit** |
| **Critical rules** | **The case itself remains `REOPENED` throughout.** **There is no `(appeal)` state** — a parenthesised phrase is not a state code, and the pseudo-transition was removed. **A UC Officer who handled the dispute cannot decide the appeal** |
| **Exception (023)** | Prior actor → **`403 E_CONFLICT_EXCLUDED`**. **The exclusion is account-level and survives role switching** |
| **APIs / Screens / Capabilities** | `API-170` / `MAY-09`, `STF-08` / `CAP_APPEAL_DECIDE` |
| **Audit** | `appeal_decided` |
| **Given/When/Then** | *Given* a Mayor/Ops user who earlier performed an exceptional intervention on a case, *when* they attempt to decide its appeal, *then* the request is refused |

### UC-MAY-024 — Report an issue officially through `STF-10`

| Field | Detail |
|---|---|
| **Authorization** | **`CAP_REPORT_OFFICIAL`.** Service accounts and automated integrations are excluded |
| **Main flow** | **0.** `STF-10` — **the same shared screen used by all four staff roles.** **1.** The screen states plainly, before submission, that **the reporter will be excluded from acting on this report**. **2.** Category · evidence · voice recording. **3.** AI produces an Urdu rendering, **labelled AI-generated**, with a version indicator. **4.** The user **confirms their own rendering** under `CAP_RENDERING_CONFIRM_OWN`. **5.** Atomic creation at `SUBMITTED`, reference issued in the same transaction, **`ConflictExclusion` written** |
| **Consequence for a Mayor/Ops reporter** | The account is thereafter excluded from **exceptional intervention, reopening, appeal decision, protected contact and audit action on that specific report** — under **every** assignment it holds, present or future |
| **Security** | **A Mayor/Ops user cannot confirm a citizen's rendering or another staff user's rendering.** Seniority grants no such right |
| **Offline** | **Blocked in every respect** — see **D-11** |
| **APIs / Screens / Capabilities** | `API-130`, `API-131/132`, `API-135`, **`API-141`** / `STF-10` / `CAP_REPORT_OFFICIAL`, `CAP_RENDERING_CONFIRM_OWN` |
| **Audit / State** | `report_submitted` *(`staff_role_assignment`)* / → `SUBMITTED` |
| **Open decisions** | **D-02 / D-03** — no staff screen shows a Mayor/Ops user their own reports. **D-09** — **no versioned voice-processing notice exists for staff**, and `ConsentRecord` cannot hold a staff consent because it is keyed on `citizen_account_id`. **D-11** — the `STF-10` offline claim contradicts the Django/HTMX stack. **D-14** — mandatory photo remains open |

### UC-MAY-025 — Multi-role switching without combining capabilities

| Field | Detail |
|---|---|
| **Main flow** | **0.** The account holds a Mayor/Ops assignment and a UC Officer assignment. **1.** `STF-06`. **2.** Selects the other. **3.** The session acts under **exactly that one**. **4.** Switching **upward** requires a fresh OTP |
| **Critical rules** | **Capabilities from different assignments are never combined.** Acting as `UCO`, the user has **no** `CAP_ACCOUNT_ADMIN`, no `CAP_APPEAL_DECIDE` and no `CAP_EXCEPTIONAL_INTERVENTION`. Acting as `MAY`, they have **no** `CAP_CASE_CLOSE`, no `CAP_CASE_REJECT` and no `CAP_CASE_ASSIGN`. **Account-level conflict exclusions apply regardless of the selected role.** **Validity is checked at the point of action** |
| **APIs / Screens** | `API-120` / `STF-06` |
| **Audit** | `acting_role_selected` |
| **Given/When/Then** | *Given* an account with both assignments acting as `MAY`, *when* an ordinary closure is attempted, *then* it fails, because `CAP_CASE_CLOSE` belongs to the `UCO` assignment and **capabilities are not unioned** |

### UC-MAY-026 — Step-up authentication

| Field | Detail |
|---|---|
| **Rule** | `recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)`; a fresh SMS OTP is required when it is older than **10 minutes** |
| **Required for** | Exceptional intervention · protected contact · account creation, suspension and revocation · role and scope assignment · organisation approval and suspension · export · reopen · appeal decision · staff number-change approval |
| **Not required for** | Dashboard viewing · escalation reading · routine navigation · **confirming one's own rendering** |
| **Key correctness point** | **The login OTP at `STF-05` already satisfies the window.** A sensitive action immediately after signing in **prompts nothing** |
| **Offline** | **Impossible** |
| **Accessibility** | **`STF-08` explains why a fresh code is needed**, in plain language, naming the action |
| **APIs / Screens** | `API-126` / `STF-08` |
| **Audit** | `step_up_satisfied` |

### UC-MAY-027 — Password reset, session management and logout

| Field | Detail |
|---|---|
| **Main flow** | `STF-07` — number → OTP *(`purpose = password_reset`)* → new password. **Revokes all existing sessions.** Notifies the user and the appropriate administrator. **Cannot reactivate a suspended, revoked or expired account.** `STF-09` lists devices with **sign out everywhere**. Logout is **server-side revocation** |
| **Security** | **Replay of a consumed refresh token revokes the whole family.** **No administrator can reset another user's password to a value they choose** — reset is always self-service through OTP |
| **APIs / Screens** | `API-127`, `API-128`, `API-004` / `STF-07`, `STF-09` |
| **Audit** | `password_reset`, `session_revoked` |

### UC-MAY-028 — Suspended, revoked, expired and unauthorized accounts

| Field | Detail |
|---|---|
| **Suspended / revoked** | Login refused; **active sessions invalidated at the next action** |
| **Expired assignment** | Checked **at the point of action**; session downgrades with `403 E_ROLE_ASSIGNMENT_INVALID` |
| **Active, no assignment** | Authenticates but receives **no portal privilege** |
| **Unauthorized action** | **Deny by default.** An absent capability is a denial. **Hiding a control is never sufficient** — the route refuses regardless |
| **Cross-scope request** | Refused server-side; not rendered client-side |
| **Given/When/Then** | *Given* a Mayor/Ops user whose assignment expired mid-session, *when* they attempt an administrative action, *then* it fails with `E_ROLE_ASSIGNMENT_INVALID` |

---

## Why this portal is not a superuser — the checks that prove it

| Claim | Evidence |
|---|---|
| Cannot close a case | `CAP_CASE_CLOSE` held by **`UCO` only**; permission matrix records **`no`** for `MAY`; **no close route exists** |
| Cannot reject | Matrix records **`no`** for `MAY` |
| Cannot assign a contractor | Matrix records **`no`** for `MAY` |
| Cannot invite a Representative routinely | `CAP_REP_INVITE` is **`UCO` only, own scope** |
| Cannot see a citizen number | **No operational role receives one, in any form** |
| Cannot confirm another's rendering | `CAP_RENDERING_CONFIRM_OWN` is **subject-type aware and never delegable** |
| Cannot decide an appeal they touched | **Not-a-prior-actor check**, account-level |
| Cannot exceed its own scope when granting | **Downward-only** assignment rule |
| Cannot revoke the last account administrator | Explicit exception |
| Cannot verify hash-chain integrity | `CAP_AUDIT_INTEGRITY_VERIFY` is **`SYSADMIN` only**, and that actor holds **no civic capability** |
| Cannot act on a report it filed | **Account-level `ConflictExclusion`**, surviving role switching |

---

## Coverage summary

| Requirement | Use case |
|---|---|
| 1 bootstrap · 2 later invitations · 3 acceptance · 4 login · 5 role selection | `001`–`005` |
| 6 dashboard · 7 indicators · 8 escalations | `006`–`008` |
| 9 exceptional intervention · 10 no ordinary closure | `009`, `010` |
| 11 provision UC Officer · 12 invite Mayor/Ops · 13 role and scope | `011`–`013` |
| 14 suspend/revoke · 15 number-change approval | `014`, `015` |
| 16 approve organisation · 17 suspend/revoke it · 18 invite contractor | `016`–`018` |
| 19 audit review · 20 protected message · 21 SMS consent | `019`–`021` |
| 22 appeal · 23 conflict exclusion | `022`, `023` |
| 24 `STF-10` · 25 multi-role · 26 step-up | `024`–`026` |
| 27 reset/sessions/logout · 28 suspended/expired/unauthorized | `027`, `028` |

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
| **D-13** | **Blocker** | **The RBAC privacy matrix grants `MAY` a "Citizen name" that does not exist in the data model.** These use cases follow the data model and display no name to anyone |
| **D-14** | High | Mandatory photo — **`TBD`** |
| — | — | **First-Mayor bootstrap procedure — `TBD`** · organisation registration surface — **`TBD`** · emergency contact without consent — **`TBD — legal or institutional review required`** |

---

*Specified; not implemented; not tested. No account has been provisioned, no organisation approved, and no appeal decided.*
