# Current State

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), repository re-created (`T-120`) |
| Active working location | `PARAKH PROJECT/` on the Desktop — the only one. The Documents clone is an inactive backup |
| Branch | `main` — the only branch on GitHub |
| Last verified milestone | **M0 complete** (`VAL-010`). M2/M3 work is In Review or In Progress — see below |
| Current task | The GitHub repository was re-created and the project uploaded as its initial commit (`T-120`). Next: `T-044` session refresh/expiry ([NEXT_TASK.md](NEXT_TASK.md)) |

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
| Audit, log hygiene | Hash-chained audit trail; no OTP or number in logs. Database role and header-redaction filter pending | `T-029`, `T-030` In Progress |
| Mobile skeleton | Expo SDK 57 / RN 0.86.3 / React 19.2.3 in `mobile/`. Config, lint, format and tests all pass. **Never run on a device** | `T-031` In Progress |
| API client | Transport classes, acting-role refusal, fail-closed unmatched requests, error catalogue, HTTPS-only release | `T-033` In Review |
| CIT-01…CIT-05 | Language, disclosure, three consents, number, OTP. Component-tested and contract-checked against the dev backend | `T-042`, `T-043` In Review |
| Sessions on the device | Tokens in secure storage; sign-out; restore. Refresh-on-expiry pending | `T-044` In Progress |
| i18n | ur/en parity tested. **Urdu is an unreviewed machine draft.** No font, no app-wide RTL | `T-032` In Progress, `T-045` |
| SMS | **Simulated** console adapter, development only. Nothing is sent | `DG-15` |

## Verified before the upload (2026-10-04)

| Check | Result |
|---|---|
| Tracker `--check` / `--validate`, tracker tests (12), `extract_requirements.py --check` | OK — 118 tasks, 52 decisions, 15 checks; FR 124, NFR 86, SC 12 |
| `backend/.venv/bin/python backend/manage.py test parakh` | 63 tests, OK |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · Jest 52 passed, 1 opt-in skipped |
| Relative links; secret, private-path and personal-data scan of the uploaded files | Recorded with `T-120` at the next checkpoint |

## Unresolved

| Item | ID |
|---|---|
| Ten citizen-auth implementation choices awaiting review | `DG-52` |
| Urdu reviewer; font and project licence | `DG-41`, `DG-44` |
| Target date and weekly hours | `DG-04`, `DG-38` |
| Flutter scaffold removal | `DG-03` |
| Idempotency headers; OTP numbers; retry window; consent sign-off | `DG-10`, `DG-13`, `DG-14`, `DG-12` |
| No SMS or AI provider | `DG-15`, `DG-16` |
| Toolchain not installed: JDK, Android SDK 36, a device, PostgreSQL/PostGIS + `psycopg`, Redis, Xcode | ENVIRONMENT_CHECK |
| Staff-reporter confirmation path blocked | `DG-20`, `DG-21` |

## Next concrete action

`T-044` — refresh-on-401 with one retry, rotation stored, expired session back to `CIT-04` (see `NEXT_TASK.md`).
