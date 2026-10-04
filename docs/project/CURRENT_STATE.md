# Current State

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after recording Hassan's decisions of 2026-10-04 and issuing Mobile SRS v2.2.0 (`T-121`) |
| Active working location | `PARAKH PROJECT/` on the Desktop — the only one. The Documents clone is an inactive backup |
| Branch | `main` — the only branch on GitHub |
| Last verified milestone | **M0 complete** (`VAL-010`). M2/M3 work is In Review or In Progress — see below |
| Current task | Hassan's decisions of 2026-10-04 are recorded and the SRS is re-issued as v2.2.0. The Android toolchain is installed. Next: bring the backend in line with the decisions (`T-122`…`T-125`), then the first Android build ([NEXT_TASK.md](NEXT_TASK.md)) |

## Repository

- **GitHub:** `hassanjalal789/parakh-civic-tech`, **private**, created on 2026-10-04 after Hassan deleted the earlier repository.
- **History:** starts from one initial commit. The earlier commit history is kept locally and is not published. Commit hashes quoted in older records refer to that local history.
- **Kept locally and git-ignored:**
  - `README_SETUP.md`, `SRS/SOURCE_IMPORT_MANIFEST.md` and the `SRS/` snapshot copies;
  - the two August planning documents (S-24, S-25);
  - `backend/.venv/`, `backend/.local/` and `mobile/node_modules/`.

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

Requirements now follow **Mobile SRS v2.2.0**; v2.1.0 is kept as the superseded baseline. **The backend and mobile code do not yet follow these decisions** — that is the next task.

## Implementation status

| Area | State | Tasks |
|---|---|---|
| Backend skeleton | Django 6.1.1 + DRF 3.18.1. Environment-driven settings, deny-by-default Bearer auth. SQLite only | `T-027` In Progress |
| Citizen OTP sign-up / sign-in (backend) | API-121 / API-122 with every server-side rule | `T-037`…`T-041` In Review |
| Citizen report pipeline (backend) | API-130…API-135, API-140, API-150, API-151 and four path-named routes: drafts, chunked evidence with server-recomputed hashes and magic-byte checks, write-once local store, versioned rendering and correction, confirmation of one exact version, one-transaction report creation, own reports with the uniform 404. Contract in `docs/api/CITIZEN_REPORTING_CONTRACT.md` (bodies PROPOSED) | `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061` In Review; `T-048`, `T-063` In Progress |
| Audit, log hygiene | Hash-chained audit trail; no OTP or number in logs; every log handler redacts credentials, idempotency keys, codes and numbers. Audit database role pending (PostgreSQL) | `T-029` In Progress, `T-030` In Review |
| Mobile skeleton | Expo SDK 57 / RN 0.86.3 / React 19.2.3 in `mobile/`. Config, lint, format and tests all pass. **Never run on a device** | `T-031` In Progress |
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
| Tracker `--check` / `--validate`, tracker tests (16), import dry-run, `extract_requirements.py --check` | OK — 118 tasks, 55 decisions, 24 checks; FR 124, NFR 86, SC 12. The workbook baseline is now split across cells (`VAL-028`) |
| CI on GitHub | Run #1 (commit `4149022`): backend, mobile and tracker jobs passed (`VAL-024`) |
| `backend/.venv/bin/python backend/manage.py test parakh` | 122 tests, OK; eleven integrity mutations each caught (`VAL-025`, `VAL-026`) |
| Production start-up, by real process start-up | Refuses unset or development-only SMS, evidence-store and AI adapters; with all named, stops only at the missing PostgreSQL driver. `manage.py check`: no issues (`VAL-027`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · Jest 60 passed, 2 opt-in skipped (`VAL-021`) |
| Live contract check against the dev backend (refresh, replay) | 2 passed (`VAL-022`) |
| **Device testing** | **None.** Every result above is automated: the Django test client, Jest with mocked native modules, the contract check from Node, and CI. Nothing has run on a phone or an emulator |
| Secret, private-path and personal-data scan of the uploaded files; remote refs | 0 keys, tokens, credentials or home paths; e-mails only npm package metadata; numbers only synthetic fixtures. Remote: only `main` = `41045466`, `HEAD` → `main` (`VAL-020`) |

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
| Android toolchain **installed 2026-10-04** with Hassan's approval (JDK 17, SDK platform 36, NDK, CMake, one x86_64 emulator image; licences already accepted on 12 Aug 2026). No emulator created and no build run yet. Still missing: a physical device, PostgreSQL/PostGIS + `psycopg`, Redis, Xcode. `T-046` (SQLCipher on real devices) stays Blocked until a real device is connected | ENVIRONMENT_CHECK, `T-022` |
| Staff-reporter confirmation path blocked | `DG-20`, `DG-21` |

## Next concrete action

`T-047` encrypted local drafts, then `T-052` the draft queue and `T-055` the resumable upload client (see `NEXT_TASK.md`).
