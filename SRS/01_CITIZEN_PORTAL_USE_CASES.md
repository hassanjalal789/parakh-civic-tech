# Parakh — Citizen Portal Use Cases

| Field | Value |
|---|---|
| **Version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Portal** | **Citizen (`CIT`)** — React Native, Expo SDK 57, Android 7+ |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 |
| **Screens covered** | `CIT-01` … `CIT-23` — **23 screens** |
| **Use cases** | `UC-CIT-001` … `UC-CIT-058` |

---

# A. Portal purpose

The Citizen portal is the **only self-service portal in Parakh**. A resident of Punjab installs the app, creates an account with their mobile number and an SMS code, **speaks** a civic problem in their own language, checks the Urdu text the system produced from their voice, and sends it. They then follow it to closure and say whether it was actually fixed.

**Voice is the primary path.** The citizen is never required to type a complete complaint.

## Boundaries

| The Citizen portal does | The Citizen portal does not |
|---|---|
| Create an account with mobile + SMS OTP | Use a password — **there is no citizen password in Release 0** |
| Report a civic issue with evidence and voice | Verify, accept, reject, assign, close or decide anything |
| Confirm **their own** Urdu rendering | Confirm anyone else's rendering |
| Read **their own** reports | Read any other citizen's report, or any staff note |
| Confirm or dispute a claimed resolution | Contact a contractor or a named officer |
| See **their own** number, masked | See any staff identity or contact detail |

## Prohibited actions — enforced server-side

**A citizen may never:** submit anonymously · obtain a tracking token or recovery code · read another citizen's report · see the intermediate ASR output · see internal staff notes · see which named officer acted · confirm a rendering they did not create · receive an official report reference before the server creates the `CivicReport` · verify an OTP offline · trigger AI processing offline.

---

# B. Actor and account summary

| Property | Value |
|---|---|
| **Actor code** | `CIT` |
| **Who creates the account** | **The citizen, self-service.** No invitation, no approval, no administrator |
| **Account identifier** | **Mobile number**, normalised to E.164. **An identifier, not an authentication factor** |
| **Authentication factors** | **One — a six-digit SMS OTP (possession factor).** This is **single-factor** authentication and must never be described as two-factor |
| **Password** | **None in Release 0** |
| **Activation** | **Automatic.** The first successful OTP verification creates the `CitizenAccount`. Later verifications sign in to the same account |
| **RoleAssignment** | **None.** Citizens hold no `RoleAssignment` and no acting-role header |
| **Scope** | **Ownership only.** A citizen sees a record if and only if `ReportOwnership` binds it to their account |
| **Account statuses** | `ACTIVE` · `TEMPORARILY_LOCKED` · `DEACTIVATED` |
| **Login blocked when** | Account `DEACTIVATED`; account `TEMPORARILY_LOCKED`; OTP rate limit reached; **no network** |
| **Step-up** | **Not applicable to citizens.** The step-up rule covers the four civic staff portals only |
| **Logout** | `CIT-21` — sign out this device, or **sign out from all devices**, which revokes the whole `RefreshTokenFamily` |
| **Session** | `AuthSession` with `subject_type = citizen`, `authentication_method = citizen_otp`, `acting_role_assignment_id = null` |

## Identity data held

| Data | Where | Who can see it |
|---|---|---|
| Mobile number | `CitizenPhoneCredential`, encrypted, keyed by `phone_lookup_hmac` | **Nobody operational.** The citizen sees their own, masked, at `CIT-21` |
| **Name** | **Not collected. The field does not exist** — see **D-13** | — |
| Preferred interface language | `CitizenAccount.preferred_language ∈ {ur, en}` | Self |
| Consents | Three separate `ConsentRecord` rows | Self |

---

# C. The 0-to-100 golden journey

**Fresh installation → language → privacy and voice explanation → consent → mobile number → OTP → account creation → home → report → evidence → voice → AI Urdu rendering → confirmation → location → submission → official reference → My Reports → progress → completion review → confirm or dispute → logout.**

*Actor: a resident with an Android phone, no Parakh account, moderate literacy, speaks Punjabi and some Urdu.*

