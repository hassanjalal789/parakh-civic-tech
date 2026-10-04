# Parakh — RBAC and Scope Matrix

| Field | Value |
|---|---|
| **Version** | **1.4** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Authority** | **Mobile SRS v2.1.0** *(written 13 Sep 2026 — now exists and governs the mobile client)* · **CR-61 rev 1.3** *(identity foundation)* · **`PARAKH-IRP v1.0`** *(14 Sep 2026)* · **Hassan Jalal's reconciliation instruction of 3 October 2026** |
| **Supersedes** | v1.2 (2 Sep 2026) · v1.1 · v1.0 · the four-actor matrix in `AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` v1.2 §9 |

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1.0 | 31 Aug 2026 | Initial five-portal matrix |
| 1.1 | 1 Sep 2026 | Uniform staff auth; closure, invitation and audit contradictions corrected; masked-number contact replaced; step-up defined |
| 1.2 | 2 Sep 2026 | Factor terminology corrected; Technical System Administrator removed from the civic authentication matrix; `ACCEPTED` and `CLOSED` added; appeal pseudo-transition removed; `✗ — masked form only` removed; step-up timing corrected |
| **1.3** | **2 Sep 2026** | **`CAP_VOICE_CONFIRM` replaced by `CAP_RENDERING_CONFIRM_OWN`** — citizens confirm their own citizen draft, authorised staff reporters confirm their own official draft, nobody confirms for another person. **Official reporting moved to shared `STF-10`.** **Contractor access to original citizen audio and to the intermediate ASR output removed.** **`DRAFT` removed from `CivicReport.state`** — 12 canonical states, 15 enum values; a CivicReport is created atomically at `SUBMITTED`. **Reporter-confirmation binding rules added.** **Retention wording corrected.** Status line standardised to `Specified; not implemented; not tested` |

| **1.4** | **3 Oct 2026** | **Reconciled against Mobile SRS v2.1.0.** **`CAP_REPORT_VIEW_OWN` added** and screen **`STF-11 — My Official Reports`** approved, closing `RC-18`/`D-02`/`D-03` — a staff official reporter can read and confirm **their own** report while remaining conflict-excluded from every reviewing action. **Evidence policy resolved (`DR-28`)** — a photo is **encouraged but optional**; missing visual evidence is **visible to the reviewer**, who may request more. **No mentor, supervisor or institutional approval is required to develop the prototype (`DR-33`).** |

> **Reconciliation, 3 October 2026.** The authority line above previously pointed at *"SRS v2.0.0 — not yet written"*. **That placeholder is now closed: Mobile SRS v2.0.0 and v2.1.0 exist.** This revision reconciles this document against them and against the Project Lead's instruction of 3 October 2026. **Recovered requirements and decisions made now are labelled separately in every section they touch.**

> **Scope.** This is a documentation-finalisation revision. **No use case, click-by-click journey or portal tutorial is created here.** Behavioural detail belonging to a portal use case is marked `DEFERRED — define during the portal use-case phase`.

---

## 1. The five civic portals — and what is not a portal

| # | Portal | Code | Signup | Provisioned by | Identifier | Factors |
|---|---|---|---|---|---|---|
| 1 | **Citizen** | `CIT` | **Self-service** | Self, on first OTP verification | Mobile number | **One factor: SMS OTP (possession)** |
| 2 | **Street Representative** | `REP` | **Never public** | **UC Officer**, within own scope | Official mobile number | **Two factors: password (knowledge) + SMS OTP (possession)** |
| 3 | **UC Officer** | `UCO` | **Never public** | **Mayor & Ops** with `CAP_ACCOUNT_ADMIN` | Official mobile number | **Two factors** |
| 4 | **Contractor** | `CON` | **Never public** | **Mayor & Ops** with `CAP_ACCOUNT_ADMIN`, after organisation approval | Official mobile number | **Two factors** |
| 5 | **Mayor & Operations** | `MAY` | **Never public** | Bootstrapped once, then invited by a Mayor/Ops Account Administrator | Official mobile number | **Two factors** |

> **The mobile number is an account identifier, not an authentication factor.** It names the account; it is not secret. **Staff login is two-factor authentication — password and SMS OTP. It is not three-factor.** **Citizen login is single-factor using a possession factor; it is not two-factor.**

> **All four staff portals authenticate identically** through **one** central authentication service. Authorisation is evaluated **after** authentication. **TOTP, passkeys, WebAuthn and hardware keys are excluded from Release 0.** Device biometric unlock is a future optional **local** convenience only.

**Public staff signup is impossible.** Every staff account is created or invited through the chain in §12.

### 1.1 Technical System Administrator — outside this matrix

> **Out-of-band infrastructure authentication controlled by the deployment environment — not specified as part of the civic application login.**

**`SYSADMIN` is not a sixth civic portal.** It **has no civic role assignment**. It **cannot** view reports, evidence, citizen identity, voice recordings, transcripts, staff notes or civic audit narrative. It **may** perform deployment, backup, configuration and cryptographic integrity verification **only**.

**It has no row in the authentication matrix (§4) and no column in the permission matrix (§3).**

## 2. Capabilities — authority is granted, never implied

**Deny by default.** **Case-management authority never implies account-administration authority.**

