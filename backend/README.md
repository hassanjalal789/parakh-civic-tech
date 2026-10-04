# Parakh backend

Django 6.1.1 + Django REST Framework 3.18.1 on Python 3.14. This is the Release 0
prototype backend. **Development only** — nothing here is deployed.

What exists:

- citizen sign-up / sign-in by mobile number and SMS OTP, server-side sessions and the citizen's own profile;
- the citizen report pipeline — draft, chunked evidence upload with server-side hash, type and container checks,
  1–3 photos and an optional video of up to 60 s, a **SIMULATED** rendering of a recording or of typed text,
  correction, confirmation of one exact version, cancellation of temporary data, and report creation in one
  transaction that seals the evidence;
- the citizen's own reports, report detail and evidence playback;
- an append-only audit trail and the identity vault.

Staff authentication, the staff portals and every later module do not exist yet. The reporting
bodies are recorded in [`docs/api/CITIZEN_REPORTING_CONTRACT.md`](../docs/api/CITIZEN_REPORTING_CONTRACT.md).

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

### Simulated AI rendering

No AI provider is selected (DG-16). The only adapter, `SimulatedRenderingAdapter`, does **not** listen
to the recording. It returns fixed Urdu text that begins `[SIMULATED · نقلی متن]` and says it was not
produced from any voice; every artefact it makes is marked `simulated: true`. It loads only in
development and test, and production refuses to start with it. `PARAKH_SIMULATED_AI_OUTCOME`
(`complete`, `fail`, `review_required`) exercises the failure paths. Processing runs inline after
the commit; a queue worker replaces this with T-023.

### Evidence storage

Development keeps evidence in `backend/.local/evidence/` (git-ignored): received chunks in a
deletable staging area, assembled items in a write-once area that refuses to overwrite a key. Keys
are random and never contain an account id, number or name. Production refuses to start without a
write-once object store, which does not exist yet.

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
- evidence integrity: chunk, item and manifest hashes recomputed, magic bytes, write-once storage
- the rendering rules: AI-generated and SIMULATED labels, no ASR text to citizens, versioned correction
- confirmation: superseded version and hash mismatch refused with 409, idempotent replay
- report creation: confirmation required, one report per draft, replay returns the original
- own reports only, with the uniform 404
- photo bounds (1–3), the 60-second video limit and container track checks
- typed descriptions rendered and confirmed like voice
- cancellation and expiry of temporary data, and the race with a successful submission
- the report state machine: no verification stage can be skipped
- malformed input: wrong types, impossible dates and truncated media headers get a 400

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
| No real AI processing | No provider selected; the adapter is SIMULATED | DG-16 |
| Evidence on the local file system | No write-once object store yet | T-054, T-122 |
| Expiry of abandoned temporary data is a command, not a schedule | No queue worker yet; 72 h is a proposal | DG-57, T-023 |
| Uploads are JSON with base64 | About a third larger than raw bytes; a binary variant is planned | T-055 |
| AI processing runs inline | No queue worker (Celery/Redis) yet | T-023, T-056 |
| Reporting bodies and some error codes are proposed | The sources fix routes and rules, not bodies | T-036, [`docs/api/CITIZEN_REPORTING_CONTRACT.md`](../docs/api/CITIZEN_REPORTING_CONTRACT.md) |