| Step | Screen | User sees | User action | System action | API | Data | Authorization | State | Audit | Success | Failure | Offline | Accessibility / language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0** | — | Play Store listing | Installs and opens the app | App boots, no session found | — | — | — | — | — | `CIT-01` opens | Boot failure → plain retry | **Install requires network; first launch does not** | App name legible at 200% |
| **1** | `CIT-01` | Logo and **two large buttons — اردو / English**. Nothing else | Taps **اردو** | Sets device-local interface language; enables RTL mirroring | — | Local preference only | None | — | — | `CIT-02` opens in Urdu | — | **Works fully offline** | ≥48dp targets; both labels in their own script; **no third language offered** |
| **2** | `CIT-02` | Plain-language explanation: why the number is needed · **that reporting is not anonymous** · that the number is used to sign in · **that operational users never receive it** · **that the voice recording is stored** · **that AI processes it and the output may contain errors** · **that the citizen checks the Urdu text before sending** · that SMS alerts are optional | Reads, taps **Continue** | None yet | — | — | None | — | — | `CIT-03` opens | — | **Cached, readable offline** | **Human-translated.** Readable at 200% zoom, no jargon |
| **3** | `CIT-03` | **Three separate controls** — Required 1: account creation and processing · Required 2: voice recording, storage and AI processing · **Optional: SMS notifications** | Ticks both required, leaves optional unticked, taps **Agree and continue** | Writes a `pending_consent` payload to encrypted local storage with `consent_version` and a client-generated `pending_consent_ref` | **None — no authenticated call is possible; no account exists** | Device-local payload | None | — | **None. No consent event exists before an account does** | `CIT-04` opens | A required box unticked → Continue stays disabled with a plain explanation | **Works offline. Nothing is sent yet** | Each control separately labelled and announced |
| **4** | `CIT-04` | `+92` prefix, a number field, and a one-line reminder of why | Types `3001234567` | Client-side E.164 format check only | — | — | None | — | — | Send code enabled | Bad format → inline message, no submission | **"You need an internet connection to sign in." No queueing** | Numeric keypad, large digits, **digits stay LTR inside RTL** |
| **5** | `CIT-04` | Send code button | Taps **Send code** | Normalises to `+923001234567`, computes `phone_lookup_hmac`, creates an `OTPChallenge` with `purpose = citizen_signup_login`, stores `code_hash` only, sends SMS, **stores the consent version and selections against the challenge** *(D-08 PROPOSED)* | **`POST /auth/citizen/otp/request`** *(`API-121`)*, carrying `pending_consent_ref` | `OTPChallenge` created | None | — | `otp_requested` — **never the code, never the number** | `CIT-05` opens with a resend timer | Rate limit → **uniform** message; **the response is identical whether or not the number is registered** | **Impossible offline** | Button shows a named state, not a bare spinner |
| **6** | `CIT-05` | Six digit boxes, resend countdown, "change number", **attempts remaining** | Types the six digits | Auto-advances between boxes | — | — | — | — | — | Verify enabled | — | **"You need an internet connection to verify this code."** | Paste supported; **attempts remaining announced** |
| **7** | `CIT-05` | Verify button | Taps **Verify** | Compares against `code_hash`; consumes the challenge; **no matching `CitizenPhoneCredential` exists, so it creates one** and a `CitizenAccount`; **binds the recorded consent in the same transaction** as three `ConsentRecord` rows; issues tokens | **`POST /auth/citizen/otp/verify`** *(`API-122`)* | `CitizenAccount`, `CitizenPhoneCredential`, **3× `ConsentRecord`**, `AuthSession`, `RefreshTokenFamily`, `DeviceSession` | None → authenticated | Account → `ACTIVE` | `citizen_account_created` · `phone_verified` · `consent_recorded` ×3 | `CIT-06` home opens | Wrong or expired → **uniform** message, attempts decremented; 5 failures → challenge dead, must resend | **Impossible. The code is never stored on the device for later verification** | Success announced; **no jargon** |
| **8** | `CIT-06` | Five tiles, each with **icon and text**: Report an Issue · My Reports · Notifications · Help · Profile & Settings | Taps **Report an Issue** | Loads categories | `GET /citizen/reports/summary` | — | Citizen session | — | — | `CIT-07` opens | — | Cached counts shown | Every tile has icon **and** text |
| **9** | `CIT-07` | Icon grid — water, road, drainage, streetlight, waste, other | Taps **drainage** | Records the category on a new local draft | `POST /citizen/drafts` *(`API-130`)* | `ClientSubmission` created, `pipeline_state = LOCAL_DRAFT`, `reporter_subject_type = citizen` | Citizen session | `LOCAL_DRAFT` | — | `CIT-08` opens | — | **Fully offline; the draft is local** | Icons have text labels; **never colour alone** |
| **10** | `CIT-08` | Camera preview, large shutter, thumbnails | Taps shutter twice | Captures two live photos, hashes each, writes to app-private storage | — *(upload deferred)* | 2× `EvidenceObject` staged locally | Citizen session | `LOCAL_DRAFT` | — | Thumbnails appear | Camera permission denied → **plain explanation and a manual path**, not a dead end | **Works offline; queued** | Haptic **and** audible shutter confirmation |
| **11** | `CIT-09` | **A large microphone button**, a short prompt, and "type instead" as a small secondary option | Taps **Record** and speaks in Punjabi for 40 seconds | Records to app-private storage as `voice_original` | — | `EvidenceObject` kind `voice_original` staged | Citizen session | `LOCAL_DRAFT` | — | Waveform and elapsed time | Microphone denied → **text fallback offered, not forced** | **Recording works offline** | **The citizen never selects a spoken language.** Urdu, Punjabi, English and mixed speech are all accepted |
| **12** | `CIT-09` | Playback control, re-record, continue | Taps **Play**, listens, taps **Continue** | Nothing is uploaded yet | — | — | — | `LOCAL_DRAFT` | — | Upload begins if online | — | **Playback works offline** | Playback control ≥48dp |
| **13** | `CIT-09` | **"Uploading"** with progress | Waits | Chunked resumable upload; per-chunk SHA-256 recomputed server-side | `POST /citizen/drafts/{id}/evidence` + `/complete` *(`API-131`, `API-132`)* | `EvidenceObject` rows committed, write-once | Citizen session; **draft resolved from the session, not from a client-supplied ID** | `UPLOADING` | `evidence_committed` | State becomes "Processing your recording" | Chunk hash mismatch → `422 E_CAPTURE_INTEGRITY`, retry that chunk | **Blocked. Shows "Waiting for connection" and holds the recording safely** | **Named state, never a bare spinner** |
| **14** | `CIT-09` | **"Processing your recording"** | Waits | Server-side ASR produces `source_asr_text`; then an **Urdu-script civic rendering**; extracts critical fields with per-field confidence; computes `rendering_content_hash`; writes `VoiceTranscriptionArtifact` v1 with `is_active_version = true` | — *(server job)* | `VoiceTranscriptionArtifact` v1 | — | `TRANSCRIPTION_PROCESSING` | — | State becomes "Please check the text" | Failure → `processing_status = FAILED`; **draft and recording preserved; no report created; no replacement text generated** | **Impossible offline. No on-device model exists** | Long processing shows elapsed time and a plain reassurance |
| **15** | `CIT-09` | **The Urdu rendering, labelled AI-generated**, with the original recording playable beside it, and **one low-confidence field marked** — the street number | Taps the marked field | Shows a short targeted question: *"Did you say Street 12 or Street 20?"* with the relevant audio replayable | `GET /citizen/drafts/{id}/rendering` *(`API-134`)* | — | Ownership — **own draft only** | `AWAITING_REPORTER_REVIEW` | `rendering_viewed` | Question appears | — | **Blocked; the last fetched version is shown read-only** | **The intermediate ASR output is never shown to the citizen** |
| **16** | `CIT-09` | Two large options — *Street 12* / *Street 20* | Taps **Street 12** | Produces `VoiceTranscriptionArtifact` **v2**, sets `supersedes_artifact_id` to v1, v1 `is_active_version = false` | *(rendering correction)* | Artefact v2 | Ownership | `AWAITING_REPORTER_REVIEW` | `rendering_corrected` | Updated rendering shown, **still labelled AI-generated** | — | **Blocked** | **The AI never guesses a critical field** |
| **17** | `CIT-10` | Map with a pin at the device position, address hint | Drags the pin 30 m and taps **Confirm** | Reverse-geocodes; marks the point manually-placed | `GET /geo/reverse` | Draft location | Citizen session | `AWAITING_REPORTER_REVIEW` | — | `CIT-11` opens | GPS denied → **manual pin, marked unverified**, not blocked | **Last known position + manual pin** | **Pin movable by buttons, not only by drag** |
| **18** | `CIT-11` | Category, **original recording playable**, **Urdu rendering labelled AI-generated**, **version indicator**, thumbnails, location | Reads, plays the recording once | Client holds `rendering_version = 2` and `rendering_content_hash` | — | — | Ownership | `AWAITING_REPORTER_REVIEW` | — | Confirm control enabled | — | **Blocked for submission** | **The whole summary is read back, including the rendering** |
| **19** | `CIT-11` | **Confirm and submit** | Taps **Confirm and submit** | Verifies **all six**: artefact belongs to this reporter's own draft · rendering is the active version · content hash matches · not superseded · has not already produced a report · idempotency key is new | **`POST /citizen/drafts/{id}/rendering/confirm`** *(`API-135`)* with `X-Confirmation-Idempotency-Key` *(D-12 PROPOSED)* | **`RenderingConfirmation`** created | **`CAP_RENDERING_CONFIRM_OWN`** — **own draft only** | → `READY_TO_SUBMIT` | `rendering_confirmed` | Submission proceeds | Superseded → **`409 E_RENDERING_SUPERSEDED`**; hash mismatch → **`409 E_RENDERING_HASH_MISMATCH`**; client **re-fetches `API-134`** and shows the newest version | **Blocked** | Confirmation means *"this represents what I meant"* — **not that the AI is objectively perfect** |
| **20** | `CIT-11` → `CIT-13` | Brief named state | Waits | **One atomic transaction:** verify confirmation · verify required evidence · create `CivicReport(state = SUBMITTED)` · **issue the report reference** · bind `confirmed_rendering_artifact_id` and version · record `ReportOwnership` · append audit | **`POST /citizen/reports`** *(`API-140`)* with `client_submission_id` + `X-Submission-Idempotency-Key` | **`CivicReport`**, `ReportOwnership` | Ownership | *(none)* → **`SUBMITTED`** | `report_submitted` | `CIT-13` shows the **official reference** | Missing photo under **branch A** → `422 E_EVIDENCE_REQUIRED` *(D-14)*; no confirmation → `422 E_RENDERING_NOT_CONFIRMED` | **Blocked → `CIT-12` "Waiting to send", no reference, no `CivicReport`** | **Reference is large, selectable, announced, and stays LTR** |
| **21** | `CIT-13` | **Official report reference**, what happens next, expected timeframe | Taps **Go to My Reports** | — | — | — | Ownership | `SUBMITTED` | — | `CIT-14` opens | — | **Only reachable after a successful server response** | Reference selectable for copying |
| **22** | `CIT-14` | One row: reference, drainage icon, **"Received"**, today's date | Taps the row | — | `GET /citizen/reports` *(`API-150`)* | — | **Ownership enforced server-side** | `SUBMITTED` | `report_viewed` | `CIT-15` opens | — | Cached list plus queued drafts, clearly marked | Status is **text and icon**, never colour alone |
| **23** | `CIT-15` | Reference, summary, **sanitised timeline**, own evidence, own recording | Reads and closes | — | `GET /citizen/reports/{id}` *(`API-151`)* | — | Ownership — **another citizen's report returns the same `404`** | — | `report_viewed` | — | — | Cached detail | Timeline is a list, not a graphic |
| **24** | `CIT-20` | *"Someone is checking this on the ground"* | Reads | Report moved `SUBMITTED → UNDER_VERIFICATION` by system routing | — | — | — | `UNDER_VERIFICATION` | `report_routed` | — | — | Cached | **Internal state codes are never shown** |
| **25** | `CIT-16` | A clarification question from the Street Representative, **playable aloud** | Taps **Reply by voice**, speaks, sends | Records and queues the reply | `POST /citizen/reports/{id}/clarify` *(`API-152`)* | Clarification response | Ownership | unchanged | `clarification_requested` → answered | Reply accepted | — | **Queues — this is report content, not authentication** | **Question is translated and read aloud** |
| **26** | `CIT-20` → `CIT-17` | *"Work has been given to a team"*, later *"The team says it is finished"*, then **before/after evidence** | Opens the completion review | Contractor completed; a **conflict-free** Representative verified | `GET /citizen/reports/{id}` | — | Ownership | `PENDING_CITIZEN_CONFIRMATION` | `completion_verified` | `CIT-18` opens | — | Cached | Images described in text |
| **27** | `CIT-18` | *"Is this fixed?"* — **two large, clearly distinct buttons** | Taps **Yes — fixed** | Guards on `state_version` | `POST /citizen/reports/{id}/confirm` *(`API-153`)* | `CitizenConfirmation` | Ownership; **reporter ≠ completer** | `PENDING_CITIZEN_CONFIRMATION` → **`RESOLVED_CONFIRMED`** | `resolution_confirmed` | Thank-you and updated status | Stale state → `409 E_STALE_STATE`, refresh and re-ask | **Queues** | Two buttons, unmistakably different |
| **28** | `CIT-20` | *"This report is finished and closed"* | Reads | UC Officer performed ordinary closure with a mandatory reason and step-up | — | — | — | `RESOLVED_CONFIRMED` → **`CLOSED`** | `case_closed` | — | — | Cached | `RESOLVED_CONFIRMED` and `CLOSED` may share the label "Fixed"; **the internal states stay distinct** |
| **29** | `CIT-21` | Masked number `+92 300 *** 4567`, language, **SMS consent toggle**, logout, logout all devices, deactivate | Taps **Log out** | Server-side session revocation | `POST /auth/logout` *(`API-004`)* | `AuthSession.revoked_at` set | Own session | — | `session_revoked` | `CIT-01` | — | Read-only offline | **The number is shown masked, never in full** |

