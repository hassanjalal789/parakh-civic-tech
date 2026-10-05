# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-05 (Asia/Karachi), after the first Android build and emulator run and the encrypted local store (`T-022`, `T-031`, `T-047`) |
| Milestone | **M4** — the citizen reporting flow on the device |
| Branch | `main` (verified checkpoints go to `main`) |

## 1. Done: first Android build and the encrypted store

- The debug development build runs on the Android 16 emulator (`VAL-032`). `T-022` is In Review; `T-031` still needs a physical device.
- `T-047` (the encrypted store) is In Review: 44 storage tests on a simulated cipher (`VAL-033`) and the native self-check on the emulator (`VAL-034`). Review findings R-005 and R-006 are fixed with regressions.
- `T-046` (`DEP-08`) stays Blocked: an emulator is not a device. The record is `docs/testing/DEP-08_SQLCIPHER_VERIFICATION.md`.

## 2. Next: capture into the encrypted store (`T-049`)

- CIT-08 with `expo-camera`: 1–3 live photos (`DG-47`) and one optional live video of up to 60 s (`maxDuration` 60, 720p, H.264/AAC, at most 40 MiB; `DG-54`). No gallery or file picker; ESLint refuses them.
- Each capture goes through `ingestCapture` (hash at capture, encrypt, verify, record, then delete the plaintext cache file).
- Retake removes the item while the draft is local. Permission denial shows an explanation and a way to recover.
- Cache files left by a crash: decide the handling together with `DG-58`.

## 3. Then

`T-050` voice recording and the typed fallback (rendered and confirmed, `DG-53`) · `T-051` location with a manual pin · `T-048` CIT-06 tiles and the CIT-07 grid · `T-052` the queue (48-hour retry window, Cancel) · `T-055` the upload client · review, confirm, received, My Reports.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| `DG-58` | Accept the plaintext capture cache file as DR-23 rule 7's reading for the stock camera and recorder (encrypted and deleted at once) |
| `DG-60` | May a device whose local drafts cannot be opened offer a confirmed reset of those unreadable files? |
| `DG-57` | Confirm 72 hours for deleting abandoned temporary uploads |
| GitHub account security | Two-factor authentication before 10 Nov 2026 (his action) |
| `DG-41` | Name the Urdu-text reviewer |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10`, `DG-12`, `DG-13` | Idempotency headers; consent sign-off; OTP numbers |
| `DG-15` / `DG-16` | SMS and AI providers (SIMULATED adapters in development) |
| `DG-30`, `DG-44` | Map tiles or the GPS-and-buttons fallback; Urdu font and licence |
| A physical Android device and Xcode | For `DEP-08` / `T-046`, `T-031` and iOS (`DG-59`) |

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
