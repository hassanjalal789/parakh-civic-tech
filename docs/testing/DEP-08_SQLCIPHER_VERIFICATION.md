# DEP-08 — SQLCipher and key-custody verification

**Status: open.** Emulator evidence was collected on 2026-10-05. **An emulator is not a device.** DEP-08 requires a real Android 7+ device, a real iOS 16.4 device and a 16 KB memory-page check before Phase 1 exit (`G3`). None of these has been done.

Task: `T-046` (verification) and `T-047` (the store it verifies). Decision: `DR-23` (SRS v2.2.0 §3.6.3.1). Gap register: `DG-39`.

## 1. What DEP-08 requires

| # | Obligation | Source |
|---|---|---|
| 1 | The encrypted database opens with `PRAGMA key` on a real Android 7+ device and a real iOS 16.4 device | DR-23 (a), `T-046` |
| 2 | The file is unreadable without the key | `T-046` |
| 3 | A missing or unreadable key fails closed: no new key, no unencrypted open, a plain message | DR-23 rule 8 |
| 4 | The known Android 16 KB memory-page issue (`expo/expo#39792`) is checked | DR-23 (b), R-19 |

## 2. Emulator run, 2026-10-05 (does not discharge DEP-08)

### 2.1 Environment

| Item | Value |
|---|---|
| Host | macOS 15.8.1, x86_64 |
| Build | `assembleDebug`, x86_64 only; AGP 8.12.0, Gradle 9.3.1, JDK Temurin 17.0.20.1, NDK 27.1.12297006, CMake 3.30.5, Build Tools 36.0.0 |
| App | Expo SDK 57.0.26, React Native 0.86.3 (New Architecture), `expo-sqlite` 57.0.3 with `useSQLCipher: true`, `expo-crypto` 57.0.3, `expo-secure-store` 57.0.4, `expo-file-system` 57.0.7 |
| Emulator | AVD `Parakh_API36`: Android 16 (API 36), `google_apis`, x86_64, **4 KB pages** (`getconf PAGE_SIZE` = 4096), software GPU (SwiftShader) |
| Data | Synthetic only: the self-check uses a synthetic owner id and random bytes, and removes them |

### 2.2 Procedure

1. `npx expo prebuild --platform android`, then `./gradlew assembleDebug -PreactNativeArchitectures=x86_64` in `mobile/android`.
2. Start Metro (`npx expo start`), forward its port (`adb reverse tcp:8081 tcp:8081`), install the APK and launch it.
3. Open the development-only self-check: `adb shell am start -a android.intent.action.VIEW -d parakh://dev-storage-check`. The route renders only in a development build; a release build redirects to the first gateway screen.
4. Check from outside the app with `adb exec-out run-as io.github.hassanjalal789.parakh …`, and analyse a copy of the database file on the host. The copy held only the empty schema, and it was deleted afterwards.
5. Fail-closed check: force-stop the app, delete `shared_prefs/SecureStore.xml` (which holds only the database key), and open the self-check again.
6. Reset: `adb shell pm clear …`, then run the self-check again from a true first launch.

### 2.3 Results

| Check | Result | Evidence |
|---|---|---|
| SQLCipher is linked | `PRAGMA cipher_version` = **4.7.0 community** | self-check screen |
| Database header | Random bytes; not `SQLite format 3\0` | self-check; host analysis |
| Schema text in the file | None of `CREATE TABLE`, `drafts`, `owner_account_id`, `evidence`, `schema_version` occurs in the 36,864-byte file | host analysis |
| Entropy | 7.9953 bits per byte | host analysis |
| Readable without the key | No: stock `sqlite3` reports *file is not a database* | host analysis |
| Key custody (rule 4) | The SecureStore entry `parakh.local.db_key` is AES-GCM ciphertext wrapped by the Android Keystore (alias `key_v1`, no authentication required). The key itself never appears. The wrapped value is not recorded here | `adb run-as` |
| Media encrypted before it is written (rules 6, 7) | The stored photo is ciphertext only, decrypts to exactly the captured bytes, and the plaintext capture file is removed | self-check |
| Owner binding (FR-COMMON.25) | Another account sees none of the draft | self-check |
| Missing key fails closed (rule 8) | *Local storage unavailable: key_missing*. The database file's SHA-256 is unchanged before and after, and **no new key is created** | screen; `adb run-as` |
| First launch after reset | PASS: a new key and a new database | screen |

Screenshots: [`evidence/2026-10-05-android-emulator/`](evidence/2026-10-05-android-emulator/) — `storage-self-check-pass.png`, `storage-fail-closed-key-missing.png`, `cit01-language-screen.png`.

### 2.4 A defect found only on the emulator

The first self-check run failed: `expo-crypto`'s native `getRandomBytes` accepts at most 1,024 bytes per call, and the check asked for 64 KB in one call. The Jest stand-in had no such limit, so the unit tests had passed. The self-check now draws random bytes in 1,024-byte pieces and removes leftovers from an interrupted run. The Jest stand-in now enforces the native limit, and reverting the fix makes the suite fail. The interrupted first run had already opened the encrypted database and created a draft before failing, which the next run cleaned up.

## 3. Still required for DEP-08

| # | Check | Needs |
|---|---|---|
| 1 | Steps 1–6 on a **physical Android 7+ device** (an `arm64-v8a` build) | A test device (`T-021`) |
| 2 | Steps 1–6 with **16 KB memory pages** | A 16 KB device, or a 16 KB page-size emulator image (a further download of roughly 1.5 GB) |
| 3 | The same checks on a **physical iOS 16.4 device** | Xcode and CocoaPods (`T-024`) |
| 4 | The **release** build's merged permission list | A release build. React Native's debug-only manifest adds `SYSTEM_ALERT_WINDOW` and cleartext traffic to debug builds; the release manifest must not contain them |

## 4. Change log

| Date | Change |
|---|---|
| 2026-10-05 | Created with the first emulator run (VAL-034). DEP-08 stays open |