**End of golden journey. 30 steps, Step 0 to Step 29.**

---

# D. Formal use cases

## Group 1 — Onboarding and authentication

### UC-CIT-001 — First application launch

| Field | Detail |
|---|---|
| **ID / Name** | `UC-CIT-001` — First application launch |
| **Primary actor** | Prospective citizen |
| **Supporting** | None |
| **Goal** | Reach a usable first screen with no account |
| **Trigger** | App opened for the first time after installation |
| **Preconditions** | App installed; no `AuthSession` on device |
| **Authentication / Authorization / Scope** | **None required** |
| **Input data** | None |
| **Main success flow** | **0.** App boots. **1.** No session token found in `expo-secure-store`. **2.** No stored interface language found. **3.** `CIT-01` is rendered |
| **Alternate flows** | **A1** A valid session exists → skip to `CIT-06`. **A2** A stored language exists but no session → `CIT-01` pre-highlights it |
| **Exception flows** | **E1** Local storage unreadable → app starts with defaults and shows a plain message; **no crash to a blank screen** |
| **Offline** | **Fully works** |
| **Security / privacy** | No network call. No identifier read or transmitted |
| **Accessibility / language** | Splash legible at 200%; screen-reader announces the app name |
| **Entities read / written** | None / None |
| **APIs / Screens / Capabilities** | None / `CIT-01` / None |
| **Audit / State** | None / None |
| **Postconditions** | `CIT-01` displayed |
| **Notifications** | None |
| **Acceptance criteria** | First launch always reaches `CIT-01` with no network |
| **Given/When/Then** | *Given* a fresh install and no network, *when* the app opens, *then* `CIT-01` renders and no request is attempted |
| **Dependencies / Open decisions** | None / None |

### UC-CIT-002 — Select Urdu or English interface language

| Field | Detail |
|---|---|
| **ID / Name** | `UC-CIT-002` — Select interface language |
| **Primary actor** | Prospective or existing citizen |
| **Goal** | Read the app in a language they understand |
| **Trigger** | `CIT-01` displayed, or **Change language** tapped at `CIT-21` |
| **Preconditions** | None for first run; authenticated session for `CIT-21` |
| **Authentication** | **None at `CIT-01`.** Session required at `CIT-21` |
| **Input data** | One of **`ur`** or **`en`** |
| **Main success flow** | **0.** `CIT-01` shows exactly **two** buttons — اردو and English. **1.** Citizen taps one. **2.** App sets the interface language locally and enables RTL mirroring for Urdu. **3.** `CIT-02` opens in the chosen language |
| **Alternate flows** | **A1** Changed later at `CIT-21` → `PATCH /citizen/profile` persists `preferred_language`; **the change does not restrict which language may be spoken** |
| **Exception flows** | **E1** `PATCH` fails at `CIT-21` → local change applies, a plain retry message appears, and the server value is reconciled on next connection |
| **Offline** | **`CIT-01` works fully offline.** `CIT-21` applies locally and syncs later |
| **Security / privacy** | No identifier involved |
| **Accessibility / language** | **Punjabi is not offered as a written interface language.** Each button is labelled in its own script; ≥48dp |
| **Entities written** | `CitizenAccount.preferred_language` *(only at `CIT-21`)* |
| **APIs / Screens / Capabilities** | `PATCH /citizen/profile` *(`API-155`)* / `CIT-01`, `CIT-21` / None |
| **Audit / State** | `profile_updated` *(`CIT-21` only)* / None |
| **Acceptance criteria** | Only `ur` and `en` are ever offered or stored; RTL mirrors fully; **digits and phone numbers remain LTR** |
| **Given/When/Then** | *Given* `CIT-01`, *when* it renders, *then* exactly two language options appear and neither is Punjabi. *Given* Urdu selected, *when* a phone number is displayed, *then* its digits render LTR inside RTL text |
| **Open decisions** | None — **the Shahmukhi/Gurmukhi question was withdrawn with the Punjabi UI** |

