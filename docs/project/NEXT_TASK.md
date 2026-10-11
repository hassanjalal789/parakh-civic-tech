# Next Task

| Field | Value |
|---|---|
| Updated | 2026-10-11 (Asia/Karachi), after CIT-07 and the Home Report tile were built (`T-048`, `VAL-085`); the CIT-09 and CIT-10 phone tests run after 20:57 PKT |
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

## 3c. Done: the first Android round of the phone run (`T-046`)

- **Done 2026-10-09 (`VAL-048`):** Samsung SM-A546E, Android 16 (API 36), `arm64-v8a`; adb over USB; the 7 October debug APK installed, identical on the phone to the build output.
- **4 KB pages:** this phone does not cover the 16 KB page-size check, which stays pending for a 16 KB device or emulator image.
- **First launch passed (`VAL-049`)**: CIT-01 through Metro, no crash or JavaScript error. `T-031` is now In Review.
- **§7.1 and §7.2 passed (`VAL-050`, `VAL-052`).** Finding F-1 (the chosen language was lost on restart) is fixed and re-tested on the phone (`VAL-051`, `VAL-053`); `T-042` is back In Review.
- **§7.3 self-check and §7.4 48-hour rules passed (`VAL-054`, `VAL-055`).**
- **§7.5 restart and §7.6 permissions passed (`VAL-056`, `VAL-057`).**
- **§7.7 backups passed (`VAL-058`)**: Parakh is not in the phone's Google backup. **§1–§7 are all done.**
- `T-046` stays In Progress for the 16 KB check and iOS. Results go into the procedure's §11 table.

## 3d. Built: `T-049` CIT-08 live capture (Jest, `VAL-060`) and the test-number safeguard (`DG-70`, `VAL-059`)

- **Phone test done** (`docs/testing/PHYSICAL_ANDROID_TESTING.md` §8.1): every step passed (`VAL-061`–`VAL-070`) after fixes F-2 (video bitrate) and F-3 (permissions after Settings). `T-049` is In Review.
- **Phone, 2026-10-10:** steps 1–2 passed (`VAL-061`); step 3 found F-2 — a video stopped at 26 s — fixed with a proposed 4.5 Mbit/s bitrate and re-tested: a 60-second video, 34.36 MiB (`VAL-063`, `VAL-064`). Next: steps 4–7.
- `DG-71` and `DG-72` decided on 2026-10-11 (a video includes sound; the capture settings kept).

## 3e. Built: `T-050` CIT-09 speak or type (Jest, `VAL-073`)

- **Speak** and **Type** are equal choices, and neither is selected when a draft is new. There is no language picker.
- The microphone is explained before Android asks. If it is refused, typing stays available, with the way to allow it.
- **The recording** is the recorder's own file: hashed, moved into the draft and never copied. Its length is read from the file. It can be played, paused, recorded again and deleted.
- **Typed text** is kept exactly as written, up to 4,000 characters.
- Switching between speaking and typing deletes nothing without the citizen's confirmation.
- **Found and fixed:** CIT-08 listed every item in the draft, so a recording would have shown there as a video. It now lists only photos and the video.
- **`DG-74`, decided by Hassan on 2026-10-11:** AAC, one channel, 64 kbit/s, and a **hard maximum of 3 minutes**. The recorder stops itself at 3 minutes. A longer recording is refused on the phone and by the server (`VAL-074`).
- **Not part of `T-050`:** upload (`T-055`), the server's Urdu and English text (`T-127`), and the processing states (`T-058`).

## 3f. Built: `T-055` the resumable upload client (Jest, `VAL-075`)

- `mobile/src/services/evidenceUpload.ts`, with API-131, API-132 and API-133 in `src/api/reporting.ts`.
- Every kept file is re-hashed first. If one no longer matches its hash at capture, nothing is sent.
- Chunks of 256 KiB are sent in order. After an interruption the client asks the server how many chunks it holds and continues from there. Nothing about the upload is stored on the phone.
- A chunk the server reports as damaged is sent again, up to three times. An item that fails reassembly, or chunks still missing at completion, get one more round.
- **Not wired to any screen; nothing starts on its own.** It has not been run against the real backend or on the phone: a draft must first be opened on the server (API-130), which needs a category (`T-048`, `DG-43` open) and a location (`T-051`, `DG-73` open).

