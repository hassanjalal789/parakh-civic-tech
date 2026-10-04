# Parakh — Use-Case Traceability Matrix

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Use cases** | **163** — `CIT` 58 · `REP` 24 · `UCO` 29 · `CON` 24 · `MAY` 28 |
| **Workflows** | 23 |

**Counting shown:** `58 + 24 + 29 + 24 + 28 = 163`.

---

# 1. Forward matrix — one row per use case

**Legend.** `Src` names the authoritative source section. `OD` names the open decision, blank if none. Where several use cases share a table row in the portal file, the row below still names each ID.

## 1.1 Citizen — `UC-CIT-001` … `UC-CIT-058`

| UC | Goal | Screens | APIs | Capabilities | Entities | State | Audit | Tests | Src | OD |
|---|---|---|---|---|---|---|---|---|---|---|
| `001` | First launch | `CIT-01` | — | — | — | — | — | `AT-CIT-001` | SI §2.1 | — |
| `002` | Select language | `CIT-01`,`CIT-21` | `API-155` | — | `CitizenAccount` | — | `profile_updated` | `AT-LANG-002`,`AT-LANG-006` | CR §4 | — |
| `003` | Read explanation | `CIT-02` | — | — | — | — | — | `AT-CIT-003` | SI §2.1 | — |
| `004` | Pre-auth consent | `CIT-03` | **none** | — | device payload | — | **none** | `AT-CIT-004`,`AT-CIT-005` | DM §4.7 | **D-08** |
| `005` | Enter number | `CIT-04` | — | — | — | — | — | `AT-CIT-006` | SI §2.1 | — |
| `006` | Request OTP | `CIT-04`,`CIT-05` | `API-121` | — | `OTPChallenge` | — | `otp_requested` | `AT-AUTH-001`,`AT-OTP-004` | API §3.1 | — |
| `007` | Resend OTP | `CIT-05` | `API-121` | — | `OTPChallenge` | — | `otp_requested` | `AT-OTP-003` | DM §4.2 | — |
| `008` | Edit number | `CIT-04` | — | — | — | — | — | `AT-CIT-006` | SI §2.1 | — |
| `009` | Verify OTP | `CIT-05` | `API-122` | — | `AuthSession` | — | `otp_verified` | `AT-AUTH-001` | API §3.1 | — |
| `010` | Create account | `CIT-05` | `API-122` | — | `CitizenAccount`,`CitizenPhoneCredential`,`ConsentRecord`×3 | → `ACTIVE` | `citizen_account_created` | `AT-AUTH-002` | CR §3.2 | — |
| `011` | Returning login | `CIT-05` | `API-122` | — | `AuthSession` | — | `otp_verified` | `AT-AUTH-003` | CR §3.2 | — |
| `012` | Bad/expired/limited OTP | `CIT-05` | `API-122` | — | `OTPChallenge` | — | `otp_failed`,`otp_rate_limited` | `AT-OTP-001`…`004` | DM §4.2 | — |
| `013` | Home | `CIT-06` | summary | — | — | — | — | `AT-CIT-013` | SI §2.1 | — |
| `014` | Start report | `CIT-06`,`CIT-07` | `API-130` | — | `ClientSubmission` | `LOCAL_DRAFT` | — | `AT-PIPE-001` | DM §5.1 | — |
| `015` | Select category | `CIT-07` | `API-130` | — | `ClientSubmission` | `LOCAL_DRAFT` | — | `AT-CIT-015` | SI §2.1 | — |
| `016` | Capture evidence | `CIT-08` | `API-131` | — | `EvidenceObject` | — | — | `AT-EVID-001`…`003` | SI §4 | **D-14** |
| `017` | Camera denied | `CIT-08` | — | — | — | — | — | `AT-CIT-017` | SI §2.1 | — |
| `018` | Record voice | `CIT-09` | `API-131` | — | `EvidenceObject` `voice_original` | — | — | `AT-LANG-001` | CR §5 | — |
| `019` | Play/re-record | `CIT-09` | — | — | — | — | — | `AT-CIT-019` | SI §3 | — |
| `020` | Typed fallback | `CIT-09` | — | — | — | — | — | `AT-CIT-020` | CR §5 | — |
| `021` | Mic denied | `CIT-09` | — | — | — | — | — | `AT-CIT-021` | SI §2.1 | — |
| `022` | Safe local draft | `CIT-09`,`CIT-12` | — | — | `ClientSubmission` | `LOCAL_DRAFT` | — | `AT-OFF-003` | TS §5 | **D-10** |
| `023` | Upload | `CIT-09` | `API-131`,`API-132` | — | `EvidenceObject` | `UPLOADING` | `evidence_committed` | `AT-CIT-023` | API §5 | — |
| `024` | AI rendering | `CIT-09` | `API-134` | — | `VoiceTranscriptionArtifact` | `TRANSCRIPTION_PROCESSING`→`AWAITING_REPORTER_REVIEW` | — | `AT-AI-006`,`AT-AI-007` | DM §5.2 | — |
| `025` | Named states | `CIT-09` | — | — | — | pipeline | — | `AT-CIT-025` | SI §3 | — |
| `026` | Slow processing | `CIT-09` | — | — | — | — | — | `AT-CIT-026` | SI §3 | — |
| `027` | AI failure | `CIT-09` | — | — | `VoiceTranscriptionArtifact` | **no report** | — | `AT-AI-001`…`004` | CR §8.1 | — |
| `028` | Review rendering | `CIT-09`,`CIT-11` | `API-134` | — | — | `AWAITING_REPORTER_REVIEW` | `rendering_viewed` | `AT-AI-010` | DM §5.2 | — |
| `029` | Correct rendering | `CIT-09` | — | — | artefact v2 | — | `rendering_corrected` | `AT-AI-006` | DM §5.2 | — |
| `030` | Low-confidence field | `CIT-09` | — | — | `field_confidence_json` | — | — | `AT-AI-008` | CR §7 | — |
| `031` | Confirm version | `CIT-11` | `API-135` | **`CAP_RENDERING_CONFIRM_OWN`** | `RenderingConfirmation` | →`READY_TO_SUBMIT` | `rendering_confirmed` | `AT-CONF-001` | API §6 | **D-12** |
| `032` | Stale version | `CIT-11` | `API-134`,`API-135` | `CAP_RENDERING_CONFIRM_OWN` | — | — | — | `AT-CONF-005`,`AT-CONF-006` | API §6.2 | **D-12** |
| `033` | GPS location | `CIT-10` | `GET /geo/reverse` | — | — | — | — | `AT-CIT-033` | SI §2.1 | — |
| `034` | Move pin | `CIT-10` | — | — | — | — | — | `AT-CIT-034` | SI §2.1 | — |
| `035` | GPS denied | `CIT-10` | — | — | — | — | — | `AT-CIT-035` | SI §2.1 | — |
| `036` | Review report | `CIT-11` | — | — | — | — | — | `AT-CIT-036` | SI §2.1 | **D-14** |
| `037` | Submit | `CIT-11`,`CIT-13` | **`API-140`** | — | **`CivicReport`**,`ReportOwnership` | →**`SUBMITTED`** | `report_submitted` | `AT-PIPE-002`…`005` | API §7 | **D-12**,**D-14** |
| `038` | Waiting to send | `CIT-12` | — | — | `ClientSubmission` | `WAITING_FOR_CONNECTION` | — | `AT-PIPE-001`,`AT-OFF-003` | SI §7 | — |
| `039` | Retry/cancel | `CIT-12` | `API-140` | — | — | — | — | `AT-IDEM-002`,`AT-IDEM-003` | API §10 | **D-12** |
| `040` | Official reference | `CIT-13` | `API-140` | — | `CivicReport` | `SUBMITTED` | `report_submitted` | `AT-PIPE-004` | API §7.3 | — |
| `041` | My Reports | `CIT-14` | `API-150` | ownership | — | — | `report_viewed` | `AT-CIT-041` | API §8.1 | — |
| `042` | Report detail | `CIT-15` | `API-151` | ownership | — | — | `report_viewed` | `AT-PRV-006`,`AT-PRV-007` | API §8.1 | — |
| `043` | Notifications | `CIT-20` | notifications | ownership | `Notification` | — | — | `AT-CIT-043` | RBAC §11 | — |
| `044` | Answer clarification | `CIT-16` | `API-152` | ownership | — | unchanged | `clarification_requested` | `AT-CIT-044` | API §8.1 | — |
| `045` | Completion review | `CIT-17` | `API-151` | ownership | — | `PENDING_CITIZEN_CONFIRMATION` | — | `AT-CIT-045` | RBAC §9.2 | **D-01** |
| `046` | Confirm fixed | `CIT-18` | `API-153` | ownership | `CitizenConfirmation` | →`RESOLVED_CONFIRMED` | `resolution_confirmed` | `AT-STATE-006` | RBAC T11 | **D-01** |
| `047` | Dispute | `CIT-19` | `API-154` | ownership | `Dispute` | →`REOPENED` | `resolution_disputed` | `AT-STATE-007` | RBAC §9.3 | — |
| `048` | Dispute evidence | `CIT-19` | `API-154` | ownership | `EvidenceObject` | `REOPENED` | `resolution_disputed` | `AT-CIT-048` | RBAC §9.3 | — |
| `049` | Change language | `CIT-21` | `API-155` | ownership | `CitizenAccount` | — | `profile_updated` | `AT-LANG-006` | DM §2.1 | — |
| `050` | Masked number | `CIT-21` | `API-155` | ownership | — | — | — | `AT-PRV-010` | RBAC §11 | — |
| `051` | Change number | `CIT-22` | `API-156` | ownership + 2 OTPs | `CitizenPhoneCredential` | — | `phone_changed` | `AT-CIT-051` | DM §2.2 | — |
| `052` | SMS consent | `CIT-21` | `API-155` | ownership | `ConsentRecord` | — | — | `AT-CIT-052` | DM §4.6 | — |
| `053` | Log out | `CIT-21` | `API-004` | own session | `AuthSession` | — | `session_revoked` | `AT-SESS-001` | API §3.2 | — |
| `054` | Log out everywhere | `CIT-21` | `API-128` | own sessions | `RefreshTokenFamily` | — | `session_revoked` | `AT-SESS-002` | DM §4.4 | — |
| `055` | Deactivate | `CIT-21` | `API-155` | ownership | `CitizenAccount` | →`DEACTIVATED` | `citizen_account_deactivated` | `AT-CIT-055` | DM §2.1 | — |
| `056` | Session expiry | `CIT-04` | `API-003` | refresh | `AuthSession` | — | — | `AT-SESS-003` | API §3.2 | — |
| `057` | Another's report | `CIT-15` | `API-151` | ownership | — | — | `unauthorised_access_attempt` | `AT-SCOPE-001` | API §8.1 | — |
| `058` | Help / accessibility | `CIT-23` | — | — | — | — | — | `AT-A11Y-001`…`005` | SI §9 | — |

