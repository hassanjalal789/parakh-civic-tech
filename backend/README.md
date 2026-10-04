# Parakh backend

Django 6.1.1 + Django REST Framework 3.18.1 on Python 3.14. This is the Release 0
prototype backend. **Development only** — nothing here is deployed.

What exists: citizen sign-up / sign-in by mobile number and SMS OTP, server-side
sessions, the citizen's own profile, an append-only audit trail and the identity
vault. Staff authentication, reporting and every other module do not exist yet.

## Run it locally

```bash
python3.14 -m venv backend/.venv
backend/.venv/bin/pip install --only-binary=:all: -r backend/requirements.txt
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

In development, missing keys are generated once into `backend/.local/dev-keys.json`
(git-ignored, mode 0600) and the database is `backend/.local/dev.sqlite3`.

### Simulated SMS

No SMS provider is selected (DG-15). In development the OTP is **not sent**. It is
printed to the server's console as:

```text
[SIMULATED SMS — development only, nothing was sent] citizen_signup_login code for +92 300 *** 4567: ######
```

This adapter loads only when `PARAKH_ENV=development`. Tests use an in-memory
outbox that loads only when `PARAKH_ENV=test`. With `PARAKH_ENV=production`, the
server refuses to start with either adapter, or with no SMS backend at all. Use
synthetic numbers only. Do not use a real citizen's number.

## Test

```bash
backend/.venv/bin/python backend/manage.py test parakh
```

The tests use synthetic numbers and a frozen clock. They cover:
- uniform responses
- expiry, single use, supersede on resend, five-attempt consumption and no account lock
- cooldown, plus the per-number, per-device and per-IP caps
- purpose binding
- server-held consent and tamper resistance
- abandoned onboarding
- refresh rotation and replay revocation
- logout and sign-out everywhere
- the masked-number profile
- no OTP or number in any log, output or audit row
- audit-chain tamper detection
- production start-up refusals

## Configuration

See [`.env.example`](.env.example). `PARAKH_ENV` is `development`, `test` or `production`.
`manage.py test` selects `test` automatically.

## Known limits (recorded, not hidden)

| Limit | Why | Task |
|---|---|---|
| SQLite instead of PostgreSQL + PostGIS | PostgreSQL is not installed on the development Mac (download go-ahead pending) | T-023, T-028 |
| Identity vault is a code boundary only | The separate schema and database role need PostgreSQL | T-028 |
| Audit trail is append-only in code only | The INSERT/SELECT-only database role needs PostgreSQL | T-029 |
| Rate-limit numbers are proposed defaults | FR-AUTH.8 and the API contract reserve them for Hassan | DG-13 |
| No real SMS delivery | No provider selected | DG-15 |
| `cryptography` pinned to 48.0.1 | Newest release with a prebuilt wheel for macOS x86_64 + CPython 3.14 | — |
| Implementation choices not fixed by the specifications | Error codes, body shapes, token lifetimes | DG-52, [`docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md`](../docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md) |
