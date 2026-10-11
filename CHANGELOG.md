# Changelog

All notable changes to Parakh will be documented in this file.

This changelog records meaningful product, technical, documentation, testing, and release changes. Minor formatting changes and routine commits do not need individual entries.

## [Unreleased]

### Added
- Initial private GitHub repository for Parakh.
- Flutter Android citizen-app scaffold.
- Project README with early-prototype status.
- GitHub Project board for the 10 October 2026 pilot.
- Repository labels for priority, components, testing, and security.
- Development Task issue template.
- Bug Report issue template.
- Pull Request template.
- CONTRIBUTING.md with documented development and contribution rules.
- 2026-10-03 — Project initialization (`setup/project-initialization`):
  - Source documents imported unchanged into `SRS/`, with a source register and an active index.
  - Decision and gap register (DG-01…DG-50).
  - Phased project plan.
  - Requirement index extracted from the Mobile SRS v2.1.0 (124 FR, 86 NFR, 12 SC).
  - Canonical backlog: 115 tasks, 12 milestones.
  - Excel tracker, with its generator, import tool and tests.
  - Traceability matrix.
  - Environment check, Git workflow and architecture overview.
  - Current-state and next-task records, development journal and contribution records.
  - Root `.gitignore`.
- 2026-10-03 — Backend citizen authentication, development build (`T-027`, `T-037`…`T-041`): OTP request and verification, account creation with server-held consent, sessions, masked profile, audit trail, identity vault; 63 tests.
- 2026-10-04 — Mobile skeleton and citizen sign-in screens CIT-01…CIT-05 with a CIT-06 placeholder (`T-031`, `T-033`, `T-042`, `T-043`); 52 tests.
- 2026-10-04 — Session refresh on the device: one shared refresh on 401, one retry, and sign-out with a plain notice when the session has ended (`T-044`). Log redaction on every backend log handler (`T-030`).
- 2026-10-04 — CI workflow for the backend, mobile and tracker checks (`T-034`).
- 2026-10-04 — Backend citizen report pipeline: drafts, chunked evidence upload with server-side hash and type checks, write-once local evidence store, a SIMULATED rendering adapter, versioned correction, confirmation of one exact version, one-transaction report creation, own reports and evidence playback (`T-053`…`T-061`, `T-063`). PROPOSED contract in `docs/api/CITIZEN_REPORTING_CONTRACT.md` (`T-036`).
- 2026-10-04 — Mobile SRS v2.2.0 with its change record, recording Hassan's decisions of 4 October 2026: 1–3 photos, an optional 60-second video, temporary processing data and cancellation, a 48-hour submission retry window, typed renderings, the verification sequence. v2.1.0 kept as the superseded baseline. Temporary-data lifecycle reconciliation (`docs/planning/TEMPORARY_DATA_LIFECYCLE.md`).
- 2026-10-04 — Backend follows the owner decisions of 4 October: 1–3 photos, an optional video of up to 60 s with container checks, typed renderings with confirmation, temporary data with cancellation (`DELETE /citizen/drafts/{id}`) and expiry, evidence sealed at submission, and a state machine with no skipped verification stage (`T-122`…`T-125`).
- 2026-10-05 — First Android development build, installed and run on an Android 16 emulator (`T-022`, `T-031`). An Expo config plugin pins every native module to one NDK, Build Tools and CMake, and turns off silent SDK downloads.
- 2026-10-05 — Encrypted local store on the device (`T-047`, `DR-23`): a SQLCipher database whose key lives only in secure storage and fails closed, transactional migrations, drafts bound to their account, media encrypted before it is written, capture ingestion, and the store released at sign-out. A development-only self-check passes on the emulator. `docs/testing/DEP-08_SQLCIPHER_VERIFICATION.md` records the emulator evidence; `DEP-08` stays open.
- 2026-10-06 — Mobile SRS v2.3.0 with its change record, recording Hassan's decisions of 6 October 2026:
  - report text spoken or typed, in Urdu and English, confirmed by the reporter;
  - no app encryption for local drafts and their media, and the captured file used directly;
  - a 2-day lifetime for unsubmitted drafts;
  - submission only on an explicit Submit, with status checks.
  v2.2.0 is kept as a superseded baseline.
