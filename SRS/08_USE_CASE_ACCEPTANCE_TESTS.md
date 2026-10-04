# Parakh — Use-Case Acceptance Tests

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not executed.** |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 · Test Catalogue v1.0 |

> **Nothing here has been written as code, run, or observed to pass or fail.** Every entry is a **specification of expected behaviour**. **No test result, pass rate or coverage figure is claimed.**

**Every test traces to:** use-case ID · screen ID · API · capability · entity · state transition · expected audit event.

---

## Reading the tables

| Column | Meaning |
|---|---|
| **ID** | `AT-<AREA>-NNN` |
| **Given / When / Then** | The assertion |
| **UC · Screen · API · Cap · Entity · State · Audit** | Full trace |

A test with no falsifiable **Then** is not a test. Every row below fails on a specific, observable condition.

---

# 1. Authentication — `AT-AUTH`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-AUTH-001` | **Given** an unregistered mobile number, **when** an OTP is requested and verified, **then** exactly one `CitizenAccount` is created and a session is issued | `UC-CIT-006`,`009` · `CIT-04`,`CIT-05` · `API-121`,`API-122` · — · `CitizenAccount` · →`ACTIVE` · `citizen_account_created` |
| `AT-AUTH-002` | **Given** a citizen account exists, **when** the same number verifies an OTP again, **then** no second account is created and the existing report history is intact | `UC-CIT-010`,`011` · `CIT-05` · `API-122` · — · `CitizenAccount` · — · `otp_verified` |
| `AT-AUTH-003` | **Given** any citizen route, **when** a password field or password parameter is sought, **then** none exists anywhere in the citizen surface | `UC-CIT-009` · `CIT-04`,`CIT-05` · `API-121`,`API-122` · — · — · — · — |
| `AT-AUTH-004` | **Given** each of `REP`, `UCO`, `CON`, `MAY`, **when** they authenticate, **then** all four use password **and** SMS OTP, and no role-specific login technology exists | `UC-REP-006`,`UC-UCO-003`,`UC-CON-007`,`UC-MAY-004` · `STF-04`,`STF-05` · `API-005`,`API-125` · — · `AuthSession` · — · `session_created` |
| `AT-AUTH-005` | **Given** any document, response body or error string, **when** it is searched for "three-factor", **then** the only matches are explicit denials | `UC-MAY-004` · `STF-04`,`STF-05` · — · — · — · — · — |
| `AT-AUTH-006` | **Given** an administrator, **when** they look for a way to set another user's password, **then** no route, screen or control exists | `UC-REP-005`,`UC-UCO-002`,`UC-MAY-003` · `STF-03` · `API-105` · — · `StaffCredential` · — · `password_set` |
| `AT-AUTH-007` | **Given** any generated message body, **when** it is inspected, **then** it contains no password | `UC-REP-005`,`UC-CON-006` · `STF-03` · — · — · — · — · — |
| `AT-AUTH-008` | **Given** any unauthenticated route, **when** it is called to create a `StaffAccount` or issue a staff invitation, **then** no such route exists | `UC-UCO-001` · — · `API-098` · `CAP_ACCOUNT_ADMIN` · `StaffAccount` · — · — |
| `AT-AUTH-009` | **Given** a wrong password and a wrong mobile number, **when** each is submitted, **then** the two outcomes are indistinguishable in body, status code and timing class | `UC-REP-006` · `STF-04` · `API-005` · — · — · — · `login_first_factor` |
| `AT-AUTH-010` | **Given** any route or entity, **when** searched for TOTP, passkey, WebAuthn or hardware-key artefacts, **then** none exists | `UC-MAY-003` · — · — · — · — · — · — |

# 2. OTP behaviour — `AT-OTP`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-OTP-001` | **Given** a valid challenge, **when** a wrong code is submitted, **then** a uniform failure is returned and `attempts` increments | `UC-CIT-012` · `CIT-05` · `API-122` · — · `OTPChallenge` · — · `otp_failed` |
| `AT-OTP-002` | **Given** a challenge past its 5-minute expiry, **when** the correct code is submitted, **then** the failure is **identical** to a wrong-code failure | `UC-CIT-012` · `CIT-05` · `API-122` · — · `OTPChallenge` · — · `otp_failed` |
| `AT-OTP-003` | **Given** a resend, **when** the previous code is submitted, **then** it is rejected because `superseded_by` invalidated it immediately | `UC-CIT-007` · `CIT-05` · `API-121` · — · `OTPChallenge` · — · `otp_requested` |
| `AT-OTP-004` | **Given** the rate limit is reached, **when** another OTP is requested, **then** a uniform cooldown response is returned and no SMS is dispatched | `UC-CIT-006` · `CIT-04` · `API-121` · — · `OTPChallenge` · — · `otp_rate_limited` |
| `AT-OTP-005` | **Given** an unregistered and a registered number, **when** an OTP is requested for each, **then** the responses are indistinguishable | `UC-CIT-006` · `CIT-04` · `API-121` · — · — · — · `otp_requested` |
| `AT-OTP-006` | **Given** five failed attempts, **when** a sixth is made, **then** the challenge is dead and a new one must be requested | `UC-CIT-012` · `CIT-05` · `API-122` · — · `OTPChallenge` · — · `otp_failed` |
| `AT-OTP-007` | **Given** a consumed OTP, **when** it is replayed, **then** it is rejected | `UC-CIT-009` · `CIT-05` · `API-122` · — · `OTPChallenge` · — · `otp_failed` |
| `AT-OTP-008` | **Given** a ticket issued for `purpose = staff_activation`, **when** it is presented to the step-up endpoint, **then** it is rejected — **`D-07` PROPOSED, not approved** | `UC-REP-004` · `STF-02`,`STF-08` · `API-124`,`API-126` · — · `OTPChallenge` · — · `otp_verified` |

