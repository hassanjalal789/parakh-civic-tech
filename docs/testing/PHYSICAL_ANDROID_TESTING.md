# Testing Parakh on a physical Android phone

| Field | Value |
|---|---|
| Written | 2026-10-07, at Hassan Jalal's request (a physical Android phone is available) |
| App | **The Expo / React Native app in `mobile/`.** The request mentions a Flutter app: `apps/citizen/` is the superseded Flutter template (`DG-03`) and is **not** the Parakh app, so it is not tested here |
| Build | Debug APK built 2026-10-07 at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`: phones (`arm64-v8a`) and the emulator (`x86_64`), backend `http://127.0.0.1:8000`, development variant |
| Verified | §7.3–§7.5 were run on the Android 16 emulator on 2026-10-07 (`VAL-045`). **Physical phone: §1–§7 all passed on 2026-10-09** on a Samsung SM-A546E, Android 16 (`VAL-048`–`VAL-058`), with finding F-1 fixed and re-tested; still open: the 16 KB page-size check (this phone has 4 KB pages) and iOS; the results so far are in §11 |
| Rules tested | Draft lifetime 48 h (`DG-64`); pending submission 48 h from Submit, then deleted (`DG-67`); no backups (`DG-59`); server clean-up 72 h without activity (`DG-57`, backend only) |

## 0. What can be tested on the phone today

The app has the sign-in screens, a development screen for the draft store, and the first two reporting screens: CIT-08 capture (`T-049`) and CIT-09 speak or type (`T-050`). They open from a development entry until CIT-07 (`T-048`) exists. Location, review and Submit arrive with `T-051`, `T-052` and `T-062`, and uploads with `T-055`.

| Test | Today on the phone | Where |
|---|---|---|
| Developer settings, connection, install, launch | **Yes** | §1–§6 |
| Urdu and English interface text, text direction | **Yes**, on the sign-in screens | §7.1 |
| Sign-in with a synthetic number, session restore, sign-out | **Yes** (the SMS is SIMULATED: the code appears on the Mac) | §7.2 |
| Draft-store self-check on the real phone | **Yes** | §7.3 |
| Drafts and pending submissions follow the 48-hour rules; restart during a pending item | **Yes**, with synthetic test items and the phone's clock | §7.4, §7.5 |
| Permissions: camera, microphone, location; no storage or media | **Partly**: what is declared and blocked. Nothing asks yet | §7.6 |
| Sensitive data not backed up | **Yes**, the checks Android allows | §7.7 |
| Photo and video capture | **Yes**, from the development entry `parakh://dev-capture` (`T-049`) | §8.1 |
| Speaking or typing the report text on the phone (CIT-09) | **Yes**, from CIT-08's **Continue** (`T-050`), after the `T-049` test draft expires | §8.2 steps 1–9 |
| Where the issue is: GPS, the last known position or a written description (CIT-10) | **Yes**, from CIT-09's **Continue** (`T-051`) | §8.2b |
| Speech-to-text, Urdu and English text from the server, and their review | **No** — upload `T-055`, processing states `T-058`, the text `T-127`; the AI is SIMULATED and does not listen to speech | §8.2 later steps |
| Successful submission; offline submission; reconnection and retry; interrupted upload; closing the app during a pending report | **No** — `T-052` screens, `T-055` uploads | §8.3–§8.6 |

What stands in for the untestable rows today is listed in §9.

## 1. What you need

- **An Android phone with Android 7.0 or later**, 64-bit (almost every phone sold since 2017), with a few hundred MB free.
- **A USB data cable.** Some cables only charge. If the phone never asks to allow USB debugging, try another cable.
- **The development Mac**, with the repository at `~/Desktop/PARAKH` and the tools already installed there: JDK 17, the Android SDK at `~/Library/Android/sdk`, Node and npm, and the backend's `.venv`.
- **Synthetic data only.** Use a made-up number such as `0300 1234567`, never a real person's. Use test photos of objects, not of people. The SMS is not sent: the code appears on the Mac.

In every Mac terminal used below, first run:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