- 2026-10-06 — Backend report text in Urdu and English (`T-127`):
  - the transcription and both languages under one hash;
  - typed text kept verbatim;
  - corrections that AI never overwrites;
  - confirmation naming every text;
  - reports carrying both languages.
- 2026-10-07 — The device follows the decisions of 6 October (`T-047`, `T-128`, `T-052`):
  - an app-private draft store without app encryption, with the capture file used directly and a 2-day lifetime fixed at creation;
  - a one-time move of the 5 October encrypted drafts, which never wipes a store it cannot read;
  - a submission queue: Submit only, a status check after a lost response, 48-hour retries, cancellation, no duplicates.
  The emulator record is `docs/testing/DRAFT_STORE_VERIFICATION.md`.
- 2026-10-07 — Mobile SRS v2.4.0 with its change record, recording Hassan's decisions of 7 October 2026. v2.3.0 is kept as a superseded baseline.
- 2026-10-07 — A step-by-step procedure for testing the app on a physical Android phone (`docs/testing/PHYSICAL_ANDROID_TESTING.md`), and development-only retention-test items for checking the 48-hour rules by hand.
- 2026-10-07 — An explanation of `DR-26` for Hassan's review (`docs/planning/DR-26_REVIEW.md`). Nothing about `DR-26` was changed.
- 2026-10-07 — Mobile SRS v2.5.0 with its change record: `DR-26` confirmed in force, and `SC-10` amended for citizen-side drafts and pending submissions (`DG-66`). Encryption and storage at rest of future staff and administrative data on the device is recorded as an open decision (`DG-68`). v2.4.0 is kept as a superseded baseline.
- 2026-10-09 — First physical Android test phone set up for `T-046`: Samsung SM-A546E, Android 16; the debug build installed and identical to the build output (`VAL-048`), and its first launch passed (`VAL-049`). The same day every check of §7 passed on the phone: language screens, sign-in, session restore and sign-out, the draft-store self-check, the 48-hour rules, a restart during a pending item, permissions and backups (`VAL-050`–`VAL-058`). Its memory pages are 4 KB, so the 16 KB page-size check stays pending.
- 2026-10-09 — CIT-08 live evidence capture (`T-049`): the in-app camera only, 1–3 photos and one video of up to 60 seconds, the hash at capture, the camera's own file moved into the draft, the video's length read from its container as the server reads it, permissions explained before Android asks, a storage check before each capture, and review, retake and delete. Jest-verified (`VAL-060`) and verified on the physical phone on 2026-10-10 (`VAL-061`–`VAL-070`), after fixes F-2 and F-3.
- 2026-10-11 — Mobile SRS v2.6.0 with its change record: Hassan Jalal's decisions of 11 October (`DG-30`, `DG-71`, `DG-72`) recorded as dated notes, no requirement statement changed; the `CIT-10` text that conflicts with `DG-30` opened as `TBD-M18` (`DG-73`). v2.5.0 is kept as a superseded baseline.
- 2026-10-11 — CIT-09, speak or type (`T-050`): Speak and Type as equal choices with no language picker; the recorder's own file hashed and moved into the draft, its length read from the file; play, pause, record again and delete; typed text kept exactly as written; nothing deleted on a switch without confirmation; the microphone explained first and typing kept when it is refused (`VAL-073`). The recording settings and a 3-minute maximum decided by Hassan Jalal (`DG-74`).
- 2026-10-11 — A spoken description lasts at most 3 minutes (`DG-74`): the recorder stops there, and a longer recording is refused on the phone and by the server (`400 recording_duration`; `VAL-074`).
- 2026-10-11 — The resumable evidence upload (`T-055`): files re-hashed before sending, 256 KiB chunks, resumption from what the server confirmed, retries for damaged chunks (`VAL-075`). Not yet wired to a screen.
- 2026-10-11 — Mobile SRS v2.7.0 with its change record: Hassan Jalal's later decisions of 11 October (`DG-73`–`DG-76`). `FR-PUB.24` is restated for the approved location design, with the v2.6.0 text quoted. The map, dragging and `GET /geo/reverse` are struck through. `TBD-M18` is resolved, and `TBD-M19` opened for `NFR-28`, which is not amended.
- 2026-10-11 — Location data (`DG-73`): the server and the phone keep what the phone measured beside the position the citizen confirms, or a written description when there are no coordinates (`VAL-077`).
- 2026-10-11 — CIT-10, where the issue is (`T-051`): the current GPS position with its accuracy, else the last known position with its age, else a written description; directional buttons that keep the measurement; no map or address lookup (`VAL-079`).
- 2026-10-11 — Mobile SRS v2.8.0 with its change record: the location may be described by voice without coordinates, kept as evidence and never interpreted by AI (`DG-77`, `NFR-28` preserved). Staff see the measured and the final position distinctly (`DG-78`). The CIT-10 settings are set (`DG-81`). `TBD-M19` resolved; `TBD-M20` opened for contractors.
- 2026-10-11 — CIT-10: Speak or Type a location when there are no coordinates (`location_voice`); 5 m per button press; the highest GPS accuracy requested; the device's own accuracy shown (`VAL-080`).
- 2026-10-11 — Mobile SRS v2.9.0 with its change record: a spoken location description of at most 1 minute (`DG-79`); contractors see only the final reported location (`DG-80`); a last known position is used only if at most 30 minutes old (`DG-82`). `TBD-M21` opened. Implemented on the phone and the server (`VAL-082`).