# 3. Invitations — `AT-INV`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-INV-001` | **Given** a valid single-use invitation, **when** the intended number is confirmed, **then** activation proceeds and the invitation is consumed | `UC-REP-002` · `STF-01` · `API-123` · — · `AccountInvitation` · `INVITED` · — |
| `AT-INV-002` | **Given** an expired invitation, **when** it is opened, **then** a plain message appears and **no account detail is disclosed** | `UC-REP-003` · `STF-01` · `API-123` · — · `AccountInvitation` · — · — |
| `AT-INV-003` | **Given** an invitation bound to number X, **when** number Y attempts activation, **then** it is refused **and the invitation remains unconsumed** | `UC-REP-003` · `STF-01` · `API-123` · — · `AccountInvitation` · — · — |
| `AT-INV-004` | **Given** a consumed invitation, **when** it is reused, **then** the response is identical to the expired case | `UC-CON-004` · `STF-01` · `API-123` · — · `AccountInvitation` · — · — |
| `AT-INV-005` | **Given** an invitation token, **when** any log, analytics event or crash report is inspected, **then** the raw token value appears nowhere | `UC-REP-002` · `STF-01` · `API-123` · — · `AccountInvitation` · — · — |

# 4. Roles and assignments — `AT-ROLE`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-ROLE-001` | **Given** an `ACTIVE` `StaffAccount` with **no active `RoleAssignment`**, **when** it authenticates, **then** it receives a session but **every staff endpoint denies it** | `UC-REP-006`,`UC-UCO-004` · `STF-06` · `API-120` · — · `RoleAssignment` · — · `session_created` |
| `AT-ROLE-002` | **Given** an account with two assignments, **when** one is selected, **then** the session acts under **exactly that one** | `UC-REP-018`,`UC-UCO-027` · `STF-06` · `API-120` · — · `AuthSession` · — · `acting_role_selected` |
| `AT-ROLE-003` | **Given** an account holding both `UCO` and `REP` assignments acting as `REP`, **when** a `UCO` capability is exercised, **then** it is denied — **capabilities are never unioned** | `UC-MAY-025` · `STF-06` · `API-120` · all · `AuthSession` · — · — |
| `AT-ROLE-004` | **Given** a role assignment that expires mid-session, **when** the next action is attempted, **then** it fails with `403 E_ROLE_ASSIGNMENT_INVALID` — **checked at the point of action, not at login** | `UC-REP-024`,`UC-UCO-029` · all staff · all · — · `RoleAssignment` · — · — |
| `AT-ROLE-005` | **Given** a client that sends an acting-role assignment belonging to another account, **when** the request is made, **then** it is denied at check 1 and audited | `UC-UCO-004` · all staff screens · all staff routes · — · `RoleAssignment` · — · `unauthorised_access_attempt` |
| `AT-ROLE-006` | **Given** `API-120` classed `Staff-authenticated`, **when** the first post-login call is made, **then** the acting-role header cannot yet exist — **`D-04` contradiction, PROPOSED fix not approved** | `UC-REP-006` · `STF-06` · `API-120` · — · `AuthSession` · — · — |

# 5. Scope — `AT-SCOPE`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-SCOPE-001` | **Given** citizen A's session and citizen B's report ID, **when** the report is requested, **then** `404` is returned, **identical in body and timing to a fabricated ID** | `UC-CIT-057` · `CIT-15` · `API-151` · ownership · `ReportOwnership` · — · `unauthorised_access_attempt` |
| `AT-SCOPE-002` | **Given** a UC Officer scoped to UC 12, **when** they invite a Representative for a ward in UC 13, **then** the request is refused and audited | `UC-UCO-023` · `UCO-07` · `API-098` · `CAP_REP_INVITE` · `RoleAssignment` · — · — |
| `AT-SCOPE-003` | **Given** a Representative scoped to Ward 4, **when** a Ward 7 report is requested directly, **then** it is refused server-side and was never rendered | `UC-REP-008` · `REP-01` · report read · role+scope · `CivicReport` · — · — |
| `AT-SCOPE-004` | **Given** contractor A's session and contractor B's assigned report, **when** it is requested, **then** `404` is returned, identical to a fabricated ID | `UC-CON-009` · `CON-01` · report read · organisational scope · `CaseAssignment` · — · `unauthorised_access_attempt` |
| `AT-SCOPE-005` | **Given** a district-scoped Mayor/Ops user, **when** city-wide data is requested, **then** it is not rendered and a direct request is refused | `UC-MAY-007` · `MAY-01` · scoped reads · role+scope · — · — · — |
| `AT-SCOPE-006` | **Given** a district-scoped assigner, **when** a city-wide role is assigned, **then** it is refused and audited — **downward-only** | `UC-MAY-013` · `MAY-04` · `API-173` · `CAP_ROLE_ASSIGN` · `RoleAssignment` · — · `role_assigned` |

# 6. Permissions — `AT-PERM`

| ID | Given / When / Then | Trace |
|---|---|---|
| **`AT-PERM-001`** | **Given** a Mayor/Ops session, **when** an ordinary closure is attempted, **then** **no route exists** and the attempt fails | `UC-MAY-010`,`UC-UCO-021` · `UCO-06` · `API-168` · `CAP_CASE_CLOSE` · `CivicReport` · `RESOLVED_CONFIRMED`→`CLOSED` · `case_closed` |
| `AT-PERM-002` | **Given** a Mayor/Ops session, **when** a report rejection is attempted, **then** it is denied — the matrix records `no` for `MAY` | `UC-UCO-008` · `UCO-02` · `API-162` · `CAP_CASE_REJECT` · `CivicReport` · →`REJECTED` · `case_rejected` |
| `AT-PERM-003` | **Given** an exceptional intervention, **when** it is recorded, **then** the audit event is `exceptional_intervention` and **never** `case_closed` | `UC-MAY-009` · `MAY-07` · intervention · `CAP_EXCEPTIONAL_INTERVENTION` · `CivicReport` · varies · `exceptional_intervention` |
| `AT-PERM-004` | **Given** a Mayor/Ops session in routine operation, **when** a Street Representative invitation is attempted, **then** it is denied — `CAP_REP_INVITE` is `UCO`-only | `UC-REP-001`,`UC-UCO-022` · `UCO-07` · `API-098` · `CAP_REP_INVITE` · `StaffAccount` · →`INVITED` · `rep_invited` |
| `AT-PERM-005` | **Given** a UC Officer holding `CAP_CASE_TRIAGE` but not `CAP_ACCOUNT_ADMIN`, **when** they attempt to provision another officer, **then** it is refused and audited | `UC-UCO-001` · `MAY-03` · `API-098` · `CAP_ACCOUNT_ADMIN` · `StaffAccount` · — · — |
| `AT-PERM-006` | **Given** a Representative session, **when** contractor assignment is attempted, **then** it is denied | `UC-UCO-012` · `UCO-03` · `API-163` · `CAP_CASE_ASSIGN` · `CaseAssignment` · — · — |
| **`AT-PERM-007`** | **Given** a contractor who submitted completion, **when** they attempt to verify it, **then** no such capability exists for `CON` and the attempt fails | `UC-CON-017`,`UC-REP-011` · `CON-04`,`REP-03` · `API-166`,`API-167` · `CAP_COMPLETION_VERIFY` · `CompletionEvidence` · →`COMPLETION_SUBMITTED` · `completion_submitted` |
| **`AT-PERM-008`** | **Given** a contractor session, **when** case closure is attempted, **then** it is denied — `CAP_CASE_CLOSE` is `UCO`-only | `UC-CON-011` · — · `API-168` · `CAP_CASE_CLOSE` · `CivicReport` · — · — |
| `AT-PERM-009` | **Given** any absent capability, **when** the corresponding route is called, **then** it denies — **hiding a control is never sufficient** | all portals · all · all · all · — · — · — |

