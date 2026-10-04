# Parakh — Test Catalogue: Identity, Authentication and Reporting Foundation

| Field | Value |
|---|---|
| **Version** | **1.1** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not executed.** |
| **Authority** | **Mobile SRS v2.1.0** · **CR-61 rev 1.3** · RBAC **v1.4** · Data Model **v1.4** · Screen Inventory **v1.4** · API Contract **v3.1** · **instruction of 3 Oct 2026** |
| **Scope** | The identity, authentication, RBAC, data-model, reporting-foundation and privacy decisions locked by CR-61 rev 1.3 |

## Revision history

| Version | Date | Change |
|---|---|---|
| **1.0** | **2 Sep 2026** | Initial consolidated catalogue for the finalised architecture foundation |
| **1.1** | **3 Oct 2026** | **Reconciled to the v1.4 / v3.1 document set.** New groups added for **`DR-28` optional photo**, **`DR-29` OTP expiry/resend/attempt/lockout**, **`DR-31` purpose-binding**, **`DR-32` consent integrity**, **`DR-30` dual idempotency**, **`STF-11` ownership read and self-review exclusion**, and **Street Rep → UC Officer verification and forwarding permissions**. **Still zero tests written and zero executed.** |

> **Nothing in this catalogue has been written as code, run, or observed to pass or fail.** Every entry is a **specification of expected behaviour**. **No test result is claimed.**

> **Scope boundary.** These are architecture-level assertions. **Detailed acceptance scenarios per actor belong to the future portal use-case phase** and are not written here.

---

## 1. How to read this catalogue

| Column | Meaning |
|---|---|
| **ID** | Stable identifier. Referenced from the RBAC matrix, data model, screen inventory and API contract |
| **Assertion** | The behaviour that must hold |
| **Fails if** | The specific observable that would constitute a failure |
| **Status** | **Always `Specified; not implemented; not executed`** |

A test whose "fails if" column is empty or unfalsifiable is **not a test**. Every row below names a concrete failing observable.

---

## 2. Authentication — citizen

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-AUTH-C01` | **Citizen login requires a mobile OTP and no password** | Any citizen authentication route accepts, requires or stores a password |
| `TEST-AUTH-C02` | The **first** successful OTP verification creates a `CitizenAccount` | A second account is created for the same normalised number |
| `TEST-AUTH-C03` | A **later** successful OTP verification signs in to the existing account | A duplicate account is created, or a returning citizen loses their report history |
| `TEST-AUTH-C04` | Citizen authentication is **single-factor (possession)** | Any document, response or error string describes citizen login as two-factor |
| `TEST-AUTH-C05` | OTP request and verify responses are **uniform** whether or not the number is registered | Response body, status code or timing class differs measurably between registered and unregistered numbers |
| `TEST-AUTH-C06` | **No OTP operation succeeds offline** | The client verifies an OTP without a network round trip, or stores a code for later verification |
| `TEST-AUTH-C07` | An abandoned onboarding creates **no account and no consent record** | A `CitizenAccount` or `ConsentRecord` exists after an unverified OTP challenge expires |
| `TEST-AUTH-C08` | Required and optional consent are stored as **separate rows** | One row carries both, or withdrawing SMS consent deactivates the account |
| `TEST-AUTH-C09` | **No citizen phone number is returned to any operational role** | Any `REP`, `UCO`, `CON` or `MAY` response contains a citizen number in any form, masked or otherwise |
| `TEST-AUTH-C10` | A citizen sees only their **own** number, masked | A full number is rendered anywhere in the citizen UI |

## 3. Authentication — the four civic staff portals

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-AUTH-S01` | **All four civic staff roles use password plus SMS OTP** | Any role authenticates by a different method, or a role-specific login technology exists |
| `TEST-AUTH-S02` | **Staff authentication is two-factor, never three** | Any document, response or error string uses "three-factor", or counts the mobile number as a factor |
| `TEST-AUTH-S03` | **An administrator never sets a staff member's password** | Any route, admin screen or support procedure permits an administrator to choose, view, transmit or store another user's password |
| `TEST-AUTH-S04` | A password is **never transmitted** by SMS, email, WhatsApp or on paper | Any generated message body contains a password |
| `TEST-AUTH-S05` | **Staff public signup is rejected** | Any unauthenticated route creates a `StaffAccount` or issues a staff invitation |
| `TEST-AUTH-S06` | An invitation is **single-use and phone-bound** | Activation succeeds with a number other than `intended_phone_lookup_hmac`, or a consumed invitation is reusable |
| `TEST-AUTH-S07` | **An active `StaffAccount` without an active `RoleAssignment` has no portal privileges** | Any staff endpoint returns data to such an account |
| `TEST-AUTH-S08` | Password reset **revokes all existing sessions** | A pre-reset session remains usable |
| `TEST-AUTH-S09` | Password reset **cannot reactivate** a suspended, revoked or expired account | Such an account authenticates after a reset |
| `TEST-AUTH-S10` | Suspension or revocation **invalidates active sessions** | A suspended account performs an action on its existing session |
| `TEST-AUTH-S11` | **No TOTP, passkey, WebAuthn or hardware-key route exists** | Any such route, entity or configuration is present |
| `TEST-AUTH-S12` | The **login OTP satisfies the 10-minute step-up window** | A step-up OTP is demanded immediately after a successful login |
| `TEST-AUTH-S13` | Step-up **is** demanded once `recent_auth_at` is older than 10 minutes | A sensitive action succeeds without a fresh OTP after the window |
| `TEST-AUTH-S14` | **`staff_reference` is never accepted as a login identifier** | Any authentication route resolves an account from `staff_reference` |