### UC-CIT-003 — Read the privacy, mobile-number and voice-processing explanation

| Field | Detail |
|---|---|
| **ID / Name** | `UC-CIT-003` — Read the pre-collection explanation |
| **Goal** | Understand what is collected and why **before** giving anything |
| **Trigger** | Language selected |
| **Preconditions** | None |
| **Authentication** | **None — deliberately.** The explanation precedes collection |
| **Main success flow** | **0.** `CIT-02` renders nine plain statements: why the number is required · **reporting is not anonymous** · the number is used to sign in · **operational users never receive it** · **the voice recording is stored** · **AI processes it and the output may contain errors** · **the citizen checks the Urdu text before sending** · SMS alerts are optional and separately consented · optional consent can be withdrawn without losing the account. **1.** Citizen may open the full privacy notice. **2.** Taps **Continue** → `CIT-03` |
| **Alternate flows** | **A1** Taps **Read full privacy notice** → full text, back returns to `CIT-02` |
| **Exception flows** | None — the screen is static cached content |
| **Offline** | **Cached and fully readable** |
| **Security / privacy** | **The disclosure precedes the collection.** No number has been typed and no recording made |
| **Accessibility / language** | **Human-reviewed translation. Machine translation is not acceptable for privacy or consent text.** Readable at 200% |
| **APIs / Screens** | None / `CIT-02` |
| **Acceptance criteria** | `CIT-02` is unreachable-past without an explicit Continue; the nine statements are all present |
| **Given/When/Then** | *Given* a first run, *when* the citizen reaches number entry, *then* `CIT-02` and `CIT-03` were both displayed first |
| **Open decisions** | **`TBD — Hassan decision required`: the AI provider and processing location.** The screen states that an external provider may be used and that none has been selected |

### UC-CIT-004 — Record required and optional consent before authentication

| Field | Detail |
|---|---|
| **ID / Name** | `UC-CIT-004` — Pre-authentication consent |
| **Goal** | Make three separate decisions, not one |
| **Trigger** | Continue from `CIT-02` |
| **Authentication** | **None. No account exists yet** |
| **Input data** | Required 1 *(account creation and processing)* · Required 2 *(voice recording, storage and AI processing)* · **Optional** *(SMS notifications)* |
| **Main success flow** | **0.** `CIT-03` shows three separately labelled controls. **1.** Citizen ticks the two required. **2.** Optional left as they choose. **3.** Taps **Agree and continue**. **4.** App writes a `pending_consent` payload locally with `consent_version` and a client-generated `pending_consent_ref`. **5.** `CIT-04` opens |
| **Alternate flows** | **A1** Optional ticked → the third `ConsentRecord` is created with `granted_at` set at binding time |
| **Exception flows** | **E1** A required control unticked → **Continue stays disabled** with a plain reason; the app never proceeds silently |
| **Offline** | **Works fully. Nothing is transmitted at this step** |
| **Security / privacy** | **No authenticated call is possible here** — `ConsentRecord` requires a `citizen_account_id` that does not exist. **If the citizen abandons, no `CitizenAccount` and no `ConsentRecord` are created** |
| **Accessibility / language** | Each control **separately labelled and separately announced**; never a single combined checkbox |
| **Entities written** | Device-local payload only |
| **APIs / Screens / Capabilities** | **None** / `CIT-03` / None |
| **Audit** | **None. No consent event exists before an account does** |
| **Acceptance criteria** | Three controls, three decisions; abandonment leaves no server record |
| **Given/When/Then** | *Given* consent given but OTP never verified, *when* the challenge expires, *then* no `CitizenAccount` and no `ConsentRecord` exist. *Given* `CIT-03`, *when* it renders, *then* required and optional consent are separate controls |
| **Open decisions** | **D-08 PROPOSED** — the server should store the consent version and selections against the `OTPChallenge`, so the authoritative record is not the device copy |

### UC-CIT-005 — Enter and validate a Pakistani mobile number

| Field | Detail |
|---|---|
| **ID / Name** | `UC-CIT-005` — Enter mobile number |
| **Goal** | Supply the account identifier |
| **Input data** | National mobile number; `+92` prefix fixed |
| **Main success flow** | **0.** `CIT-04` shows the `+92` prefix, a number field and a one-line reminder. **1.** Citizen types the number. **2.** Client checks format only. **3.** **Send code** becomes enabled |
| **Alternate flows** | **A1** Citizen taps **Change language** → returns to `CIT-01`, entry preserved |
| **Exception flows** | **E1** Malformed → inline message, no request sent |
| **Offline** | **"You need an internet connection to sign in." The number is not queued** |
| **Security / privacy** | **The mobile number is an account identifier, not an authentication factor.** It never appears in a URL |
| **Accessibility / language** | Numeric keypad; large digits; **digits stay LTR inside RTL text** |
| **Screens / APIs** | `CIT-04` / none at this step |
| **Acceptance criteria** | No request is made until the format is valid |
| **Given/When/Then** | *Given* Urdu interface, *when* a number is typed, *then* the digits render left-to-right |

