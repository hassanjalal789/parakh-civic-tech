# Parakh — Screen Inventory and Navigation

| Field | Value |
|---|---|
| **Version** | **1.4** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** No screen has been designed, built or usability-tested. |
| **Authority** | **Mobile SRS v2.1.0** *(written 13 Sep 2026 — now exists and governs the mobile client)* · **CR-61 rev 1.3** *(identity foundation)* · **`PARAKH-IRP v1.0`** *(14 Sep 2026)* · **Hassan Jalal's reconciliation instruction of 3 October 2026** |
| **Supersedes** | v1.2 (2 Sep 2026) · v1.1 · v1.0 · the `CZ-*` anonymous citizen screens `CZ-17` … `CZ-21` of SRS v1.4.2 |

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1.0 | 31 Aug 2026 | Initial five-portal inventory |
| 1.1 | 1 Sep 2026 | Privacy ordering corrected; offline OTP corrected; queued vs submitted separated; evidence requirement escalated to a TBD; masked-number contact replaced; citizen screens 21 → 23 |
| 1.2 | 2 Sep 2026 | Screen total corrected to 58; written interface languages restricted to Urdu and English; Shahmukhi/Gurmukhi TBD withdrawn; `STF-04` / `STF-05` factor labels corrected; voice-first states added inside `CIT-09` and `CIT-11`; pre-authentication consent corrected; `ACCEPTED` and `CLOSED` added |
| **1.3** | **2 Sep 2026** | **`REP-05` replaced by shared `STF-10 — Report an Issue Officially`** — available to all four staff roles holding `CAP_REPORT_OFFICIAL`; **`REP` 5 → 4, `STF` 9 → 10, total unchanged at 58**. **`CON-02` no longer exposes the original citizen recording or the ASR output.** **`AWAITING_CITIZEN_REVIEW` renamed `AWAITING_REPORTER_REVIEW`.** **`DRAFT` removed from the civic status table** — a draft is a device-pipeline state, not a `CivicReport` state. **Confirmation binding added to `CIT-11`.** **"Roman Urdu" removed as a spoken language.** Status line standardised |

| **1.4** | **3 Oct 2026** | **Reconciled against Mobile SRS v2.1.0.** **`STF-11 — My Official Reports` added** — `STF` 10 → 11, **total 58 → 59**. **§4 evidence decision CLOSED (`DR-28`)** — photo encouraged, optional; `CIT-08` gains a working skip control. **Unified Binary Architecture (`DR-25`/`DR-26`)** recorded — §5's Django/HTMX staff portals are **superseded as the staff client**. |

> **Reconciliation, 3 October 2026.** The authority line above previously pointed at *"SRS v2.0.0 — not yet written"*. **That placeholder is now closed: Mobile SRS v2.0.0 and v2.1.0 exist.** This revision reconciles this document against them and against the Project Lead's instruction of 3 October 2026. **Recovered requirements and decisions made now are labelled separately in every section they touch.**

> **Scope of this revision.** **Structural corrections only** — screen names, ownership, privacy fields, authentication requirements, technology labels, online/offline capability and totals. **This document is not expanded into a use case or tutorial.** Behavioural detail not yet approved is marked `DEFERRED — define during the portal use-case phase`.

> **Identifier policy.** The v1.4.2 citizen catalogue reached `CZ-21`. The five-portal model is a **new baseline**, so screens use **new prefixes** — `CIT-`, `STF-`, `REP-`, `UCO-`, `CON-`, `MAY-` — which cannot collide with any historical `CZ-`, `MO-`, `RP-` or `AD-` identifier. **No historical screen ID is reused or overwritten.** **`REP-05` is retired, not reassigned.**

---

## 1. Design principles

The citizen app is used by people with limited technical literacy, on low-end Android phones, on weak networks, often speaking Urdu or Punjabi.

| Principle | Consequence |
|---|---|
| **One decision per screen** | No screen asks two unrelated questions |
| **Consent before collection** | The citizen learns what the number **and the voice recording** are for **before** giving either |
| **Icons before words** | Categories are pictures with short labels, not a dropdown |
| **No jargon** | Never "RBAC", "role assignment", "scope", "token", "session" in citizen UI |
| **No password for citizens** | One number, one code. Nothing to remember or lose |
| **Speak, do not type** | **The reporter must never be required to type a complete complaint.** Voice is the primary path; typing is a fallback |
| **AI output is a draft, not a fact** | Every AI-produced text is labelled AI-generated until the **reporter** confirms it |
| **Nobody confirms for anybody else** | A reporter confirms **their own** rendering. No staff user confirms on another person's behalf |
| **Offline is normal for drafts — never for OTP or AI** | Drafts queue silently. **Authentication and AI processing always need a connection, and the app says so plainly** |
| **Queued ≠ received** | A draft waiting to send **never** shows an official reference and **has no `CivicReport`** |
| **Plain status language** | Internal state codes are never shown — §7 |

---

## 2. Citizen portal — React Native

### 2.1 Onboarding