## 4. Technical System Administrator

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-SYS-001` | **SYSADMIN has no civic access** | It reads a report, evidence, voice recording, rendering, citizen identity, staff note or civic audit narrative |
| `TEST-SYS-002` | SYSADMIN is **absent from the civic authentication matrix** | It appears as a row or column in the authentication or permission matrix |
| `TEST-SYS-003` | SYSADMIN holds **no civic `RoleAssignment`** | Any `RoleAssignment` row names it |
| `TEST-SYS-004` | Integrity verification returns **hash-chain results only** | Any civic content appears in an integrity-verification response |
| `TEST-SYS-005` | **No civic API route authenticates a Technical System Administrator** | Such a route exists |

## 5. Multi-role architecture and conflict of interest

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-ROLE-001` | **A multi-role user acts under exactly one assignment at a time** | Permissions from two assignments are combined in one request |
| `TEST-ROLE-002` | An acting assignment belonging to another account is **denied at check 1** | Such a request succeeds, or is denied at a later check that leaks which check failed |
| `TEST-ROLE-003` | A role assignment expiring **mid-session** downgrades the session on the next action | The session retains the expired privilege until logout |
| `TEST-ROLE-004` | Role switching is **explicit** | A role changes implicitly as a side effect of navigation |
| `TEST-ROLE-005` | An assigner **cannot grant a scope broader or a role more privileged than its own** | Such a grant succeeds |
| `TEST-CONF-001` | **A staff reporter is excluded from acting on their own report under every role** | The reporting account verifies, accepts, assigns, approves, closes, or decides a dispute or appeal on that report under any assignment |
| `TEST-CONF-002` | The exclusion is keyed on the **account**, not the assignment | Switching role bypasses it |
| `TEST-CONF-003` | The exclusion survives a **later** role grant | A new assignment clears it |
| `TEST-CONF-004` | Own reports **never appear** in the reporter's own work queue | Such an item is listed |
| `TEST-CONF-005` | When no eligible actor remains, the case is **flagged unresolvable and held** | It is auto-approved or routed back to the conflicted account |

