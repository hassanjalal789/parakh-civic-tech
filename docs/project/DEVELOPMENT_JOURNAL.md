# Development Journal

Append-only. Each entry records what happened, why, how it was checked, and what remains. Earlier entries are never rewritten. Corrections are made in a later entry.

The Google Docs journal and Drive evidence archive named in the August plans (S-24, S-25) are not in this repository. This is the repository journal from 2026-10-03 onward.

---

## 2026-10-03 (Sat) — Project initialization

**Owner:** Hassan Jalal (instructions and decisions).

### Goal

Initialize the repository, so that later work resumes from the repository's files rather than from memory. Application implementation was explicitly out of scope.

### What happened, in order

1. **First attempt, from the Documents clone.**
   - Found the existing clone `~/Documents/Parakh repo/parakh-civic-tech`: origin on GitHub (private), 3 local commits. GitHub had 12 newer commits — Hassan's own merged PRs #1–#5 — which were fast-forwarded into the local `main`. No local work was at risk.
   - Created the local branch `setup/project-initialization`.
   - Copied the 21 attached documents into an `SRS/` tree; read and classified them.
   - Started drafts: source register and requirement extractor.
2. **A scope change from Hassan mid-session.** Hassan said: import documents only — no code, plan, commit or push. That work stopped. All Parakh documents found on the Mac were copied unchanged into a new Desktop folder, first specified as `~/Desktop/dev/parakh/` and then renamed by Hassan to **`~/Desktop/PARAKH PROJECT/`**. The result: 32 files copied, 94 identical duplicates recorded, 0 errors. Personal files that mention Parakh were excluded with reasons.
3. **Reconciliation (`T-115`).** Hassan named the Desktop folder the canonical root and asked for a reconciliation that preserves everything.
   - **Compare.** The clone's files were compared with the Desktop folder: 2 shared paths, both identical; the clone's 21 `SRS/` copies were identical to the flat Desktop copies; 0 files differed.
   - **Copy.** `.git/`, tracked files and drafts were copied with `rsync --ignore-existing`, which never overwrites.
   - **Verify.** `git fsck` was clean; HEAD was `4196969` in both; branches and origin were the same; tracked files were unchanged.
   - **Result.** The Documents clone is now an inactive backup.
4. **Resumed initialization, without repeating completed work.**
   - The source register was updated for the flat layout, with 4 newly found historical sources (S-22–S-25).
   - Written this session: the decision register (DG-01…DG-50), plan, backlog (115 tasks, 12 milestones), tracker generator/import/tests and workbook, plus the environment, Git workflow, architecture, vision, contributions and state documents.
   - Following Hassan's privacy instruction, the import manifest and `README_SETUP.md` stay local (git-ignored), with sanitized tracked versions.

### Decisions recorded (none approved on Hassan's behalf)

| Item | Detail |
|---|---|
| User-directed | Sole developer and designer; mentor scaffolding and developer lanes superseded (`DG-01`). Desktop folder canonical (`DG-49`) |
| Routine technical, reversible | Phase-term mapping (`DG-07`); AT-ID prefixing (`DG-08`); foreground-first sync (`DG-31`); labelled development adapters (`DG-48`) |
| Awaiting Hassan | 40 of 50 items are not resolved: 34 Open, 1 Proposed, 3 Interim, 1 Partly resolved, 1 Deferred. The soonest needed are `DG-04` and `DG-09`…`DG-16` |

### Validation (actual results)

| Check | Command | Result |
|---|---|---|
| Requirement index matches the SRS | `python3 scripts/extract_requirements.py --check` | `OK: requirements.csv matches Parakh_Mobile_App_SRS_v2.1.0.md — FR 124, NFR 86, SC 12` |
| Canonical data | `.venv/bin/python scripts/generate_tracker.py --check` | `115 tasks, 12 milestones, 222 requirements (222 with planned tasks), 50 decisions, 8 checks` — 0 errors |
| Saved workbook reopened | `--validate` | `Workbook OK — 6 required sheets, 115 task rows match canonical data, statuses valid, dates are date cells, IDs stored as text, dependencies resolve, formula ranges as expected` |
| Tracker tests | `.venv/bin/python -m unittest discover -s tests/tracking -v` | `Ran 12 tests … OK` — includes the import conflict test, the refusal to drop un-imported edits, and deterministic regeneration |
| Reconciliation | `git fsck --no-dangling`; `git rev-parse HEAD` in both clones | Clean; both `4196969520cc1d1b2e58f63fe87fc04816639afe` |
| Sanitized manifest | grep for absolute paths and personal names | 0 matches |

