# Reconciliation — documents from the other local Parakh workspace (2026-10-03)

| Field | Value |
|---|---|
| Task | `T-117` (also closes `T-026`) |
| Date | 2026-10-03 (Asia/Karachi) |
| Owner | Hassan Jalal. **Every "accepted" below is accepted as a source document. No proposal from the incoming documents becomes Hassan's decision by appearing here** |
| Incoming material | Another local working folder on this Mac, referred to below as "the other workspace". Its work was done without access to this repository. **Nothing was copied wholesale.** Its `.git` was not imported, its remote instruction was not run, and its 172-file commit was not merged |
| Canonical destination | `SRS/`, the existing source-document folder. No competing copies are created under `docs/` |

## 1. What was available

| Item | Available? | Note |
|---|---|---|
| The four handoff files the user attached (`CURRENT_STATE.md`, `NEXT_TASK.md`, `PROJECT_PLAN.md`, `DECISIONS_AND_GAPS.md`) | Yes | Read as review material. **Not copied over this repository's records** |
| The six specifications (RBAC, Data Model, API Contract, Screen Inventory, Technical Stack, Test Catalogue) | **Yes — but only as copies the other session edited in place on 2026-10-03 (18:13–18:15)** | Before that session's commit `3329594`, its `docs/` folder was untracked, so there is no Git history of the pre-edit text. No other copy was found by Spotlight, and there is no Time Machine backup |
| CR-59, CR-60, CR-61 change manifest, Mobile SRS change records, Implementation Readiness Pack, Prototype SRS v1.4.2, roadmap one-pager, Authentication/Anonymous v1.2 | Yes, unedited (file dates 16 Aug – 14 Sep) | Imported unchanged |
| An `incoming/reconciliation-2026-10-03/` folder | **No** | It does not exist in this repository |

### 1.1 Proof that the six were changed

The CR-61 rev 1.3 change manifest (`SRS/CHANGE_MANIFEST_CR61_r1.3.md`, 2 Sep 2026) records the byte counts and hashes of the v1.3 originals. None of them matches the copies available today:

| Document | v1.3 original per CR-61 manifest | Copy available today |
|---|---|---|
| RBAC and Scope Matrix | 1.3 · 33,544 B · `9786ac1379d7a139` | **1.4** · 42,441 B · `d1c2c26e0f5b545f` |
| Data Model and Identity Schema | 1.3 · 39,552 B · `05f718477a36db86` | **1.4** · 42,643 B · `f4b8c2e1776cfd77` |
| Screen Inventory and Navigation | 1.3 · 39,701 B · `0a6d2d10d9b3bbd2` | **1.4** · 43,614 B · `fc4293ce9a999bc3` |
| API Contract | 3.0 · 30,001 B · `9dacf256f554b5a3` | **3.1** · 36,239 B · `33cc2d06abb53578` |
| Technical Stack | 1.3 · 14,276 B · `238f412be2ea1890` | **1.4** · 16,454 B · `f82ea41e4af2d975` |
| Test Catalogue | 1.0 · "111 assertions" | **1.1** · 135 test IDs (78 in the v1.0 body + 57 added on 2026-10-03) — the v1.0 body now has 78 distinct IDs, so either the "111" count used another unit or rows changed; **unresolvable without the original** |

**Consequence.** The v1.3 / v3.0 / v1.0 originals are **lost**.

- **What the copies are.** The available files are 2026-10-03 edits layered over them. Most edits are in labelled added sections (§14, R.x, T.x), and the revision rows say so. Some edits were made **in place**, inside original tables (§2).
- **What they are not.** These copies are therefore **not** the documents the Mobile SRS cites as rank-3/4 authority.
- **How they are used here.** As the best available text, with every 2026-10-03 change classified below.

## 2. Per-document reconciliation

Legend: **Accepted** = adopted as the working text. **Deferred** = kept visible but not adopted until Hassan decides. **Rejected** = wrong against a higher-precedence source; this repository's correction applies.

