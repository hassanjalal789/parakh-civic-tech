# Environment Check

| Field | Value |
|---|---|
| Checked | 2026-10-03 (Asia/Karachi), tasks `T-001`, re-verified after `T-115`; backend environment added during `T-027`; Android toolchain 2026-10-04 and first build and emulator run 2026-10-05 (`T-022`, `VAL-030`, `VAL-032`); physical Android phone connected 2026-10-09 (`T-046`, `VAL-048`) |
| Host | macOS 15.8.1 (build 24H208), **Intel Core i7-8569U (x86_64)**, zsh |
| Disk | **33 GiB free** of 233 GiB (85% used) at the time of the check |
| Project root | `PARAKH/` on the Desktop (named `PARAKH PROJECT/` until 2026-10-09; Git root; see [GIT_WORKFLOW.md](GIT_WORKFLOW.md)) |
| Rule | Only project-local environments were installed: the tracker's `.venv/`, the backend's `backend/.venv/` and the mobile app's `mobile/node_modules/`. No system tool was installed. Versions below are what the commands printed |

## 1. Required now — planning and tracker generation

| Tool | Detected | Command used | Status |
|---|---|---|---|
| Git | 2.39.5 (Apple Git-154) | `git --version` | OK |
| Python | 3.14.3 | `python3 --version` | OK |
| Tracker venv | `.venv/` (git-ignored), openpyxl **3.1.5** pinned in `scripts/requirements.txt` | `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt` | OK — installed 2026-10-03 |
| Git credentials | `osxkeychain` helper (system Git config); HTTPS fetch from `origin` succeeds | `git config --get credential.helper`; `git fetch origin` | Readable. Write access proven only by the setup push (`T-010`) |
| GitHub CLI `gh` | **2.102.0**, installed 2026-10-09 at Hassan Jalal's request: the official `gh_2.102.0_macOS_amd64.zip` from `github.com/cli/cli` releases, its SHA-256 checked against the release's checksum file, unpacked into `~/.local/opt` and linked from `~/.local/bin` (added to `PATH` in `~/.zshrc`). **Signed in** by Hassan on 2026-10-09 (`gh auth login`, web flow) as `hassanjalal789`; the token is in the macOS keychain. `~/.gitconfig` unchanged; `git push --dry-run origin main` still authenticates | `gh --version`; `gh auth status` | Not required for pushes, which use the `osxkeychain` helper |

**Verified project commands:**

```bash
python3 scripts/extract_requirements.py --check
```

```bash
.venv/bin/python scripts/generate_tracker.py --check
```

```bash
.venv/bin/python scripts/generate_tracker.py
```

```bash
.venv/bin/python scripts/generate_tracker.py --validate
```

```bash
.venv/bin/python -m unittest discover -s tests/tracking -v
```

## 2. Required later — mobile (Expo SDK 57 / React Native 0.86)

Pinned by S-01 §2.4.1. Scaffolded 2026-10-04 in `mobile/` with `create-expo-app@5.0.0 --template blank-typescript@sdk-57` (Expo 57.0.26, React Native 0.86.3, React 19.2.3). SDK-matched pins needed by hand: `react-dom` 19.2.3, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1 — npm otherwise pulled newer peers that need React 19.3 / worklets 0.13. Registry check on 2026-10-03: `expo@57.0.26` is the current `latest` and `sdk-57` tag. `react-native@latest` is 0.87.1, but **SDK 57 targets 0.86 — do not force 0.87** (`NFR-77`).

