# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-09 (Asia/Karachi), after the physical phone was set up and the app installed (`T-046`, `VAL-048`) |
| Milestone | **M4/M5** — the reporting flow on the device |
| Branch | `main` (verified checkpoints go to `main`) |

## 1. Done: the decisions of 6 October are recorded

`DG-61`–`DG-65` are recorded as Hassan's decisions, and `DG-66` and `DG-67` are raised as proposals (`DG-67` was decided on 2026-10-07). Mobile SRS **v2.3.0** amends 16 requirements, with its change record; v2.2.0 is unchanged.

## 2. Done: the backend (`T-127`, In Review, `VAL-037`)

- Every rendering version holds the **transcription, the Urdu text and the English text** under one content hash. A typed text is kept verbatim.
- A correction never lets AI overwrite a text the reporter wrote or corrected. An AI re-derivation is a new version needing confirmation.
- API-135 names the reviewed texts. A report carries both languages.
- Server clean-up timing is decoupled from the 48-hour retry rule (`DG-57`; its 72 hours were approved on 2026-10-07).

## 3. Done: the device (`T-047`, `T-128` In Review; `T-052` In Progress)

- **Draft store** (`mobile/src/storage/`): plain app-private SQLite with no key; drafts bound to the account; the capture file moved into the drafts folder, never copied; `expires_at = created_at + 48 h` fixed at creation; expired drafts deleted with their files when the store opens and on every return to the foreground; crash recovery for a capture cut short.
- **One-time move** of the 5 October encrypted drafts (`mobile/src/storage/legacy/`), keeping `created_at`. The old database, media and key are removed only after the copy is recorded. A store whose key cannot be read is left untouched.
- **Submission queue** (`mobile/src/services/submissionQueue.ts`):
  - Submit only, recorded before the first request;
  - a status check after a lost response, then a replay with the same key;
  - 48 hours of retries with backoff, then *not confirmed*;
  - cancellation that deletes only on the server's answer;
  - no duplicates; one account per queue.
- **Checks:** Jest 171 passed; 51 mutations, 49 caught and 2 equivalent; the emulator self-check passed twice, with the real 5 October store moved and the new database plain (`VAL-039`–`VAL-042`).

## 3b. Done: the decisions of 7 October (`DG-57`, `DG-59`, `DG-67`)

- **Mobile SRS v2.4.0** with its change record. It flags the contradictions the decisions resolve: `DG-14`/`FR-PUB.28` *keep the draft*, `FR-COMMON.12` *delete only after receipt*, and `DG-65` *check before deleting*.
- **Device:**
  - a pending submission is deleted 48 hours after the first press of Submit, after a last status check where the server can be reached;
  - it is shown apart from saved drafts;
  - no Parakh data goes into Android backups or transfers;
  - session tokens are this-device-only.
- **Backend:** 72 hours without activity, approved; the start and end of a processing job count as activity.
- **For Hassan:** the phone procedure ([`docs/testing/PHYSICAL_ANDROID_TESTING.md`](../testing/PHYSICAL_ANDROID_TESTING.md)).
- **`DR-26` decided** after the [review](../planning/DR-26_REVIEW.md): it remains in force; the `SC-10` amendment is owner-approved for citizen-side drafts and pending submissions (`DG-66`, SRS v2.5.0). Staff and administrative data at rest: `DG-68`, open.

## 3c. In progress: the phone run (`T-046`)

- **Done 2026-10-09 (`VAL-048`):** Samsung SM-A546E, Android 16 (API 36), `arm64-v8a`; adb over USB; the 7 October debug APK installed, identical on the phone to the build output.
- **4 KB pages:** this phone does not cover the 16 KB page-size check, which stays pending for a 16 KB device or emulator image.
- **Next, with Hassan, one test at a time:** first launch through Metro (§6), then §7.1–§7.7. Results go into the procedure's §11 table.

## 4. Next: the reporting flow

1. **`T-049` live capture.** 1–3 photos and an optional video of up to 60 s, through `ingestCapture`, with photos sized by the camera settings (no second copy, `NFR-8`).
2. **`T-050` speech or typing**, the recording written by the recorder and adopted the same way.
3. **`T-051` location.**
4. **`T-055` the upload client** (API-131/132), so a draft can reach READY_TO_SUBMIT.
5. **Wire it into the app.** Open the store and start the submission queue for the signed-in citizen (CIT-12), and show the review and confirmation in both languages.

Then `T-048` CIT-06/07, received, and My Reports.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| **Phone run** | Set up and installed (2026-10-09). Next: the first-launch test (§6), then §7.1–§7.7 of `docs/testing/PHYSICAL_ANDROID_TESTING.md`, one at a time. Only Hassan has the phone |
| 16 KB pages | The phone has 4 KB pages. The 16 KB page-size check needs a 16 KB device, or a 16 KB emulator image (a download, so Hassan's go-ahead first) |
| `DG-68` | How staff, Union Council, contractor, Mayor and administrative data may be stored at rest on the device. **Needed only before such data is stored locally** (first case: `STF-10`, `T-090`) |
| GitHub account security | Two-factor authentication before 10 Nov 2026 (his action) |
| `DG-41` | Name the Urdu-text reviewer |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10`, `DG-12`, `DG-13` | Idempotency headers; consent sign-off; OTP numbers |
| `DG-15` / `DG-16` | SMS and AI providers (SIMULATED adapters in development) |
| `DG-30`, `DG-44` | Map tiles or the GPS-and-buttons fallback; Urdu font and licence |
| Xcode | For iOS: `T-024`, the iOS half of `DG-59` and `T-046` |

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