# 7. Conflict of interest and rendering confirmation — `AT-CONF`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-CONF-001` | **Given** a draft with no valid `RenderingConfirmation`, **when** report creation is attempted, **then** `422 E_RENDERING_NOT_CONFIRMED` is returned and no report exists | `UC-CIT-031`,`037` · `CIT-11` · `API-135`,`API-140` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · →`READY_TO_SUBMIT` · `rendering_confirmed` |
| **`AT-CONF-002`** | **Given** a staff session, **when** a **citizen's** rendering is confirmed, **then** it is denied | `UC-REP-015`,`UC-UCO-025` · `STF-10` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · — · — |
| **`AT-CONF-003`** | **Given** staff user A's session, **when** staff user B's official draft rendering is confirmed, **then** it is denied | `UC-MAY-024` · `STF-10` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · — · — |
| **`AT-CONF-004`** | **Given** a reviewer holding `CAP_TRANSCRIPT_REVIEW`, **when** they correct a rendering, **then** a **new version** is created, **the reporter must confirm it**, and **no staff confirmation is recorded** | `UC-UCO-010`,`UC-REP-013` · `UCO-02` · `API-136` · `CAP_TRANSCRIPT_REVIEW` · `VoiceTranscriptionArtifact` · — · `transcript_reviewed` |
| **`AT-CONF-005`** | **Given** an offline client holding rendering v1 while v2 is active, **when** v1 is confirmed, **then** `409 E_RENDERING_SUPERSEDED` and no report is created | `UC-CIT-032` · `CIT-11` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `VoiceTranscriptionArtifact` · — · — |
| **`AT-CONF-006`** | **Given** a mismatched `rendering_content_hash`, **when** confirmation is submitted, **then** `409 E_RENDERING_HASH_MISMATCH` and the server **never silently upgrades to the newer version** | `UC-CIT-032` · `CIT-11` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · — · — |
| `AT-CONF-007` | **Given** a Mayor/Ops user who previously acted on a case, **when** they attempt to decide its appeal, **then** `403 E_CONFLICT_EXCLUDED` | `UC-MAY-022`,`023` · `MAY-09` · `API-170` · `CAP_APPEAL_DECIDE` · `Dispute` · `FILED`→`DECIDED` · `appeal_decided` |
| `AT-CONF-008` | **Given** a UC Officer who handled the dispute, **when** they attempt the appeal, **then** it is denied — appeal is `MAY`-only and independent | `UC-MAY-023` · `MAY-09` · `API-170` · `CAP_APPEAL_DECIDE` · `Dispute` · — · — |
| **`AT-CONF-009`** | **Given** an account that filed a report as `UCO`, **when** it switches to a `REP` assignment and attempts field verification, **then** `403 E_CONFLICT_EXCLUDED` | `UC-REP-016`,`UC-UCO-026` · `REP-02` · `API-160` · `CAP_FIELD_VERIFY` · `ConflictExclusion` · — · — |
| `AT-CONF-010` | **Given** an excluded account, **when** it later receives a **new** role assignment and retries, **then** it is **still refused** | `UC-REP-016` · all · all · — · `ConflictExclusion` · — · — |
| `AT-CONF-011` | **Given** a contractor-affiliated account that reported an issue, **when** that organisation is offered for assignment, **then** **`D-06` is unresolved and the organisation is currently not excluded** — `TBD — Hassan decision required` | `UC-CON-023`,`UC-UCO-011` · `UCO-03` · `API-163` · `CAP_CASE_ASSIGN` · `ConflictExclusion` · — · — |
| `AT-CONF-012` | **Given** a report awaiting completion verification, **when** the system routes it, **then** the chosen Representative is **neither the completer nor the reporter** | `UC-REP-011` · `REP-03` · `API-167` · `CAP_COMPLETION_VERIFY` · `Verification` · T9→T10 · `completion_routed` |

# 8. Draft pipeline and report creation — `AT-PIPE`

| ID | Given / When / Then | Trace |
|---|---|---|
| **`AT-PIPE-001`** | **Given** a queued draft, **when** it is viewed, **then** **no `report_reference` is displayed and no `CivicReport` exists** | `UC-CIT-038` · `CIT-12` · `API-133` · — · `ClientSubmission` · `WAITING_FOR_CONNECTION` · — |
| `AT-PIPE-002` | **Given** a confirmed rendering and valid evidence, **when** creation succeeds, **then** exactly one `CivicReport` exists in **`SUBMITTED`** with a reference issued **in the same transaction** | `UC-CIT-037` · `CIT-13` · `API-140` · — · `CivicReport` · →`SUBMITTED` · `report_submitted` |
| **`AT-PIPE-003`** | **Given** the `CivicReport.state` enum, **when** it is inspected, **then** **`DRAFT` is not among the 15 values** | `UC-CIT-037` · — · `API-140` · — · `CivicReport` · — · — |
| `AT-PIPE-004` | **Given** a successful creation, **when** the reference is inspected, **then** it is human-readable and **non-sequential** | `UC-CIT-040` · `CIT-13` · `API-140` · — · `CivicReport` · `SUBMITTED` · `report_submitted` |
| **`AT-PIPE-005`** | **Given** any route or fixture, **when** a `CivicReport` is created in a state other than `SUBMITTED`, **then** it fails | `UC-CIT-037` · — · `API-140`,`API-141` · — · `CivicReport` · — · — |
| `AT-PIPE-006` | **Given** any active document, enum or response, **when** searched for `AWAITING_CITIZEN_REVIEW`, **then** the only matches are rename records | `UC-CIT-028` · `CIT-09` · `API-133` · — · `ClientSubmission` · `AWAITING_REPORTER_REVIEW` · — |
| `AT-PIPE-007` | **Given** report creation, **when** the transaction is interrupted after the report row but before the reference, **then** **neither exists** — creation is atomic | `UC-CIT-037` · — · `API-140` · — · `CivicReport` · — · — |

