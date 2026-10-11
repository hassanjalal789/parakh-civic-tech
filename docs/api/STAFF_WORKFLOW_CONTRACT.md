# Staff workflow routes — as built (PROPOSED where marked)

Implements API Contract v3.1 §8.2 and the RBAC matrix v1.4 §3, §9–§10, server side only. No staff screen and no staff sign-in exist yet; tests create staff sessions directly. Built 2026-10-11 (`VAL-090`, `VAL-091`).

## Transport

- `Authorization: Bearer <staff access token>` and `X-Acting-Role-Assignment-ID: <uuid>` on every request. The header is a claim, never a grant.
- The six checks (`parakh/staff/authorization.py`), in the order of API Contract §4, denying on the first failure: the claim names the session's selected assignment, owned by the account (`403 E_ROLE_ASSIGNMENT_INVALID`, audited `unauthorised_access_attempt` when it names another account's) · it, the account and a contractor's organisation are valid now (`403 E_ROLE_ASSIGNMENT_INVALID`) · the role may do this (`403 E_FORBIDDEN`) · scope covers the report (otherwise the uniform `404`) · the acting **account** is not excluded (`403 E_CONFLICT_EXCLUDED`) · step-up within 10 minutes where required (`401 E_STEP_UP_REQUIRED`).
- Every body carries `state_version`; a different version is `409 E_STALE_STATE`, except a retry of the same step by the same account, which returns the result again and changes nothing.
- Responses: `{report_id, state, state_version}`; contractor routes return the work packet (below). `Cache-Control: no-store`. A person's reason or note is kept on the step's record, never in the audit trail.

## Routes

| ID | Route | Role | From → to | Body |
|---|---|---|---|---|
| API-160 | `POST /reports/{id}/field-verification` | REP | `UNDER_VERIFICATION` → `VERIFIED` → (system, T4) `UC_REVIEW`; or → `UC_REVIEW` | `outcome` ∈ `verified`, `not_verified`, `location_inaccessible`, `duplicate_suspected` · `reason` (required) · `linked_report_reference` (duplicate only, in scope) · `evidence_ids` (optional) |
| API-161 | `POST /reports/{id}/accept` | UCO | `UC_REVIEW` → `ACCEPTED` | `note` (optional) |
| *(PROPOSED, `DG-43`)* | `GET /reports/{id}/eligible-contractors` | UCO | — | Eligible organisations only, in name order; never ranked (BR-020) |
| API-163 | `POST /reports/{id}/assign` | UCO, step-up | `ACCEPTED` → `CONTRACTOR_ASSIGNED` | `contractor_organization_id` (all five eligibility checks again) · `note` = work instructions |
| API-164 | `POST /reports/{id}/work/accept` | CON | `CONTRACTOR_ASSIGNED` → `IN_PROGRESS` | Eligibility re-checked at the point of action |
| API-165 | `POST /reports/{id}/progress` | CON | stays `IN_PROGRESS` | `note`, `percent` 0–100, `evidence_ids` (at least one of them) |
| API-166 | `POST /reports/{id}/completion` | CON | `IN_PROGRESS` → `COMPLETION_SUBMITTED` → (system, T9) `COMPLETION_VERIFICATION` | `note` (required) · `evidence_ids` (required) |
| API-167 | `POST /reports/{id}/completion-verification` | REP, never the completer | `COMPLETION_VERIFICATION` → `PENDING_CITIZEN_CONFIRMATION`, or → `IN_PROGRESS` | `outcome` ∈ `verified`, `rejected` · `reason` (required) · `evidence_ids` (required when verified) |
| API-168 | `POST /reports/{id}/close` | UCO only, step-up | `RESOLVED_CONFIRMED` → `CLOSED` | `reason` (required) |
| API-169 | `POST /reports/{id}/reopen` | UCO or MAY, step-up | `CLOSED` → `REOPENED` | `reason` (required) |
| *(PROPOSED, `DG-43`)* | `POST /reports/{id}/dispute/handle` | UCO, step-up | `REOPENED` → `IN_PROGRESS` (rework) or `ACCEPTED` (reassign; the assignment ends) | `handling` ∈ `rework`, `reassign` · `reason` (required) |

- **Evidence** named in `evidence_ids` must be sealed photos or videos that **this account** captured for **this report** (an `EvidenceObject` with no draft, `uploaded_by_kind = staff`). The upload route for staff evidence is not built yet.
- **T9 routing:** if no Street Representative other than the completer can act in the report's scope, the report stays `COMPLETION_SUBMITTED`, audited `case_unresolvable` — never routed back to the completer.
- **Staff-official reports:** a verified completion is refused (`409 E_DECISION_PENDING`) until `DG-20` decides who confirms.

## Contractor work packet (API §9.1; `DG-80`, `DG-83`)

`report_reference` · `category` · `location` — the final reported coordinates; without them the written description; a voice-only location is `{"spoken_only": true}` with no recording · `urdu_civic_rendering` (confirmed version) · `work_instructions`. **Never:** citizen identity or number, the original recording, the location recording, ASR output, the transcription, the measured position or its accuracy, the official reporter, staff notes. **Photos and video are not included** until their redaction is decided (`DG-92`).

## Not built — waiting for a decision

| Step | Why | ID |
|---|---|---|
| T2 automatic routing (`SUBMITTED` → `UNDER_VERIFICATION`) | Nothing places a report in a Union Council | `DG-86` |
| API-162 reject | No coded reason list | `DG-87` |
| API-164 decline; the assignment lapse | No allowed reasons; no response window | `DG-88` |
| Cancellation | No defined conditions | `DG-89` |
| Escalation | What it does is not defined | `DG-90` |
| API-170 appeal | How an appeal is filed is not defined | `DG-91` |
| Photos in the work packet | Redaction not defined | `DG-92` |
