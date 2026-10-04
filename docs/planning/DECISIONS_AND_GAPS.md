# Decisions and Gaps

| Field | Value |
|---|---|
| Purpose | The single register of reconciled decisions, open product questions and source conflicts |
| Created | 2026-10-03 (Asia/Karachi), task `T-003` |
| Owner | Hassan Jalal. **No proposed item is approved here.** |
| Structured index | [`tracking/data/decisions.csv`](../../tracking/data/decisions.csv). IDs and statuses must match this file; `scripts/generate_tracker.py` checks it |

## 1. Rules used

- **Precedence** follows the Mobile SRS v2.1.0 (S-01 §D): brief/meeting for scope and dates → CR-61 → RBAC/Data/API/Screen (missing) → Technical Stack (missing) → use-case pack → legacy SRS v1.4.2 identifiers.
- **Scoped overrides stay scoped.** `DR-26` overrides the staff **client platform** only. It changes no permission, capability, scope, transition or privacy rule.
- **The owner's latest explicit instruction** (2026-10-03, sole developer and designer) supersedes the older staffing and scaffolding assumptions. It is recorded here as a user-directed workflow update, not as a change to any civic rule.
- **Status vocabulary:**
  - `Open` — a decision is needed.
  - `Proposed` — a recommendation awaits Hassan.
  - `Interim` — implementation follows the higher-precedence source until formal closure.
  - `Partly resolved` — some aspects of the item are closed and others remain open.
  - `Resolved` — closed by a recorded decision, or a routine reversible technical choice.
  - `Resolved by override` — closed by a recorded override of a named source.
  - `Deferred` — postponed by its source.
- Hassan owns every decision and is the only decision owner. Routine, reversible technical choices say so in their note, and Hassan can reverse any of them.

## 2. Summary register

