# Current State

| Field | Value |
|---|---|
| Updated | 2026-10-13 (Asia/Karachi), after the A-01 citizen evidence privacy fix passed 257 backend tests and independent Claude Code review (`T-129`, `VAL-096`) |
| Active working location | `PARAKH/` on the Desktop — the only one (found renamed from `PARAKH PROJECT/` on 2026-10-09; same repository, history and remote). The Documents clone is an inactive backup |
| Branch | `fix/a01-citizen-evidence-privacy` — dedicated checkpoint branch; `main` remains unchanged pending Hassan's merge authorization |
| Last verified milestone | **M0 complete** (`VAL-010`). M2/M3 work is In Review or In Progress — see below |
| Current task | **A-01 citizen evidence privacy boundary is fixed and independently reviewed** (`T-129`, `VAL-096`): API-151 and citizen evidence content return only the exact report-originating citizen submission's original evidence. The full backend suite passed 257/257. **Stop point:** await Hassan's acceptance and authorization before CIT-15. The interactive-map request is a proposed change to DG-30/DG-73 and requires a separate provider/licensing/cost/offline/privacy decision before implementation. The staff side waits for `DG-86`–`DG-92`. ([NEXT_TASK.md](NEXT_TASK.md)) |

## Repository

- **GitHub:** `hassanjalal789/parakh-civic-tech`, **private**, created on 2026-10-04 after Hassan deleted the earlier repository.
- **History:** starts from one initial commit. The earlier commit history is kept locally and is not published. Commit hashes quoted in older records refer to that local history.
- **Kept locally and git-ignored:**
  - `README_SETUP.md`, `SRS/SOURCE_IMPORT_MANIFEST.md` and the `SRS/` snapshot copies;
  - the two August planning documents (S-24, S-25);
  - `backend/.venv/`, `backend/.local/` and `mobile/node_modules/`.

## Decisions of 2026-10-11 (Hassan Jalal)

| Decision | ID |
|---|---|
| The first version's location: GPS, latitude and longitude with the reported accuracy, directional buttons, no external map or address lookup. **The SRS text that conflicts (`FR-PUB.24` dragging, `GET /geo/reverse`, the start point when location is refused) is unchanged and asked of Hassan** | `DG-30`; `DG-73` (open) |
| A video includes sound: the microphone is required for video; refused or unavailable, no video and never a silent one; photos stay available | `DG-71` |
| The capture settings are kept: about 3 MP at 70 % for photos, about 4.5 Mbit/s for video | `DG-72` |

**Applied:** Mobile SRS v2.6.0 (25 asserted edits; no requirement statement changed; `TBD-M18` opened). A video without a sound track is now refused on the phone and by the server (`VAL-071`).

**Later the same day:**

| Decision | ID |
|---|---|
| A recording is AAC in MPEG-4, mono, 64 kbit/s, at most 3 minutes | `DG-74` |
| Location: current GPS, else the last known position, else a written description (no pilot-area coordinate); the measured position kept beside any adjustment; no map or address lookup | `DG-73` |
| The server accepts MPEG-4 recordings only | `DG-75` |
| Accepted typed text is kept exactly as written | `DG-76` |

**Applied:** Mobile SRS v2.7.0 (34 asserted edits; `FR-PUB.24` restated, with its v2.6.0 text quoted; `TBD-M18` resolved, `TBD-M19` opened). The location data model is on the server and the phone (`VAL-077`), and the server changes are made (`VAL-078`). **Reported, not overridden:** `NFR-28` against the written description (`DG-77`). **Flagged:** who may see the measured position (`DG-78`).

**Then:** `DG-77` — without coordinates the location may be described by voice (kept as evidence, never interpreted by AI; typing never required; `NFR-28` preserved). `DG-78` — authorized staff see the measured and the final position as two distinct values, with the device's accuracy. `DG-81` — 5 m per press, 20 s, 500 characters, the best practical accuracy, the device's accuracy shown. **Applied:** Mobile SRS v2.8.0 (33 asserted edits; `TBD-M19` resolved, `TBD-M20` opened); evidence kind `location_voice`; Speak and Type on CIT-10 (`VAL-080`, `VAL-081`).