| Capability | Held by | Never held by | Step-up |
|---|---|---|:--:|
| `CAP_REPORT_SUBMIT` | `CIT`; staff via `CAP_REPORT_OFFICIAL` | — | — |
| `CAP_REPORT_OWN_VIEW` | `CIT` — **own reports only** | Any other role | — |
| **`CAP_RENDERING_CONFIRM_OWN`** | **`CIT`** — own citizen draft · **authorised staff reporter** — own official draft | **Everyone acting on another person's draft.** No moderator, reviewer, administrator, Mayor/Ops user or Technical System Administrator may ever hold a confirm-on-behalf right | — |
| `CAP_REPORT_OFFICIAL` | Explicitly granted staff in **any** of the four civic staff roles. **Service accounts excluded** | Automated integrations; citizens | — |
| `CAP_FIELD_VERIFY` | `REP` | `CON`, `CIT` | — |
| `CAP_COMPLETION_VERIFY` | `REP` — **conflict-free only** | `CON`, the completing party | — |
| `CAP_CASE_TRIAGE` | `UCO` | `REP`, `CON`, `CIT` | — |
| `CAP_CASE_ACCEPT` | **`UCO`** — produces **`ACCEPTED`** | `REP`, `CON`, `MAY` | — |
| `CAP_CASE_REJECT` | `UCO` | `REP`, `CON`, **`MAY`** | **✓** |
| `CAP_CASE_CLARIFY` | `UCO`, `REP` | `CON` | — |
| `CAP_CASE_ASSIGN` | `UCO` — eligible contractors in scope only | `REP`, `CON`, **`MAY`** | **✓** |
| `CAP_CASE_CLOSE` | **`UCO` only** — produces **`CLOSED`** | **`REP`, `CON`, `CIT`, `MAY`** | **✓** |
| `CAP_WORK_ACCEPT` · `CAP_WORK_PROGRESS` · `CAP_WORK_COMPLETE` | `CON` | `REP`, `UCO`, `CIT` | — |
| `CAP_REP_INVITE` | **`UCO` only — own scope** | `REP`, `CON`, and `MAY` in routine operation | **✓** |
| `CAP_ACCOUNT_ADMIN` | `MAY` — **explicitly granted** | `UCO` unless separately granted | **✓** |
| `CAP_ROLE_ASSIGN` | `MAY` with `CAP_ACCOUNT_ADMIN` | All others | **✓** |
| `CAP_AUDIT_READ` *(civic)* | `MAY`; `UCO` **scope-limited** | `REP`, `CON`, `CIT`, **`SYSADMIN`** | ✓ |
| `CAP_AUDIT_INTEGRITY_VERIFY` *(technical)* | **`SYSADMIN` only** | **Every civic role** | ✓ |
| `CAP_APPEAL_DECIDE` | `MAY` — **not a prior actor on that case** | `UCO` who handled the dispute | ✓ |
| `CAP_CASE_REOPEN` | `UCO`, `MAY` | `REP`, `CON` | ✓ |
| `CAP_ESCALATION` | `REP`, `UCO`, `MAY` | `CON`, `CIT` | — |
| `CAP_EXCEPTIONAL_INTERVENTION` | `MAY` — **separately audited** | All others | **✓** |
| `CAP_PROTECTED_CONTACT` | `MAY` — **system-mediated message only** | All others | **✓** |
| `CAP_TRANSCRIPT_REVIEW` | `UCO`, `MAY` — authorised human review of a flagged rendering. **Produces a new rendering version; never a confirmation** | `CON`, `CIT` | — |
| `CAP_EXPORT` | `MAY` | All others | **✓** |
| `CAP_SAFEGUARDING` | `MAY` | All others | ✓ |

**Withdrawn capabilities:** `CAP_IDENTITY_VIEW_MASKED` *(rev 1.2 — protected contact replaces the need to display any citizen number)* · **`CAP_VOICE_CONFIRM`** *(rev 1.3 — replaced by `CAP_RENDERING_CONFIRM_OWN`, which is subject-type aware)*.

### 2.1 `CAP_RENDERING_CONFIRM_OWN` — the rule stated exactly

| Holder | May confirm | May **never** confirm |
|---|---|---|
| **Citizen** | Their **own citizen draft** | Any staff draft; any other citizen's draft |
| **Authorised staff reporter** *(holds `CAP_REPORT_OFFICIAL`)* | Their **own staff-official draft** | Any citizen's draft; **any other staff user's draft** |
| `CAP_TRANSCRIPT_REVIEW` holder | **Nothing.** A reviewer may produce or correct a rendering version; **the original reporter must still confirm it** | — |

**Confirmation is never delegable, never proxied and never administratively overridden.**

### 2.2 Corrections carried forward

| # | Was | **Now** |
|---|---|---|
| C1 | `CAP_CASE_CLOSE` for `UCO`, but matrix let **`MAY`** close too | **Ordinary closure is `UCO` only.** `MAY` may reopen, escalate, or use `CAP_EXCEPTIONAL_INTERVENTION` — **never recorded as an ordinary closure** |
| C2 | `CAP_REP_INVITE` for `UCO`, but matrix let **`MAY`** invite too | **`UCO` only, own scope.** Emergency replacement is exceptional and audited |
| C3 | `SYSADMIN` had `✓` on audit read while declared non-civic | **Split** into `CAP_AUDIT_READ` and `CAP_AUDIT_INTEGRITY_VERIFY` |
| C4 | "Contact a citizen" while showing a masked number | **`CAP_PROTECTED_CONTACT`** — system-mediated; no number rendered |
| **C5** | **`CAP_REPORT_OFFICIAL` for all staff, but confirmation citizen-only and one screen under `REP`** | **Shared `STF-10`** for all four staff roles; **`CAP_RENDERING_CONFIRM_OWN`** covers both subject types |
| **C6** | **Contractor could play the original citizen recording** | **Contractor receives no original audio and no ASR output** |

