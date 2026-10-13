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

**Terminal 2 — Metro**, which serves the app's JavaScript. Leave it running. **With `CI=1` Metro does not watch for file changes, so it keeps serving the code it built when it started: after every code change, stop Metro, start it again, and restart the app.** (On 12–13 Oct the phone ran a day-old bundle because of this; see finding F-5.)

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

CIT-09 opens from CIT-08's **Continue**.

**Start a report the real way (`T-048`):**
1. On Home, tap **Report an issue**. Expected: the five Home choices each have a picture and a label, and only Report an issue works.
2. CIT-07 shows six picture tiles, each with a label: Water, Road, Drainage, Streetlight, Waste, Something else. Choose one. Expected: CIT-08 opens on a new draft.
3. Take one photo, then **Continue**.

(`parakh://dev-capture`, as in §8.1, still works.) **CIT-09 changes the draft it opens**: it adds a recording or typed text to it. The photos and the video are not touched.

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

### 8.2b Where the issue is (`T-051`; `DG-30`, `DG-73`, `DG-77`, `DG-79`, `DG-81`, `DG-82`)

CIT-10 opens from CIT-09's **Continue**. There is no map and no address search. The location is saved to the draft as it is set.

1. **Location, explained first.** The phone has location *Not allowed* (§7.6). Expected:
   - the explanation and **Allow location**;
   - Android asks only after the tap. Choose *While using the app*.
2. **The current position.** Stand near a window or outdoors. Expected:
   - *Finding your position…*, then *Your phone's current position*;
   - latitude and longitude with six decimals;
   - *Accuracy reported by your phone: … m*, with the note that the real position may be that far away. The value is the phone's own, never rounded down.
3. **Directional buttons** (5 m per press). Press **North** twice. Expected:
   - *You moved the position about 10 m from what the phone measured*, with the measured latitude and longitude shown below it;
   - **Back to the measured position** returns to the measured coordinates, and the note goes away.
4. **Restart.** Close Parakh from Recent apps, reopen it, and go back to CIT-10 through the entry, CIT-08 and CIT-09. Expected: the same location, shown at once without finding the position again.
5. **Optional — no location.** In Android Settings, set Parakh's location to *Don't allow*, then come back. Expected:
   - *Precise GPS coordinates are not available*, with **Speak** and **Type** offered equally and neither selected;
   - tap **Speak**: *You can record for up to 60 seconds*. Record a few seconds naming the street and a landmark, then **Stop recording**. Expected: *Your spoken description of the place*, **Play**, **Delete recording**; **Continue** is enabled with no typing (`DG-77`);
   - tap **Type**. Expected: a warning that it deletes the spoken description. Tap **Keep it**;
   - the screen says the report will state that coordinates were not available.
   - Allow location again afterwards if you wish. **Find my position again** then asks before replacing the description with coordinates; **Use the position** deletes the spoken description.
6. **Continue** opens CIT-11, the review (§8.2c).

The last known position (used when no current fix arrives within 20 seconds, and only if it is at most 30 minutes old) is hard to force on a phone. Jest covers it (`VAL-079`, `VAL-082`). So does a location recording stopped by the recorder at 60 seconds; to try that on the phone, let one run without tapping Stop.

### 8.2c Check the report, then Submit (`T-062`; `DG-62`, `DG-65`, `DG-84`, `DG-85`)

CIT-11 opens from CIT-10's **Continue**. The phone must be online: the texts are made on the server. The development backend uses a **SIMULATED** AI, and the screen says so.

1. **Named stages.** Expected: *Uploading* (with a percentage), then *Processing your recording*, then the texts. No spinner without words.
2. **The texts.** Expected:
   - three texts — *What the AI heard*, *Urdu*, *English* — each marked **AI-generated**;
   - *Version 1*;
   - the category, the photo thumbnail, the location with the phone's accuracy, and **Play original**.
3. **The question.** The simulated AI is unsure about one detail. Expected: *A question about one detail*, with the field and **Play original**. Tap **Yes, this is right**. Expected: *Corrected — please check again*, *Version 2, replacing version 1*.
4. **A correction (optional).** Tap **Correct this text** under English, change a word, **Save the correction**. Expected: a new version; the English text is marked **Your correction**; the other two stay **AI-generated**.
5. **Confirm.** Tap **These texts are correct**. Expected: *Ready to send* and *Nothing is sent until you press Submit.* Nothing is sent yet: the backend console shows API-135, not API-140.
6. Continue with §8.3 (Submit online) or §8.4 (Submit offline).

### 8.3 Successful submission (`FR-PUB.28`; `DG-85`)

