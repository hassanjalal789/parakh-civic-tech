# Android 10 CIT-15 validation — 13 October 2026

Tasks: T-063 and T-046; VAL-111. Owner: Hassan Jalal. Implementation/testing assistance: Codex. Independent review pending until 16 October at/after 13:00 Asia/Karachi. No merge approval is claimed.

## Environment and scope

Samsung SM-G965F, Android 10/API 29, arm64, 4096-byte pages. Fresh debug APK installation was verified earlier in this continuation; APK SHA-256 `05f8d973799979bc25eda103b452c2972b298766fec4f590c12bdb62c7945929`. Phone camera, Wi-Fi and Bluetooth are reported broken. USB forwards development API and Metro only. No device content was cleared, no settings changed, and the previous phone's Water draft was untouched.

Frozen baseline: `99535010b8095183a973fe3619abc6c6978b0b2e`, draft PR #4. Follow-up: `codex/android10-cit15-validation`, based on that exact commit. Backend remains the frozen baseline with its separate synthetic SQLite database. Main verified remotely at `d3165978e19ec59a020b7049d39cced1b13760c7`.

Only synthetic report PRK-QXZ1-7XBF was used: generated checkerboard JPEG, three-second AAC tone, animated H264/AAC pattern. It was created through existing draft/upload/confirm/submit handlers by a local fixture script, not by phone capture or a real AI provider. Original and translated text is labelled SIMULATED. Screenshots include the phone's pre-existing clock, which differs from the host; test date is the host date. Hash manifest covers the saved evidence.

## Finding F-9: authenticated photo remained black — fixed locally

Before: native photo request returned HTTP 401 while same-session audio and video returned HTTP 200. Installed React Native 0.86.3 `Libraries/Image/Image.android.js` forwards `headers` to the native loader only in its array-source branch. CIT-15 passed an object source. Changed the application Image source to `[source]`; no dependency or server authorization was changed. Added a regression assertion that preserves the array and synthetic bearer header. The regression failed before the fix, passed afterward.

A first phone retest still served the frozen file because Metro's shared dependency transform cache retained the old worktree path. This was detected by inspecting the locally served virtual entry bundle. Restarting Metro with `--clear` produced the actual follow-up source and array-source fix. Always verify bundle identity after switching worktrees with shared dependencies; CI mode also requires restarting Metro after edits.

At 18:06:25 UTC the photo endpoint returned HTTP 200, 4335 bytes, and the checkerboard rendered (`12-photo-pass.png`, full photo also in `14-video-timeline.png`). This establishes the fixed path on this device, not approval of the entire feature.

## Results

| Check | Result | Evidence / limit |
|---|---|---|
| Install and cold launch | PASS | Earlier installation receipt; subsequent force-stop/restart 2163 ms, Status ok; no data clearing |
| Invalid OTP / valid simulated OTP | PASS | Earlier continuation local evidence; no real SMS |
| Session persistence and refresh | PASS | Restart reached Home; 18:02:52 UTC list 401, refresh 200, list 200 |
| Owned report and confirmed texts | PASS | `22-restored.png`; synthetic fixture identity matches |
| Measured/reported location | PASS | `12-photo-pass.png`; two distinct values and unverified notice |
| Photo authentication and rendering | PASS after fix | F-9 and screenshots above |
| Video playback | PASS, visual | `14` ready, `15` pause state and changed frame, `16` reaches 00:03/00:03; audible output not verified |
| Original audio playback state | PASS, limited | `18-audio-playing.png` changes Play to Pause; endpoint 200; speaker output not verified |
| Public timeline | PASS for Received fixture | `14` and `16`; no staff/internal fields visible; later-state fixture coverage pending |
| Share reference only | PASS | Earlier chooser inspection showed only PRK-QXZ1-7XBF; chooser dismissed without sending |
| Android Back | PASS | `19-back.xml` returns My Reports |
| Offline detail | PASS | Stopped only isolated backend; `21-offline.xml` contains no report data and offers Refresh/Back |
| Recovery after offline | PASS | Same backend restarted; Refresh API 200 and `22-restored.png` |
| Capture and Wi-Fi tests | BLOCKED | Owner-reported hardware faults |
| Encrypted 30-day account-bound media cache | NOT IMPLEMENTED | Separate approved requirement; no cache compliance claimed |
| Revoked session, second-account device access, logout cleanup, microphone/GPS | NOT RUN in this increment | Resume supported cases separately |
| Urdu owner approval | PENDING | All 358 keys packaged in `docs/testing/urdu-review`; no approval inferred |

Removing/repointing adb reverse alone did not interrupt an already live connection; those attempts are inconclusive, not offline passes. Some uiautomator dumps failed to reach idle; no stale XML was counted. Screenshot `22` replaces the failed recovery dump. Photo did not issue another request during recovery: native cache behavior and account cleanup require dedicated investigation, and server no-store headers alone do not prove native cache compliance.

## Automated checks

`npm run check`: TypeScript, ESLint and Prettier passed; Jest 388 passed, 4 skipped (26 passing suites, 3 skipped). Existing QueuedScreen act warning was emitted. A focused run during Metro startup exceeded the default five-second Jest timeout; repeat without changing assertions/timeouts passed 3/3, and the full suite also passed. No backend code changed in this increment; previous backend/CI results belong to their recorded commits, not this unpublished diff.

Tracker verification: 222 requirements match SRS v2.11.0; 16 tracker tests passed; workbook regenerated and validated with 127 tasks / 94 checks; import dry-run found no changes. Formula strings are validated; spreadsheet recalculation occurs on open.

## Next

Inspect native cache/account cleanup and media error/expiry recovery; finish supported auth/navigation tests. Keep T-063 In Review. Preserve this exact diff for the scheduled independent review; do not merge main. Continue unblocked citizen features after the media/privacy risks have been recorded and addressed.
