# Parakh — Pre-Use-Case Decision and Contradiction Register

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 · Technical Stack v1.3 |
| **Purpose** | Record every architectural blocker found **before** the use cases were written, so no use case silently invents an answer |

> **This register is normative for the use-case pack.** Where a use case depends on an unresolved item, it presents a **labelled conditional branch**, not an invented flow.

---

## How to read this register

| Status | Meaning |
|---|---|
| **LOCKED** | An authoritative supplied source already records the decision. Use cases follow it directly |
| **PROPOSED** | The simplest Release 0 answer is recommended here, but **no supplied source approves it**. Use cases treat it as a branch and label it |
| **TBD — Hassan decision required** | A product decision that only the owner can make |
| **TBD — legal or institutional review required** | Requires external review |

**Nothing marked PROPOSED or TBD is written into a use case as if it were approved.**

---

## Summary

| ID | Issue | Status | Severity |
|---|---|---|---|
| **D-01** | Staff-official report confirmation state | **TBD — Hassan decision required** | **Blocker** |
| **D-02** | How a staff reporter tracks their own official report | **TBD — Hassan decision required** | **Blocker** |
| **D-03** | `STF-11 — My Official Reports` screen | **PROPOSED** — not in the approved inventory | High |
| **D-04** | Acting-role selection requires an acting-role header it cannot yet have | **Contradiction — recommendation PROPOSED** | **Blocker** |
| **D-05** | API does not distinguish pre-role from acting-role staff sessions | **Contradiction — recommendation PROPOSED** | **Blocker** |
| **D-06** | Contractor **organisation**-level self-dealing not prevented | **TBD — Hassan decision required** | **Blocker** |
| **D-07** | OTP request/verify contracts not fully purpose-separated | **PROPOSED** | High |
| **D-08** | Pre-authentication consent payload integrity | **LOCKED** on persistence · **PROPOSED** on integrity | Medium |
| **D-09** | Staff voice-processing notice before `STF-10` | **Gap — PROPOSED** | High |
| **D-10** | React Native local DB / media encryption mechanism | **Gap — TBD — Hassan decision required** | High |
| **D-11** | Offline staff voice recording in a Django/HTMX portal | **Contradiction — recommendation PROPOSED** | High |
| **D-12** | Confirmation idempotency vs report-creation idempotency | **Contradiction — recommendation PROPOSED** | High |
| **D-13** | "Citizen name" appears in a privacy matrix but no such field exists | **Contradiction — recommendation PROPOSED** | **Blocker** |
| **D-14** | Mandatory-photo rule | **TBD — Hassan decision required** | High |
| **D-15** | SRS has not incorporated the identity model | **LOCKED** — v2.0.0 not written | High |

**5 blockers · 8 high · 2 medium.** **Four are genuine document-vs-document contradictions**, not merely missing decisions.

---

## D-01 — Which confirmation state applies to a staff-official report

| Field | Detail |
|---|---|
| **Conflicting sources** | `RBAC v1.3` §9.2 T11 · `CR-61 rev 1.3` §12.3 · `SCREEN_INVENTORY v1.3` §5.1.1 — **all three carry the identical `DEFERRED` marker** |
| **What the sources say** | The canonical state is **`PENDING_CITIZEN_CONFIRMATION`**. `CivicReport.reporter_kind` may be `staff_official`. `CitizenConfirmation` requires a `citizen_account_id`. **When a staff user reports officially, no citizen exists to confirm.** |
| **Why it affects use cases** | Transition **T11** cannot fire. A staff-official report reaching `COMPLETION_VERIFICATION` would enter `PENDING_CITIZEN_CONFIRMATION` and **stall permanently** — there is no actor able to move it |
| **Current authoritative position** | **Explicitly deferred to this phase in three documents.** No source resolves it |
| **Recommended simplest Release 0 decision** | Rename the state **`PENDING_REPORTER_CONFIRMATION`** and generalise `CitizenConfirmation` → `ReporterConfirmation` with `subject_type` + `subject_id`. One state, one entity, no branching lifecycle. **The reporter — citizen or staff — confirms their own report.** This mirrors `CAP_RENDERING_CONFIRM_OWN`, which is already subject-type aware |
| **Alternative considered** | Auto-advance staff-official reports from `COMPLETION_VERIFICATION` straight to `RESOLVED_CONFIRMED`. **Rejected as a recommendation** because it removes the reporter's right to dispute, which is a civic-accountability control, not a convenience |
| **Status** | **`TBD — Hassan decision required`** |
| **Dependent use cases** | `UC-REP-010`, `UC-UCO-018`, `UC-CON-008`, `UC-MAY-016`, `UC-STF-010`, workflow `WF-10`, `WF-11` |

