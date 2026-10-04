# Parakh — Use-Case Pack Consistency Audit

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Scope** | The ten use-case documents, audited against their **saved bytes** after the final write |
| **Method** | Scripted. **Every count was computed, not asserted** |
| **Result** | **43 checks · 43 pass · 0 fail** · **8/8 planted defects detected by self-test** |

> **Detailed citizen, Street Representative, UC Officer, Contractor and Mayor/Ops use cases are intentionally deferred until the identity, authentication, RBAC, data model, screen inventory, API foundation and SRS baseline are approved.** — That deferral has now been **lifted for this pack only**; the underlying architecture decisions it was waiting on are **still open**, and five of them are Blockers.

---

## 1. Honest headline

**This pack is internally consistent. It is not complete, and the architecture it documents is not ready to build.**

**Five Blocker-severity decisions remain open.** Six use cases and four workflows carry **labelled conditional branches** instead of flows, because inventing the missing answer would have been worse than naming the gap. **The pack does not claim "fully consistent"** — it claims that every check below is supported by evidence, and that the gaps are named rather than hidden.

---

## 2. Provenance

Checks ran by script against files reopened from disk **after** the final write. **Two rounds were required.**

### Round 1 — 42 checks, 37 pass, 5 fail

**One failure was a real document defect and was repaired:**

| Defect | Repair |
|---|---|
| **`AT-ROLE-005` was a malformed table row.** A stray `|` inside a trace cell — `all staff \| — ·` — broke the column count in `08_USE_CASE_ACCEPTANCE_TESTS.md` | Replaced with `all staff screens · all staff routes ·` |

**Four failures were defects in the checks, not the documents:**

| Check | Why it fired | Reality |
|---|---|---|
| `5 uniform staff auth` | Required the literal string `"All four"` | The pack uses lowercase `"all four"`. Rewritten to require the statement **in each of the four staff portal files** and to reject any role-specific login method |
| `20 AI not offline` | Regex `AI[^\n]{0,40}offline` matched **inside the word `API`** in a golden-journey column header — `API \| Data \| … \| Offline` | Rewritten with `\bAI\b` and case-sensitivity. **It then fired a second time** on `"AI failure → WF-19 · offline at step 15 → WF-20"`, a **list of failure branches**, not a claim. Tightened further to forbid a list separator between the two tokens, and **re-verified that it still fires on a genuine claim** |
| `23 unsupported screen IDs` | Flagged `REP-05` and `STF-11` | `REP-05` is **retired** and appears only in retirement notes; `STF-11` is **PROPOSED** and appears only in labelled branches. Rewritten to allow exactly those two **and to verify every mention carries its label** |
| `23b STF-11 labelling` | Required the label on the **same line** | Two lines in the decision register sit **inside the D-03 section** — the strongest possible labelling. Rewritten to be **section-aware**, checking a 400-character window |

### Round 2 — 43 checks, 43 pass, 0 fail

### 2.1 Self-test — can these checks fail?

**A check that cannot fail is not a check.** Eight synthetic defects were planted in copies and each rewritten check was run against them.

| Planted defect | Detected? |
|---|:--:|
| A citizen password introduced | **Yes** |
| Contractor regains original citizen audio | **Yes** |
| AI claimed to work offline | **Yes** |
| `DRAFT` reintroduced as a `CivicReport` state | **Yes** |
| A malformed table row | **Yes** |
| A gap in the `UC-CIT` identifier sequence | **Yes** |
| `STF-11` used without a PROPOSED label | **Yes** |
| Promotional language | **Yes** |

**8 / 8 detected.**

The `AI…offline` check was additionally verified against **two hand-written lines**: it stays quiet on the genuine failure-branch list and **fires on `"AI transcription runs offline on the device"`**.

---

## 3. The 24 prohibited-pattern checks