## 1.2 Street Representative — `UC-REP-001` … `UC-REP-024`

| UC | Goal | Screens | APIs | Capabilities | Entities | State | Audit | Tests | Src | OD |
|---|---|---|---|---|---|---|---|---|---|---|
| `001` | UCO invites a Rep | `UCO-07`,`STF-08` | `API-098` | **`CAP_REP_INVITE`** | `StaffAccount`,`RoleAssignment`,`AccountInvitation` | →`INVITED` | `rep_invited` | `AT-PERM-004`,`AT-SCOPE-002` | RBAC §3 r27 | — |
| `002` | Open invitation | `STF-01` | `API-123` | — | `AccountInvitation` | `INVITED` | — | `AT-INV-001` | API §3.2 | — |
| `003` | Expiry/wrong phone | `STF-01` | `API-123` | — | — | — | — | `AT-INV-002`,`AT-INV-003` | DM §4.1 | — |
| `004` | Activation OTP | `STF-02` | `API-124` | — | `OTPChallenge` | →`PENDING_ACTIVATION` | `otp_verified` | `AT-INV-004` | DM §4.2 | **D-07** |
| `005` | Create own password | `STF-03` | `API-105` | — | `StaffCredential` | →`ACTIVE` | `password_set` | `AT-AUTH-006`,`AT-AUTH-007` | CR §3.3 | — |
| `006` | Login + role select | `STF-04`,`STF-05`,`STF-06` | `API-005`,`API-125`,`API-120` | — | `AuthSession` | — | `session_created`,`acting_role_selected` | `AT-AUTH-004`,`AT-ROLE-001` | API §3.2 | **D-04**,**D-05** |
| `007` | Dashboard | `REP-01` | scoped reads | role+scope | — | — | — | `AT-REP-007` | SI §5.2 | — |
| `008` | Reports in scope | `REP-01` | scoped reads | role+scope | `CivicReport` | `UNDER_VERIFICATION` | — | `AT-SCOPE-003` | RBAC §6 | — |
| `009` | Privacy-permitted view | `REP-02` | `GET /reports/{id}` | role+scope | — | — | `report_viewed` | `AT-PRV-008`,`AT-PRV-009` | RBAC §11 | **D-13** |
| `010` | Field verification | `REP-02` | **`API-160`** | **`CAP_FIELD_VERIFY`** | `Verification`,`EvidenceObject` | `UNDER_VERIFICATION`→`VERIFIED` | `field_verified` | `AT-STATE-002`,`AT-CONF-009` | RBAC T3 | — |
| `011` | Verify completion | `REP-03` | **`API-167`** | **`CAP_COMPLETION_VERIFY`** | `Verification` | `COMPLETION_VERIFICATION`→`PENDING_CITIZEN_CONFIRMATION` | `completion_verified` | `AT-STATE-005` | RBAC T10 | **D-01** |
| `012` | Request clarification | `REP-02` | clarification | `CAP_CASE_CLARIFY` | — | unchanged | `clarification_requested` | `AT-REP-012` | RBAC §3 r13 | — |
| `013` | Flag rendering | `REP-02` | — | flag only | `VoiceTranscriptionArtifact` | — | `transcript_reviewed` | `AT-CONF-004` | RBAC §2.1 | — |
| `014` | Recuse | `REP-04` | recusal | — | `ConflictExclusion` | — | — | `AT-REP-014` | SI §5.2 | — |
| `015` | `STF-10` official report | `STF-10` | `API-130`,`API-135`,**`API-141`** | **`CAP_REPORT_OFFICIAL`**,`CAP_RENDERING_CONFIRM_OWN` | `CivicReport`,`ConflictExclusion` | →`SUBMITTED` | `report_submitted` | `AT-OFF-001`,`AT-CONF-002` | CR §12 | **D-09**,**D-11**,**D-14** |
| `016` | Conflict exclusion | — | — | — | `ConflictExclusion` | — | — | `AT-CONF-009`,`AT-CONF-010` | RBAC §8 | — |
| `017` | Track own report | **`STF-11` PROPOSED** | — | — | — | — | — | `AT-REP-017` | **none** | **D-02**,**D-03** |
| `018` | Role switching | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-002`,`AT-ROLE-003` | RBAC §7 | — |
| `019` | Step-up | `STF-08` | `API-126` | — | `AuthSession` | — | `step_up_satisfied` | `AT-STEP-001`,`AT-STEP-002` | RBAC §5 | — |
| `020` | Password reset | `STF-07` | `API-127` | — | `StaffCredential`,`AuthSession` | — | `password_reset` | `AT-SESS-004` | API §3.2 | **D-07** |
| `021` | Session management | `STF-09` | `API-128` | own sessions | `DeviceSession` | — | `session_revoked` | `AT-SESS-002` | API §3.2 | — |
| `022` | Logout | `STF-09` | `API-004` | own session | `AuthSession` | — | `session_revoked` | `AT-SESS-001` | API §3.2 | — |
| `023` | Number change | `MAY-03` | — | `CAP_ACCOUNT_ADMIN` | `StaffCredential` | — | `phone_changed` | `AT-MAY-015` | SI §5.5 | — |
| `024` | Suspended/expired/scope | all | all | — | `StaffAccount`,`RoleAssignment` | — | `account_suspended` | `AT-SESS-005`,`AT-ROLE-004` | RBAC §7 | — |

## 1.3 UC Officer — `UC-UCO-001` … `UC-UCO-029`

| UC | Goal | Screens | APIs | Capabilities | Entities | State | Audit | Tests | Src | OD |
|---|---|---|---|---|---|---|---|---|---|---|
| `001` | Mayor invites UCO | `MAY-03`,`MAY-04` | `API-098` | **`CAP_ACCOUNT_ADMIN`** | `StaffAccount`,`RoleAssignment` | →`INVITED` | `officer_provisioned` | `AT-PERM-005` | RBAC §3 r28 | — |
| `002` | Activation | `STF-01`…`STF-03` | `API-123`,`API-124`,`API-105` | — | `StaffCredential` | →`ACTIVE` | `password_set` | `AT-AUTH-006` | API §3.2 | **D-07** |
| `003` | Login | `STF-04`,`STF-05` | `API-005`,`API-125` | — | `AuthSession` | — | `session_created` | `AT-AUTH-004` | API §3.2 | — |
| `004` | Role selection | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-001` | API §3.2 | **D-04**,**D-05** |
| `005` | Dashboard/queues | `UCO-01` | scoped reads | role+scope | — | — | — | `AT-SCOPE-003` | SI §5.3 | — |
| `006` | Review verified report | `UCO-02` | `GET /reports/{id}` | role+scope | — | `UC_REVIEW` | `report_viewed` | `AT-PRV-008` | RBAC §11 | **D-13** |
| `007` | Accept | `UCO-02` | **`API-161`** | **`CAP_CASE_ACCEPT`** | `CivicReport` | `UC_REVIEW`→**`ACCEPTED`** | `case_accepted` | `AT-STATE-003` | RBAC T5 | — |
| `008` | Reject | `UCO-02`,`STF-08` | **`API-162`** | **`CAP_CASE_REJECT`** + step-up | `CivicReport` | →`REJECTED` | `case_rejected` | `AT-PERM-002` | RBAC §3 r12 | — |
| `009` | Request clarification | `UCO-02` | clarification | `CAP_CASE_CLARIFY` | — | unchanged | `clarification_requested` | `AT-UCO-009` | RBAC §3 r13 | — |
| `010` | Flag/review rendering | `UCO-02` | **`API-136`** | **`CAP_TRANSCRIPT_REVIEW`** | `VoiceTranscriptionArtifact` | — | `transcript_reviewed` | `AT-CONF-004` | RBAC §2.1 | — |
| `011` | Eligible contractors only | `UCO-03` | eligibility read | `CAP_CASE_ASSIGN` | `ContractorOrganization` | `ACCEPTED` | — | `AT-ELIG-001` | RBAC §10 | **D-06** |
| `012` | Assign contractor | `UCO-03`,`STF-08` | **`API-163`** | `CAP_CASE_ASSIGN` + step-up | `CaseAssignment` | `ACCEPTED`→`CONTRACTOR_ASSIGNED` | `contractor_assigned` | `AT-STATE-004`,`AT-STATE-008` | RBAC T6 | **D-06** |
| `013` | Server eligibility recheck | `UCO-03` | `API-163` | `CAP_CASE_ASSIGN` | — | — | — | `AT-ELIG-002` | RBAC §10 | — |
| `014` | Reassign | `UCO-04`,`STF-08` | `API-163` | `CAP_CASE_ASSIGN` + step-up | `CaseAssignment` | →`CONTRACTOR_ASSIGNED` | `contractor_assigned` | `AT-UCO-014` | RBAC §9.3 | — |
| `015` | Escalate | `UCO-04` | escalation | `CAP_ESCALATION` | — | unchanged | `case_escalated` | `AT-UCO-015` | RBAC §3 r26 | — |
| `016` | Contractor decline | `UCO-01` | — | — | `CaseAssignment` | `CONTRACTOR_ASSIGNED`→`ACCEPTED` | `work_declined`,`assignment_lapsed` | `AT-UCO-016` | RBAC §9.3 | — |
| `017` | Review progress | `UCO-01` | progress read | role+scope | `ContractorProgress` | `IN_PROGRESS` | `progress_updated` | `AT-UCO-017` | RBAC §3 r16 | — |
| `018` | Review completion | `UCO-01` | — | — | `CompletionEvidence` | →`COMPLETION_VERIFICATION` | `completion_routed` | `AT-UCO-018` | RBAC T9 | **D-01** |
| `019` | Handle dispute | `UCO-05`,`STF-08` | dispute route | dispute + step-up | `Dispute` | `REOPENED`→`IN_PROGRESS`/`ACCEPTED` | `dispute_handled` | `AT-UCO-019` | RBAC §3 r24 | — |
| `020` | Order rework | `UCO-05` | dispute route | dispute | `CivicReport` | `REOPENED`→`IN_PROGRESS` | `dispute_handled` | `AT-UCO-020` | RBAC §9.3 | — |
| `021` | Close case | `UCO-06`,`STF-08` | **`API-168`** | **`CAP_CASE_CLOSE`** + step-up | `CivicReport` | `RESOLVED_CONFIRMED`→**`CLOSED`** | `case_closed` | `AT-PERM-001`,`AT-STATE-009` | RBAC T12 | — |
| `022` | Invite a Rep | `UCO-07`,`STF-08` | `API-098` | **`CAP_REP_INVITE`** + step-up | `StaffAccount` | →`INVITED` | `rep_invited` | `AT-PERM-004` | RBAC §3 r27 | — |
| `023` | Scope cannot widen | `UCO-07` | `API-098` | `CAP_REP_INVITE` | — | — | — | `AT-SCOPE-002` | RBAC §6 | — |
| `024` | Scoped case history | `UCO-08` | `API-080` | **`CAP_AUDIT_READ`** scope-limited | `AuditEvent` | — | `audit_log_viewed` | `AT-AUD-001` | RBAC §3 r33 | — |
| `025` | `STF-10` official report | `STF-10` | `API-141` | `CAP_REPORT_OFFICIAL` | `CivicReport`,`ConflictExclusion` | →`SUBMITTED` | `report_submitted` | `AT-OFF-001` | CR §12 | **D-09**,**D-11**,**D-14** |
| `026` | Conflict exclusion | — | — | — | `ConflictExclusion` | — | — | `AT-CONF-009` | RBAC §8 | — |
| `027` | Multi-role switching | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-002`,`AT-ROLE-003` | RBAC §7 | — |
| `028` | Reset/sessions/logout | `STF-07`,`STF-09` | `API-127`,`API-128`,`API-004` | — | `AuthSession` | — | `password_reset`,`session_revoked` | `AT-SESS-001`,`AT-SESS-004` | API §3.2 | — |
| `029` | Suspended/expired/scope | all | all | — | `StaffAccount` | — | `account_suspended` | `AT-SESS-005`,`AT-ROLE-004` | RBAC §7 | — |

## 1.4 Contractor — `UC-CON-001` … `UC-CON-024`

| UC | Goal | Screens | APIs | Capabilities | Entities | State | Audit | Tests | Src | OD |
|---|---|---|---|---|---|---|---|---|---|---|
| `001` | Organisation registration | **none exists** | **none** | — | `ContractorOrganization` | `PENDING_APPROVAL` | — | `AT-CON-001` | DM §3.4 | **`TBD`** |
| `002` | Approve organisation | `MAY-05`,`STF-08` | approval route | `CAP_ACCOUNT_ADMIN` + step-up | `ContractorOrganization` | →`APPROVED` | `organisation_approved` | `AT-MAY-016` | RBAC §3 r30 | — |
| `003` | Invite contractor | `MAY-03` | `API-098` | `CAP_ACCOUNT_ADMIN` | `StaffAccount`,`RoleAssignment` | →`INVITED` | `contractor_provisioned` | `AT-CON-003` | RBAC §3 r29 | — |
| `004` | Accept invitation | `STF-01` | `API-123` | — | `AccountInvitation` | `INVITED` | — | `AT-INV-001` | API §3.2 | — |
| `005` | Activation OTP | `STF-02` | `API-124` | — | `OTPChallenge` | →`PENDING_ACTIVATION` | `otp_verified` | `AT-INV-004` | DM §4.2 | **D-07** |
| `006` | Create own password | `STF-03` | `API-105` | — | `StaffCredential` | →`ACTIVE` | `password_set` | `AT-AUTH-007` | CR §3.3 | — |
| `007` | Login | `STF-04`,`STF-05` | `API-005`,`API-125` | — | `AuthSession` | — | `session_created` | `AT-AUTH-004` | API §3.2 | — |
| `008` | Role selection | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-001` | API §3.2 | **D-04**,**D-05** |
| `009` | Assigned work only | `CON-01` | scoped reads | organisational scope | `CaseAssignment` | `CONTRACTOR_ASSIGNED` | — | `AT-SCOPE-004` | RBAC §6 | — |
| `010` | Work packet | `CON-02` | `GET /reports/{id}` | organisational scope | — | — | `report_viewed` | `AT-PRV-001`…`005` | API §9.1 | — |
| `011` | Privacy confirmation | `CON-02` | — | — | — | — | — | `AT-PRV-001`,`AT-PRV-002` | RBAC §11 | **D-13** |
| `012` | Accept work | `CON-02` | **`API-164`** | **`CAP_WORK_ACCEPT`** | `CaseAssignment` | →`IN_PROGRESS` | `work_accepted` | `AT-CON-012` | RBAC T7 | — |
| `013` | Decline | `CON-02` | `API-164` | `CAP_WORK_ACCEPT` | `CaseAssignment` | →`ACCEPTED` | `work_declined` | `AT-CON-013` | RBAC §9.3 | — |
| `014` | Eligibility recheck | `CON-02` | `API-164` | — | `ContractorOrganization` | — | — | `AT-ELIG-003` | RBAC §10 | — |
| `015` | Post progress | `CON-03` | **`API-165`** | **`CAP_WORK_PROGRESS`** | `ContractorProgress` | `IN_PROGRESS` | `progress_updated` | `AT-CON-015` | RBAC T-alt | — |
| `016` | Progress evidence | `CON-03` | `API-165` | `CAP_WORK_PROGRESS` | `EvidenceObject` | — | — | `AT-CON-016` | DM §5.8 | — |
| `017` | Submit completion | `CON-04` | **`API-166`** | **`CAP_WORK_COMPLETE`** | `CompletionEvidence` | →`COMPLETION_SUBMITTED` | `completion_submitted` | `AT-PERM-007` | RBAC T8 | — |
| `018` | Edit draft update | `CON-03` | — | — | — | — | — | `AT-CON-018` | DM §5.8 | — |
| `019` | Upload failure | `CON-03`,`CON-04` | `API-165`,`API-166` | — | — | — | — | `AT-CON-019` | API §11 | — |
| `020` | Organisation status | all | all | — | `ContractorOrganization` | — | — | `AT-ELIG-004` | DM §3.4 | — |
| `021` | Reassignment | `CON-01` | — | — | `CaseAssignment` | — | `contractor_assigned` | `AT-CON-021` | RBAC §9.3 | — |
| `022` | `STF-10` official report | `STF-10` | `API-141` | `CAP_REPORT_OFFICIAL` | `CivicReport`,`ConflictExclusion` | →`SUBMITTED` | `report_submitted` | `AT-OFF-001` | CR §12 | **D-09**,**D-11** |
| `023` | Organisation self-dealing | `UCO-03`,`CON-02` | `API-163`,`API-164` | — | `ConflictExclusion` | — | — | `AT-CONF-011` | **none** | **D-06** |
| `024` | Reset/sessions/logout | `STF-07`,`STF-09` | `API-127`,`API-128`,`API-004` | — | `AuthSession` | — | `password_reset`,`session_revoked` | `AT-SESS-001` | API §3.2 | — |