```bash
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

## 2. Prepare the phone

1. **Turn on Developer options.** Open **Settings → About phone** and tap **Build number** seven times, entering your PIN when asked. The location varies:
   - Samsung: **Settings → About phone → Software information → Build number**;
   - Xiaomi, Redmi and POCO: tap **MIUI version** or **OS version**.
2. **Turn on USB debugging.** Open **Settings → System → Developer options** (Xiaomi: **Settings → Additional settings → Developer options**) and switch on **USB debugging**.
3. **Xiaomi, Redmi and POCO only:** also switch on **Install via USB** and **USB debugging (Security settings)**. The phone may ask for a Mi account and a SIM card; without them, installing fails with `INSTALL_FAILED_USER_RESTRICTED`.
4. Leave **Stay awake** on while testing, if you like. It is in the same menu.

## 3. Connect the phone to the Mac

1. Close the Android emulator if it is running, so that only one device is connected.
2. Connect the phone with the cable and unlock it.
3. If the phone asks how to use USB, choose **File transfer**. **Charging only** also works on most phones.
4. On the Mac, run:

   ```bash
   adb devices
   ```

5. On the phone, a dialog **Allow USB debugging?** shows the Mac's key fingerprint. Tick **Always allow from this computer**, then tap **Allow**.
6. Run `adb devices` again. Expected: one line ending in `device`.
   - `unauthorized`: unlock the phone and accept the dialog.
   - No line: try another cable or USB port.
7. Record the phone's memory page size:

   ```bash
   adb shell getconf PAGE_SIZE
   ```

   `4096` means 4 KB pages and `16384` means 16 KB pages. Only a 16 KB phone covers the 16 KB page-size check of `T-046`; on a 4 KB phone that check stays pending.

## 4. Build the app (only when the APK is missing or the native configuration changed)

The APK of 2026-10-07 already contains the backup rules (§7.7). JavaScript changes need **no** rebuild, because the debug build loads them from Metro. Rebuild only after a change to `app.config.ts`, `plugins/` or a native dependency. It takes about 15 minutes.

```bash
cd "$HOME/Desktop/PARAKH/mobile"
```

```bash
CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npx expo prebuild --platform android
```

```bash
cd android && EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
```

- Expected: `BUILD SUCCESSFUL`. The APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- `SDK location not found` means `ANDROID_HOME` was not exported in this terminal (§1). The prebuild regenerates `android/` and removes `local.properties`.

## 5. Install the app

```bash
cd "$HOME/Desktop/PARAKH/mobile"
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

- Expected: `Success`. Accept any prompt on the phone; Xiaomi asks when **Install via USB** is on.
- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: an older copy was signed differently. Remove it first with `adb uninstall io.github.hassanjalal789.parakh`, which deletes the app's data on the phone.

## 6. Start the backend and Metro, and connect the phone to them

Use three terminals on the Mac. Run §1's two `export` lines in each.

**Terminal 1 — the backend.** Its console also shows the SIMULATED SMS codes.

```bash
cd "$HOME/Desktop/PARAKH" && backend/.venv/bin/python backend/manage.py migrate
```