## 3. Permission matrix

**A blank cell is a denial.** `own` = the authenticated subject's own record. `scope` = within the actor's assigned geographic or organisational scope.

| # | Action | CIT | REP | UCO | CON | MAY | Scope | Required state | Conflict rule | Step-up | Audit event |
|---|---|:--:|:--:|:--:|:--:|:--:|---|---|---|:--:|---|
| 1 | Submit report | ✓ | ✓† | ✓† | ✓† | ✓† | — | draft `READY_TO_SUBMIT` | † staff use `CAP_REPORT_OFFICIAL` on **`STF-10`**; **account recorded** | — | `report_submitted` |
| 2 | **Confirm own rendering version** | **own** | **own†** | **own†** | **own†** | **own†** | own draft | `AWAITING_REPORTER_REVIEW` | † official draft only. **Never another person's draft** | — | `rendering_confirmed` |
| 3 | View report | **own** | scope | scope | **assigned only** | scope | geo/org | any | — | — | `report_viewed` |
| 4 | **Citizen mobile number returned in response** | **own, masked** | **no** | **no** | **no** | **no** | — | — | — | — | — |
| 5 | **Send protected message to citizen** | — | — | — | — | ✓ | scope | any | — | **✓** | `protected_contact_sent` |
| 6 | **Play original voice recording** | **own** | **scope — verification only** | **scope — verification only** | **no** | **authorised, scope-limited** | geo | any | — | — | `audio_played` |
| 7 | View Urdu civic rendering | **own** | scope | scope | **assigned only** | scope | geo/org | any | — | — | `rendering_viewed` |
| 8 | **Read intermediate ASR output** | **no** | scope | scope | **no** | scope | geo | flagged or verification | — | — | `asr_output_viewed` |
| 9 | **Authorised human transcript review** | — | — | ✓ | — | ✓ | scope | flagged | **Produces a new version; the reporter still confirms** | — | `transcript_reviewed` |
| 10 | Field verification | — | ✓ | — | — | — | assigned UC | `UNDER_VERIFICATION` | **not the reporter account** | — | `field_verified` |
| 11 | **Accept report** | — | — | **✓** | — | — | scope | `UC_REVIEW` | **not the reporter account** | — | `case_accepted` |
| 12 | Reject with reason | — | — | ✓ | — | **no** | scope | `UC_REVIEW` | same | **✓** | `case_rejected` |
| 13 | Request clarification | — | ✓ | ✓ | — | — | scope | pre-close | same | — | `clarification_requested` |
| 14 | Assign contractor | — | — | ✓ | — | **no** | scope | **`ACCEPTED`** | **approved + active + category + area** | **✓** | `contractor_assigned` |
| 15 | Accept / decline work | — | — | — | ✓ | — | own org | `CONTRACTOR_ASSIGNED` | must be active at the point of action | — | `work_accepted` / `work_declined` |
| 16 | Update progress | — | — | — | ✓ | — | own org | `IN_PROGRESS` | — | — | `progress_updated` |
| 17 | Submit completion evidence | — | — | — | ✓ | — | own org | `IN_PROGRESS` | — | — | `completion_submitted` |
| 18 | Verify completion | — | ✓ | — | **no** | — | assigned UC | `COMPLETION_VERIFICATION` | **not the completer, not the reporter** | — | `completion_verified` / `completion_rejected` |
| 19 | Confirm resolution | **own** | — | — | — | — | own report | `PENDING_CITIZEN_CONFIRMATION` | reporter ≠ completer | — | `resolution_confirmed` |
| 20 | Dispute resolution | **own** | — | — | — | — | own report | `PENDING_CITIZEN_CONFIRMATION` | same | — | `resolution_disputed` |
| 21 | **Ordinary closure** | — | — | **✓** | — | **no** | scope | `RESOLVED_CONFIRMED` or eligible | **not the reporter account** | **✓** | `case_closed` |
| 22 | Reopen case | — | — | ✓ | — | ✓ | scope | closed / disputed | same | ✓ | `case_reopened` |
| 23 | **Exceptional intervention** | — | — | — | — | **✓** | scope | any | **not a prior actor** | **✓** | `exceptional_intervention` |
| 24 | Handle citizen dispute | — | — | ✓ | — | — | scope | `REOPENED` | not the reporter account | ✓ | `dispute_handled` |
| 25 | **Decide formal appeal** | — | — | **no** | — | ✓ | scope | `Dispute.appeal_status = FILED` or `UNDER_REVIEW` | **not a prior actor on that case** | ✓ | `appeal_decided` |
| 26 | Escalate | — | ✓ | ✓ | — | ✓ | scope | any | — | — | `case_escalated` |
| 27 | Invite Street Representative | — | — | **✓** | — | **no** *(exceptional only, row 23)* | **own scope only** | — | cannot exceed own scope | **✓** | `rep_invited` |
| 28 | Provision UC Officer | — | — | **no** | — | ✓ | district | — | requires `CAP_ACCOUNT_ADMIN` | **✓** | `officer_provisioned` |
| 29 | Provision Contractor | — | — | **no** | — | ✓ | district | — | requires `CAP_ACCOUNT_ADMIN` + approved organisation | **✓** | `contractor_provisioned` |
| 30 | Approve / suspend contractor organisation | — | — | **no** | — | ✓ | district | — | requires `CAP_ACCOUNT_ADMIN` | **✓** | `organisation_approved` |
| 31 | Assign / change role & scope | — | — | — | — | ✓ | **never above own** | — | assigner ≠ approver where two-person applies | **✓** | `role_assigned` |
| 32 | Suspend / revoke account | — | — | — | — | ✓ | scope | — | cannot revoke the last account admin | **✓** | `account_suspended` |
| 33 | **Read civic audit narrative** | — | **no** | scope | **no** | ✓ | scope | — | read-only for all | ✓ | `audit_log_viewed` |
| 34 | Export data | — | — | — | — | ✓ | scope | — | de-identification checklist | **✓** | `export_generated` |