# 9. Idempotency — `AT-IDEM`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-IDEM-001` | **Given** the same `client_submission_id`, **when** draft creation is repeated, **then** the **existing** draft is returned | `UC-CIT-014` · `CIT-07` · `API-130` · — · `ClientSubmission` · `LOCAL_DRAFT` · — |
| `AT-IDEM-002` | **Given** an offline retry with the same `client_submission_id` and submission idempotency key, **when** it succeeds, **then** exactly one `CivicReport` exists | `UC-CIT-039` · `CIT-12` · `API-140` · — · `CivicReport` · →`SUBMITTED` · `report_submitted` |
| `AT-IDEM-003` | **Given** two concurrent retries of the same draft, **when** both complete, **then** exactly one report exists and both responses carry the same reference | `UC-CIT-039` · `CIT-12` · `API-140` · — · `CivicReport` · →`SUBMITTED` · `report_submitted` |
| `AT-IDEM-004` | **Given** a replayed confirmation idempotency key, **when** it is submitted, **then** the **original** result is returned and no second `RenderingConfirmation` is created | `UC-CIT-031` · `CIT-11` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · — · `rendering_confirmed` |
| `AT-IDEM-005` | **Given** confirmation and creation, **when** both are called, **then** they use **distinct** idempotency keys — **`D-12` PROPOSED, not approved** | `UC-CIT-031`,`037` · `CIT-11` · `API-135`,`API-140` · — · `RenderingConfirmation`,`CivicReport` · — · — |
| `AT-IDEM-006` | **Given** a stale `state_version`, **when** a workflow transition is attempted, **then** `409 E_STALE_STATE` | `UC-CIT-046` · `CIT-18` · `API-153` · ownership · `CivicReport` · — · — |

# 10. State machine — `AT-STATE`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-STATE-001` | **Given** a new report, **when** routing runs, **then** `SUBMITTED` → `UNDER_VERIFICATION` automatically | `WF-02` · — · — · automatic · `CivicReport` · T2 · `report_routed` |
| `AT-STATE-002` | **Given** field verification succeeds, **when** it is recorded, **then** `UNDER_VERIFICATION` → `VERIFIED` → `UC_REVIEW` | `UC-REP-010` · `REP-02` · `API-160` · `CAP_FIELD_VERIFY` · `Verification` · T3,T4 · `field_verified` |
| `AT-STATE-003` | **Given** a report in `UC_REVIEW`, **when** accepted, **then** it becomes **`ACCEPTED`** and assignment becomes reachable | `UC-UCO-007` · `UCO-02` · `API-161` · `CAP_CASE_ACCEPT` · `CivicReport` · T5 · `case_accepted` |
| `AT-STATE-004` | **Given** a report in `ACCEPTED`, **when** an eligible contractor is assigned with step-up, **then** it becomes `CONTRACTOR_ASSIGNED` | `UC-UCO-012` · `UCO-03` · `API-163` · `CAP_CASE_ASSIGN` · `CaseAssignment` · T6 · `contractor_assigned` |
| `AT-STATE-005` | **Given** completion submitted, **when** a conflict-free Representative verifies, **then** `COMPLETION_VERIFICATION` → `PENDING_CITIZEN_CONFIRMATION` | `UC-REP-011` · `REP-03` · `API-167` · `CAP_COMPLETION_VERIFY` · `Verification` · T9,T10 · `completion_verified` |
| `AT-STATE-006` | **Given** `PENDING_CITIZEN_CONFIRMATION`, **when** the citizen confirms, **then** `RESOLVED_CONFIRMED` | `UC-CIT-046` · `CIT-18` · `API-153` · ownership · `CitizenConfirmation` · T11 · `resolution_confirmed` |
| `AT-STATE-007` | **Given** `PENDING_CITIZEN_CONFIRMATION`, **when** the citizen disputes, **then** `REOPENED` with a mandatory reason | `UC-CIT-047` · `CIT-19` · `API-154` · ownership · `Dispute` · A6 · `resolution_disputed` |
| **`AT-STATE-008`** | **Given** a report in `UC_REVIEW`, **when** contractor assignment is attempted, **then** it is **refused — acceptance cannot be skipped** | `UC-UCO-012` · `UCO-03` · `API-163` · `CAP_CASE_ASSIGN` · `CivicReport` · prohibited · — |
| `AT-STATE-009` | **Given** `RESOLVED_CONFIRMED`, **when** a UC Officer closes with a mandatory reason and step-up, **then** `CLOSED` | `UC-UCO-021` · `UCO-06` · `API-168` · `CAP_CASE_CLOSE` · `CivicReport` · T12 · `case_closed` |
| `AT-STATE-010` | **Given** a duplicate is suspected, **when** the Representative records it, **then** the report is **flagged with a linked reference and never deleted** | `UC-REP-010` · `REP-02` · `API-160` · `CAP_FIELD_VERIFY` · `CivicReport` · A1 · `duplicate_suspected` |
| `AT-STATE-011` | **Given** a staff-official report reaching `COMPLETION_VERIFICATION`, **when** verification completes, **then** the next state has **no actor able to confirm** — **`D-01` Blocker, `TBD`** | `UC-REP-011`,`UC-UCO-018` · `REP-03` · `API-167` · `CAP_COMPLETION_VERIFY` · `CivicReport` · T10 · `completion_verified` |
| `AT-STATE-012` | **Given** an appeal, **when** it is decided, **then** the case remains `REOPENED` and **no `(appeal)` state exists** | `UC-MAY-022` · `MAY-09` · `API-170` · `CAP_APPEAL_DECIDE` · `Dispute` · `appeal_status` · `appeal_decided` |