```bash
cd "$HOME/Desktop/PARAKH" && backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

**Terminal 2 — Metro**, which serves the app's JavaScript. Leave it running.

```bash
cd "$HOME/Desktop/PARAKH/mobile" && CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npx expo start --port 8081
```

**Terminal 3 — connect the phone's localhost to the Mac over the cable.** Run both commands again after every reconnection **and after every restart of the phone** — otherwise the app stays on a grey screen, unable to reach Metro.

```bash
adb reverse tcp:8081 tcp:8081
```

```bash
adb reverse tcp:8000 tcp:8000
```

Now tap the **Parakh** icon on the phone.

- Expected: Metro prints `Android Bundled …`, and the phone shows the language screen (CIT-01).
- *Unable to load script*: check that Metro is running, run both `adb reverse` commands again, then tap **Reload** or close and reopen the app.
- *System UI isn't responding* (seen on the emulator): tap **Wait**.

## 7. Tests you can run now

Record each result in the table in §11.

### 7.1 Urdu and English interface text

1. On CIT-01, choose **اردو**. Expected:
   - the following screens are in Urdu, and each Urdu text block reads right to left and is right-aligned. The layout itself is **not** mirrored yet (buttons and links keep their places): app-wide right-to-left and a bundled Urdu font are `T-032`, so they are not failures of this test;
   - nothing is cut off or overlapping;
   - the disclosure screen says that reporting is **not anonymous**.
2. Close the app (swipe it away), reopen it, and choose **English**. Expected: the same screens in English, left to right.
3. Note any wording problem. **The Urdu is an unreviewed machine draft** (`T-045`, `DG-41`).

### 7.2 Sign-in, session restore, sign-out

1. Go through the screens:
   - accept the two required consents on CIT-03 (the SMS one is optional);
   - enter the synthetic number `300 1234567` on CIT-04 and continue. **Before tapping Send code, check the field shows exactly `3001234567`**: clear anything already in it, and do not accept a number the keyboard suggests.
2. Find the code in Terminal 1's console, for example `[SIMULATED SMS — development only, nothing was sent] citizen_signup_login code for +92 300 *** 4567: 123456`. Enter it on CIT-05.
   - Expected: the home screen CIT-06, with its tiles disabled and a "not available yet" note.
3. **Restore:** swipe the app away, or run `adb shell am force-stop io.github.hassanjalal789.parakh`, then reopen it. Expected: still signed in.
4. **Sign out** on CIT-06. Expected: back to CIT-01, signed out.

### 7.3 Draft-store self-check

```bash
adb shell am start -a android.intent.action.VIEW -d parakh://dev-storage-check
```

Expected: every line ends in **yes**, then **RESULT: PASS**:

- 5 October encrypted store: none found (or "moved …" the first time);
- Draft database is plain SQLite (no app key);
- Capture file moved, not copied;
- Stored photo is the captured bytes;
- Lifetime is created_at + 48 h and editing keeps it;
- Expired draft and its file deleted;
- Pending submission kept 48 h from Submit, then deleted;
- Another account sees none of it;
- Synthetic data removed.

The screen also shows *When the store opened: deleted N expired draft(s) and M unconfirmed pending submission(s)*.

### 7.4 Drafts and pending submissions follow the 48-hour rules

This test moves the phone's clock forward, because the 48 hours count on the phone's own clock. It uses **synthetic test items**: a random "photo", a synthetic account, and nothing is ever sent.

1. Open the self-check screen (§7.3). Under **Retention test items**, tap **Remove all test items**, then **Create a test draft**.
   - Expected: *Saved draft · created T · deleted at T + 48 h · 1 file(s)*.
   - Write down T.
2. Turn off automatic time: open **Settings → System → Date & time** and switch off **Set time automatically**. Some phones call it "Use network-provided time".
3. **Set the date one day later** (T + 24 h).
4. Close Parakh completely (swipe it away) and open the self-check again (§7.3).
   - Expected: the saved draft is still listed, with the same *deleted at* time.
   - Tap **Create a test pending submission**. Expected: *Pending submission — not yet confirmed · … · deleted at (now + 48 h) · 1 file(s)*. It is labelled differently from the saved draft.
5. **Set the date to T + 48 h plus a few minutes.** Close and reopen as in step 4.
   - Expected: *When the store opened: deleted 1 expired draft(s) and 0 unconfirmed pending submission(s)*.
   - Only the pending submission is listed.
6. Check the files, from the Mac:

   ```bash
   adb exec-out run-as io.github.hassanjalal789.parakh ls files/parakh-drafts-media
   ```

   Expected: exactly one `….jpg`, which belongs to the pending submission.
7. **Set the date one more day later**, past the pending submission's *deleted at*. Close and reopen.
   - Expected: *deleted 0 expired draft(s) and 1 unconfirmed pending submission(s)*.
   - The list shows *None on this phone*.
   - Step 6 lists no file.
8. **Switch Set time automatically back on**, and check that the phone shows the correct time again.

What this shows:

- a draft is deleted 48 hours after it was created, never extended by editing or reopening (`DG-64`);
- a pending submission is deleted 48 hours after its Submit, not after the draft's creation (`DG-67`);
- both are deleted together with their files;
- a saved draft and a pending submission are told apart.

*A clock moved by hand moves the deletion too: the rule is documented as using the device clock.*

### 7.5 Closing the app or restarting the phone during a pending item

1. With automatic time on, create a test draft and a test pending submission (§7.4 step 1). Note their *deleted at* times.
2. Close the app (swipe it away), then **restart the phone**.
3. Reopen the self-check. Expected:
   - both items are listed;
   - their *deleted at* times are **unchanged**;
   - each has *1 file(s)*.
4. Tap **Remove all test items**. Expected: *None on this phone*.

### 7.6 Permissions

1. Open **Settings → Apps → Parakh → Permissions**. Expected:
   - **Camera**, **Microphone** and **Location** are listed, but not granted: no screen asks for them yet;
   - **there is no Photos and videos, Files and media, or Storage entry.** Parakh never reads the gallery (`BR-002`).
2. From the Mac:

   ```bash
   adb shell dumpsys package io.github.hassanjalal789.parakh | grep "permission\."
   ```

   - Expected to appear: `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`, `ACCESS_NETWORK_STATE`.
   - Expected **not** to appear: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_BACKGROUND_LOCATION`.
   - `SYSTEM_ALERT_WINDOW` is in **debug** builds only, added by React Native's developer menu (`DEP-08` §3).