## 6. Official staff reporting

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-OFF-001` | **Staff can access the shared official-report function when authorised** | A `UCO`, `CON` or `MAY` account holding `CAP_REPORT_OFFICIAL` cannot reach `STF-10` |
| `TEST-OFF-002` | `STF-10` is **unreachable without `CAP_REPORT_OFFICIAL`** | An account lacking the capability reaches it |
| `TEST-OFF-003` | **`REP-05` does not exist** in the navigation graph or API surface | Any route or screen resolves `REP-05` |
| `TEST-OFF-004` | Exactly **one acting `RoleAssignment`** is recorded on an official report | Zero or more than one is recorded |
| `TEST-OFF-005` | Submission **creates a `ConflictExclusion`** in the same transaction | The report exists without one |
| `TEST-OFF-006` | **Service accounts and automated integrations cannot hold `CAP_REPORT_OFFICIAL`** | Such an account submits an official report |
| `TEST-OFF-007` | An official report's **staff identity is never returned** to a citizen or Representative view | It appears in either |

## 7. Rendering confirmation

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-CONF-R01` | **A reporter can confirm only their own rendering** | Any subject confirms another subject's draft |
| `TEST-CONF-R02` | **Staff cannot confirm a citizen's rendering** | Such a confirmation succeeds |
| `TEST-CONF-R03` | **Staff cannot confirm another staff user's rendering** | Such a confirmation succeeds |
| `TEST-CONF-R04` | **A transcript reviewer cannot confirm on the reporter's behalf** | `CAP_TRANSCRIPT_REVIEW` produces a confirmation rather than a new version |
| `TEST-CONF-R05` | **A stale rendering confirmation is rejected** | A confirmation naming a superseded `rendering_version` creates a report |
| `TEST-CONF-R06` | **A mismatched content hash is rejected** | A confirmation whose `rendering_content_hash` differs from the stored value creates a report |
| `TEST-CONF-R07` | A rejected confirmation returns a **documented conflict error** and the client fetches the latest version | The server silently upgrades the confirmation to the newer version |
| `TEST-CONF-R08` | A **replayed idempotency key returns the original report** | A second `CivicReport` is created |
| `TEST-CONF-R09` | Confirmation is **not** treated as a claim of objective AI accuracy | Any screen or document describes it that way |

## 8. Draft pipeline versus `CivicReport`

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-PIPE-001` | **A queued draft has no `CivicReport` and no official reference** | A queued draft displays or returns a `report_reference` |
| `TEST-PIPE-002` | **`CivicReport.state` has no `DRAFT` value** | The enum, a migration, an API response or a document contains it |
| `TEST-PIPE-003` | **A `CivicReport` can be created only in `SUBMITTED`** | Any route or fixture creates one in another state |
| `TEST-PIPE-004` | The **report reference is issued in the same transaction** that creates the report | A reference exists before the row, or a row exists without one |
| `TEST-PIPE-005` | Report creation without a valid confirmation returns **`422 E_RENDERING_NOT_CONFIRMED`** | Creation succeeds |
| `TEST-PIPE-006` | Offline retry with the same `client_submission_id` creates **no duplicate report** | Two reports result |
| `TEST-PIPE-007` | Concurrent retries produce **exactly one** `CivicReport` | Two or zero result |
| `TEST-PIPE-008` | **`AWAITING_REPORTER_REVIEW`** is the pipeline state name | `AWAITING_CITIZEN_REVIEW` appears in any active document, enum or response |
| `TEST-PIPE-009` | Assignment is reachable **only from `ACCEPTED`** | A report moves from `UC_REVIEW` directly to `CONTRACTOR_ASSIGNED` |
| `TEST-PIPE-010` | Ordinary closure is **`UCO` only** | `MAY` performs an action recorded as an ordinary closure |

## 9. AI processing and failure

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-AI-001` | **AI failure does not bypass reporter confirmation** | A `CivicReport` is created from an artefact with `processing_status = REVIEW_REQUIRED` and no reporter confirmation |
| `TEST-AI-002` | AI failure **preserves the encrypted draft and the original recording** | Either is lost |
| `TEST-AI-003` | **`TRANSCRIPTION_REVIEW_REQUIRED` is not a submission path** | Any route, document or enum treats it as one |
| `TEST-AI-004` | **No plausible replacement text is generated** on failure | The rendering contains model-invented content not derived from the recording |
| `TEST-AI-005` | **The original recording is never overwritten** by AI output | The stored `voice_original` object changes after processing |
| `TEST-AI-006` | A correction creates a **new `rendering_version`**; prior versions remain traceable | A version is replaced in place, or a prior version becomes unreachable |
| `TEST-AI-007` | `model_name` and `model_version` are recorded on **every** artefact | Either is null |
| `TEST-AI-008` | **Low-confidence fields are individually identifiable** | Confidence is only reported as a single overall score |
| `TEST-AI-009` | **AI makes no final decision** on verification, acceptance, rejection, assignment, completion, dispute, appeal or closure | Any transition is recorded with `actor_kind` other than a human or a permitted automatic routing step |
| `TEST-AI-010` | **AI-generated text is labelled** on every screen and in every response that carries it | An unlabelled rendering is shown |
| `TEST-AI-011` | **No document presents AI processing as available offline** | Any document or screen claims on-device transcription |
| `TEST-AI-012` | **Audio-only official submission does not exist in Release 0** | A report is created with no rendering |