# 11. Contractor eligibility — `AT-ELIG`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-ELIG-001` | **Given** a contractor failing any of the five checks, **when** the assignment picker renders, **then** they are **not shown** | `UC-UCO-011` · `UCO-03` · eligibility read · `CAP_CASE_ASSIGN` · `ContractorOrganization` · `ACCEPTED` · — |
| `AT-ELIG-002` | **Given** a contractor who became ineligible after the page rendered, **when** assignment is submitted, **then** the **server refuses it** | `UC-UCO-013` · `UCO-03` · `API-163` · `CAP_CASE_ASSIGN` · `ContractorOrganization` · — · — |
| `AT-ELIG-003` | **Given** an organisation suspended after assignment, **when** the contractor accepts, **then** it is **refused despite a valid session** | `UC-CON-014` · `CON-02` · `API-164` · `CAP_WORK_ACCEPT` · `ContractorOrganization` · — · — |
| `AT-ELIG-004` | **Given** an organisation is suspended, **when** any of its accounts authenticates, **then** login is refused — **suspension cascades immediately** | `UC-CON-020`,`UC-MAY-017` · `STF-04` · `API-005` · — · `ContractorOrganization` · →`SUSPENDED` · — |
| `AT-ELIG-005` | **Given** a contractor whose approval window has expired, **when** they attempt completion, **then** it is refused | `UC-CON-020` · `CON-04` · `API-166` · `CAP_WORK_COMPLETE` · `ContractorOrganization` · — · — |

# 12. Privacy — `AT-PRV`

| ID | Given / When / Then | Trace |
|---|---|---|
| **`AT-PRV-001`** | **Given** any contractor response, **when** the **raw payload** is inspected, **then** it contains **no `voice_original` reference, link or signed URL** | `UC-CON-010`,`011` · `CON-02` · `GET /reports/{id}` · organisational scope · `EvidenceObject` · — · `report_viewed` |
| **`AT-PRV-002`** | **Given** any contractor response, **when** inspected, **then** it contains **no `source_asr_text`** | `UC-CON-011` · `CON-02` · report read · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-PRV-003` | **Given** any contractor response, **when** inspected, **then** it contains no citizen mobile number and no `citizen_account_id` | `UC-CON-010` · `CON-02` · report read · — · `CitizenAccount` · — · — |
| `AT-PRV-004` | **Given** any contractor response, **when** inspected, **then** it contains no internal staff notes | `UC-CON-010` · `CON-02` · report read · — · — · — · — |
| `AT-PRV-005` | **Given** a contractor session, **when** the audit narrative is requested, **then** it is denied — `CAP_AUDIT_READ` excludes `CON` | `UC-CON-011` · — · `API-080` · `CAP_AUDIT_READ` · `AuditEvent` · — · — |
| `AT-PRV-006` | **Given** any citizen response, **when** inspected, **then** it contains no `source_asr_text`, no staff notes and no named officer | `UC-CIT-042` · `CIT-15` · `API-151` · ownership · — · — · `report_viewed` |
| `AT-PRV-007` | **Given** a citizen report detail, **when** the timeline is shown, **then** it is **sanitised** and shows no internal state codes | `UC-CIT-042` · `CIT-15` · `API-151` · ownership · `AuditEvent` · — · `report_viewed` |
| `AT-PRV-008` | **Given** any `REP`, `UCO`, `CON` or `MAY` response, **when** inspected, **then** it contains **no citizen phone number in any form — not masked, not partial** | `UC-REP-009`,`UC-UCO-006` · `REP-02`,`UCO-02` · report read · — · `CitizenPhoneCredential` · — · — |
| **`AT-PRV-009`** | **Given** the data model, **when** searched for a citizen name field, **then** **none exists**, and **no response to any role contains one** — **`D-13`** | `UC-REP-009`,`UC-MAY-019` · all · all · — · `CitizenAccount` · — · — |
| `AT-PRV-010` | **Given** `CIT-21`, **when** the number is displayed, **then** it is **masked**, and the full value appears nowhere in the client | `UC-CIT-050` · `CIT-21` · `API-155` · ownership · `CitizenPhoneCredential` · — · — |
| **`AT-PRV-011`** | **Given** `MAY-08`, **when** it renders, **then** **no citizen phone number appears — not masked, not partial, not on hover** | `UC-MAY-020` · `MAY-08` · `API-171` · `CAP_PROTECTED_CONTACT` · `ProtectedContactRequest` · — · `protected_contact_sent` |
| `AT-PRV-012` | **Given** a citizen who withdrew SMS consent, **when** a protected message is sent, **then** it is delivered **in-app only** and no SMS is dispatched | `UC-MAY-021` · `MAY-08` · `API-171` · `CAP_PROTECTED_CONTACT` · `ConsentRecord` · — · `protected_contact_sent` |
| `AT-PRV-013` | **Given** any log, audit event, analytics event, crash report or error object, **when** inspected, **then** it contains **no phone number, OTP, password, token or unrestricted rendering** | all · all · all · — · `AuditEvent` · — · all |
| `AT-PRV-014` | **Given** an evidence `storage_key`, **when** inspected, **then** it contains no phone number, account ID or name | `UC-CIT-016` · `CIT-08` · `API-131` · — · `EvidenceObject` · — · — |

# 13. AI processing — `AT-AI`

| ID | Given / When / Then | Trace |
|---|---|---|
| **`AT-AI-001`** | **Given** AI processing fails, **when** the reporter returns, **then** the draft and original recording are intact and **no `CivicReport` exists** | `UC-CIT-027` · `CIT-09` · `API-133` · — · `VoiceTranscriptionArtifact` · `FAILED` · — |
| **`AT-AI-002`** | **Given** `processing_status = REVIEW_REQUIRED`, **when** report creation is attempted without reporter confirmation, **then** it is **refused** | `UC-CIT-027` · `CIT-09` · `API-140` · `CAP_RENDERING_CONFIRM_OWN` · `VoiceTranscriptionArtifact` · — · — |
| `AT-AI-003` | **Given** any active document or enum, **when** searched for `TRANSCRIPTION_REVIEW_REQUIRED` as a submission path, **then** the only matches are withdrawal records | `UC-CIT-027` · — · — · — · — · — · — |
| `AT-AI-004` | **Given** AI failure, **when** the rendering is inspected, **then** it contains **no model-invented content not derived from the recording** | `UC-CIT-027` · `CIT-09` · — · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-AI-005` | **Given** processing completes, **when** the stored `voice_original` is compared, **then** it is **byte-identical to the capture** — never overwritten | `UC-CIT-024` · `CIT-09` · `API-131` · — · `EvidenceObject` · — · — |
| `AT-AI-006` | **Given** a correction, **when** it is saved, **then** a **new `rendering_version`** is created and the prior version stays reachable | `UC-CIT-029` · `CIT-09` · `API-136` · — · `VoiceTranscriptionArtifact` · — · `rendering_corrected` |
| `AT-AI-007` | **Given** any artefact, **when** inspected, **then** `model_name` and `model_version` are both non-null | `UC-CIT-024` · — · `API-134` · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-AI-008` | **Given** a low-confidence critical field, **when** the rendering is shown, **then** that field is **individually marked** and a targeted question is offered — **the AI does not guess** | `UC-CIT-030` · `CIT-09` · `API-134` · — · `field_confidence_json` · — · — |
| `AT-AI-009` | **Given** any transition, **when** the audit actor is inspected, **then** it is a human or a permitted automatic routing step — **AI never decides** | all · all · all · — · `AuditEvent` · all · all |
| `AT-AI-010` | **Given** any screen or response carrying a rendering, **when** it is shown, **then** it is **labelled AI-generated** until the reporter confirms it | `UC-CIT-028` · `CIT-09`,`CIT-11`,`STF-10` · `API-134` · — · `VoiceTranscriptionArtifact` · — · — |
| **`AT-AI-011`** | **Given** no network, **when** the reporter reaches the recording step, **then** **no screen claims transcription is available**, and no on-device model is invoked | `UC-CIT-025` · `CIT-09` · — · — · — · `WAITING_FOR_CONNECTION` · — |
| `AT-AI-012` | **Given** Release 0, **when** an audio-only official submission is attempted, **then** it is refused | `UC-CIT-027` · — · `API-140`,`API-141` · — · — · — · — |

# 14. Offline behaviour — `AT-OFF`

| ID | Given / When / Then | Trace |
|---|---|---|
| **`AT-OFF-001`** | **Given** no network, **when** an OTP verification is attempted, **then** it fails with a plain connection message and **the code is never stored for later verification** | `UC-CIT-009` · `CIT-05` · `API-122` · — · `OTPChallenge` · — · — |
| **`AT-OFF-002`** | **Given** no network, **when** AI processing is expected, **then** the screen names the connection requirement and **no processing occurs** | `UC-CIT-025` · `CIT-09` · — · — · `ClientSubmission` · `WAITING_FOR_CONNECTION` · — |
| `AT-OFF-003` | **Given** no network, **when** a draft is queued, **then** it shows **"Waiting to send"** and **no report reference** | `UC-CIT-022`,`038` · `CIT-12` · — · — · `ClientSubmission` · `WAITING_FOR_CONNECTION` · — |
| `AT-OFF-004` | **Given** no network, **when** a citizen records voice and captures photos, **then** both succeed and are held app-private | `UC-CIT-018`,`016` · `CIT-08`,`CIT-09` · — · — · `EvidenceObject` · `LOCAL_DRAFT` · — |
| `AT-OFF-005` | **Given** the Django/HTMX staff portal, **when** `STF-10` is used without connectivity, **then** it is **blocked in every respect** — **`D-11` PROPOSED** | `UC-REP-015`,`UC-UCO-025` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · — · — · — |
| `AT-OFF-006` | **Given** no network, **when** staff activation, login, reset, number change or step-up is attempted, **then** each is impossible | `UC-REP-004`…`006` · `STF-01`…`STF-08` · all auth · — · — · — · — |

# 15. Sessions — `AT-SESS`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-SESS-001` | **Given** a signed-in user, **when** they log out, **then** the session is **revoked server-side** — client discard alone does not end it | `UC-CIT-053`,`UC-REP-022` · `CIT-21`,`STF-09` · `API-004` · own session · `AuthSession` · — · `session_revoked` |
| `AT-SESS-002` | **Given** several devices, **when** "sign out everywhere" is used, **then** the whole `RefreshTokenFamily` and every `DeviceSession` are revoked | `UC-CIT-054`,`UC-REP-021` · `CIT-21`,`STF-09` · `API-128` · own · `RefreshTokenFamily` · — · `session_revoked` |
| `AT-SESS-003` | **Given** an expired session, **when** the citizen returns, **then** queued drafts survive and re-authentication is by OTP | `UC-CIT-056` · `CIT-04` · `API-003` · — · `ClientSubmission` · — · — |
| `AT-SESS-004` | **Given** a password reset, **when** it completes, **then** **all existing sessions are revoked** and a suspended account is **not** reactivated | `UC-REP-020`,`UC-MAY-027` · `STF-07` · `API-127` · — · `AuthSession` · — · `password_reset` |
| **`AT-SESS-005`** | **Given** a staff user signed in and mid-action, **when** their account is suspended, **then** **the next action fails**, not the next login | `UC-REP-024`,`UC-MAY-014` · all staff · `API-172` · `CAP_ACCOUNT_ADMIN` · `StaffAccount` · →`SUSPENDED` · `account_suspended` |
| `AT-SESS-006` | **Given** a consumed refresh token, **when** it is replayed, **then** **the whole family is revoked** | `UC-CIT-056` · — · `API-003` · — · `RefreshTokenFamily` · — · `session_revoked` |
| `AT-SESS-007` | **Given** the last account administrator, **when** revocation is attempted, **then** it is refused | `UC-MAY-014` · `MAY-03` · `API-172` · `CAP_ACCOUNT_ADMIN` · `StaffAccount` · — · — |