## 3g. Done: the later decisions of 11 October (`DG-73`–`DG-76`)

- **`DG-73` (location):** current GPS, else the last known position, else a written description, with no pilot-area coordinate. The measured position is kept beside any adjustment (M3), and there is no map or address lookup.
  - Design and checks: [`DG-73_LOCATION_DATA_DESIGN.md`](../planning/DG-73_LOCATION_DATA_DESIGN.md).
  - Built: the server model, migrations, validation and serialization; the API contract; the phone's migration 3 and `setLocation` (`VAL-077`).
  - `T-051` is unblocked; its CIT-10 screen remains.
- **`DG-75`:** the server accepts MPEG-4 recordings only.
- **`DG-76`:** typed text, the typed transcription and the reporter's corrections are stored exactly as written (`VAL-078`).
- **Mobile SRS v2.7.0** (`VAL-076`):
  - `FR-PUB.24` restated, with its v2.6.0 wording quoted;
  - the map, dragging and `GET /geo/reverse` struck through;
  - `DG-74`–`DG-76` recorded as notes;
  - `TBD-M18` resolved and `TBD-M19` opened.
- **A contradiction reported, not overridden:** `NFR-28` (voice and camera alone) against the written description (`DG-77`).

## 4. Next: the reporting flow

1. **`T-049` live capture** — done, In Review.
2. **`T-050` speech or typing** — built, In Progress.
   **Next: its phone test**, [`PHYSICAL_ANDROID_TESTING.md`](../testing/PHYSICAL_ANDROID_TESTING.md) §8.2 steps 1–9, **after 20:57 PKT on 11 Oct**. By then the `T-049` test draft has expired; Hassan chose to keep it unchanged. A new draft needs one photo first. Restart Metro before the test, so the phone loads the newest code.
3. **`T-051` location** — the data model (`VAL-077`) and **the CIT-10 screen are built** (`VAL-079`; the location by voice, 5 m steps and the device's accuracy, `VAL-080`): GPS with accuracy, the last known position, a written description, directional buttons that keep the measurement. **Next: its phone test**, §8.2b, right after §8.2 on the same new draft.
4. **`T-055` the upload client** (API-131/132) — built, In Progress (`VAL-075`). Its live and phone checks need API-130, so they wait for a category and a location.
5. **Wire it into the app.** Open the store and start the submission queue for the signed-in citizen (CIT-12), and show the review and confirmation in both languages.

Then `T-048` CIT-06/07, received, and My Reports.

## Still waiting for Hassan

| Item | Detail |
|---|---|
| **Phone run** | §1–§7 done on 2026-10-09. The §8 tests follow each reporting screen (`T-049` onwards) |
| 16 KB pages | The phone has 4 KB pages. The 16 KB page-size check needs a 16 KB device, or a 16 KB emulator image (a download, so Hassan's go-ahead first) |
| `DG-68` | How staff, Union Council, contractor, Mayor and administrative data may be stored at rest on the device. **Needed only before such data is stored locally** (first case: `STF-10`, `T-090`) |
| GitHub account security | Two-factor authentication before 10 Nov 2026 (his action) |
| `DG-69` | Whether the CIT-02 disclosure (`FR-AUTH.2`) should also mention typing and the English text (`DG-61`/`DG-62`) |
| `DG-41` | Name the Urdu-text reviewer |
| `DG-52` | Review the ten citizen-auth implementation choices |
| `DG-04` / `DG-38` | Target date and weekly hours |
| `DG-03` | Remove the Flutter scaffold (`apps/citizen`) |
| `DG-10`, `DG-12`, `DG-13` | Idempotency headers; consent sign-off; OTP numbers |
| `DG-15` / `DG-16` | SMS and AI providers (SIMULATED adapters in development) |
| `DG-44` | Urdu font and licence (`DG-30` decided 2026-10-11) |
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
