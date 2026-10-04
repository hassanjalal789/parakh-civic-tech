# Parakh mobile

Expo SDK 57 · React Native 0.86.3 · React 19.2.3 · strict TypeScript ·
expo-router. **Development only.** It has never run on a device or emulator,
because the Android toolchain is not installed yet (`T-022`).

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

## Commands

```bash
npm install
```

```bash
npm run check
```

`npm run check` runs `tsc --noEmit`, ESLint (`console.*` is an error), Prettier and Jest.

To run on a device or emulator, the `T-022` toolchain is needed first (JDK 17, Android SDK 36). Expo Go cannot load SQLCipher, so it needs a development build: `npx expo run:android`.

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

| Limit                                                                            | Task / decision  |
| -------------------------------------------------------------------------------- | ---------------- |
| Not run on a device or emulator; no visual check                                 | `T-022`          |
| Urdu text is an **unreviewed machine draft** (`src/i18n/ur.json` `_meta.review`) | `T-045`, `DG-41` |
| No bundled Urdu font; RTL is per-component, not app-wide `I18nManager`           | `T-032`, `DG-44` |
| Consent choices live in memory only; encrypted local storage is not built        | `T-047`          |
| Staff transport profiles do not exist                                            | later milestones |
| Auth error codes and body shapes follow the PROPOSED backend choices             | `DG-52`          |
| `useSQLCipher` is configured but unverified on a device                          | `DEP-08`         |