## 1.5 Mayor & Operations — `UC-MAY-001` … `UC-MAY-028`

| UC | Goal | Screens | APIs | Capabilities | Entities | State | Audit | Tests | Src | OD |
|---|---|---|---|---|---|---|---|---|---|---|
| `001` | First-Mayor bootstrap | **none — out of band** | **none** | — | `StaffAccount` | →`ACTIVE` | — | `AT-MAY-001` | CR §16 | **`TBD`** |
| `002` | Invite later Mayor/Ops | `MAY-03`,`MAY-04`,`STF-08` | `API-098` | **`CAP_ACCOUNT_ADMIN`**+`CAP_ROLE_ASSIGN`+step-up | `StaffAccount`,`RoleAssignment` | →`INVITED` | `account_invited` | `AT-MAY-002` | CR §16 | — |
| `003` | Activation | `STF-01`…`STF-03` | `API-123`,`API-124`,`API-105` | — | `StaffCredential` | →`ACTIVE` | `password_set` | `AT-AUTH-006` | API §3.2 | **D-07** |
| `004` | Login | `STF-04`,`STF-05` | `API-005`,`API-125` | — | `AuthSession` | — | `session_created` | `AT-AUTH-004`,`AT-AUTH-005` | API §3.2 | — |
| `005` | Role selection | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-001` | API §3.2 | **D-04**,**D-05** |
| `006` | Operations dashboard | `MAY-01` | scoped reads | role+scope | — | — | — | `AT-MAY-006` | SI §5.5 | — |
| `007` | Scope-limited indicators | `MAY-01` | scoped reads | role+scope | — | — | — | `AT-SCOPE-005` | RBAC §6 | — |
| `008` | Review escalations | `MAY-02` | `GET /reports/{id}` | role+scope | — | any | `report_viewed` | `AT-MAY-008` | SI §5.5 | — |
| `009` | Exceptional intervention | `MAY-07`,`STF-08` | intervention route | **`CAP_EXCEPTIONAL_INTERVENTION`**+step-up | `CivicReport` | varies | `exceptional_intervention` | `AT-PERM-003` | RBAC §3 r23 | — |
| `010` | No ordinary closure | — | **none exists** | — | — | — | — | `AT-PERM-001` | RBAC §3 r21 | — |
| `011` | Provision UC Officer | `MAY-03`,`MAY-04` | `API-098` | `CAP_ACCOUNT_ADMIN` | `StaffAccount` | →`INVITED` | `officer_provisioned` | `AT-MAY-011` | RBAC §3 r28 | — |
| `012` | Invite Mayor/Ops staff | `MAY-03` | `API-098` | `CAP_ACCOUNT_ADMIN` | `StaffAccount` | →`INVITED` | `account_invited` | `AT-MAY-002` | CR §16 | — |
| `013` | Role and scope + expiry | `MAY-04`,`STF-08` | **`API-173`** | **`CAP_ROLE_ASSIGN`**+step-up | `RoleAssignment` | `PENDING` | `role_assigned` | `AT-SCOPE-006` | RBAC §3 r31 | — |
| `014` | Suspend/revoke | `MAY-03`,`STF-08` | **`API-172`** | `CAP_ACCOUNT_ADMIN`+step-up | `StaffAccount` | →`SUSPENDED`/`REVOKED` | `account_suspended` | `AT-SESS-005`,`AT-MAY-014` | RBAC §3 r32 | — |
| `015` | Approve number change | `MAY-03`,`STF-08` | — | `CAP_ACCOUNT_ADMIN`+step-up | `StaffCredential` | — | `phone_changed` | `AT-MAY-015` | SI §5.5 | — |
| `016` | Approve organisation | `MAY-05`,`STF-08` | approval route | `CAP_ACCOUNT_ADMIN`+step-up | `ContractorOrganization` | →`APPROVED` | `organisation_approved` | `AT-MAY-016` | RBAC §3 r30 | — |
| `017` | Suspend organisation | `MAY-05`,`STF-08` | approval route | `CAP_ACCOUNT_ADMIN`+step-up | `ContractorOrganization` | →`SUSPENDED` | — | `AT-ELIG-004` | DM §3.4 | — |
| `018` | Invite contractor | `MAY-03` | `API-098` | `CAP_ACCOUNT_ADMIN` | `StaffAccount` | →`INVITED` | `contractor_provisioned` | `AT-CON-003` | RBAC §3 r29 | — |
| `019` | Civic audit review | `MAY-06` | `API-080` | **`CAP_AUDIT_READ`** | `AuditEvent` | — | `audit_log_viewed` | `AT-AUD-001`,`AT-AUD-002` | RBAC §3 r33 | — |
| `020` | Protected message | `MAY-08`,`STF-08` | **`API-171`** | **`CAP_PROTECTED_CONTACT`**+step-up | `ProtectedContactRequest` | unchanged | `protected_contact_sent` | `AT-PRV-011`,`AT-PRV-012` | RBAC §3 r5 | — |
| `021` | Respect SMS consent | `MAY-08` | `API-171` | `CAP_PROTECTED_CONTACT` | `ConsentRecord` | — | `protected_contact_sent` | `AT-PRV-012` | DM §5.9 | **`TBD`** legal |
| `022` | Decide appeal | `MAY-09`,`STF-08` | **`API-170`** | **`CAP_APPEAL_DECIDE`**+step-up | `Dispute` | `FILED`→`DECIDED` | `appeal_decided` | `AT-CONF-007` | RBAC §9.4 | — |
| `023` | Decider conflict | `MAY-09` | `API-170` | — | `ConflictExclusion` | — | — | `AT-CONF-007`,`AT-CONF-008` | RBAC §9.4 | — |
| `024` | `STF-10` official report | `STF-10` | `API-141` | `CAP_REPORT_OFFICIAL` | `CivicReport`,`ConflictExclusion` | →`SUBMITTED` | `report_submitted` | `AT-OFF-001`,`AT-CONF-003` | CR §12 | **D-09**,**D-11** |
| `025` | Multi-role, no union | `STF-06` | `API-120` | — | `AuthSession` | — | `acting_role_selected` | `AT-ROLE-003` | RBAC §7 | — |
| `026` | Step-up | `STF-08` | `API-126` | — | `AuthSession` | — | `step_up_satisfied` | `AT-STEP-001`,`AT-STEP-002` | RBAC §5 | — |
| `027` | Reset/sessions/logout | `STF-07`,`STF-09` | `API-127`,`API-128`,`API-004` | — | `AuthSession` | — | `password_reset` | `AT-SESS-004` | API §3.2 | — |
| `028` | Suspended/expired/unauth | all | all | — | `StaffAccount` | — | `account_suspended` | `AT-ROLE-004` | RBAC §7 | — |

---

# 2. Reverse coverage — every screen

**58 approved screens. Every one is covered.** `STF-11` is **PROPOSED, not approved**, and is listed separately.

| Screen | Covered by | Screen | Covered by |
|---|---|---|---|
| `CIT-01` | `UC-CIT-001`,`002` | `STF-01` | `UC-REP-002`,`UC-UCO-002`,`UC-CON-004`,`UC-MAY-003` |
| `CIT-02` | `UC-CIT-003` | `STF-02` | `UC-REP-004`,`UC-UCO-002`,`UC-CON-005`,`UC-MAY-003` |
| `CIT-03` | `UC-CIT-004` | `STF-03` | `UC-REP-005`,`UC-UCO-002`,`UC-CON-006`,`UC-MAY-003` |
| `CIT-04` | `UC-CIT-005`,`006`,`008`,`056` | `STF-04` | `UC-REP-006`,`UC-UCO-003`,`UC-CON-007`,`UC-MAY-004` |
| `CIT-05` | `UC-CIT-006`,`007`,`009`,`010`,`011`,`012` | `STF-05` | `UC-REP-006`,`UC-UCO-003`,`UC-CON-007`,`UC-MAY-004` |
| `CIT-06` | `UC-CIT-013`,`014` | `STF-06` | `UC-REP-006`,`018`,`UC-UCO-004`,`027`,`UC-CON-008`,`UC-MAY-005`,`025` |
| `CIT-07` | `UC-CIT-014`,`015` | `STF-07` | `UC-REP-020`,`UC-UCO-028`,`UC-CON-024`,`UC-MAY-027` |
| `CIT-08` | `UC-CIT-016`,`017` | `STF-08` | `UC-REP-019`,`UC-UCO-008`,`012`,`021`,`022`,`UC-MAY-009`,`013`…`017`,`020`,`022`,`026` |
| `CIT-09` | `UC-CIT-018`…`030` | `STF-09` | `UC-REP-021`,`022`,`UC-UCO-028`,`UC-CON-024`,`UC-MAY-027` |
| `CIT-10` | `UC-CIT-033`,`034`,`035` | `STF-10` | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| `CIT-11` | `UC-CIT-028`,`031`,`032`,`036`,`037` | `REP-01` | `UC-REP-007`,`008`,`010` |
| `CIT-12` | `UC-CIT-038`,`039` | `REP-02` | `UC-REP-009`,`010`,`012`,`013` |
| `CIT-13` | `UC-CIT-037`,`040` | `REP-03` | `UC-REP-011` |
| `CIT-14` | `UC-CIT-041` | `REP-04` | `UC-REP-014` |
| `CIT-15` | `UC-CIT-042`,`057` | `UCO-01` | `UC-UCO-005`,`016`,`017`,`018` |
| `CIT-16` | `UC-CIT-044` | `UCO-02` | `UC-UCO-006`,`007`,`008`,`009`,`010` |
| `CIT-17` | `UC-CIT-045` | `UCO-03` | `UC-UCO-011`,`012`,`013` |
| `CIT-18` | `UC-CIT-046` | `UCO-04` | `UC-UCO-014`,`015` |
| `CIT-19` | `UC-CIT-047`,`048` | `UCO-05` | `UC-UCO-019`,`020` |
| `CIT-20` | `UC-CIT-043` | `UCO-06` | `UC-UCO-021` |
| `CIT-21` | `UC-CIT-049`,`050`,`052`,`053`,`054`,`055` | `UCO-07` | `UC-UCO-022`,`023`,`UC-REP-001` |
| `CIT-22` | `UC-CIT-051` | `UCO-08` | `UC-UCO-024` |
| `CIT-23` | `UC-CIT-058` | `CON-01` | `UC-CON-009`,`021` |
| `MAY-01` | `UC-MAY-006`,`007` | `CON-02` | `UC-CON-010`,`011`,`012`,`013`,`014` |
| `MAY-02` | `UC-MAY-008` | `CON-03` | `UC-CON-015`,`016`,`018`,`019` |
| `MAY-03` | `UC-MAY-002`,`011`,`012`,`014`,`015`,`018`,`UC-REP-023` | `CON-04` | `UC-CON-017`,`019` |
| `MAY-04` | `UC-MAY-002`,`011`,`013` | `MAY-07` | `UC-MAY-009` |
| `MAY-05` | `UC-MAY-016`,`017`,`UC-CON-002` | `MAY-08` | `UC-MAY-020`,`021` |
| `MAY-06` | `UC-MAY-019` | `MAY-09` | `UC-MAY-022`,`023` |

**Orphan check: 0 approved screens uncovered.**

| Not in the approved inventory | Status |
|---|---|
| **`STF-11 — My Official Reports`** | **PROPOSED (D-03).** Referenced **only** in `UC-REP-017` inside a labelled branch. **Approving it would move the total from 58 to 59** |

# 3. Reverse coverage — every API

| API | Route | Covered by |
|---|---|---|
| `API-003` | `POST /auth/refresh` | `UC-CIT-056` |
| `API-004` | `POST /auth/logout` | `UC-CIT-053`,`UC-REP-022`,`UC-UCO-028`,`UC-CON-024`,`UC-MAY-027` |
| `API-005` | `POST /auth/staff/login` | `UC-REP-006`,`UC-UCO-003`,`UC-CON-007`,`UC-MAY-004` |
| `API-080` | `GET /reports/{id}/history` | `UC-UCO-024`,`UC-MAY-019` |
| `API-098` | `POST /staff/accounts` | `UC-REP-001`,`UC-UCO-001`,`022`,`UC-CON-003`,`UC-MAY-002`,`011`,`012`,`018` |
| `API-105` | `POST /auth/staff/password/set` | `UC-REP-005`,`UC-UCO-002`,`UC-CON-006`,`UC-MAY-003` |
| `API-120` | `POST /auth/role/select` | `UC-REP-006`,`018`,`UC-UCO-004`,`027`,`UC-CON-008`,`UC-MAY-005`,`025` |
| `API-121` | `POST /auth/citizen/otp/request` | `UC-CIT-006`,`007` |
| `API-122` | `POST /auth/citizen/otp/verify` | `UC-CIT-009`,`010`,`011`,`012` |
| `API-123` | `POST /auth/staff/invitation/accept` | `UC-REP-002`,`003`,`UC-UCO-002`,`UC-CON-004`,`UC-MAY-003` |
| `API-124` | `POST /auth/staff/otp/verify` | `UC-REP-004`,`UC-UCO-002`,`UC-CON-005`,`UC-MAY-003` |
| `API-125` | `POST /auth/staff/login/otp` | `UC-REP-006`,`UC-UCO-003`,`UC-CON-007`,`UC-MAY-004` |
| `API-126` | `POST /auth/step-up` | `UC-REP-019`,`UC-MAY-026` |
| `API-127` | `POST /auth/staff/password/reset` | `UC-REP-020`,`UC-UCO-028`,`UC-CON-024`,`UC-MAY-027` |
| `API-128` | `GET`·`DELETE /auth/sessions` | `UC-CIT-054`,`UC-REP-021`,`UC-UCO-028`,`UC-CON-024`,`UC-MAY-027` |
| `API-130` | `POST /{subject}/drafts` | `UC-CIT-014`,`015`,`UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| `API-131` | evidence upload | `UC-CIT-016`,`018`,`023` |
| `API-132` | evidence complete | `UC-CIT-023` |
| `API-133` | `GET /{subject}/drafts/{id}` | `UC-CIT-025`,`038` |
| `API-134` | `GET .../rendering` | `UC-CIT-024`,`028`,`032` |
| `API-135` | `POST .../rendering/confirm` | `UC-CIT-031`,`032`,`UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| `API-136` | `POST .../rendering/review` | `UC-UCO-010`,`UC-REP-013` |
| `API-140` | `POST /citizen/reports` | `UC-CIT-037`,`039`,`040` |
| `API-141` | `POST /staff/reports/official` | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| `API-150` | `GET /citizen/reports` | `UC-CIT-041` |
| `API-151` | `GET /citizen/reports/{id}` | `UC-CIT-042`,`045`,`057` |
| `API-152` | clarify | `UC-CIT-044` |
| `API-153` | confirm | `UC-CIT-046` |
| `API-154` | dispute | `UC-CIT-047`,`048` |
| `API-155` | `GET`·`PATCH /citizen/profile` | `UC-CIT-049`,`050`,`052`,`055` |
| `API-156` | `POST /citizen/phone/change` | `UC-CIT-051` |
| `API-160` | field verification | `UC-REP-010` |
| `API-161` | accept | `UC-UCO-007` |
| `API-162` | reject | `UC-UCO-008` |
| `API-163` | assign | `UC-UCO-012`,`013`,`014`,`UC-CON-023` |
| `API-164` | work accept/decline | `UC-CON-012`,`013`,`014`,`023` |
| `API-165` | progress | `UC-CON-015`,`016`,`018`,`019` |
| `API-166` | completion | `UC-CON-017`,`019` |
| `API-167` | completion verification | `UC-REP-011` |
| `API-168` | close | `UC-UCO-021` |
| `API-169` | reopen | `UC-UCO-019`,`UC-MAY-009` |
| `API-170` | appeal decide | `UC-MAY-022`,`023` |
| `API-171` | protected contact | `UC-MAY-020`,`021` |
| `API-172` | suspend/revoke | `UC-MAY-014` |
| `API-173` | role assignments | `UC-MAY-013` |
| `GET /geo/reverse` | reverse geocode | `UC-CIT-033`,`034` |
| `GET /citizen/reports/summary` | home counts | `UC-CIT-013` |
| `GET /citizen/notifications` | notifications | `UC-CIT-043` |

**Orphan check: 0 endpoints uncovered.**

# 4. Reverse coverage — every capability

| Capability | Covered by | Denial tested by |
|---|---|---|
| `CAP_REPORT_SUBMIT` | `UC-CIT-037` | — |
| `CAP_REPORT_OWN_VIEW` | `UC-CIT-041`,`042` | `AT-SCOPE-001` |
| **`CAP_RENDERING_CONFIRM_OWN`** | `UC-CIT-031`,`UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` | `AT-CONF-002`,`003`,`004` |
| **`CAP_REPORT_OFFICIAL`** | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` | `AT-OFF-002` |
| `CAP_FIELD_VERIFY` | `UC-REP-010` | `AT-CONF-009` |
| `CAP_COMPLETION_VERIFY` | `UC-REP-011` | `AT-PERM-007` |
| `CAP_CASE_TRIAGE` | `UC-UCO-005`,`006` | `AT-PERM-005` |
| `CAP_CASE_ACCEPT` | `UC-UCO-007` | `AT-STATE-003` |
| `CAP_CASE_REJECT` | `UC-UCO-008` | `AT-PERM-002` |
| `CAP_CASE_CLARIFY` | `UC-REP-012`,`UC-UCO-009` | — |
| `CAP_CASE_ASSIGN` | `UC-UCO-012`,`014` | `AT-PERM-006`,`AT-STATE-008` |
| **`CAP_CASE_CLOSE`** | `UC-UCO-021` | **`AT-PERM-001`** |
| `CAP_WORK_ACCEPT` | `UC-CON-012` | `AT-ELIG-003` |
| `CAP_WORK_PROGRESS` | `UC-CON-015` | — |
| `CAP_WORK_COMPLETE` | `UC-CON-017` | `AT-PERM-007` |
| `CAP_REP_INVITE` | `UC-UCO-022`,`UC-REP-001` | `AT-PERM-004`,`AT-SCOPE-002` |
| `CAP_ACCOUNT_ADMIN` | `UC-MAY-002`,`011`,`014`,`016`,`018` | `AT-PERM-005` |
| `CAP_ROLE_ASSIGN` | `UC-MAY-013` | `AT-SCOPE-006` |
| `CAP_AUDIT_READ` | `UC-UCO-024`,`UC-MAY-019` | `AT-AUD-002` |
| `CAP_AUDIT_INTEGRITY_VERIFY` | **no civic use case — SYSADMIN only** | `AT-SYS-001` |
| `CAP_APPEAL_DECIDE` | `UC-MAY-022` | `AT-CONF-007` |
| `CAP_CASE_REOPEN` | `UC-UCO-019`,`UC-MAY-009` | — |
| `CAP_ESCALATION` | `UC-UCO-015` | — |
| `CAP_EXCEPTIONAL_INTERVENTION` | `UC-MAY-009` | `AT-PERM-003` |
| `CAP_PROTECTED_CONTACT` | `UC-MAY-020` | `AT-PRV-011` |
| `CAP_TRANSCRIPT_REVIEW` | `UC-UCO-010` | `AT-CONF-004` |
| `CAP_EXPORT` | **no use case in this pack** | — |
| `CAP_SAFEGUARDING` | **no use case in this pack** | — |