3. Granting the camera, microphone and location prompts at the moment of capture is tested with the capture screens (§8.1).

### 7.7 Sensitive Parakh data is not backed up (`DG-59`)

1. **Android has the app marked as not backed up:**

   ```bash
   adb shell dumpsys package io.github.hassanjalal789.parakh | grep "flags="
   ```

   Expected: `ALLOW_BACKUP` does **not** appear; on the emulator the line reads `flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]`.
2. **The app carries rules that exclude everything from cloud backup and device-to-device transfer:**

   ```bash
   ~/Library/Android/sdk/build-tools/36.0.0/aapt2 dump xmltree --file res/xml/parakh_data_extraction_rules.xml "$HOME/Desktop/PARAKH/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
   ```

   Expected: under both `cloud-backup` and `device-transfer`, an `exclude` for each of:

   - `root`, `file`, `database`, `sharedpref`, `external`;
   - `device_root`, `device_file`, `device_database`, `device_sharedpref`.
3. **Google backup on the phone:** open **Settings → Google → Backup** (on some phones **Settings → System → Backup**) and tap **Back up now**. Then open the list of apps whose data is backed up. Expected: **Parakh is not in it**.
4. **Transfer to a new phone:**
   - This is meaningful only once Parakh is installed from a store: a debug build is not reinstalled on the new phone by a transfer, so its data cannot travel either.
   - When it applies, expected: Parakh opens signed out on the new phone, and the self-check lists *None on this phone*.
   - On iOS the session tokens are stored for this device only.

What Android cannot be told: the new Android 16 QPR2 transfer to iPhone needs the app's iOS team id, which does not exist yet (`DG-59`).

## 8. When the reporting screens exist (`T-049`–`T-052`, `T-055`)

These steps check the approved rules. Run them once the screens are built, and adjust names to the screens as built.

### 8.1 Photo and video capture (`T-049`; `DG-47`, `DG-54`, `DG-63`)

CIT-07 (`T-048`) does not exist yet, so CIT-08 opens from a development entry. Sign in with a test number first (§7.2), then, with Home on the screen:

```bash
adb shell am start -a android.intent.action.VIEW -d parakh://dev-capture
```

It opens CIT-08 on the newest local draft, or on a new one. A release build sends it Home.

1. **Camera permission, explained first.** Expected: the explanation, then **Allow camera**; Android asks only after the tap. To test a refusal, deny it: a plain explanation and **Open settings** — never a gallery.
2. **Photos.** Expected: **Continue** stays disabled, with *Take at least one photo to continue*, until the first photo. Take three: each appears as a thumbnail and is announced; then **Take a photo** is disabled with *You already have 3 photos*.
3. **Video.** Switch to **Video**. Expected: the microphone is explained before Android asks. Record; the camera stops by itself at **60 seconds**. Only one video; it does not enable Continue on its own.
4. **Review.** Tap a thumbnail: the photo, or the video playing. **Delete** removes it; **Retake** removes it and returns to the camera.
5. **No gallery, file picker, import or skip control** anywhere on the screen.
6. **Files, from the Mac:** `adb exec-out run-as io.github.hassanjalal789.parakh ls -la files/parakh-drafts-media` and `… ls cache`. Expected: one file per kept item in the drafts folder, **no capture left in the cache**, nothing in shared storage.
7. **Restart.** Close Parakh, reopen, open the entry again. Expected: the same draft, with the same items.