---

## D-02 — How a staff reporter tracks and responds to their own official report

| Field | Detail |
|---|---|
| **Conflicting sources** | `SCREEN_INVENTORY v1.3` §5.1 lists `STF-01…STF-10` — **no staff screen shows a staff user their own reports**. `RBAC v1.3` §3 row 3 gives staff scope-based read, **not ownership-based read** |
| **What the sources say** | A citizen has `CIT-14 My Reports`. A staff reporter has **nothing equivalent**. Worse, `ConflictExclusion` bars the reporting account from *acting* on the report, and scope-based read may not even surface it if it leaves their scope |
| **Why it affects use cases** | A UC Officer who reports a pothole cannot see what happened to it, cannot answer a clarification request on it, and cannot confirm or dispute the resolution |
| **Current authoritative position** | **No source addresses it.** This is a genuine hole, not a formatting issue |
| **Recommended simplest Release 0 decision** | Add **read-only ownership** to the acting-role check: a staff account may always read a report where `official_reporter_account_id = self`, **regardless of scope and regardless of `ConflictExclusion`**. Reading is not acting. Surface it through D-03 |
| **Status** | **`TBD — Hassan decision required`** |
| **Dependent use cases** | `UC-REP-011`, `UC-UCO-019`, `UC-CON-009`, `UC-MAY-017`, workflow `WF-10` |

---

## D-03 — `STF-11 — My Official Reports`

| Field | Detail |
|---|---|
| **Conflicting sources** | `SCREEN_INVENTORY v1.3` §6 states the total is **58** and enumerates `STF-01 … STF-10`. **`STF-11` does not exist in any approved source** |
| **Why it affects use cases** | D-02 has no surface without it |
| **Current authoritative position** | **Not approved.** Adding it would change the screen total from 58 to **59** — a counted figure that the consistency audit verifies mechanically |
| **Recommended simplest Release 0 decision** | Approve **`STF-11 — My Official Reports`**, read-only, filtered to `official_reporter_account_id = self`, showing report reference, plain status, sanitised timeline, and any open clarification. **New total: 59.** No new API family is needed — it is a filter on existing report reads |
| **Status** | **PROPOSED — not approved.** Use cases reference it **only inside a labelled conditional branch** |
| **Dependent use cases** | `UC-REP-011`, `UC-UCO-019`, `UC-CON-009`, `UC-MAY-017` |

---

## D-04 — Acting-role selection cannot carry an acting-role header

| Field | Detail |
|---|---|
| **Conflicting sources** | `API_CONTRACT v3.0` §2 class 3 — *"**Staff-authenticated**: Access token **+ `X-Acting-Role-Assignment-ID`**"* · `API_CONTRACT v3.0` §3.2 — **`API-120 POST /auth/role/select` is classed `Staff-authenticated`** |
| **The contradiction, stated plainly** | To select an acting role you must already have selected an acting role. **The first call after login can never succeed.** |
| **Why it affects use cases** | Step 10 of the locked staff activation sequence — *"User explicitly selects one acting RoleAssignment"* — is unimplementable as written. **Every staff golden journey passes through it** |
| **Current authoritative position** | The contract is internally contradictory. Neither branch is approved |
| **Recommended simplest Release 0 decision** | Introduce a sixth transport class **`Staff-pre-role`**: a valid access token with `subject_type = staff`, **no acting-role header**, and access to exactly three routes — `API-125` *(login OTP, which issues it)*, `API-120` *(role select)*, `API-004` *(logout)*. **`API-120` is reclassified `Staff-pre-role`.** Every other staff route stays `Staff-authenticated` and continues to require the header. A `Staff-pre-role` token carries **no capability whatsoever** |
| **Status** | **PROPOSED** — the contradiction is real and documented; the fix is not yet approved |
| **Dependent use cases** | `UC-REP-006`, `UC-UCO-004`, `UC-CON-008`, `UC-MAY-005`, and **every staff golden journey step 10** |