**Formulas** in the workbook's Overview "live recount" are written, not evaluated. No spreadsheet engine ran here; `fullCalcOnLoad` is set. The static totals are computed from CSV rows and were checked independently.

### Findings worth remembering

- **Missing sources.** The rank-2/3/4 sources the SRS depends on (RBAC, Data Model, API Contract, Screen Inventory, Technical Stack, Test Catalogue) are missing (`DG-05`). The backend contract will be PROPOSED until they are found.
- **Count discrepancy.** SRS §8.2 counts 79 Phase 1 FRs, but the requirement tags give 77 (`DG-45`).
- **Stale text in the SRS.** SRS v2.1.0 still contains sentences that describe the superseded web staff portals (`DG-32`).
- **Version mismatch.** The supplied `DATABASE_ARCHITECTURE.md` is v2.4, not the v2.7 the SRS names (`DG-06`).
- **Host constraints.** The Mac is an Intel x86_64 machine with about 33 GiB free disk. Xcode and Android images need space.
- **Schedule.** The vertical slice is 170–285 working hours. 1 Nov 2026 cannot hold the full Phase 1 for one developer (PROJECT_PLAN §6).

### Not done / limitations

- No application code, backend, database or mobile build exists.
- No SMS or AI provider is selected.
- Hassan has not yet reviewed this setup (`T-011`).

### Next

`T-010`: push `setup/project-initialization` and verify it. Then Hassan merges (`T-011`) and answers the week-1 decisions in [NEXT_TASK.md](NEXT_TASK.md).

---

## 2026-10-03 (Sat, evening) — Setup integrated into `main`; workflow update

**Owner:** Hassan Jalal (instruction and authorization).

### What Hassan decided

- **Integration into `main`.** Completed, verified checkpoints should reach `main` regularly. This supersedes the earlier arrangement that left all work on the setup branch for Hassan to merge (`DG-37`).

### What was done

| Step | Result |
|---|---|
| Fresh fetch | `main` = `4196969`; `setup/project-initialization` = `cb79f82`, one commit ahead; default branch `main` (`git ls-remote --symref origin HEAD`); working tree clean |
| Author identity | Repository-local `user.name` "Hassan Jalal" and `user.email` `hassanjalalahmad2@gmail.com`, unchanged. The same email appears on Hassan's commits made in the GitHub web UI (committer "GitHub"), so it is associated with his GitHub account. Global Git config was not changed |
| Integration | One squash commit on `main`, containing the verified setup (`cb79f82`) plus this workflow update, authored by Hassan's identity. Pushed normally; no history rewritten |
| Test defect fixed | `test_unimplemented_application_tasks_are_not_done` treated every non-M0 task as application work and failed on `T-117`, a Setup-phase documentation task that is legitimately in progress. The test now checks the application phases (P1, P2, P3, Ops), which is what the rule says. 12/12 pass |
| Interrupted work | The review of documents from another local Parakh workspace was interrupted after inspection only. Its findings are recorded as task `T-117` and in `DG-05`; nothing from that workspace was imported |

### Checks run

- `generate_tracker.py --check` and `--validate`
- the tracker unit tests
- `extract_requirements.py --check`
- the markdown link check
- the private-path scan

Results are in `CURRENT_STATE.md`.

### Next

See [NEXT_TASK.md](NEXT_TASK.md):

1. Confirm the remote `main` commit (`VAL-010`).
2. Continue `T-117`.
3. Make the week-1 decisions.

---

## 2026-10-03 (Sat, night) — Reconciliation of the other workspace's documents (`T-117`)

**Owner:** Hassan Jalal (instruction).

### What was found

The documents the SRS cites as missing (`DG-05`) exist in another local Parakh workspace, whose `docs/` was untracked until that workspace's commit `3329594`.

- **The six specifications were edited in place there on 2026-10-03:** RBAC, Data Model, Screen Inventory and Technical Stack (now v1.4), API Contract (v3.1) and Test Catalogue (v1.1). The CR-61 manifest's hashes prove the v1.3 originals were different. **The originals are lost.**
- **Found unedited:** CR-60, CR-59, Prototype SRS v1.4.2, the CR-61 manifest, the SRS change records, the 14 Sep Implementation Readiness Pack, and the 16 Aug roadmap one-pager.

