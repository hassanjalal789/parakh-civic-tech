# Draft store verification — the store of the 6 October decisions

**Status: open.** Emulator evidence was collected on 2026-10-07. **An emulator is not a device.** `T-046` requires a physical Android 7+ device, a physical iOS 16.4 device and a 16 KB memory-page check; none of these has been done. *(2026-10-09)* A physical Android phone is now set up with the app installed (Samsung SM-A546E, Android 16, `VAL-048`); its checks passed the same day (`VAL-054`–`VAL-056`, `VAL-058`; [`PHYSICAL_ANDROID_TESTING.md`](PHYSICAL_ANDROID_TESTING.md) §11). It has 4 KB pages, so it does not cover the 16 KB check.

| Field | Value |
|---|---|
| Tasks | `T-047` (the store), `T-128` (the one-time move of the 5 October drafts), `T-046` (device verification) |
| Decisions | `DG-63` (no app encryption for drafts and their media; the captured file is used directly), `DG-64` (2-day lifetime) — Hassan Jalal, 2026-10-06. `DG-67` (a pending submission is deleted 48 hours after Submit), `DG-59` (no backups) — Hassan Jalal, 2026-10-07 |
| Requirements | Mobile SRS v2.3.0 §3.6.3, §3.6.4; `NFR-48`; `SC-10` as amended; `FR-COMMON.12`, `FR-COMMON.13`, `FR-COMMON.25` |
| Replaces | Nothing. [`DEP-08_SQLCIPHER_VERIFICATION.md`](DEP-08_SQLCIPHER_VERIFICATION.md) stays as the history of the encrypted store |

## 1. What has to be shown

| # | Obligation | Source |
|---|---|---|
| 1 | The draft database is app-private and **not encrypted by the app** | `DG-63`, SRS §3.6.3 |
| 2 | A capture file is the evidence itself: moved into app-private storage, never copied, re-encoded or encrypted | `DG-63` |
| 3 | `expires_at = created_at + 48 h`, fixed at creation; editing never changes it; an expired unsubmitted draft and its media are deleted | `DG-64`, SRS §3.6.4 |
| 4 | Another account on the phone sees none of a draft | `FR-COMMON.25` |
| 5 | Drafts of the 5 October encrypted store move once; the old database, media and key are removed only after the copy is recorded; a store whose key cannot be read is left untouched | SRS §3.6.3 "Transition", `T-128` |

## 2. Emulator run, 2026-10-07

### 2.1 Environment

| Item | Value |
|---|---|
| Host | macOS 15.8.1, x86_64 |
| App | The debug APK built on 2026-10-05 (Expo SDK 57.0.26, React Native 0.86.3, `expo-sqlite` 57.0.3 built with SQLCipher, `expo-file-system` 57.0.7, `expo-secure-store` 57.0.4). **This checkpoint changed JavaScript only**; Metro served it from the working tree. No native module was added |
| Emulator | AVD `Parakh_API36`: Android 16 (API 36), `google_apis`, x86_64, **4 KB pages** |
| Data | Synthetic only. The 5 October store on the emulator held its schema and no draft |

### 2.2 Procedure

1. Start the emulator and Metro (`CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npx expo start --port 8081`), then `adb reverse tcp:8081 tcp:8081`.
2. Record the app's files with `adb exec-out run-as io.github.hassanjalal789.parakh …`: names, sizes, the first 16 bytes of each database, and whether the old key's entry exists in `shared_prefs/SecureStore.xml`. **The key's value was not read.**
3. Open `parakh://dev-storage-check`. The first launch showed *Unable to load script*: the app had started before it reached Metro. After a force-stop, the second launch loaded the bundle (1,532 modules).
4. Record the files again.
5. Force-stop and open the self-check a second time.
6. Copy the new database to the host, read it with the stock `/usr/bin/sqlite3`, then delete the copy.

### 2.3 Results

| Check | Before | After |
|---|---|---|
| Old database `files/SQLite/parakh-local.db` | 36,864 bytes; first 16 bytes random, not `SQLite format 3\0` (SHA-256 `335bb6ab…`) | **Gone** |
| Old key entry `parakh.local.db_key` in secure storage | Present | **Gone** |
| Old media `files/parakh-media/` | Empty folder | Empty folder (it held no file; the folder itself is left) |
| New database `files/SQLite/parakh-drafts.db` | Absent | 49,152 bytes; **first 16 bytes `SQLite format 3\0`** — plain SQLite, no application key |
| New database read on the host by stock `sqlite3`, with no key | — | Tables `drafts`, `evidence`, `legacy_migration`, `schema_version`, `server_cancellations`; schema version 1; **0** drafts, **0** evidence rows, **0** cancellation notes; migration marker `0 · 0 · 0` (drafts · media · unreadable) |
| New media folder `files/parakh-drafts-media/` | Absent | Empty: the self-check removed its synthetic photo |
| Self-check leftovers in the cache | — | None |

Self-check screen, first run:

| Line | Result |
|---|---|
| 5 October encrypted store | **moved 0 draft(s), 0 item(s); 0 unreadable** — the real SQLCipher store was opened with its key and read, then removed |
| Draft database is plain SQLite (no app key) | yes |
| Capture file moved, not copied | yes — the cache file is gone, the drafts folder gained exactly one file |
| Stored photo is the captured bytes | yes |
| Lifetime is `created_at + 48 h` and editing keeps it | yes |
| Expired draft and its file deleted | yes — a synthetic draft back-dated by 48 h and 1 s |
| Another account sees none of it | yes |
| Synthetic data removed | yes |
| **Result** | **PASS** |