---

## D-05 — No distinction between an authenticated pre-role session and an authorised acting-role session

| Field | Detail |
|---|---|
| **Conflicting sources** | `DATA_MODEL v1.3` §4.3 — `AuthSession.acting_role_assignment_id` is described as *"Staff only. Exactly one"* with **no nullable statement** · `API_CONTRACT v3.0` §3.3 precondition 3 requires the header on every staff request |
| **Why it affects use cases** | The window between "OTP verified" and "role selected" is a real state with real security properties. Undefined, it becomes whatever the first implementer assumes |
| **Current authoritative position** | Undefined |
| **Recommended simplest Release 0 decision** | State explicitly that **`AuthSession.acting_role_assignment_id` is nullable**, and that a session with a null value: has `subject_type = staff` · holds **zero capabilities** · may call only the three `Staff-pre-role` routes · **is audited on creation as `staff_session_pre_role`** · **expires on a short timer independent of the full session** if no role is selected |
| **Status** | **PROPOSED** |
| **Dependent use cases** | Same as D-04, plus `UC-REP-021`, `UC-UCO-027`, `UC-MAY-025` (role switching) |

---

## D-06 — Contractor organisation-level self-dealing

| Field | Detail |
|---|---|
| **Conflicting sources** | `DATA_MODEL v1.3` §5.10 — `ConflictExclusion` is keyed on **`excluded_staff_account_id`** · `RBAC v1.3` §8 — exclusion binds *"the acting **account**, never the assignment"* · `RBAC v1.3` §10 — contractor eligibility checks organisation approval, category and area, **but not conflict** |
| **The gap, stated plainly** | A contractor staff account reports a pothole officially. That **account** is excluded. **Their organisation is not.** A UC Officer may then assign the repair to that same organisation, which bills for work its own employee requested. The account-level exclusion does not reach the commercial entity |
| **Why it affects use cases** | `UC-UCO-012` (assign contractor) and `UC-CON-002` (accept work) both need a rule that does not exist |
| **Current authoritative position** | **No source addresses organisation-level conflict.** The account-level rule is correct but insufficient for contractors specifically |
| **Recommended simplest Release 0 decision** | When `reporter_kind = staff_official` **and** the reporting account belongs to a `ContractorOrganization`, write **two** rows: the existing account-level `ConflictExclusion`, **plus** an organisation-level exclusion. `API-163` filters that organisation out of the eligible list and the server re-checks on `API-164` acceptance |
| **Status** | **`TBD — Hassan decision required`** |
| **Dependent use cases** | `UC-UCO-012`, `UC-UCO-013`, `UC-CON-002`, `UC-CON-011`, workflow `WF-11` |

---

## D-07 — OTP request/verify contracts and purpose-bound tickets

| Field | Detail |
|---|---|
| **Conflicting sources** | `API_CONTRACT v3.0` §3.2 defines `API-124` *(staff OTP verify — "activation and login share the OTP verifier; `purpose` distinguishes them")*, `API-125` *(login OTP)*, `API-126` *(step-up)*, `API-127` *(password reset)* · `DATA_MODEL v1.3` §4.2 defines **eight** `OTPChallenge.purpose` values |
| **The gap** | The eight purposes are defined on the **entity**, but the contract does not state a **separate request endpoint** for each, nor that a ticket issued for one purpose is rejected for another. An activation OTP that could be replayed as a step-up OTP would defeat step-up entirely |
| **Current authoritative position** | Partially specified. The purpose field exists; **purpose binding of the resulting ticket does not** |
| **Recommended simplest Release 0 decision** | State that every OTP flow is a **request → verify pair**, that the resulting ticket is **stamped with the same `purpose`**, and that a ticket is **rejected if presented to an endpoint expecting a different purpose**. No new endpoints are needed — the rule is a validation, not a route |
| **Status** | **PROPOSED** |
| **Dependent use cases** | `UC-REP-004`, `UC-REP-023`, `UC-UCO-003`, `UC-CON-006`, `UC-MAY-004`, all step-up use cases |

