# CR-60 — Migrate Parakh Mobile Application from Flutter/Dart to React Native/TypeScript

| Field | Value |
|---|---|
| **Change Request ID** | **CR-60** — **numbering under review.** See the conflict recorded in CR-59: the register holds CR-01…CR-55 and **CR-56–58 do not exist**. **`TBD — Hassan decision required`** |
| **Title** | Migrate Parakh Mobile Application from Flutter/Dart to React Native/TypeScript |
| **Raised** | 20 August 2026 |
| **Approved by** | **Hassan Jalal — Founder & Project Lead**, binding decision of 20 August 2026 |
| **Effective version** | **SRS v1.4.1** — decision **DR-19**, canonically recorded in SRS §39 and §42 |
| **Status** | **Approved and integrated at SRS v1.4.1.** Mobile: **Specified; configuration files present; not installed; not built; not tested; no device run.** |
| **Related** | CR-59 — independent and separately traceable |

---

## 1. Previous mobile stack

**DR-6 (approved)** named a **Flutter / Dart** Android client. `TBD-008` was closed on that basis by **CR-10**.

> **Material finding from repository inspection: no Flutter implementation exists.** There is no `pubspec.yaml`, no `.dart` file, no `android/` embedding and no mobile source tree anywhere in the repository. **This migration is therefore a change of an approved decision and its documentation, not a code port.** No Flutter code was deleted, because none was written.

## 2. New mobile stack — versions verified against official documentation

