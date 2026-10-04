# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after the mobile sign-in checkpoint (`T-031`, `T-033`, `T-042`, `T-043`) |
| Milestone | **M3** — finish citizen sessions on the device |
| Branch | `main` (verified checkpoints go to `main`) |

## The task: session refresh and expiry on the device — `T-044`

**Goal:** a signed-in citizen stays signed in across app restarts, and an expired session returns cleanly to sign-in.

1. **401 handling.** On `401 E_UNAUTHENTICATED` from a citizen route, the client calls `API-003` once with the refresh token from secure storage, then retries the original request once.
2. **Rotation.** A rotated pair replaces both stored tokens.
3. **Refresh failure.** On `E_REFRESH_INVALID`, or a second 401, the client:
   - clears the tokens;
   - sets the principal to signed out, so the gateway shows `CIT-04`;
   - keeps local drafts. None exist yet, so this is tested only as "nothing else is wiped".
4. **No caching.** No token is cached outside `expo-secure-store` (SRS §3.2.2, rule 6). Concurrent 401s share one refresh call.
5. **Tests.** Jest covers each path. The opt-in live contract test gains a refresh step against the dev backend.

**Rules:** follow the backend contract in `docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md`. Its §3 choices are PROPOSED (`DG-52`).

**Afterwards, in order:**

1. `T-030` — finish log redaction: a filter that redacts `Authorization` and `X-Idempotency-Key`, with a test.
2. `T-034` — CI for the backend, mobile and tracker checks. This adds a GitHub Actions workflow that runs on GitHub on every push. **Confirm with Hassan before adding it.**

## Still waiting for Hassan

| Item | Detail |
|---|---|
| `DG-52` | Review the ten citizen-auth implementation choices |
| `T-045` / `DG-41` | Name a reviewer for the Urdu text. It is an unreviewed machine draft |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10` | Idempotency headers (needed before `T-060`) |
| `DG-13` / `DG-14` | OTP numbers and the draft retry window. Proposed defaults are in use |
| `DG-12` | Formal sign-off of the consent mechanism |
| `DG-15` | SMS provider. Development uses the SIMULATED console adapter |
| `DG-44` | Urdu font and project licence |

**Permission to download:**
- `T-022` — JDK 17, Android SDK 36 and a device or emulator. This is needed for the first device run.
- `T-023` — PostgreSQL + PostGIS, Redis and `psycopg`.

## Verification

```bash
backend/.venv/bin/python backend/manage.py test parakh
```

```bash
cd mobile && npm run check
```

```bash
.venv/bin/python scripts/generate_tracker.py --check
```

```bash
.venv/bin/python -m unittest discover -s tests/tracking -v
```