**Then:** `DG-79` — a spoken location description lasts at most 1 minute, on the phone and the server. `DG-80` — contractors see only the final reported location. `DG-82` — a last known position is used only if it is at most 30 minutes old. **Applied:** Mobile SRS v2.9.0 (27 asserted edits; `TBD-M20` resolved, `TBD-M21` opened); `VAL-082`, `VAL-083`.

**Then:** `DG-84` — waiting to send (CIT-12) offers only Retry and Cancel, never Edit. `DG-85` — Received (CIT-13) shows the confirmation, the `PRK-` reference and "You can track its status in My Reports.", with no expected response time, resolution time or SLA. Both change an approved statement (`FR-PUB.29`, `FR-PUB.30`); **Applied:** Mobile SRS v2.11.0 (20 asserted edits, the v2.10.0 statements quoted; `VAL-088`) and the screens (`VAL-087`).

**Earlier:** `DG-83` — without coordinates a contractor may receive the written location description, never the spoken location recording. A voice-only location stays identifiable for an authorized staff workflow. **Applied:** Mobile SRS v2.10.0 (20 asserted edits; no requirement statement changed; `TBD-M21` resolved); the API contract; acceptance criteria of `T-096` and `T-095` (`VAL-084`).

## Decisions of 2026-10-07 (Hassan Jalal)

| Decision | ID |
|---|---|
| A submitted report goes to the server and into the standard verification workflow; an unsubmitted local draft is kept for at most 48 hours | unchanged; `DG-64` confirmed |
| A pending submission is retried for up to 48 hours from the original submission attempt (the first press of Submit), shown apart from saved drafts as **not yet confirmed**, and **deleted from the phone** if it still cannot be completed. This supersedes `DG-14`'s "keep the local draft" | `DG-67` (resolved) |
| Server clean-up of abandoned temporary data: **72 hours without activity, approved**, never while an upload or a processing job is still active; separate from the device's 48-hour rules | `DG-57` (resolved) |
| Local Parakh data kept out of device and cloud backups wherever the platform allows it: Android now, iOS with the Xcode build | `DG-59` (resolved) |
| `DR-26`: explain before changing anything — then decided the same day: **`DR-26` remains in force**; the `SC-10` amendment of 6 October is owner-approved, for citizen-side drafts and pending submissions only; no other control weakened | `DG-66` (resolved), [review](../planning/DR-26_REVIEW.md) |
| Encryption and storage at rest of future staff, Union Council, contractor, Mayor and administrative data: **not decided**, brought back when those features are built | `DG-68` (open) |
| A physical Android phone is available for testing | `T-021`, `T-046` |

**Applied on 2026-10-07:**

- Mobile SRS v2.4.0 (25 asserted edits; v2.3.0 unchanged). The change record flags the contradictions the decisions resolve: `DG-14`/`FR-PUB.28`, `FR-COMMON.12` (legacy `FR-OFF-003`–`005`) and `DG-65`.
- **Device:** a pending submission is deleted at `submission_expires_at = submission_requested_at + 48 h`, after a last status check where the server can be reached. Android backups and device transfers exclude every storage domain. Session tokens are stored for this device only.
- **Backend:** the start and end of a processing job count as activity.

## Decisions of 2026-10-06 (Hassan Jalal)

| Decision | ID |
|---|---|
| Report text by speaking or typing — two equal ways | `DG-61` |
| Report text in Urdu and English; the reporter confirms the transcription and every translation; AI only on the server, never changing confirmed text, approving a report or replacing verification | `DG-62` |
| No app encryption for local drafts and their media (`DR-23` superseded for them); the captured file is used directly; no unlock key or lost-key reset; tokens, HTTPS, account isolation, server authorization and OS protections unchanged | `DG-63` |
| Unsubmitted drafts and their local media are deleted 2 days after creation; editing never extends it | `DG-64` |
| Submission only on an explicit Submit; 48-hour retries; status check before a retry or a deletion; no duplicates | `DG-65` |
| Verification sequence unchanged; server clean-up timing separate, 72 h still not approved | `DG-56`, `DG-57` |