### What was decided and recorded

| Record | Detail |
|---|---|
| Import | 16 files imported unchanged into `SRS/` (S-27…S-42). The other repository was not merged, and its remote instruction was not run |
| Classification | Every 2026-10-03 change is classified as accepted, deferred or rejected in `docs/planning/RECONCILIATION_2026-10-03.md` |
| Rejected — wrong IDs | The purpose → endpoint pairs (`API-004` is logout, not verify); `STF-02` vs `STF-03`; `CON-03`/`REP-04` vs `CON-04`/`REP-03`; `TEST-OTP-012`'s use of `API-120` |
| Rejected — incomplete edits | The Screen Inventory §5 Django statement; the Technical Stack "amendment" that its body does not contain; the Intel/16 KB claim (an x86_64 16 KB emulator image exists) |
| Decisions — Hassan's own instructions | `DG-01` (no approval gate for development), `DG-09` (optional photo; verification and completion evidence still required), `DG-11` (purpose binding). `DG-12` is interim. `DG-36` verified |
| Unapproved decisions | Every "delegated" or "architect" decision in the incoming documents is treated as a proposal until Hassan decides (`DG-51`) |
| Counts | 124 FR · **86** NFR defined (88 counted the reserved `NFR-15`/`NFR-24`) · 12 SC · **58** approved screens (+ PROPOSED `STF-11`) · 135 planned catalogue tests · **0** application tests implemented or executed |
| Dates | **10 Oct** is a historical target that will not be met (described as "prototype in development" by its own rule). **1 Nov (G3)** is the current target and is at risk |
| Guardrail | `generate_tracker.py` now refuses a Done application task (M2–M11) that cites no Passed validation. The snapshot-only tracker test was replaced by a test of this rule |

### Next

Implementation: backend citizen OTP authentication against the accepted rules (see `NEXT_TASK.md`).

---

## 2026-10-03 (Sat, late night) — Backend citizen OTP authentication (`T-027`, `T-037`…`T-041`)

**Owner:** Hassan Jalal (instruction: implement scaffolding and citizen authentication).

### What was built

The backend lives in `backend/`. It runs Django 6.1.1 and DRF 3.18.1 on Python 3.14.3, with SQLite for development because PostgreSQL is not installed.

| Area | Result |
|---|---|
| Settings | Driven by `PARAKH_ENV`. Keys come from the environment. Development generates them once into git-ignored `backend/.local/`; test generates them per run. Production refuses to start without keys, with SQLite, or with a development SMS adapter |
| API-121 / API-122 | Uniform request response. Six-digit, five-minute, single-use, keyed-hash codes. Five failures consume the challenge, and the account is never locked. Resend supersedes the previous challenge. Cooldown plus caps per number, device and IP (proposed defaults, `DG-13`). Purpose binding. Consent held on the server challenge. The first verify creates the account, the vault credential, three `ConsentRecord` rows and a session in one transaction |
| Sessions | Opaque tokens, stored hashed. Refresh rotation; replaying a rotated refresh token revokes the family. Logout. List sessions, end one or end all |
| Profile | `GET /citizen/profile` returns the own masked number only |
| Audit | Hash-chained and append-only in code, with `verify_chain()`. Secret fields are refused |
| SMS | `DevelopmentConsoleSmsSender` prints a line labelled `[SIMULATED SMS — development only, nothing was sent]` with the masked number. It loads only in development; tests use an in-memory outbox |

### Checks actually run

- `backend/.venv/bin/python backend/manage.py test parakh` — the first run had **3 failures**:
  1. A refresh-token replay revoked the family inside the transaction, and the error response rolled the revocation back. Fixed: the outcome is now decided in the transaction and raised after commit. Rotated tokens moved into an indexed table.
  2. Two production start-up tests reached the refusal only after model import, which needs `psycopg`. Fixed: `settings.py` refuses before any import.
  
  Re-run: **63 tests, OK** (`VAL-012`).
- Development server smoke test with a synthetic number (`VAL-013`): the uniform 202, the SIMULATED console line, tokens on verify, the masked profile, rejection of a reused code, and **0** server-log lines containing the full number.
- Tracker `--check` / regenerate / `--validate`, tracker tests (12 OK), `extract_requirements.py --check`.

