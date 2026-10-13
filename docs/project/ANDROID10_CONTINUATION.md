# Android 10 continuation checkpoint — 13 October 2026

## Authority and stop rules

Hassan's exact continuation directive is `docs/planning/OWNER_CONTINUATION_2026-10-13.md`. He subsequently confirmed continuing on this phone despite its broken camera, Wi-Fi and Bluetooth, and asked for uninterrupted authorized development while away. Independent Claude review is deferred until 16 October at/after 13:00 Asia/Karachi; prepare the complete handover before 12:30 that day. Never claim an acknowledged takeover before one happens. Preserve main and all frozen checkpoints.

**Latest explicit usage constraint:** stop development and tests immediately when any applicable account usage window has <=5% remaining (usedPercent >=95). Check usage before work, between meaningful increments and at least every ten minutes. Last observed during this checkpoint: 76% used / 24% remaining; recheck live before work. Pause the heartbeat at threshold and wait for Hassan's explicit resume. The heartbeat `parakh-development-and-claude-handover` is ACTIVE, hourly, with this guard and the handover schedule. No Claude authentication retries before the scheduled time.

## Workspaces and processes

- Frozen CIT-15 source / running Metro + synthetic backend: `/Users/apple/Desktop/PARAKH/.local/cit15-report-detail`, branch `codex/cit15-report-detail`, HEAD `99535010b8095183a973fe3619abc6c6978b0b2e`, draft PR #4. Only a temporary `mobile/node_modules` symlink to the root's existing dependencies is untracked. Do not stage it.
- Follow-up source / documentation: `/Users/apple/Desktop/PARAKH/.local/android10-validation`, branch `codex/android10-cit15-validation`, currently based on the same commit, uncommitted documentation only.
- Backend process observed PID 8358 on localhost:8000, unified exec session 34393; Metro PID 8364 on localhost:8081, session 8566. Verify before using/stopping. Metro runs CI mode, so restart after any source change.
- The backend database and generated keys are isolated under the frozen worktree's `backend/.local/`; root development data has not been migrated or changed. This database was newly created for these tests.
- Local raw test evidence / generated fixtures: `/Users/apple/Desktop/PARAKH/.local/android10-20261013/`. Do not commit keys, databases, tokens or unfiltered device logs.
- Other worktrees retain A-02/A-03, A-04, F-6/F-8, owner-intake and UI-foundation work. They were inspected and left untouched. Root REVIEW.md and PARAKH_HANDOVER remain untracked and preserved.

## Device and build facts

Connected device: Samsung SM-G965F, Android 10 / API 29, `arm64-v8a,armeabi-v7a,armeabi`, 4096-byte pages, USB debugging authorized. Use `adb devices -l` to select the live serial; it is deliberately omitted here. Device reported ~31 GB free.