### 2.1 RBAC and Scope Matrix (`SRS/RBAC_AND_SCOPE_MATRIX.md`, v1.4)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| §1–§13 body (five portals, factors, step-up, scope, multi-role, conflict, state machine T1–T12, privacy filtering, account chain) | **Accepted** as working text | Labelled `[RECOVERED]`. Consistent with CR-61 rev 1.3 and SRS v2.1.0 |
| §14.1 invitation hierarchy (Citizen self; REP by UCO in own scope; UCO and CON by MAY with `CAP_ACCOUNT_ADMIN`, CON after organisation approval; first MAY bootstrapped, then invited) | **Accepted** | Identical to CR-61 §16 and SRS §2.3.1 |
| §14.1 "invitee sets their own password at **STF-02**" | **Rejected (wording)** | SRS Appendix B: `STF-02` is the activation OTP; **`STF-03` is Create password** |
| §14.1 "an invitation to an existing staff account attaches a new `RoleAssignment`" and "the same number may exist in both realms, not linked" | **Deferred** | `[DELEGATED]` — an unapproved choice. Realm policy is `DG-27`, Hassan's decision. The interim per-realm uniqueness rule (SRS §6.4.5) stands |
| §14.2 `CAP_REPORT_VIEW_OWN` (staff read of own report, plus clarification and confirm/dispute) | **Deferred** — see §3.A | `[DELEGATED]`. It conflicts with the citizen-only confirmation state and entity |
| §14.3 organisation-level conflict recorded as a gap | **Accepted (as a gap)** | Same as `DG-22` |
| §14.4 suspension, revocation, restoration | **Accepted** | Labelled `[RECOVERED]`; consistent with `FR-AUTH.26`, `FR-PORTAL.25` |
| §14.5 six server-side checks; "`DR-33` — no external approval gates development" | **Accepted** | The checks are `[RECOVERED]`. The development-gate statement matches Hassan's own instruction of 2026-10-03 (`DG-01`) |

### 2.2 Data Model and Identity Schema (`SRS/DATA_MODEL_AND_IDENTITY_SCHEMA.md`, v1.4)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| Entity model (31 entities), identity vault, `ClientSubmission`, `VoiceTranscriptionArtifact`, `RenderingConfirmation`, `CivicReport`, retention wording | **Accepted** | Matches SRS §6 (31 entities, same arithmetic) |
| §4.2 OTP controls — 6 digits, 5-minute expiry, single use, max 5 attempts | **Accepted** | `FR-AUTH.8`, `NFR-52` |
| §4.2 numeric caps (resend 60 s; 3/hour and 10/day per number; 5/hour per device; 20/hour per IP) — **edited in place** | **Deferred as decisions; used as labelled development defaults** | `[DELEGATED]` values. `FR-AUTH.8` reserves the thresholds for Hassan (`DG-13`). Implementation reads them from configuration marked "proposed default" |
| §4.2 "five failures consume the challenge; no account lock" | **Accepted on the challenge; account-lock question left open** | `FR-AUTH.8` requires **the challenge** to lock after five failures, and it does. Whether `CitizenAccount.status = TEMPORARILY_LOCKED` is ever used remains part of `DG-13` |
| §4.2 purpose binding (`DR-31`) | **Accepted** | Hassan's instruction of 2026-10-03 to preserve purpose-binding (`DG-11`) |
| §4.7 / R.2 server-held consent version and selections (`DR-32`) | **Accepted** | Hassan's instruction of 2026-10-03 to preserve consent handling server-side (`DG-12`) |
| §5.7 `DR-28` optional photo; `evidence_completeness` derived server-side; completion evidence still required | **Accepted** | Hassan's instruction of 2026-10-03 (`DG-09`) |
| "`ReporterConfirmation` generalisation — RECOMMENDED, not applied" | **Accepted as unresolved** | `DG-20` stays open |

