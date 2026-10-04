# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after recording Hassan's decisions of 2026-10-04 (`T-121`) |
| Milestone | **M5** (backend in line with the decisions) → **M2/M4** (first Android build, then the mobile flow) |
| Branch | `main` (verified checkpoints go to `main`) |

## 1. Bring the backend in line with the decisions

| Task | What |
|---|---|
| `T-122` | Temporary processing data lifecycle, as reconciled in `docs/planning/TEMPORARY_DATA_LIFECYCLE.md`. Processing and sealed storage areas; sealing in the API-140 transaction; `DELETE /citizen/drafts/{id}` with the race rule; expiry of abandoned data (`DG-57`, proposed 72 h) |
| `T-123` | Video evidence: one per report, at most 60 s, parsed from the MP4/QuickTime header; a video track required; at most 40 MiB |
| `DG-47` | 1–3 photos per report. Fewer gets `422 E_EVIDENCE_REQUIRED`; more gets `400`. Checked at API-132 and again at API-140 |
| `T-124` | Typed descriptions get a SIMULATED Urdu rendering and need the reporter's confirmation, like voice |
| `T-125` | The CivicReport transition table of SRS §6.2.8, so no verification stage can be skipped |

## 2. First Android build (`T-022`, `T-031`)

- Create one emulator (API 36, Google APIs, x86_64) with a small data partition. Disk is 13 GiB free.
- Generate the native project with `npx expo prebuild`, build a development build and install it on the emulator.
- An emulator run is **not** device testing, and it does not discharge `DEP-08`.

## 3. The mobile reporting flow

As planned before: `T-047` encrypted storage, then capture (1–3 photos, optional video up to 60 s, voice or typed), the queue with the 48-hour retry window and Cancel, review and confirm, received, and My Reports.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| `DG-57` | Confirm 72 hours for deleting abandoned temporary uploads |
| GitHub account security | Two-factor authentication before 10 Nov 2026 (his action) |
| `DG-41` | Name the Urdu-text reviewer |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10`, `DG-12`, `DG-13` | Idempotency headers; consent sign-off; OTP numbers |
| `DG-15` / `DG-16` | SMS and AI providers (SIMULATED adapters in development) |
| `DG-30`, `DG-44` | Map tiles or the GPS-and-buttons fallback; Urdu font and licence |
| A physical Android device and Xcode | For `DEP-08` / `T-046` and iOS |

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