Consent choices at `CIT-03` are **held on the device** as a `pending_consent` payload with a `consent_version` and a client-generated `pending_consent_ref`. That reference travels with the OTP request. **Only after the OTP is verified and the account exists is the recorded consent bound to it.** If the citizen abandons the flow, **no account and no consent record are created**.

`CIT-01` language → `CIT-02` privacy, phone and voice explanation → `CIT-03` consent *(held locally)* → `CIT-04` number → `CIT-05` OTP → account created or signed in, **consent bound** → `CIT-06` home.

| ID | Screen | Purpose | Visible fields | Primary action | Secondary | Loading | Empty | **Offline** | Error | Permissions | APIs | Accessibility | Language |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **CIT-01** | Splash & language | Choose the interface language before anything else | Logo, **two language buttons — اردو / English** | Select language | — | Brief logo | — | **Works fully offline** | — | None | — | 48dp targets, screen-reader labels | This screen **is** the language switch. **Punjabi is not offered as a written interface language in Release 0** |
| **CIT-02** | **Why we need your number and your voice** | Explain **before** collecting either | Plain language: why the number is required · **that reporting is not anonymous** · that the number is used for authentication · **that operational users never receive the number** · **that the voice recording is stored** · **that AI processes the recording and its output may contain errors** · **that the citizen reviews the Urdu text before sending** · that SMS alerts are optional and separately consented · that optional consent can be withdrawn without losing the account | Continue | Read full privacy notice · Change language | — | — | **Cached text, readable offline** | — | None | — | Readable at 200% zoom; no jargon | **Human-translated, not machine-translated** |
| **CIT-03** | **Consent** | Separate decisions, never one checkbox | **Required 1:** account creation and processing. **Required 2:** voice recording, storage and AI processing. **Optional:** SMS notifications | Agree and continue | Back | — | — | **Choices held on the device. Nothing is sent yet** | A required box unchecked → cannot continue, explained plainly | None | **None — no authenticated call is possible here.** Carried as `pending_consent_ref` on the OTP request and bound after verification | Each checkbox separately labelled and announced | Full translation |
| **CIT-04** | Mobile number | Collect the only identifier Parakh asks for | Country prefix `+92`, number field, reminder of why | Send code | Back · Change language | Button spinner | — | **"You need an internet connection to sign in." No queueing** | Invalid format, inline | None | `POST /auth/citizen/otp/request` *(carries `pending_consent_ref`)* | Numeric keypad, large digits | Digits stay LTR inside RTL |
| **CIT-05** | OTP verification | Verify ownership of the number | Six digit boxes, resend timer, edit-number link, attempts remaining | Verify | Resend after cooldown | Inline spinner | — | **"You need an internet connection to verify this code." The code is never stored for later verification** | **Uniform** wrong/expired message | None | `POST /auth/citizen/otp/verify` — **on success the account is created or signed in and consent is bound** | Auto-advance, paste support, announce attempts remaining | Digits LTR |
| **CIT-06** | **Home** | Five choices, nothing else | Report an Issue · My Reports · Notifications · Help · Profile & Settings | Report an Issue | Any tile | Skeleton tiles | "No reports yet" under My Reports | Shows cached counts | — | Citizen session | `GET /citizen/reports/summary` | Each tile has icon **and** text | — |
| **CIT-07** | Issue category | Pick what is wrong, by picture | Icon grid: water, road, drainage, streetlight, waste, other | Select | Back | — | — | **Fully offline** | — | Citizen | `GET /categories` | Icons have text labels; never colour alone | Icons chosen to be locally legible |
| **CIT-08** | Evidence capture | Capture proof live | Camera preview, capture, retake, thumbnails | Capture | **See §4 — behaviour depends on an open decision** | Shutter feedback | "Add a photo" | **Stored in encrypted app storage, queued** | Permission denied → explain, offer manual path | Camera | `POST /citizen/drafts/{id}/evidence` | Large shutter, haptic **and** audible confirm | Instructions voiced |
| **CIT-09** | **Speak the issue** | **The primary description path — see §3 for the full state list** | Large record button, live waveform, elapsed time, playback, re-record, **"type instead" as a fallback**, named processing state, **AI-generated label** | **Record** | Play · Re-record · Type instead | **Named processing states, never a bare spinner** | — | **Recording and drafting work offline. Upload and AI processing do not — the screen says so plainly** | Mic denied → text fallback offered, not forced. **AI failure preserves the recording and the draft** | Microphone | `POST /citizen/drafts/{id}/evidence` · `GET /citizen/drafts/{id}/rendering` | **Voice is the primary path.** All state changes announced | **Speak Urdu, Punjabi, English or a mix.** The written rendering is always Urdu script |
| **CIT-10** | Confirm location | Place the issue accurately | Map, pin, address hint, "use my location" | Confirm | Move pin manually | Map tiles spinner | — | **Last known position + manual pin** | GPS denied → manual pin, marked unverified | Location | `GET /geo/reverse` | Pin movable by buttons, not only drag | Address in the selected language |
| **CIT-11** | **Review & submit** | **The point at which the citizen confirms the exact active rendering version** | Category, **original recording playback**, **Urdu civic rendering shown as text, labelled AI-generated**, **rendering version indicator**, low-confidence fields marked, thumbnails, location | **Confirm and submit** | Play original · Re-record · Correct a marked field · Edit any part | — | — | **Confirmation may be prepared offline; the report is created only on the server** | **A stale or superseded rendering is rejected with a conflict error and the newest version is fetched** | Citizen | `POST /citizen/drafts/{id}/rendering/confirm` → `POST /citizen/reports` | The whole summary is read back, including the rendering | — |
| **CIT-12** | **Waiting to send** | **A queued draft — no `CivicReport` exists** | **"Waiting to send"** · what is queued · retry now · edit · cancel. **No report reference. No claim that the authority has received it** | Retry now | Edit · Cancel | Progress on retry | — | **This is the offline state** | Retry failed → plain message, stays queued | Citizen | `POST /citizen/reports` with `client_submission_id` + `idempotency_key` | Status announced as "waiting to send, not yet sent" | — |
| **CIT-13** | **Received** | **The backend created the `CivicReport`** | **Official report reference** · what happens next · expected timeframe | Go to My Reports | Report another | — | — | **Only reachable after a successful server response** | — | Citizen | Response of `POST /citizen/reports` | Reference is large, selectable, announced | — |
| **CIT-14** | My Reports | Everything this account submitted | List: reference *(or "waiting to send")*, category, **plain status**, date | Open a report | Filter by status | Skeleton rows | "You have not reported anything yet" | Cached list **plus queued drafts, clearly marked** | Retry | **Ownership enforced server-side** | `GET /citizen/reports` | Status is text **and** icon, never colour alone | Dates localised |
| **CIT-15** | Report detail | Progress in plain language | Reference, summary, **sanitised timeline**, evidence, approved updates | — | Share reference · Play own original recording | Skeleton | — | Cached detail | Retry | **Own report only** | `GET /citizen/reports/{id}` | Timeline is a list, not a graphic | — |
| **CIT-16** | Clarification | Answer a question from staff | Question text **and spoken playback**, voice or text reply, add photo | **Reply by voice** | Type instead · Not sure | Spinner | — | **Queued — this is report content, not authentication** | — | Own report | `POST /citizen/reports/{id}/clarify` | Question read aloud | Question is translated |
| **CIT-17** | Completion review | See before and after | Before/after evidence, work note, date | Continue | Zoom evidence | — | — | Cached | — | Own report | `GET /citizen/reports/{id}` | Images described in text | — |
| **CIT-18** | Confirm resolution | Say whether it is actually fixed | Question, **Yes — fixed** / **Not fixed** | Yes — fixed | Not fixed → CIT-19 | Spinner | — | Queued | Stale state → refresh and re-ask | Own report, correct state | `POST /citizen/reports/{id}/confirm` | Two large, clearly distinct buttons | — |
| **CIT-19** | Dispute | Say why it is not fixed | Reason picker + **voice or text explanation**, add evidence | Submit | Back | Spinner | — | Queued | Reason required | Own report | `POST /citizen/reports/{id}/dispute` | Reasons are plain sentences | — |
| **CIT-20** | Notifications | What changed | List: message, date, read state | Open related report | Mark all read | Skeleton | "Nothing new" | Cached | — | Own | `GET /citizen/notifications` | Unread is text-marked, not colour-only | — |
| **CIT-21** | Profile & settings | Control the account | **Masked** number, **interface language — Urdu or English**, **SMS consent toggle**, logout, logout all devices, deactivate | Save | Change number | Spinner | — | Read-only offline | — | Own | `GET/PATCH /citizen/profile` | **Number shown masked, never in full** | **Changing the interface language does not restrict which language may be spoken** |
| **CIT-22** | Change mobile number | Move the account to a new number | Step 1: OTP to **old** number. Step 2: OTP to **new** number | Verify both | Cancel | Spinner | — | **"You need an internet connection." Neither OTP can be queued** | Uniform failure | Own + **both OTPs** | `POST /citizen/phone/change` | Two clearly separated steps | Digits LTR |
| **CIT-23** | Help | Answer the common questions | FAQ · what each status means · **who can see my number** · **what happens to my voice recording** · contact | — | — | — | — | **Fully offline** | — | None | — | Plain language, no jargon | Fully translated |