| ID | Issue | Severity | Status | Decision owner | Affected tasks |
|---|---|---|---|---|---|
| DG-01 | Ownership and delivery model: sole developer vs mentor scaffolding and external developer lanes | High | Resolved | Hassan Jalal | T-020 |
| DG-02 | Client platform: DR-25/DR-26 unified React Native binary vs older staff-web statements | High | Resolved by override | Hassan Jalal | T-025;T-089 |
| DG-03 | Flutter scaffold in apps/citizen conflicts with DR-19 (React Native) | Medium | Open | Hassan Jalal | T-019;T-031 |
| DG-04 | Delivery targets: 10 Oct 2026 pilot vs 1 Nov 2026 submission for one developer | High | Open | Hassan Jalal | T-012;T-114 |
| DG-05 | Referenced rank-2/3/4 sources are missing (RBAC, Data Model, Screen Inventory, API Contract, Tech Stack, Test Catalogue, CR-60, SRS v1.4.2) | High | Partly resolved | Hassan Jalal | T-026;T-036;T-081 |
| DG-06 | DATABASE_ARCHITECTURE supplied is v2.4, not the v2.7 named by S-01/S-14; both pre-date CR-61 | Low | Resolved | Hassan Jalal | — |
| DG-07 | Phase terminology: legacy P0/P1/P2 vs mobile P1/P2/P3 vs module R0/P1 | Low | Resolved | Hassan Jalal | — |
| DG-08 | Acceptance-test ID collision: S-01 AT-AUTH-001.. vs use-case pack AT-AUTH-001..; pack reuses AT-OFF for two groups | Low | Resolved | Hassan Jalal | — |
| DG-09 | D-14 mandatory-photo rule (Blocker) | High | Resolved | Hassan Jalal | T-013;T-049;T-061 |
| DG-10 | D-12 / RC-06 one idempotency header or two | High | Open | Hassan Jalal | T-014;T-036;T-060;T-061 |
| DG-11 | D-07 / RC-19 OTP tickets are not purpose-bound | High | Resolved | Hassan Jalal | T-015;T-036;T-038 |
| DG-12 | D-08 / RC-15 pre-authentication consent payload integrity | Medium | Interim | Hassan Jalal | T-015;T-039 |
| DG-13 | OTP numeric policy: expiry, resend interval, lockout duration, rate-limit thresholds | Medium | Open | Hassan Jalal | T-016;T-038 |
| DG-14 | ClientSubmission retry-window duration | Medium | Open | Hassan Jalal | T-016;T-052 |
| DG-15 | SMS OTP provider, cost and delivery policy | High | Open | Hassan Jalal | T-017;T-038;T-065 |
| DG-16 | ASR + Urdu rendering AI provider and processing location | High | Open | Hassan Jalal | T-018;T-056;T-059 |
| DG-17 | RC-14 does AI failure block submission (BR-027 vs CR-61 §8.1) | Medium | Interim | Hassan Jalal | T-056 |
| DG-18 | RC-09 Punjabi: speech accepted vs BR-033 'no Punjabi claim' | Low | Interim | Hassan Jalal | T-050;T-056 |
| DG-19 | RC-07 / D-13 'Citizen name' in privacy matrix but no field exists (Blocker) | High | Open | Hassan Jalal | T-101 |
| DG-20 | RC-17 / D-01 staff-official report stalls at PENDING_CITIZEN_CONFIRMATION (Blocker) | High | Open | Hassan Jalal | T-090 |
| DG-21 | RC-18 / D-02 / D-03 staff reporter cannot see their own report; STF-11 proposed (Blocker) | High | Open | Hassan Jalal | T-090;T-104 |
| DG-22 | RC-08 / D-06 contractor organisation-level self-dealing (Blocker) | High | Open | Hassan Jalal | T-095 |
| DG-23 | RC-11 / D-09 no staff voice-processing notice before STF-10 | High | Open | Hassan Jalal | T-090 |
| DG-24 | TBD-M11 pre-role session timeout; TBD-M14 backgrounding threshold for the wipe protocol | Medium | Open | Hassan Jalal | T-085;T-088 |
| DG-25 | First Mayor/Ops bootstrap procedure (H8); contractor-organisation registration surface (H9) | High | Open | Hassan Jalal | T-082;T-100 |
| DG-26 | No-citizen-response closure policy; repeated-reopening cap | Medium | Open | Hassan Jalal | T-067;T-097 |
| DG-27 | Account realms: may a staff user hold a citizen account on the same number? | Medium | Open | Hassan Jalal | T-081 |
| DG-28 | Retention durations and lawful-request procedure | High | Open | External: legal or institutional review (Hassan coordinates) | T-113;T-114;T-101 |
| DG-29 | Distribution channel (TBD-M5) and build-signing credential custody (DEP-07) | Medium | Open | Hassan Jalal | T-021;T-079;T-107 |
| DG-30 | Map tiles and reverse-geocoding provider for CIT-10 (react-native-maps is a later module, CIT-10 is Phase 1) | Medium | Open | Hassan Jalal | T-051 |
| DG-31 | Background sync is a later module but queued drafts must survive restart | Low | Resolved | Hassan Jalal | T-052 |
| DG-32 | Stale sentences inside S-01 v2.1.0 still describe the superseded web staff portals (§1.1.1, §1.4.5, §2.3.1 client column, §2.5.3, §3.5, §4.3.1.1 note) | Medium | Open | Hassan Jalal | T-025 |
| DG-33 | Certificate pinning (TBD-M8) | Low | Open | Hassan Jalal | T-089 |
| DG-34 | CAP_SAFEGUARDING has no screen or requirement (TBD-M10) | Low | Deferred | Hassan Jalal | — |
| DG-35 | Android minimum version: pinned Android 7+ vs open TBD-005 | Low | Interim | Hassan Jalal | T-021;T-022 |
| DG-36 | Installed Node.js 24.21.0 vs Expo SDK 57 minimum Node 22.13 | Low | Resolved | Hassan Jalal | T-031 |
| DG-37 | Git workflow: CONTRIBUTING Issue→branch→PR→merge vs automatic checkpoint pushes | Medium | Resolved | Hassan Jalal | T-011 |
| DG-38 | Weekly working capacity is unconfirmed | High | Open | Hassan Jalal | T-012 |
| DG-39 | D-10 local encryption mechanism (resolved by DR-23); DEP-08 engineering verification outstanding | High | Resolved | Hassan Jalal | T-046;T-047;T-080 |
| DG-40 | Earlier open items already closed by later records: Staff-pre-role (D-04/D-05 → DR-22), iOS 16.4 (DR-24), Android+iOS scope (RC-02), RC-01, RC-03, RC-10 | Info | Resolved | Hassan Jalal | T-085;T-080 |
| DG-41 | Who performs human review of Urdu consent, privacy and status text (FR-COMMON.6) | Medium | Open | Hassan Jalal | T-032;T-045 |
| DG-42 | Confirm exclusions from the 2026-10-03 import (six screenshots, unattached research-paper docx, personal PDFs) | Low | Open | Hassan Jalal | — |
| DG-43 | Routes without API identifiers: citizen rendering correction, GET /categories, GET /geo/reverse, GET /citizen/reports/summary, GET /citizen/notifications | Medium | Open | Hassan Jalal | T-036;T-048;T-057 |
| DG-44 | Project licence; licence and provenance of the bundled Urdu font | Low | Open | Hassan Jalal | T-032 |
| DG-45 | S-01 §8.2 says 79 Phase 1 FRs; per-requirement tags give 77 (FR-PUB.8 is P?, FR-NOTIF.4 tagged P2 but listed in §8.2) | Low | Open | Hassan Jalal | T-068;T-025 |
| DG-46 | CAP_EXPORT has no approved screen; export behaviour unspecified | Low | Open | Hassan Jalal | T-102 |
| DG-47 | Numeric photo-count bounds (TBD-M9) | Low | Open | Hassan Jalal | T-049 |
| DG-48 | Development adapters for SMS and AI | Medium | Resolved | Hassan Jalal | T-038;T-056 |
| DG-49 | Two local clones after moving the canonical root to the Desktop | Low | Resolved | Hassan Jalal | — |
| DG-50 | Repository visibility and personal content in source documents | Medium | Resolved | Hassan Jalal | — |
| DG-51 | Incoming documents contain decisions Hassan has not approved (DR-28…DR-33 '[DELEGATED]', IRP 'closed on the architect's authority') | High | Resolved | Hassan Jalal | T-117 |
| DG-52 | Citizen-auth implementation choices the specifications leave open (error codes, body shapes, token lifetimes) | Medium | Proposed | Hassan Jalal | T-039;T-040;T-041;T-043 |

## 3. Detail — every item

| ID | Conflicting or relevant sources | Current authority | Recommended resolution | Phase impact | Note |
|---|---|---|---|---|---|
| DG-01 | S-01 Approval table, §2.7 ASM-01, §8.1 G0/G1, §8.5; S-21 slide 23; S-24 §03–§05; S-25 slides 5–8; owner instruction 2026-10-03 | Owner instruction 2026-10-03: Hassan is the sole human developer and designer | Treat G1 (mentor scaffolds the app) and every developer lane as superseded. Keep the separate question of any academic or institutional approval gate (G0, TBD-M1..M4) open until Hassan states whether it still applies | All | Decided by Hassan Jalal, 2026-10-03: ordinary prototype development requires no external mentor or institutional approval gate. The SRS mentor-approval row is a historical review milestone, not a development gate. Nothing is waived for real-world use: pilot approvals (T-114) remain |
| DG-02 | S-01 §1.4.3.1 DR-25, §1.4.3.2 DR-26, RC-04, RC-23, TBD-M12, TBD-M13; SRC-STACK §2 (missing); S-03 §6 client column | S-01 DR-25/DR-26 (approved by Hassan 14 Sep 2026): all 58 screens ship in one React Native app; backend stays Django/DRF | Implement DR-25. The override is conditional on SC-01..SC-12 (§7.4.2): descoping them re-opens RC-23. Draft the TECHNICAL_STACK v1.4 / change record (TBD-M13) without editing superseded files | P2;P3 | Documentation sync (TBD-M12, TBD-M13) remains open. The incoming TECHNICAL_STACK v1.4 revision row claims the amendment, but its §2/§3 body still describes web staff portals, so it is not the amended document |
| DG-03 | Repo commit 9a23353 (2026-08-12); S-01 §2.5.3 'No Flutter exists'; DR-19 | DR-19 (React Native) governs | Remove apps/citizen in one dedicated, reviewable commit after Hassan confirms; history keeps it. Do not port anything: it is the default counter app | P1 |  |
| DG-04 | docs/pilot-scope.md; S-24 (58-day plan to 10 Oct, assumed a developer); S-01 Document Control (SRS target 3 Oct, submission 1 Nov) and §8.5 | No current dated decision. 10 Oct and 3 Oct are historical targets | Record 10 Oct as a superseded historical target. Keep 1 Nov as the submission target, with the scope reduced to the evidence-backed vertical slice plus labelled gaps (PROJECT_PLAN §6), or set a new date | All |  |
| DG-05 | SOURCE_REGISTER §5 | S-01 restatements are the best available authority | Hassan to locate the earlier documentation workspace. Until then build to a PROPOSED Phase 1 contract derived from S-01 §4.3 and §6, labelled as such | P1;P2;P3 | 2026-10-03: found in another local Parakh workspace, but edited in place in that workspace the same day (RBAC/Data/Screen/Stack v1.4, API v3.1, Test Catalogue v1.1). v1.3 originals lost (hashes in the CR-61 manifest do not match). Imported as the best available text with every change classified (RECONCILIATION_2026-10-03). CR-60, SRS v1.4.2 and CR-59 were found unedited |
| DG-06 | S-16 header; S-01 §C; S-14 §2 | S-01 §6 (Data Model v1.3 restatement) | Classify v2.4 as historical; use it for nothing | — | Classification only. Routine, reversible classification |
| DG-07 | S-17 §3.7; S-01 §1.2.5, §3.2.1, §8.2 | S-01 §1.2.5 phase tags | Use S-01 phase tags. Read module 'R0' as 'required in Phase 1' and module 'P1' as 'later module'. Mapping in PROJECT_PLAN §2 | — | Routine, reversible documentation convention |
| DG-08 | S-01 §10.4; S-11 groups 14 and 21 | — | Unprefixed AT-* IDs in the tracker mean S-01 IDs. Use-case pack IDs are written UCP:AT-*. No ID is renumbered | — | Routine, reversible documentation convention |
| DG-09 | S-02 §14; S-01 FR-PUB.8, §11.3.1 item 6; S-12 D-14 | Hassan Jalal's instruction, 2026-10-03 | A photo is encouraged but optional: initial citizen submission proceeds with a sufficiently described and locatable issue. Street Representative verification evidence and contractor completion evidence remain required. evidence_completeness is derived server-side for reviewers | P1 | Decided by Hassan Jalal, 2026-10-03 (matches the incoming DR-28 text, which cites the same instruction) |
| DG-10 | S-01 §3.6.4, §6.2.6, RC-06; S-12 D-12 | Contradiction (SRC-API vs SRC-DATA) | Two distinct headers: X-Confirmation-Idempotency-Key on API-135 and X-Submission-Idempotency-Key on API-140/141 | P1 | Incoming documents propose DR-30 (two headers) as a 'delegated' decision. It remains a proposal; API v3.1 §10 still names the single header |
| DG-11 | S-01 §6.2.9 OTPChallenge, RC-19; S-12 D-07 | Hassan Jalal's instruction, 2026-10-03 | Stamp every verify result with the challenge purpose and reject it at any endpoint expecting a different purpose (validation rule, no new endpoints) | P1;P2 | Decided by Hassan Jalal, 2026-10-03 ('preserve server-side OTP expiry, single-use behaviour, purpose-binding, consent handling, and abuse controls'). Correct purpose → endpoint pairs per RECONCILIATION_2026-10-03 §2.3 |
| DG-12 | S-01 FR-AUTH.4, RC-15; S-12 D-08 | Persistence locked; integrity proposed | Store consent_version and the selected options on the OTPChallenge at request time; the device copy becomes a convenience | P1 | Hassan instructed on 2026-10-03 that consent handling be preserved server-side. Implementation follows the D-08 recommendation (server stores consent_version and selections on the OTP challenge) pending his formal sign-off of that mechanism |
| DG-13 | S-01 FR-AUTH.8, NFR-52 (five attempts fixed), §4.4 rate limiting, §11.4.1 | Only 'lock after five failed attempts' is fixed | Hassan sets development defaults as configuration (not code), recorded with date; revisit with field evidence | P1 | Incoming DR-29 numeric caps (resend 60 s; 3/h and 10/day per number; 5/h per device; 20/h per IP; no account lock) are proposals in the incoming documents. Implementation uses them only as configuration defaults labelled 'proposed' |
| DG-14 | S-01 §6.2.4, §6.4.1, §11.4.1 | Undecided | Set a configurable development default; final value with field evidence | P1 | Incoming R.5 proposes 7 days + 7 days read-only (a proposal in the incoming documents); usable as a labelled default only |
| DG-15 | S-01 ASM-03, R-01, DEP-02; S-02 §20 | No provider selected; none integrated | Proceed with a labelled development-only adapter. Decide whether the 1 Nov submission uses a real provider (cost, sender registration) or is explicitly a development demonstration | P1 |  |
| DG-16 | S-01 ASM-04, R-02, DEP-03; S-02 §18 | No provider, hosting location or legal approval named | Proceed with a labelled mock adapter in development only; choose the provider with processing location and data-protection review recorded | P1 |  |
| DG-17 | S-01 RC-14, BR-027, NFR-13; S-02 §8.1 | S-01 precedence: CR-61 (rank 2) over legacy BR-027 (rank 6) | Implement CR-61 §8.1: failure never blocks capture, never fabricates text, and no CivicReport is created without reporter confirmation. Hassan to close RC-14 formally | P1 | Implementation follows CR-61 pending formal closure |
| DG-18 | S-01 RC-09, NFR-27; S-02 §4 | CR-61 §4: written interface Urdu/English only; spoken input includes Punjabi | Follow CR-61. No Punjabi written UI and no accuracy claim; speech is accepted. Amend BR-033 at the next SRS revision | P1 | Implementation follows CR-61 pending formal amendment |
| DG-19 | S-01 RC-07, §4.3.5, §6.4.4; S-12 D-13 | S-01 follows the data model: no citizen name exists | Delete the row from the RBAC matrix at its next revision; collect no name | P3 | No effect on Phase 1, which collects no name |
| DG-20 | S-01 RC-17; S-02 §12.3 DEFERRED; S-12 D-01 | Deferred in three sources | PENDING_REPORTER_CONFIRMATION with a subject-type-aware ReporterConfirmation (S-12 recommendation). Until decided, the staff-official completion path stays blocked; no citizen identity is invented and nothing auto-resolves | P2;P3 | 2026-10-03 trace (RECONCILIATION §3.A): no actor or entity can perform T11 for a staff-official report. The incoming STF-11 confirm/dispute routes are blocked until this is decided |
| DG-21 | S-01 RC-18, FR-PORTAL.30, §4.1.1; S-12 D-02, D-03 | STF-11 PROPOSED, not approved; inventory stays 58 | Approve read-only ownership access plus STF-11 (total 59), or another surface | P2;P3 | Incoming CAP_REPORT_VIEW_OWN / STF-11 ('delegated'). Read-only own-report view recommended for approval; approved screen total stays 58 |
| DG-22 | S-01 RC-08; S-12 D-06 | No source addresses organisation-level conflict | Add an organisation-level exclusion when a contractor staff account reports officially; filter it at API-163 and re-check at API-164 | P3 |  |
| DG-23 | S-01 RC-11; S-12 D-09 | Gap | Versioned notice on first use of STF-10 per staff account, acknowledgement recorded (informational, not a consent gate) | P2 |  |
| DG-24 | S-01 DR-22 rule 8, §3.4.3.2 | No value in any source | Hassan sets both as configuration before Phase 2 | P2 |  |
| DG-25 | S-13 H8, H9; S-02 §16 | Unspecified | Bootstrap: one-time audited management command run by Hassan as deployer. Registration: Mayor/Ops creates the organisation record (no public route). Both need Hassan's approval | P2;P3 |  |
| DG-26 | S-01 §11.4.1; S-13 M4, M5 | Undecided | Decide before Phase 3 closure work; until then a case without a response waits visibly | P1;P3 |  |
| DG-27 | S-01 §6.4.5 | Interim: uniqueness scoped per realm | Keep per-realm uniqueness for Phase 1; decide before staff accounts exist | P2 |  |
| DG-28 | S-01 §6.4, NFR-63; S-02 §14 | Undecided; no automatic deletion until approved | Record retention fields, perform no automatic deletion, and use synthetic data only until a review is recorded | All |  |
| DG-29 | S-01 TBD-M5, DEP-07, §8.5 | Undecided | Decide by the end of the vertical-slice milestone; store review lead times are a constraint | P1 |  |
| DG-30 | S-01 §3.2.1, DEP-04, CIT-10 | Conflict between module status and screen phase | Hassan chooses a tile/geocode provider (with cost and privacy terms) or approves a Phase 1 fallback: GPS coordinates with an accuracy indicator and button-driven pin adjustment | P1 |  |
| DG-31 | S-01 §3.6.4, R-16, NFR-11 | S-01 R-16: design foreground-first | Phase 1 syncs in the foreground and on app start; background sync is best-effort later | P1 | Routine, reversible technical choice |
| DG-32 | S-01 as listed; DR-25/DR-26 | DR-25/DR-26 govern | Issue an SRS PATCH revision that removes the stale sentences and records the count correction in DG-45; do not edit v2.1.0 in place | — |  |
| DG-33 | S-01 §4.4 TBD-M8 | Not specified | Decide in Phase 2 with the rotation plan | P2 |  |
| DG-34 | S-01 §9.3; S-13 L1 | Deferred by source | No task until a requirement exists | Later |  |
| DG-35 | S-01 RC-20, NFR-40, NFR-73 | Stack pin Android 7+, compile/target SDK 36 | Build for Android 7+ now; confirm with the devices actually used in testing | P1 |  |
| DG-36 | S-01 §2.4.1; ENVIRONMENT_CHECK.md | Minimum satisfied on paper | Verify during T-031 with npx expo install --fix and a dev build; if incompatible, install an LTS version that Expo SDK 57 supports | P1 | Verified 2026-10-03: expo@57.0.26 bundles react-native 0.86.3; react-native@0.86 engines accept Node ^24.3.0; installed Node 24.21.0. Install-time confirmation happens at T-031. Verified 2026-10-04 during T-031: Node 24.21.0 with Expo SDK 57.0.26 — expo install --check up to date, expo-doctor 21/21, Android bundle exported (VAL-014) |
| DG-37 | CONTRIBUTING.md; owner instruction 2026-10-03 | Owner instruction 2026-10-03 (explicit authorization to integrate verified work into main) | Completed, verified checkpoints reach main regularly: a normal direct push to main where branch rules permit it, otherwise the required pull request and permitted (squash) merge. Never force-push or bypass protections. GitHub Issues per task remain optional; the tracker is the task record | All | Decided by Hassan Jalal, 2026-10-03. Supersedes the earlier 'Hassan merges every PR' arrangement |
| DG-38 | Owner instruction 2026-10-03 | — | Plan assumes 20 working hours/week until Hassan states otherwise | All |  |
| DG-39 | S-01 DR-23, DEP-08, R-19 | DR-23 (approved 13 Sep 2026) | Prove SQLCipher on a real Android device and an iOS device before Phase 1 exit; do not call local storage encrypted until then | P1 | Decision resolved; verification is task T-046 |
| DG-40 | S-01 DR-22, DR-24, §11.3 | S-01 v1.1.0–v2.1.0 decisions | Implement as recorded | P1;P2 |  |
| DG-41 | S-01 FR-COMMON.6, §4.1.3 | Machine translation not acceptable | Hassan names a reviewer (himself or another fluent reader) and records review per string set | P1 |  |
| DG-42 | SRS/SOURCE_IMPORT_MANIFEST.md (local) | Excluded pending confirmation | Hassan confirms; nothing personal is imported without that | — |  |
| DG-43 | S-01 §4.1.2, §4.3.2 | SRC-API missing | Do not invent API-nnn numbers. Name these routes by path in the PROPOSED contract and label them | P1 |  |
| DG-44 | Owner instruction 2026-10-03; S-01 FR-COMMON.5 | No licence chosen | Choose a font with a licence that permits bundling (record the source); choose a project licence only when Hassan decides | P1 |  |
| DG-45 | S-01 §8.2, FR-PUB.8, FR-NOTIF.4 | Per-requirement tags | Tracker uses the tags; FR-NOTIF.4 is still planned inside Phase 1 work (T-068) because §8.2 lists it. Correct at the next SRS PATCH | P1 |  |
| DG-46 | S-01 FR-PORTAL.28; S-13 M2 | Undecided | Decide in Phase 3 if export is wanted at all (COULD) | P3 |  |
| DG-47 | S-01 FR-PUB.6, TBD-M9 | Not restated in any rev-1.3 source | Set as configuration with Hassan's values; do not invent | P1 |  |
| DG-48 | Owner instruction 2026-10-03; S-01 §8.6 | — | Adapters load only under development settings, mark their output as development/mock, and refuse to start otherwise. They are never described as integrations | P1 | Routine, reversible choice |
| DG-49 | Owner instruction 2026-10-03 | Desktop project root is canonical | Keep ~/Documents/Parakh repo/parakh-civic-tech untouched as a backup; do not work in it. Deleting it is Hassan's decision after confirming the push | — |  |
| DG-50 | S-24, S-25 (admissions and family context); GitHub API returns 404 unauthenticated (private repo) | Repository is private | Keep the repository private; do not change visibility. Run a privacy review before any public release | — |  |
| DG-51 | SRS/PARAKH_IMPLEMENTATION_READINESS_PACK_v1.0.md §0; the six v1.4/v3.1/v1.1 specifications §14/R/T; incoming DECISIONS_AND_GAPS | Owner instruction, 2026-10-03: do not approve a proposed decision on Hassan's behalf | Treat every 'delegated' or 'architect' decision in those documents as a proposal. Adopt only items Hassan instructed (DG-01, DG-09, DG-11) or decides later | All | Classification rule recorded by Hassan's instruction of 2026-10-03 |
| DG-52 | SRS/API_CONTRACT.md §3.1, §11, §12; SRS/DATA_MODEL_AND_IDENTITY_SCHEMA.md §4.2–§4.7 | No source fixes authentication error codes, request/response bodies or token lifetimes | Review `docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md` §3 (10 items) and accept, change or reject each; the mobile client follows the accepted version | P1 | Choices made while implementing T-039…T-041; reversible; not approved |

## 4. Questions for Hassan, grouped by what they unblock

### 4.1 Needed this week (before or during foundations)

| Question | Recommendation | ID |
|---|---|---|
| What is the delivery target, and how many hours per week can you work on Parakh? | Keep 1 Nov 2026 with the reduced scope in PROJECT_PLAN §6. Confirm hours (the plan assumes 20 h/week) | DG-04, DG-38 |
| May the default Flutter app in `apps/citizen` be removed in one commit? | Yes; it contains no Parakh code | DG-03 |

### 4.2 Needed before backend authentication and submission work

| Question | Recommendation | ID |
|---|---|---|
| One idempotency header or two? | Two | DG-10 |
| Accept the citizen-auth error codes, body shapes and token lifetimes as implemented? | Review the 10 items in `docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md` §3 | DG-52 |
| Formally sign off the server-held consent mechanism? | Yes | DG-12 |
| OTP expiry, resend interval, lockout duration, rate limits; draft retry window | Development defaults as configuration | DG-13, DG-14 |

### 4.3 Needed before a real (non-development) demonstration

| Question | Recommendation | ID |
|---|---|---|
| SMS provider, or an explicitly labelled development demonstration on 1 Nov? | Decide by the end of the vertical-slice milestone | DG-15 |
| AI provider and processing location? | Same | DG-16 |
| Map tiles / reverse geocoding for CIT-10, or the coordinate-and-buttons fallback? | Fallback first, provider later | DG-30 |
| Who reviews the Urdu consent, privacy and status text? | Name a person | DG-41 |

### 4.4 Phase 2/3 Blockers — not needed for Phase 1

`DG-19`, `DG-20`, `DG-21`, `DG-22`, `DG-23`, `DG-24`, `DG-25`, `DG-26`, `DG-27`. Each keeps its source's both-branch text. **No path depending on them is built until they are decided.**

## 5. Change log

| Date | Change | Authority |
|---|---|---|
| 2026-10-03 | Register created (DG-01…DG-50) | Initialization, owner instruction 2026-10-03 |
| 2026-10-03 | Reconciliation of the other workspace's documents (`RECONCILIATION_2026-10-03.md`): DG-01, DG-09, DG-11 and DG-36 resolved; DG-12 interim; DG-05 partly resolved; DG-51 added | Hassan Jalal's instruction, 2026-10-03 |
| 2026-10-03 | DG-37 resolved: verified checkpoints reach `main` regularly. The owner column names only Hassan | Hassan Jalal, 2026-10-03 |
| 2026-10-03 | DG-52 added (citizen-auth implementation choices, PROPOSED). DG-13 note: proposed defaults implemented as configuration | Implementation of T-039…T-041 |
| 2026-10-04 | Notes and source references reworded; no decision or status changed | Hassan Jalal's instruction, 2026-10-04 |