# 16. Step-up — `AT-STEP`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-STEP-001` | **Given** a login OTP one minute ago, **when** a step-up action is attempted, **then** **no second OTP is demanded** | `UC-REP-019`,`UC-MAY-026` · `STF-05`,`STF-08` · `API-126` · — · `AuthSession` · — · — |
| `AT-STEP-002` | **Given** `recent_auth_at` older than 10 minutes, **when** a sensitive action is attempted, **then** `401 E_STEP_UP_REQUIRED` and `STF-08` **explains why** | `UC-MAY-026` · `STF-08` · `API-126` · — · `AuthSession` · — · `step_up_satisfied` |
| `AT-STEP-003` | **Given** a citizen session, **when** any action is taken, **then** **step-up never applies** — the rule covers the four staff portals only | `UC-CIT-046` · `CIT-18` · `API-153` · ownership · `AuthSession` · — · — |
| `AT-STEP-004` | **Given** confirming one's own rendering, **when** it is submitted, **then** **no step-up is demanded** | `UC-CIT-031` · `CIT-11` · `API-135` · `CAP_RENDERING_CONFIRM_OWN` · `RenderingConfirmation` · — · `rendering_confirmed` |

# 17. Audit — `AT-AUD`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-AUD-001` | **Given** a UC Officer, **when** the audit narrative is read, **then** it is **scope-limited** and read-only | `UC-UCO-024` · `UCO-08` · `API-080` · `CAP_AUDIT_READ` · `AuditEvent` · — · `audit_log_viewed` |
| `AT-AUD-002` | **Given** any actor, service or role — **including the audit service** — **when** an `AuditEvent` update or delete is attempted, **then** it fails | `UC-MAY-019` · `MAY-06` · `API-080` · — · `AuditEvent` · — · — |
| `AT-AUD-003` | **Given** a Mayor/Ops session, **when** hash-chain integrity results are requested, **then** they are **not returned** — `CAP_AUDIT_INTEGRITY_VERIFY` is `SYSADMIN`-only | `UC-MAY-019` · `MAY-06` · `API-080` · `CAP_AUDIT_INTEGRITY_VERIFY` · `AuditEvent` · — · — |
| `AT-AUD-004` | **Given** every state transition, **when** it completes, **then** an audit event exists naming the actor, the acting assignment and the reason | all · all · all · all · `AuditEvent` · all · all |

