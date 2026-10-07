# Parakh mobile

Expo SDK 57 · React Native 0.86.3 (New Architecture) · React 19.2.3 · strict
TypeScript · expo-router. **Development only.** The development build runs
on an Android 16 emulator (2026-10-05). It has **not** run on a physical
phone, and there is no iOS build.

## What exists

| Screen | Route                    | What it does                                                                                                                                |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CIT-01 | `app/(auth)/index.tsx`   | Urdu / English choice. Works offline                                                                                                        |
| CIT-02 | `app/(auth)/privacy.tsx` | Every disclosure point, including that reporting is **not anonymous** and that the AI provider is not chosen yet                            |
| CIT-03 | `app/(auth)/consent.tsx` | Three separate choices. The two required ones gate Continue. Held in memory; nothing is sent                                                |
| CIT-04 | `app/(auth)/phone.tsx`   | `+92` number → API-121, sent with the consent snapshot. Offline gets a plain message; nothing is queued                                     |
| CIT-05 | `app/(auth)/otp.tsx`     | Six digits → API-122. One uniform wrong/expired message, with attempts remaining announced. Resend after cooldown. The code is never stored |
| CIT-06 | `app/(citizen)/home.tsx` | Five tiles, disabled with a "not available yet" note. Sign out (API-004) works                                                              |

Other parts:

- **`app/(auth)/_layout.tsx`** is the gateway: it resolves the principal before anything renders.
- **`app/(citizen)/_layout.tsx`** admits a citizen principal only.
- **`src/api/`** holds the only `fetch` (ESLint-enforced). Every route declares its transport class. The citizen profile refuses `X-Acting-Role-Assignment-ID`, and a request that matches no profile is not sent.
- **Tokens** live only in `expo-secure-store`. On a 401 the client refreshes once (concurrent calls share the refresh) and retries once. If the refresh fails, the tokens are cleared and CIT-01 says the session has ended.

## Local draft store (`src/storage/`, `T-047`, `T-128`; `DG-59`, `DG-63`, `DG-64`, `DG-67`)