> **Row 4 states a fact, not a permission.** A field is either returned or it is not. **No operational role receives a citizen phone number in any response, masked or otherwise.** The citizen sees their **own** number masked in Profile & Settings. **The authentication and notification services access the encrypted number only to perform an authorised system operation, and never render it to a person.**

> **Rows 6 and 8 changed at rev 1.3.** The contractor's `assigned only` access to the original recording is **removed**, and the intermediate ASR output was never contractor-visible. Representative and UC Officer audio access is **scope-limited and only where required for verification**; Mayor & Ops access is **authorised, scope-limited and audited**.

**`SYSADMIN` has no column in this matrix**, by design — it holds no civic permission.

**Five properties this matrix guarantees:**

1. **No actor both does work and approves it** — rows 17 and 18 never overlap for one account.
2. **No actor widens its own authority** — rows 27–32 are downward-only and scope-bounded.
3. **No operational role ever receives a citizen phone number** — row 4.
4. **No external commercial party hears a citizen's voice** — row 6.
5. **Technical and civic authority never merge** — `SYSADMIN` is absent from every civic row.

## 4. Authentication matrix — the four civic staff portals and the citizen

| | Citizen | Street Rep | UC Officer | Contractor | Mayor & Ops |
|---|---|---|---|---|---|
| **Account identifier** | Mobile number | Official mobile number | Official mobile number | Official mobile number | Official mobile number |
| **Knowledge factor** | **None — no password in Release 0** | User-created password | User-created password | User-created password | User-created password |
| **Possession factor** | **Six-digit SMS OTP** | **Six-digit SMS OTP** | **Six-digit SMS OTP** | **Six-digit SMS OTP** | **Six-digit SMS OTP** |
| **Factor count** | **One (possession)** | **Two** | **Two** | **Two** | **Two** |
| Password set by | n/a | **The account owner. Never an administrator** | Same | Same | Same |
| Account created by | **Self** | UC Officer | Mayor/Ops | Mayor/Ops | Bootstrapped, then Mayor/Ops |
| Activation | Automatic on first OTP | Invitation → OTP → password | Same | Same | Same |
| **Privileges only when** | Account `ACTIVE` | **Account `ACTIVE` *and* an active `RoleAssignment` exists** | Same | Same | Same |
| Cannot authenticate when | Deactivated | **Suspended, revoked or expired** | Same | Same | Same |
| Step-up | **Not applicable** | Fresh SMS OTP, 10-min window | Same | Same | Same |
| Offline | **No OTP operation works offline** | Same | Same | Same | Same |

**Technical System Administrator is deliberately absent** — see §1.1.

**Login identifier note.** The staff login identifier is the **official mobile number**, held only in the protected `StaffCredential` design. **`StaffAccount.staff_reference`** *(renamed from `official_identifier` at rev 1.3)* is an optional administrative or employee reference and **is not used for login**.

## 5. Step-up authentication

**One step-up rule for the four civic staff portals.** *Citizens and the Technical System Administrator are not covered.*

```text
recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)
```

| Aspect | Rule |
|---|---|
| Method | **Fresh six-digit SMS OTP** |
| Window | **10 minutes** from `recent_auth_at` |
| Inside the window | **Do not ask again** — the login OTP already satisfies it |
| Outside | Require a fresh OTP; update `step_up_satisfied_at` on success |
| Audit | Recorded. **The OTP and the phone number never appear in audit text** |
| Offline | **Impossible** |

**Required for rows:** 5, 12, 14, 21, 22, 23, 27, 28, 29, 30, 31, 32, 34 *(and 25, 33 where policy requires)*.
**Not required for:** routine queue viewing, ordinary progress viewing, non-sensitive navigation, **and rendering confirmation of one's own draft**.

## 6. Scope model

All six dimensions must pass. Failing one is a denial.

| Dimension | Question |
|---|---|
| **Role** | Does the acting role hold the capability? |
| **Geographic scope** | Is the report inside the assignment's district / tehsil / UC / ward? |
| **Organisational scope** | For `CON`, is the report assigned to that contractor organisation? |
| **Ownership** | For `CIT`, and for `CAP_RENDERING_CONFIRM_OWN`, does the record belong to the authenticated subject? |
| **Workflow state** | Is the report or draft in a state where this action is permitted? |
| **Conflict** | Is the acting **account** excluded from this record? |

**Hierarchy:** `city` ⊃ `district` ⊃ `tehsil` ⊃ `union_council` ⊃ `ward`. **No actor may grant a scope broader than its own, or a role more privileged than its own.**