# 18. Technical System Administrator — `AT-SYS`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-SYS-001` | **Given** the Technical System Administrator, **when** any civic report, evidence, recording, rendering, citizen identity, staff note or audit narrative is requested, **then** access is denied | — · **none** · **none** · `CAP_AUDIT_INTEGRITY_VERIFY` · — · — · — |
| `AT-SYS-002` | **Given** the civic authentication and permission matrices, **when** searched for SYSADMIN, **then** it appears in **neither** as a row or column | — · none · none · — · — · — · — |
| `AT-SYS-003` | **Given** the API contract, **when** searched, **then** **no route authenticates a Technical System Administrator** | — · none · none · — · — · — · — |
| `AT-SYS-004` | **Given** `RoleAssignment`, **when** inspected, **then** **no row names SYSADMIN** | — · none · none · — · `RoleAssignment` · — · — |

# 19. Language and voice — `AT-LANG`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-LANG-001` | **Given** Punjabi speech, **when** it is processed, **then** it is accepted and produces an **Urdu-script** rendering | `UC-CIT-018` · `CIT-09` · `API-131` · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-LANG-002` | **Given** `CIT-01`, **when** it renders, **then** exactly **two** written-interface options appear and **neither is Punjabi** | `UC-CIT-002` · `CIT-01` · — · — · `CitizenAccount` · — · — |
| `AT-LANG-003` | **Given** any active document, **when** searched, **then** **no text describes Roman Urdu as a spoken language** | `UC-CIT-018` · — · — · — · — · — · — |
| `AT-LANG-004` | **Given** an English interface, **when** the civic rendering is produced, **then** it is **still Urdu script** | `UC-CIT-024` · `CIT-11` · `API-134` · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-LANG-005` | **Given** `preferred_language`, **when** a value other than `ur` or `en` is set, **then** it is rejected | `UC-CIT-049` · `CIT-21` · `API-155` · ownership · `CitizenAccount` · — · `profile_updated` |
| `AT-LANG-006` | **Given** an Urdu interface, **when** a phone number, OTP or report reference is displayed, **then** its digits render **LTR** inside RTL text | `UC-CIT-002`,`058` · all citizen · — · — · — · — · — |
| `AT-LANG-007` | **Given** an English→Urdu transformation, **when** it is described, **then** it is called **translation and normalisation**, not word-for-word transcription | `UC-CIT-024` · — · — · — · `VoiceTranscriptionArtifact` · — · — |

# 20. Technology and terminology hygiene — `AT-TECH`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-TECH-001` | **Given** any active citizen-application document, **when** searched, **then** **no instruction to use Flutter exists** | — · — · — · — · — · — · — |
| `AT-TECH-002` | **Given** any active document, **when** searched for anonymous reporting, tracking tokens, submission recovery codes or identity-free access, **then** the only matches are superseded records | — · — · — · — · — · — · — |
| `AT-TECH-003` | **Given** the portal set, **when** counted, **then** there are exactly **five civic portals**, and no Moderator or standalone Administrator portal exists | all · all · — · — · — · — · — |
| `AT-TECH-004` | **Given** the staff portals, **when** their stack is inspected, **then** they are **Django Templates + HTMX + Alpine.js**, not React Native | — · all staff · — · — · — · — · — |
| `AT-TECH-005` | **Given** any active document, **when** searched for `CAP_VOICE_CONFIRM` or `official_identifier`, **then** the only matches are withdrawal or rename records | — · — · — · `CAP_RENDERING_CONFIRM_OWN` · `StaffAccount` · — · — |
| `AT-TECH-006` | **Given** the shared staff reporting function, **when** counted, **then** there is **exactly one `STF-10`**, not four role-specific reporting screens | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · — · — · — |
| `AT-TECH-007` | **Given** the screen inventory, **when** `REP-05` is resolved, **then** **no route or screen exists for it** | `UC-REP-015` · — · — · — · — · — · — |

# 21. Official staff reporting — `AT-OFF`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-OFF-001` | **Given** any of the four staff roles holding `CAP_REPORT_OFFICIAL`, **when** they open the official-report function, **then** `STF-10` is reachable | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · `CivicReport` · →`SUBMITTED` · `report_submitted` |
| `AT-OFF-002` | **Given** a staff account **without** `CAP_REPORT_OFFICIAL`, **when** `STF-10` is requested, **then** it is denied | `UC-REP-015` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · — · — · — |
| `AT-OFF-003` | **Given** a service account or automated integration, **when** official reporting is attempted, **then** it is refused | `UC-UCO-025` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · — · — · — |
| `AT-OFF-004` | **Given** a staff-official submission, **when** it completes, **then** **exactly one acting `RoleAssignment` is recorded** and a `ConflictExclusion` is written in the same transaction | `UC-REP-016` · `STF-10` · `API-141` · `CAP_REPORT_OFFICIAL` · `ConflictExclusion` · →`SUBMITTED` · `report_submitted` |
| `AT-OFF-005` | **Given** a staff reporter, **when** they seek their own report after submission, **then** **no approved staff screen shows it** — **`D-02` Blocker, `TBD`** | `UC-REP-017` · **`STF-11` PROPOSED** · — · — · `CivicReport` · — · — |

