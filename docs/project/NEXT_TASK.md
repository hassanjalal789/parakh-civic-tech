# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-04 (Asia/Karachi), after the backend citizen-report-pipeline checkpoint (`T-053`…`T-061`) |
| Milestone | **M4 → M6** — the citizen reporting flow on the device |
| Branch | `main` (verified checkpoints go to `main`) |

## The task: the mobile reporting flow, against the backend that now exists

**Goal:** a signed-in citizen can report an issue on the device. Each step stores data locally first:

category → live photos → voice (or typed fallback) → location → *waiting to send* → upload → **SIMULATED** rendering → review and correct → confirm → **received**, with the reference.

Build in this order:

1. **`T-047` — encrypted local storage.**
   - One `expo-sqlite` database with SQLCipher (`useSQLCipher: true`), holding drafts (`LDS-2`) and the pre-auth consent payload (`LDS-3`).
   - A 256-bit key from `expo-crypto`, held only in `expo-secure-store`. `PRAGMA key` is the first statement. If the key is missing, the client fails closed (`DR-23` rules 1–8).
   - Media (`LDS-4`) is encrypted before it is written.
   - Jest uses an in-memory fake behind the same interface. The real proof is a device test (`T-046`, `DEP-08`).
2. **`T-048` — screens.** CIT-06 tiles with counts from `GET /citizen/reports/summary`, and the CIT-07 category grid, which works offline.
3. **`T-049` / `T-050` / `T-051` — capture.**
   - Live camera only, with SHA-256 at capture.
   - Voice through `expo-audio`, with playback, re-record and the typed fallback.
   - Location with its accuracy. A manual pin moves by buttons and is marked unverified. No map provider is chosen (`DG-30`).
4. **`T-052` / `T-055` — the queue and the resumable upload.**
   - The pipeline state machine and the offline queue: foreground-first, backoff with a manual retry, and it survives a restart.
   - Chunked upload against `API-130`…`API-132`, resuming from `missing_chunks`.
   - The local copy is deleted only after server receipt.
5. **`T-058` / `T-062` — review and submit.**
   - Named processing states, the AI-generated and SIMULATED labels, and targeted questions for low-confidence fields.
   - CIT-11 confirm (`API-135`). A `409` means re-fetch, never a blind retry.
   - CIT-12 *Waiting to send*, with no reference.
   - CIT-13 *Received*, only after `API-140` succeeds.
6. **`T-063`** — CIT-14 My Reports (reports and unsent drafts kept distinct) and CIT-15 report detail.

**Rules:** follow `docs/api/CITIZEN_REPORTING_CONTRACT.md`. Its bodies are PROPOSED (`T-036`). The interim choices `DG-53` (typed text needs no rendering) and `DG-54` (no video) apply.

**Dependencies to install with `npx expo install`:** `expo-camera`, `expo-audio`, `expo-location`, `expo-file-system`, `@react-native-community/netinfo`.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| Android toolchain | About 12–15 GB of the 23 GB free, and acceptance of Google's Android SDK licence on Hassan's behalf (`T-022`). Without it, nothing has run on a device or emulator |
| GitHub account security | GitHub requires two-factor authentication on the account before 10 Nov 2026 |
| `DG-53` / `DG-54` / `DG-55` | Typed reports without a rendering; video evidence; cancelling a server-side draft |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `T-045` / `DG-41` | Name a reviewer for the Urdu text. It is an unreviewed machine draft |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10` | Idempotency headers. Both forms work today |
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