## 4.1 Capabilities deliberately without a use case

| Capability | Why | Status |
|---|---|---|
| `CAP_AUDIT_INTEGRITY_VERIFY` | Held **only** by the Technical System Administrator, which **is not a civic portal and has no civic application login**. Correctly absent | **Explained, not orphaned** |
| `CAP_EXPORT` | Named in RBAC v1.3 §2 with step-up, but **no screen in the approved inventory surfaces it** and no export flow is specified | **`TBD — Hassan decision required`: which screen offers export, and what de-identification checklist applies** |
| `CAP_SAFEGUARDING` | Marked **P1** in the Moderator responsibility mapping. **Out of Release 0 scope** | **Deferred by the source, not by this pack** |

# 5. Reverse coverage — every state transition

| # | Transition | Actor | Use case | Test |
|---|---|---|---|---|
| **T1** | *(none)* → `SUBMITTED` | Reporter | `UC-CIT-037`,`UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` | `AT-PIPE-002`,`AT-PIPE-003` |
| T2 | `SUBMITTED` → `UNDER_VERIFICATION` | System | `WF-02` step 1 | `AT-STATE-001` |
| T3 | `UNDER_VERIFICATION` → `VERIFIED` | REP | `UC-REP-010` | `AT-STATE-002` |
| T4 | `VERIFIED` → `UC_REVIEW` | System | `WF-02` step 3 | `AT-STATE-002` |
| T5 | `UC_REVIEW` → **`ACCEPTED`** | UCO | `UC-UCO-007` | `AT-STATE-003` |
| T6 | `ACCEPTED` → `CONTRACTOR_ASSIGNED` | UCO | `UC-UCO-012` | `AT-STATE-004` |
| T7 | `CONTRACTOR_ASSIGNED` → `IN_PROGRESS` | CON | `UC-CON-012` | `AT-CON-012` |
| T8 | `IN_PROGRESS` → `COMPLETION_SUBMITTED` | CON | `UC-CON-017` | `AT-PERM-007` |
| T9 | `COMPLETION_SUBMITTED` → `COMPLETION_VERIFICATION` | System | `WF-06` step 6 | `AT-STATE-005` |
| T10 | `COMPLETION_VERIFICATION` → `PENDING_CITIZEN_CONFIRMATION` | REP | `UC-REP-011` | `AT-STATE-005` |
| T11 | `PENDING_CITIZEN_CONFIRMATION` → `RESOLVED_CONFIRMED` | CIT | `UC-CIT-046` | `AT-STATE-006` |
| **T12** | `RESOLVED_CONFIRMED` → **`CLOSED`** | **UCO only** | `UC-UCO-021` | `AT-PERM-001`,`AT-STATE-009` |
| A1 | `UNDER_VERIFICATION` → `UC_REVIEW` *(failed / inaccessible / duplicate)* | REP | `UC-REP-010` | `AT-REP-010` |
| A2 | `UC_REVIEW` → `REJECTED` | UCO | `UC-UCO-008` | `AT-PERM-002` |
| A3 | `CONTRACTOR_ASSIGNED` → `ACCEPTED` *(decline)* | CON | `UC-CON-013` | `AT-CON-013` |
| A4 | `CONTRACTOR_ASSIGNED` → `ACCEPTED` *(lapse)* | System | `UC-UCO-016` | `AT-UCO-016` |
| A5 | `COMPLETION_VERIFICATION` → `IN_PROGRESS` | REP | `UC-REP-011` | `AT-REP-011` |
| A6 | `PENDING_CITIZEN_CONFIRMATION` → `REOPENED` | CIT | `UC-CIT-047` | `AT-STATE-007` |
| A7 | `REOPENED` → `IN_PROGRESS`/`ACCEPTED` | UCO | `UC-UCO-019`,`020` | `AT-UCO-019` |
| A8 | → `CANCELLED` | UCO | `UC-UCO-019` | `AT-UCO-019` |
| A9 | `CLOSED` → `REOPENED` | UCO/MAY | `UC-UCO-019`,`UC-MAY-009` | `AT-MAY-009` |
| A10 | → *held unresolvable* | System | `UC-REP-011`,`UC-UCO-016` | `AT-UCO-016` |
| **Prohibited** | `UC_REVIEW` → `CONTRACTOR_ASSIGNED` | — | `UC-UCO-012` | **`AT-STATE-008`** |
| **Prohibited** | Creation in any state but `SUBMITTED` | — | `UC-CIT-037` | **`AT-PIPE-005`** |
| **Prohibited** | Creation without confirmation | — | `UC-CIT-031` | **`AT-CONF-001`** |
| **Prohibited** | `RESOLVED_CONFIRMED` → `CLOSED` by non-`UCO` | — | `UC-MAY-010` | **`AT-PERM-001`** |