# 22. Evidence — `AT-EVID`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-EVID-001` | **Given** **branch A**, **when** submission is attempted with no photo, **then** `422 E_EVIDENCE_REQUIRED` — **`D-14` `TBD`** | `UC-CIT-016`,`037` · `CIT-08`,`CIT-11` · `API-140` · — · `EvidenceObject` · — · — |
| `AT-EVID-002` | **Given** **branch B** and an approved category, **when** the photo is skipped, **then** submission succeeds | `UC-CIT-016` · `CIT-08` · `API-140` · — · `EvidenceObject` · — · — |
| `AT-EVID-003` | **Given** **branch B** and an unapproved category, **when** the photo is skipped, **then** submission is refused | `UC-CIT-016` · `CIT-08` · `API-140` · — · `EvidenceObject` · — · — |
| `AT-EVID-004` | **Given** a chunk whose recomputed hash differs, **when** upload completes, **then** `422 E_CAPTURE_INTEGRITY` and the chunk must be retried | `UC-CIT-023` · `CIT-09` · `API-131` · — · `EvidenceObject` · — · — |
| `AT-EVID-005` | **Given** a client-declared manifest hash, **when** completion is called, **then** **the server recomputes it and never trusts the declaration as proof** | `UC-CIT-023` · `CIT-09` · `API-132` · — · `EvidenceObject` · — · `evidence_committed` |

# 23. Accessibility — `AT-A11Y`

| ID | Given / When / Then | Trace |
|---|---|---|
| `AT-A11Y-001` | **Given** any citizen screen, **when** measured, **then** touch targets are ≥48dp and contrast meets WCAG 2.1 AA | `UC-CIT-058` · all citizen · — · — · — · — · — |
| `AT-A11Y-002` | **Given** any status indicator, **when** rendered, **then** it carries **text and an icon** — colour is never the sole carrier | `UC-CIT-041`,`058` · `CIT-14` · — · — · — · — · — |
| `AT-A11Y-003` | **Given** any screen at 200% text scale, **when** used, **then** no function is lost | `UC-CIT-058` · all citizen · — · — · — · — · — |
| `AT-A11Y-004` | **Given** a queued draft, **when** announced, **then** the screen reader says **"not yet sent"** | `UC-CIT-038` · `CIT-12` · — · — · `ClientSubmission` · — · — |
| `AT-A11Y-005` | **Given** any AI-produced text, **when** announced, **then** the screen reader identifies it as **AI-generated** | `UC-CIT-028` · `CIT-09`,`CIT-11` · — · — · `VoiceTranscriptionArtifact` · — · — |
| `AT-A11Y-006` | **Given** any loading state, **when** shown, **then** it **names what is happening** — no blank spinner | `UC-CIT-025` · `CIT-09` · — · — · — · pipeline · — |

# 24. Per-portal placeholders traced in the matrix

The traceability matrix names additional per-portal tests — `AT-CIT-001`…`058`, `AT-REP-007`…`017`, `AT-UCO-009`…`020`, `AT-CON-001`…`021`, `AT-MAY-001`…`016`. Each asserts the **main success flow** of the use case it is named against, with the same trace columns. **They are enumerated in `07_USE_CASE_TRACEABILITY_MATRIX.md` §1 and are not restated here to avoid two lists drifting apart.**

---

## Coverage against the mandated test list

| Mandated | Covered by |
|---|---|
| Every main success flow | `AT-<PORTAL>-NNN` per matrix §1 |
| Every permission denial | `AT-PERM-001`…`009` |
| Every scope denial | `AT-SCOPE-001`…`006` |
| Every invalid state transition | `AT-STATE-008`, `AT-PIPE-003`, `AT-PIPE-005`, `AT-CONF-001` |
| Wrong / expired / replayed / rate-limited OTP | `AT-OTP-001`…`008` |
| Expired or consumed invitation | `AT-INV-002`, `AT-INV-004` |
| Staff public-signup attempt | `AT-AUTH-008` |
| Administrator setting another's password | `AT-AUTH-006`, `AT-AUTH-007` |
| Account without an active `RoleAssignment` | `AT-ROLE-001` |
| Multiple assignments and switching | `AT-ROLE-002`, `AT-ROLE-003` |
| Capability-union attempt | `AT-ROLE-003` |
| Citizen viewing another's report | `AT-SCOPE-001` |
| Contractor accessing identity or audio | `AT-PRV-001`, `AT-PRV-002`, `AT-PRV-003` |
| Contractor closing a case | `AT-PERM-008` |
| Reporter verifying or closing their own report | `AT-CONF-009`, `AT-CONF-010` |
| Mayor/Ops ordinary closure | `AT-PERM-001` |
| Offline OTP attempt | `AT-OFF-001` |
| Offline AI attempt | `AT-OFF-002`, `AT-AI-011` |
| Queued draft receiving a reference | `AT-PIPE-001` |
| Submission without exact confirmation | `AT-CONF-001` |
| Stale rendering confirmation | `AT-CONF-005`, `AT-CONF-006` |
| Duplicate submission | `AT-IDEM-002`, `AT-IDEM-003` |
| AI-processing failure | `AT-AI-001`…`004` |
| Suspended account with an existing session | `AT-SESS-005` |
| Organisation suspended after assignment | `AT-ELIG-003` |
| Conflict across role switching | `AT-CONF-009`, `AT-CONF-010` |

**All 26 mandated categories covered.**

---

## Tests that document an unresolved decision rather than an expected behaviour

| Test | Decision | Why it is listed anyway |
|---|---|---|
| `AT-ROLE-006` | **D-04** | The contradiction is real and must not vanish because it is inconvenient |
| `AT-STATE-011` | **D-01** | A staff-official report will stall; the test records where |
| `AT-CONF-011` | **D-06** | Organisation-level self-dealing is currently unprevented |
| `AT-IDEM-005` | **D-12** | Two keys are recommended, not approved |
| `AT-OFF-005` | **D-11** | The offline claim contradicts the stack |
| `AT-OFF-002` / `AT-AI-011` | **D-10** | No encryption mechanism is named |
| `AT-OFF-001`…`003` in branch A/B | **D-14** | Both photo branches are written; neither is final |
| `AT-PRV-009` | **D-13** | The privacy matrix grants a field the data model does not have |
| `AT-OFF-005` | **D-02**/**D-03** | No approved staff screen shows a staff user their own reports |

**These are not failures. They are the register made testable.**

---

*Specified; not implemented; not executed. No test in this document exists as code, and none has been run.*