## 7. Multi-role staff architecture and acting-role enforcement

**One `StaffAccount` holds zero, one or many `RoleAssignment`s.** After authentication **exactly one** is selected as the acting role.

Every privileged request carries **`X-Acting-Role-Assignment-ID: <uuid>`** — a **claim, never a grant**. Six checks, in order, denying on the first failure:

1. The assignment **belongs to the authenticated account**
2. It is **active and unexpired**, evaluated at the point of action
3. The **role is authorised for this endpoint**
4. Its **scope covers the requested record**
5. **No conflict rule blocks the action** — at **account** level
6. **OTP / step-up requirements are satisfied** per §5

**Permissions are never unioned across assignments.** **Role switching is explicit.** **A role assignment expiring mid-session downgrades the session on the next action.** **Account-level conflict exclusions apply regardless of the currently selected role.**

`DEFERRED — define during the portal use-case phase`: the role-switching interaction and its screen behaviour.

## 8. Conflict of interest — account level

> A staff **account** that submitted an official report is excluded from **verifying, accepting, assigning, approving evidence, approving completion, resolving, closing, or deciding a dispute or appeal** on that record — **under every role assignment it holds, present or future**.

**The scenario this closes.** *"A UC Officer who submits an official report remains excluded from verifying, accepting, assigning, approving, closing or deciding a dispute on that report — even after switching to a Street Representative or Mayor/Ops assignment."* **Role-level checking would permit that.** Account-level checking denies it.

**Implementation:** `CivicReport.official_reporter_account_id` compared against the acting **account**, never the assignment. Recorded as `ConflictExclusion`, retained permanently.

**When no eligible actor remains:** escalate one level; if still none, **flag unresolvable and hold**. **Never auto-approved, never routed back to the conflicted account.**

## 9. Canonical incident state machine — twelve states

**`CivicReport` is the single record throughout.** No separate case entity is created; after acceptance it is **described** to users as an accepted case.

### 9.1 The creation rule — `DRAFT` removed

**`DRAFT` is no longer a `CivicReport` state.** Draft and AI-processing states belong to `ClientSubmission`.

```text
ClientSubmission.READY_TO_SUBMIT
        │
        └──▶  atomic server transaction
                 ├─ create CivicReport(state = SUBMITTED)
                 ├─ issue the human-readable, non-sequential report_reference
                 ├─ bind confirmed_rendering_artifact_id + rendering_version
                 ├─ record ReportOwnership
                 └─ append the audit event
```

**Preconditions, all four required:** the Urdu rendering exists · **the reporter has confirmed the current active rendering version** · required evidence validation has passed · the backend accepts the submission.

**A queued draft has no `CivicReport` and no official report reference.** **The first state of a `CivicReport` is `SUBMITTED`.**

### 9.2 Transitions

| # | From | To | Actor | Authorization | Conflict | Reason | Evidence | Notification | Audit event |
|---|---|---|---|---|---|---|---|---|---|
| **T1** | *(none)* | **`SUBMITTED`** | Reporter | `CAP_REPORT_SUBMIT` **+ `CAP_RENDERING_CONFIRM_OWN` satisfied** | Staff reporter recorded and excluded | — | Per evidence policy | In-app + optional SMS | `report_submitted` |
| T2 | `SUBMITTED` | `UNDER_VERIFICATION` | **System** | Automatic routing | — | — | — | Rep queue | `report_routed` |
| T3 | `UNDER_VERIFICATION` | `VERIFIED` | Street Rep | `CAP_FIELD_VERIFY` | **Not the reporter account** | Required | Field evidence | UC queue | `field_verified` |
| T4 | `VERIFIED` | `UC_REVIEW` | **System** | Automatic | — | — | — | Officer queue | `case_queued_for_review` |
| T5 | `UC_REVIEW` | **`ACCEPTED`** | UC Officer | `CAP_CASE_ACCEPT` | **Not the reporter account** | Optional note | — | Citizen | `case_accepted` |
| T6 | `ACCEPTED` | `CONTRACTOR_ASSIGNED` | UC Officer | `CAP_CASE_ASSIGN` + step-up | Not the reporter | Assignment note | — | Contractor + citizen | `contractor_assigned` |
| T7 | `CONTRACTOR_ASSIGNED` | `IN_PROGRESS` | Contractor | `CAP_WORK_ACCEPT` | Must be active | — | — | UC Officer + citizen | `work_accepted` |
| T8 | `IN_PROGRESS` | `COMPLETION_SUBMITTED` | Contractor | `CAP_WORK_COMPLETE` | — | Completion note | **Required** | UC Officer | `completion_submitted` |
| T9 | `COMPLETION_SUBMITTED` | `COMPLETION_VERIFICATION` | **System** | Automatic | Selects a **conflict-free** Rep | — | — | Rep queue | `completion_routed` |
| T10 | `COMPLETION_VERIFICATION` | `PENDING_CITIZEN_CONFIRMATION` | Street Rep | `CAP_COMPLETION_VERIFY` | **Not the completer, not the reporter** | Required | Verification evidence | **Citizen** | `completion_verified` |
| T11 | `PENDING_CITIZEN_CONFIRMATION` | `RESOLVED_CONFIRMED` | Citizen | Ownership | Reporter ≠ completer | — | — | UC Officer | `resolution_confirmed` |
| T12 | `RESOLVED_CONFIRMED` | **`CLOSED`** | **UC Officer** | `CAP_CASE_CLOSE` + step-up | **Not the reporter account** | **Mandatory closure reason or checklist** | — | Citizen | `case_closed` |