**All 12 canonical transitions, 10 alternates and 4 prohibited transitions are covered. `DRAFT` appears nowhere — it is not a `CivicReport` state.**

## 5.1 Pipeline states — `ClientSubmission`

| State | Use case | Test |
|---|---|---|
| `LOCAL_DRAFT` | `UC-CIT-014`,`022` | `AT-PIPE-001` |
| `WAITING_FOR_CONNECTION` | `UC-CIT-038` | `AT-OFF-003` |
| `UPLOADING` | `UC-CIT-023` | `AT-CIT-023` |
| `TRANSCRIPTION_PROCESSING` | `UC-CIT-024`,`026` | `AT-AI-011` |
| **`AWAITING_REPORTER_REVIEW`** | `UC-CIT-028` | `AT-PIPE-006` |
| `READY_TO_SUBMIT` | `UC-CIT-031` | `AT-CONF-001` |
| `SUBMISSION_FAILED` | `UC-CIT-039` | `AT-IDEM-002` |

## 5.2 `Dispute.appeal_status`

| Value | Use case | Test |
|---|---|---|
| `NOT_FILED` | default | — |
| `FILED` | `WF-22` step 3 | `AT-CONF-007` |
| `UNDER_REVIEW` | `UC-MAY-022` | `AT-CONF-007` |
| `DECIDED` | `UC-MAY-022` | `AT-CONF-007` |