No prior Parakh package was found. Fresh install succeeded from root `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, SHA-256 `05f8d973799979bc25eda103b452c2972b298766fec4f590c12bdb62c7945929`, 165021927 bytes. APK minimum API 24, target 36, architectures arm64-v8a/x86_64, v2 signature verified. DEX contains audio/video/camera/location/SQLite/secure-store modules; package-lock hashes match root and CIT-15 worktree. APK installation is confirmed, not inferred from tests.

USB forwarding: phone tcp:8081 -> Mac tcp:8081 and phone tcp:8000 -> Mac tcp:8000. Restore after reconnection. No factory reset, uninstall, app-data clear, unrelated app change or old Samsung Water draft operation occurred. User reports camera, Wi-Fi and Bluetooth broken; capture and Wi-Fi-dependent tests remain BLOCKED by hardware. Microphone/GPS not yet tested. Do not change phone settings or clock silently.

## Actual phone evidence

- PASS: installation; cold launch `Status: ok`, MainActivity, 2602 ms; app rendered consent/number screens. Hassan interacted during initial onboarding, so do not claim independently executed full consent coverage.
- PASS: simulated OTP request for the approved synthetic account; intentionally wrong OTP rejected with 4 attempts remaining (`02-invalid-otp.xml`). Valid development OTP subsequently reached Home; current resumed UI confirmed signed in. No real SMS was sent.
- PASS: USB reconnection and bringing app foreground retained signed-in state. Force-stop/restart persistence remains untested.
- PASS: My Reports empty state (`04-empty-reports.xml`).
- NOT VERIFIED: attempted temporary reverse removal + refresh did not visibly show offline state before forwarding was restored. Do not count `05-offline-reports.xml` as an offline PASS. Use a controlled failing relay or a properly observed backend interruption for a repeat.
- PASS: labelled seeded report appeared in My Reports (`06-report-listed.xml`).
- PASS: tapping the row opened CIT-15 with matching PRK reference, category, received status and confirmed simulated original/Urdu/English text (`07-detail-top.xml`, `.png`). Current phone screen is CIT-15 at the top. No crash observed in this path. Development warning overlay is visible; exact warning cause is not yet established.
- PENDING: separate measured/reported coordinates, photo load, video/audio playback, timeline, share-reference-only chooser without sending, Android Back, offline/error cases, session expiry/refresh, cross-account access, cache/temp cleanup, logout and restart.

## Synthetic media fixture

`seed_playback.py` generated one report in the isolated backend using the existing real draft/upload/render/confirm/submit handlers through DRF's test client. This is **not phone capture, not real ASR, and not phone submission acceptance**. It uses a generated green/white checkerboard JPEG, three-second 440 Hz AAC tone and animated green/white H264/AAC video. macOS built-in encoders generated them; no dependency was installed and no camera or microphone was used.

Report: `PRK-QXZ1-7XBF`, ID `4380ebab-2914-427e-b1f9-0b7971990eb6`. Receipt and original hashes: local `fixture.json`. Measured `(31.520370,74.358749)`, reported `(31.5205,74.3589)`, both synthetic. Description is explicitly SIMULATED. Three original evidence items are sealed through the normal creation path. Fixture-only sessions were revoked; the phone's OTP session was preserved.

Fixture preparation failures: sandbox blocked AAC/video encoder services; retry with authorized normal macOS codec access succeeded. The fixture helper initially expected confirmation HTTP 200; the real handler returned successful 201. Recovered the same existing READY_TO_SUBMIT draft and submitted once; no duplicate report. Do not report these helper/environment failures as app bugs.

## Urdu package and next work

Uncommitted `docs/testing/urdu-review/` contains all 358 English/Urdu strings at 9953501, including 29 CIT-15 keys, with source hashes, context candidates and owner review columns. Every string is PENDING. A user-facing copy exists in `/Users/apple/Desktop/PARAKH/2026-10-13/can/outputs/urdu-review-2026-10-13/`. Source references are namespace candidates and need screen verification. No human Urdu approval is claimed.

Next: check usage, inspect actual screen, finish supported CIT-15 physical tests; reproduce and fix concrete defects on this follow-up branch without editing the frozen checkpoint. Record a PASS/FAIL/BLOCKED/NOT IMPLEMENTED matrix, update tracker/workbook/current state/journal, preserve an exact reviewable checkpoint, then continue the next unblocked feature. Encrypted 30-day account-bound report-media cache remains NOT IMPLEMENTED. Claude unavailability is not a development blocker.

## Follow-up checkpoint, 23:10 PKT

F-9 photo authorization header fix and device evidence are recorded in `docs/testing/evidence/2026-10-13-android10/README.md` (VAL-111). Follow-up branch now contains the fix and regression; frozen 9953501 remains untouched. Metro is running from this follow-up worktree with --clear (session 59761, last observed PID 12130); backend remains in frozen worktree and was restarted after the controlled offline test (session 17736; inspect live PID). Previous sessions 8566, 80767 and 34393 ended. Current phone is on restored report detail. Temporary node_modules symlinks must not be staged.

Photo, video visual playback, audio playback state, locations, Received timeline, Android Back, restart, refresh and true offline/recovery have evidence. Audible speaker output, full media cache/privacy cleanup, second-account device access, microphone/GPS and remaining auth cases are pending. Native photo reuse without another request was observed, so do not claim cache compliance from the server no-store header. See the results matrix for exact scope.

## Cache audit, 23:57 PKT — supersedes earlier pending cache status

F-10/VAL-112 reproduces plaintext native image retention after app logout. See `docs/testing/evidence/2026-10-13-cache-audit/README.md`. T-063 reopened In Progress; repair not implemented. PR #5 0f9ae81 is frozen, all CI passed. Current follow-up branch is codex/cit15-cache-audit in the same worktree; changes are audit documentation and a corrected source comment only. Phone now at language gateway after successful logout. Metro PID12130/session59761 and backend PID12538/session17736 observed live. No file deletion or old-phone action. Usage observed83% used, recheck live. Next: cache privacy implementation and physical regression.