## 10. Privacy and evidence access

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-PRV-001` | **A contractor cannot access original citizen audio** | Any contractor response, URL, link or screen exposes a `voice_original` object |
| `TEST-PRV-002` | **A contractor cannot read the intermediate ASR output** | `source_asr_text` appears in any contractor response |
| `TEST-PRV-003` | The contractor packet contains **no citizen identity** — no number, account ID or name | Any appears |
| `TEST-PRV-004` | Filtering is **server-side** | The field is present in the payload but hidden by the template |
| `TEST-PRV-005` | Representative and UC Officer audio access is **scope-limited** | Out-of-scope audio is retrievable |
| `TEST-PRV-006` | Mayor & Ops audio access is **audited** | An access produces no audit event |
| `TEST-PRV-007` | The **citizen is not shown the ASR output** | It appears in a citizen response |
| `TEST-PRV-008` | **No phone number, OTP, password, token or unrestricted rendering appears in any log, audit event, analytics event, crash report or error object** | Any does |
| `TEST-PRV-009` | Protected contact **reveals no number** and respects SMS consent | A number is rendered, or an SMS is sent without consent |
| `TEST-PRV-010` | An evidence `storage_key` contains **no phone number, account ID or name** | It does |
| `TEST-PRV-011` | **No actor can update or delete an `AuditEvent`** | Any does, including the audit service |

## 11. Language and voice

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-LANG-001` | **Punjabi speech is accepted** and produces an Urdu-script rendering | Punjabi input is rejected or produces a non-Urdu rendering |
| `TEST-LANG-002` | **No Punjabi written interface is offered** | A Punjabi UI option is selectable |
| `TEST-LANG-003` | **No active document describes Roman Urdu as a spoken language** | Any does |
| `TEST-LANG-004` | The approved ASR-script wording is used where scripts are described | A document claims the ASR output is always Urdu script |
| `TEST-LANG-005` | The civic rendering is **always Urdu script**, even when the interface is English | An English rendering is produced |
| `TEST-LANG-006` | `preferred_language` accepts **only `ur` and `en`** | Another value is stored |
| `TEST-LANG-007` | An English→Urdu transformation is **not labelled transcription** | A field name or document string calls it word-for-word transcription |
| `TEST-LANG-008` | RTL layout renders correctly with **LTR digits** | Digits or phone numbers reverse inside RTL text |

