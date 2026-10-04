# Parakh — Technical Stack

| Field | Value |
|---|---|
| **Version** | **1.4** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** `mobile/` contains eight configuration files. **No source files, no `node_modules`, no `android/`, no APK, no execution evidence.** |
| **Owner** | Hassan Jalal |
| **Authority** | **Mobile SRS v2.1.0 — `DR-25` / `DR-26`** *(Unified Binary Architecture)* · **CR-61 rev 1.3** · **CR-60 / DR-19** *(React Native)* · **DR-6** *(backend)* · **instruction of 3 Oct 2026** |
| **Supersedes** | v1.2 (20 Aug 2026) |

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 Aug 2026 | Initial stack record |
| 1.1 | 20 Aug 2026 | Expo Go rationale corrected; verified module list |
| 1.2 | 20 Aug 2026 | Eight configuration files supplied |
| **1.3** | **2 Sep 2026** | **Active Flutter references removed** — the historical Flutter→React Native mapping now lives only in `CR-60`, clearly labelled superseded. **Anonymous-reporting references removed** — the citizen path is authenticated. **Device storage boundary corrected** for accounts and voice drafts. **Languages corrected** — Urdu and English written interface, Punjabi speech retained. **Voice-pipeline module implications added.** Status line standardised |

| **1.4** | **3 Oct 2026** | **BREAKING — Unified Binary Architecture adopted (`DR-26`).** v1.3 §2's statement that the four staff portals are **not** migrated to React Native is **withdrawn**: all **59** approved screens ship in **one** React Native binary across four route groups behind an `(auth)` gateway. **Local encryption named (`DR-23`)** — `expo-sqlite` + SQLCipher, key in `expo-secure-store`. **iOS deployment target 16.4 (`DR-24`)**. **Sixth transport class `Staff-pre-role` (`DR-22`)**. **Intel Mac and disk constraints recorded.** |


> **Reconciliation, 3 October 2026.** The authority line above previously pointed at *"SRS v2.0.0 — not yet written"*. **That placeholder is now closed: Mobile SRS v2.0.0 and v2.1.0 exist.** This revision reconciles this document against them and against the Project Lead's instruction of 3 October 2026. **Recovered requirements and decisions made now are labelled separately in every section they touch.**

> **Scope.** Documentation-finalisation revision. **No use case, click-by-click journey or portal tutorial is created here.**

## 0. Build-host constraints — recorded 3 October 2026

| Constraint | Consequence | Status |
|---|---|---|
| **Intel (x86_64) Mac** | **iOS builds are possible but slow**; no Apple-silicon simulator acceleration. Android emulator runs **x86_64 system images**, not arm64 — **so arm64-only native issues such as the SQLCipher 16 KB page-size defect cannot be reproduced on this host** | **Verified constraint — affects `DEP-08` verification, which needs a real arm64 device or CI** |
| **Disk space** | Expo SDK 57 + `node_modules` + an Android SDK 36 image + Xcode is **tens of GB**. `mobile/node_modules` is **not installed** | **Not measured on this host — measure before `npm install`** |
| **Xcode / iOS SDK** | TestFlight requires a build from a **current** Xcode. **Minimum deployment target 16.4 is unaffected; the build SDK must be current** | **Not verified installed** |
| **Node ≥ 22.13.x** | Required by Expo SDK 57 | **Not verified installed** |

> **No SDK, emulator, image or dependency was installed as part of this documentation task**, per instruction. **Every version pin below is "planned", not "verified usable on this host".**

---

## 1. Versions — verified, not assumed