### Changed
- Established the workflow: Issue → Branch → Implementation → Testing → Pull Request → Review → Merge → Evidence → Development Journal.
- 2026-10-03 — The canonical working location moved to the Desktop `PARAKH PROJECT` folder. History and remote are preserved; the earlier Documents clone is an inactive backup.
- 2026-10-03 — `README.md` rewritten around the current requirements baseline. The original status line is kept.
- 2026-10-03 — Workflow: completed, verified checkpoints reach `main` regularly — by direct push where permitted, otherwise by pull request and merge (`DG-37`). The setup branch was squash-merged into `main`.
- 2026-10-03 — `docs/pilot-scope.md` gained a dated status note: the 10 Oct target and the Moderator/Administrator role are superseded. The original text is unchanged.
- 2026-10-04 — The obsolete `setup/project-initialization` branch was deleted locally and on GitHub after verification that its content is on `main` (`T-119`). No history was rewritten.
- 2026-10-04 — The GitHub repository was re-created (private) at Hassan's instruction. Its history starts from one initial commit; the earlier history is kept locally (`T-120`).
- 2026-10-04 — `README.md` limitations and set-up pointers brought up to date.
- 2026-10-05 — API-155 returns the citizen's own `account_id`, so the device can bind its local drafts to the account.
- 2026-10-05 — Android: auto-backup off, the unused biometric permissions blocked, and gallery and file pickers refused by ESLint.
- 2026-10-06 — Server clean-up of abandoned temporary data is no longer tied to the 48-hour submission retry window; its 72-hour default stays proposed (`DG-57`).
- 2026-10-07 — Local drafts and their media are no longer encrypted by the app (Hassan Jalal's decision, `DG-63`). The SQLCipher store of 5 October is read only to move its drafts once; its key is then deleted.
- 2026-10-07 — A pending submission is deleted from the phone 48 hours after the first press of Submit if the server has not confirmed it, after a last status check where possible, and is shown apart from saved drafts (`DG-67`). This replaces keeping it labelled "not confirmed".
- 2026-10-07 — Server clean-up of abandoned temporary data: 72 hours without activity, approved (`DG-57`). The start and end of a processing job now count as activity, so data still being processed is never purged.
- 2026-10-09 — The Desktop working folder is now named `PARAKH/` (it was `PARAKH PROJECT/`); the repository, history and remote are unchanged. The phone procedure's commands use the new path.

### Fixed
- 2026-10-04 — Backend input handling: an impossible calendar date, a list or object as an evidence kind, and a truncated MP4 header returned HTTP 500; they now get a 400 (independent review findings).
- 2026-10-04 — Tracker: the workbook's editable-field baseline outgrew one Excel cell (32,767 characters) and was cut off. It is now split across cells; older single-cell workbooks are still read, and an unreadable baseline stops regeneration instead of discarding edits.
- 2026-10-04 — Backend settings: an empty environment value now counts as unset; invalid reporting values stop start-up; the upload cap is kept apart from the undecided photo-count bound.
- 2026-10-05 — Local store (independent review findings): an interrupted schema setup could leave the drafts unopenable for good (R-005), and the orphan clean-up could delete a capture in flight (R-006). Both are fixed and covered by regression tests.
- 2026-10-06 — Report text (independent review finding R-007): a rendering made before the bilingual change could still become a report with an empty transcription and English text. It can no longer; unsubmitted ones are re-queued by migration `0004` and need a fresh confirmation. Submitted reports are untouched.
- 2026-10-09 — F-1 (found on the physical phone): the interface language chosen on CIT-01 was lost when the app restarted, so a citizen who chose Urdu saw English on an English-language phone. The choice is now stored on the phone and used at every start (`FR-AUTH.1`, `T-042`, `VAL-051`); re-tested on the phone (`VAL-053`).
- 2026-10-09 — Tracker: a cut-off part of the workbook's saved editable-field baseline could still parse when the cut fell inside a long text value, so edits would have been compared with a corrupted baseline. The baseline now carries a SHA-256 that is checked on reading (found when the existing regression test failed after longer notes moved a part boundary).
- 2026-10-10 — F-2 (found on the physical phone): a video stopped after 26 seconds because the phone's default 720p bitrate (12 Mbit/s) fills the 40 MiB limit early. CIT-08 now sets a 4.5 Mbit/s video bitrate, so a full 60 seconds with sound fits (`VAL-063`; proposed under `DG-72`). Re-tested on the phone: stopped at the 60-second limit, 34.36 MiB (`VAL-064`).
- 2026-10-10 — F-3: CIT-08 now applies a camera or microphone permission allowed in Settings as soon as the citizen comes back, and asks Android again while it still can before sending the citizen to Settings (`VAL-067`).
- 2026-10-11 — A video without a sound track is refused on the phone and by the server (`DG-71`, `VAL-071`).
- 2026-10-11 — CIT-08 listed every item in a draft, so a recording made on CIT-09 would have appeared there as a video. It now lists only photos and the video (`VAL-073`).
- 2026-10-11 — The server trimmed typed report text and normalised the typed transcription and the reporter's corrections. They are now stored exactly as written (`DG-76`). Recordings are accepted as MPEG-4 audio only (`DG-75`; `VAL-078`).

### Security
- 2026-10-09 — The development backend signs in only designated test numbers (`DG-70`, Hassan Jalal's instruction): any other number is refused before anything is stored, counted, sent or audited. Test and production are unaffected, and production refuses to start with the list set (`VAL-059`).
- Established repository rules against committing secrets, unnecessary personal data, participant information, or sensitive evidence.
- 2026-10-07 — No Parakh data in Android cloud backups or device-to-device transfers: data-extraction and backup rules exclude every storage domain (`DG-59`). Session tokens are stored for this device only.

## Release History

No formal Parakh release has been published yet.