---

## D-08 — Pre-authentication consent payload integrity

| Field | Detail |
|---|---|
| **Sources** | `DATA_MODEL v1.3` §4.7 — payload held on device, `pending_consent_ref` travels on the OTP request and is stored on `OTPChallenge`; abandonment creates nothing · `TECHNICAL_STACK v1.3` §5 — payload in `expo-sqlite`, "encrypted" |
| **What is LOCKED** | **Persistence and binding are fully specified.** Consent is bound to the account after OTP verification, required and optional consents are separate rows, abandonment creates no records |
| **What is not specified** | Whether the payload is **tamper-evident**. A device-held record of what the user agreed to, with a client-generated reference, is not by itself evidence |
| **Recommended simplest Release 0 decision** | The server stores the **`consent_version` and the selected options against the `OTPChallenge`** at request time, not merely a reference. The device copy then becomes a convenience, and the server holds the authoritative record of what was offered and chosen |
| **Status** | **LOCKED** on persistence · **PROPOSED** on integrity |
| **Dependent use cases** | `UC-CIT-004`, `UC-CIT-006`, `UC-CIT-009` |

---

## D-09 — Staff voice-processing notice before `STF-10`

| Field | Detail |
|---|---|
| **Conflicting sources** | `SCREEN_INVENTORY v1.3` `CIT-02`/`CIT-03` — citizens receive a versioned privacy and voice-processing disclosure **before** any recording · `SCREEN_INVENTORY v1.3` §5.1 — **`STF-10` has no equivalent** · `DATA_MODEL v1.3` §4.6 — `ConsentRecord` is keyed on **`citizen_account_id`** and cannot hold a staff consent |
| **The gap** | A staff user reporting through `STF-10` records their voice. That recording is stored, AI-processed and retained under the same policy. **They are never told, and no record of their being told exists** |
| **Why it affects use cases** | `UC-REP-018`, `UC-UCO-025`, `UC-CON-010`, `UC-MAY-024` all begin with a recording that has no disclosure step |
| **Recommended simplest Release 0 decision** | Show a **versioned voice-processing notice on first use of `STF-10`** per staff account, acknowledged once, recorded as a `StaffNoticeAcknowledgement` (or a `ConsentRecord` generalised with `subject_type`). **The notice is informational, not a consent gate** — official reporting is a duty of the role, not an optional personal choice — but the acknowledgement must be recorded |
| **Status** | **Gap — PROPOSED** |
| **Dependent use cases** | `UC-REP-018`, `UC-UCO-025`, `UC-CON-010`, `UC-MAY-024` |

---

## D-10 — React Native local database and media encryption

| Field | Detail |
|---|---|
| **Sources** | `TECHNICAL_STACK v1.3` §5 — *"Draft metadata … `expo-sqlite`, **encrypted**"*, *"Pre-authentication consent payload … `expo-sqlite`, **encrypted**"*, *"Captured media awaiting upload … `expo-file-system`, app-private"* · §4 lists `expo-secure-store` for **"small secrets and keys only — never media"** |
| **The gap, stated plainly** | **"Encrypted" is asserted; no mechanism is named.** The stack document does not specify an encryption library, a cipher, a key-derivation approach, or how the database key is protected. `expo-file-system` app-private storage is an OS-level access control, **not encryption at rest** |
| **Why it affects use cases** | `UC-CIT-022` (safe local draft) and every offline branch claim an encrypted draft. **A use case must not claim a protection whose mechanism is undefined** |
| **Recommended simplest Release 0 decision** | Name the mechanism explicitly: a random data key generated on first launch, **stored in `expo-secure-store`** (Android Keystore-backed), used to encrypt the SQLite database through a documented library, and used to encrypt media at rest before it is written to `expo-file-system`. **Whether that library is available and acceptable is an engineering verification task, not a documentation decision** |
| **Status** | **`TBD — Hassan decision required`** — and **an engineering feasibility check is required before it can be answered** |
| **Dependent use cases** | `UC-CIT-022`, `UC-CIT-038`, `UC-CIT-039`, and every offline branch |