**All transitions are guarded by `state_version` and are idempotent under retry.**

`DEFERRED — define during the portal use-case phase`: who performs T11 when the reporter was a staff official rather than a citizen.

### 9.3 Alternative and exception transitions

| From | To | Actor | Trigger | Reason | Audit |
|---|---|---|---|---|---|
| `UNDER_VERIFICATION` | `UC_REVIEW` | Street Rep | Field verification unsuccessful | **Mandatory** | `field_verification_failed` |
| `UNDER_VERIFICATION` | `UC_REVIEW` | Street Rep | Location inaccessible | **Mandatory** | `location_inaccessible` |
| `UNDER_VERIFICATION` | `UC_REVIEW` | Street Rep | Duplicate suspected — **flagged, never silently deleted** | **Mandatory** + linked ref | `duplicate_suspected` |
| Any pre-close | *(unchanged)* | Rep / UC Officer | Clarification requested | **Mandatory** | `clarification_requested` |
| `UC_REVIEW` | `REJECTED` | UC Officer | Rejection | **Mandatory, coded** | `case_rejected` |
| `CONTRACTOR_ASSIGNED` | `ACCEPTED` | Contractor | Decline with allowed reason | **Mandatory** | `work_declined` |
| `CONTRACTOR_ASSIGNED` | `ACCEPTED` | **System** | Contractor fails to respond within the window | Automatic | `assignment_lapsed` |
| `COMPLETION_VERIFICATION` | `IN_PROGRESS` | Street Rep | **Completion verification fails** | **Mandatory** | `completion_rejected` |
| `PENDING_CITIZEN_CONFIRMATION` | `REOPENED` | Citizen | Dispute | **Mandatory** | `resolution_disputed` |
| `REOPENED` | `IN_PROGRESS` / `ACCEPTED` | UC Officer | Rework or reassign — a separate, separately audited decision | **Mandatory** | `dispute_handled` |
| `UC_REVIEW` / `ACCEPTED` / `REOPENED` | `CANCELLED` | UC Officer | Defined cancellation conditions only | **Mandatory** | `case_cancelled` |
| `CLOSED` | `REOPENED` | UC Officer / Mayor & Ops | Reopen after closure | **Mandatory** | `case_reopened` |
| Any | *(held)* | **System** | No eligible Representative or Contractor → escalate; if still none, **flag unresolvable and hold** | Automatic | `case_unresolvable` |

**Prohibited transitions:** creating a `CivicReport` in any state other than `SUBMITTED` · `SUBMITTED` → `CONTRACTOR_ASSIGNED` *(verification and acceptance cannot be skipped)* · `UC_REVIEW` → `CONTRACTOR_ASSIGNED` *(acceptance cannot be skipped)* · `IN_PROGRESS` → `RESOLVED_CONFIRMED` · `RESOLVED_CONFIRMED` → `CLOSED` by anyone other than a UC Officer · **creation without reporter confirmation of the active rendering version** · **creation on a `REVIEW_REQUIRED` artefact that the reporter has not confirmed** · any transition by an account in `ConflictExclusion` · any transition by an expired or revoked role assignment.

### 9.4 Formal appeal — no pseudo-states

The **case remains `REOPENED`**. The appeal lives on the dispute record:

| `Dispute.appeal_status` | Meaning |
|---|---|
| `NOT_FILED` | No appeal raised |
| `FILED` | Appeal raised, awaiting assignment |
| `UNDER_REVIEW` | An independent Mayor & Ops actor is reviewing |
| `DECIDED` | Decision recorded |

**The decider must not be a prior actor on that case.** Every appeal event is audited. **The case-state transition following the decision is explicit** — never implicit.

> **`TBD — Hassan decision required`: no-citizen-response closure.** If the citizen never confirms or disputes, what happens? **No policy is invented here.**
> **`TBD — Hassan decision required`: repeated reopening.** Is there a cap, and what happens at it?

## 10. Contractor eligibility

A UC Officer may assign only to a contractor satisfying **all** of: account `ACTIVE` · organisation `APPROVED` and active · current date within `valid_from … valid_until` · report category in the approved categories · report location inside the approved service areas.

**An expired, suspended or revoked contractor cannot accept work or submit completion**, even with a valid session — **checked at the point of action**. Ineligible contractors are **not rendered** in the picker, and the server **re-checks on submit regardless**.

## 11. Privacy filtering by role

| Field | CIT (own) | REP | UCO | CON | MAY |
|---|:--:|:--:|:--:|:--:|:--:|
| **Citizen mobile number** | **masked** | **no** | **no** | **no** | **no** |
| Citizen account ID | — | **no** | **no** | **no** | ✓ |
| Citizen name | — | **no** | **no** | **no** | ✓ |
| Report content, category, location | ✓ | ✓ | ✓ | ✓ *(assigned)* | ✓ |
| **Original voice recording** | ✓ **own** | **scope — verification only** | **scope — verification only** | **no** | **authorised, scope-limited, audited** |
| **Intermediate source-language ASR output** | **no** | ✓ *(verification / review)* | ✓ *(verification / review)* | **no** | ✓ |
| **Urdu civic rendering** | ✓ | ✓ | ✓ | ✓ *(assigned, confirmed version)* | ✓ |
| Photo/video evidence | ✓ | ✓ | ✓ | ✓ *(assigned, **redacted where required**)* | ✓ |
| Internal staff notes | **no** | ✓ | ✓ | **no** | ✓ |
| Staff personal contact details | **no** | **no** | **no** | **no** | ✓ |
| Official reporter's staff identity | **no** | **no** | ✓ *(conflict check only)* | **no** | ✓ |
| Civic audit narrative | **sanitised timeline only** | **no** | scope | **no** | ✓ |
| Hash-chain integrity results | **no** | **no** | **no** | **no** | ✓ |