### 2.3 API Contract (`SRS/API_CONTRACT.md`, v3.1)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| §1–§9, §11 body (transport classes, endpoints, preconditions, privacy-filtered responses, error catalogue) | **Accepted** as working text | Matches SRS §4.3 and the endpoint list in §4.3.2 |
| §6 two idempotency headers (`DR-30`) | **Deferred** | `[DELEGATED]` unapproved choice; `DG-10` is open. **§10 of the same file still names the single `X-Idempotency-Key`** — an incomplete edit |
| R.1 purpose-binding **rule** | **Accepted** (`DG-11`) | — |
| R.1 purpose → endpoint **pairs** (`citizen_signup_login → API-004`, `staff_activation → API-120`) | **Rejected** | SRS §4.3.2: `API-004` is **logout**, citizen verify is **`API-122`**, `API-120` is **role select**, staff activation verify is **`API-124`**. Correct pairs: `citizen_signup_login → API-122` · `staff_activation → API-124` · `staff_login → API-125` · `step_up → API-126` · `password_reset → API-127` · phone-change purposes → `API-156` (citizen) or the staff phone-change route |
| R.2 consent integrity | **Accepted** (`DG-12`) | — |
| R.3 `E_EVIDENCE_REQUIRED` withdrawn for citizen intake; location plus one description modality required | **Accepted** (`DG-09`) | — |
| R.4 `API-150s` staff own-report read and companion routes, **including `confirm` and `dispute`** | **Deferred** — see §3.A | `[DELEGATED]` |
| R.5 retry window 7 days + 7 days read-only | **Deferred as decision; usable as a labelled default** | `DG-14` is Hassan's |

### 2.4 Screen Inventory and Navigation (`SRS/SCREEN_INVENTORY_AND_NAVIGATION.md`, v1.4)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| §1–§3, §7–§9 (principles, citizen screens, voice states, labels, offline table, accessibility) | **Accepted** | Matches SRS §4.1 |
| §4 optional photo (`CIT-08` "Continue without a photo"; `CIT-11` states what is missing) | **Accepted** (`DG-09`) | — |
| §4 "`CON-03` contractor completion evidence" and "`REP-04` completion-verification evidence" | **Rejected (IDs)** | SRS Appendix B: **`CON-04`** Submit completion, **`REP-03`** Verify completion |
| §5 still says "The four staff portals are not migrated to React Native" (Django/HTMX) | **Rejected** | Contradicts its own v1.4 revision row and SRS `DR-25`/`DR-26`. The client platform is React Native |
| `STF-11 — My Official Reports`; total 58 → 59 | **Deferred** — see §3.A and §3.B | `[DELEGATED]`. The **approved inventory stays 58**; `STF-11` is **PROPOSED** |
| §6 totals table labels its "v1.3 counted" column 59 | **Rejected** | v1.3 = 58 (its own arithmetic line). 59 only if `STF-11` is approved |

### 2.5 Technical Stack (`SRS/TECHNICAL_STACK.md`, v1.4)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| Revision row "BREAKING — Unified Binary Architecture adopted; v1.3 §2 withdrawn" | **Rejected as a claim** | **§2 and §3 of the same file were not changed.** They still say the staff portals are Django/HTMX and the mobile app is "for citizens only". The amendment the row describes was not made. **The override still lives only in SRS `DR-26`, and `TBD-M13` (`DG-02`) remains open** |
| §0 "Intel Mac: arm64-only native issues such as the SQLCipher 16 KB defect cannot be reproduced on this host" | **Rejected as stated** — see §3.D | Android publishes a **16 KB page-size Intel x86_64** emulator image. A physical 16 KB-capable arm64 device can be used from any host |
| §1 versions (Expo SDK 57, RN 0.86, React 19.2.3, Node ≥ 22.13) | **Accepted, verified** | `expo@57.0.26` bundles `react-native` 0.86.3 and `react` 19.2.3; RN 0.86 accepts Node `^24.3.0`; the installed Node is 24.21.0 (§3.D) |
| §4 module list, §5 storage boundary | **Accepted** | Matches SRS §3.2.1, §3.6.3 |