### Decisions and deviations recorded

- `cryptography` is pinned to **48.0.1**, not 50.0.2: there is no macOS x86_64 wheel for CPython 3.14 after 48.0.1 (`ENVIRONMENT_CHECK.md` §4).
- **`DG-52` (Proposed):** ten implementation choices the specifications leave open — error codes, body shapes, token lifetimes and others — listed in `docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md` §3.
- Status changes: `T-037`…`T-041` are **In Review**. `T-027`, `T-029` and `T-030` are **In Progress**: PostgreSQL roles, the pytest/ruff decision and the header-redaction filter remain. Nothing is marked Done.

### Next

Mobile scaffold (`T-031`), API client (`T-033`), `CIT-01`…`CIT-05` (`T-042`, `T-043`) — see `NEXT_TASK.md`.

---

## 2026-10-04 (Sun, early morning) — Mobile skeleton and citizen sign-in screens (`T-031`, `T-033`, `T-042`, `T-043`)

**Owner:** Hassan Jalal (instruction: scaffolding and citizen authentication, including the mobile screens).

### What was built

| Area | Result |
|---|---|
| Scaffold | `mobile/` from `create-expo-app@5.0.0`, template `blank-typescript@sdk-57`,. Expo 57.0.26, React Native 0.86.3, React 19.2.3, TypeScript 6.0. The template's LICENSE and placeholder assets were removed |
| Config | `app.config.ts`: iOS deployment target 16.4; Android package under Hassan's GitHub domain; five gallery permissions blocked; `expo-sqlite` `useSQLCipher: true`. A release variant refuses a non-HTTPS API URL |
| Route tree (SRS §3.3) | An `(auth)` gateway that resolves the principal first, with CIT-01…CIT-05. A `(citizen)` group that admits a citizen principal only, with a CIT-06 placeholder |
| API client | One client, and the only `fetch` (ESLint-enforced). Every route declares its transport class. The citizen and public profiles refuse `X-Acting-Role-Assignment-ID`. A request that matches no profile is not sent. The error catalogue maps every code to a client action. Tokens are read from `expo-secure-store` at request time |
| Screens | Three separate consents, with the required two gating Continue. The consent snapshot travels with API-121. Plain offline messages, no queueing. One uniform wrong/expired message, with attempts remaining announced. Resend after cooldown. On success: tokens to secure storage, principal set, device consent payload discarded |
| i18n | `ur.json` / `en.json` with tests for key parity, placeholder parity and no-anonymity wording. **The Urdu is a machine draft, marked `UNREVIEWED DRAFT` in the file (`T-045`)** |

### Problems met and fixed

- npm auto-installed newer peer dependencies that conflict with SDK 57: `react-dom` 19.3.0 needs React 19.3, and `react-native-reanimated` 4.7.1 needs worklets 0.13. Pinned the SDK versions with `npx expo install` (19.2.3, 4.5.1, 0.10.1). `expo install --check` and `npm ls` are now clean.
- `expo-build-properties` was installed, then removed: SDK 57's own `ios.deploymentTarget` and RN 0.86's default `minSdk` 24 cover the targets.
- TypeScript 6 no longer auto-includes `@types`, so the config now declares `"types": ["jest"]` explicitly.
- The live contract test first failed twice, in the test harness, not the app:
  1. Under Jest, Expo's global `fetch` is backed by a mocked native module and never reaches the network. A Node `http` shim is used for that one test.
  2. The shim's first version sent a chunked body, which Django's dev server does not accept; `Content-Length` fixed it.

### Checks actually run

- `npm run check`: tsc, ESLint (0 problems), Prettier, **Jest 52 passed** (`VAL-015`).
- Mutation check of two safety rules. Disabling the acting-role refusal made 2 tests fail; letting the optional SMS consent satisfy the gate made 2 tests fail. Both mutations were reverted.
- `expo config` with plugins, release-variant HTTPS refusal, `expo-doctor` 21/21, Android Hermes bundle export (`VAL-014`).
- **Live contract check** of the mobile client against the running dev backend, with a synthetic number and the SIMULATED code (`VAL-016`). The flow was request, wrong code, verify, masked profile, logout. The full number never reached the server log.

### Not done / not claimed