**Citizen screens: 23.**

## 3. Voice-first reporting — states inside `CIT-09` and `CIT-11`

**These are not new screens.** They are named states within the existing voice screen and review screen.

| # | State shown | What the reporter sees | Rule |
|---|---|---|---|
| 1 | **Ready to record** | Large record button, short prompt in the chosen interface language | The reporter may speak **Urdu, Punjabi, English or natural code-switched speech** |
| 2 | **Recording** | Live waveform, elapsed time, stop | Works fully offline |
| 3 | **Recorded — review your recording** | Playback, re-record, continue | **The original recording is kept whatever happens next** |
| 4 | **Waiting for connection** | Plain message: the recording is safe and will be sent when online | **No AI processing is claimed to happen offline** |
| 5 | **Uploading** | Progress, cancel | — |
| 6 | **Processing your recording** | Named state, not a bare spinner | **Server-side. No on-device model exists** |
| 7 | **Check the text — AI-generated** *(`AWAITING_REPORTER_REVIEW`)* | The **Urdu civic rendering** as text, explicitly labelled AI-generated, with the original playable beside it | **The rendering is never presented as the reporter's exact words** |
| 8 | **A question about one detail** | A short, specific confirmation question on a low-confidence critical field, with the relevant audio replayable | **The AI never guesses a critical field** |
| 9 | **Corrected — please check again** | The updated rendering, still labelled AI-generated | A correction produces a **new version**; the previous version is retained |
| 10 | **Ready to send** *(`READY_TO_SUBMIT`)* | Confirm control on `CIT-11` | **A `CivicReport` is created only after the reporter confirms** |
| 11 | **This text is out of date** | The newest rendering is fetched and shown | **A stale or superseded version is rejected server-side, not silently accepted** |
| 12 | **Something went wrong** | Plain failure message, retry, re-record, or send for authorised human review | **Never generate plausible replacement text.** The draft and the original recording are preserved, **and no report is created** |