### 2.6 Test Catalogue (`SRS/TEST_CATALOGUE_IDENTITY_FOUNDATION.md`, v1.1)

| 2026-10-03 change | Disposition | Authority / reason |
|---|---|---|
| v1.0 body (78 distinct test IDs) | **Accepted** as planned tests | Specified, not executed |
| T.A optional-photo tests; T.C purpose-binding; T.D consent; T.G workflow permissions | **Accepted** as planned tests | Follow accepted rules |
| T.B tests that encode the proposed numeric caps (`TEST-OTP-023`, `-026`, `-027`, `-028`) | **Accepted with configurable thresholds** | They test whatever `DG-13` decides |
| `TEST-OTP-012` "`citizen_signup_login` ticket presented to **`API-120` activation**" | **Rejected (endpoint)** | `API-120` is role select; staff activation verify is `API-124` |
| T.E dual-key idempotency tests | **Deferred** with `DG-10` | — |
| T.F `TEST-OWN-006`/`-007` (staff reporter answers a clarification, confirms or disputes) | **Deferred** — see §3.A | — |

### 2.7 Documents imported unchanged (no 2026-10-03 edits)

| File | Date | Classification |
|---|---|---|
| `CR-60_REACT_NATIVE_MIGRATION.md` | 29 Aug | **Active authority** for `DR-19` (approved by Hassan, 20 Aug) |
| `CR-59_ANONYMOUS_CITIZEN_REPORTING.md` | 29 Aug | Historical — superseded by CR-61 |
| `CHANGE_MANIFEST_CR61_r1.3.md` | 2 Sep | Supporting — provides the v1.3 hashes above |
| `Parakh_Mobile_SRS_v1.1.0/v2.0.0/v2.1.0_Change_Record.md` | 13–14 Sep | Supporting — change history of the active SRS |
| `PARAKH_IMPLEMENTATION_READINESS_PACK_v1.0.md` (`PARAKH-IRP`) | 14 Sep | **Proposals only.** Its author line names a role, not a person ("Lead Technical Product Manager / React Native Solutions Architect"). Its "30 items closed on the architect's authority" are **determinations Hassan has not made** |
| `Parakh_Roadmap_One_Page_Summary.md` | 16 Aug | Historical — source of the 10 Oct definition of done (§3.C) |
| `Parakh_Prototype_SRS_v1.4.2.md` | 30 Aug | Historical baseline; source of legacy `NFR-*`/`BR-*`/`TBD-*` text (SRS rank 6). Hash matches the use-case manifest |
| `AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` v1.2 | 31 Aug | Historical. Hash matches the use-case manifest |

The other workspace also holds Mobile SRS v1.0.0–v2.0.0, every Prototype SRS and Build Spec version, Master Documents, decks and generated working fragments. **These were not imported.** The active SRS v2.1.0 is byte-identical to the copy already in `SRS/`.

## 3. The contradictions named by Hassan

### A. Staff reporting and confirmation

The full path was traced through every layer:

| Layer | What the sources say |
|---|---|
| **Reporting identity** | `STF-10` / `API-141` create `CivicReport.reporter_kind = staff_official`, with `official_reporter_account_id` set and `citizen_account_id` NULL (Data Model §5.5 CHECK) |
| **Ownership** | `ReportOwnership(subject_type, subject_id)` can name a staff account |
| **API authorization** | Staff reads are scope-based (RBAC §3). The proposed `CAP_REPORT_VIEW_OWN` adds an enumerated ownership read. Nothing approved grants a staff reporter T11 |
| **Confirmation entity** | `CitizenConfirmation` requires `citizen_account_id`. `ReporterConfirmation` is "RECOMMENDED, not applied" |
| **State transition** | T11 `PENDING_CITIZEN_CONFIRMATION → RESOLVED_CONFIRMED` is performed by **Citizen** |
| **Self-review exclusion** | An account-level `ConflictExclusion` is written on official submission and bars every reviewing verb |
| **Tests / use cases** | `TEST-OWN-007`, `UC-REP-011`, `UC-UCO-018`, `WF-10`, `WF-11` |

