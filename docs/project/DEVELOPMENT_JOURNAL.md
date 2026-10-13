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

---

## 2026-10-04 (Sun) — CI workflow (`T-034`)

**Owner:** Hassan Jalal (authorization: routine setup and normal pushes).

- `.github/workflows/ci.yml` runs on every push to `main` and on pull requests, with three jobs:
  - **backend:** `manage.py check`, a migration check and the tests;
  - **mobile:** `npm ci`, then `npm run check`;
  - **tracker:** the requirement-index check, the tracker `--check` / `--validate` and the tracker unit tests.
- Permissions are `contents: read`. It uses no secret and deploys nothing. Action versions are the latest official releases (checkout, setup-python and setup-node, all v7).
- Run locally first: `manage.py check` found no issues and the migration check found no changes. `npm ci --dry-run` resolved, and the YAML parsed.
- The first GitHub run is recorded as **Pending** until its result is observed.
- **First CI run** on GitHub (#1, commit `4149022`) passed all three jobs: backend 18 s, mobile 47 s, tracker 17 s (`VAL-024`). It was read on the run page in Hassan's signed-in Chrome, read-only.

---

## 2026-10-04 (Sun) — The citizen report pipeline on the backend (`T-036`, `T-053`…`T-061`, `T-063`)

**Owner:** Hassan Jalal (instruction: implement the SRS in phase order, starting with unfinished foundations and citizen workflows).

### What was built

| Area | Result |
|---|---|
| Drafts (`API-130`, `API-133`) | Idempotent on `client_submission_id`. The owner always comes from the session. An edit before submission updates the same draft. Capture time and received time are stored separately |
| Evidence (`API-131`, `API-132`) | The server recomputes each chunk hash before storing anything, then each item hash, then the whole-manifest hash (`E_CAPTURE_INTEGRITY`). Magic-byte checks confirm photos are JPEG or PNG and recordings are audio. The upload resumes from `missing_chunks`. Assembled items go to a write-once local store that refuses to overwrite. Retaken or deleted items are discarded before submission |
| Rendering (`API-134`, correction route) | Versioned artefacts, with exactly one active version per draft (a database constraint). A correction is a new version linked to the old one; nothing is overwritten. `source_asr_text` never reaches a citizen route. Low-confidence fields are marked |
| AI adapter | **SIMULATED** (`DG-48`). It does not listen to the recording. Its text says it is simulated, and every artefact is marked `simulated`. It loads only in development and test; production refuses to start with it. Failure keeps the draft and recording, creates no text and no report, and "Retry" replays the manifest |
| Confirmation (`API-135`) | The six checks of API Contract §6.2. The reporter fields must match the session. A replay returns the original confirmation. A reused key with a different body gets `409` |
| Report creation (`API-140`) | One transaction: confirmation of the **current** version, the report in `SUBMITTED` only (model and `bulk_create` guards), a random `PRK-XXXX-XXXX` reference, ownership, the first timeline entry, evidence linked, and the audit event. A replay returns the original report. Photo optional (`DG-09`). `evidence_completeness` is derived on the server |
| Own reports (`API-150`, `API-151`) | Reports and unsent drafts are listed separately; drafts carry no reference. Report detail has a sanitised timeline. The owner can play back the original recording byte for byte. Not-owned and not-found get the same `404` |
| Contract (`T-036`) | `docs/api/CITIZEN_REPORTING_CONTRACT.md`: bodies, hash formats, header handling and the two extra error codes, all marked PROPOSED |

### Decisions recorded, not taken

| ID | Status | What the code does meanwhile |
|---|---|---|
| `DG-53` | Interim | A typed description needs no AI rendering and no confirmation, because it is the reporter's own words |
| `DG-54` | Interim | Video is not accepted in Phase 1 |
| `DG-55` | Open | Cancelling a draft that has reached the server has no route yet |

`DG-10`, `DG-14` and `DG-43` notes now say what the code does. No status changed.

### Checks actually run

- **Backend: 113 tests OK** (`VAL-025`).
- **Mutation check.** Eleven integrity rules were each broken on purpose, and at least one test failed each time:
  1. a superseded version accepted;
  2. a hash mismatch accepted;
  3. a report created without a confirmation;
  4. the chunk hash trusted;
  5. the capture hash trusted;
  6. `source_asr_text` leaked;
  7. draft ownership skipped;
  8. a creation state other than `SUBMITTED` allowed;
  9. report ownership skipped;
  10. the manifest hash left unchecked;
  11. magic bytes left unchecked.

  All were reverted.
- A production start-up check still refuses to start without PostgreSQL.

### Problems met and fixed

- The first version of the cross-citizen confirmation test stopped at the reporter-field check and never reached the ownership check. It was rewritten so the other citizen sends their own valid identity, and it now gets the uniform `404`.
- Making the backend settings treat an empty value as unset briefly turned three settings into tuples, through a trailing comma (80 errors). Fixed, then re-run.

### Not done / not claimed

- No real AI provider; the adapter is SIMULATED.
- No PostgreSQL, queue worker or object store (`T-023`): processing runs inline, and evidence sits on the local file system.
- No parallel-load test of the replay rule. SQLite serialises writes; a unique constraint backs the rule.
- API-152…API-154, notifications and API-156 are not built.
- The mobile side of reporting is not built yet.

### Status changes

- `T-034`, `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061` → **In Review**.
- `T-048`, `T-063` → **In Progress** (backend part done, screens pending).

---

## 2026-10-04 (Sun) — Review of the pipeline checkpoint: tracker fix, start-up checks, `T-054` verification

**Owner:** Hassan Jalal (review instructions: fix the snapshot overflow, inspect the settings file, prove the production refusals, reconcile the upload cap, verify `T-054` before any Done).

### The failed command, explained and fixed

`generate_tracker.py --validate` failed with `JSONDecodeError … (char 32762)`, and 6 tracker tests errored.

- **Cause.** The workbook keeps a JSON baseline of the editable task fields in a hidden `_meta` cell, used to detect edits made in Excel. The longer task notes of this checkpoint made that JSON longer than 32,767 characters, which is the most one cell holds. openpyxl cut the string off on save, so it could not be read back.
- **Fix.**
  - The baseline is split across several cells, each under the limit. Each part carries a prefix, so no part can start with `=` and be read as a formula. No note is shortened.
  - Workbooks in the older single-cell format are still read.
  - A baseline that cannot be read now stops regeneration with a clear message, instead of a raw error and instead of discarding edits.
  - Any canonical field longer than one cell is a data error.
- **Recovery.** The cut-off workbook had been generated minutes earlier in this session and held no edits. It was restored from Git and regenerated.
- **Tests.** Four regression tests were added: an oversized baseline round-trips, the old format is read, an unreadable baseline refuses, and an over-long field is rejected. Making a part larger than the cell limit made the round-trip test fail.
- **Result:** 16 tracker tests OK, import dry-run clean, workbook validates (`VAL-028`).

### Settings file

- The saved `backend/config/settings.py` compiles. The excerpt that looked broken was a mix of old and new diff lines.
- The one real defect was found and fixed earlier in this checkpoint: a trailing comma made three settings tuples.
- **Added:** invalid values for the simulated outcome, the confidence threshold and the retry window now stop start-up.
- `manage.py check` reports no issues in development and test (`VAL-027`).

### Production start-up, by real process start-up

Each case ran in a fresh process with no inherited `PARAKH_` or `DJANGO_` variables:

| Adapter | Cases refused |
|---|---|
| SMS | unset, console adapter, test outbox |
| Evidence store | unset, local store |
| AI | unset, simulated |

With all three named, start-up passes every adapter check and then stops at the missing PostgreSQL driver. That is expected until `T-023`. Four automated start-up tests cover the same cases (`VAL-027`).

### Upload cap and retry window

- The 12-item cap is a **provisional technical safeguard** and is configurable (`PARAKH_EVIDENCE_MAX_ITEMS`). It is not the product photo-count bound.
- That bound (`PARAKH_PHOTO_COUNT_MAX`) stays **unset** until Hassan decides `DG-47`. Once set, it is enforced at API-132, and start-up refuses a cap with no room for it.
- No minimum exists, because photos are optional (`DG-09`).
- The seven-day retry window stays labelled **PROVISIONAL** (`DG-14`).

### `T-054` — verified, not Done

| Acceptance criterion | Evidence |
|---|---|
| Chunk or manifest hash mismatch returns `E_CAPTURE_INTEGRITY` | Chunk, item and manifest tests. Mutations that trusted the chunk hash or the capture hash, or skipped the manifest hash, each failed a test |
| Magic-byte and size checks reject wrong types | Magic-byte test, with its mutation caught. Size tests were missing and were added: item size, chunk size, impossible chunk count, assembled size, item count |
| Stored objects cannot be overwritten | The write-once store test, on the local development store |

**Why `T-054` stays In Review:**

- Its dependency `T-053` is not Done. `T-053` waits on `T-040` and `T-036`, and through `T-028` and `T-027` on PostgreSQL (`T-023`).
- No production write-once object store exists.
- No real client (`T-055`) or device has used the route.
- Residual risks are recorded:
  - the MP4 check is container-level only;
  - malware scanning is not implemented (`NFR-55`, `TBD-035`).

**Backend: 122 tests OK** (`VAL-026`).

### Status changes

- `T-045` → **Blocked** (no Urdu reviewer named, `DG-41`).
- `T-046` → **Blocked** (no Android toolchain or device; `T-022` awaits Hassan's approval).
- Nothing marked Done.

All results in this entry are automated. Nothing has run on a phone or an emulator.

---

## 2026-10-04 (Sun, evening) — Owner decisions recorded; Mobile SRS v2.2.0; Android toolchain (`T-121`, `T-022`)

**Owner:** Hassan Jalal (decisions and instructions of 2026-10-04).

### Decisions recorded

| Decision | Recorded as |
|---|---|
| 1–3 live photos per report | `DG-47` |
| One optional live video of up to 60 s; it does not replace photos | `DG-54` |
| Unfinished drafts stay on the device; uploads before final submission are temporary; cancellation removes them, including derived content; a race with a successful submission returns the reference | `DG-55` |
| 48-hour automatic submission retry; then stop, keep the draft, say "not confirmed", check the server | `DG-14` |
| Typed reports also get an Urdu rendering and the reporter's confirmation | `DG-53` |
| Street Representative verifies, then the UC Officer reviews and accepts; no stage skipped | `DG-56` (new) |

**Notes on the photo and review decisions:**

- Hassan first set 3–5 photos, then corrected it later in the session to "minimum 1-3". The record is minimum one, maximum three.
- This supersedes `DG-09` (3 Oct, photo optional): photos are mandatory again, and `E_EVIDENCE_REQUIRED` applies to citizen intake.
- `DG-41` stays open. The verification decision names no Urdu-text reviewer.

**`DG-57` added, PROPOSED, not decided:** delete abandoned temporary uploads 72 hours after their last activity. That is the 48-hour window plus a margin.

### Reconciliation before implementation

`docs/planning/TEMPORARY_DATA_LIFECYCLE.md` sets the cancellation rule against the write-once, immutability and retention rules. No source rule is broken. The one change is **when** write-once protection starts: at final submission (sealing), not at upload. Before that, uploads are temporary processing data that the citizen may delete. The sources already allowed deleting an unsubmitted item.

### Mobile SRS v2.2.0

- Issued as a **new file**, with `SRS/Parakh_Mobile_SRS_v2.2.0_Change_Record.md`.
- v2.1.0 is kept unmodified, as the SRS's own version rule requires.
- **MINOR** release: 59 edits, each asserted to match exactly once. No requirement was removed, and IDs and counts are unchanged.
- Re-extracting the requirement index changed exactly ten requirements: FR-PUB.4, .6, .7, .8, .12, .20, .27, .28, .29 and FR-COMMON.12. FR-PUB.8 moved from phase `P?` to P1.
- The first extraction put an annotation into FR-PUB.8's legacy-ID column; that was cleaned up.
- **Updated to point at v2.2.0:** the source register (S-01 is v2.2.0, S-01a is v2.1.0, S-43 is the change record), the source index, the README, the plan, the architecture overview and the tracker labels.

### Android toolchain (`T-022`)

- Hassan approved the installation. An SDK from an earlier install already existed: on 12 Aug 2026, with licence records dated that day.
- **Added, in user space:**
  - Temurin JDK 17.0.20.1, SHA-256 verified;
  - `platforms;android-36`, `ndk;27.1.12297006`, `cmake;3.30.5` and `system-images;android-36;google_apis;x86_64` — the versions React Native 0.86 pins.
- `sdkmanager` ran with its input closed, so it could not accept a licence by itself. None was asked.
- The first run hit the one-hour background limit during the NDK download and was stopped. The image and CMake had finished. A second run installed the platform and the NDK.
- 13 GiB of disk is free afterwards.
- **Not done yet:** no emulator, no build, no device.

### Tracker

- Five tasks added (`T-121`…`T-125`); `T-121` → **Done**.
- Two tracker tests depended on live task data and broke when that data changed. They now set up their own values.
- **16 tracker tests OK.** `VAL-029`, `VAL-030`.

---

## 2026-10-04 (Sun, night) — Backend in line with the 4 October decisions; review findings fixed (`T-122`…`T-125`)

**Owner:** Hassan Jalal (decisions of 2026-10-04; he asked for the findings in `.local/REVIEW_LATEST.md` to be reproduced and fixed, keeping the 1–3 photo rule).

### What changed in the backend

| Decision | Code |
|---|---|
| `DG-47` — 1–3 photos | API-132 and API-140 refuse no photo (`422 E_EVIDENCE_REQUIRED`, with the bounds) and more than three (`400`). The bounds are settings; start-up refuses inconsistent values |
| `DG-54` — video | Kind `video` (`video/mp4`, `video/quicktime`), at most one, 40 MiB. The server parses the container header for the duration (≤ 60 s + 0.5 s) and needs a video track. A "recording" that contains video is refused |
| `DG-53` — typed text | A typed draft gets a SIMULATED rendering (`source_kind: typed`, no ASR step) that must be confirmed. New typed text reopens the manifest. A database constraint makes every report bind a confirmed rendering |
| `DG-55` — temporary data | Assembled items stay in a deletable processing area. API-140 seals them write-once in its transaction and removes the temporary copies afterwards |
| `DG-55` — cancellation | `DELETE /citizen/drafts/{id}` purges media, renderings, confirmations, typed text and location, and is idempotent. After a submission it answers `409 E_ALREADY_SUBMITTED` with the reference and deletes nothing. A processing job that finishes late stores nothing |
| `DG-57` (proposed) — expiry | `manage.py purge_temporary_drafts` purges unsubmitted data after 72 h without activity. An expired draft can be reopened by its own id |
| `DG-56` — verification order | `reports/lifecycle.py` holds the SRS §6.2.8 transition table. Skipping verification or acceptance, and steps by the wrong role, are refused; `state_version` is checked |

### Independent review (`.local/REVIEW_LATEST.md`, kept local)

The review ran against a snapshot taken while this work was unfinished. Its three findings were **reproduced against the latest code first: each returned HTTP 500**. Then:

1. **An impossible calendar date** (`2026-02-30`) in `captured_at` now gets `400 E_VALIDATION`.
2. **A list or object as an evidence `kind`**, in a chunk or in the manifest, now gets `400` (types are checked first).
3. **An empty or truncated MP4 movie header** now gets `400` (bounds checked; any read past a box is refused).

Also added, following the review:

- **The late-partial-upload regression.** An item uploaded after the last manifest is never attached. It is now also **discarded at submission**, so no temporary data outlives the report.
- **API-140 checks the manifest again:** it re-checks that the sealed items match the last manifest hash.
- **A wrong-type sweep** across every field of every reporting route. With the original kind bug restored, it fails.

The review's five failing report tests were the obsolete photo-optional and typed-without-rendering tests. They had already been rewritten to the current rules, keeping their ownership, privacy and idempotency assertions.

### Checks actually run

- **Backend: 154 tests OK** (`VAL-031`). That includes 51 pipeline tests, 7 input-hardening tests and 7 state-machine tests.
- **Twelve new mutations**, each caught by at least one failing test, then reverted.
- `manage.py check`: no issues. No missing migrations.

### Problems met and fixed

- `makemigrations` waited on an interactive rename question. It was stopped and run again with the answer "yes".
- **Three test-setup faults:**
  - a 70-hour clock jump also expired the access token; a sign-in-again helper fixes it;
  - all tests shared one storage folder; each test now has its own;
  - a scripted edit of the report tests stopped at a text mismatch and was redone.

### Not done / not claimed

- **Everything above is automated.** Nothing has run on a phone or an emulator, and the Android build has not been attempted yet.
- No parallel-load test. No real AI provider. No object store or worker.

### Status changes

- `T-122`, `T-123`, `T-124`, `T-125` → **In Review**.
- `T-054` stays **In Review** (prerequisites).

---

## 2026-10-05 (Mon) — First Android build and emulator run; encrypted local store; review findings R-005 and R-006 (`T-022`, `T-031`, `T-046`, `T-047`)

**Owner:** Hassan Jalal (instructions and decisions: the Android tools approval of 2026-10-04, "Try again" after the failed build, and his instruction to verify and fix the independent review's findings R-005 and R-006).

### Goal

Get the development build running on an emulator, build the encrypted local store that the capture screens need (`T-047`, `DR-23`), and fix the independent review's findings R-005 and R-006 before this checkpoint.

### What happened, in order

1. **The first build failed after 58 minutes.** The cause was a DNS outage: `dl.google.com` stopped resolving during dependency resolution. The wrapper script exited 0 although Gradle exited 1. Later runs pass Gradle's exit code through.
2. **Five more causes surfaced one at a time, each fixed at the source:**
   - the Android Gradle plugin's default NDK (27.0) was downloaded silently, 2.4 GB, because `expo-sqlite` names no NDK;
   - then Build Tools 35 and CMake 3.22.1, again AGP defaults;
   - then the app module, which React Native's root plugin evaluates before the hook.

   `mobile/plugins/withUniformNdk.js` now pins every module to the app's NDK, Build Tools and CMake (3.30.5, React Native's own pin) and turns off silent SDK downloads. The duplicate NDK, which this build had installed, was removed. `android.allowBackup` is off. The biometric permissions (`USE_BIOMETRIC`, `USE_FINGERPRINT`) are blocked, because device biometrics are not implemented (SRS).
3. **The build succeeded and ran on the emulator** (`Parakh_API36`, Android 16, x86_64, 4 KB pages). React Native started with the New Architecture and CIT-01 rendered.
4. **The encrypted store** (`mobile/src/storage/`):
   - the key in SecureStore, failing closed;
   - the SQLCipher opener, with `PRAGMA key` first and cipher, key, schema and header checks;
   - owner-bound drafts, with the account id now returned by API-155;
   - media encrypted with AES-256-GCM before it is written;
   - capture ingestion, the orphan sweep, store release at sign-out and expiry, and a development-only self-check;
   - an ESLint rule that refuses gallery and file pickers.
5. **The emulator self-check found a defect the unit tests had hidden.** Native `getRandomBytes` accepts at most 1,024 bytes per call. It was fixed, and the Jest stand-in now enforces that limit. After the fix the check passed:
   - SQLCipher 4.7.0 community is linked;
   - the database file has no header or schema text, its entropy is 7.995 bits/byte, and stock `sqlite3` cannot read it;
   - the key is Keystore-wrapped.

   With the key removed, the store failed closed (`key_missing`): the file was unchanged and no new key was made.
6. **Review R-005 and R-006** (`.local/REVIEW_LATEST.md`, kept local). Both were first reproduced on the sources the review had hashed: its two tests, which assert the defects, passed. Then they were fixed.
   - **R-005:** each migration now runs in one transaction with its version record. Migration 1 creates only what is missing, so every state the earlier code could stop in is completed in place, keeping the draft. An unrecognised schema is refused, never altered or dropped.
   - **R-006:** ingestion and the orphan sweep share one media lock. The sweep reads the rows only once it holds the lock.

   The final code then passed the self-check on the emulator, over the database the previous build had created.

### Checks actually run

- **Mobile:** `npm run check` passed — tsc, ESLint, Prettier and Jest 104 passed, 2 opt-in skipped (`VAL-033`). The storage suite has 44 tests on a **simulated** SQLCipher.
- **Mutations:** 20 in total, 19 caught. The survivor, M20, is equivalent while there is only one migration.
- **Backend:** 154 tests OK. The live contract check passed against the dev backend, including `account_id` (`VAL-035`).
- **Emulator:** build, install and launch (`VAL-032`); the native self-check and fail-closed check (`VAL-034`). Screenshots are in `docs/testing/evidence/2026-10-05-android-emulator/`.

### Problems met and fixed

- **Memory and disk.** Swap rose to about 10 GiB with the emulator and Gradle running together, and free disk fell to 3.1 GiB at one point. They are now run one at a time.
- **Prebuild regenerates `android/`.** Each configuration change therefore needs a full rebuild (about 8 minutes).
- **Three test gaps.** Three surviving mutants exposed gaps (a race, an un-awaited teardown, a corrupted write). The fake's close is now asynchronous, as the native one is, and the tests were added.

### Not done / not claimed

- **No physical phone, no 16 KB page-size check and no iOS build.** `DEP-08` stays open, and so does `T-031`'s device criterion.
- No reporting screen uses the store yet.
- A release build's permission list has not been checked: debug builds carry React Native's debug-only `SYSTEM_ALERT_WINDOW`.
- New gaps: `DG-58` (the plaintext capture cache, proposed), `DG-59` (iOS backup exclusion, open) and `DG-60` (what a device that fails closed offers, proposed).

### Status changes

- `T-022` → **In Review** (all criteria met; `T-021` test devices Not Started).
- `T-047` → In Progress (2026-10-04) → **In Review**.
- `T-031` stays In Progress (needs a physical device).
- `T-046` stays **Blocked**, with emulator evidence recorded.

---

## 2026-10-06 (Tue) — Owner decisions of 6 October recorded; Mobile SRS v2.3.0 (`T-126`)

**Owner:** Hassan Jalal (decisions of 6 October 2026: report text, photos and temporary files, drafts and encryption, submission and retries, incomplete server uploads).

### Goal

Record the decisions, update the requirements they conflict with through a traceable revision, and only then change the code.

### What happened, in order

1. **Mapped every conflict in Mobile SRS v2.2.0:**
   - voice as the only primary path (`FR-PUB.9`, `.12`);
   - Urdu-only text (`FR-PUB.13`);
   - the transcription withheld from the citizen (`FR-PUB.16`);
   - `DR-23` encryption, in eleven places, among them §3.6.3, `NFR-48`, `SC-10`, `DEP-08` and `R-19`;
   - "delete a local item only after confirmed receipt" (`FR-COMMON.12`);
   - downscaling photos before upload (`NFR-8`).
2. **Checked the capture modules before deciding how files are handled**, as asked:
   - `takePictureAsync` writes a JPEG to the cache, and its documentation calls the file temporary. The in-memory alternative (`pictureRef`) cannot survive a restart.
   - `recordAsync` records only to a cache file.
   - `expo-audio` records to a file and can write it straight into app-private storage.

   So a file is unavoidable. The smallest exception is the capture module's own file, moved (renamed) out of the cache where needed. Nothing is copied, re-encoded or encrypted. No file-free implementation is claimed.
3. **Recorded the decisions:**
   - `DG-61` to `DG-65` are recorded as decisions;
   - `DG-58` and `DG-60` are resolved by `DG-63`, and `DG-59` is re-scoped;
   - notes are added to `DG-14`, `DG-39`, `DG-53` and `DG-57`.
4. **Raised two questions rather than deciding them:**
   - `DG-66`: `DR-26`'s override is conditional on `SC-01`–`SC-12`, and the decision amends `SC-10`;
   - `DG-67`: how long an unconfirmed submission is kept after its 48 hours.
5. **Issued Mobile SRS v2.3.0** as a new file: 65 asserted edits, with v2.2.0 byte-identical. Superseded text is marked, not deleted.
   - 16 requirements changed in title or statement, with the same IDs; `FR-PUB.13` changed only in its acceptance scenario.
   - `TBD-M15` and `TBD-M16` opened, giving 37 `[TBD]` items, 31 of them open.
   - The change record states how each decision was applied.
6. **Updated the tracker:**
   - `T-046` re-scoped to verifying the new store on devices;
   - `T-047` back to In Progress;
   - acceptance criteria updated for `T-049`, `T-050`, `T-052`, `T-058`, `T-062`, `T-088` and `T-124`;
   - new tasks `T-126`, `T-127` and `T-128`.
7. **Updated the documents:**
   - the temporary-data lifecycle;
   - the source index and register;
   - the DEP-08 record, marked superseded;
   - the README, project plan and architecture references.

### Checks actually run

- `extract_requirements.py --check`: FR 124, NFR 86, SC 12, against v2.3.0.
- Tracker `--check`, `--validate`, import dry-run and the 16 tracker tests (`VAL-036`).

### Not done / not claimed

- **The code does not yet follow these decisions.** The backend still produces Urdu text only, and its settings still tie server clean-up to the retry window. The mobile store is still the encrypted one of 5 October. Rework starts with `T-127`.

### Status changes

- `T-126` → **Done**.
- `T-047` In Review → **In Progress**.
- `T-046` stays Blocked, re-scoped.
- `T-127`, `T-128` added (Not Started).

---

## 2026-10-06 (Tue) — Report text in Urdu and English on the backend (`T-127`)

**Owner:** Hassan Jalal (decisions `DG-61`, `DG-62` and the separate server clean-up timing, 6 October 2026).

### What happened

1. **The rendering model.** Every rendering version holds three texts, the **transcription**, the **Urdu text** and the **English text**, plus the source language and a per-text origin:
   - `reporter` — typed or corrected by the reporter;
   - `ai_transcription`;
   - `ai_translation`;
   - `ai_rendering`.

   One content hash covers all three: SHA-256 over canonical JSON. The API contract documents it with a worked example, checked against the code. Migration `0003_bilingual_report_text`.
2. **Typed text.** It is kept verbatim as the transcription. The version in the typed language is that text, marked `reporter`; the other language is AI.
3. **Corrections.**
   - Any of the three texts can be corrected, and a corrected text becomes the reporter's.
   - `derive_from` asks for a new AI version of the other language texts. It replaces only AI texts, never the transcription, and never a text the reporter wrote. That version must be confirmed.
   - A typed report's transcription is changed through the draft, not here.
4. **Confirmation.** API-135 needs `reviewed_texts` = the transcription, Urdu and English, and stores it.
5. **The report.** API-151 returns exactly the confirmed texts in both languages.
6. **Integrity.**
   - A version whose output lacks a text fails, with no gap filled in.
   - Processing never touches a completed, and so possibly confirmed, version.
   - Corrections after submission are refused.
7. **Server clean-up timing** is no longer tied to the 48-hour retry window: start-up now refuses only a value below one hour. `DG-57` stays proposed.

### Checks actually run

- **Backend: 174 tests OK**, 20 of them new: bilingual output, verbatim typed text, the hash, the confirmation of every text, corrections and re-derivation, AI never overwriting, incomplete output, the immutable confirmed text, isolation, the lost-response status check, cancellation after submission, and the clean-up timing.
- `manage.py check`: no issues. No missing migrations.
- **12 mutations, each caught.** Two of them first survived, which exposed weak tests:
  - the fixed test clock hid a re-run of processing; it is now caught by advancing the clock and counting audit events;
  - a failed re-derivation's leftover text; it is now caught by checking the stored row.

### Not done / not claimed

- **The AI is SIMULATED**: there is no real transcription or translation, and its script-based language guess cannot tell Roman Urdu from English.
- The device does not use any of this yet.

### Status changes

- `T-127` → **In Review**.

---

## 2026-10-06 (Tue) — Review finding R-007: legacy Urdu-only renderings (`T-127`)

**Owner:** Hassan Jalal (his instruction to fix R-007 from the independent review of 6 October).

### The finding

Migration `0003` added the transcription and the English text with empty defaults. A rendering made before it keeps an Urdu text and an Urdu-only hash, and its confirmations name no texts. **Two paths turned such a version into a report with empty transcription and English:**

- an existing confirmation;
- a new confirmation, which the server accepted.

### What happened

1. **Reproduced first**, on sources byte-identical to the reviewed snapshot: the review's two probes passed, HTTP 201 each time.
2. **One completeness rule.** A version counts only if it holds all three texts and its stored hash is the current three-text hash.
   - Confirmation (API-135), correction and API-140 refuse anything else with `409 E_RENDERING_INCOMPLETE`.
   - A confirmation must name all three texts.
   - Such a version is never READY_TO_SUBMIT.
3. **Migration `0004_regenerate_legacy_renderings`** adds a QUEUED version for each unsubmitted active draft whose current version is legacy. The old version and its confirmation stay unchanged as history, and an audit event records each re-queue. It calls no AI service and never touches a submitted draft.
   - `manage.py process_queued_renderings` processes the queued versions.
   - A device's manifest replay also starts a queued version that never started, and renders a legacy one again.
4. **API-151** shows a pre-6-October report as it was: `bilingual: false`, with no transcription or English text invented.
5. **Test bases** became mixins, so migration tests can run on a `TransactionTestCase` (SQLite cannot change its schema inside a transaction).

### Checks actually run

- **The review's probes now fail**, with `409 E_RENDERING_INCOMPLETE`.
- **Backend: 182 tests OK**, 8 of them new:
  - the real migration chain was replayed: `0003`/`0004` unapplied, the old code's hashes and empty confirmations stored, the migrations applied again;
  - confirmed and unconfirmed legacy drafts were re-queued, rendered, freshly confirmed and submitted;
  - a submitted legacy report, its sealed evidence and its replay came through unchanged;
  - running the migration twice is harmless;
  - the runtime guards hold.
- **Mutations:** 11 for R-007, each caught; one first survived and gained a test (three texts under an Urdu-only hash). The 12 bilingual mutations still pass.

### Not done / not claimed

- No database from an older build exists to migrate. The replay uses rows the current API made, given what the old code stored.
- The device side (the draft store, the transition and the submission engine) is still in progress and is **not** in this checkpoint.

## 2026-10-07 (Wed) — The device follows the decisions of 6 October (`T-047`, `T-128`, `T-052`)

**Owner:** Hassan Jalal (his decisions of 6 October 2026 on photos and temporary files, drafts and encryption, and submission and retries; `DG-63`, `DG-64`, `DG-65`).

### The capture file

The decision asked first whether the camera or recorder needs a file of its own. It does:

- `expo-camera` writes each photo to the app's cache; its in-memory picture cannot outlive the app;
- video is recorded to a cache file;
- `expo-audio` records to a file;
- a draft must survive restarts for up to 2 days.

So no file-free capture is claimed. The smallest exception is **the capture module's own file**. It is hashed, recorded, and then **moved** (renamed) into app-private documents storage. It is never copied, re-encoded or encrypted. On Android, `expo-file-system` moves with `renameTo`. It copies and then deletes only if that rename fails, which leaves one file all the same.

### What happened

1. **Draft store** (`mobile/src/storage/`):
   - a plain `parakh-drafts.db` with no key; nothing is put in secure storage;
   - `expires_at = created_at + 48 h` is set at creation and is not an editable field;
   - a draft is invisible from the instant its lifetime ends;
   - every account's expired unsubmitted drafts are deleted, rows then files, when the store opens and on every return to the foreground, each leaving a content-free note asking the server to cancel its temporary uploads;
   - Submit is recorded once, only for a reviewed draft, and never for an expired one.
2. **Capture ingestion:** hash, then the row with the file's location, then the move, then the mark. A crash in between is finished on the next start; a capture whose file is gone is counted, never lost silently.
3. **`T-128`, the one-time move:**
   - the 5 October SQLCipher store is opened with its key;
   - each item is decrypted into the drafts folder and checked against its capture hash;
   - every row and a marker are written in one transaction, keeping `created_at`;
   - only then are the old database, media and key removed;
   - a store whose key cannot be read is left exactly as it is;
   - a key alone never counts as Submit, so nothing is sent that the citizen did not submit.
4. **`T-052`, the submission queue:**
   - nothing is sent without Submit; the press and its one key are recorded first, and each attempt is marked "outcome unknown" before it leaves;
   - after a lost response, API-133 is asked before the next attempt;
   - backoff, and a 48-hour window from the first attempt; then *not confirmed*, with the server checked before another attempt;
   - cancellation stops retries at once, and deletes the local copy only on the server's answer;
   - one attempt per draft; one account per queue; the queue stops when the session ends.
5. **API routes** for API-133, API-140 and the cancellation path. Path values must be UUIDs, or nothing is sent. `E_RENDERING_INCOMPLETE` (R-007) and the other reporting codes are in the error catalogue.
6. **The development self-check and its screen** were rewritten for the new store.

### Checks actually run

- **`cd mobile && npm run check`:** tsc OK, ESLint 0 problems, Prettier OK, **Jest 171 passed**, 2 opt-in skipped. New suites:
  - storage, 48;
  - legacy migration, 14;
  - submission, 22;
  - reporting routes, 27.
- **Mutations: 51; 49 caught, 2 equivalent.** The two each remove one of two redundant guards against retrying a rejected submission; removing both is caught. Five first survived, and each gained a test:
  - Submit reviving an expired draft (masked by the state check);
  - the 48-hour value read from the constant under test;
  - a manual retry of an unsubmitted draft;
  - a cancel during the status check;
  - Submit after the session ended.
- **Emulator** (Android 16, the 5 October APK, this checkpoint's JavaScript from Metro):
  - the self-check passed twice;
  - the real 5 October store, which held only its schema, was moved, and its database and key were removed;
  - the new database begins `SQLite format 3\0`, and stock `sqlite3` reads it without a key.
  - See `docs/testing/DRAFT_STORE_VERIFICATION.md`.
- **Backend:** 182 tests OK, unchanged.
- **Tracker:** the workbook was regenerated and validated; import dry-run and `extract_requirements.py --check` OK; 16 tracker tests OK.
  - One tracker test first failed. Its fixture builds an old single-cell workbook from the real data and shortened only the notes. At the last commit that copy was 29 characters under Excel's cell limit, so this checkpoint's references pushed it over.
  - The fixture now shortens all three free-text fields.
  - Breaking the old-format reader still makes the test fail.

### Not done / not claimed

- **No physical device and no iOS.** `T-046` stays Blocked.
- **No old draft was moved on the emulator**, because none existed there. Moving real drafts is covered by Jest only, where SQLCipher is simulated.
- **Nothing in the app uses the store or the queue yet.** There is no reporting screen, and no upload client (`T-055`), so a draft cannot reach READY_TO_SUBMIT in the app.
- **The app deletes an expired draft only while it runs.** No background task is used.
- **The upper bound for a submission still unconfirmed after 48 hours is not implemented**, because it is undecided (`DG-67`). Such a draft is kept, labelled *not confirmed*.
- **iOS backup exclusion is not set** (`DG-59`).
- **HawkScan could not run:** no CLI and no API key.

### Status changes

- `T-047`: In Progress → **In Review**.
- `T-128`: Not Started → **In Review**.
- `T-052`: Not Started → **In Progress** (the submission part).
- `T-046`: stays **Blocked**; it gains the emulator evidence for its new scope.
- `VAL-039`–`VAL-042` added.

## 2026-10-07 (Wed) — The decisions of 7 October (`DG-57`, `DG-59`, `DG-67`; `DG-66` explained)

**Owner:** Hassan Jalal (his decisions given in chat on 2026-10-07, and his clarification of `DG-57` the same day).

### The decisions

- **Unchanged and confirmed:** a submitted report goes to the server into the verification workflow, and an unsubmitted draft is kept for at most 48 hours (`DG-64`).
- **`DG-67`:** a pending submission is retried for up to 48 hours from the original submission attempt. It is shown apart from saved drafts as not yet confirmed, and **deleted** if it still cannot be completed.
- **`DG-57`:** 72 hours without activity, approved, with safeguards for uploads and processing still under way. It is separate from the device's rules.
- **`DG-59`:** no Parakh data in device or cloud backups wherever the platform allows it.
- **`DR-26`:** explain before changing anything.
- **A physical Android phone is available.**

### Contradictions flagged

Each is between two decisions of the same authority. The later decision was applied, and the earlier text was struck through, not deleted (SRS v2.4.0 change record §2):

1. `DG-14` and `FR-PUB.28`: *keep the local draft* after 48 hours.
2. `FR-COMMON.12`, legacy `FR-OFF-003`–`005`: delete *only after confirmed receipt*.
3. `DG-65`: a status check *before* deleting. It is now made where the server can be reached, and the copy is deleted regardless.

The request mentioned "the current Flutter application". The current app is the React Native app in `mobile/`; the Flutter template is superseded (`DG-03`).

### What happened

1. **Requirements:** Mobile SRS v2.4.0 by 25 asserted edits, with its change record. v2.3.0 is unchanged. `TBD-M15` is resolved. `DR-26`, `SC-10` and `TBD-M16` were left untouched.
2. **The register:**
   - `DG-57`, `DG-59` and `DG-67` resolved, the proposals kept as history;
   - notes on `DG-14`, `DG-64`, `DG-65` and `DG-66`;
   - `DR-26_REVIEW.md` answers the five questions asked about `DR-26`, without a decision.
3. **Device, pending submissions:**
   - schema migration 2 adds `submission_expires_at = submission_requested_at + 48 h`, fixed at the first press of Submit; it is idempotent and backfills existing rows;
   - a pending submission is invisible once its deadline passes;
   - the queue wakes at the deadline, makes a last status check where it can, deletes the pending submission and its files, and leaves a note asking the server to drop its copy; the server keeps any report that exists;
   - the store's purge does the same when no queue runs;
   - `localStatus()` tells a saved draft from a pending submission.
4. **Device, backups:**
   - a config plugin writes data-extraction rules that exclude every storage domain from cloud backup and device-to-device transfer, and full-backup rules for Android 11 and lower;
   - `expo-secure-store`'s narrower rules are switched off;
   - session tokens are stored for this device only (iOS);
   - iOS file exclusion waits for Xcode.
5. **Backend (`DG-57`):** the start and end of a processing job count as activity. Both processing transactions lock the draft before the version, as the purge does. The settings comment states the two separate rules, as Hassan asked.
6. **Physical-phone procedure:** `docs/testing/PHYSICAL_ANDROID_TESTING.md`, with development-only synthetic retention-test items so the 48-hour rules can be tested by hand before the reporting screens exist.

### Checks actually run

- **`cd mobile && npm run check`:** tsc OK, ESLint 0 problems, Prettier OK, **Jest 188 passed**, 2 opt-in skipped.
- **Mutations of the new phone logic: 18; 17 caught, 1 equivalent.** P17 removes a deadline check that `drafts.get` already makes. Two first survived and gained tests: an idle queue waking at the deadline, and an attempt in flight across it.
- **The self-check itself had a defect**, which its own test found: it counted files after the new pending items had added theirs. On a device it would have reported FAIL; it now measures straight after the capture.
- **Backend: 186 tests OK**, 4 new. `manage.py check` clean, no missing migration. The two mutations of the activity touches were caught. One new test was first written wrongly: a job that *ends* late counts its end as activity, so it was rewritten as two tests, a killed worker and a late end.
- **Android build:** one debug APK for `arm64-v8a` and `x86_64` (BUILD SUCCESSFUL, 13 min 54 s).
  - The first attempt failed with *SDK location not found*: prebuild had removed `local.properties`, so the procedure now exports `ANDROID_HOME`.
  - The second attempt was reported as failed only because the wrapper script used zsh's read-only `status` variable; Gradle itself succeeded.
  - `aapt2` confirmed the backup rules and the permissions; the installed package has no `ALLOW_BACKUP` flag.
- **Emulator run 2:** self-check PASS. Moving the clock with `adb root`, then restoring it: the draft was deleted with its file at 48 h, and the pending submission at 48 h after its Submit.
- **SRS:** v2.4.0 generated; requirement index regenerated (only `FR-PUB.28`, `FR-COMMON.12` and `.13` changed); tracker regenerated and validated.

### Not done / not claimed

- **Nothing has run on the physical phone.** Only Hassan has it.
- **No reporting screen**, so capture, speech or typing, submission, offline retries and interrupted uploads can't be tested on a device yet. The procedure gives their steps for later.
- **iOS:** no build, so the drafts database and media are not yet excluded from iCloud backup.
- **Not declared:** Android 16 QPR2's transfer to iPhone, which needs an iOS team id.
- **No real cloud backup or device transfer was run.**
- **One development warning** (`Error: undefined`) on the first launch after install did not recur, and its source was not identified.
- **No scheduler runs `purge_temporary_drafts` yet** (`T-023`).
- **HawkScan could not run**: no CLI and no API key.

### Status changes

- `DG-57`, `DG-59`, `DG-67`: **Resolved**.
- `T-021`: Not Started → **In Progress** (the phone is available; the distribution channel is still open).
- `T-046`: Blocked → **In Progress** (the phone run is pending).
- `VAL-043`–`VAL-046` added.

## 2026-10-07 (Wed) — `DR-26` stays in force; `SC-10` amended for citizen-side drafts (`DG-66`)

**Owner:** Hassan Jalal (his governance decision, given in chat after reviewing `docs/planning/DR-26_REVIEW.md`).

### The decision

- **`DR-26` remains active and is not cancelled.** It is an architectural and operational decision — the five portals within the approved React Native application — not fundamentally a draft-encryption decision.
- **The `SC-10` amendment of 2026-10-06 is an explicit owner-approved amendment** of the controls associated with `DR-26`. It is not a failure of `DR-26`'s condition and not grounds for it to lapse.
- **It covers citizen-side drafts and pending submissions.** They need no Parakh-specific encryption key, draft lock or application-encrypted draft store beyond the operating system's protections, the app sandbox and the approved backup exclusion.
- It weakens no unrelated control.
- **It is not extended to future staff, Union Council, contractor, Mayor or administrative data.** That stays a separate open decision, brought back when those features are built.

### What happened

1. **Mobile SRS v2.5.0**, by 19 asserted edits, with its change record; v2.4.0 is unchanged.
   - §1.4.3.2 gains *Status: in force* and a note.
   - `SC-10` and `NFR-48` are scoped to citizen-side drafts and pending submissions, and the old `TBD-M16` sentence is struck through.
   - `RC-23` and the Appendix A entry say the override stands.
   - `TBD-M16` is resolved and `TBD-M17` opened; the counts are now 38 `[TBD]`, 30 open.
2. **The register:**
   - `DG-66` resolved;
   - **`DG-68` opened** (Open, owned by Hassan): encryption and storage at rest of staff and administrative data, with options listed and none chosen;
   - notes on `DG-02` and `DG-63`.
3. **Tasks:** `T-089` and `T-090` list `DG-68` as a decision blocker, with a note on `T-088`.
4. **Other records:**
   - `DR-26_REVIEW.md` marked decided, its analysis kept;
   - the source registers, `CURRENT_STATE`, `NEXT_TASK`, the architecture overview and the mobile README updated.

### Checks actually run

- v2.5.0 generated; v2.4.0's SHA-256 unchanged.
- `extract_requirements.py --check` OK: only `NFR-48` and `SC-10` changed in the index (124 FR, 86 NFR, 12 SC).
- The tracker regenerated and validated: 68 decisions, 43 checks; tracker tests and import dry-run OK.
- **Code checked for a lapse assumption:** none exists. The only mentions are two tracker labels calling `SC-01`–`SC-12` "conditions of DR-26", which stays true, and a comment citing `SC-10` for account binding.
  - **No implementation change was needed**; the mobile and backend suites were run unchanged.

### Not done / not claimed

- Historical rows that said `TBD-M16` was open (the v2.3.0 and v2.4.0 change-history rows and appendices) are kept as they were written.
- `DG-68` is not decided. No staff or administrative data is stored on a device today.

### Status changes

- `DG-66`: Proposed → **Resolved**.
- `DG-68`: added, **Open**.
- `VAL-047` added.

## 2026-10-09 (Fri) — The first physical Android phone (`T-046` set-up)

**Owner:** Hassan Jalal (set up the phone, installed the app and reported the evidence).

### What happened

1. **Hassan reported:** Samsung SM-A546E, Android 16, adb connection successful, `adb shell getconf PAGE_SIZE` = `4096`, and the debug APK installed from `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
2. **Read again over adb from the Mac** (13:10 PKT):
   - the same model; Android 16 (API 36); `arm64-v8a`; security patch 2026-05-05; 4096-byte pages;
   - installed at 06:01 phone time, and the APK on the phone has the same SHA-256 as the build output (`05f8d973…`);
   - package flags without `ALLOW_BACKUP`; camera, microphone and location declared, none granted.
3. **The Desktop folder was found renamed** from `PARAKH PROJECT/` to `PARAKH/`, with the same `.git`, `HEAD` (`7b48006`) and remote. The live records and the phone procedure's commands now use the new path; history entries keep the old name.
4. **Records:**
   - `VAL-048`;
   - notes on `T-021`, `T-031`, `T-046` and `DG-35`;
   - the procedure's §11 results table started, and a page-size step added to its §3;
   - a `CURRENT_STATE` line that still said requirements follow SRS v2.3.0 corrected to v2.5.0.

### First launch (§6), the same day

- **Pass** (`VAL-049`). Hassan opened the app from its icon after the backend and Metro were started on the Mac and the phone's ports were linked with `adb reverse`.
- **Metro** bundled 1,536 modules in 2.3 s. **The phone's log** shows no crash and no JavaScript error; the app was the resumed activity.
- **The screenshot** shows CIT-01 with the title *Parakh* (the phone is set to English), the bilingual prompt and both buttons. It is kept with the status bar cropped out.
- **The procedure's §7.1 was corrected:** it expected the screens to be right to left. The app sets the direction of each Urdu text block, but the layout is not mirrored until `T-032`, so an unmirrored layout is not a failure.

### §7.1 and §7.2, the same afternoon

- **§7.1 Urdu half: Pass.** CIT-02 entirely in Urdu and right-aligned, with the not-anonymous sentence. Wording finding against `T-042`: CIT-02 still says the AI produces Urdu text only, which predates `DG-61`/`DG-62`.
- **§7.2:** sign-in worked (code request 202, verify 200; three consents recorded in Urdu); restore went straight to Home with no server call; sign-out after the 15-minute access token expired refreshed once and logged out (`VAL-050`).
- **The sign-in used a number that was not the test number** (it was already in the field). Nothing was sent: SMS is simulated. The number was held only in the local development database, encrypted. Hassan deleted that database at 14:22 and it was recreated empty. The procedure now says to check the field shows exactly `3001234567` before Send code.
- **Finding F-1 (defect, `FR-AUTH.1`):** after the restore, Home appeared in English although Urdu had been chosen. The choice was kept only in memory, and every start took the phone's system language. **Fixed:** the choice is stored in a small app-private file and used before the device language (`src/i18n/preference.ts`); 6 tests, 4 mutations caught (`VAL-051`). Phone re-test pending.
- **Clean sign-in, then the F-1 re-test (`VAL-052`, `VAL-053`):**
  - sign-in in English with `300 1234567` on the empty database: one account, masked `+92 300 *** 4567`; the phone's private preference file reads `en`;
  - then sign-out, Urdu chosen, sign-in, and the app closed and reopened: a new process, the stored choice `ur`, **Home in Urdu**. F-1 is fixed on the device; `T-042` is back In Review.
- **The CIT-02 wording finding was reclassified.** `FR-AUTH.2` itself still says the citizen reviews the Urdu text, so the app matches the requirement; the requirement predates `DG-61`/`DG-62`. Recorded as **`DG-69`** (Open, Hassan), with no option chosen.
- **§7.3 self-check and §7.4 48-hour rules: Pass (`VAL-054`, `VAL-055`).** The self-check passed on the phone, with the database plain SQLite and app-private. For §7.4 Hassan moved the phone's date to 10, 11 and 12 October: the drafts were deleted at 48 hours from creation, the pending submission at 48 hours from its Submit, each with its file. During Part 2 the phone powered off unexpectedly (cause unknown). The deletion it was testing had already happened at 15:00 and is shown by the database and files, but its on-screen count was not seen. After the restart the `adb reverse` links were gone and the app sat on a grey screen; relinking fixed it without clearing data, and the procedure now says so.
- **§7.5 restart, §7.6 permissions and §7.7 backups: Pass (`VAL-056`–`VAL-058`).** A test draft and a test pending submission survived a planned phone restart with their deadlines unchanged; camera, microphone and location are declared and not granted, with no photo, storage or background-location permission; no `ALLOW_BACKUP` flag, every storage domain excluded, and Parakh absent from the phone's Google backup. The only crash after the restart was in a Google system app (`com.google.android.as`).
- **The first Android round of `T-046` is complete** (§1–§7). Still open for the task: the 16 KB page-size check, iOS, and a move of real 5 October drafts, which no available device holds.
- **A screen read captured another app.** When the screen text was read with `uiautomator` to check a covered line, the phone was showing a personal messaging app. The dump file on the phone was deleted at once, nothing was kept or recorded, and the screen is now checked to be Parakh's before it is read.
- **A tracker defect surfaced by its own test:** after the longer notes moved a part boundary of the workbook's saved baseline inside a text value, the test that cuts a part off no longer saw an error, because the cut part still parsed. The baseline now carries a SHA-256 checked on reading; with the check disabled the test fails again, with it the 16 tracker tests pass.
- **GitHub CLI** 2.102.0 installed at Hassan's request (official release, checksum verified, in `~/.local`), and signed in by him; recorded in `ENVIRONMENT_CHECK.md`.

### Not done / not claimed

- **No Parakh screen had been checked on the phone before §6.** The phone shows the app was opened once at install time, but Metro was not running when checked at 13:10, and a debug build cannot show its screens without it. That is not a test result. The tests of §6–§7 are next.
- **The 16 KB page-size check is not covered**: this phone has 4 KB pages. It stays pending for a 16 KB-page device or emulator image.
- No device with Android 7–15 has been tested; `DG-35` stays Interim.
- No iOS (`T-024`).

### Status changes

- `T-031`: In Progress → **In Review** (every acceptance criterion now has evidence; `DG-03` stays open and does not affect the Expo app).
- `T-021` and `T-046` stay In Progress.
- `T-042`: In Review → **In Progress** (F-1) → **In Review** (F-1 fixed and re-tested).
- `DG-69` added, **Open**.
- `VAL-048`–`VAL-058` added.

## 2026-10-09 (Fri), evening — `T-049` CIT-08 live capture, and test numbers only in development (`DG-70`)

**Owner:** Hassan Jalal (asked for `T-049` and for the development-only safeguard).

### What happened

1. **The safeguard (`DG-70`).** With `PARAKH_ENV=development`, API-121 and API-122 accept only `PARAKH_DEV_TEST_NUMBERS` (default: the three numbers the project's procedures and tests designate). Any other number gets `403 E_DEV_TEST_NUMBER_ONLY` before anything is stored, counted, sent or audited. Test and production never refuse a number here; production refuses to start with the variable set. CIT-04 explains the refusal.
2. **CIT-08 (`T-049`).** `mobile/src/screens/EvidenceScreen.tsx`:
   - the in-app camera only — no gallery, file, import or skip control;
   - 1–3 photos and one video of up to 60 s, which never counts as a photo; Continue waits for a photo and says why;
   - `ingestCapture` hashes the camera's own file and moves it into the draft; it now reads a video's length from its container, as the server does (`src/domain/mp4.ts`), and refuses items over the server's limits or unreadable videos;
   - each permission is explained before Android asks; a refusal leads to Settings; a video also needs the microphone;
   - a capture starts only with free space for it; a failure is named and earlier items stay;
   - review, retake and delete change the local draft only.
3. **The account id on the phone.** Drafts are bound to the citizen's own account id. It is now read from API-155 at sign-in and kept with the tokens (this device only), cleared with them, so capture works offline. The token response's shape is unchanged (`DG-52` is not approved).
4. **Entry point.** The SRS order is CIT-07 → CIT-08; CIT-07 belongs to `T-048`. Until it exists, CIT-08 opens from the development entry `parakh://dev-capture`, and Continue returns Home with the draft kept.

### Checks actually run

- Backend: 199 tests OK (13 new); 4 mutations caught; `manage.py check` clean; no migration (`VAL-059`).
- Mobile: `npm run check` — tsc, ESLint 0, Prettier, **Jest 232 passed**, 2 opt-in skipped (38 new); 8 mutations caught (`VAL-060`).

### Not done / not claimed

- **Not yet on a phone.** The camera, the microphone and the permission prompts are stand-ins in Jest. The phone test is §8.1.
- `DG-71` (video without the microphone) is open, and `DG-72` (photo size and quality) is proposed; neither is decided here.
- No upload: `T-055` sends the evidence later.

### Status changes

- `T-049`: Not Started → **In Progress** (built and Jest-verified; the phone test remains).
- `DG-70` added, **Resolved**; `DG-71` added, **Open**; `DG-72` added, **Proposed**.
- `VAL-059` and `VAL-060` added.

## 2026-10-10 (Sat) — `T-049` on the phone: steps 1–2 pass; finding F-2

**Owner:** Hassan Jalal (ran the tests on the phone).

- **Services overnight:** the backend and Metro kept running; the `adb reverse` links were gone after a USB reconnection and were made again. The test account, its session, the draft and the app's data were intact.
- **Step 1 — Pass (`VAL-061`).** Android's camera prompt opened 3.6 s after CIT-08, and only the camera was asked. The app now keeps the account id with the session: the draft's owner equals the server's account for the test number.
- **Step 2 — Pass (`VAL-061`).** Three photos of 2.76 MP, about 0.2 MB each, with no location in the files. Each file's SHA-256 still equals the one taken at capture, and no capture is left in the cache. An early tap on Continue returned Home; reopening found the same draft with its photos.
- **Step 3 — Fail, finding F-2 (`VAL-062`).** The video stopped after 26 s. The phone's recorder log shows why: at its default 12 Mbit/s for 720p it reached the 40 MiB limit (`Reach file size limit 39925392 > 39845888`). Nothing crashed and nobody stopped it; the 60-second limit was never reached. The video itself is valid and unchanged since capture.
- **Fix (`VAL-063`):** CIT-08 sets a 4.5 Mbit/s video bitrate, so 60 seconds with sound fit in about 34.7 MiB. It is a technical setting, which `DG-54` treats as routine and reversible, and it is recorded as proposed under `DG-72` for Hassan's approval, with the alternatives (a larger limit, or shorter videos). Jest 233 passed; two mutations caught.

### Not done / not claimed

- *(Later the same morning)* **Re-test — Pass (`VAL-064`):** the 26-second video was reviewed and retaken; the new recording was stopped by the camera at the **60-second limit** (`Audio data reaches duration limit`), 59.97 s and 34.36 MiB (34.7 MiB predicted), H.264 and AAC, unchanged since capture. The retaken file is gone. **F-2 is fixed on the device.** Hassan's own confirmation of the explanation-before-prompt order is pending.
- **Step 4 — Pass (`VAL-065`)** and **step 5 — Pass (`VAL-066`):** after review, delete and retake, 3 photos and 1 video, one file each, unchanged since capture, nothing in the cache. Three photos were removed where the steps asked for two; Hassan cannot confirm the exact sequence, and the end state is consistent. Parakh is not a share target; its manifest accepts only the launcher and `parakh://` links.
- **Finding F-3 (`VAL-067`),** found by reading the code while preparing a re-test Hassan asked for — he cannot recall whether the explanations preceded Android's prompts: CIT-08 did not read a permission again when the citizen came back from Settings, and after a refusal Android could still ask about, its text pointed to Settings beside an Allow button. Fixed; Jest 235 passed; two mutations caught. The permission re-test on the phone follows.
- **Permission re-test — Pass (`VAL-068`, `VAL-069`).** Hassan set Camera and Microphone to *Don't allow* in Settings. For each: the refusal was explained before Android's prompt; one more refusal and Android stopped asking, so *Open settings* appeared; once allowed in Settings, the screen updated on return without reopening — the F-3 fix on the device. The draft and its four files were unchanged throughout.
  - The two approved `adb` resets were **not run**: the permission library tells *never asked* from *refused* by its own record in the app's data, so they would not have brought back the first-time screen, and changing that record is an app-data change that was not approved. The first-time explanation stays covered by Jest and by the first run's timing (`VAL-061`).
- **Steps 6–7 — Pass (`VAL-070`).** Four files, each with its recorded size and SHA-256, readable only by Parakh; nothing in the cache or in shared storage (none in the phone's media index). After Parakh was closed and reopened — a new process — the same draft and identical records, every file re-hashed equal.
- **`T-049`: In Progress → In Review.** Every acceptance criterion has Jest and phone evidence. Open for Hassan: `DG-71`, `DG-72`. Next: `T-050`.

## 2026-10-11 (Sun) — Hassan's decisions of 11 October; Mobile SRS v2.6.0

**Owner:** Hassan Jalal (his decisions, given in chat).

### The decisions

- **`DG-30`:** the first version's location comes from the phone's GPS, with latitude, longitude and the reported accuracy, adjusted with directional buttons; **no external map or address-lookup provider**.
- **`DG-71`:** a video includes sound; the microphone is required for video; refused or unavailable, no video and never a silent one; photos stay available.
- **`DG-72`:** the capture settings are kept (about 3 MP at 70 %; about 4.5 Mbit/s).

### Contradictions reported, not resolved

`DG-30` conflicts with `FR-PUB.24` as written — its criterion that the pin can also be moved *by dragging*, and its trace (and the `CIT-10` row's) to `GET /geo/reverse` — and sets no start point for a manual position when location is refused. **The requirement text is unchanged**; the question is `DG-73` (open), SRS `TBD-M18`. `DG-71` and `DG-72` conflict with nothing.

### What happened

1. **Register:** `DG-30`, `DG-71`, `DG-72` → Resolved, each with Hassan's decision in the resolution note and the earlier proposal kept; `DG-73` opened.
2. **Mobile SRS v2.6.0** by 25 asserted edits, with its change record: dated notes on §4.2, `FR-PUB.4`, `FR-PUB.24` and `NFR-8`'s source; `TBD-M18`; honest status for the physical-phone tests. No requirement statement changed; only `NFR-8`'s source note changed in the index.
3. **Code (`VAL-071`):** a video without a sound track is refused on the phone (deleted, with a plain explanation) and by the server (`400 video_sound`); the camera is explicitly not muted; the settings marked approved. Backend 201 tests OK; mobile Jest 237 passed; three mutations caught.
4. **Tasks:** `T-051` now waits on `DG-73`; `T-049` has no open decision.

### Not done / not claimed

- A sound track that holds only silence cannot be detected without decoding.
- `T-051` is not started.

### Status changes

- `DG-30`, `DG-71`, `DG-72`: → **Resolved**. `DG-73`: added, **Open**.
- `VAL-071`, `VAL-072` added.

## 2026-10-11 (Sun) — `T-050` CIT-09, speak or type

**Owner:** Hassan Jalal. Built with AI assistance; recorded in `docs/ai/AI_ASSISTANCE.md`.

### What happened

1. **CIT-09** (`mobile/src/screens/DescribeScreen.tsx`, route `app/(citizen)/describe.tsx`) is opened from CIT-08's Continue.
   - **Speak** and **Type** are equal choices (`FR-PUB.9`, `DG-61`). A new draft's stored mode defaults to *voice*, so the screen infers the choice from what the draft holds; a new draft opens with neither selected.
   - **Recording** (`FR-PUB.10`, `FR-PUB.11`): the recorder's own file is hashed and moved into the draft through `ingestCapture`, with its length read from the file. It can be played, paused, recorded again and deleted, and its capture time is the moment recording began.
   - **Typed text** (`FR-PUB.12`) is saved as written, verbatim, up to the server's 4,000 characters.
   - Switching between speaking and typing deletes nothing without confirmation (`FR-COMMON.14`). The microphone is explained before Android asks; if refused, typing stays and the way to grant it is kept (`FR-COMMON.16`).
2. **Intake:** a recording must be a sound-only MPEG-4 file of at most 20 MiB; anything else is refused and deleted.
3. **Android reports a finish after Stop as well** (read in expo-audio's Android source). A guard keeps one recording per Stop. The recorder's own stop at its cap is handled as a press of Stop.
4. **Defect found while connecting the screens:** CIT-08 listed every item in the draft, so a recording would have shown there as a video, and Retake would have treated it as one. CIT-08 now lists only photos and the video.
5. **Checks (`VAL-073`):** tsc, ESLint and Prettier clean; Jest 257 passed (237 before); 22 mutations caught. The first run left one survivor, a redundant save of the mode when Speak was chosen. The save was removed and a test added for the case it hid.

### Raised for Hassan, not decided

- **`DG-74` (Proposed):** no requirement sets a recording format, quality or maximum length. The proposal is AAC, one channel, 64 kbit/s, with the recorder stopping itself at about 40 minutes so a recording fits the 20 MiB limit. A shorter product limit is his choice; none is set.
- **No contradiction with an approved requirement was found.** The use-case pack (`UC-CIT-018`–`UC-CIT-021`) still calls typing a secondary fallback. `FR-PUB.9` (v2.3.0, `DG-61`) supersedes that by source precedence, so the pack is not edited.

### Not done / not claimed

- Nothing has been tried on the phone yet: the recorder, playback and the permission prompt are stand-ins in Jest. The phone test is §8.2 steps 1–8.
- Upload, the server's Urdu and English text and the processing states belong to `T-055`, `T-127` and `T-058`.
- The Urdu strings are an unreviewed draft (`DG-41`).

### Status changes

- `T-050`: Not Started → **In Progress**. `DG-74`: added, **Proposed**. `VAL-073` added.

## 2026-10-11 (Sun) — `DG-74` decided: a recording lasts at most 3 minutes

**Owner:** Hassan Jalal (his decision, given in chat). Implemented with AI assistance.

### The decision

- **`DG-74`:** AAC, mono, 64 kbit/s approved, with a **hard maximum recording length of 3 minutes**. This is the approved product limit for a citizen's spoken report description. It replaces the about 40 minutes implied only by the server's 20 MiB limit.
- **The `T-050` phone test** will run on a new draft after the `T-049` test draft expires (20:57 PKT). That draft stays unchanged.
- **`DG-73`:** no change. Hassan asked to see the conflicting text, how it conflicts, proposed wording and the consequences first: [`docs/planning/DG-73_REVIEW.md`](../planning/DG-73_REVIEW.md).

### What happened

1. **Register:** `DG-74` → Resolved, with the earlier proposal kept as written.
2. **Device:**
   - the recorder stops itself at 3 minutes;
   - the screen states the limit before and during a recording, and says so when it stops there;
   - a recording over 3 minutes (with the same 0.5 s container-rounding tolerance as a video) is refused and deleted.
3. **Server:** an MPEG-4 recording over 3 minutes is refused with `400 recording_duration` and `max_seconds: 180`.
4. **Checks (`VAL-074`):**
   - backend: 203 tests OK;
   - mobile: Jest 260 passed;
   - 8 mutations, all caught.

### Not done / not claimed

- The server cannot read the length of the other recording types it accepts (`audio/aac`, `audio/mpeg`, `audio/webm`, `audio/wav`). The app never sends them. Whether to accept only MPEG-4 recordings is left to Hassan.
- Mobile SRS v2.6.0 does not yet carry `DG-74`. Proposed: add it at the next revision, with the outcome of `DG-73`.
- Nothing has been tested on the phone yet.

### Status changes

- `DG-74`: Proposed → **Resolved**. `VAL-074` added.

## 2026-10-11 (Sun) — `T-055`, the resumable upload client

**Owner:** Hassan Jalal. Built with AI assistance, while the `T-049` test draft waits to expire. Nothing here touches that draft.

### What happened

1. **`mobile/src/services/evidenceUpload.ts`** sends a draft's evidence to the server. API-131, API-132 and API-133 are added to `src/api/reporting.ts` and the route table.
   - Every kept file is re-hashed before anything leaves the phone. A file that no longer matches its hash at capture, or is gone, stops the upload, and nothing is sent.
   - Items go in chunks of 256 KiB, in order, each with its own SHA-256 and the item's capture hash. The server allows 512 KiB; half keeps an interruption cheap.
   - **Resuming:** the server keeps what it received. On every run the client asks API-133 how many chunks each item has and sends the rest. An item already started keeps its original chunk count. Nothing about the upload is stored on the phone, so no local database change was needed.
   - A chunk refused as damaged (`E_CAPTURE_INTEGRITY`) is sent again, up to three times. At completion (API-132), an item that failed reassembly, or chunks the server still lacks, get one more round.
   - Refusals (for example `video_duration`) are returned for the screens to explain. The local draft and its files are never changed.
2. **Checks (`VAL-075`):**
   - Jest: 15 new tests, 275 passed in all, against an in-memory server applying the backend's rules;
   - the manifest hash checked against a vector from the backend's own `manifest_hash`;
   - 15 mutations: 14 caught, 1 equivalent.
   - The first test run took about 60 s, because Jest compared large buffers byte by byte. The tests now compare SHA-256 hashes: about 5 s, and a stronger check.

### Not done / not claimed

- Not run against the real development backend and not on the phone. Opening a draft on the server (API-130) needs a category (`T-048`, `DG-43` open) and a location (`T-051`, `DG-73` open).
- Not wired to any screen. The pipeline that calls it is `T-052`, and the named upload states are `T-058`.
- The pure-JavaScript base64 encoding takes about 15 ms per chunk under Node. Its speed on the phone is still to be measured.

### Status changes

- `T-055`: Not Started → **In Progress**. `VAL-075` added.

## 2026-10-11 (Sun) — Later decisions of 11 October: `DG-73`–`DG-76`; Mobile SRS v2.7.0

**Owner:** Hassan Jalal (his decisions, given in chat after the `DG-73` review). Implemented with AI assistance.

### The decisions

- **`DG-73` (location):**
  - The phone's current GPS position; if none, its last known position; if neither, the citizen describes the location in words. There is no hard-coded pilot-area coordinate.
  - `DG-30` unchanged: no map, map provider or address lookup; coordinates and accuracy shown where they exist; directional buttons.
  - **M3:** the measured position and its accuracy are kept beside any adjusted position, and an adjustment is never presented as the measurement.
- **`DG-74`:** recorded in the same SRS revision.
- **`DG-75`:** the server accepts MPEG-4 audio only.
- **`DG-76`:** accepted typed text is kept exactly as written.

### Before the code changed (as he asked)

[`DG-73_LOCATION_DATA_DESIGN.md`](../planning/DG-73_LOCATION_DATA_DESIGN.md) lists every affected field and the migrations, and checks the change against the approved privacy, evidence-integrity and submission requirements.

- **One genuine contradiction, reported and not overridden:** `NFR-28` requires a report by voice and camera alone. With no coordinates, the location is a written description, so a voice-only citizen cannot complete the report. `NFR-28` is unchanged; this is `DG-77` / `TBD-M19`.
- **Two points beyond the list:** `measured_at` (the reading's own time, so a stale last known position can be told apart), and a 500-character limit on the description (a technical safeguard).
- **Flagged privacy point:** the measured position may show where the citizen was; who may see it is `DG-78`.
- The development database held no drafts or reports (checked read-only).

### What happened

1. **Server:**
   - `measured_*` and `reported_*` fields, `location_description`, and the derived `location_source` and `location_unverified`;
   - migrations that rename the old position and accuracy fields and add the rest, plus a database check that every report has a location;
   - parsing that refuses any other combination;
   - purge clears every location field.
2. **The server's recording types:** `audio/mp4`, `audio/m4a` and `audio/x-m4a` only. `audio/3gpp` is dropped too, as it is not MPEG-4.
3. **Verbatim typed text:** the server no longer trims the draft's typed text, the typed transcription or a reporter's correction.
   - The rendering step had also normalised them, through the hash's canonical form; it no longer does.
   - A change of whitespace alone is not a correction.
4. **Phone:** migration 3 (columns added only), `src/domain/location.ts`, and `setLocation` (one step, only while editable).
5. **Mobile SRS v2.7.0:** 34 asserted edits; v2.6.0 is unchanged.
   - `FR-PUB.24` is restated, with its v2.6.0 statement and criteria quoted in a dated note.
   - The map, dragging and `GET /geo/reverse` are struck through.
   - `TBD-M18` resolved; `TBD-M19` opened.
6. **Checks:** backend 213 tests OK; mobile Jest 284 passed; 19 mutations, all caught (`VAL-076`–`VAL-078`).

### Not done / not claimed

- The CIT-10 screen (the rest of `T-051`).
- Nothing new is on the phone. Metro will be restarted only after the T-049 test draft expires at 20:57 PKT.

### Status changes

- `DG-73` → **Resolved**.
- `DG-75`, `DG-76` added, **Resolved**.
- `DG-77`, `DG-78` added, **Open**.
- `T-051`: Not Started → **In Progress** (unblocked).
- `VAL-076`–`VAL-078` added.

## 2026-10-11 (Sun) — `T-051`: the CIT-10 location screen

**Owner:** Hassan Jalal. Built with AI assistance while the T-049 test draft waits to expire. Nothing here touches it.

### What happened

1. **`mobile/src/screens/LocationScreen.tsx`** (route `app/(citizen)/location.tsx`, opened from CIT-09's Continue):
   - with location allowed, the current GPS position is found at once. It is saved with its accuracy and the reading's own time;
   - the location is explained before Android asks (`FR-COMMON.16`);
   - with no current fix within 20 seconds, the last known position is used, shown with its age;
   - with neither, or with location refused, the reporter writes a description, kept exactly as written. The screen says the report will state that coordinates were not available. **Find my position again** can replace it with coordinates later;
   - **North, South, East and West** move the reported position 10 m per press. The measurement stays unchanged and is shown beside it, and **Back to the measured position** undoes the moves;
   - no map, no map provider, no address lookup. The test's stand-in fails if one is ever called.
2. **Checks (`VAL-079`):**
   - Jest: 297 passed (13 new);
   - 13 mutations, all caught.
3. **Routine, reversible choices:** 10 m per press, and 20 seconds to wait for a current fix.
4. **Not stored:** Android also says whether a reading was mocked. It is not in the decision, so it is not stored.

### Not done / not claimed

- The phone test (`PHYSICAL_ANDROID_TESTING.md` §8.2b) runs after §8.2, once the T-049 draft has expired.
- Continue goes Home until CIT-11 exists (`T-062`).

### Status changes

- `T-051` stays **In Progress** (phone test pending).
- `VAL-079` added.

## 2026-10-11 (Sun) — `DG-77`, `DG-78`, `DG-81`; Mobile SRS v2.8.0

**Owner:** Hassan Jalal (his decisions, given in chat). Implemented with AI assistance.

### The decisions

- **`DG-77`:** `NFR-28` preserved. Without a current or usable last known position, the citizen may describe the location by voice; typing is not mandatory, and a written description stays as an alternative. The spoken description is report evidence, with no AI interpretation or location inference from it.
- **`DG-78`:** authorized staff see the device-measured and the final position as two distinct values, with the device-reported accuracy.
- **`DG-81`:** 5 m per button press (not 10), 20 s for a fix, 500 characters, the best practical accuracy requested, the device's accuracy shown and no greater precision claimed.

### Checked before the code changed

[`DG-77_DG-78_DESIGN.md`](../planning/DG-77_DG-78_DESIGN.md). Nothing approved was overridden.

- **Contractors:** §4.3.5 gives them location at "required precision only" and never the original recording, and `DG-78` does not say whether they count as authorized staff. Opened as `DG-80` / `TBD-M20`; §4.3.5 is unchanged.
- **Length of a spoken location description:** none is set. The 3 minutes of `DG-74` is applied and proposed (`DG-79`).
- **Consent:** the required `CIT-03` consent already covers storing it.

### What happened

1. **Server:**
   - evidence kind `location_voice`, which the AI pipeline never reads;
   - location source `spoken_description` (and `description` renamed `written_description`);
   - API-130 `spoken_description`;
   - exactly one location recording for a spoken location and none otherwise, checked at API-132 and API-140;
   - the manifest reopened when the location changes to or from spoken;
   - the database check extended.
2. **Phone:**
   - CIT-10 offers **Speak** and **Type** equally without coordinates. Speak records, plays and deletes; the recorder logic is shared in `useVoiceRecorder`.
   - Nothing given is deleted without confirmation, including when a GPS position is found later.
   - 5 m per press; `Accuracy.Highest`; the device's accuracy shown, rounded up to 0.1 m.
3. **Mobile SRS v2.8.0:** 33 asserted edits. `FR-PUB.24` is restated with its v2.7.0 text quoted; `TBD-M19` resolved, `TBD-M20` opened.
4. **Checks:**
   - backend: 219 tests OK;
   - mobile: Jest 305 passed;
   - 16 mutations, all caught (`VAL-080`, `VAL-081`).

### Not done / not claimed

- No staff route exists to show `DG-78`.
- Nothing new is on the phone yet. It arrives with the restart after the T-049 draft expires (20:57 PKT).

### Status changes

- `DG-77`, `DG-78` → **Resolved**.
- `DG-81` added, **Resolved**.
- `DG-79` added, **Proposed**.
- `DG-80` added, **Open**.
- `VAL-080`, `VAL-081` added.

## 2026-10-11 (Sun) — `DG-79`, `DG-80`, `DG-82`; Mobile SRS v2.9.0

**Owner:** Hassan Jalal (his decisions, given in chat). Implemented with AI assistance.

### The decisions

- **`DG-79`:** a spoken location description lasts at most 1 minute, enforced on the phone and the server.
- **`DG-80`:** contractors see only the final reported location, never the device-measured position.
- **`DG-82`:** a last known position is used only if it is at most 30 minutes old, with its age shown.

### Reported, not overridden

- **`DG-83` (open):** what a contractor receives for a report without coordinates (`TBD-M21`).
- **The 1-minute limit** keeps the 0.5-second container-rounding tolerance of the approved video and recording limits. A file the recorder stopped at 60 seconds can read just over 60 seconds in its container.
- **The 30-minute age** can only be enforced on the phone, where the reading is taken.

### What happened

1. **Server:** `PARAKH_LOCATION_RECORDING_MAX_SECONDS = 60` (`400 location_recording_duration`).
2. **Phone:**
   - the location recorder stops at 60 seconds, and the intake refuses longer files;
   - `getLastKnownPositionAsync({ maxAge })` plus the app's own age check, with a plain notice when the reading is too old.
3. **Mobile SRS v2.9.0:** 27 asserted edits; `TBD-M20` resolved, `TBD-M21` opened.
4. **Checks:**
   - backend: 220 tests OK;
   - mobile: Jest 311 passed;
   - 9 mutations, all caught (`VAL-082`, `VAL-083`).

### Status changes

- `DG-79`, `DG-80` → **Resolved**.
- `DG-82` added, **Resolved**.
- `DG-83` added, **Open**.

## 2026-10-11 (Sun) — `DG-83`; Mobile SRS v2.10.0

**Owner:** Hassan Jalal (his decision, given in chat). Recorded with AI assistance.

- **The decision:** without coordinates, a contractor may receive the citizen's written location description. A contractor never receives or plays the spoken location recording, which stays protected evidence. A voice-only location is not exposed through the recording; it stays identifiable so an authorized staff workflow can provide the operational location. `DG-80` is unchanged.
- **Contradictions:** none. §4.3.5 already withheld the `voice_original` from contractors.
- **Recorded in:**
  - Mobile SRS v2.10.0 (20 asserted edits; no requirement statement changed; `TBD-M21` resolved);
  - the API contract;
  - the acceptance criteria of `T-096` (contractor packet) and `T-095` (assignment).
- **Validation:** `VAL-084`.
- **No code:** no contractor or staff interface exists yet. The voice-only case is already identifiable in the data (`spoken_description`, no coordinates, no text).
- **Not designed here:** how the staff workflow provides the operational location. That comes with the staff portals.
- **Status changes:** `DG-83` → **Resolved**; `VAL-084` added.

## 2026-10-11 (Sun) — `T-048`: CIT-07 categories and the Home Report tile

**Owner:** Hassan Jalal. Built with AI assistance, toward the citizen flow end to end; the T-049 draft is untouched.

- **DG-43 checked first:** its recommendation (name the routes by path, PROPOSED, without invented API numbers) is already applied to `GET /categories`, and `T-057` was built under the same marker. The six categories are fixed by `FR-PUB.2`, not reserved for a decision. **It does not block CIT-07**; only the official API numbers stay open.
- **CIT-07:** the six categories as picture tiles with text labels, fully offline. Choosing starts the LOCAL_DRAFT with a client-made identifier (`FR-PUB.3`) and opens CIT-08; choosing again after coming back changes that draft.
- **Home:** five picture-and-label tiles (`FR-PUB.1`); Report an Issue works, the other four are marked not yet available.
- **Checks (`VAL-085`):** Jest 317 passed.
- **Not done:** Home counts (with My Reports, `T-063`). The pictures are placeholders until an icon set exists.

## 2026-10-11 (Sun) — `T-052` pipeline; `DG-84`, `DG-85` (Mobile SRS v2.11.0); `T-062` CIT-11/12/13

**Owner:** Hassan Jalal (the decisions given in chat). Built with AI assistance; the T-049 draft is untouched.

- **The pipeline to Submit (`T-052`, `VAL-086`, committed earlier today):** readiness, API-130, the upload, processing, confirmation with the phone's own hash check, Submit through the queue; verified against a throwaway server.
- **Two blockers raised while designing the screens, then decided:**
  - `FR-PUB.29` offered *edit* on a report waiting to send. **`DG-84`: only Retry and Cancel; no Edit.**
  - `FR-PUB.30` required an *expected timeframe* that no source sets. **`DG-85`: no timeframe or SLA; the confirmation, the `PRK-` reference and "You can track its status in My Reports."**
  - Mobile SRS v2.11.0 (20 asserted edits; the v2.10.0 statements quoted) and its change record (`VAL-088`).
- **CIT-11 review:** named, announced stages; the three texts marked AI-generated; the version; a SIMULATED-AI notice; the targeted question; corrections as new versions; confirmation of the exact version; an out-of-date version fetched again; the summary, read aloud through the screen reader; Submit only after confirmation.
- **CIT-12 waiting to send:** no reference; only Retry and Cancel; follows the background queue.
- **CIT-13 received:** only a reference the server returned in this app session; no timeframe.
- **Wiring:** CIT-10 continues to CIT-11; "Change" opens a part and returns; one submission queue per signed-in session.
- **Checks (`VAL-087`):** Jest 362 passed; the screens end to end against a fresh throwaway server, with API-140 called once.
- **Not done:** the phone test (tonight, §8.2c–§8.4). Spoken read-back without a screen reader would need a text-to-speech module and a new build. *Send for review* (`FR-PUB.20`) has no client action defined; the server sets the human-review status itself.
- **Status changes:** `T-062` and `T-058` → **In Progress**; `DG-84`, `DG-85` added, **Resolved**; `VAL-087`, `VAL-088` added.

## 2026-10-11 (Sun) — Backend: the lifecycle after submission (`T-067`, `T-087`, `T-093`–`T-097`)

**Owner:** Hassan Jalal. Built with AI assistance while the phone test waits; no phone, no staff screen.

- **Citizen answer (`VAL-089`):** API-153 confirm and API-154 dispute, with `CitizenConfirmation` and `Dispute`; reporter only; the version seen; replay-safe; the dispute reason as written and out of the audit trail.
- **Staff identity and the six checks (`VAL-090`):** scopes, contractor organisations, staff accounts, role assignments, conflict exclusions and case assignments; the permission matrix as data; `authorize()` in the contract's order; suspension ends every session; the last account admin stays. 16 of 16 mutations caught.
- **Staff workflow (`VAL-091`):** API-160, 161, 163, 164 (accept), 165, 166, 167, 168, 169 and dispute handling, over HTTP with the acting-role header; every step retry-safe through `StateChange`; the contractor work packet filtered on the server. 21 of 21 mutations caught.
- **Corrected to the source:** a reassigned dispute goes to `ACCEPTED` (RBAC §9.3), not `CONTRACTOR_ASSIGNED`.
- **Following the data model:** an `EvidenceObject` may belong to a report with no draft, for staff evidence (Data Model §5.7).
- **Not invented:** capability names the matrix does not give; reason lists, windows, conditions or routing rules. **Raised, Open:** `DG-86`–`DG-92`.
- **Checks:** 254 backend tests passed.

## 2026-10-12 (Mon) — The first phone test of the whole citizen flow (`VAL-092`)

**Owner:** Hassan Jalal, on the Samsung SM-A546E; steps and Mac-side checks by AI assistance.

- **Setup:** the citizen migrations only (after a backup of the development database), backend, Metro on `main`, `adb reverse`; the `T-049` draft had expired and was deleted by the app.
- **Passed:** Home, categories, photo, CIT-09 steps 1–9 (including the 3:00 stop), CIT-10 steps 1–4, the review, Submit and Received (`PRK-FQ87-P6HR`), then the offline report: Waiting to send, Retry offline.
- **Finding F-4:** the automatic retry after connectivity returned never ran. Reproduced in Jest; fixed in `6f55d01` (the timer is re-armed after Submit, Retry and Cancel and wakes at least every 30 s); re-tested on the phone: `PRK-WH64-095F` sent by itself, no duplicate.
- **Test method:** Airplane Mode alone does not cut the USB tunnel to the backend, so the tunnel was removed on purpose for the offline steps.
- **Observations, nothing changed:** O-1 Confirm is available beside an unanswered question; O-2 audit event name `report_created` vs `report_submitted`; O-3 two confirmations of Version 1 on report 1. **Gap G-1:** no way back to a waiting report after a restart until My Reports exists.
- **Not run:** CIT-10 step 5, CIT-11 step 4, Cancel, the lost-answer test (§8.4 step 5), §8.5, §8.6.
- **Status changes:** `VAL-092` added; `T-050`, `T-051`, `T-052`, `T-058`, `T-062` stay In Progress with the phone result noted.

## 2026-10-13 (Tue) — The remaining citizen-side phone tests (`VAL-093`)

**Owner:** Hassan Jalal, on the Samsung SM-A546E; steps and Mac-side checks by AI assistance, with a test relay between the phone and the backend.

- **Passed:** the no-location fallback (a spoken place to 60 s, a typed place, a report with only a spoken place), an interrupted upload resumed without re-sending a chunk, the correction flow, Cancel, the lost answer, a pending report surviving a restart, and the 48 hours ending with the server dropping its copies afterwards.
- **Finding F-6, fixed:** the photo screen's camera stayed open under later screens. It is now mounted only while its screen is in front; regression test; confirmed on the phone (`Device 0 is closed`).
- **Finding F-5, not an app fault:** two retries did not run; Metro in CI mode kept serving a day-old bundle, so the phone never ran the F-4 fix. Found by comparing the cached bundle's size, then confirmed after a Metro restart (the timer woke every 30 s). The procedure now says to restart Metro after every code change.
- **Regression tests added:** GPS returning twice with Keep it; a cancel the queue sends again by itself; the camera closing when covered.
- **Observations, nothing changed:** O-4 a saved position cannot be left once the permission is refused; O-5 two corrections; O-7 one unexplained blank location screen; O-8 a link lost during a cold start; O-9 the 48-hour sentence is not shown on removal. A first guess (the screen being off, O-6) was wrong and was withdrawn.
- **Not re-run on the fixed bundle:** the cancel and the lost-answer recovery by the timer alone (Jest covers both).

## 2026-10-13 (Tue) — Recovery re-run on the fixed code; the citizen flow physically validated (`VAL-094`)

**Owner:** Hassan Jalal, on the Samsung SM-A546E; Mac-side checks by AI assistance.

- **Setup:** Metro restarted on the committed code, the phone's own bundle checked for the scheduler fix, the screen held awake, no nudges.
- **Cancel recovery:** sent by the timer alone, 27 s then 13 s after the connection returned; the server dropped the draft and its uploads. **Finding F-7:** the screen kept *Cancelling…* after completion; fixed in `cae798e`, re-tested.
- **Lost answer:** the server created `PRK-3XQW-STKF` while the answer was dropped; 15 s later the app checked the server, replayed the Submit (200) and showed the same reference; one report.
- **Status changes:** `T-050`, `T-051`, `T-052`, `T-055`, `T-062` → **In Review**; `T-058` and `T-048` stay In Progress, each with its reason.
- **Verdict:** the citizen flow is physically validated on Android. Not covered: a 16 KB-page phone, iOS, real SMS or AI, and the staff side.

## 2026-10-13 (Tue) — My Reports (CIT-14, `T-063`) built and validated on the phone (`VAL-095`)

**Owner:** Hassan Jalal, on the Samsung SM-A546E; steps and Mac-side checks by AI assistance.

- **Built:** My Reports lists the account's reports and what waits on the phone, in three kinds told apart; the approved status words (SRS §4.1.4) and a picture; the last list kept in memory only and cleared at sign-out; Home's tile opens it; a waiting submission opens CIT-12 and a draft goes on at CIT-08. 14 tests, 8 of 8 mutations caught, and a live check of API-150.
- **Validated on the phone:** the list with and without a connection, the waiting and unfinished rows, and the rows following a send by the timer and by Retry, with no duplicate.
- **Finding F-8, found by Hassan and fixed:** Back from Waiting to send reached the category screen of the report just submitted. Waiting to send and Received now open on top of Home with the report's screens removed (`89ead07`).
- **Status changes:** `T-064` → **In Review** (the first slice is verified on a phone); `T-063` stays In Progress for report detail (CIT-15).
- **Observation O-10:** Waiting to send has no on-screen exit except Android's Back.


## 2026-10-13 (Tue) — A-01 citizen evidence privacy boundary (`T-129`, `VAL-096`)

**Owner:** Hassan Jalal. Codex implemented the approved narrow fix; Claude Code independently reviewed the test design and exact diff in separate tools-disabled, non-persistent sessions. No mobile code, development database or physical phone was used.

- **Regression first:** three permanent tests reproduced five disclosure paths in Django's disposable in-memory database: report-linked staff evidence (with no submission and with the original submission), same-citizen evidence from another submission, and original-submission deleted, RECEIVING and derived evidence. Unsealed evidence was already excluded by the old filter.
- **Fix:** `detail_body` and `owned_evidence` now share one fail-closed queryset. It requires the owned citizen report, its exact originating `ClientSubmission`, the same citizen account, citizen uploader, COMPLETE status, a seal, no deletion and no derivation. Staff/completion evidence stays outside this citizen path for a separately governed CIT-17 disclosure.
- **Preserved:** the original voice remains listed and is returned byte-for-byte; `Cache-Control: no-store`; report ownership; the uniform 404 status and body for excluded and missing evidence.
- **Checks:** the three regressions failed before the fix; 19 focused report tests passed after it; the full backend suite passed **257/257** in 32.857 s with zero Django system-check issues.
- **Claude review:** test design first returned **APPROVE WITH CHANGES**; the additional COMPLETE, orthogonal staff, derived, positive-control and uniform-404 checks were added; the expanded test design then returned **APPROVE**; the exact production diff and focused result returned **APPROVE**, with no required changes. A later extra request to acknowledge the unchanged diff's 257-pass receipt hit Claude's temporary session limit; it does not replace or weaken the earlier exact-diff approval.
- **Not done:** CIT-15, CIT-17, A-02…A-06, mobile changes, migrations, package installation, development data or phone work.
- **Stop point:** push this reviewed checkpoint only to `fix/a01-citizen-evidence-privacy`; do not merge to `main` or start CIT-15 without Hassan's explicit authorization.

## 2026-10-13 (Tue) — CIT-15 local report detail (`T-063`, `VAL-110`)

**Owner:** Hassan Jalal. Codex implemented this increment after Hassan supplied the 13 October master directive and asked work to begin. The previous A-01 stop point was superseded for this task. No physical phone, real citizen data, or development database was used.

- **Starting point:** isolated `codex/cit15-report-detail` worktree at reviewed A-01 commit `e0caf92`. The separate owner-baseline, F-6/F-8, A-02/A-03, A-04 and UI worktrees were left untouched.
- **Built:** API-151 mobile client; CIT-14 sent-row navigation to CIT-15; detail screen for the confirmed original and civic texts, separate measured/reported location, original citizen evidence, sanitised state timeline and reference-only sharing. Native photo/audio/video sources carry the citizen bearer token; video caching is disabled. No offline report-media cache was added.
- **Privacy checks:** the screen selects explicit public fields even if a synthetic API body contains staff notes, officer contact or intermediate ASR; missing and foreign reports show the same not-found message; offline detail is not fabricated from the cached list. A client test checks the protected media route, fresh bearer token and UUID validation.
- **Validation:** `cd mobile && npm run check`: TypeScript, ESLint and Prettier passed; 388 Jest tests passed, 4 skipped. Focused client/My Reports/detail: 31 passed. Disposable Django report suite: 44 passed, zero system-check issues. No full physical media playback or independent review claimed.
- **Independent review attempt:** the installed Claude Code CLI (`2.1.283`) was invoked in read-only, tools-disabled, non-persistent mode against the staged mobile diff. It returned `Not logged in` before reviewing. No approval or review finding is claimed.
- **Status:** `T-063` In Review. CIT-15 Urdu strings are provisional pending Hassan's review (`DG-41`). Native media behavior, session-expiry handling and no-store caching require physical checks under §8.8. Owner decision intake proceeds in a separate worktree; no main merge is authorized by this checkpoint.


## 2026-10-13 — T-063/T-046 Android 10 media follow-up (VAL-111)

Codex reproduced F-9: original photo returned 401 while authenticated audio/video worked. RN 0.86 Android drops source-object headers; the application now uses the array source form. Regression failed before and passed after; full mobile check passed 388 tests, 4 skipped. Shared Metro cache initially served a frozen-worktree module; --clear and bundle inspection established correct source before device acceptance. Physical results, exact scope and unsuccessful test attempts are in `docs/testing/evidence/2026-10-13-android10/README.md`. No new dependency, production data, deployment or merge. Native cache/account cleanup remains an explicit next risk.

The continuation directive and complete 358-key provisional Urdu review package are preserved. Hassan remains sole human developer/designer; no independent approval or Urdu sign-off is claimed. Claude review remains deferred to 16 October; the usage guard remains active.


## 2026-10-13 — T-063 F-10 cache audit (VAL-112, Failed)

Codex inspected only PARAKH private cache paths/hashes and used the synthetic account's Sign out. The cached JPEG was byte-identical to the generated original both before and after logout204. Language gateway returned correctly; cache cleanup/confidentiality did not. T-063 reopened In Progress. Source analysis and exact repair criteria are recorded in VAL-112; no fix or cross-account leak is claimed. PR5 CI all passed and remains frozen; main unchanged. No user content deleted or dependencies installed.
