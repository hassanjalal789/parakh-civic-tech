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
