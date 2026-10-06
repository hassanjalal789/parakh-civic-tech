# Current State

| Field | Value |
|---|---|
| Updated | 2026-10-06 (Asia/Karachi), after recording Hassan's decisions of 6 October and issuing Mobile SRS v2.3.0 (`T-126`) |
| Active working location | `PARAKH PROJECT/` on the Desktop — the only one. The Documents clone is an inactive backup |
| Branch | `main` — the only branch on GitHub |
| Last verified milestone | **M0 complete** (`VAL-010`). M2/M3 work is In Review or In Progress — see below |
| Current task | **The code is being brought in line with the 6 October decisions.** Next: Urdu and English report text on the backend (`T-127`), then the unencrypted draft store with its 2-day lifetime, the one-time migration and the submission rules on the device (`T-047`, `T-128`, `T-052`) ([NEXT_TASK.md](NEXT_TASK.md)) |

## Repository

- **GitHub:** `hassanjalal789/parakh-civic-tech`, **private**, created on 2026-10-04 after Hassan deleted the earlier repository.
- **History:** starts from one initial commit. The earlier commit history is kept locally and is not published. Commit hashes quoted in older records refer to that local history.
- **Kept locally and git-ignored:**
  - `README_SETUP.md`, `SRS/SOURCE_IMPORT_MANIFEST.md` and the `SRS/` snapshot copies;
  - the two August planning documents (S-24, S-25);
  - `backend/.venv/`, `backend/.local/` and `mobile/node_modules/`.

## Decisions of 2026-10-06 (Hassan Jalal)

| Decision | ID |
|---|---|
| Report text by speaking or typing — two equal ways | `DG-61` |
| Report text in Urdu and English; the reporter confirms the transcription and every translation; AI only on the server, never changing confirmed text, approving a report or replacing verification | `DG-62` |
| No app encryption for local drafts and their media (`DR-23` superseded for them); the captured file is used directly; no unlock key or lost-key reset; tokens, HTTPS, account isolation, server authorization and OS protections unchanged | `DG-63` |
| Unsubmitted drafts and their local media are deleted 2 days after creation; editing never extends it | `DG-64` |
| Submission only on an explicit Submit; 48-hour retries; status check before a retry or a deletion; no duplicates | `DG-65` |
| Verification sequence unchanged; server clean-up timing separate, 72 h still not approved | `DG-56`, `DG-57` |

Raised, not decided: whether amending `SC-10` lapses the `DR-26` override (`DG-66`), and how long an unconfirmed submission is kept after its 48 hours (`DG-67`).

**What the code does today, against these decisions:** the backend still produces an Urdu text only, and its settings still tie server clean-up to the retry window. The mobile store of 5 October is the **superseded encrypted one** (`T-047` back to In Progress). Both are being reworked now.

## Decisions of 2026-10-04 (Hassan Jalal)

| Decision | ID |
|---|---|
| 1–3 live photos per report; photos are mandatory again (supersedes DG-09) | `DG-47` |
| One optional live video of up to 60 seconds | `DG-54` |
| Uploads before final submission are temporary processing data; cancellation removes them | `DG-55` |
| Automatic submission retry for 48 hours from the first final-submission attempt | `DG-14` |
| Typed reports get an Urdu rendering and the reporter's confirmation | `DG-53` |
| Verification sequence: Street Representative, then UC Officer | `DG-56` |
| Android development tools approved | `T-022` |

Requirements now follow **Mobile SRS v2.3.0** (6 Oct); v2.2.0 and v2.1.0 are kept as superseded baselines. **The backend follows these decisions** (`T-122`…`T-125`, In Review). On the mobile side, the encrypted store enforces the same evidence bounds (1–3 photos, one video of up to 60 s), but **there are no reporting screens yet**.

## Implementation status

| Area | State | Tasks |
|---|---|---|
| Backend skeleton | Django 6.1.1 + DRF 3.18.1. Environment-driven settings, deny-by-default Bearer auth. SQLite only | `T-027` In Progress |
| Citizen OTP sign-up / sign-in (backend) | API-121 / API-122 with every server-side rule | `T-037`…`T-041` In Review |
| Citizen report pipeline (backend) | API-130…API-135, API-140, API-150, API-151 and five path-named routes. 1–3 photos, one optional video ≤ 60 s, voice or typed text rendered and confirmed, temporary data with cancellation and expiry, evidence sealed at submission, own reports with the uniform 404, the state machine with no skipped stage. Contract in `docs/api/CITIZEN_REPORTING_CONTRACT.md` (bodies PROPOSED) | `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061`, `T-122`…`T-125` In Review; `T-048`, `T-063` In Progress |
| Audit, log hygiene | Hash-chained audit trail; no OTP or number in logs; every log handler redacts credentials, idempotency keys, codes and numbers. Audit database role pending (PostgreSQL) | `T-029` In Progress, `T-030` In Review |
| Mobile skeleton | Expo SDK 57 / RN 0.86.3 / React 19.2.3 in `mobile/`. Config, lint, format and tests all pass. **The debug development build runs on an Android 16 emulator** and renders CIT-01 (`VAL-032`). Never run on a physical phone; no iOS build | `T-031` In Progress, `T-022` In Review |
| Local draft store | `mobile/src/storage/` is still the **encrypted store of 5 October**, which `DG-63` supersedes (`VAL-033`, `VAL-034` are its history). Being reworked into an app-private store without app encryption, with a 2-day lifetime and a one-time migration of the old data. No screen uses it yet | `T-047` In Progress; `T-128` Not Started; `T-046` Blocked (devices), re-scoped |
| API client | Transport classes, acting-role refusal, fail-closed unmatched requests, error catalogue, HTTPS-only release | `T-033` In Review |
| CIT-01…CIT-05 | Language, disclosure, three consents, number, OTP. Component-tested and contract-checked against the dev backend | `T-042`, `T-043` In Review |
| Sessions on the device | Tokens in secure storage only; sign-out; restore. One shared refresh on 401, then one retry; a failed refresh signs out with a plain notice on CIT-01. Contract-checked against the dev backend, including replay revocation | `T-044` In Review |
| i18n | ur/en parity tested. **Urdu is an unreviewed machine draft.** No font, no app-wide RTL | `T-032` In Progress, `T-045` |
| SMS | **Simulated** console adapter, development only. Nothing is sent | `DG-15` |
| AI rendering | **Simulated** adapter, development and test only. It does not listen to the recording; its text says it is simulated and every artefact is marked `simulated` | `DG-16`, `DG-48` |
| CI | GitHub Actions workflow for the backend, mobile and tracker checks. Read-only permissions, no secret. Run #1 passed all three jobs (`VAL-024`) | `T-034` In Review |

