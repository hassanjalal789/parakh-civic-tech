# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after the session-refresh and log-redaction checkpoint (`T-044`, `T-030`) |
| Milestone | **M2** (CI) → **M5/M6** — the citizen report pipeline on the backend |
| Branch | `main` (verified checkpoints go to `main`) |

## First: CI — `T-034`

A GitHub Actions workflow that runs, on every push and pull request:

- the backend tests (`manage.py test parakh`, SQLite);
- `npm run check` in `mobile/`;
- the tracker checks (`generate_tracker.py --check`, `extract_requirements.py --check`, tracker unit tests).

It needs no secret and deploys nothing.

## Then: the citizen report pipeline — `T-036`, `T-053`…`T-061`, `T-063`

**Goal:** a signed-in citizen's draft becomes a `CivicReport` only through the specified chain:

draft → evidence → manifest → **SIMULATED** rendering → confirmation of the exact version → report.

1. **`T-036`** — write the PROPOSED Phase 1 contract for the routes below. Bodies and error codes that no source fixes are marked PROPOSED. Routes without an API number are named by path (`DG-43`).
2. **`T-053`** — `API-130`: draft creation, idempotent on `client_submission_id`.
3. **`T-054`** — `API-131` / `API-132`: chunked evidence upload. The server recomputes SHA-256 (`E_CAPTURE_INTEGRITY`); the manifest completes the upload.
4. **`T-056`** — the processing pipeline with a development adapter that is **labelled SIMULATED** and refuses to load outside development and test (`DG-48`). AI failure keeps everything and creates no report (`FR-PUB.20`).
5. **`T-057`** — `API-133` poll, `API-134` active rendering `{artifact_id, rendering_version, rendering_content_hash, ai_generated}`, and versioned correction.
6. **`T-060`** — `API-135` confirmation. A superseded version or a hash mismatch returns `409` (`TEST-API-011`/`-012`).
7. **`T-061`** — `API-140`: report creation and `report_reference` in one transaction. A replayed idempotency key returns the original report (`TEST-DATA-025`). No route creates a report in any state but `SUBMITTED` (`TEST-API-015`). There is no `DRAFT` state (`TEST-DATA-021`).
8. **`T-063`** — `API-150` / `API-151`: My Reports and report detail. Uniform `404` for not-found and not-owned.

**Rules:**
- Photo optional (`DG-09`).
- Idempotency headers follow the `DG-10` proposal: two headers. The code accepts the single `X-Idempotency-Key` too, until Hassan decides.
- The retry window is a configurable default (`DG-14`).

## Still waiting for Hassan

| Item | Detail |
|---|---|
| Android toolchain | About 12–15 GB of the 23 GB free, and acceptance of Google's Android SDK licence on Hassan's behalf (`T-022`) |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `T-045` / `DG-41` | Name a reviewer for the Urdu text. It is an unreviewed machine draft |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10` | Idempotency headers |
| `DG-13` / `DG-14` | OTP numbers and the draft retry window. Proposed defaults are in use |
| `DG-12` | Formal sign-off of the consent mechanism |
| `DG-15` / `DG-16` | SMS and AI providers. Development uses SIMULATED adapters |
| `DG-30` | Map tiles and reverse geocoding for CIT-10, or approval of the GPS-and-buttons fallback |
| `DG-44` / `DG-47` | Urdu font and project licence; photo-count bounds |

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