> **The contractor work packet contains:** the confirmed Urdu civic rendering · issue category · required location · relevant redacted photo/video evidence · work instructions · safe access information · progress and completion requirements.
>
> **It contains none of:** original citizen audio · intermediate source-language ASR output · citizen mobile number · `CitizenAccount` ID · citizen name · internal staff notes · unrestricted audit narrative. **Enforced server-side, not by template omission.**
>
> **The intermediate ASR output is withheld from citizens** as well. It is an intermediate AI artefact that may contain recognition errors; showing it beside the confirmed rendering would invite confusion about which text is authoritative.

## 12. Account-creation chain — locked

| Account | Created or invited by |
|---|---|
| **Citizen** | **Self-created** after successful SMS OTP verification |
| **Street Representative** | **UC Officer**, within the UC Officer's own authorised scope |
| **UC Officer** | **Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`** |
| **Contractor** | **Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`**, after contractor-organisation approval |
| **Mayor/Ops** | Initial account bootstrapped out-of-band; later accounts invited by an authorised Mayor/Ops Account Administrator |
| **Technical System Administrator** | Provisioned out-of-band through the deployment environment |

**Public staff signup must remain impossible.** **Account activation and role authorisation are separate.**

## 13. Related tests

`TEST-RBAC-001` Mayor cannot perform ordinary closure · `002` Mayor cannot invite a Representative routinely · `003` SYSADMIN cannot read civic audit content · `004` UC Officer cannot invite outside scope · `005` UC Officer cannot assign an ineligible contractor · `006` contractor response contains no citizen identity · `007` protected contact sends without revealing the number · `008` staff reporter cannot act on own report under another role · `009` expired role assignment fails mid-session · `010` suspended staff session revoked · `011` login OTP satisfies the 10-minute window · `012` step-up required after the window expires · `013` prior case actor cannot decide the formal appeal · `014` `CAP_CASE_ACCEPT` produces `ACCEPTED` · `015` `CAP_CASE_CLOSE` produces `CLOSED` · `016` no operational role receives a citizen number in any response · `017` mobile number is not counted as an authentication factor in any document or response · `018` SYSADMIN is absent from the civic authentication and permission matrices · `019` **contractor cannot access the original voice recording** · `020` **contractor cannot read the intermediate ASR output** · `021` **no `CivicReport` can be created in any state other than `SUBMITTED`** · `022` **staff can access `STF-10` when holding `CAP_REPORT_OFFICIAL`** · `023` **staff can confirm only their own official-report rendering** · `024` **staff cannot confirm a citizen's rendering** · `025` **a transcript reviewer cannot confirm on the reporter's behalf** · `026` **an active StaffAccount without a RoleAssignment has no portal privileges** · `027` **a multi-role user acts under exactly one assignment at a time** · `028` **staff public signup is rejected**.

**Every test above: `Specified; not implemented; not executed`.**

---

*Specified; not implemented; not tested. No permission in this document has been enforced by running code.*

---

# 14. Reconciliation additions — 3 October 2026 (rev 1.4)