## Verified (2026-10-04)

| Check | Result |
|---|---|
| Tracker `--check` / `--validate`, tracker tests (16), import dry-run, `extract_requirements.py --check` | OK — 123 tasks, 57 decisions, 27 checks; FR 124, NFR 86, SC 12 against SRS v2.2.0 (`VAL-028`, `VAL-029`) |
| CI on GitHub | Run #1 (commit `4149022`): backend, mobile and tracker jobs passed (`VAL-024`) |
| `backend/.venv/bin/python backend/manage.py test parakh` | **154 tests, OK**; 23 integrity mutations in total, each caught (`VAL-025`, `VAL-026`, `VAL-031`). The review's three 500s were reproduced and fixed |
| Production start-up, by real process start-up | Refuses unset or development-only SMS, evidence-store and AI adapters; with all named, stops only at the missing PostgreSQL driver. `manage.py check`: no issues (`VAL-027`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · Jest 60 passed, 2 opt-in skipped (`VAL-021`) |
| Live contract check against the dev backend (refresh, replay) | 2 passed (`VAL-022`) |
| **Device testing** | **None on a phone.** An Android 16 **emulator** run exists (see below); every other result is automated: the Django test client, Jest with mocked or simulated native modules, the contract check from Node, and CI |
| Secret, private-path and personal-data scan of the uploaded files; remote refs | 0 keys, tokens, credentials or home paths; e-mails only npm package metadata; numbers only synthetic fixtures. Remote: only `main` = `41045466`, `HEAD` → `main` (`VAL-020`) |

## Verified (2026-10-05)

| Check | Result |
|---|---|
| First Android development build | `assembleDebug` (x86_64) **BUILD SUCCESSFUL** after five failures, each explained and fixed (`VAL-032`) |
| Emulator run (Android 16, API 36, x86_64, 4 KB pages) | Installs, starts with the New Architecture, renders CIT-01 (`VAL-032`) |
| Storage self-check on the emulator | SQLCipher 4.7.0 community; database file without header or schema text, entropy 7.995 bits/byte, stock `sqlite3` cannot read it; key Keystore-wrapped; media ciphertext only; missing key fails closed with the file unchanged and no new key (`VAL-034`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · **Jest 104 passed**, 2 opt-in skipped; storage suite 44 tests on a **simulated** cipher; 20 mutations, 19 caught, 1 equivalent (`VAL-033`) |
| Review findings R-005, R-006 | Reproduced on the unchanged sources, then fixed; the regressions assert recovery and decryptable evidence (`VAL-033`) |
| Backend suite and live contract | 154 tests OK; live contract 2 passed, including the new `account_id` in API-155 (`VAL-035`) |

## Unresolved

| Item | ID |
|---|---|
| Ten citizen-auth implementation choices awaiting review | `DG-52` |
| Urdu reviewer (so `T-045` is Blocked); font and project licence | `DG-41`, `DG-44` |
| Target date and weekly hours | `DG-04`, `DG-38` |
| Flutter scaffold removal | `DG-03` |
| Idempotency headers; OTP numbers; consent sign-off | `DG-10`, `DG-13`, `DG-12` |
| Expiry of abandoned temporary data on the server — 72 h proposed | `DG-57` |
| GitHub requires two-factor authentication on the account before 10 Nov 2026 (banner seen 2026-10-04). Only Hassan can enable it | — |
| No SMS or AI provider | `DG-15`, `DG-16` |
| Android toolchain installed 2026-10-04 with Hassan's approval; emulator and first build 2026-10-05. Still missing: a **physical Android device** (`T-021`), a 16 KB page-size check, PostgreSQL/PostGIS + `psycopg`, Redis, Xcode. `T-046` (SQLCipher on real devices) stays Blocked | ENVIRONMENT_CHECK, `T-021`, `T-046` |
| Plaintext capture cache file before encryption (proposed reading of DR-23 rule 7); iOS backup exclusion; what the citizen can do when local drafts cannot be opened | `DG-58`, `DG-59`, `DG-60` |
| About 6 GiB disk free; swap shares the disk. Run the emulator and Gradle one at a time | ENVIRONMENT_CHECK |
| Staff-reporter confirmation path blocked | `DG-20`, `DG-21` |

## Next concrete action

`T-049` live capture (1–3 photos, optional video up to 60 s) writing into the encrypted store, then `T-050` voice and typed text, `T-051` location and `T-052` the draft queue (see `NEXT_TASK.md`). `DG-58` and `DG-60` would be useful before `T-049`.
