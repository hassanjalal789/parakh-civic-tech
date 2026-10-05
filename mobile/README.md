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

## Encrypted local store (`src/storage/`, `T-047`, `DR-23`)

| Part                         | What it does                                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key.ts`                     | A 256-bit key from `expo-crypto`, held only in `expo-secure-store` (device-only). If a database exists and its key is missing or unreadable, it **fails closed** and never makes a new key                                                            |
| `database.ts`                | Opens the SQLCipher database: `PRAGMA key` first, then checks `cipher_version`, that the key opens the file, the schema, and that the file does not begin with the plaintext SQLite header. Any failure closes the connection                         |
| `schema.ts`                  | Each migration runs in one transaction with its version record. A half-initialised database left by an interruption is completed in place; an unrecognised schema is refused, never altered or dropped                                                |
| `drafts.ts`                  | LDS-2 drafts and evidence rows, bound to the account id from API-155. Every statement filters on the owner. 1–3 photos, one video of up to 60 s (+0.5 s container tolerance) and one voice original; the count check and the insert are one statement |
| `media.ts`                   | LDS-4: each item AES-256-GCM encrypted before it is written, with a key derived from the database key and the evidence id as additional data. Written once; read back only if its SHA-256 matches the capture                                         |
| `capture.ts`, `mediaLock.ts` | A capture's plaintext cache file is hashed, encrypted, checked and recorded, then deleted. Ingestion and the orphan sweep never run at the same time                                                                                                  |
| `localStore.ts`              | One open connection. Sign-out and session expiry release it and drop the key before sign-in returns (SRS §3.4.3 step 5). Drafts are kept                                                                                                              |
| `selfCheck.ts`               | Development builds only: exercises the native store with synthetic data (route `parakh://dev-storage-check`)                                                                                                                                          |

The Jest suite runs this code against Node's SQLite with a **simulated** SQLCipher (`__tests__/fakes/`). The real native result is in `docs/testing/DEP-08_SQLCIPHER_VERIFICATION.md`.

## Commands

```bash
npm install
```

```bash
npm run check
```

`npm run check` runs `tsc --noEmit`, ESLint (`console.*` is an error, and gallery or file pickers are refused), Prettier and Jest.

### Android development build and emulator

Expo Go cannot load SQLCipher, so the app needs a development build. With JDK 17 and the Android SDK from `docs/setup/ENVIRONMENT_CHECK.md`:

```bash
CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android
```

```bash
cd android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleDebug -PreactNativeArchitectures=x86_64
```

`plugins/withUniformNdk.js` makes every native module use the app's NDK, Build Tools and CMake, and turns off silent SDK downloads. A missing component fails the build instead of being downloaded. Prebuild regenerates `android/` (git-ignored) from `app.config.ts`.

Then start Metro, forward its port, install and launch:

```bash
CI=1 EXPO_NO_TELEMETRY=1 npx expo start --port 8081
```

```bash
adb reverse tcp:8081 tcp:8081 && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
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

| Limit                                                                                                                          | Task / decision   |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Runs on an emulator only. No physical Android device, no 16 KB page-size check, no iOS build                                   | `T-046`, `DEP-08` |
| Urdu text is an **unreviewed machine draft** (`src/i18n/ur.json` `_meta.review`)                                               | `T-045`, `DG-41`  |
| No bundled Urdu font; RTL is per-component, not app-wide `I18nManager`                                                         | `T-032`, `DG-44`  |
| No reporting screens use the encrypted store yet; consent choices still live in memory                                         | `T-048`…`T-052`   |
| The camera and recorder write a plaintext cache file before Parakh can encrypt it                                              | `DG-58`           |
| iOS backup exclusion for the database and media is not set                                                                     | `DG-59`, `T-024`  |
| What the citizen can do when local drafts cannot be opened (a fail-closed device) is not decided                               | `DG-60`           |
| Debug builds carry React Native's debug-only permissions (`SYSTEM_ALERT_WINDOW`, cleartext); the release list is not built yet | `DEP-08` §3       |
| Staff transport profiles do not exist                                                                                          | later milestones  |
| Auth error codes and body shapes follow the PROPOSED backend choices                                                           | `DG-52`           |