### 8.2 Speech or typing, in Urdu and English (`T-050`; `DG-61`, `DG-62`, `DG-74`)

CIT-09 opens from CIT-08's **Continue**. Open CIT-08 as in §8.1 (`parakh://dev-capture`); it needs at least one photo before Continue works. **CIT-09 changes the draft it opens**: it adds a recording or typed text to it. The photos and the video are not touched.

**Hassan's choice (2026-10-11):** the `T-049` test draft stays unchanged. Run this test after it has expired (20:57 PKT on 11 Oct). After that, the entry starts a new draft, so take one photo before **Continue**.

Steps 1–8 check the phone alone. Nothing is uploaded yet.

1. **Two equal ways.** Expected:
   - **Speak** and **Type** side by side, and neither is selected;
   - no language picker;
   - **Continue** disabled, with *Record or type a description to continue*;
   - a note that recording and typing work without internet.
2. **The microphone.** Tap **Speak**.
   - If the microphone is not allowed yet: the explanation, then **Allow microphone**, and Android asks only after the tap.
   - If it is already allowed (as after §8.1): *Ready to record* and **Start recording**.
   - Optional refusal check: in Android Settings set Parakh's microphone to *Don't allow*, then come back. Expected: a plain explanation, a way to allow it (Allow, or Open settings), and **Type** still available.
3. **Record.** Before starting, expected: *You can record for up to 3 minutes.* Tap **Start recording**, speak for about 15 seconds (Urdu, English or a mix), then **Stop recording**. Expected:
   - the time counts up while recording, shown as *of 3:00*;
   - afterwards *Recorded — review your recording (0:15)*;
   - **Continue** enabled.
4. **Play and pause.** Expected: your own recording plays, offline included. **Pause** stops it. Play again after the end starts from the beginning.
5. **Record again and delete.**
   - Tap **Record again**. Expected: a warning that it replaces the recording. Tap **Keep it**: nothing changes.
   - Tap **Record again**, then **Replace recording**, and record a few seconds. Expected: only the new recording remains.
   - Tap **Delete recording**. Expected: it is gone, and Continue is disabled.
6. **Switching never deletes silently.**
   - Record again, then tap **Type**. Expected: *Typing instead deletes your recording*. **Keep it** keeps the recording. Then **Delete recording and type**.
   - Type a sentence in Urdu, then one in English. Expected: the text stays exactly as typed, and Continue is enabled. Only spaces: Continue is disabled.
   - Tap **Speak**. Expected: *Speaking instead deletes the text you typed*. Choose **Keep it**, so the text stays for step 8.
7. **Files, from the Mac** (after a recording is kept):
   - `adb exec-out run-as io.github.hassanjalal789.parakh ls -la files/parakh-drafts-media`
   - `adb exec-out run-as io.github.hassanjalal789.parakh ls cache`
   - Expected: one `.m4a` file for the recording, next to the photo and video files, and no recording left in the cache.
8. **Restart.** Close Parakh from Recent apps, reopen it, open the entry and tap **Continue**. Expected: CIT-09 shows the same text, or the same recording.
9. **The 3-minute limit (`DG-74`).** Delete the recording, start a new one and let it run without tapping Stop. Expected: it stops by itself at **3:00**, the recording is kept, and the screen says it stopped at the longest allowed length. Play it: about 3 minutes.

Later, once upload, processing and the server's text exist (`T-055`, `T-058`, `T-127`):

1. After upload and server processing, the review shows **three texts**: the transcription, the Urdu text and the English text, each marked if AI-produced.
   - **In development the AI is SIMULATED**: its text is labelled `[SIMULATED…]` and does not reflect what was said.
2. Correct a text. Expected:
   - your words are never changed by AI;
   - any AI change needs your confirmation;
   - you must confirm all three texts before Submit is possible.