Verified on **20 August 2026** against the [Expo SDK reference](https://docs.expo.dev/versions/latest/), which publishes the authoritative SDK↔React Native compatibility table.

| Component | Version | Source |
|---|---|---|
| **Expo SDK** | **57.0.0** | Latest stable line |
| **React Native** | **0.86** | Expo SDK 57 targets RN 0.86 |
| **React** | **19.2.3** | Per the same table |
| **Minimum Node.js** | **22.13.x** | Per the same table |
| **Android** | **7+**, `compileSdkVersion` **36**, `targetSdkVersion` **36** | Expo Android support table |
| **Language** | TypeScript, `strict: true` | DR-19 |
| **Navigation** | Expo Router | First-party, file-based |
| **Runtime** | **Expo development build** (`expo-dev-client`) | **Background tasks and some native/biometric configuration require it.** Camera and SecureStore are available in Expo Go — see the correction below |

> **React Native's version is not chosen independently.** Each Expo SDK targets exactly one RN version. Forcing a different RN version against SDK 57 is prohibited by DR-19.
>
> **Why a development build — stated accurately.** Expo Go **does include Expo Camera and SecureStore**, so it is wrong to say basic capture and secure storage are universally unavailable there. **The real reasons are narrower:** `TaskManager` and background execution are **limited or unavailable** in Expo Go; some camera and biometric configuration requires a custom build; and Parakh needs **production-equivalent behaviour and reliable background-task testing** for its offline evidence queue. **Expo Go remains fine for throwaway UI experiments.**

## 3. Reason for migration

Approved by Hassan as a binding product decision. The engineering considerations recorded at the time: a single TypeScript language across mobile and tooling, a larger contributor pool for a one-developer project, and Expo's managed native configuration reducing Android build maintenance. **No claim is made that React Native outperforms Flutter for this workload; no benchmark was run.**

## 4. Scope of migration

**In scope:** DR-6's client-platform half → DR-19 · technical-stack documentation · mobile **configuration files only** · dependency mapping · mobile testing tooling · build and developer-environment instructions. **No application source was written.**

**Explicitly out of scope:** backend (Python/Django/DRF), database (PostgreSQL/PostGIS), queue (Celery/Redis), evidence storage, API contracts, audit architecture, and **the staff web portals — Django Templates + HTMX + Alpine.js are unchanged**. **React Native Web does not replace the staff portals.**

## 5. Architecture changes

Android-first Expo application with Expo Router; strict TypeScript; environment-based configuration via `app.config.ts`; a secure API client; **public anonymous-reporting routes requiring no session**; offline queue with idempotent synchronisation; encrypted local storage; evidence capture and resumable upload; i18n for Urdu, Punjabi and English with **RTL support for Urdu**; accessibility; and low-end-device and weak-network behaviour as first-class constraints.

## 6. Dependency mapping

Full verified table in `docs/architecture/TECHNICAL_STACK.md` §4. **Every module was checked against the Expo SDK reference index on 20 August 2026.**

**Two findings worth flagging:**
- **`expo-background-fetch` is marked Deprecated** in the current SDK reference. The correct current module is **`expo-background-task`** with `expo-task-manager`.
- **`expo-av` no longer appears**; audio is **`expo-audio`**.

Guessing either would have produced a scaffold that does not build.

## 7. Testing-tool changes

| Purpose | Flutter (previous) | React Native (new) |
|---|---|---|
| Unit | `flutter_test` | **Jest** |
| Component | `flutter_test` widget tests | **React Native Testing Library** |
| E2E | `integration_test` | **Maestro** *(preferred — YAML flows, lower maintenance for one developer)* or Detox |
| Types | Dart analyzer | **`tsc --noEmit`** |
| Lint | `flutter analyze` | **ESLint** |
| Format | `dart format` | **Prettier** |

## 8. Build and deployment changes

`flutter build apk` → **`eas build --platform android`** or a local `expo prebuild` + Gradle build. Development uses a **development build**, not Expo Go. Signing moves to EAS-managed or locally held credentials — **`TBD — Hassan decision required`** on which.

## 9. Developer-environment changes

Node **≥ 22.13.x** · npm or pnpm · Android Studio with SDK 36 · JDK per the Expo Android guide · a physical Android device or emulator running Android 7+. **The Flutter SDK is no longer required.**

## 10. Documentation affected

`Parakh_Prototype_SRS_v1.4.0.md` (DR-6 note, DR-19, TBD-008) · `docs/architecture/TECHNICAL_STACK.md` (new) · `docs/security/AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` · `mobile/` scaffold · Development Journal (new dated entry) · README.

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Nothing exists in either stack** — migration does not create a working app | **High** | Stated plainly; scaffold is configuration only |
| Expo SDK cadence (~3/year) forces periodic upgrades | Medium | Pin SDK 57; schedule upgrades deliberately |
| Background sync on low-end Android is OEM-restricted | **High** | Design for foreground-first sync; treat background as best-effort |
| Resumable upload has no single blessed Expo module | Medium | Implement chunking over the documented file/network modules |
| Developer has no React Native experience | **Unknown** | `TBD — Hassan decision required` |

## 12. Migration status

| Item | Status |
|---|---|
| Decision recorded (DR-19) | **Specified** |
| Technical stack documented with verified versions | **Specified** |
| Dependency mapping | **Specified** |
| Mobile configuration files (`package.json`, `tsconfig.json`, `app.config.ts`, `README.md`) | **Present — not installed, not resolved** |
| Mobile source files | **None** |
| Any application feature | **Not implemented** |
| Any test executed | **Not run** — no runtime in this environment |
| Build produced | **None.** No `node_modules`, no `android/`, no APK, no device run, no execution evidence |

## 13. Historical Flutter references preserved

Retained deliberately, because changing them would falsify the record:

| Location | Reason |
|---|---|
| SRS **DR-6** original text | The approved decision that DR-19 supersedes |
| SRS **CR-10** | Records `TBD-008` closure on Flutter grounds |
| SRS **TBD-008** history column | Historical option set |
| `Parakh_Master_Document*.md` (v1.0–v1.2.1) | Superseded predecessors of the SRS |
| `deck/build.js` and deck outputs | Presentation source stating the stack as of August 2026 |
| Development Journal entries before 20 Aug 2026 | **Must not be rewritten to pretend React Native was always the plan** |

Each superseded normative statement carries a **DR-19 supersession note**; none was deleted.

## 14. Approval

Approved by **Hassan Jalal**, 20 August 2026. **No mobile application has been built, run, tested or published in either Flutter or React Native.**