**Three artefacts, never conflated:**

| Artefact | Shown to the citizen? | Note |
|---|---|---|
| **Original voice recording** | **Yes** — playable at `CIT-09`, `CIT-11`, `CIT-15` | **Immutable while retained. The authoritative source** |
| **Intermediate source-language ASR output** | **No** | **The text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output.** An intermediate AI artefact that may contain recognition errors. Authorised staff reviewing a flagged rendering see it, labelled AI-generated. **Not shown to contractors** |
| **Urdu-script civic rendering** | **Yes** — at `CIT-11` for confirmation | **May involve transcription, transliteration, normalisation or translation.** An English→Urdu transformation is **translation**, not word-for-word transcription |

> **Roman Urdu is a written representation of Urdu in Latin script, not a spoken language.** No screen may list it as a spoken input option.

> **Confirmation means the reporter agrees this text represents what they meant.** It is **not** a claim that the AI output is objectively perfect, and no screen may describe it that way.

> **`TBD — Hassan decision required`: which AI provider, and where does processing happen?** **No provider has been selected, no hosting location has been decided and no legal approval has been obtained.**

`DEFERRED — define during the portal use-case phase`: the exact controls, button labels, main success flow, alternate flows and failure flows of this path; the human-transcript-review workflow and its queue.

## 4. Evidence requirement — RESOLVED 3 October 2026 (`DR-28`)

> **A photo is encouraged but optional. Neither Branch A nor Branch B below was adopted.**
>
> **This is a decision made now, by the Project Lead's instruction of 3 October 2026 — it was not recovered from any earlier source.** The question and both previously drafted branches are retained underneath as superseded evidence of the open decision.

| Aspect | Resolved behaviour |
|---|---|
| **`CIT-08`** | Camera prompt shown **first**, with a clearly labelled **"Continue without a photo"** control always enabled. **No category list, no conditional validation** |
| **`CIT-11`** | Review screen names what is attached and what is missing, in plain language: *"No photo attached — staff may ask for one later."* **Submit stays enabled** |
| **API validation** | **`E_EVIDENCE_REQUIRED` is withdrawn for citizen intake.** Submission requires a resolvable location **and** an intelligible description in **one** modality — confirmed rendering **or** typed text |
| **Reviewer screens** | `REP-02`, `UCO-02`, `UCO-03` show `evidence_completeness` ∈ `{none, partial, photographic}`. **Missing evidence is displayed, never concealed** |
| **Requesting more** | Reviewer uses the **existing** clarification path (`CIT-16`). **No new screen** |
| **Unchanged** | **`CON-03` contractor completion evidence stays required.** **`REP-04` completion-verification evidence stays required** |

**Rejected, and why:** *Branch A (mandatory for all)* would stop a citizen with a dead camera, a cracked lens or no light from reporting a real hazard at all. *Branch B (per-category list)* needs a category→policy table that becomes a second source of truth and a support burden, for a prototype with one developer.

> **Superseded — the open question as it stood until 3 October 2026, retained as historical evidence:**
>
> > **`TBD — Hassan decision required`: Is at least one live photo required for every Release 0 incident, or may specified categories be submitted without a photo?**
> >
> > **A voice recording is not a substitute for every form of visual evidence.** This decision remains open independently of the voice work.

| Branch | `CIT-08` behaviour | API validation | Screens affected | Tests affected |
|---|---|---|---|---|
| **A — photo mandatory for all** | No skip control. Submit disabled until ≥ 1 photo | Report creation rejects with `E_EVIDENCE_REQUIRED` | `CIT-08`, `CIT-11`, `STF-10` | `TEST-EVID-001` submit without photo is rejected |
| **B — optional for named categories** | Skip control shown **only** for categories on the approved list | Validation is **category-conditional**; the list is configuration, not code | `CIT-07`, `CIT-08`, `CIT-11`, `STF-10` | `TEST-EVID-002` skip allowed for a listed category · `TEST-EVID-003` skip refused for an unlisted category |

*(Both branch rows above are **superseded by `DR-28`** and retained only to show what was considered.)*

## 5. Staff portals — Django Templates + HTMX + Alpine.js

