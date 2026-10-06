# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-06 (Asia/Karachi), after recording the decisions of 6 October and issuing Mobile SRS v2.3.0 (`T-126`) |
| Milestone | **M4/M5** — bring the code in line with the 6 October decisions, then the reporting flow |
| Branch | `main` (verified checkpoints go to `main`) |

## 1. Done: the decisions of 6 October are recorded

`DG-61`–`DG-65` are recorded as Hassan's decisions, and `DG-66` and `DG-67` are raised as proposals. Mobile SRS **v2.3.0** amends 16 requirements, with its change record; v2.2.0 is unchanged.

## 2. Next: the backend (`T-127`)

- Every rendering version holds the **transcription, the Urdu text and the English text** under one content hash. A typed text is kept verbatim.
- A correction never lets AI overwrite a text the reporter wrote or corrected. An AI re-derivation is a new version needing confirmation.
- API-135 names the reviewed texts. A report carries both languages.
- Server clean-up timing is decoupled from the 48-hour retry rule (`DG-57` stays proposed).

## 3. Then: the device (`T-047`, `T-128`, `T-052`)

- An app-private draft store **without app encryption**. Drafts are bound to the account. The media are the capture files themselves.
- `expires_at = created_at + 48 h` is fixed at creation, and the purge deletes unsubmitted drafts and their media.
- A one-time, crash-safe migration of the 5 October encrypted drafts. The old key is removed after the copy is verified.
- The submission engine:
  - submission only after Submit;
  - 48-hour retries with the same key;
  - a status check before a retry or a deletion;
  - cancellation;
  - no duplicates.
- Re-run the self-check on the emulator. The new database must start with the plaintext SQLite header, which proves there is no app encryption.

## 4. Afterwards

`T-049` capture (the captured file used directly; photos sized at capture) · `T-050` speech or typing · `T-051` location · `T-048` CIT-06/07 · `T-055` the upload client · review and confirm in both languages, received, My Reports.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| `DG-66` | Does amending `SC-10` (no app encryption for drafts) lapse the `DR-26` override? Recommendation: no — it is an amendment by the same authority |
| `DG-67` | How long to keep a submission still unconfirmed after its 48 hours |
| `DG-57` | The server clean-up period for abandoned temporary uploads (72 hours proposed, not approved) |
| GitHub account security | Two-factor authentication before 10 Nov 2026 (his action) |
| `DG-41` | Name the Urdu-text reviewer |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10`, `DG-12`, `DG-13` | Idempotency headers; consent sign-off; OTP numbers |
| `DG-15` / `DG-16` | SMS and AI providers (SIMULATED adapters in development) |
| `DG-30`, `DG-44` | Map tiles or the GPS-and-buttons fallback; Urdu font and licence |
| A physical Android device and Xcode | For `T-046`, `T-031` and iOS (`DG-59`) |

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