---

## D-11 — Offline staff voice recording in a Django/HTMX portal

| Field | Detail |
|---|---|
| **Conflicting sources** | `SCREEN_INVENTORY v1.3` §5.1 — `STF-10` offline column reads *"**Online only for AI processing and submission; recording works offline**"* · `SCREEN_INVENTORY v1.3` §5 and `TECHNICAL_STACK v1.3` §2 — the four staff portals are **Django Templates + HTMX + Alpine.js**, explicitly **not** React Native |
| **The contradiction, stated plainly** | A server-rendered Django page with HTMX has **no offline draft queue, no local database and no background sync**. The offline claim was copied from the React Native citizen client, where it is true, to a web portal, where it is not |
| **Why it affects use cases** | `UC-REP-018`, `UC-UCO-025`, `UC-CON-010`, `UC-MAY-024` would promise a capability the stack does not provide |
| **Recommended simplest Release 0 decision** | **`STF-10` is online-only in every respect.** Recording, upload, AI processing and submission all require a connection. The screen states this plainly, and a lost connection mid-recording is a named failure with a retry, not a silent queue. **Offline staff recording is deferred, not claimed** |
| **Status** | **Contradiction — recommendation PROPOSED** |
| **Dependent use cases** | `UC-REP-018`, `UC-UCO-025`, `UC-CON-010`, `UC-MAY-024`, and the offline sections of all four staff portal files |

---

## D-12 — Confirmation idempotency versus report-creation idempotency

| Field | Detail |
|---|---|
| **Conflicting sources** | `API_CONTRACT v3.0` §6.1 — confirmation carries **`X-Idempotency-Key`** · §7.2 — report creation is keyed on **`client_submission_id` + `X-Idempotency-Key`** · §10 — two separate rows, both naming `X-Idempotency-Key` · `DATA_MODEL v1.3` §5.3 — `RenderingConfirmation.idempotency_key` is **UNIQUE** |
| **The ambiguity, stated plainly** | If the same header value is reused for both calls, the **UNIQUE** constraint on `RenderingConfirmation.idempotency_key` collides with report-creation replay handling, and a legitimate retry of report creation could be misread as a duplicate confirmation — or vice versa. If they are different values, no source says so |
| **Why it affects use cases** | `UC-CIT-031` and `UC-CIT-037` are adjacent steps in the same journey. An implementer will guess |
| **Recommended simplest Release 0 decision** | **Two distinct keys, distinct headers.** `X-Confirmation-Idempotency-Key` on `API-135`; `X-Submission-Idempotency-Key` on `API-140`/`API-141`. Both client-generated, both persisted, **neither reused across the two operations** |
| **Status** | **Contradiction — recommendation PROPOSED** |
| **Dependent use cases** | `UC-CIT-031`, `UC-CIT-032`, `UC-CIT-037`, `UC-CIT-039`, workflow `WF-21` |

---

## D-13 — "Citizen name" appears in a privacy matrix, but no such field exists

| Field | Detail |
|---|---|
| **Conflicting sources** | `RBAC v1.3` §11 privacy-filtering matrix contains a row **`Citizen name`** with `✓` for Mayor & Operations · `DATA_MODEL v1.3` §2.1 — `CitizenAccount` key fields are `id · status · preferred_language · created_at · last_seen_at · deactivated_at · deactivation_reason`. **There is no name field anywhere in the 31-entity model** |
| **The contradiction, stated plainly** | The privacy matrix grants a role access to data the system does not collect. Read literally, it invites an implementer to **add a name field to satisfy the matrix** — which would introduce personal-data collection through a documentation artefact rather than a decision |
| **Why it affects use cases** | `UC-MAY-020` (protected contact) and every privacy assertion depend on knowing exactly what identity data exists |
| **Recommended simplest Release 0 decision** | **Delete the `Citizen name` row from the privacy matrix.** Parakh does not collect a citizen name in Release 0. **Every use case in this pack states that no citizen name exists and none is displayed to anyone, including Mayor & Operations** |
| **Status** | **Contradiction — recommendation PROPOSED.** The use cases follow the **data model**, which is the narrower and safer reading |
| **Dependent use cases** | `UC-MAY-020`, `UC-CON-003`, `UC-REP-012`, `UC-UCO-006`, and every privacy acceptance test |