1. With the phone online, press **Submit**. Expected (CIT-13):
   - *Report received* and *Your report was received successfully.*;
   - the reference, such as `PRK-…`, large and left-to-right;
   - *You can track its status in My Reports.* — and **no** expected time or date of any kind;
   - the item leaves the drafts list;
   - `ls files/parakh-drafts-media` no longer shows its files.
2. On the Mac, the backend console shows API-140 once.

### 8.4 Offline submission, reconnection and retry (`DG-14`, `DG-65`, `DG-67`)

> **Airplane Mode alone does not make the phone offline for these tests**: the USB tunnel to the backend (`adb reverse tcp:8000`) still works. Remove it with `adb reverse --remove tcp:8000` for the offline steps, and restore it afterwards. On 13 Oct a small relay on the Mac (phone port 8000 → relay → backend) was used instead: it can refuse every request, delay uploads, or pass a Submit and drop the answer.

1. Do §8.2c up to *Ready to send* online, then turn on **Airplane mode** and press **Submit**. Expected (CIT-12):
   - *Waiting to send*, and *Not sent yet* — never a saved draft, and no reference anywhere;
   - **only Retry and Cancel**; there is no Edit (`DG-84`).
2. Press **Retry** while still offline. Expected: *Still not sent. Parakh will try again.*
3. Turn Airplane mode off and stay on the screen. Expected: within about 30 seconds to a few minutes (the backoff), the report is sent once and CIT-13 opens with its reference. **Retry** sends it at once.
4. **Cancel (optional, a second report):** on CIT-12, tap **Cancel**. Expected: a question first; **Yes, cancel it** returns to Home.
5. **Lost answer:** stop the backend just after pressing Submit, then start it again. Expected: the app asks the server for the status first, and **no second report** is created. Check the backend console.

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
| 8.0 | Setup (2026-10-12): migrations, backend, Metro, adb reverse, expiry of the `T-049` draft, account, code version | **Pass** | Migrations `drafts` 0005–0007 and `reports` 0003–0004 applied to the development database after a backup (the staff tables were not applied); the `T-049` draft had expired (`expires_at` 11 Oct 15:57Z) and the app deleted it on the first launch, with its files; signed in as the designated test number; Metro served `main` at `14a2b16` with a clean tree and `--clear` |
| 8.2 | Home, category and photo (CIT-06, CIT-07, CIT-08) | **Pass** | 2026-10-12: five tiles with pictures and labels; six category tiles in order; one photo saved (1 of 3) |
| 8.2 | CIT-09 steps 1–9 | **Pass** | 2026-10-12 (`VAL-092`): two equal ways, microphone already allowed, recording kept as one `.m4a` beside the photo with nothing left in the cache, play/pause/restart, record again and delete, every switch warned first, the draft survived a restart with the same text, and a recording stopped by itself at 3:00 (1,476,969 bytes ≈ 180 s at 64 kbit/s) |
| 8.2b | CIT-10 steps 1–4 | **Pass** | 2026-10-12: the explanation before Android asked; current position with accuracy 19 m; two North presses ≈ 10 m with the measured position kept, Back restored it, one press ≈ 5 m; the adjusted and measured positions came back at once after a restart. Step 5 (no-location Speak/Type) **not run** (optional) |
| 8.2c | CIT-11 steps 1–2, 3 and 5 | **Pass** | 2026-10-12: Uploading, Processing, the question; three AI-marked texts, Version 1, simulated notice, thumbnail, location, Play original. **Observation O-1:** on report 1 the confirmation was tapped by accident with the question unanswered, so the question path was tested on report 2: Yes → Version 2 replacing version 1 → confirm → Ready to send (server: Version 1 kept inactive, Version 2 active, one confirmation of it). Step 4 (correct a text) **not run** (optional) |
| 8.3 | Submit online → Received | **Pass** | 2026-10-12: `PRK-FQ87-P6HR`, selectable, "You can track its status in My Reports.", no time estimate. Server: one `POST /citizen/reports`, state SUBMITTED, photo and a 180 s recording sealed, measured and adjusted positions kept; phone: 0 draft files, 0 local drafts |
| 8.4 | Offline Submit → Waiting to send; Retry offline | **Pass** | 2026-10-12: Airplane Mode on and the USB tunnel to the backend removed on purpose (otherwise the phone still reaches the Mac in Airplane Mode); Waiting to send with only Retry and Cancel, no Edit, no reference; the server had no new report; Retry offline: "Still not sent" |
| 8.4 | Automatic retry after connectivity returns | **Fail, fixed, re-test Pass** | **Finding F-4:** the retry due 12:08:44Z never ran (attempt count and server unchanged). Reproduced in Jest: a queue started before Submit has no timer after Submit, Retry or Cancel, and two-minute timers are unreliable on Android. Fixed in `6f55d01` (re-armed on every change; wakes at least every 30 s), with two regression tests. Re-test: after a restart the queue tried at once (backend unreachable), then sent by itself at 12:25:30Z (status check, then `POST /citizen/reports` 201): `PRK-WH64-095F`, Received opened by itself, no duplicate, 0 draft files |
| — | **Observations** (nothing changed) | — | **O-1** Confirm is available beside an unanswered question (FR-PUB.18 asks the question; it does not say it must be answered first). **O-2** the creation audit event is `report_created`; RBAC §9.2 T1 names `report_submitted`. **O-3** two confirmations of Version 1 on report 1, 3 min 25 s apart; Hassan may have left and re-entered the review, and is not sure; the log shows the review prepared again 8 s after the first. **Gap G-1:** after a restart no screen leads back to a report that is waiting to send (My Reports, `T-063`, is not built); a development link was used. The USB cable dropped once and the phone was restarted once; both lose the `adb reverse` links, and the draft survived both |
| 8.2b | CIT-10 step 5: no location, Speak and Type | **Pass** | 2026-10-13 (`VAL-093`): with Location refused from the start, neither way preselected and Continue disabled; a spoken place stopped by itself at 60 s (59.9 s recorded); every switch warned first; a typed place kept as typed; the report with only a spoken place (`PRK-X1FJ-H298`) has no coordinates, is unverified, and its place recording is sealed. A saved position was **not** replaced by Keep it (twice). **Observation O-4:** once a position is saved and the permission is later refused, no control leads back to a description (Find my position again needs the permission); not changed. **Observation O-7:** once, the location screen showed no place, no Speak/Type and a disabled Continue after Find → Keep it twice; not reproduced after reopening the draft, and the same sequence passes in Jest (a regression test was added); unexplained |
| 8.5 | Interrupted upload | **Pass** | 2026-10-13: a video of 70 chunks; the connection was cut after chunk 35 (the screen said *Waiting for connection*, six automatic retries were refused, nothing reset); on return all 70 chunks were accepted exactly once, none sent twice, and the review loaded |
| 8.2c | CIT-11 step 4: correct a text | **Pass** | 2026-10-13: *No, correct the text* saved a correction; Version 1 stayed on the server, inactive and unchanged; each correction made a new active version replacing the last; the edited text was marked as the reporter's own, the other two stayed AI-generated; one confirmation, naming exactly the version shown (Version 3), and no report until Submit. **Observation O-5:** two corrections were saved (Versions 2 and 3); Hassan is not sure whether he saved twice; cause not assumed |
| 8.4 | Cancel on Waiting to send | **Pass** | 2026-10-13: the question first (*No, keep it* changes nothing); *Yes, cancel it* offline kept the report with the cancel pending; after reconnecting the server dropped the draft and all its uploads, no report was created, the phone kept nothing, and the earlier reports were untouched |
| 8.4 | Step 5: the lost answer | **Pass** | 2026-10-13: the relay passed Submit and dropped the server's answer: the server created `PRK-X1FJ-H298` (201); the app queued it as *outcome unknown*, then checked the server first and replayed (200, not 201) and showed the same reference; exactly one report |
| 8.6 | Step 1: closing the app and restarting the phone | **Pass** | 2026-10-13: the waiting report survived a restart with the same Submit time, the same deadline (15 Oct 01:45:55Z), 5 attempts and all 7 files. **Observation O-8:** a development link sent while the app was still starting after the restart was lost; resending worked (test tool only) |
| 8.6 | Step 2: the 48 hours end | **Pass** | 2026-10-13: with the phone's clock moved to 15 Oct 07:05 and the server unreachable, the pending report and two older abandoned drafts were removed from the phone with all their files, nothing was sent, and three notes asking the server to drop its copies were queued; after the clock was set back and the connection returned, the notes reached the server (two 204, one 404 for a draft never uploaded): all three drafts cancelled with no evidence kept; three reports untouched. **Observation O-9:** the screen said the report is no longer waiting on this phone; the sentence about 48 hours (`queued.removed`) is shown only when the removal follows a button press |
| — | **Finding F-5 (not an app fault)** | **Cause found** | After the fix for F-4 (`6f55d01`), the automatic retry still did not run twice on 13 Oct (the cancel at 06:03, the lost-answer retry at 06:16). The phone's cached bundle was 7,233,192 bytes on 12 Oct 05:47 and again on 13 Oct 06:26, and the fix was committed on 12 Oct 17:13: **Metro (CI mode, no file watching) kept serving the old bundle, so the phone never ran the fix.** After a Metro restart the new code loaded and, in the same scenario, the timer woke every 30 s and retried on time (read from the relay log over 5 minutes). A/B: with the camera deliberately left open in the background the timer stayed healthy, so F-6 is not the cause. The 12 Oct re-test passed because a restart also arms the old code's timer. **The cancel and the lost-answer recovery were completed after a foreground event on the old bundle; they were not re-run on the fixed bundle** (Jest covers both timer paths) |
| 8.1 | **Finding F-6 (fixed)** — the camera stays open under later screens | **Fixed, Pass** | Found 2026-10-13: the photo screen stays mounted under later screens and its `CameraView` kept the camera open (`dumpsys media.camera`: Parakh an active client while on the description and Received screens) and the screen awake. Fixed: the camera is mounted only while its screen is in front (`active`, from navigation focus); regression test fails without it. On the phone: 1 active client on the photo screen, `Device 0 is closed` on the next screen |
| 8.4 | Re-run on the fixed code: Cancel recovery by the timer alone | **Pass** | 2026-10-13 (`VAL-094`), Metro restarted and the phone's own bundle checked for the fix, the screen held awake, no foreground or background nudge: with the connection down, Submit and the cancel were refused; 13 s after the connection returned the queue sent the cancel by itself (`DELETE` 204); the server cancelled the draft and dropped its uploads, no report was created, the phone kept nothing. **The first run (27 s, also automatic) found finding F-7:** the screen still showed *Cancelling. This finishes when the phone is connected* after the cancel had completed, instead of *no longer waiting on this phone*; fixed in `cae798e` (an informational line is dropped when the report leaves the phone; regression test fails without it) and re-tested on the phone: **Pass** |
| 8.4 | Re-run on the fixed code: lost-answer recovery by the timer alone | **Pass** | 2026-10-13 (`VAL-094`): the relay passed Submit and dropped the answer (the server created the report, 201); the screen showed Waiting to send; 15 s later, with no nudge, the app checked the server (`GET`), replayed the Submit (200, not 201) and showed `PRK-3XQW-STKF`, the same reference; exactly one new report (four in all), one `report_created` event each, audit chain intact |
| — | **Citizen flow: physically validated on Android** | **Yes** | Every required step of §8.1–§8.6 has passed on the Samsung SM-A546E (Android 16, 4 KB pages) against the development backend with SIMULATED SMS and AI: the flow from Home to a PRK reference, the offline queue, the retries by the timer alone, the lost answer, Cancel, the 48 hours, restarts and interrupted uploads. **Not covered:** a 16 KB-page phone, iOS, a real SMS or AI provider, real citizens, and the staff side. Open observations are listed above (O-1 to O-5, O-7 to O-9, G-1) |
| 8.7 | My Reports (CIT-14), connection on | **Pass** | 2026-10-13 (`VAL-095`): Home's *My reports* tile opens it; the four reports then on the server listed newest first, each with a picture and the approved word (*Received*), the reference, the problem and the date; no state code; a sent report opens nothing (detail, CIT-15, is not built) |
| 8.7 | My Reports with no connection | **Pass** | 2026-10-13: the notice *No connection. Showing what this phone last saw, and what is waiting here.* and the same reports from the in-memory list; a *Waiting to send* section on top with a row that has no reference and says it is not sent yet; the *Sent reports* section apart below it; tapping the waiting row opens Waiting to send |
| 8.7 | My Reports: an unfinished draft | **Pass** | 2026-10-13: a *Not finished* section with its own row (no reference, *Finish and send when ready*, a *Continue* link); tapping it went on at the photo screen with the saved photo |
| 8.7 | **Finding F-8 (fixed)** — Back from Waiting to send reached the reporting steps | **Fixed, Pass** | Found by Hassan 2026-10-13: Android's Back from Waiting to send reached the category screen of the report just submitted, which looks like a way to change a waiting report (`FR-PUB.29`, `DG-84`). The report's own screens were still stacked under it. They cannot change a submitted report (each says *already sent, cannot change*, and the category screen starts a new report), but the path was misleading. Fixed in `89ead07`: Waiting to send and Received open on top of Home with those screens removed, and every route to Home clears the stack; helper test. On the phone: Open from My Reports → Back → My reports → Back → Home, and Submit → Back → Home: **Pass** |
| 8.7 | Check 5: connectivity returns | **Pass** | 2026-10-13: the newer waiting report was sent by the timer at its scheduled time (status check, then `POST` 201, `PRK-56HP-NVNA`); the older one, whose retries had backed off to 30 min, was sent by *Retry* (`PRK-WN8P-S7V5`); My reports showed the waiting rows turn into single sent rows with no duplicate, and the unfinished draft stayed. Server: six reports, six creation events, six distinct references, audit chain intact; the phone kept only the unfinished draft. **Observation O-10:** Waiting to send has no on-screen way out except Android's Back |