### UC-CIT-006 — Request an OTP · UC-CIT-007 — Resend · UC-CIT-008 — Edit the number

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-006` request · `UC-CIT-007` resend · `UC-CIT-008` edit number |
| **Goal** | Obtain a six-digit code on the registered handset |
| **Main success flow (006)** | **0.** Taps **Send code**. **1.** Server normalises to E.164, computes `phone_lookup_hmac`. **2.** Creates `OTPChallenge` with **`purpose = citizen_signup_login`**, 6 digits, **5-minute expiry**, single use, **max 5 attempts**, storing **`code_hash` only**. **3.** Stores `pending_consent_ref`. **4.** Sends SMS. **5.** `CIT-05` opens with a resend countdown |
| **Alternate flow (007)** | Resend after cooldown → **sets `superseded_by` on the previous challenge and invalidates it immediately**; a new challenge is created |
| **Alternate flow (008)** | **Change number** → returns to `CIT-04`; the outstanding challenge is abandoned and expires |
| **Exception flows** | **E1** Per-number, per-device or per-IP rate limit → uniform message and a cooldown. **E2** SMS delivery failure is **not distinguishable** in the response |
| **Offline** | **Impossible** |
| **Security / privacy** | **Uniform responses whether or not the number is registered** — the response body, status code and timing class must not differ. **The code and the number never appear in logs or audit text** |
| **Entities written** | `OTPChallenge` |
| **APIs / Screens** | `POST /auth/citizen/otp/request` *(`API-121`)* / `CIT-04`, `CIT-05` |
| **Audit** | `otp_requested` · `otp_rate_limited` |
| **Given/When/Then** | *Given* an unregistered number, *when* an OTP is requested, *then* the response is indistinguishable from a registered one. *Given* a resend, *when* the old code is submitted, *then* it is rejected |
| **Open decisions** | **`TBD — Hassan decision required`: SMS/OTP provider, cost and delivery policy.** No provider integration exists or is claimed |

### UC-CIT-009 — Verify OTP · UC-CIT-010 — First-time account creation · UC-CIT-011 — Returning-user login

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-009` verify · `UC-CIT-010` create · `UC-CIT-011` sign in |
| **Goal** | Prove control of the handset and obtain a session |
| **Main success flow** | **0.** Citizen types six digits at `CIT-05`. **1.** Taps **Verify**. **2.** Server compares against `code_hash`, checks expiry and attempts, consumes the challenge. **3.** **If no `CitizenPhoneCredential` matches the `phone_lookup_hmac`** → creates `CitizenPhoneCredential` and `CitizenAccount`, **and binds the recorded consent as three `ConsentRecord` rows in the same transaction** → `UC-CIT-010`. **4.** **If one matches** → signs in to the existing account → `UC-CIT-011`. **5.** Issues `AuthSession` *(`subject_type = citizen`, `authentication_method = citizen_otp`, `acting_role_assignment_id = null`)*, `RefreshTokenFamily`, `DeviceSession`. **6.** `CIT-06` opens |
| **Exception flows** | **E1** Wrong code → **uniform** message, attempts decremented. **E2** Expired → same uniform message. **E3** 5 failures → challenge dead; the citizen must resend. **E4** Account `DEACTIVATED` → plain message, **no session issued** |
| **Offline** | **Impossible. An OTP is never stored on the device for later verification** |
| **Security / privacy** | Wrong-code and expired-code outcomes are **operationally indistinguishable**. **Tokens are stored as hashes server-side** and in `expo-secure-store` on the device |
| **Entities written** | `CitizenAccount` · `CitizenPhoneCredential` · 3× `ConsentRecord` · `AuthSession` · `RefreshTokenFamily` · `DeviceSession` |
| **APIs / Screens / Capabilities** | `POST /auth/citizen/otp/verify` *(`API-122`)* / `CIT-05` / None |
| **Audit** | `otp_verified` · `citizen_account_created` · `phone_verified` · `consent_recorded` ×3 — **never the code, never the number** |
| **State** | Account → `ACTIVE` |
| **Acceptance criteria** | **Citizen login requires an OTP and accepts no password.** A second verification of the same number creates **no second account** |
| **Given/When/Then** | *Given* a new number, *when* the first OTP is verified, *then* exactly one `CitizenAccount` is created. *Given* the same number later, *when* an OTP is verified, *then* the citizen signs into the same account with their report history intact. *Given* any citizen route, *when* a password field is sought, *then* none exists |

### UC-CIT-012 — Wrong, expired or rate-limited OTP

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-012` |
| **Main flow** | **0.** Citizen submits an incorrect code. **1.** Server increments `attempts`. **2.** Returns a **uniform** failure with attempts remaining. **3.** After 5, the challenge is dead |
| **Alternate** | Expired → **the same uniform message**, so expiry is not distinguishable from a wrong code |
| **Exception** | Rate limit reached → cooldown message with the time remaining |
| **Security** | **No response reveals whether the number is registered, whether the code was close, or whether the challenge expired versus mismatched** |
| **Accessibility** | **Attempts remaining is announced**, not only shown |
| **Given/When/Then** | *Given* five wrong attempts, *when* a sixth is made, *then* the challenge is refused and a new one must be requested |

## Group 2 — Reporting

### UC-CIT-013 — Open the citizen home screen · UC-CIT-014 — Start a new report · UC-CIT-015 — Select a category

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-013` home · `UC-CIT-014` start · `UC-CIT-015` category |
| **Main flow** | **0.** `CIT-06` shows five tiles, each with **icon and text**. **1.** Taps **Report an Issue**. **2.** `CIT-07` shows an icon grid. **3.** Taps a category. **4.** `POST /citizen/drafts` creates a `ClientSubmission` with `pipeline_state = LOCAL_DRAFT` and **`reporter_subject_type = citizen`**. **5.** `CIT-08` opens |
| **Offline** | **Category selection and draft creation work offline**; the draft is local until a connection exists |
| **Entities written** | `ClientSubmission` |
| **APIs / Screens** | `GET /citizen/reports/summary`, `POST /citizen/drafts` *(`API-130`)* / `CIT-06`, `CIT-07` |
| **Accessibility** | Icons **always** carry text labels; **colour is never the sole carrier of meaning** |
| **Given/When/Then** | *Given* `CIT-06`, *when* it renders, *then* every tile has both an icon and a text label |

### UC-CIT-016 — Capture, review, retake and delete evidence · UC-CIT-017 — Denied camera permission

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-016` evidence · `UC-CIT-017` permission denied |
| **Main flow** | **0.** `CIT-08` shows a camera preview and a large shutter. **1.** Taps shutter → a **live** capture. **2.** Thumbnail appears. **3.** Taps a thumbnail → review, **Retake** or **Delete**. **4.** Continues |
| **Alternate** | **A1** Multiple photos or a short video. **A2** Under **branch B** *(D-14)* a **Skip** control appears **only** for approved categories |
| **Exception** | **E1** Camera permission denied → a **plain explanation and an offered path**, never a dead end. **E2** Storage full → named failure, draft preserved |
| **Offline** | **Capture works; media is stored app-private and queued** |
| **Security / privacy** | **Live capture only — no gallery path.** `storage_key` is opaque and **contains no phone number, account ID or name** |
| **Entities written** | `EvidenceObject` *(`photo` / `video`)* |
| **Screens** | `CIT-08` |
| **Open decisions** | **`TBD — Hassan decision required` (D-14): is at least one live photo required for every report?** **Branch A** — no Skip control, submission rejected with `422 E_EVIDENCE_REQUIRED`. **Branch B** — Skip shown only for approved categories, validation category-conditional. **A voice recording is not a substitute for visual evidence** |

### UC-CIT-018 — Record the issue by voice · UC-CIT-019 — Play, pause, delete, re-record · UC-CIT-020 — Typed fallback · UC-CIT-021 — Denied microphone

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-018` record · `UC-CIT-019` review recording · `UC-CIT-020` typed fallback · `UC-CIT-021` mic denied |
| **Goal** | Describe the problem by speaking |
| **Main flow** | **0.** `CIT-09` shows a **large microphone button** and a short prompt; **"type instead" is a small secondary option**. **1.** Taps **Record**. **2.** Speaks naturally — **Urdu, Punjabi, English or a natural mix**. **3.** Live waveform and elapsed time. **4.** Taps **Stop**. **5.** State becomes **"Recorded — review your recording"** with playback, re-record and continue |
| **Alternate (019)** | Play · pause · delete and re-record. **A re-recording replaces the draft's recording only before upload** |
| **Alternate (020)** | **Type instead** → a text field as an **accessibility fallback**, not the default. **The citizen is never required to type a complete complaint** |
| **Exception (021)** | Microphone permission denied → the text fallback is **offered with a plain explanation**, not forced |
| **Offline** | **Recording and playback work fully offline** |
| **Security / privacy** | The recording is **biometric-adjacent**. It was disclosed at `CIT-02` and consented at `CIT-03`. It is stored app-private |
| **Accessibility / language** | **The citizen never selects a spoken language before recording.** Voice is the primary path |
| **Entities written** | `EvidenceObject` kind **`voice_original`** |
| **Screens** | `CIT-09` |
| **Given/When/Then** | *Given* Punjabi speech, *when* it is submitted, *then* it is accepted and produces an Urdu-script rendering. *Given* `CIT-09`, *when* it renders, *then* the record control is primary and typing is secondary |

