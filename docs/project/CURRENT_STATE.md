# Current State

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after the session-refresh and log-redaction checkpoint (`T-044`, `T-030`, `T-120`) |
| Active working location | `PARAKH PROJECT/` on the Desktop — the only one. The Documents clone is an inactive backup |
| Branch | `main` — the only branch on GitHub |
| Last verified milestone | **M0 complete** (`VAL-010`). M2/M3 work is In Review or In Progress — see below |
| Current task | Session refresh on the device (`T-044`) and log redaction (`T-030`) are built and tested. Next: CI, then the citizen report pipeline on the backend ([NEXT_TASK.md](NEXT_TASK.md)) |

## Repository

- **GitHub:** `hassanjalal789/parakh-civic-tech`, **private**, created on 2026-10-04 after Hassan deleted the earlier repository.
- **History:** starts from one initial commit. The earlier commit history is kept locally and is not published. Commit hashes quoted in older records refer to that local history.
- **Kept locally and git-ignored:**
  - `README_SETUP.md`, `SRS/SOURCE_IMPORT_MANIFEST.md` and the `SRS/` snapshot copies;
  - the two August planning documents (S-24, S-25);
  - `backend/.venv/`, `backend/.local/` and `mobile/node_modules/`.

## Implementation status

| Area | State | Tasks |
|---|---|---|
| Backend skeleton | Django 6.1.1 + DRF 3.18.1. Environment-driven settings, deny-by-default Bearer auth. SQLite only | `T-027` In Progress |
| Citizen OTP sign-up / sign-in (backend) | API-121 / API-122 with every server-side rule; 63 tests | `T-037`…`T-041` In Review |
| Audit, log hygiene | Hash-chained audit trail; no OTP or number in logs; every log handler redacts credentials, idempotency keys, codes and numbers. Audit database role pending (PostgreSQL) | `T-029` In Progress, `T-030` In Review |
| Mobile skeleton | Expo SDK 57 / RN 0.86.3 / React 19.2.3 in `mobile/`. Config, lint, format and tests all pass. **Never run on a device** | `T-031` In Progress |
| API client | Transport classes, acting-role refusal, fail-closed unmatched requests, error catalogue, HTTPS-only release | `T-033` In Review |
| CIT-01…CIT-05 | Language, disclosure, three consents, number, OTP. Component-tested and contract-checked against the dev backend | `T-042`, `T-043` In Review |
| Sessions on the device | Tokens in secure storage only; sign-out; restore. One shared refresh on 401, then one retry; a failed refresh signs out with a plain notice on CIT-01. Contract-checked against the dev backend, including replay revocation | `T-044` In Review |
| i18n | ur/en parity tested. **Urdu is an unreviewed machine draft.** No font, no app-wide RTL | `T-032` In Progress, `T-045` |
| SMS | **Simulated** console adapter, development only. Nothing is sent | `DG-15` |
| CI | GitHub Actions workflow for the backend, mobile and tracker checks. Read-only permissions, no secret. **First run: Pending until observed** | `T-034` In Progress |

## Verified (2026-10-04)

| Check | Result |
|---|---|
| Tracker `--check` / `--validate`, tracker tests (12), `extract_requirements.py --check` | OK — 118 tasks, 52 decisions, 19 checks; FR 124, NFR 86, SC 12 |
| `backend/.venv/bin/python backend/manage.py test parakh` | 69 tests, OK (`VAL-023`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · Jest 60 passed, 2 opt-in skipped (`VAL-021`) |
| Live contract check against the dev backend (refresh, replay) | 2 passed (`VAL-022`) |
| Secret, private-path and personal-data scan of the uploaded files; remote refs | 0 keys, tokens, credentials or home paths; e-mails only npm package metadata; numbers only synthetic fixtures. Remote: only `main` = `41045466`, `HEAD` → `main` (`VAL-020`) |

## Unresolved

| Item | ID |
|---|---|
| Ten citizen-auth implementation choices awaiting review | `DG-52` |
| Urdu reviewer; font and project licence | `DG-41`, `DG-44` |
| Target date and weekly hours | `DG-04`, `DG-38` |
| Flutter scaffold removal | `DG-03` |
| Idempotency headers; OTP numbers; retry window; consent sign-off | `DG-10`, `DG-13`, `DG-14`, `DG-12` |
| No SMS or AI provider | `DG-15`, `DG-16` |
| Toolchain not installed: JDK, Android SDK 36, a device, PostgreSQL/PostGIS + `psycopg`, Redis, Xcode. Android SDK needs about 12–15 GB (23 GB free) and acceptance of the SDK licence — asked 2026-10-04 | ENVIRONMENT_CHECK, `T-022` |
| Staff-reporter confirmation path blocked | `DG-20`, `DG-21` |

## Next concrete action

`T-034` CI, then `T-036` / `T-053`…`T-061` — the citizen report pipeline on the backend (see `NEXT_TASK.md`).