| # | Prohibited pattern | Result | Evidence |
|---|---|:--:|---|
| 1 | Contradiction with the account-creation chain | **PASS** | Chain stated identically in `00`, `02`–`05`, `09`; no citizen invitation path exists |
| 2 | Citizen password introduced | **PASS** | Zero unnegated matches. `AT-AUTH-003` asserts none exists |
| 3 | Anonymous reporting restored | **PASS** | Zero unnegated matches across ten files |
| 4 | Public staff signup introduced | **PASS** | Zero unnegated matches; `AT-AUTH-008` asserts no route |
| 5 | Different staff authentication methods | **PASS** | All four staff files state identical two-factor auth; no role-specific method appears |
| 6 | Administrator-created passwords | **PASS** | Zero matches; `AT-AUTH-006`/`007` assert impossibility |
| 7 | Mobile number called an authentication factor | **PASS** | `"identifier, not an authentication factor"` present; zero unnegated `three-factor` |
| 8 | TOTP or passkeys restored | **PASS** | Zero unnegated matches |
| 9 | Flutter instead of React Native | **PASS** | Zero unnegated matches |
| 10 | Moderator or standalone Administrator portal | **PASS** | Zero matches |
| 11 | More or fewer than five civic portals | **PASS** | `"five civic portals"` present; zero `sixth portal` |
| 12 | Capabilities combined across roles | **PASS** | `"never combined"` / `"never unioned"` present; `AT-ROLE-003` |
| 13 | Missing scope enforcement | **PASS** | `"refused server-side"` and `"Hiding a control is never sufficient"` present |
| 14 | Missing conflict exclusion | **PASS** | `ConflictExclusion` account-level in every staff file; `AT-CONF-009`/`010` |
| 15 | Staff confirming another person's rendering | **PASS** | Zero unnegated matches; `AT-CONF-002`/`003`/`004` |
| 16 | Contractor access to citizen audio or identity | **PASS** | Zero unnegated matches; `AT-PRV-001`/`002`/`003` |
| 17 | Mayor/Ops performing ordinary closure | **PASS** | `"no close route"` present; `AT-PERM-001` |
| 18 | `DRAFT` used as a `CivicReport` state | **PASS** | Zero unnegated matches; `AT-PIPE-003` |
| 19 | Report reference before server submission | **PASS** | `"no report reference"` and `"issued in the same transaction"` present; `AT-PIPE-001` |
| 20 | AI operating offline | **PASS** | Zero same-clause claims; `AT-AI-011`, `AT-OFF-002` |
| 21 | AI making final decisions | **PASS** | `"AI must never"` present; `AT-AI-009` |
| 22 | Unverified or stale rendering submitted | **PASS** | Both conflict codes present; `AT-CONF-005`/`006` |
| 23 | Unsupported account, screen, API, entity or status names | **PASS** | Only `REP-05` *(retired)* and `STF-11` *(PROPOSED)* fall outside the approved 58, **and every mention of each carries its label** |
| 24 | Use cases depending on unresolved decisions without a `TBD` label | **PASS** | All five Blockers documented in `09`; every portal file carries an open-decisions table |

**24 / 24.**

---

## 4. Structural checks

| # | Check | Result | Value |
|---|---|:--:|---|
| S1 | Use-case IDs contiguous per portal | **PASS** | `CIT` 1–58 · `REP` 1–24 · `UCO` 1–29 · `CON` 1–24 · `MAY` 1–28 |
| S2 | Total use cases | **PASS** | **163**, counted from the IDs |
| S3 | Arithmetic shown, not asserted | **PASS** | `58 + 24 + 29 + 24 + 28 = 163` |
| S4 | Workflows `WF-01`…`WF-23` complete | **PASS** | 23, no gaps |
| S5 | Malformed table rows | **PASS** | **0** across ten files, escaped-pipe-aware |
| S6 | `TBD —` markers use an approved form | **PASS** | 0 deviations |
| S7 | Every file states its status | **PASS** | `Specified; not implemented; not tested` in all ten |
| S8 | No executed-test claim | **PASS** | 0 matches |
| S9 | No deployment or adoption claim | **PASS** | 0 matches |
| S10 | No AI or SMS provider named | **PASS** | 0 matches |
| S11 | No promotional or prestige language | **PASS** | 0 matches |

