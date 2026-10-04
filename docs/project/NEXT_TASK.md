# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after the backend follows the decisions (`T-122`…`T-125`) |
| Milestone | **M2/M4** — first Android build, then the mobile reporting flow |
| Branch | `main` (verified checkpoints go to `main`) |

## 1. Done: the backend follows the decisions

`T-122`…`T-125` are In Review (`VAL-031`, 154 tests). The review findings are fixed.

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