# 6. Portal function coverage and test counts

| Portal | Use cases | Screens | Named tests | Blocker decisions |
|---|--:|--:|--:|--:|
| Citizen | 58 | 23 | 61 | 2 *(D-13, D-14 as High)* |
| Street Representative | 24 | 14 shared+own | 34 | 4 |
| UC Officer | 29 | 18 shared+own | 38 | 4 |
| Contractor | 24 | 14 shared+own | 30 | 3 |
| Mayor & Operations | 28 | 19 shared+own | 33 | 3 |
| **Cross-portal** | 23 workflows | — | traced above | — |

# 7. Open-decision impact index

| Decision | Use cases affected |
|---|---|
| **D-01** *(confirmation state)* | `UC-REP-011`,`UC-UCO-018`,`UC-CIT-045`,`046`,`WF-07`,`WF-10` |
| **D-02** *(staff report tracking)* | `UC-REP-017`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024`,`WF-10` |
| **D-03** *(`STF-11`)* | `UC-REP-017` |
| **D-04 / D-05** *(role-selection circularity)* | `UC-REP-006`,`UC-UCO-004`,`UC-CON-008`,`UC-MAY-005` — **every staff journey** |
| **D-06** *(organisation self-dealing)* | `UC-UCO-011`,`012`,`UC-CON-023`,`WF-05` |
| **D-07** *(purpose-bound tickets)* | `UC-REP-004`,`020`,`UC-UCO-002`,`UC-CON-005`,`UC-MAY-003`,`WF-16` |
| **D-08** *(consent integrity)* | `UC-CIT-004`,`006`,`009` |
| **D-09** *(staff voice notice)* | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| **D-10** *(local encryption)* | `UC-CIT-022`,`038`,`039`,`WF-20` |
| **D-11** *(`STF-10` offline)* | `UC-REP-015`,`UC-UCO-025`,`UC-CON-022`,`UC-MAY-024` |
| **D-12** *(two idempotency keys)* | `UC-CIT-031`,`032`,`037`,`039`,`WF-21` |
| **D-13** *(no citizen name)* | `UC-REP-009`,`UC-UCO-006`,`UC-CON-011`,`UC-MAY-019` — **every privacy assertion** |
| **D-14** *(mandatory photo)* | `UC-CIT-016`,`036`,`037` + all four `STF-10` use cases |
| **D-15** *(SRS superseded)* | none directly — it governs precedence |

---

*Specified; not implemented; not tested. No use case in this matrix has been implemented and no test has been executed.*