Raised on 2026-10-06 and decided on 2026-10-07: whether amending `SC-10` lapses the `DR-26` override (`DG-66`: it does not) and how long an unconfirmed submission is kept after its 48 hours (`DG-67`: it is deleted).

**What the code does today, against these decisions:**

- **The backend follows them** (`T-127`, `VAL-037`; review finding R-007 fixed in `VAL-038`, so renderings made before 6 October are re-queued and can no longer become reports). Every version carries the transcription, the Urdu text and the English text under one hash; a typed text is kept verbatim; AI never overwrites the reporter's text; the confirmation names every text; the report carries both languages; server clean-up is no longer tied to the retry window.
- **The device follows them** (`T-047` and `T-128` In Review, `T-052` In Progress; `VAL-039`–`VAL-042`):
  - drafts are plain app-private SQLite with no key, bound to the account;
  - the capture file itself is the evidence, moved and never copied;
  - `expires_at = created_at + 48 h` is fixed at creation, and an expired unsubmitted draft is deleted with its files;
  - the 5 October encrypted drafts move once, and a store whose key cannot be read is left untouched;
  - nothing is submitted without Submit, with 48-hour retries, status checks, cancellation and no duplicates;
  - *(2026-10-07)* a pending submission is deleted 48 hours after Submit, and no Parakh data goes into Android backups (`VAL-043`–`VAL-045`).
- **Not yet in the app:** no reporting screen uses the store or the queue, so they run only in the self-check and in tests.

## Decisions of 2026-10-04 (Hassan Jalal)

| Decision | ID |
|---|---|
| 1–3 live photos per report; photos are mandatory again (supersedes DG-09) | `DG-47` |
| One optional live video of up to 60 seconds | `DG-54` |
| Uploads before final submission are temporary processing data; cancellation removes them | `DG-55` |
| Automatic submission retry for 48 hours from the first final-submission attempt | `DG-14` |
| Typed reports get an Urdu rendering and the reporter's confirmation | `DG-53` |
| Verification sequence: Street Representative, then UC Officer | `DG-56` |
| Android development tools approved | `T-022` |

Requirements now follow **Mobile SRS v2.5.0** (7 Oct); v2.4.0, v2.3.0, v2.2.0 and v2.1.0 are kept as superseded baselines. **The backend follows these decisions** (`T-122`…`T-125`, In Review). On the mobile side, the encrypted store enforces the same evidence bounds (1–3 photos, one video of up to 60 s), but **there are no reporting screens yet**.

## Implementation status