### UC-CIT-022 — Save a safe local draft

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-022` |
| **Main flow** | **0.** Any interruption — backgrounding, battery, connection loss. **1.** Draft metadata, `pipeline_state`, `rendering_version` and `rendering_content_hash` are written to local storage. **2.** Media stays app-private. **3.** On return, the draft resumes at the same state |
| **Offline** | **This is the offline case** |
| **Security / privacy** | Local media is **app-private**, which is an OS access control. **Encryption at rest is asserted in the stack document but its mechanism is not specified** |
| **Open decisions** | **`TBD — Hassan decision required` (D-10): the local-database and media encryption mechanism.** **This use case does not claim a specific protection**, because none is defined. An engineering feasibility check is required before the decision can be made |

### UC-CIT-023 — Upload the recording · UC-CIT-024 — AI transcription and Urdu rendering · UC-CIT-025 — Named processing states · UC-CIT-026 — Slow processing · UC-CIT-027 — AI failure

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-023` upload · `UC-CIT-024` render · `UC-CIT-025` states · `UC-CIT-026` slow · `UC-CIT-027` failure |
| **Main flow** | **0.** Connection available. **1.** Chunked resumable upload; the client sends `X-Chunk-SHA256` per chunk and **the server recomputes it**. **2.** `/complete` recomputes the whole-manifest hash server-side — **a client-declared hash is never trusted as proof**. **3.** Server-side ASR produces `source_asr_text`. **4.** An **Urdu-script civic rendering** is produced. **5.** Critical fields are extracted with per-field confidence. **6.** `rendering_content_hash` is computed. **7.** `VoiceTranscriptionArtifact` v1 is written with `is_active_version = true`, `model_name` and `model_version` recorded |
| **Named states (025)** | Ready to record · Recording · Recorded — review your recording · **Waiting for connection** · Uploading · **Processing your recording** · **Check the text — AI-generated** · A question about one detail · Corrected — please check again · Ready to send · **This text is out of date** · Something went wrong. **Never a blank spinner** |
| **Slow processing (026)** | Elapsed time and a plain reassurance are shown. **The citizen may leave the screen; the draft is not lost** |
| **AI failure (027)** | `processing_status = FAILED`. **The encrypted draft and the original recording are preserved. The draft remains a `ClientSubmission`. No `CivicReport` is created. No plausible replacement text is generated.** The citizen may retry, re-record, or — where authorised human review exists — have a reviewer produce a new rendering version **which returns to the citizen for confirmation** |
| **Offline** | **Upload and AI processing are impossible offline.** The screen says so plainly and holds the recording |
| **Security / privacy** | Evidence access is by **short-lived, single-use, session-bound URLs**. **No public bucket URL, ever** |
| **Entities written** | `EvidenceObject` committed · `VoiceTranscriptionArtifact` |
| **APIs** | `API-131`, `API-132`, `API-134` |
| **Audit** | `evidence_committed` |
| **Given/When/Then** | *Given* AI processing fails, *when* the citizen returns, *then* the recording and draft are intact and no report exists. *Given* offline, *when* the citizen reaches the recording step, *then* no screen claims transcription is available |
| **Open decisions** | **`TBD — Hassan decision required`: AI provider and processing location. None is named anywhere** |

### UC-CIT-028 — Review the rendering · UC-CIT-029 — Correct it · UC-CIT-030 — Low-confidence fields

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-028` review · `UC-CIT-029` correct · `UC-CIT-030` low confidence |
| **Main flow** | **0.** State becomes **"Check the text — AI-generated"**. **1.** The **Urdu civic rendering** is shown as text, **explicitly labelled AI-generated**, with the original recording playable beside it. **2.** Low-confidence critical fields are **visibly marked**. **3.** Tapping a marked field shows a **short, single-fact question** with the relevant audio replayable. **4.** Answering produces a **new artefact version**, `supersedes_artifact_id` set, the previous version retained and traceable |
| **Alternate** | **A1** Re-record entirely → a new artefact chain. **A2** Optional short text correction as an accessibility fallback |
| **Exception** | **E1** Confidence remains low after clarification → `human_review_status = PENDING`; **a reviewer may produce a new version but may never confirm it** |
| **Security / privacy** | **The intermediate ASR output is never shown to the citizen.** It may contain recognition errors, and showing it beside the confirmed rendering would confuse which text is authoritative |
| **Accessibility / language** | **AI-generated text is announced as AI-generated**, not only visually marked |
| **Given/When/Then** | *Given* a low-confidence street number, *when* the rendering is shown, *then* that field is marked and a targeted question is offered, and **the AI does not guess** |

### UC-CIT-031 — Confirm the exact rendering version · UC-CIT-032 — Stale or superseded version

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-031` confirm · `UC-CIT-032` stale |
| **Goal** | Approve **this exact text**, so a cached client cannot approve obsolete text |
| **Authorization** | **`CAP_RENDERING_CONFIRM_OWN`** — **own draft only** |
| **Input data** | `voice_transcription_artifact_id` · `client_submission_id` · `rendering_version` · **`rendering_content_hash`** · `reporter_subject_type` *(from the session)* · `reporter_account_id` *(from the session)* · `confirmed_at` · **idempotency key** |
| **Main flow** | **0.** `CIT-11` shows the active rendering and a version indicator. **1.** Citizen taps **Confirm and submit**. **2.** Server runs **all six checks**: artefact belongs to this reporter's own draft · rendering is the active version · content hash matches · not superseded · has not already produced a report · idempotency key is new. **3.** `RenderingConfirmation` is written. **4.** `pipeline_state → READY_TO_SUBMIT` |
| **Exception (032)** | **E1** Superseded → **`409 E_RENDERING_SUPERSEDED`**. **E2** Hash mismatch → **`409 E_RENDERING_HASH_MISMATCH`**. In both, **the client must re-fetch `API-134` and display the newest version.** **The server never silently accepts an older version and never silently upgrades the confirmation** |
| **Security / privacy** | `reporter_subject_type` and `reporter_account_id` are **taken from the session and rejected if the body disagrees**. **Nobody confirms on another person's behalf** |
| **Entities written** | `RenderingConfirmation` |
| **APIs / Screens / Capabilities** | `POST /citizen/drafts/{id}/rendering/confirm` *(`API-135`)* / `CIT-11` / `CAP_RENDERING_CONFIRM_OWN` |
| **Audit / State** | `rendering_confirmed` / `AWAITING_REPORTER_REVIEW` → `READY_TO_SUBMIT` |
| **Acceptance criteria** | **Confirmation means the citizen agrees the text represents what they meant — not that the AI is objectively perfect.** No screen may describe it otherwise |
| **Given/When/Then** | *Given* an offline client holding v1 while v2 is active, *when* it confirms v1, *then* `409 E_RENDERING_SUPERSEDED` and no report is created |
| **Open decisions** | **D-12 PROPOSED**: two distinct idempotency headers — `X-Confirmation-Idempotency-Key` here, `X-Submission-Idempotency-Key` at creation. **The sources are ambiguous and an implementer would otherwise guess** |