**Result.** A staff-official report still has **no authorised actor and no entity for T11**. Adding `STF-11` with a `confirm` route does not change the state machine, so the route would have nothing valid to write.

**Design adopted for this repository:**

| Item | Treatment |
|---|---|
| **Reporter confirmation is not verification** | It never grants verify, accept, assign, approve, close or decide authority. Confirmation stays distinct from official verification and from UC Officer closure |
| **`STF-11` read-only own-report view** (`CAP_REPORT_VIEW_OWN` read routes) | **PROPOSED** — recommended for approval as the read half of `DG-21`. Approved screen total stays **58** |
| **`STF-11` confirm, dispute and clarification routes** | **Blocked** until `DG-20` decides the state and entity. Recommended option: rename to `PENDING_REPORTER_CONFIRMATION` with a subject-type-aware `ReporterConfirmation` — a change to five source documents |
| **No workaround** | No citizen identity is invented and nothing auto-resolves (`T-090`, `T-104` stay Blocked) |

### B. Requirements, screens and tests — recounted from the files present

| Measure | Value | Explanation of differences |
|---|--:|---|
| Functional requirements (SRS v2.1.0) | **124** | Same in both workspaces |
| Non-functional requirements **defined** | **86** | The "88" in the incoming state counts every distinct `NFR-n` string, including `NFR-15` and `NFR-24`. Those two appear only in the text that **reserves** `NFR-15…NFR-24`; they are not requirements |
| Security controls `SC-01`…`SC-12` | **12** | Counted separately; not NFRs |
| Screens, approved | **58** | `23 + 10 + 4 + 8 + 4 + 9`. "59" adds the proposed `STF-11` |
| Planned tests — SRS acceptance IDs | **123** `AT-*` (`FR-PORTAL.30` has none) | SRS §10.4 |
| Planned tests — use-case pack | **167** distinct `AT-*` IDs | `08_USE_CASE_ACCEPTANCE_TESTS.md`; these overlap with the SRS IDs in name only (`DG-08`) |
| Planned tests — Test Catalogue | **135** distinct `TEST-*` IDs = 78 (v1.0 body) + 57 (added 2026-10-03) | v1.0 recorded "111 assertions"; see §1.1 |
| Implemented application tests | **0** | No application code exists |
| Executed application tests | **0** | The 12 tracker tests are documentation-tool tests, not application tests |

**The foundation is not "finalized".** Contract contradictions remain open: `DG-10`, `DG-13`, `DG-20`, `DG-21`, `DG-22`, and the rejected rows above.

### C. Deadline and scope

| Date | Source | What it means | Status today |
|---|---|---|---|
| **10 Oct 2026** | `Parakh_Roadmap_One_Page_Summary.md` (16 Aug) and `Parakh_Execution_and_Responsibility_Roadmap_2026.pdf` (14 Aug) | "Release 0 target": 84 P0 requirements, four actors, Flutter, synthetic data, a fifteen-condition definition of done, with an external developer assumed | **Not explicitly superseded by any source.** The stack and actor changes do not cancel it. It is a **historical target that will not be met**. By its own rule, on 10 Oct the project is described as **"a prototype in development"**, not a completed prototype |
| **1 Nov 2026** | Mobile SRS v2.1.0 Document Control and §8.5 | "Target application submission" — gate **G3**: every `[MUST] · P1` acceptance test passing (Phase 1 exit criteria 1–16) | **Current target.** At risk: no application code exists |

The three are kept distinct:

- **Original release acceptance criteria:** the 10 Oct fifteen conditions, and the G3 exit criteria for 1 Nov.
- **Reduced demonstration scope:** the vertical slice in PROJECT_PLAN §4 (citizen sign-in → capture → rendering → confirm → submit → My Reports). The incoming plan proposed a citizen → Street Representative slice instead. **Neither satisfies G3 or the five-role workflow.**
- **Proposed schedule:** PROJECT_PLAN §5–§7. The **20 h/week figure is a provisional planning assumption**; Hassan has not committed to it (`DG-38`).

### D. External and technical claims — checked 2026-10-03

| Claim (incoming) | Check | Result |
|---|---|---|
| Expo SDK 57 exists and pins RN 0.86 / React 19.2.3 | npm registry: `expo@57.0.26` `bundledNativeModules.json` | **Verified**: `react-native` 0.86.3, `react` 19.2.3, `expo-sqlite` ~57.0.3. `react-native@0.86` engines accept Node `^24.3.0`; Node 24.21.0 is installed |
| SQLCipher via `expo-sqlite` | Expo docs (SDK 57): config option `useSQLCipher`, key set with `PRAGMA key`; "SQLCipher is not supported on Expo Go"; Android, iOS and macOS only | **Verified as documented.** Not yet built (`DEP-08`) |
| The 16 KB SQLCipher defect cannot be reproduced on an Intel Mac | Android docs, "Test in a 16 KB environment": a **"16 KB Page Size Intel x86_64 Atom" emulator image** exists; Pixel 8 and later support a 16 KB developer mode | **Partly wrong.** An x86_64 16 KB image tests the x86_64 build on this host. **arm64-v8a alignment needs an arm64 16 KB device (or the static alignment check).** Host architecture, emulator ABI and physical-device testing are separate questions. `expo/expo#39792` (the 16 KB `useSQLCipher` issue) is **closed** — still to be confirmed in our own build |
| iOS builds are "possible but slow" on Intel; the build SDK must be current | Not checked against Apple documentation here | **Unverified.** To check at `T-024`. A cloud build service is an alternative, not verified for this project |
| Every mainstream voice provider processes audio outside Pakistan; self-host Whisper | Not checked | **Unverified.** A provider's processing location must be checked per provider, and self-hosting only helps if the **hosting location** is itself acceptable (`DG-16`) |
| Unregistered A2P SMS is filtered in Pakistan; PTA sender-ID registration is required | Not checked | **Unverified regulatory claim.** Treated as a question for provider selection (`DG-15`), not as an established legal fact |

**Effect on the plan.**

- **Not blocked:** none of the unverified claims blocks prototype development with labelled development adapters.
- **The real blockers stay:** provider selection and legal review remain blockers for a real integration only.

### E. Git lock claims

- **Desktop repository:** no `.lock` file exists in `.git/`, and every Git operation here succeeded.
- **Incoming journal:** it contains no "writes failed silently since August" statement.
- **Action:** no lock recovery was attempted, and none is needed.

## 4. Changes made to this repository as a result

| Record | Change |
|---|---|
| `SRS/` | 16 files imported unchanged (hashes in `SOURCE_REGISTER.md` S-27…S-42) |
| `DECISIONS_AND_GAPS.md` / `decisions.csv` | `DG-01` resolved; `DG-09`, `DG-11`, `DG-12` resolved by Hassan's instruction of 2026-10-03; `DG-36` resolved (verified); `DG-05` partly resolved; notes on `DG-02`, `DG-10`, `DG-13`, `DG-14`, `DG-20`, `DG-21`; new `DG-51` (unapproved decisions in incoming documents) |
| `tracking/data/tasks.csv` | `T-117`, `T-026`, `T-013`, `T-020` Done; dependency of `T-027` on `T-019` removed (the backend does not depend on the Flutter scaffold) |
| `SOURCE_REGISTER.md`, `SRS/SOURCE_INDEX.md` | New sources registered; "missing" table updated |