| Tool | Needed for | Detected | Gap | Blocks |
|---|---|---|---|---|
| Node.js ≥ 22.13 | Expo SDK 57 | **v24.21.0** | **Confirmed 2026-10-04 at scaffold time (`DG-36`, `VAL-014`):** `expo install --check` up to date, `expo-doctor` 21/21, Android bundle exported. RN 0.86 engines: `^20.19.4 \|\| ^22.13.0 \|\| ^24.3.0` | — |
| npm | Package manager | 11.19.0 | — (pnpm/yarn not installed; not needed). `mobile/node_modules` installed project-locally 2026-10-04, pinned by `mobile/package-lock.json`. npm 11 did not run one install script (`unrs-resolver` postinstall, an ESLint resolver); lint works without it | — |
| JDK 17 | Android builds | **Installed 2026-10-04:** Eclipse Temurin 17.0.20.1+1 (x64) in `~/Library/Java/JavaVirtualMachines/`, user space, from Adoptium with its SHA-256 verified. `/usr/libexec/java_home -v 17` finds it | Set `JAVA_HOME=$(/usr/libexec/java_home -v 17)` for builds | M2 `T-022`, `T-031` |
| Android SDK | Android builds | `~/Library/Android/sdk`, from an earlier install of 12 Aug 2026 whose licence records (`android-sdk-license` and others) are dated that day. **Added 2026-10-04 with Hassan's approval** via `sdkmanager`, with no licence prompt: `platforms;android-36`, `ndk;27.1.12297006`, `cmake;3.30.5`, `system-images;android-36;google_apis;x86_64`. Already present: build-tools 36.0.0, platform-tools 37.0.1, emulator 37.1.11, cmdline-tools 22.0. These are the versions React Native 0.86 pins (compileSdk 36, NDK 27.1.12297006, CMake 3.30.5) | Set `ANDROID_HOME=~/Library/Android/sdk` and add `platform-tools` and `emulator` to `PATH` for builds | M1 `T-022` |
| Android emulator | First runs of the development build | **Created 2026-10-05:** AVD `Parakh_API36` — Android 16 (API 36), `google_apis`, x86_64, **4 KB memory pages**, software GPU (SwiftShader). Boots headless in about 40–90 s; `adb devices` lists `emulator-5554`. System UI can stall on this Intel Mac under memory pressure (it showed *System UI isn't responding* twice; *Wait* clears it) | **An emulator is not a device.** It does not discharge `DEP-08` | M2 `T-022` |
| Android development build | `T-031`, `T-046` | **Builds and runs (2026-10-05, `VAL-032`):** `./gradlew assembleDebug -PreactNativeArchitectures=x86_64` after `npx expo prebuild --platform android`; AGP 8.12.0, Gradle 9.3.1, about 7–8 min for a full build. `mobile/plugins/withUniformNdk.js` pins every module to the app's NDK (27.1.12297006), Build Tools (36.0.0) and CMake (3.30.5, React Native's own pin), and sets `android.builder.sdkDownload=false`, so a missing component fails the build instead of downloading silently. Without it the first build downloaded a second NDK (27.0, 2.4 GB; removed) and later asked for Build Tools 35 and CMake 3.22.1. Prebuild regenerates `android/`, which removes earlier build output | Run Expo commands with `EXPO_NO_TELEMETRY=1`. Debug builds carry React Native's debug-only `SYSTEM_ALERT_WINDOW` and cleartext permission; a release build's list is still to be checked | M2 `T-031` |
| Physical Android device | `T-046`, field realism | **Samsung SM-A546E, Android 16 (API 36), `arm64-v8a`, 4 KB pages**; adb over USB authorised and the debug APK installed on 2026-10-09 (`VAL-048`) | A 16 KB-page device or emulator image for the 16 KB check | M4 `T-046` |
| Android Studio | Optional (SDK manager GUI) | Not found in `/Applications` | Optional — `sdkmanager` (cmdline-tools) is enough | — |
| Watchman | Faster Metro file watching | Not installed | Optional | — |
| Homebrew | Convenience installer | **Not installed** | Optional; installers can be used instead | — |
| **Disk space** | Android SDK images, Gradle caches, Xcode | 33 GiB free on 2026-10-03; 13 GiB free on 2026-10-04 after the Android packages (the image alone is 4.3 GB unpacked, the NDK 2.5 GB); **about 6 GiB free on 2026-10-05** with the AVD (1.5 GB), Gradle caches (1.4 GB) and build output. macOS swap (up to 11 GiB while the emulator and Gradle ran together) shares the same disk, so free space swings by several GiB | Run the emulator and a Gradle build one at a time. Xcode alone needs many GB: **free space before installing Xcode** | M1 `T-024`, M8 `T-080` |

## 3. Required later — iOS

| Tool | Detected | Gap | Blocks |
|---|---|---|---|
| Xcode | **Not installed** — only Command Line Tools (`xcodebuild` unavailable) | Install a full Xcode that supports iOS 16.4 deployment and this macOS version; confirm Intel-Mac support of that Xcode release before downloading | `T-024`, `T-080`, iOS half of `DEP-08` |
| CocoaPods | Not installed | Install after Xcode | `T-024` |
| iOS simulator ≥ 16.4 | None | Comes with Xcode | `T-080` |

> **No iOS claim can be made from Android evidence.** iOS 16.4 is the deployment target (`DR-24`), and it must be re-confirmed against the generated Podfile before the first iOS build.

## 4. Required later — backend (Django/DRF stack, `DR-6`)

| Tool | Detected | Gap | Blocks |
|---|---|---|---|
| Python for the backend | 3.14.3 — **`backend/.venv/` installed 2026-10-03** (git-ignored): Django **6.1.1**, DRF **3.18.1**, cryptography **48.0.1** (+ asgiref 3.12.1, sqlparse 0.6.0, cffi 2.1.1, pycparser 3.0), pinned in `backend/requirements.txt`, installed with `--only-binary=:all:` | **cryptography 50.0.2 has no macOS x86_64 wheel for CPython 3.14**: pip found binary wheels only up to 48.0.1, and the source build failed. 48.0.1 is pinned. PostgreSQL driver (`psycopg`) is not installed and belongs with `T-023` | — (done for `T-027`) |
| PostgreSQL + PostGIS | **Not installed** (`psql` missing) | Install PostgreSQL and the PostGIS extension: Postgres.app, the EDB installer or Docker — a routine choice recorded in `T-023` | M1 `T-023`, M2 |
| Redis | **Not installed** | Install for Celery | M1 `T-023`, M5 |
| Docker | **Not installed** | Optional for local work; S-01 names Docker for deployment | M11 |
| S3-compatible write-once storage | None | Local write-once storage substitute for development (`T-054`); the real bucket arrives with environments (`T-107`) | M5, M11 |

## 5. Other tools found (not used by the plan)

| Tool | Detected | Note |
|---|---|---|
| Flutter | 3.44.9 stable at `~/development/flutter` | Used only by the superseded `apps/citizen` scaffold (`DG-03`). Not part of the active stack |

## 6. Gaps by milestone

| Milestone | Must be resolved first |
|---|---|
| M1 | A physical Android device (JDK 17, Android SDK platform 36, an emulator and the first build are done); PostgreSQL+PostGIS; Redis |
| M2 | Node/Expo compatibility confirmed (`DG-36`). Backend pins: done 2026-10-03 |
| M4 | The 16 KB page-size case (`T-046`): a 16 KB device or emulator image. *(2026-10-09: a physical Android phone with 4 KB pages is available.)* |
| M8 | Xcode + CocoaPods + simulator, and enough free disk space |
| M11 | Docker (or an equivalent), a hosting decision, environment separation |

No secrets or environment variables were dumped while preparing this check.