**All four staff portals share one activation and login experience.** Only role-relevant actions are shown. **RBAC vocabulary never appears in the interface.**

**The four staff portals are not migrated to React Native.** No authoritative source requires that change, and none is made.

### 5.1 Shared staff screens

**Every staff login is: official mobile number as the account identifier, plus a user-created password (knowledge factor) and a six-digit SMS OTP (possession factor). That is two-factor authentication.** **The mobile number is an identifier, not a factor.** No TOTP, no passkey, no hardware key.

| ID | Screen | Purpose | Key fields | **Offline** | APIs |
|---|---|---|---|---|---|
| **STF-01** | Activate invitation | Consume a single-use invitation | Invitation link, confirm mobile number | **Online only** | `POST /auth/staff/invitation/accept` |
| **STF-02** | Activation OTP | Prove the number belongs to the invitee | Six digits, resend | **Online only. Activating with a different number is refused** | `POST /auth/staff/otp/verify` |
| **STF-03** | Create password | **The user sets their own** | Password, confirm, strength guidance | **Online only** | `POST /auth/staff/password/set` |
| **STF-04** | **Login — password** | **First authentication factor (knowledge)** | Mobile number **(identifier)**, password | **Online only** | `POST /auth/staff/login` |
| **STF-05** | **Login — SMS OTP** | **Second authentication factor (possession)** | Six digits | **Online only** | `POST /auth/staff/login/otp` |
| **STF-06** | Select acting role | Choose **one** role for this session | Active assignments, each with plain-language scope | Online | `POST /auth/role/select` |
| **STF-07** | Password reset | Recover via OTP | Mobile number → OTP → new password | **Online only** | `POST /auth/staff/password/reset` |
| **STF-08** | Step-up verification | Fresh OTP for a sensitive action | Six digits, reason for the prompt | **Online only** | `POST /auth/step-up` |
| **STF-09** | Session management | See and end sessions | Device list, last seen, sign out all | Online | `GET/DELETE /auth/sessions` |
| **STF-10** | **Report an Issue Officially** | **The single shared official-reporting function for all four staff roles** | Category · evidence · voice recording · **Urdu rendering labelled AI-generated** · **rendering version indicator** · location · **acting role shown in plain language** · **exclusion warning before submission** | **Online only for AI processing and submission; recording works offline** | `POST /staff/drafts` · `POST /staff/drafts/{id}/rendering/confirm` · `POST /staff/reports/official` |

#### 5.1.1 `STF-10` — structural rules only

**`REP-05` is replaced by `STF-10`.** Official reporting is a **shared** function, not a Street Representative feature. **Four duplicate reporting screens are not created.**

| # | Rule |
|---|---|
| 1 | Available to **all four authenticated human staff roles holding `CAP_REPORT_OFFICIAL`** |
| 2 | The **authenticated staff account is recorded** |
| 3 | **Exactly one acting `RoleAssignment` is recorded** |
| 4 | The staff reporter **may confirm only their own official-report rendering** — `CAP_RENDERING_CONFIRM_OWN` |
| 5 | A staff user **cannot confirm a citizen's rendering** |
| 6 | A staff user **cannot confirm another staff user's rendering** |
| 7 | Submission **creates an account-level `ConflictExclusion`** |
| 8 | The exclusion applies **across every current and future role held by that account** |
| 9 | The screen states plainly, before submission, that **the reporter will be excluded from acting on this report** |

`DEFERRED — define during the portal use-case phase`: the exact buttons, screen sequence, main success flow, alternate flows and failure flows of `STF-10`; who performs the `PENDING_CITIZEN_CONFIRMATION` step when the reporter was a staff official.

> **STF-06 shows a plain sentence, not a matrix:** *"You are signed in as Street Representative for Ward 4, Union Council 12."* Switching role is explicit, and switching **upward** requires a fresh OTP.
>
> **STF-08 appears only when the most recent successful OTP — login or step-up, whichever is later — is older than 10 minutes.** **The login OTP at STF-05 already satisfies the window.**
>
> **STF-07 password reset revokes all existing sessions**, notifies the staff member and the appropriate administrator, and **cannot reactivate a suspended, revoked or expired account**.
>
> **SMS OTP is not a strong factor.** It is vulnerable to SIM swap, SS7 interception and social engineering. It was chosen because it is the only factor reliably available to every intended user on any handset. **No screen may describe it as highly secure.**

**A staff mobile-number change is not available as self-service.** It requires an authorised administrative request — see `MAY-03`.

> **The Technical System Administrator has no screen in this inventory.** Infrastructure access is **out-of-band authentication controlled by the deployment environment — not specified as part of the civic application login.**

### 5.2 Street Representative — `REP-`

| ID | Screen | Purpose | Primary action | Conflict handling |
|---|---|---|---|---|
| **REP-01** | My verifications | Work queue for this ward | Open item | **Own reports never appear in this queue** |
| **REP-02** | Verify issue | Field verification with evidence. **Original recording and ASR output available, scope-limited, for verification** | Submit outcome: verified · not verified · duplicate suspected · inaccessible · needs clarification | Blocked if this **account** reported it. **No option silently deletes the report** |
| **REP-03** | Verify completion | Check the contractor's claim | Confirm or reject completion | Blocked if this account did the work **or** reported it |
| **REP-04** | Declare conflict / recuse | Step aside voluntarily | Recuse with reason | Creates a `ConflictExclusion`; the item reroutes |