### UC-CIT-033 — GPS location · UC-CIT-034 — Move the pin · UC-CIT-035 — Denied GPS

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-033`, `UC-CIT-034`, `UC-CIT-035` |
| **Main flow** | **0.** `CIT-10` shows a map, a pin at the device position and an address hint. **1.** Citizen taps **Use my location** or drags the pin. **2.** Reverse geocoding fills the address hint. **3.** Taps **Confirm** |
| **Alternate (034)** | The pin is **movable by buttons, not only by drag** |
| **Exception (035)** | GPS denied → **manual pin placement, marked `location_unverified`**. **Reporting is not blocked** |
| **Offline** | **Last known position plus manual pin** |
| **APIs / Screens** | `GET /geo/reverse` / `CIT-10` |
| **Accessibility** | Address hint in the selected interface language |

### UC-CIT-036 — Review the complete report · UC-CIT-037 — Confirm and submit

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-036` review · `UC-CIT-037` submit |
| **Preconditions** | A valid `RenderingConfirmation` exists for the **active** version; required evidence present |
| **Main flow** | **0.** `CIT-11` shows category, **original recording playable**, **Urdu rendering labelled AI-generated**, version indicator, thumbnails and location. **1.** Citizen submits. **2.** **One atomic server transaction**: verify the `RenderingConfirmation` (six checks) · verify required evidence · **create `CivicReport(state = SUBMITTED)`** · **issue the human-readable, non-sequential `report_reference` in the same transaction** · bind `confirmed_rendering_artifact_id` and `confirmed_rendering_version` · record `ReportOwnership` · append the audit event. **3.** `CIT-13` shows the reference |
| **Exception** | **E1** No confirmation → **`422 E_RENDERING_NOT_CONFIRMED`**. **E2** Evidence missing under branch A → **`422 E_EVIDENCE_REQUIRED`**. **E3** Network lost → `CIT-12`, **queued, no reference** |
| **Offline** | **Creation is impossible offline — it is a server transaction** |
| **Security / privacy** | **`DRAFT` is not a `CivicReport` state. A `CivicReport` cannot be created in any state other than `SUBMITTED`** |
| **Entities written** | `CivicReport` · `ReportOwnership` |
| **APIs / Screens** | `POST /citizen/reports` *(`API-140`)* / `CIT-11`, `CIT-12`, `CIT-13` |
| **Audit / State** | `report_submitted` / *(none)* → **`SUBMITTED`** |
| **Given/When/Then** | *Given* a queued draft, *when* the citizen views it, *then* no `report_reference` is displayed and no `CivicReport` exists |

### UC-CIT-038 — "Waiting to send" · UC-CIT-039 — Retry or cancel a queued draft · UC-CIT-040 — Receive the official reference

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-038`, `UC-CIT-039`, `UC-CIT-040` |
| **Main flow (038)** | `CIT-12` shows **"Waiting to send"**, what is queued, and **Retry now / Edit / Cancel**. **No report reference. No claim that the authority has received it** |
| **Main flow (039)** | **Retry now** re-attempts with the **same** `client_submission_id` and the **same** submission idempotency key. A repeat therefore returns the original result and **creates no second report** |
| **Main flow (040)** | On success `CIT-13` shows the reference, what happens next, and an expected timeframe |
| **Exception** | Retry fails again → plain message, **the draft stays queued and intact** |
| **Security** | **Concurrent retries are serialised on `client_submission_id`; exactly one `CivicReport` results** |
| **Accessibility** | The queued state is **announced as "waiting to send, not yet sent"** |
| **Given/When/Then** | *Given* two concurrent retries of the same draft, *when* both complete, *then* exactly one `CivicReport` exists and both responses carry the same reference |

## Group 3 — Following the report

### UC-CIT-041 — My Reports · UC-CIT-042 — Report detail and sanitised history · UC-CIT-043 — Notifications

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-041`, `UC-CIT-042`, `UC-CIT-043` |
| **Main flow** | **0.** `CIT-14` lists reference *(or "waiting to send")*, category, **plain status** and date. **1.** Tapping opens `CIT-15` with the reference, summary, **sanitised timeline**, own evidence, own recording and approved updates. **2.** `CIT-20` lists notifications |
| **Authorization** | **Ownership enforced server-side.** A report belonging to another account returns the **same `404`** as one that does not exist |
| **Privacy** | **Never shown:** internal staff notes · staff personal contact details · which named officer acted · **the intermediate ASR output** · confidential investigation detail · security or audit internals |
| **Status labels** | Internal codes are never shown. `SUBMITTED` → *Received* · `UNDER_VERIFICATION` / `VERIFIED` / `UC_REVIEW` → *Being checked* · `ACCEPTED` → *Accepted for action* · `CONTRACTOR_ASSIGNED` → *Work arranged* · `IN_PROGRESS` → *Work started* · `COMPLETION_SUBMITTED` → *Work reported done* · `COMPLETION_VERIFICATION` → *Being confirmed* · `PENDING_CITIZEN_CONFIRMATION` → **Your answer needed** · `RESOLVED_CONFIRMED` → *Fixed* · `CLOSED` → *Closed* · `REOPENED` → *Being looked at again* · `REJECTED` / `CANCELLED` → shown **with the reason** |
| **APIs / Screens** | `API-150`, `API-151`, `GET /citizen/notifications` / `CIT-14`, `CIT-15`, `CIT-20` |
| **Audit** | `report_viewed` |
| **Accessibility** | Status is **text and icon**, never colour alone; unread is text-marked |