| Area | State | Tasks |
|---|---|---|
| Backend skeleton | Django 6.1.1 + DRF 3.18.1. Environment-driven settings, deny-by-default Bearer auth. SQLite only | `T-027` In Progress |
| Citizen OTP sign-up / sign-in (backend) | API-121 / API-122 with every server-side rule | `T-037`…`T-041` In Review |
| Citizen report pipeline (backend) | API-130…API-135, API-140, API-150, API-151 and five path-named routes. 1–3 photos, one optional video ≤ 60 s, voice or typed text rendered and confirmed, temporary data with cancellation and expiry after 72 hours without activity (`DG-57`, approved; a running job counts as activity, `VAL-046`), evidence sealed at submission, own reports with the uniform 404, the state machine with no skipped stage. Contract in `docs/api/CITIZEN_REPORTING_CONTRACT.md` (bodies PROPOSED) | `T-036`, `T-053`, `T-054`, `T-056`, `T-057`, `T-060`, `T-061`, `T-122`…`T-125` In Review; `T-048`, `T-063` In Progress |
| Audit, log hygiene | Hash-chained audit trail; no OTP or number in logs; every log handler redacts credentials, idempotency keys, codes and numbers. Audit database role pending (PostgreSQL) | `T-029` In Progress, `T-030` In Review |
| Mobile skeleton | Expo SDK 57 / RN 0.86.3 / React 19.2.3 in `mobile/`. Config, lint, format and tests all pass. **The debug development build runs on an Android 16 emulator** and renders CIT-01 (`VAL-032`). One debug APK now holds both phone and emulator code (`VAL-044`). *(2026-10-09)* **Runs on a physical phone** (Samsung SM-A546E, Android 16, 4 KB pages): installed (`VAL-048`), first launch to CIT-01 passed (`VAL-049`). No iOS build | `T-031` In Review, `T-022` In Review |
| Local draft store | `mobile/src/storage/`: app-private SQLite **without app encryption** (`DG-63`), drafts bound to the account, the capture file used directly (moved, never copied), a 2-day lifetime fixed at creation (`DG-64`), a pending submission's 48 hours from Submit (`DG-67`), no Android backups (`DG-59`), crash recovery, and a one-time move of the 5 October encrypted drafts. Jest (`VAL-039`, `VAL-040`, `VAL-043`, `VAL-044`) and two emulator runs (`VAL-042`, `VAL-045`); `VAL-033`/`VAL-034` are the encrypted store's history. No screen uses it yet | `T-047`, `T-128` In Review; `T-046` In Progress (phone set up, its tests pending) |
| Submission queue | `mobile/src/services/submissionQueue.ts`: Submit only, recorded before the first request; a status check after a lost response; one idempotency key; a 48-hour window from Submit with backoff, then deletion after a last status check (`DG-67`); cancellation that never claims a false result; one account per queue (`VAL-041`, `VAL-043`). Not used by a screen; the upload client does not exist yet | `T-052` In Progress; `T-055` |
| API client | Transport classes, acting-role refusal, fail-closed unmatched requests, error catalogue, HTTPS-only release | `T-033` In Review |
| CIT-01…CIT-05 | Language, disclosure, three consents, number, OTP. Component-tested and contract-checked against the dev backend | `T-042`, `T-043` In Review |
| Sessions on the device | Tokens in secure storage only; sign-out; restore. One shared refresh on 401, then one retry; a failed refresh signs out with a plain notice on CIT-01. Contract-checked against the dev backend, including replay revocation | `T-044` In Review |
| i18n | ur/en parity tested. **Urdu is an unreviewed machine draft.** No font, no app-wide RTL | `T-032` In Progress, `T-045` |
| SMS | **Simulated** console adapter, development only. Nothing is sent. In development, sign-in accepts only the designated test numbers (`DG-70`, `VAL-059`); test and production are unaffected | `DG-15`, `DG-70` |
| CIT-08 live capture | `mobile/src/screens/EvidenceScreen.tsx`: in-app camera only, 1–3 photos and one video of up to 60 s, the hash at capture, the camera's file moved into the draft, the video's length read from its container, permissions explained first, storage checked first, review/retake/delete. Jest (`VAL-060`); on the phone, steps 1–2 passed (`VAL-061`) and finding F-2 — a video stopped at 26 s by the 40 MiB limit — is fixed with a proposed bitrate and re-tested on the phone (`VAL-062`–`VAL-064`); opens from `parakh://dev-capture` until CIT-07 exists. Steps 4–7 and a permission re-test passed (`VAL-065`–`VAL-070`; fix F-3) | `T-049` In Review; `DG-71`, `DG-72` |
| CIT-06 Home and CIT-07 categories | Home: five picture-and-label tiles, Report an Issue working, the other four marked not yet available. CIT-07 (`src/screens/CategoryScreen.tsx`): the six categories of FR-PUB.2, offline; choosing starts the LOCAL_DRAFT and opens CIT-08. Jest (`VAL-085`). Pictures are placeholders; Home counts come with My Reports | `T-048` In Progress |
| CIT-09 speak or type | `mobile/src/screens/DescribeScreen.tsx`: Speak and Type as equal choices, neither pre-selected, no language picker; the microphone explained first and typing kept when it is refused; the recorder's own file hashed, moved into the draft and its length read from the file; play, pause, record again, delete; typed text kept exactly as written (4,000 characters at most); switching deletes nothing without confirmation. Recordings (`DG-74`, decided 2026-10-11): AAC, mono, 64 kbit/s, a hard maximum of 3 minutes, enforced on the device and the server (`VAL-074`). CIT-08 now lists only photos and the video. Jest (`VAL-073`, `VAL-074`); the phone test (§8.2) runs after the `T-049` test draft expires (20:57 PKT, 11 Oct), on a new draft. Opens from CIT-08's Continue | `T-050` In Progress; `DG-74` |
| Evidence upload (device) | `mobile/src/services/evidenceUpload.ts`: every kept file re-hashed before sending; 256 KiB chunks in order; resumes from the count the server confirmed (API-133); damaged chunks sent again (3 tries); one more round at completion. Not wired to a screen. Jest (`VAL-075`); not yet run against the real backend or on a phone, because API-130 needs a category (`DG-43`) and a location (`DG-73`) | `T-055` In Progress |
| Location data (`DG-73`) | Server: `measured_*` (what the phone measured, kept unchanged), `reported_*` (what the citizen confirms), `location_description` (when there are no coordinates), with the source and the unverified flag derived; migrations `drafts` 0005 and `reports` 0003; a database check gives every report a location. Phone: migration 3 (columns added only), `setLocation`, `src/domain/location.ts`. `VAL-077`. **CIT-10** (`src/screens/LocationScreen.tsx`): the current GPS position at once when allowed, the last known position with its age, a written description, directional buttons (5 m, `DG-81`) that keep the measurement, the location by voice or in writing without coordinates (`location_voice`, `DG-77`), the device's accuracy as reported, no map or address lookup; Jest (`VAL-079`); phone test §8.2b pending | `T-051` In Progress |
| AI rendering | **Simulated** adapter, development and test only. It does not listen to the recording; its text says it is simulated and every artefact is marked `simulated` | `DG-16`, `DG-48` |
| CI | GitHub Actions workflow for the backend, mobile and tracker checks. Read-only permissions, no secret. Run #1 passed all three jobs (`VAL-024`) | `T-034` In Review |