> **Labelling rule for this section.** Every row is marked **`[RECOVERED]`** (already decided in an earlier source, restated here), **`[INSTRUCTED]`** (decided by the Project Lead's message of 3 October 2026), or **`[DELEGATED]`** (a new design choice made under his written delegation in that message). **Nothing here is presented as previously approved when it was not.**

## 14.1 Account creation and invitation hierarchy — consolidated

**`[RECOVERED]` — from §3, §12 and §13 of this document.** No new identity scheme is introduced.

| # | Account | Created / invited by | Who sets the password | Scope assigned by |
|---|---|---|---|---|
| 1 | **Citizen** | **Self-service.** Mobile number + SMS OTP. **Account created automatically on first successful OTP verification** | **None — citizens have no password** | n/a |
| 2 | **Street Representative** | **UC Officer**, holding `CAP_REP_INVITE`, **within that officer's own scope only** | **The Representative**, at activation | The inviting UC Officer — **cannot exceed the inviter's own scope** |
| 3 | **UC Officer** | **Mayor & Operations** user holding `CAP_ACCOUNT_ADMIN` | **The UC Officer** | Mayor & Ops with `CAP_ROLE_ASSIGN` — district |
| 4 | **Contractor** | **Mayor & Operations** user holding `CAP_ACCOUNT_ADMIN`, **after the contractor organisation is approved** | **The Contractor** | Mayor & Ops with `CAP_ROLE_ASSIGN` — district + organisation |
| 5 | **Mayor & Operations** | **First account bootstrapped once, out-of-band through the deployment environment.** Every later account is invited by an existing Mayor/Ops **Account Administrator** | **The owner** | Mayor & Ops with `CAP_ROLE_ASSIGN` |

**Rules that hold across all five:**

| Rule | Detail |
|---|---|
| **Public staff signup is impossible** | **`[RECOVERED]`** There is no public staff registration route. A citizen completing OTP **cannot select, request or self-grant any staff role** — `TEST-RBAC-028` |
| **Inviters never know a password** | **`[RECOVERED]`** An invitation carries a one-time activation path. The invitee sets their own password at `STF-02`. **No inviter ever sees, sets, resets to a known value, or distributes a staff password** |
| **A Mayor cannot routinely invite a Representative** | **`[RECOVERED]`** `CAP_REP_INVITE` is **`UCO` only, own scope.** Mayor/Ops invitation of a Representative is **exceptional and separately audited** — `TEST-RBAC-002` |
| **Verifying a phone is not verifying an appointment** | **`[RECOVERED]`** SMS OTP proves **possession of a number**. Official authority comes **only** from an active `RoleAssignment` created through the chain above. **An active `StaffAccount` with no `RoleAssignment` has no portal privileges** — `TEST-RBAC-026` |
| **Invitee already has an account** | **`[DELEGATED]`** The invitation **attaches a new `RoleAssignment` to the existing `StaffAccount`** — it never creates a second account for the same person, and it never resets their existing password. If the invited number already belongs to a **citizen** account, the two remain **separate identities in separate realms** (`D-10`): the staff account is created independently and is **not linked**, so a staff member's personal citizen reports stay unlinkable from their official identity |
| **One person, several roles** | **`[RECOVERED]`** Permitted. **Exactly one acting assignment at a time** — `TEST-RBAC-027`. A portal switch **re-scopes**, it never accumulates: capabilities are **never combined across assignments**, and switching grants nothing the target assignment does not itself carry |

## 14.2 `CAP_REPORT_VIEW_OWN` — new capability

**`[DELEGATED]`** — closes `RC-18` / `D-02` / `D-03`, which earlier revisions left open.

| Aspect | Rule |
|---|---|
| **Held by** | Any staff account that holds `CAP_REPORT_OFFICIAL` — `REP`, `UCO`, `CON`, `MAY` |
| **Grants** | Read of any `CivicReport` where `official_reporter_account_id = self`, **bypassing the scope check and the conflict check — for reading only**. Plus **answer a clarification** on it, and **confirm or dispute its resolution** (`T11`) as its reporter |
| **Does not grant** | **Verify · accept · reject · assign · approve evidence · approve completion · resolve · close · decide a dispute or appeal.** Every one of these returns **`403 E_CONFLICT_EXCLUDED`** on the reporter's own report, under **every** role they hold, **now or in future** |
| **Why read is allowed at all** | **Reading is not acting.** `ConflictExclusion` exists to stop a person **deciding** their own case. It was never intended to stop them **seeing** a record they created — and the side effect was that a UC Officer who reported a pothole could not learn whether it was ever fixed |
| **Server-side** | The exemption is **enumerated, not general**: four read/respond routes. Checks 1, 2, 3 and 6 of the six acting-role checks still apply in full |
| **Screen · API** | `STF-11` · `API-150s`, `API-152` |

## 14.3 Self-review restriction — restated

**`[RECOVERED]`** `ConflictExclusion` is keyed on **`excluded_staff_account_id`**, so it **survives role switching and future role grants** — `TEST-RBAC-008`.

> **`[DELEGATED]` — organisation-level gap recorded, not closed.** Exclusion is **account-level only**. A contractor employee may file an official report, and their **organisation** is not excluded from being assigned the resulting work. **Recommendation: write a second, organisation-level exclusion row when `reporter_kind = staff_official` and the account belongs to a `ContractorOrganization`.** **Not applied here** — it adds a dimension to the data model and is a **procurement-integrity** rule, not a documentation default. Tracked as `GAP-02`.

## 14.4 Suspension, revocation and restoration

**`[RECOVERED]`**

| Event | Immediate effect |
|---|---|
| **Role assignment expires mid-session** | The next authorised action **fails** — `TEST-RBAC-009`. Capability is evaluated per request, never cached for the session |
| **Staff account suspended** | **Active sessions are revoked** — `TEST-RBAC-010`. The refresh-token family is invalidated |
| **Assignment revoked** | Portal access for that role ends. **Audit history is retained — never deleted** |
| **Contractor organisation suspended** | Its accounts become ineligible for new assignment. **Work already in progress is not silently reassigned** — a UC Officer decides, and the decision is audited |
| **Restoration** | A **new** `RoleAssignment`, separately audited. **A revoked assignment is never silently reactivated** |

## 14.5 Server-side authorization — non-negotiable

**`[RECOVERED]`** **Hiding a control is never sufficient.** Every action in §5 names a server-side check. The six checks run **in order** on every request: **(1)** authenticated · **(2)** account active · **(3)** acting assignment valid and unexpired · **(4)** geographic/organisational scope contains the resource · **(5)** `ConflictExclusion` does not bar the actor · **(6)** the capability is held by the acting assignment. **An absent capability is a denial, not a default-allow.**

> **`DR-33` `[INSTRUCTED]` — development is not gated on external approval.** No mentor, academic supervisor, external developer, government official or institution approves **ordinary development work** on this prototype. The historical mentor-review label is **a review milestone, not a development blocker**, and is recorded as such. **This changes nothing about §14.1** — incident processing still requires the Street Representative and UC Officer workflow, and **no deployment, partnership or institutional authority is claimed anywhere.**