- No device or emulator run and no visual check (`T-022`).
- No bundled Urdu font or app-wide RTL (`T-032`).
- No encrypted local storage (`T-047`).
- No token refresh on expiry (`T-044`).

### Status changes

- `T-033`, `T-042`, `T-043` → **In Review**.
- `T-031`, `T-032`, `T-036`, `T-044` → **In Progress**.
- `DG-36` verified in practice.
- Nothing marked Done.

---

## 2026-10-04 (Sun) — New GitHub repository; history restarted (`T-119`, `T-120`)

**Owner:** Hassan Jalal (instruction and authorization).

- **Setup branch.** The obsolete `setup/project-initialization` branch was deleted locally and on GitHub. Before that, it was verified that its only commit is contained in `main` (`T-119`, `VAL-019`).
- **Repository re-created.** Hassan then deleted the GitHub repository and asked for a new one. A new **private** repository with the same name was created.
- **Fresh history.** The project was uploaded as **one initial commit**. Commit hashes quoted in the entries above refer to the earlier history, which is kept locally and is not published.
- **Documentation brought up to date before the upload.**
  - `README.md` limitations and set-up pointers now match what exists.
  - `CHANGELOG.md` gained entries for the backend and mobile work.
  - Notes and source references in the decision register were reworded; no decision or status changed.
  - Three development-resource lines in the Mobile SRS were edited at Hassan's instruction. The source register records the new SHA-256.

---

## 2026-10-04 (Sun) — Session refresh on the device and log redaction (`T-044`, `T-030`, `T-120`)

**Owner:** Hassan Jalal (instruction: implement the SRS in phase order, starting with unfinished foundations).

### What was built

| Area | Result |
|---|---|
| Session refresh (`T-044`) | On `401` from a citizen route, the client calls `API-003` once, stores the rotated pair in `expo-secure-store` and retries the request once. Concurrent 401s share one refresh call, because the server treats a second use of a rotated refresh token as replay. A 401 for a token that another call has already replaced is retried without a refresh |
| Session expiry | `E_REFRESH_INVALID`, a missing refresh token or a second 401 clears the two tokens and signs the principal out. CIT-01 then shows "Your session has ended. Please sign in again." Nothing else on the device is wiped. No network during refresh keeps the session and reports offline |
| Log redaction (`T-030`) | One filter on every log handler (`parakh`, `django.request`, `django.server`). It removes `Authorization`, `Cookie`, the three idempotency-key headers, bearer and refresh tokens, numeric one-time codes and Pakistani mobile numbers from messages and exception text. Masked numbers and error codes stay readable |

### Choice recorded

An expired session returns to **CIT-01**, not CIT-04 as the earlier task text said. The onboarding order is fixed and consent comes before number entry (Screen Inventory §2.1, `TEST-SCR-003`). A returning citizen therefore passes the consent screen again. The server ignores consent sent by an existing account (`DG-52` choice 5).

### Checks actually run

- `npm run check`: tsc, ESLint 0 problems, Prettier, **Jest 60 passed**, 2 opt-in skipped (`VAL-021`).
- Mutation check of the refresh rules:
  - Removing the single-flight refresh failed 1 test.
  - Not ending the session on a refresh 401 failed 2 tests.
  - Removing the "already replaced" check failed no test at first. The test did not reach that path, so it was rewritten; it then failed 1 test.
  - All mutations were reverted.
- **Live contract check** against the dev backend (`VAL-022`). An unusable access token was renewed and the request retried. Replaying the consumed refresh token returned `E_REFRESH_INVALID`, cleared the device and revoked the whole family: the pair issued by the rotation then got 401. The server log had no full number and no token.
- Backend: **69 tests OK**, 6 of them for redaction (`VAL-023`).
- Repository record (`T-120`, `VAL-020`):
  - `git ls-remote` shows only `main` = `41045466`, with `HEAD` → `main`.
  - A scan of the 198 uploaded files found no key, token, credential or home path.
  - The only e-mail addresses are npm package-author metadata. The only phone numbers are synthetic fixtures and documentation examples.

### Not done / not claimed

- The "drafts intact after expiry" part of `T-044` cannot be tested until drafts exist (`T-052`).
- No device run (`T-022`). `T-030` waits on `T-027` (PostgreSQL).

### Status changes

- `T-120` → **Done**.
- `T-044` → **In Review**.
- `T-030` → **In Review**.