Drafts and their media are **app-private and not encrypted by the app** (Hassan Jalal's decision of 2026-10-06, `DG-63`). Tokens stay in `expo-secure-store`; account isolation, server authorization and HTTPS are unchanged. An unsubmitted draft lives for **2 days**: `expires_at = created_at + 48 h`, set once from the device clock in UTC (`DG-64`).

| Part                               | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database.ts`                      | Opens `parakh-drafts.db`: plain SQLite, **no key**. Any failure closes the connection                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `schema.ts`                        | Each migration runs in one transaction with its version record. A half-initialised database is completed in place; an unrecognised schema is refused, never altered or dropped                                                                                                                                                                                                                                                                                                                                              |
| `drafts.ts`                        | Drafts and evidence rows, bound to the account id from API-155; every statement filters on the owner. A draft lives until `expires_at = created_at + 48 h`; **a pending submission until `submission_expires_at = submission_requested_at + 48 h`**, fixed at the first press of Submit (`DG-67`). Neither is editable, and either is invisible the instant it ends. Submit is recorded once, with one key, only for a reviewed draft. 1–3 photos, one video of up to 60 s (+0.5 s container tolerance), one voice original |
| `media.ts`, `capture.ts`           | **The capture module's own file is the evidence**: hashed, recorded, then **moved** (renamed) into `Documents/parakh-drafts-media`, never copied, re-encoded or encrypted. A crash between the row and the move is finished on the next start                                                                                                                                                                                                                                                                               |
| `lifetime.ts`, `mediaLock.ts`      | Deletes expired drafts and unconfirmed pending submissions (rows, then files) and leaves a content-free note asking the server to cancel their temporary uploads; the server keeps any report that exists. Removes orphan files. All media work runs under one lock                                                                                                                                                                                                                                                         |
| `legacy/`                          | **`T-128`**: moves drafts of the 5 October encrypted build once, keeping each `created_at`; removes the old database, media and key only after the copy is recorded. A store whose key cannot be read is left untouched. SQLCipher stays in the build only for this                                                                                                                                                                                                                                                         |
| `localStore.ts`                    | One open connection: migration, crash recovery, the lifetime purge and the orphan sweep run when it opens, and the purge again on every return to the foreground. Sign-out and session expiry release it (SRS §3.4.3 step 5); drafts are kept for their lifetime                                                                                                                                                                                                                                                            |
| `selfCheck.ts`, `retentionTest.ts` | Development builds only (route `parakh://dev-storage-check`): a self-check of the native store with synthetic data, and synthetic retention-test items for testing the 48-hour rules by hand on a phone ([`docs/testing/PHYSICAL_ANDROID_TESTING.md`](../docs/testing/PHYSICAL_ANDROID_TESTING.md) §7.4)                                                                                                                                                                                                                    |

## Submission queue (`src/services/submissionQueue.ts`, `T-052`; `DG-14`, `DG-65`, `DG-67`)

- **Nothing is sent until the reporter presses Submit.** The press and its idempotency key are recorded before the first request, and each attempt is marked "outcome unknown" before it is sent.
- After a lost response, the server is asked for the draft's status (API-133) before the next attempt. An API-140 replay with the same key returns the original report.
- Automatic retries back off (30 s, 1, 2, 5, 10, then every 30 min) for **48 hours from the first press of Submit**. Meanwhile the item is a _pending submission, not yet confirmed_, never a saved draft (`src/domain/draftStatus.ts`). When the 48 hours end without confirmation, the queue makes a last status check where the server can be reached, then **deletes the pending submission** and asks the server to drop its temporary copy (`DG-67`).
- Retries stop on confirmed success (the local copy is then deleted) or cancellation. A cancellation after Submit deletes the local copy only when the server answers: cancelled, or "already submitted", in which case the reference is shown.
- One attempt per draft at a time. The queue is bound to one account and stops when the session ends.

## No backups (`plugins/withNoDeviceBackup.js`, `DG-59`)

**Android:** `allowBackup="false"`, plus rules that exclude every storage domain from cloud backup and from device-to-device transfer (Android 12+), and from backups on Android 11 and lower. `expo-secure-store`'s narrower rules are switched off. **iOS:** the session tokens are stored for this device only; excluding the drafts database and media from iCloud backup waits for the iOS build (`T-024`).

The Jest suite runs this code against Node's SQLite and a real temporary directory (`__tests__/fakes/`). The 5 October store's SQLCipher is **simulated** there. Emulator results are recorded in `docs/testing/`.

## Commands

```bash
npm install
```

```bash
npm run check
```

`npm run check` runs `tsc --noEmit`, ESLint (`console.*` is an error, and gallery or file pickers are refused), Prettier and Jest.

### Android development build and emulator

Expo Go cannot load the SQLCipher-capable `expo-sqlite` (kept only to move the 5 October drafts once), so the app needs a development build. With JDK 17 and the Android SDK from `docs/setup/ENVIRONMENT_CHECK.md`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

```bash
CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npx expo prebuild --platform android
```

```bash
cd android && EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
```

This builds one APK for phones (`arm64-v8a`) and the emulator (`x86_64`). `http://127.0.0.1:8000` reaches the Mac's backend from either through `adb reverse tcp:8000 tcp:8000`; the default, `http://10.0.2.2:8000`, works on the emulator only. **For a physical phone, follow [`docs/testing/PHYSICAL_ANDROID_TESTING.md`](../docs/testing/PHYSICAL_ANDROID_TESTING.md).**

`plugins/withUniformNdk.js` makes every native module use the app's NDK, Build Tools and CMake, and turns off silent SDK downloads. A missing component fails the build instead of being downloaded. Prebuild regenerates `android/` (git-ignored) from `app.config.ts`.

Then start Metro, forward its port, install and launch:

```bash
CI=1 EXPO_NO_TELEMETRY=1 npx expo start --port 8081
```

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8000 tcp:8000 && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The storage self-check opens with `adb shell am start -a android.intent.action.VIEW -d parakh://dev-storage-check`. In a release build that route only redirects.

### Optional: contract check against the local backend

Start the backend dev server with its console captured:

```bash
backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8765 > /tmp/parakh-dev.log 2>&1
```

Then, in `mobile/`:

```bash
PARAKH_LIVE_API_BASE_URL=http://127.0.0.1:8765 PARAKH_DEV_SMS_LOG=/tmp/parakh-dev.log npx jest __tests__/live-backend.test.ts
```

It uses a synthetic number. It reads the **SIMULATED** development code from the log; nothing is sent to any phone.

## Known limits (recorded, not hidden)

| Limit                                                                                                                                                                                           | Task / decision   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Runs on an emulator only. A physical-phone procedure exists but has not been run; no 16 KB page-size check; no iOS build                                                                        | `T-046`, `DEP-08` |
| Urdu text is an **unreviewed machine draft** (`src/i18n/ur.json` `_meta.review`)                                                                                                                | `T-045`, `DG-41`  |
| No bundled Urdu font; RTL is per-component, not app-wide `I18nManager`                                                                                                                          | `T-032`, `DG-44`  |
| No reporting screen uses the store or the queue yet, so neither runs in the app outside the self-check; consent choices still live in memory                                                    | `T-048`…`T-052`   |
| The app deletes an expired draft only while it runs (on opening the store or returning to the foreground). On a phone where Parakh is not opened, the files stay, app-private, until it next is | `DG-64`           |
| Uploads (API-131/132) are not built, so a draft cannot reach READY_TO_SUBMIT in the app yet                                                                                                     | `T-055`           |
| iOS: the drafts database and media are not yet excluded from iCloud backup (needs the iOS build). Android 16 QPR2's transfer to iOS is not declared (needs an iOS team id)                      | `DG-59`, `T-024`  |
| Debug builds carry React Native's debug-only permissions (`SYSTEM_ALERT_WINDOW`, cleartext); the release list is not built yet                                                                  | `DEP-08` §3       |
| Staff transport profiles do not exist                                                                                                                                                           | later milestones  |
| Auth error codes and body shapes follow the PROPOSED backend choices                                                                                                                            | `DG-52`           |