### UC-CIT-044 — Respond to a clarification request

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-044` |
| **Trigger** | A Street Representative or UC Officer requested clarification |
| **Main flow** | **0.** Notification arrives. **1.** `CIT-16` shows the question as text **and playable aloud**. **2.** Citizen taps **Reply by voice** and speaks, or types, or adds a photo. **3.** Reply is sent |
| **Offline** | **Queues — this is report content, not authentication** |
| **APIs / Screens / Capabilities** | `POST /citizen/reports/{id}/clarify` *(`API-152`)* / `CIT-16` / ownership |
| **Accessibility** | **The question is translated and read aloud**; "Not sure" is an explicit, blame-free option |

### UC-CIT-045 — Review completion evidence · UC-CIT-046 — Confirm fixed · UC-CIT-047 — Dispute · UC-CIT-048 — Add dispute evidence

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-045`, `UC-CIT-046`, `UC-CIT-047`, `UC-CIT-048` |
| **Preconditions** | State is `PENDING_CITIZEN_CONFIRMATION`; the citizen owns the report; **reporter ≠ completer** |
| **Main flow (045–046)** | **0.** `CIT-17` shows before/after evidence, the work note and the date. **1.** `CIT-18` asks *"Is this fixed?"* with **two large, clearly distinct buttons**. **2.** **Yes — fixed** → guarded on `state_version` → `RESOLVED_CONFIRMED` |
| **Main flow (047–048)** | **Not fixed** → `CIT-19` with a **reason picker plus voice or text explanation** and optional evidence → `REOPENED` |
| **Exception** | Stale `state_version` → **`409 E_STALE_STATE`**, refresh and re-ask |
| **Entities written** | `CitizenConfirmation` or `Dispute` |
| **APIs** | `API-153` confirm · `API-154` dispute |
| **Audit / State** | `resolution_confirmed` → `RESOLVED_CONFIRMED` · `resolution_disputed` → `REOPENED` |
| **Accessibility** | Reasons are **plain sentences**, not codes |
| **Open decisions** | **`TBD — Hassan decision required`: what happens if the citizen never confirms or disputes.** **No no-response closure policy is invented here.** Also **`TBD`: whether repeated reopening is capped** |

## Group 4 — Account management

### UC-CIT-049 — Change interface language · UC-CIT-050 — View the masked number · UC-CIT-052 — Manage notification consent

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-049`, `UC-CIT-050`, `UC-CIT-052` |
| **Main flow** | `CIT-21` shows the **masked** number, the language switch, the **SMS consent toggle**, and account controls |
| **Privacy** | **The citizen sees only their own number, masked. No operational role sees it at all, in any form** |
| **Consent** | **Withdrawing SMS consent does not deactivate the account.** Required and optional consents are separate rows |
| **APIs / Screens** | `GET`/`PATCH /citizen/profile` *(`API-155`)* / `CIT-21` |
| **Given/When/Then** | *Given* SMS consent withdrawn, *when* the citizen signs in, *then* the account is still `ACTIVE` and in-app notifications still work |

### UC-CIT-051 — Change the citizen mobile number

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-051` |
| **Main flow** | **0.** `CIT-22` explains two steps. **1.** OTP to the **old** number *(`purpose = citizen_phone_change_old`)*. **2.** OTP to the **new** number *(`purpose = citizen_phone_change_new`)*. **3.** Both verified → `CitizenPhoneCredential` updated, `previous_phone_lookup_hmac` and `changed_at` recorded |
| **Exception** | Either OTP fails → **uniform failure**, no change. New number already registered → **uniform failure**, revealing nothing |
| **Offline** | **Impossible. Neither OTP can be queued** |
| **APIs / Screens** | `POST /citizen/phone/change` *(`API-156`)* / `CIT-22` |
| **Audit** | `phone_changed` — **never the number** |
| **Accessibility** | Two **clearly separated** steps; digits LTR |

### UC-CIT-053 — Log out · UC-CIT-054 — Log out from all devices · UC-CIT-055 — Deactivate · UC-CIT-056 — Return after session expiry

| Field | Detail |
|---|---|
| **IDs** | `UC-CIT-053`, `UC-CIT-054`, `UC-CIT-055`, `UC-CIT-056` |
| **Main flow (053)** | **Log out** → `POST /auth/logout` *(`API-004`)* → server-side revocation. **Client discard is not a logout** |
| **Main flow (054)** | **Log out from all devices** → revokes the whole `RefreshTokenFamily` and every `DeviceSession` |
| **Main flow (055)** | **Deactivate** → account → `DEACTIVATED`; **the row is retained and the credential destroyed**; login is refused thereafter |
| **Main flow (056)** | Session expired → the app returns to `CIT-04` with a plain message; **queued drafts survive**; the citizen signs in again by OTP |
| **Security** | **Replay of a consumed refresh token revokes the whole family** |
| **APIs / Screens** | `API-004`, `API-128` / `CIT-21`, `CIT-04` |
| **Audit** | `session_revoked` · `citizen_account_deactivated` |
| **Open decisions** | **`TBD — legal or institutional review required`: how long `phone_lookup_hmac` may be retained after deletion to resist re-registration abuse** |

### UC-CIT-057 — Unauthorized access to another citizen's report

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-057` |
| **Trigger** | A crafted request naming another citizen's report ID |
| **Main flow** | **0.** Request arrives with a valid citizen session. **1.** Server resolves ownership through `ReportOwnership`. **2.** No match. **3.** Returns **`404`, identical in body and timing class to a non-existent report** |
| **Security** | **A client-supplied report identifier never authorises access.** Not-found, not-owned and no-permission-to-read are **indistinguishable**, so no route becomes an enumeration oracle |
| **Audit** | `unauthorised_access_attempt` |
| **Given/When/Then** | *Given* citizen A's session and citizen B's report ID, *when* the report is requested, *then* the response is `404` and identical to a request for a fabricated ID |

### UC-CIT-058 — Help and accessibility behaviour

| Field | Detail |
|---|---|
| **ID** | `UC-CIT-058` |
| **Main flow** | `CIT-23` answers: what each status means · **who can see my number** · **what happens to my voice recording** · how to contact support |
| **Offline** | **Fully offline** |
| **Accessibility** | Applies to every screen: ≥48dp targets · WCAG 2.1 AA contrast · **colour never the sole carrier of meaning** · usable at 200% text scale · full RTL mirroring with **digits, OTPs and references LTR** · every control labelled · **AI-generated text announced as AI-generated** · **queued state announced as "not yet sent"** · **no blank spinner without naming what is happening** |
| **Language** | **Human-reviewed translation. Machine translation is not acceptable for consent, privacy or status text** |

---

## Coverage summary

| Requirement group | Use cases |
|---|---|
| Onboarding and authentication (items 1–12) | `UC-CIT-001` … `012` |
| Reporting (items 13–40) | `UC-CIT-013` … `040` |
| Following the report (items 41–48) | `UC-CIT-041` … `048` |
| Account management (items 49–58) | `UC-CIT-049` … `058` |

**58 use cases · 23 screens · all covered.**

## Open decisions affecting this portal

| ID | Decision | Affected use cases |
|---|---|---|
| **D-08** | Pre-auth consent payload integrity — **PROPOSED** | `004`, `006`, `009` |
| **D-10** | Local encryption mechanism — **`TBD — Hassan decision required`** | `022`, `038`, `039` |
| **D-12** | Two idempotency keys — **PROPOSED** | `031`, `032`, `037`, `039` |
| **D-13** | No citizen name exists — **PROPOSED**, followed here | all privacy assertions |
| **D-14** | Mandatory photo — **`TBD — Hassan decision required`** | `016`, `036`, `037` |
| — | AI provider and location · SMS provider, cost and delivery · no-response closure · reopening cap · retry-window duration · retention durations | as marked above |

---

*Specified; not implemented; not tested. No screen in this document has been designed, built or usability-tested. No citizen has used any of this.*