## 12. Technology and terminology hygiene

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-TECH-001` | **No active citizen-application document specifies Flutter** | Any active document instructs the use of Flutter |
| `TEST-TECH-002` | Historical Flutter references are **clearly labelled superseded** | An unlabelled Flutter reference exists |
| `TEST-TECH-003` | **The four staff portals are not migrated to React Native** | Any active document requires that migration |
| `TEST-TECH-004` | **No document calls staff authentication three-factor** | Any does, other than as an explicit denial |
| `TEST-TECH-005` | **No active document restores anonymous reporting, tracking tokens, submission recovery codes or identity-free access** | Any does |
| `TEST-TECH-006` | **`AnonymousAccessGrant` and `SubmissionRecovery` appear only in superseded records** | Either appears as an active entity |
| `TEST-TECH-007` | **`Moderator` and `Administrator` appear only in mapping or historical context** | Either is named as an active Release 0 portal |
| `TEST-TECH-008` | **`CAP_VOICE_CONFIRM` does not exist** as an active capability | It appears outside a withdrawal note |
| `TEST-TECH-009` | **`official_identifier` does not exist** as an active field | It appears outside a rename note |
| `TEST-TECH-010` | Every finalised architecture document states **`Specified; not implemented; not tested`** | Any omits it or overstates status |

## 13. Screen structure

| ID | Assertion | Fails if |
|---|---|---|
| `TEST-SCR-101` | The screen inventory totals **58** and the per-portal figures sum to it | The stated total differs from the counted total |
| `TEST-SCR-102` | `STF-10` exists and is **shared**, not duplicated per role | Four role-specific reporting screens exist |
| `TEST-SCR-103` | `STF-04` and `STF-05` describe **first and second** factors | Either describes a third |
| `TEST-SCR-104` | **No citizen-facing status label maps to a `DRAFT` `CivicReport` state** | Such a mapping exists |
| `TEST-SCR-105` | Device-pipeline labels and civic-state labels are **presented separately** | The two are merged in one table without distinction |

---

## 14. Coverage against the locked decisions

| Locked decision | Covering tests |
|---|---|
| Citizen: mobile + OTP, no password | `TEST-AUTH-C01` … `C04` |
| Four staff portals: identical two-factor | `TEST-AUTH-S01`, `S02`, `S11` |
| Administrator never sets a password | `TEST-AUTH-S03`, `S04` |
| Public staff signup impossible | `TEST-AUTH-S05` |
| Activation separate from authorisation | `TEST-AUTH-S07` |
| SYSADMIN non-civic | `TEST-SYS-001` … `005` |
| One acting role at a time | `TEST-ROLE-001` … `005` |
| Account-level conflict exclusion | `TEST-CONF-001` … `005` |
| Shared official reporting | `TEST-OFF-001` … `007` |
| Confirm own rendering only | `TEST-CONF-R01` … `R04` |
| Exact-version confirmation | `TEST-CONF-R05` … `R08` |
| Draft ≠ report; creation at `SUBMITTED` | `TEST-PIPE-001` … `005` |
| AI failure never bypasses confirmation | `TEST-AI-001` … `003`, `012` |
| Contractor privacy | `TEST-PRV-001` … `004` |
| Retention wording | *(documentation assertion — `TEST-TECH-010`)* |
| Urdu + English UI, Punjabi speech | `TEST-LANG-001` … `008` |
| React Native, no Flutter | `TEST-TECH-001` … `003` |

---

## 15. Not covered here

| Item | Where it belongs |
|---|---|
| Detailed acceptance scenarios per actor | **The future portal use-case phase** |
| Queue behaviour, notification content, dashboards | **The future portal use-case phase** |
| Usability, literacy and comprehension testing | **A field study that has not been designed or conducted** |
| ASR accuracy measurement for Urdu, Punjabi and code-switched speech | **Not measured. No accuracy figure is claimed anywhere** |
| SMS deliverability and cost | **No provider is selected; nothing is measured** |
| Load, performance and security testing | **Not designed, not run** |

---

*Every test in this catalogue: `Specified; not implemented; not executed`. No test result, pass rate or coverage figure is claimed.*

---

# Reconciliation additions — 3 October 2026 (v1.1)

> **Status, stated plainly: none of the tests below has been written as code, run, or observed to pass or fail.** They are **planned acceptance tests**. **A document check passing is not an application test passing** — the mechanical audits run during this reconciliation verified *documents*, and no test in this catalogue was executed.

## T.A Optional photo — `DR-28`

| ID | Assertion | Traces |
|---|---|---|
| `TEST-EVID-010` | A report with **location + confirmed rendering and no photo** is **accepted** | `DR-28` · `API-140` · `CIT-08` |
| `TEST-EVID-011` | A report with **location + typed text and no photo** is **accepted** | `DR-28` · `API-141` |
| `TEST-EVID-012` | A report with **no resolvable location** is **rejected** | `API-140` |
| `TEST-EVID-013` | A report with **no description in any modality** is **rejected** | `API-140` |
| `TEST-EVID-014` | **Both** voice and typed text are **never** required together | `DR-28` |
| `TEST-EVID-015` | `CIT-08` renders an **enabled** "Continue without a photo" control | `CIT-08` |
| `TEST-EVID-016` | `CIT-11` states in plain language that no photo is attached, and **Submit stays enabled** | `CIT-11` |
| `TEST-EVID-017` | `evidence_completeness` is **`none`** with no media, **`partial`** with voice only, **`photographic`** with ≥ 1 photo | `API-160` |
| `TEST-EVID-018` | `evidence_completeness` is **derived server-side**; a client-supplied value is **ignored** | `API-160` |
| `TEST-EVID-019` | `REP-02` / `UCO-02` **display** missing evidence rather than concealing it | `REP-02`, `UCO-02` |
| `TEST-EVID-020` | A reviewer can request a photo through the **existing** clarification path | `API-162` · `CIT-16` |
| `TEST-EVID-021` | **Contractor completion evidence is still rejected when absent** | `T8` · `API-165` |
| `TEST-EVID-022` | **Completion-verification evidence is still rejected when absent** | `T10` · `API-166` |

## T.B OTP expiry, resend, attempts, lockout — `DR-29`

| ID | Assertion | Traces |
|---|---|---|
| `TEST-OTP-020` | A code is rejected **at 5 minutes + 1 second** | `OTPChallenge.expires_at` |
| `TEST-OTP-021` | A **consumed** code is rejected on reuse | `consumed_at` |
| `TEST-OTP-022` | Resend **invalidates the previous challenge immediately** via `superseded_by` | `DR-29` |
| `TEST-OTP-023` | Resend **within 60 s** is refused | `DR-29` |
| `TEST-OTP-024` | **5 failed attempts consume the challenge**; a 6th attempt on it fails | `max_attempts` |
| `TEST-OTP-025` | **The account is not locked** after 5 failures — a fresh request still succeeds within caps | `DR-29` |
| `TEST-OTP-026` | **4th request in one hour for one number** is refused | `DR-29` |
| `TEST-OTP-027` | **11th request in one day for one number** is refused | `DR-29` |
| `TEST-OTP-028` | **6th request in one hour from one device** is refused | `DR-29` |
| `TEST-OTP-029` | Responses are **uniform** whether or not the number is registered | enumeration |
| `TEST-OTP-030` | **No OTP code appears in any log, audit row or crash report** | audit rules |
| `TEST-OTP-031` | **No OTP verification succeeds offline** | offline rule |

## T.C Purpose-binding — `DR-31`

| ID | Assertion |
|---|---|
| `TEST-OTP-010` | A `staff_activation` ticket presented to a **step-up**-guarded route → `E_OTP_PURPOSE_MISMATCH` |
| `TEST-OTP-011` | A `step_up` ticket presented to **`API-125` staff login** → rejected |
| `TEST-OTP-012` | A `citizen_signup_login` ticket presented to **`API-120` activation** → rejected |
| `TEST-OTP-013` | Each of the **8 purposes** is accepted by its own endpoint and **no other** |

## T.D Consent integrity — `DR-32`

| ID | Assertion |
|---|---|
| `TEST-CONSENT-005` | `consent_version` + selected options are **on the server's `OTPChallenge`** before verification |
| `TEST-CONSENT-006` | `ConsentRecord` rows are written **from server-held values**, not from the request body at verify time |
| `TEST-CONSENT-007` | A **tampered** client consent payload at verify time **does not alter** the stored record |
| `TEST-CONSENT-008` | **Abandoned** OTP ⇒ **no `CitizenAccount` and no `ConsentRecord`** |
| `TEST-CONSENT-009` | Withdrawing `sms_notification` **does not lose the account** |

## T.E Idempotency and retry — `DR-30`

| ID | Assertion |
|---|---|
| `TEST-IDEM-001` | Replaying `API-140` with the **same** `X-Submission-Idempotency-Key` returns the **original** report, and **exactly one** `CivicReport` exists |
| `TEST-IDEM-002` | Replaying `API-135` with the **same** `X-Confirmation-Idempotency-Key` returns the original confirmation |
| `TEST-IDEM-003` | A submission key **reused as** a confirmation key is **rejected** — the two namespaces never mix |
| `TEST-IDEM-004` | A **7-day-old** queued submission is marked expired and **not** silently submitted |
| `TEST-IDEM-005` | Both header values are **fully redacted** in logs, APM and crash reports |

## T.F Report ownership and self-review — `STF-11` / `CAP_REPORT_VIEW_OWN`

| ID | Assertion |
|---|---|
| `TEST-OWN-001` | A staff reporter **sees their own report** in `STF-11` **after it leaves their scope** |
| `TEST-OWN-002` | `STF-11` renders the **exclusion banner** and **no** verify/accept/assign/close control |
| `TEST-OWN-003` | Every reviewing verb on the own report → **`403 E_CONFLICT_EXCLUDED`**, by **any** route |
| `TEST-OWN-004` | Exclusion holds **after the account switches to a different role** |
| `TEST-OWN-005` | Exclusion holds for a role **granted later** |
| `TEST-OWN-006` | The reporter **can** answer a clarification on their own report |
| `TEST-OWN-007` | The reporter **can** confirm or dispute the resolution of their own report |
| `TEST-OWN-008` | **Another** staff account requesting that report by reference gets a **uniform `404`** |

## T.G Verification and forwarding permissions

| ID | Assertion |
|---|---|
| `TEST-WF-001` | `SUBMITTED` → `UNDER_VERIFICATION` is **automatic**; no human actor can perform it |
| `TEST-WF-002` | Only a Street Rep with `CAP_FIELD_VERIFY` **in scope** can reach `VERIFIED`, and **field evidence is required** |
| `TEST-WF-003` | A Street Rep **cannot** accept, assign or close |
| `TEST-WF-004` | Only a UC Officer with `CAP_CASE_ACCEPT` can reach `ACCEPTED` |
| `TEST-WF-005` | `SUBMITTED` → `CONTRACTOR_ASSIGNED` is **refused** — verification and acceptance cannot be skipped |
| `TEST-WF-006` | `UC_REVIEW` → `CONTRACTOR_ASSIGNED` is **refused** |
| `TEST-WF-007` | Each forwarding exception (verification failed, inaccessible, duplicate suspected) requires a **mandatory reason** and writes its own audit event |
| `TEST-WF-008` | A suspected duplicate is **flagged for a human, never auto-deleted** |
| `TEST-WF-009` | Completion verification selects a **conflict-free** Representative |
| `TEST-WF-010` | Closure requires a UC Officer, **step-up**, and a mandatory reason |