### 8.2b Where the issue is (`T-051`; `DG-30`, `DG-73`)

CIT-10 opens from CIT-09's **Continue**. There is no map and no address search. The location is saved to the draft as it is set.

1. **Location, explained first.** The phone has location *Not allowed* (§7.6). Expected:
   - the explanation and **Allow location**;
   - Android asks only after the tap. Choose *While using the app*.
2. **The current position.** Stand near a window or outdoors. Expected:
   - *Finding your position…*, then *Your phone's current position*;
   - latitude and longitude with six decimals, and *Accuracy: about … m*.
3. **Directional buttons.** Press **North** twice. Expected:
   - *You moved the position about 20 m from what the phone measured*, with the measured latitude and longitude shown below it;
   - **Back to the measured position** returns to the measured coordinates, and the note goes away.
4. **Restart.** Close Parakh from Recent apps, reopen it, and go back to CIT-10 through the entry, CIT-08 and CIT-09. Expected: the same location, shown at once without finding the position again.
5. **Optional — no location.** In Android Settings, set Parakh's location to *Don't allow*, then come back. Expected:
   - *Precise GPS coordinates are not available* and a box to describe the place;
   - type a description: **Continue** is enabled, and the screen says the report will state that coordinates were not available.
   - Allow location again afterwards if you wish. **Find my position again** then replaces the description with coordinates.
6. **Continue** returns to Home with the draft kept. Review and Submit come with `T-062`.

The last known position (used when no current fix arrives within 20 seconds) is hard to force on a phone. Jest covers it (`VAL-079`).

### 8.3 Successful submission (`FR-PUB.28`)

1. With the phone online, press **Submit**. Expected:
   - a reference such as `PRK-…` appears;
   - the item leaves the drafts list;
   - `ls files/parakh-drafts-media` no longer shows its files.
2. On the Mac, the backend console shows API-140 once.

### 8.4 Offline submission, reconnection and retry (`DG-14`, `DG-65`, `DG-67`)

1. Turn on **Airplane mode** and press **Submit**. Expected:
   - the item is shown as **Pending submission — not yet confirmed**, never as a saved draft;
   - no reference is shown.
2. Turn Airplane mode off. Expected: within about 30 seconds to a few minutes (the backoff), the report is sent once and a reference appears.
3. **Lost answer:** stop the backend just after pressing Submit, then start it again. Expected: the app asks the server for the status first, and **no second report** is created. Check the backend console.

### 8.5 Interrupted upload (`T-055`)

1. Start uploading a video, then turn on Airplane mode mid-upload. Turn it off.
2. Expected: the upload resumes from the last confirmed chunk, not from zero, and nothing is lost.

### 8.6 The 48 hours of a pending submission, and closing the app

1. Press Submit in Airplane mode, close the app, and restart the phone. Expected: still pending, with the same *deleted at* time.
2. Keep it offline and move the clock to more than 48 hours after Submit (§7.4 steps 2–3). Reopen the app. Expected:
   - the pending submission and its files are deleted;
   - the app says so plainly;
   - after reconnecting, the server is asked to drop its temporary copy;
   - a report that did reach the server stays there, under My Reports.

## 9. What stands in for §8 until then

| Rule | Automated test |
|---|---|
| Nothing is sent without Submit; Submit recorded before the first request | `mobile/__tests__/submission.test.ts` |
| A lost answer is checked before a retry; one key; one report | `submission.test.ts` |
| 30 s, 1, 2, 5, 10, then 30 min backoff; 48 h from Submit; deleted at the deadline, with a last status check | `submission.test.ts` |
| Cancellation never claims a false result | `submission.test.ts` |
| A capture file is moved, not copied; 1–3 photos; one video of up to 60 s | `mobile/__tests__/storage.test.ts`, emulator self-check |
| A recording: sound-only, at most 3 minutes (`DG-74`) and 20 MiB, refused on the device and the server when longer; one recording per Stop | `mobile/__tests__/capture.test.ts`, `describeScreen.test.tsx`, `backend/parakh/drafts/tests/test_pipeline.py` (`VAL-073`, `VAL-074`) |
| Draft and pending-submission lifetimes, purge, account isolation | `storage.test.ts`; emulator run of §7.4 (`VAL-045`) |
| Backup rules | `mobile/__tests__/backupRules.test.ts`; the APK inspected (`VAL-044`) |
| Server clean-up after 72 h without activity, safe for uploads and jobs still running | `backend/parakh/drafts/tests/test_pipeline.py` (`ExpiryTests`) |