## Verified (2026-10-04)

| Check | Result |
|---|---|
| Tracker `--check` / `--validate`, tracker tests (16), import dry-run, `extract_requirements.py --check` | OK — 123 tasks, 57 decisions, 27 checks; FR 124, NFR 86, SC 12 against SRS v2.2.0 (`VAL-028`, `VAL-029`) |
| CI on GitHub | Run #1 (commit `4149022`): backend, mobile and tracker jobs passed (`VAL-024`) |
| `backend/.venv/bin/python backend/manage.py test parakh` | **154 tests, OK**; 23 integrity mutations in total, each caught (`VAL-025`, `VAL-026`, `VAL-031`). The review's three 500s were reproduced and fixed |
| Production start-up, by real process start-up | Refuses unset or development-only SMS, evidence-store and AI adapters; with all named, stops only at the missing PostgreSQL driver. `manage.py check`: no issues (`VAL-027`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · Jest 60 passed, 2 opt-in skipped (`VAL-021`) |
| Live contract check against the dev backend (refresh, replay) | 2 passed (`VAL-022`) |
| **Device testing** | **None on a phone.** An Android 16 **emulator** run exists (see below); every other result is automated: the Django test client, Jest with mocked or simulated native modules, the contract check from Node, and CI |
| Secret, private-path and personal-data scan of the uploaded files; remote refs | 0 keys, tokens, credentials or home paths; e-mails only npm package metadata; numbers only synthetic fixtures. Remote: only `main` = `41045466`, `HEAD` → `main` (`VAL-020`) |

## Verified (2026-10-05)

| Check | Result |
|---|---|
| First Android development build | `assembleDebug` (x86_64) **BUILD SUCCESSFUL** after five failures, each explained and fixed (`VAL-032`) |
| Emulator run (Android 16, API 36, x86_64, 4 KB pages) | Installs, starts with the New Architecture, renders CIT-01 (`VAL-032`) |
| Storage self-check on the emulator | SQLCipher 4.7.0 community; database file without header or schema text, entropy 7.995 bits/byte, stock `sqlite3` cannot read it; key Keystore-wrapped; media ciphertext only; missing key fails closed with the file unchanged and no new key (`VAL-034`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · **Jest 104 passed**, 2 opt-in skipped; storage suite 44 tests on a **simulated** cipher; 20 mutations, 19 caught, 1 equivalent (`VAL-033`) |
| Review findings R-005, R-006 | Reproduced on the unchanged sources, then fixed; the regressions assert recovery and decryptable evidence (`VAL-033`) |
| Backend suite and live contract | 154 tests OK; live contract 2 passed, including the new `account_id` in API-155 (`VAL-035`) |

## Verified (2026-10-07, after the decisions of that day)

| Check | Result |
|---|---|
| Decisions of 7 October recorded; SRS v2.4.0 by 25 asserted edits; v2.3.0 unchanged; requirement index regenerated (124 FR, 86 NFR, 12 SC) | `extract_requirements.py --check` OK; register and tracker valid |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · **Jest 188 passed**, 2 opt-in skipped (storage 57, submission 27, legacy migration 14, backup rules 3, reporting 27). Mutations of the new logic: **18; 17 caught, 1 equivalent** (`VAL-043`) |
| Android backups | The APK carries `allowBackup=false` and rules excluding all nine storage domains from cloud backup and device transfer; the installed package has no `ALLOW_BACKUP` flag (`VAL-044`) |
| Emulator run 2 | Self-check PASS. With the clock moved: a draft deleted with its file at 48 h, and a pending submission at 48 h after its Submit (`VAL-045`) |
| Backend | **186 tests OK**; the DG-57 safeguard's two mutations caught (`VAL-046`) |
| **Device testing** | **None on a phone yet.** A phone is available; the procedure is ready |

## Verified (2026-10-06 and 2026-10-07)

| Check | Result |
|---|---|
| Decisions of 6 October recorded; SRS v2.3.0 generated by asserted edits; requirement index and tracker valid | `VAL-036` |
| Backend: report text in Urdu and English; R-007 fixed | `backend/.venv/bin/python backend/manage.py test parakh`: **182 tests OK** (re-run 2026-10-07); bilingual and R-007 mutations caught (`VAL-037`, `VAL-038`) |
| `cd mobile && npm run check` | tsc OK · ESLint 0 problems · Prettier OK · **Jest 171 passed**, 2 opt-in skipped. New suites: storage 48, legacy migration 14, submission 22, reporting routes 27 (`VAL-039`–`VAL-041`) |
| Mutations of the new device code | **51; 49 caught, 2 equivalent** (two redundant guards; removing both is caught). Five first survived and each gained a test (`VAL-039`, `VAL-041`) |
| Emulator run of the new store | The self-check passes twice; the real 5 October SQLCipher store (schema only) was moved and its database and key removed; the new database begins `SQLite format 3\0` and stock `sqlite3` reads it without a key (`VAL-042`, `docs/testing/DRAFT_STORE_VERIFICATION.md`) |
| **Device testing** | **None on a phone.** Emulator only |

## Verified (2026-10-09)

| Check | Result |
|---|---|
| Physical Android phone | Samsung SM-A546E, Android 16 (API 36), `arm64-v8a`, **4 KB pages**; adb over USB authorised (`VAL-048`) |
| Install | The debug APK of 7 October installed; identical on the phone to the build output (SHA-256); no `ALLOW_BACKUP` flag (`VAL-048`) |
| First launch | CIT-01 shown through Metro; no crash or JavaScript error in the phone's log (`VAL-049`) |
| §7.1 Urdu and English · §7.2 sign-in, restore, sign-out | Pass (`VAL-050`, `VAL-052`). Sign-out after the 15-minute access token expired refreshed once, then logged out. The clean sign-in used the test number |
| **F-1** | After a restart the app showed English although Urdu was chosen (`FR-AUTH.1`). Fixed (`VAL-051`) and re-tested on the phone: Urdu kept after a restart (`VAL-053`); `T-042` back to In Review |
| Development database | Deleted by Hassan and recreated empty at 14:22, after a sign-in used a number that was not the test number (no SMS is ever sent) |
| §7.3 self-check · §7.4 48-hour rules | Pass (`VAL-054`, `VAL-055`), with the phone's clock moved by hand; the database plain SQLite and app-private; drafts deleted at `created_at` + 48 h and a pending submission 48 h after its Submit, each with its file |
| §7.5 restart · §7.6 permissions | Pass (`VAL-056`, `VAL-057`): items and their deadlines survive a phone restart; camera, microphone and location not granted; no photo, storage or background-location permission |
| §7.7 backups | Pass (`VAL-058`): no `ALLOW_BACKUP` flag, every storage domain excluded, and Parakh absent from the phone's Google backup |
| **Still open for `T-046`** | The 16 KB page-size check (this phone has 4 KB pages); iOS (`T-024`); the §8 tests once the reporting screens exist. **The 16 KB page-size check is not covered by this phone** |

## Unresolved

| Item | ID |
|---|---|
| Ten citizen-auth implementation choices awaiting review | `DG-52` |
| Urdu reviewer (so `T-045` is Blocked); font and project licence | `DG-41`, `DG-44` |
| Target date and weekly hours | `DG-04`, `DG-38` |
| Flutter scaffold removal | `DG-03` |
| Idempotency headers; OTP numbers; consent sign-off | `DG-10`, `DG-13`, `DG-12` |
| GitHub requires two-factor authentication on the account before 10 Nov 2026 (banner seen 2026-10-04). Only Hassan can enable it | — |
| No SMS or AI provider | `DG-15`, `DG-16` |
| Android toolchain installed 2026-10-04 with Hassan's approval; emulator and first build 2026-10-05. **A physical Android phone is set up** (Samsung SM-A546E, Android 16); its first round of tests passed on 2026-10-09. Still missing: a 16 KB page-size check (this phone has 4 KB pages), PostgreSQL/PostGIS + `psycopg`, Redis, Xcode | ENVIRONMENT_CHECK, `T-021`, `T-046` |
| iOS: excluding the drafts database and media from iCloud backup waits for the iOS build; Android 16 QPR2's transfer to iOS is not declared (needs an iOS team id) | `DG-59`, `T-024` |
| The app deletes an expired draft only while it runs; on a phone where Parakh is not opened, the files stay, app-private, until it next is | `DG-64` (limitation) |
| Encryption and storage at rest of staff and administrative data on the device — decide before `STF-10` or any staff feature stores data locally | `DG-68` |
| About 13 GiB disk free (2026-10-09); swap shares the disk. Run the emulator and Gradle one at a time | ENVIRONMENT_CHECK |
| Staff-reporter confirmation path blocked | `DG-20`, `DG-21` |
| The CIT-02 disclosure (`FR-AUTH.2`) still says the citizen reviews the Urdu text; since `DG-61`/`DG-62` a report may be typed and carries English text too | `DG-69` |

## Next concrete action

`T-049` is In Review and `T-050` is built (`VAL-073`, `VAL-074`). The CIT-09 phone test (§8.2 steps 1–9) waits until the `T-049` test draft has expired at 20:57 PKT on 11 Oct (Hassan's choice); restart Metro first. Meanwhile, only work that leaves that draft alone and does not depend on `DG-73`. `T-055`, the upload client, is built (`VAL-075`) and waits for a draft that can be opened on the server. `T-051`'s CIT-10 screen is built (`VAL-079`); its phone test (§8.2b) follows §8.2 on the same new draft; and wiring the store and the submission queue into the reporting screens (see `NEXT_TASK.md`).