---

## 5. Coverage findings

| Coverage | Result |
|---|---|
| **58 approved screens** | **All covered.** 0 orphans |
| **46 API endpoints** | **All covered.** 0 orphans |
| **28 capabilities** | **25 covered; 3 explained** — see §5.1 |
| **12 canonical transitions** | All covered |
| **10 alternate transitions** | All covered |
| **4 prohibited transitions** | All asserted as failures |
| **7 pipeline states** | All covered |
| **4 `Dispute.appeal_status` values** | All covered |
| **26 mandated test categories** | All covered |

### 5.1 Capabilities without a use case — explained, not orphaned

| Capability | Why | Severity |
|---|---|---|
| `CAP_AUDIT_INTEGRITY_VERIFY` | Held **only** by the Technical System Administrator, which **is not a civic portal and has no civic application login**. Its absence is correct | **None** |
| `CAP_EXPORT` | Named in RBAC v1.3 §2 with a step-up requirement, but **no screen in the approved inventory surfaces it** and no export flow is specified anywhere | **Medium** — `TBD — Hassan decision required`: which screen offers export, and what de-identification checklist applies |
| `CAP_SAFEGUARDING` | Marked **P1** in the Moderator responsibility mapping — **out of Release 0 scope by the source, not by this pack** | **Low** |

---

## 6. Problems found, by severity

### 6.1 Blocker

| # | Problem | Where | Status |
|---|---|---|---|
| **B1** | **A staff-official report cannot complete its lifecycle.** After completion verification it enters `PENDING_CITIZEN_CONFIRMATION`, where **no citizen exists to act**, and the case **stalls permanently** | `D-01` · `UC-REP-011`, `UC-UCO-018`, `WF-07` | **`TBD — Hassan decision required`** |
| **B2** | **A staff reporter cannot follow their own report.** No approved staff screen shows it, scope-based read may not surface it, and `ConflictExclusion` bars acting on it | `D-02` · `UC-REP-017` | **`TBD — Hassan decision required`** |
| **B3** | **Acting-role selection is circular.** `API-120` is classed `Staff-authenticated`, which requires the acting-role header the call exists to obtain. **Step 10 of the locked staff activation sequence is unimplementable as written** | `D-04`/`D-05` · every staff golden journey | **PROPOSED fix, not approved** |
| **B4** | **Contractor organisation-level self-dealing is unprevented.** `ConflictExclusion` is account-keyed; the organisation whose employee reported the issue can still be assigned the paid work | `D-06` · `UC-UCO-011`, `UC-CON-023` | **`TBD — Hassan decision required`** |
| **B5** | **The RBAC privacy matrix grants Mayor/Ops a "Citizen name" that does not exist** in the 31-entity data model. Read literally, it invites an implementer to **add personal-data collection through a documentation artefact** | `D-13` · every privacy assertion | **PROPOSED: delete the row.** This pack follows the data model |

### 6.2 High