Second run: *5 October encrypted store: none found*; every other line `yes`; **PASS**.

Screenshots: [`evidence/2026-10-07-android-emulator/`](evidence/2026-10-07-android-emulator/) — `draft-store-self-check-first-run.png`, `draft-store-self-check-second-run.png`.

### 2.4 What this run does not show

- **No draft of the 5 October build was moved on the emulator**, because none existed. Moving drafts and media, an unreadable key, an interrupted move and an item that fails its integrity check are covered by Jest only (`__tests__/legacyMigration.test.ts`), where SQLCipher is **simulated** and AES-256-GCM is Node's.
- The lifetime was exercised with a **back-dated** draft, not by waiting 48 hours. The app deletes an expired draft only while it runs: on opening the store and on returning to the foreground.
- The submission queue did not run on the emulator. No reporting screen and no upload client exist yet; it is covered by Jest only (`__tests__/submission.test.ts`).
- Not a physical device, not iOS, and 4 KB pages only.

## 2b. Emulator run 2, 2026-10-07 — the build with the backup rules

### Environment and build

- **The same AVD.**
- **A new debug APK** built on 2026-10-07:
  - `assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64`, BUILD SUCCESSFUL in 13 min 54 s;
  - 165 MB, with native code for `arm64-v8a` (phones) and `x86_64` (emulator);
  - backend `http://127.0.0.1:8000` through `adb reverse`;
  - target SDK 36;
  - this checkpoint's JavaScript, served by Metro.
- **The app's data from run 1 was kept**, so the store opened a schema-version-1 database and migrated it to version 2.

### Results

| Check | Result |
|---|---|
| Package flags (`dumpsys package`) | `flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]` — **no `ALLOW_BACKUP`** |
| Manifest in the APK (`aapt2 dump xmltree`) | `allowBackup=false`; `dataExtractionRules` → `parakh_data_extraction_rules` (9 `exclude` under `cloud-backup` and 9 under `device-transfer`: `root`, `file`, `database`, `sharedpref`, `external` and the four `device_*` domains); `fullBackupContent` → `parakh_backup_rules` (the same 9) |
| Permissions in the APK (`aapt2 dump permissions`) | `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `WAKE_LOCK`, and the debug-only `SYSTEM_ALERT_WINDOW`. **No storage, photo or video permission; no background location** |
| Self-check | Every line *yes*, including the new *Pending submission kept 48 h from Submit, then deleted*; **RESULT: PASS** |

### The 48-hour rules with the clock moved

The procedure is [`PHYSICAL_ANDROID_TESTING.md`](PHYSICAL_ANDROID_TESTING.md) §7.4. On the emulator, the clock was set with `adb root` and `date`, with automatic time off.

| Device time (UTC) | Action | What the screen showed after a force-stop and reopen |
|---|---|---|
| 6 Oct 23:29 | Create a test draft | *Saved draft · created 2026-10-06T23:29:23Z · deleted at 2026-10-08T23:29:23Z · 1 file(s)* |
| 7 Oct 23:30 | Reopen; create a test pending submission | The draft still listed, its deadline unchanged; *Pending submission — not yet confirmed · deleted at 2026-10-09T23:32:16Z* (48 h from its Submit) |
| 8 Oct 23:35 | Reopen | *deleted 1 expired draft(s) and 0 unconfirmed pending submission(s)*; only the pending submission listed; one file left in `files/parakh-drafts-media` |
| 9 Oct 23:35 | Reopen | *deleted 0 expired draft(s) and 1 unconfirmed pending submission(s)*; *None on this phone*; **no file left** |

Afterwards the clock was set back to the Mac's time, automatic time was switched back on, and `adbd` was returned to non-root.

Screenshot: [`evidence/2026-10-07-android-emulator/retention-rules-after-moving-the-clock.png`](evidence/2026-10-07-android-emulator/retention-rules-after-moving-the-clock.png).

**Not explained:** on the first launch after installing this build, React Native's development overlay showed one warning, logged as `Error: undefined`. It did not appear again after a force-stop and relaunch, and its source was not identified.

## 3. Still required (`T-046`)

| # | Check | Needs |
|---|---|---|
| 1 | The self-check and the file checks above on a **physical Android 7+ device** (`arm64-v8a`) | **Done 2026-10-09** on a Samsung SM-A546E, Android 16 (`VAL-054`, `VAL-055`) |
| 2 | A move of real 5 October drafts, if any device still holds that store | Such a device — the test phone never held it (*none found*) |
| 3 | The same on **iOS 16.4**, with the drafts database and media excluded from iCloud backup | Xcode (`T-024`); `DG-59` |
| 4 | A draft that survives force-stop and restart within its lifetime, and is gone after it, on a device | **Done 2026-10-09 with synthetic test items** (`VAL-055`, `VAL-056`); with real drafts once the reporting screens exist (`T-049`…`T-052`) |
| 5 | The 16 KB memory-page case | A 16 KB device or emulator image |

## 4. Change log

| Date | Change |
|---|---|
| 2026-10-07 | Created with the first emulator run of the store of the 6 October decisions (`VAL-042`) |
| 2026-10-09 | The physical phone set up and the APK installed (`VAL-048`); later the same day its checks passed (`VAL-054`–`VAL-056`, `VAL-058`) |
| 2026-10-07 | Run 2: the build with the backup rules, and the 48-hour rules with the clock moved (`VAL-044`, `VAL-045`). A physical phone is now available; the procedure is `PHYSICAL_ANDROID_TESTING.md` |