**`REP-05` is retired at rev 1.3** and replaced by shared **`STF-10`**. The identifier is **not reassigned**.

### 5.3 UC Officer — `UCO-`

| ID | Screen | Purpose | Primary action | Step-up |
|---|---|---|---|:--:|
| **UCO-01** | UC dashboard | Volume, overdue, awaiting action | Open queue | — |
| **UCO-02** | Review verified report | Decide what happens. **Original recording scope-limited for verification; Urdu rendering labelled AI-generated** | **Accept** · **Reject** · Request clarification · **Flag rendering for review** | ✓ on reject |
| **UCO-03** | Assign contractor | Choose an eligible contractor | **Assign** | **✓** |
| **UCO-04** | Reassign or escalate | Move work | Reassign · Escalate to Mayor & Ops | ✓ on reassign |
| **UCO-05** | Handle citizen dispute | Respond to a dispute | Rework · Reassign · Escalate | ✓ |
| **UCO-06** | **Close case** | **Ordinary closure — UC Officer only** | **Close with reason** | **✓** |
| **UCO-07** | Invite Street Representative | Onboard a Representative | Send invitation | **✓** |
| **UCO-08** | Case history *(own scope)* | Read the record | — | ✓ |

> **UCO-02's Accept control produces the `ACCEPTED` state.** Assignment at `UCO-03` is only reachable from `ACCEPTED` — acceptance cannot be skipped.
>
> **UCO-03 lists only contractors passing every eligibility check.** **An ineligible contractor is not rendered and cannot be selected.** The server re-checks on submit regardless.
>
> **UCO-07 cannot grant a scope wider than the inviting officer's own.**
>
> **UCO-06 is the only ordinary closure screen in the system.** Mayor & Ops has no equivalent.
>
> **A UC Officer flagging a rendering for review does not gain the right to confirm it.** The original reporter confirms the corrected version.

### 5.4 Contractor — `CON-`

| ID | Screen | Purpose | Primary action |
|---|---|---|---|
| **CON-01** | Assigned work | What has been given to this organisation | Open job |
| **CON-02** | Job detail | **What to fix and where** | Accept or decline **with an allowed reason** |
| **CON-03** | Update progress | Keep the case current | Post update |
| **CON-04** | Submit completion | Evidence that work is done | Submit completion |

**`CON-02` work packet — changed at rev 1.3.**

| **Contains** | **Must not contain** |
|---|---|
| Confirmed **Urdu civic rendering** | **Original citizen audio** |
| Issue category | **Intermediate source-language ASR output** |
| Required location | Citizen mobile number |
| **Relevant redacted photo/video evidence** | `CitizenAccount` ID |
| Work instructions | Citizen name |
| Safe access information | Internal staff notes |
| Progress and completion requirements | Unrestricted audit narrative |

> **A voice recording identifies the speaker in a way text does not.** A contractor is an external commercial party who needs to know **what to fix and where** — not who said it or how they sound. **Enforced server-side, not by template omission.**
>
> **An expired, suspended or revoked contractor cannot accept work or submit completion**, even with a still-valid session — checked at the point of action.

### 5.5 Mayor & Operations — `MAY-`

| ID | Screen | Purpose | Primary action | Step-up |
|---|---|---|---|:--:|
| **MAY-01** | Operations dashboard | City-wide health, overdue, reopened | Drill down | — |
| **MAY-02** | Escalations | Cases needing intervention | Act | — |
| **MAY-03** | Account administration | Provision and manage staff; **approve staff mobile-number changes** | Invite · Suspend · Revoke · Approve number change | **✓** |
| **MAY-04** | Role and scope | Assign authority | Assign with **mandatory expiry** | **✓** |
| **MAY-05** | Contractor organisations | Approve and manage vendors | Approve · Suspend | **✓** |
| **MAY-06** | Audit review *(civic)* | Read the civic record | Filter and read | ✓ |
| **MAY-07** | **Exceptional intervention** | Rare, high-impact acts — **never ordinary closure** | Act, with mandatory reason | **✓** |
| **MAY-08** | **Send protected message** | Contact a citizen **without ever seeing a number** | Choose template or permitted text, send | **✓** |
| **MAY-09** | Formal appeal decision | Decide an appeal | Decide, and **record the resulting case transition explicitly** | ✓ |

> **MAY-08 renders no citizen phone number in any form — not masked, not partial, not on hover.** **If the citizen consented to SMS notification the message may go by SMS; otherwise it is delivered in-app only.** The audit event contains no phone number.
>
> **MAY-07 is not a closure screen.** **Mayor & Ops performs no ordinary case closure** — that is `UCO-06`.
>
> **MAY-09's decider must not have been previously involved in that case.** The appeal is tracked on the dispute record as `appeal_status`; **the case itself remains `REOPENED`.**
>
> **Mayor & Ops access to an original recording is authorised, scope-limited and audited** — not routine browsing.