| # | Problem | Where | Status |
|---|---|---|---|
| **H1** | `STF-11 — My Official Reports` does not exist in the approved inventory. Approving it moves the screen total from **58 to 59** | `D-03` | **PROPOSED** |
| **H2** | OTP request/verify contracts are not purpose-separated; a ticket issued for one purpose could be presented to another endpoint | `D-07` | **PROPOSED** |
| **H3** | **Staff receive no versioned voice-processing notice before `STF-10`**, and `ConsentRecord` cannot hold a staff consent because it is keyed on `citizen_account_id` | `D-09` | **PROPOSED** |
| **H4** | **Local database and media encryption is asserted with no mechanism named.** `expo-file-system` app-private storage is an OS access control, not encryption at rest | `D-10` | **`TBD` + engineering feasibility check required** |
| **H5** | **`STF-10` claims offline recording in a Django/HTMX portal** that has no offline queue, no local database and no background sync. The claim was copied from the React Native client | `D-11` | **PROPOSED: online-only** |
| **H6** | Confirmation and report-creation idempotency both name `X-Idempotency-Key`, while `RenderingConfirmation.idempotency_key` is **UNIQUE** — a collision waiting for a retry | `D-12` | **PROPOSED: two distinct headers** |
| **H7** | The mandatory-photo rule is open in all three sources; both branches are written and neither is final | `D-14` | **`TBD — Hassan decision required`** |
| **H8** | **The first-Mayor bootstrap procedure is unspecified** — who performs it, what evidence is retained, how it is audited when the audit chain is itself being initialised | `UC-MAY-001` | **`TBD — Hassan decision required`** |
| **H9** | **No contractor-organisation registration surface exists** in any approved source — no route, no screen, no API. How a record reaches `PENDING_APPROVAL` is undefined | `UC-CON-001` | **`TBD — Hassan decision required`** |

### 6.3 Medium

| # | Problem | Where | Status |
|---|---|---|---|
| **M1** | Pre-authentication consent is persisted and bound correctly, but the device payload is **not tamper-evident** | `D-08` | **PROPOSED: server stores the version and selections against the `OTPChallenge`** |
| **M2** | `CAP_EXPORT` has a step-up requirement and no surface | §5.1 | **`TBD — Hassan decision required`** |
| **M3** | **SRS v2.0.0 does not exist.** `CR-61 rev 1.3` is binding until it does, and the Build Specification and Database Architecture cannot be brought current before it | `D-15` | **LOCKED — the position is documented** |
| **M4** | **No-citizen-response closure policy is undefined.** If a citizen never confirms or disputes, the case has no defined path | `UC-CIT-046` | **`TBD — Hassan decision required`** |
| **M5** | **Repeated-reopening is uncapped.** No limit and no behaviour at a limit is defined | `UC-UCO-019` | **`TBD — Hassan decision required`** |

### 6.4 Low

| # | Problem | Where | Status |
|---|---|---|---|
| **L1** | `CAP_SAFEGUARDING` is P1 and unsurfaced | §5.1 | Deferred by the source |
| **L2** | A contractor employee hierarchy is not modelled — no foreman, crew or supervisor relationship | `04` §B | **Explicitly future scope** |
| **L3** | Emergency or legally required contact **without** consent is undefined | `UC-MAY-021` | **`TBD — legal or institutional review required`** |
| **L4** | Retention durations for audio, artefacts, evidence and credentials remain open | `D-14` family | **`TBD — legal or institutional review required`** |

**Totals: 5 Blocker · 9 High · 5 Medium · 4 Low.**

---

## 7. What this audit does not establish

It verifies that the pack is **internally consistent, honestly labelled, and traceable**.

**It does not verify that the architecture is correct, buildable, secure, or usable.** No code exists. No test has run. No screen has been designed. No citizen has spoken into this system, and no officer has closed a case in it.

**It also does not verify that the pack is complete.** Five Blockers mean five places where a developer would still have to stop and ask. **That is the honest state, and it is better recorded than papered over.**

---

## 8. Determination

**43 mechanical checks pass. 24 prohibited patterns are absent. Coverage is complete against screens, endpoints, capabilities, transitions and mandated test categories, with three capabilities explained rather than orphaned.**

**One real document defect was found and repaired.** Four check defects were diagnosed, rewritten and re-run; the rewritten checks were then proven able to fail against eight planted defects, and the most subtle of them was verified line by line against both a false positive and a true positive.

**This pack is not claimed to be fully consistent with a finished architecture, because the architecture is not finished.** It is claimed to be consistent with **the architecture as approved**, and to name every place where that architecture does not yet answer the question a developer would ask.

---

*Specified; not implemented; not tested. 43 checks executed against files reopened from disk; 8/8 planted defects detected by self-test.*