Verified **20 August 2026** against the [Expo SDK reference](https://docs.expo.dev/versions/latest/), which publishes the authoritative compatibility table. **No version below has been installed or resolved in this repository.**

| Component | Version | Note |
|---|---|---|
| **Expo SDK** | **57.0.0** | Current stable line |
| **React Native** | **0.86** | **Determined by the SDK — not chosen independently** |
| **React** | **19.2.3** | Per the same table |
| **Node.js** | **≥ 22.13.x** | Minimum for SDK 57 |
| **TypeScript** | Strict mode, `strict: true` | DR-19 |
| **Android** | **7+**, `compileSdkVersion` 36, `targetSdkVersion` 36 | Expo Android support table |
| **New Architecture** | Default in this RN line | Enabled unless a required module proves incompatible — **verify per module** |

> **Do not force a React Native version against SDK 57.** Each Expo SDK targets exactly one RN version. Upgrading RN means upgrading the SDK.

**Runtime policy.** Development uses an **Expo development build** (`expo-dev-client`).

**Expo Go does include Expo Camera and SecureStore.** The accurate reasons Parakh requires a development build are:

- **`TaskManager` and background execution are limited or unavailable in Expo Go**, and Parakh's offline draft queue depends on reliable background behaviour;
- **some camera, audio and biometric configuration requires a custom build**;
- **production-equivalent behaviour is needed** to test the offline queue, resumable upload and native permissions honestly.

**Expo Go remains acceptable for throwaway UI experiments.** It is not the reference or production runtime.

## 2. Backend and staff portals

| Layer | Technology | Authority |
|---|---|---|
| API | **Python · Django · Django REST Framework** | DR-6 |
| Database | **PostgreSQL + PostGIS** | DR-6, `INT-004` |
| Queue | **Celery + Redis** | DR-6, `INT-005` |
| Evidence storage | **S3-compatible, write-once** | DR-6, `INT-003` |
| Vectors | pgvector — **P2, not installed at P0** | Database Architecture §6.4 |
| **Staff portals** | **Django Templates + HTMX + Alpine.js** | DR-6 — **unchanged** |
| Containerisation · CI | Docker · GitHub Actions | DR-6 |

> **The four staff portals are not migrated to React Native.** No authoritative source requires that change, and none is made. **React Native Web does not replace the staff portals.**

> **All five civic portals are served from one backend and one central authentication service.** Authorisation is evaluated after authentication.

## 3. Mobile architecture

**Android-first Expo application, for citizens only.** Expo Router (file-based) · strict TypeScript · environment configuration through `app.config.ts` · secure API client · **authenticated citizen routes — mobile number identifier plus SMS OTP possession factor, no citizen password** · **voice-first drafting** with an offline draft queue and idempotent sync · encrypted local storage · evidence capture and resumable upload · i18n for **Urdu and English written interface with RTL for Urdu** · accessibility · low-end-device and weak-network behaviour treated as requirements, not polish.

**Not in the mobile client:** anonymous reporting · tracking tokens · submission recovery secrets · any staff portal.

### 3.1 Voice-pipeline implications for the client

| Requirement | Client consequence |
|---|---|
| Original recording is **immutable while retained** | The client never re-encodes, trims or replaces a recording after capture |
| **AI processing is server-side only** | **No on-device ASR model is bundled, and none has been implemented or tested.** The client must never present transcription as available offline |
| **Reporter confirms an exact rendering version** | The client stores `rendering_version` and `rendering_content_hash` with the draft and sends both on confirmation |
| **A stale confirmation is rejected** | The client must handle `409` by re-fetching the active rendering, not by retrying blindly |
| **Queued ≠ received** | A queued draft holds **no** report reference; the client must not display one |
| **AI output is labelled** | Every rendering is rendered with an explicit AI-generated marker until confirmed |

> **`TBD — Hassan decision required`: AI provider and processing location.** **No provider, hosting location or legal approval is named or assumed.** No client module is selected on the basis of an unchosen provider.

## 4. Module selection — React Native / TypeScript

**Every module checked against the Expo SDK reference index on 20 August 2026.**
Release 0 status: **R0** required · **P1** later · **—** not required.

| Capability | React Native / TypeScript module | Reason | Native config | R0 |
|---|---|---|---|:--:|
| Navigation | **`expo-router`** | First-party, file-based, deep-link ready | Dev build | **R0** |
| State management | **Zustand** (client state) | Small, unopinionated; adequate for one developer | — | **R0** |
| Server state | **TanStack Query** | Retry, cache and offline semantics already solved | — | **R0** |
| Camera | **`expo-camera`** | Live capture only; **no gallery path** per `BR-002` | Dev build | **R0** |
| **Audio recording** | **`expo-audio`** | **`expo-av` no longer appears in the current SDK index.** Primary reporting input | Dev build | **R0** |
| **Audio playback** | **`expo-audio`** | Reporter must be able to replay their own recording before confirming | Dev build | **R0** |
| Location | **`expo-location`** | GPS + accuracy for `location_unverified` | Dev build | **R0** |
| Maps | **`react-native-maps`** | Listed third-party library in the Expo index | Dev build | P1 |
| Secure storage | **`expo-secure-store`** | Android Keystore-backed. **Small secrets and keys only — never media** | Dev build | **R0** |
| Local database | **`expo-sqlite`** | Draft queue and metadata | Dev build | **R0** |
| File storage | **`expo-file-system`** | App-private only; **never shared storage** | Dev build | **R0** |
| Offline queue | **`expo-sqlite`** + custom sync service | Idempotency key bound to payload hash | — | **R0** |
| Background sync | **`expo-background-task`** + **`expo-task-manager`** | **`expo-background-fetch` is marked Deprecated** in the current SDK index | Dev build | P1 |
| Network state | **`@react-native-community/netinfo`** | Listed third-party library | Dev build | **R0** |
| File hashing | **`expo-crypto`** | SHA-256 for evidence integrity **and rendering content hashes** | Dev build | **R0** |
| Resumable upload | **Custom chunking over `expo-file-system` + `fetch`** | **No single blessed Expo module — implement against `API-131`/`API-132`** | — | **R0** |
| Image redaction | **`expo-image-manipulator`** | Produces a **derived** evidence item; original retained | Dev build | P1 |
| Notifications | **`expo-notifications`** | Local first; push is P1 | Dev build | P1 |
| Localization | **`expo-localization`** + **`i18next`** | **Urdu and English written interface** | — | **R0** |
| RTL | **`I18nManager`** + logical style props | Urdu RTL; **digits stay LTR** | — | **R0** |
| Permissions | **Per-module Expo permission hooks** | Each module owns its own permission | Dev build | **R0** |
| Crash reporting | **Sentry React Native** | **Must scrub tokens, phone numbers, renderings and evidence paths** | Dev build | P1 |
| Unit test | **Jest** | — | — | **R0** |
| Component test | **React Native Testing Library** | — | — | **R0** |
| E2E test | **Maestro** *(preferred)* or Detox | YAML flows; lower maintenance for one developer | — | P1 |
| Lint | **ESLint** | — | — | **R0** |
| Format | **Prettier** | — | — | **R0** |
| Type check | **`tsc --noEmit`** | Strict mode | — | **R0** |
| Build/signing | **EAS Build** or local `expo prebuild` + Gradle | Credential custody is **`TBD — Hassan decision required`** | — | **R0** |
| Env config | **`app.config.ts`** + typed env module | **No secret is bundled into the client** | — | **R0** |

> **Historical note — no active Flutter dependency exists.** The previous Flutter→React Native module mapping was recorded in **`CR-60` (React Native migration)** and remains there as a **clearly labelled superseded record**. **It is removed from this active document.** As `CR-60` and the Development Journal both state: **there was never a Flutter implementation in this repository — no `pubspec.yaml`, no `.dart` file, no Android embedding.** No code was ported, because none existed.

## 5. Storage boundary on device

| Data | Location | Rule |
|---|---|---|
| Access and refresh tokens | **`expo-secure-store`** | Small secrets. Keystore-backed |
| Local DB encryption key | **`expo-secure-store`** | Never in app storage |
| **Pre-authentication consent payload** | **`expo-sqlite`**, encrypted | Held only until the account exists, then discarded |
| Draft metadata, pipeline state, `rendering_version`, `rendering_content_hash` | **`expo-sqlite`**, encrypted | App-private |
| **Captured media awaiting upload, including `voice_original`** | **`expo-file-system`**, app-private | **Never shared storage.** Too large for SecureStore |
| **OTP codes** | **Nowhere** | **An OTP is never stored on the device for later verification** |
| Citizen mobile number | **Not persisted beyond the active session context** | The server holds the only authoritative record, encrypted |
| Anything else | — | Not persisted |

> **A draft is bound to an authenticated account on a specific installation.** **The application must warn that privacy cannot be guaranteed on a shared or compromised device**, and must support signing out from all devices.

## 6. Honest status

| Item | Status |
|---|---|
| Stack decision (DR-19, DR-6) | **Specified** |
| Versions verified against official docs | **Verified 20 Aug 2026** |
| Module selection | **Specified** |
| Configuration files (`package.json`, `tsconfig.json`, `app.config.ts`) | **Present — not installed, not resolved** |
| Any screen, feature or API call | **Not implemented** |
| Source files, build, test, device run | **None.** No source, no `node_modules`, no `android/`, no APK, no execution evidence |
| SMS/OTP provider integration | **None exists or is claimed** |
| AI provider integration | **None exists or is claimed** |

## 7. Configuration actually supplied

**Eight files are present in `mobile/`**, not merely described:

| File | Purpose |
|---|---|
| `mobile/package.json` | Expo SDK 57 · RN 0.86 · React 19.2.3 · Node ≥22.13 · Jest · ESLint · Prettier |
| `mobile/tsconfig.json` | **`strict: true`** plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `mobile/app.config.ts` | Android-first · compile/target SDK 36 · Expo Router · dev-client · **gallery permissions blocked** per `BR-002` |
| `mobile/.env.example` | **Placeholders only.** Documents that no secret belongs in the client bundle |
| `mobile/eslint.config.js` | ESLint 9 flat config; **`console.log` is an error** — tokens, numbers and renderings must never reach a log sink |
| `mobile/.prettierrc.json` | Formatting |
| `mobile/jest.config.js` | `jest-expo` preset. **No test has been written or run** |
| `mobile/README.md` | Honest status and setup steps |

**Dependency version ranges are planning placeholders.** `npx expo install --fix` resolves real versions. **They have not been resolved, installed or built here.**

**No secret is bundled.** The citizen client obtains its session at runtime through SMS OTP verification; staff credentials never reach the mobile client at all.

> **These eight files were written for the v1.4.2 anonymous model and have not been revised for CR-61.** **They contain no application source, so no behavioural contradiction exists**, but the README wording and any anonymous-path environment placeholders will need updating when mobile implementation begins. **This is recorded rather than claimed as done.**

## Sources

- [Expo SDK reference — SDK ↔ React Native compatibility table](https://docs.expo.dev/versions/latest/)
- [React Native documentation](https://reactnative.dev/docs/components-and-apis)
- [Expo Router](https://docs.expo.dev/versions/latest/sdk/router) · [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore) · [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite) · [Camera](https://docs.expo.dev/versions/latest/sdk/camera) · [Audio](https://docs.expo.dev/versions/latest/sdk/audio) · [Location](https://docs.expo.dev/versions/latest/sdk/location) · [BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task) · [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem) · [Crypto](https://docs.expo.dev/versions/latest/sdk/crypto) · [NetInfo](https://docs.expo.dev/versions/latest/sdk/netinfo)

---

*Specified; not implemented; not tested.*