---

## D-14 — Mandatory-photo rule

| Field | Detail |
|---|---|
| **Sources** | `SCREEN_INVENTORY v1.3` §4 · `DATA_MODEL v1.3` §5.7 · `API_CONTRACT v3.0` §7.4 — **all three carry the identical open decision**, with both branches already specified |
| **The two branches** | **A** — at least one live photo required for every report; creation rejects with `422 E_EVIDENCE_REQUIRED`. **B** — optional for named categories; validation is category-conditional and the list is configuration |
| **Why it affects use cases** | `UC-CIT-016`, `UC-CIT-036`, `UC-CIT-037` and the four staff `STF-10` use cases branch on it |
| **Current authoritative position** | **Open in every source.** A voice recording is explicitly **not** a substitute for visual evidence |
| **Recommended simplest Release 0 decision** | **Branch A** — mandatory for all. It is one rule, testable in one assertion, with no configuration list to maintain, and it matches the project's evidence-first thesis. **This is a recommendation only** |
| **Status** | **`TBD — Hassan decision required`** |
| **Dependent use cases** | `UC-CIT-016`, `UC-CIT-036`, `UC-CIT-037`, `UC-REP-018`, `UC-UCO-025`, `UC-CON-010`, `UC-MAY-024` |

---

## D-15 — The SRS has not incorporated the identity model

| Field | Detail |
|---|---|
| **Sources** | `CHANGE_MANIFEST_CR61_r1.3.md` §4 — **SRS v2.0.0 does not exist** · `Parakh_Prototype_SRS_v1.4.2.md` is preserved byte-identical as the **superseded anonymous-model baseline** · Five documents state that **CR-61 rev 1.3 is binding until SRS v2.0.0 exists** |
| **Why it affects use cases** | Source-precedence rule 3 says *"latest SRS … except where explicitly superseded"*. **The whole SRS is superseded on identity, authentication, actors, reporting and language.** Nothing in v1.4.2 may be used to resolve a question in this pack |
| **Current authoritative position** | **LOCKED and clear.** Precedence for this pack is: CR-61 rev 1.3 → RBAC/Data Model/API/Screen Inventory v1.3 → Technical Stack v1.3 → Test Catalogue. **SRS v1.4.2 is used for nothing** |
| **Recommended action** | Author SRS v2.0.0 as a new baseline. Until then, **this pack and CR-61 rev 1.3 together are the implementable specification** |
| **Status** | **LOCKED** — the position is documented and unambiguous |
| **Dependent use cases** | All of them, indirectly. **None directly** |

---

## Consolidated impact on the use-case pack

| Consequence | Where it shows |
|---|---|
| **Six labelled conditional branches** are written instead of invented flows | D-01, D-03, D-04, D-06, D-11, D-14 |
| **`STF-11` is referenced only inside a branch**, and the approved screen total remains **58** | D-03 |
| **A `Staff-pre-role` session is described as PROPOSED** at step 10 of every staff journey | D-04, D-05 |
| **`STF-10` is documented as online-only**, with the contradicting offline claim named | D-11 |
| **No use case displays a citizen name to anyone** | D-13 |
| **Both photo branches are written**; neither is presented as final | D-14 |
| **No use case claims a specific encryption mechanism** for local drafts | D-10 |

---

## What this register does not do

It does not resolve any `TBD`. It does not approve any `PROPOSED` item. It does not treat the absence of a rule as permission to invent one. **Where a source is silent, this register says so and stops.**

---

*Specified; not implemented; not tested.*