## 10. Afterwards

1. **Settings → Date & time → Set time automatically: on.**
2. To remove the app and its data:

   ```bash
   adb uninstall io.github.hassanjalal789.parakh
   ```

3. Optionally, in **Developer options**, tap **Revoke USB debugging authorizations** and switch **USB debugging** off.

## 11. Record of results

Kept up to date as each test is run; each run is also summarised in the development journal.

**Phone:** Samsung SM-A546E · Android 16 (API 36) · `arm64-v8a` · security patch 2026-05-05 · **4 KB pages** (`VAL-048`)

| § | Test | Result (pass / fail / not run) | Notes |
|---|---|---|---|
| 3 | Connection over USB (`adb devices`) | **Pass** | 2026-10-09; debugging authorised |
| 3 | Memory page size | **4096 (4 KB)** | The 16 KB page-size check is **not** covered by this phone and stays pending |
| 5 | Install | **Pass** | 2026-10-09; the APK on the phone is identical to the 7 Oct build (SHA-256 `05f8d973…`); no `ALLOW_BACKUP` flag |
| 6 | First launch through Metro (CIT-01) | **Pass** | 2026-10-09 (`VAL-049`): bundled in 2.3 s (1,536 modules); title *Parakh* (the phone is set to English), the bilingual prompt, both buttons; no crash or JavaScript error in the phone's log. Screenshot: `evidence/2026-10-09-android-phone/first-launch-cit01.png` |
| 7.1 | Urdu and English text | **Pass** (Urdu and English) | 2026-10-09. Urdu: CIT-02 entirely in Urdu and right-aligned, the *not anonymous* sentence present (`VAL-050`). English: the same in English, left-aligned (`VAL-052`). The text matches `FR-AUTH.2` as written; whether it should also mention typing and the English text (`DG-61`/`DG-62`) is `DG-69`, open |
| 7.2 | Sign-in, restore, sign-out | **Pass** | 2026-10-09. Restore (14:17) straight to Home with no server call; sign-out after the 15-minute access token expired refreshed once and logged out (`VAL-050`). The first sign-in used a number that was not the test number; nothing was sent (simulated), Hassan deleted the development database at 14:22 and it was recreated empty. **Clean sign-in with `300 1234567`**: code 202, verify 200, Home in English (`VAL-052`) |
| — | **F-1** — language lost on restart (`FR-AUTH.1`, `T-042`) | **Fixed, re-test Pass** | Found 14:17: after the restore Home was English although Urdu was chosen. Fixed in `db7a09a` (`VAL-051`). Re-test 14:38 on the English-language phone: Urdu chosen, signed in, app closed and reopened → Urdu Home; stored choice `ur` (`VAL-053`). Screenshot: `evidence/2026-10-09-android-phone/f1-retest-urdu-home-after-restart.png` |
| 7.3 | Self-check | **Pass** | 2026-10-09 14:42 (`VAL-054`): every line *yes*, RESULT: PASS, 0 and 0 deleted when the store opened; *5 October encrypted store: none found* (never on this phone). The database is plain SQLite (`SQLite format 3\0`), app-private; no synthetic data left. The development screen's English text is right-aligned in Urdu mode (development screen only) |
| 7.4 | 48-hour rules | **Pass** | 2026-10-09, clock moved by hand to 10, 11 and 12 Oct (`VAL-055`). Part 1: two saved drafts kept *deleted at* 11 Oct across the move and a reopen; a pending submission created with *deleted at* 12 Oct (48 h from its Submit). Part 2: at 11 Oct 15:00 the two drafts and their files were deleted and the pending submission kept — shown by the database and files; the on-screen count was not seen, because the phone powered off unexpectedly before it was reported. Part 3: *deleted 0 … and 1 unconfirmed pending submission(s)*, *None on this phone*, the media folder empty. **After a phone restart, run both `adb reverse` commands again**: without them the app shows a grey screen (it cannot reach Metro) |
| 7.5 | Restart during a pending item | **Pass** | 2026-10-09, automatic time on (`VAL-056`): a test draft and a test pending submission created at 19:58 survived closing the app and a planned phone restart; *deleted at* unchanged (11 Oct 14:58Z), 1 file each, counters 0/0, RESULT: PASS. After the restart both `adb reverse` links were made again before opening the app |
| 7.6 | Permissions | **Pass** | 2026-10-09 (`VAL-057`). Phone: Camera, Microphone and Location under *Not allowed*; nothing granted. From `dumpsys package`: requested `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`, `ACCESS_NETWORK_STATE`, plus the install-time `ACCESS_WIFI_STATE`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `WAKE_LOCK` and the debug-only `SYSTEM_ALERT_WINDOW`; camera, microphone and location **not granted**; **no** `READ_MEDIA_*`, `READ_`/`WRITE_`/`MANAGE_EXTERNAL_STORAGE` or `ACCESS_BACKGROUND_LOCATION` |
| 8.1 | Capture, step 1: camera permission explained first; preview; no gallery | **Pass, order to re-test** | 2026-10-09 (`VAL-061`): Android's prompt 3.6 s after the screen opened; only the camera asked; the draft bound to the test account. Hassan cannot recall seeing the explanation first, so the permission explanations are re-tested |
| 8.1 | Capture, step 2: three photos; Continue waits for the first | **Pass** | 2026-10-10 (`VAL-061`): 2.76 MP, about 0.2 MB each, no location in the files; each file unchanged since its capture (SHA-256); no capture left in the cache |
| 8.1 | Capture, step 3: one video, stopped by the camera at 60 s | **Pass after fix** | 2026-10-10. First run (`VAL-062`), **finding F-2**: stopped at 26 s by the 40 MiB limit — the phone's default 12 Mbit/s fills it early. Fixed with a proposed 4.5 Mbit/s bitrate (`VAL-063`, `DG-72`). Re-test (`VAL-064`): stopped by the 60-second limit, 59.97 s, 34.36 MiB, H.264 + AAC, unchanged since capture; the retaken 26-second file removed |
| 8.1 | Capture, step 4: review, delete, retake | **Pass** | 2026-10-10 (`VAL-064`, `VAL-065`): the video reviewed and retaken; photos reviewed, deleted and retaken; afterwards 3 photos and 1 video, one file each, all unchanged since capture, no capture in the cache |
| 8.1 | Capture, step 5: no gallery, file, import or skip path; not a share target | **Pass** | 2026-10-10 (`VAL-066`): Parakh absent from the Gallery's share list; the manifest accepts only the launcher and `parakh://` links. **Finding F-3** (code, while preparing the permission re-test): no refresh on return from Settings, and Settings wording while Android could still ask — fixed (`VAL-067`) |
| 8.1 | Permission re-test (after Hassan set Camera and Microphone to Don't allow) | **Pass** | 2026-10-10 (`VAL-068`, `VAL-069`): for each, the refusal explained before Android's prompt; one more refusal and Android stopped asking, so Open settings appeared; allowed in Settings, the screen updated on return without reopening (the F-3 fix). The first-time explanation is not reproducible on the phone without an app-data change (not approved); covered by Jest |
| 8.1 | Capture, step 6: files from the Mac | **Pass** | 2026-10-10 (`VAL-070`): 4 of 4 files with the recorded size and SHA-256, each readable only by Parakh; nothing in the cache; nothing owned by Parakh in shared storage |
| 8.1 | Capture, step 7: the draft survives closing Parakh | **Pass** | 2026-10-10 (`VAL-070`): a new process; the same draft and identical records; every file re-hashed equal |
| 7.7 | Backups | **Pass** (step 4 not applicable) | Step 3 (`VAL-058`): after a Google backup on the phone, Parakh is not among the backed-up apps. Steps 1–2: 2026-10-09: no `ALLOW_BACKUP` flag on the phone; in the APK `allowBackup=false`, and the data-extraction and backup rules exclude all nine storage domains under `cloud-backup`, `device-transfer` and `full-backup-content`. Step 4 applies only to a store-installed build |