**Staff screens: 10 shared + 4 + 8 + 4 + 9 = 35.**

## 6. Screen totals — recounted from the tables above, not inherited

| Portal | Screen IDs | v1.1 | v1.2 | **v1.3 counted** |
|---|---|--:|--:|--:|
| Citizen | `CIT-01` … `CIT-23` | 23 | 23 | **23** |
| Shared staff | `STF-01` … `STF-10` | 9 | 9 | **10** |
| Street Representative | `REP-01` … `REP-04` | 5 | 5 | **4** |
| UC Officer | `UCO-01` … `UCO-08` | 8 | 8 | **8** |
| Contractor | `CON-01` … `CON-04` | 4 | 4 | **4** |
| Mayor & Operations | `MAY-01` … `MAY-09` | 9 | 9 | **9** |
| **Total** | | **56 ✗** | **58** | **59** |

**Arithmetic shown at rev 1.3:** `23 + 10 + 4 + 8 + 4 + 9 = 58`.

**Arithmetic at rev 1.4:** `23 + 11 + 4 + 8 + 4 + 9 = 59` — **`STF` 10 → 11** with the addition of `STF-11`.

| ID | Screen | Purpose | Key fields | Primary action | Offline | APIs |
|---|---|---|---|---|---|---|
| **STF-11** | **My Official Reports** | **The only surface on which a staff official reporter sees the reports they filed.** Closes `RC-18` / `D-02` / `D-03` | Reference · plain status · category · submitted date · **exclusion banner** · open clarification count · `evidence_completeness` | Open a report | **List cached; actions queue** | `API-150s` · `API-152` |

> **Why this screen exists.** A UC Officer who files an official report through `STF-10` previously had **no screen anywhere** showing what happened to it — `[SRC-RBAC §3]` grants staff **scope-based** read, not **ownership-based** read, and `ConflictExclusion` bars the reporting account from acting. **Reading is not acting.** `STF-11` grants read plus two reporter rights — answer a clarification, and confirm or dispute the resolution of **their own** report. **Every reviewing verb stays excluded and returns `403 E_CONFLICT_EXCLUDED`.**

**Rev 1.3 adds no net screen.** `REP-05` was **retired** and one shared `STF-10` **added** in its place — `REP` 5 → 4, `STF` 9 → 10, **total unchanged at 58**. The alternative — four duplicate reporting screens, one per staff role — would have produced 61 screens for one function and is explicitly rejected.

*(Rev 1.1 stated 56, which was arithmetically wrong: four screens were added but the total was incremented by two. Rev 1.2 corrected it to 58.)*

## 7. Internal status → citizen-facing label

**Citizens never see internal state codes.** Several internal states collapse to one citizen label where the distinction is internal only.

**Device-pipeline states — these are `ClientSubmission` states, not `CivicReport` states:**

| Pipeline state | Citizen label (English) | Urdu | Meaning shown |
|---|---|---|---|
| `LOCAL_DRAFT` | **Not finished** | مکمل نہیں | "Finish and send when ready" |
| `WAITING_FOR_CONNECTION` | **Waiting to send** | بھیجنے کا انتظار | **"Not sent yet. No reference until it reaches us"** |
| `UPLOADING` · `TRANSCRIPTION_PROCESSING` | **Checking your recording** | آپ کی ریکارڈنگ دیکھی جا رہی ہے | "We are turning your recording into text for you to check" |
| **`AWAITING_REPORTER_REVIEW`** | **Please check the text** | براہِ کرم متن دیکھیں | "Read it and tell us if it is right" |
| `READY_TO_SUBMIT` | **Ready to send** | بھیجنے کے لیے تیار | "Press send when you are ready" |
| `SUBMISSION_FAILED` | **Not sent — try again** | نہیں بھیجی گئی — دوبارہ کوشش کریں | "Something went wrong. Your recording is safe" |

**Civic `CivicReport` states — `DRAFT` is not one of them:**

| Internal state | Citizen label (English) | Urdu | Meaning shown |
|---|---|---|---|
| `SUBMITTED` | Received | موصول ہو گئی | "We have your report" |
| `UNDER_VERIFICATION` | Being checked | جانچ کی جا رہی ہے | "Someone is checking this on the ground" |
| `VERIFIED` | Being checked | جانچ کی جا رہی ہے | *(same label — the distinction is internal)* |
| `UC_REVIEW` | Being checked | جانچ کی جا رہی ہے | *(same label)* |
| `ACCEPTED` | **Accepted for action** | کارروائی کے لیے منظور | "The office has accepted this and is arranging work" |
| `CONTRACTOR_ASSIGNED` | Work arranged | کام سونپ دیا گیا | "Work has been given to a team" |
| `IN_PROGRESS` | Work started | کام جاری ہے | "Work is happening" |
| `COMPLETION_SUBMITTED` | Work reported done | کام مکمل بتایا گیا | "The team says it is finished" |
| `COMPLETION_VERIFICATION` | Being confirmed | تصدیق ہو رہی ہے | "Someone is checking the work" |
| `PENDING_CITIZEN_CONFIRMATION` | **Your answer needed** | آپ کا جواب درکار ہے | "Please tell us if this is fixed" |
| `RESOLVED_CONFIRMED` | Fixed | ٹھیک ہو گیا | "You confirmed this is fixed" |
| `CLOSED` | Closed | بند کر دیا گیا | "This report is finished and closed" |
| `REOPENED` | Being looked at again | دوبارہ دیکھا جا رہا ہے | "We reopened this" |
| `REJECTED` | Not taken forward | آگے نہیں بڑھایا گیا | Shown **with the reason** |
| `CANCELLED` | Cancelled | منسوخ | Shown **with the reason** |

**Never shown to citizens:** internal staff notes · staff personal contact details · which named officer acted · **the intermediate source-language ASR output** · confidential investigation detail · security or audit internals.

## 8. Offline behaviour — the authoritative rule

| Operation | Offline? |
|---|:--:|
| Choose language, read privacy notice, read Help | **✓ Works** |
| Make consent choices before signing in | **✓ Works — held on the device, sent with the OTP request** |
| Prepare a draft **while already authenticated** | **✓ Works** |
| Capture evidence, **record voice**, place a pin | **✓ Works** |
| Play back your own recording | **✓ Works** |
| Queue a draft for later sending | **✓ Works — shows "Waiting to send", no reference, no `CivicReport`** |
| Answer a clarification, confirm resolution, dispute | **✓ Queues — report content, not authentication** |
| **AI transcription and Urdu rendering** | **✗ Impossible — server-side only. No on-device model has been implemented or tested** |
| **Creating a `CivicReport`** | **✗ Impossible — it is a server transaction** |
| **Request an OTP** · **Verify an OTP** | **✗ Impossible** |
| **Staff activation · staff login · password reset · phone change · step-up** | **✗ Impossible** |

**In every impossible case the app shows a plain-language connection message and preserves non-sensitive input where safe.** **An OTP is never stored on the device for later verification.** **A recording waiting for processing is never discarded.**

## 9. Accessibility and localisation — every screen

| Requirement | Rule |
|---|---|
| Touch targets | ≥ 48dp |
| Contrast | WCAG 2.1 AA |
| Colour | **Never the sole carrier of meaning** — every status has text and an icon |
| Screen reader | Every control labelled; OTP announces attempts remaining; **queued state announced as "not yet sent"**; **AI-generated text announced as AI-generated** |
| Text scaling | Usable at 200% without loss of function |
| RTL | Full mirroring for Urdu; **digits and phone numbers stay LTR inside RTL text** |
| **Written interface languages** | **Urdu and English only**, switchable at `CIT-01` and `CIT-21` |
| **Spoken input languages** | **Urdu, Punjabi, English and natural code-switched speech.** The written civic rendering is always Urdu script |
| **ASR output scripts** | **The intermediate ASR text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output.** **Roman Urdu is not a spoken language** |
| Translation | **Human-reviewed. Machine translation is not acceptable for consent, privacy or status text** |
| Low-end devices | Android 7+; skeletons over spinners; images downscaled before upload |

> **Punjabi is removed as a written interface language for Release 0**, and **the Shahmukhi-versus-Gurmukhi TBD is withdrawn**.
>
> **Punjabi speech is fully supported.** **Removing the Punjabi UI does not remove Punjabi speakers.**

## 10. Related tests

`TEST-SCR-001` OTP cannot be verified offline · `002` queued draft shows no official reference and has no `CivicReport` · `003` consent precedes number entry · `004` required and optional consent are separate controls · `005` withdrawing SMS consent does not deactivate the account · `006` citizen sees masked number only · `007` **`CON-02` renders no citizen identity, no original audio and no ASR output** · `008` ineligible contractor is not selectable · `009` Mayor has no ordinary closure control · `010` protected message sends without revealing the number and respects SMS consent · `011` step-up appears only when the most recent OTP is older than 10 minutes · `012` RTL layout renders correctly with LTR digits · `013` no written Punjabi interface option is offered · `014` Punjabi speech is accepted and produces an Urdu rendering · `015` submit is blocked until the reporter confirms the rendering · `016` AI-generated text is labelled on every screen that shows it · `017` AI failure preserves the recording and the draft and creates no report · `018` no screen presents AI processing as available offline · `019` abandoning onboarding creates no account and no consent record · `020` `STF-04` and `STF-05` describe first and second factors, never a third · `021` **`STF-10` is reachable by all four staff roles holding `CAP_REPORT_OFFICIAL`** · `022` **`STF-10` is not reachable without `CAP_REPORT_OFFICIAL`** · `023` **a staff user cannot confirm a citizen's rendering** · `024` **a staff user cannot confirm another staff user's rendering** · `025` **`REP-05` does not exist in the navigation graph** · `026` **a stale rendering version is rejected and the newest version is fetched** · `027` **no screen lists Roman Urdu as a spoken language** · `028` **no citizen-facing status label maps to a `DRAFT` `CivicReport` state**.

**Every test above: `Specified; not implemented; not executed`.**

---

*Specified; not implemented; not tested. No screen has been designed, prototyped, built or usability-tested. No user has seen any of this. No AI provider has been selected.*
