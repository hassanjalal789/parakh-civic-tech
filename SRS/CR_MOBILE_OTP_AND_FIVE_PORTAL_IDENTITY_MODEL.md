# CR-61 — Mobile-OTP Citizen Accounts, Voice-First Reporting and the Five-Portal Identity Model

| Field | Value |
|---|---|
| **Change Request ID** | **CR-61** *(verified next available; CR-01 … CR-60 exist)* |
| **Document revision** | **1.3** |
| **Raised** | 31 August 2026 |
| **Revised** | 2 September 2026 |
| **Approved by** | **Hassan Jalal — Founder & Project Lead** |
| **Type** | **BREAKING** — authentication model, actor model, reporting model, API surface, data model |
| **Effective version** | **SRS v2.0.0** *(not yet written)* · API Contract **v3.0** · Build Spec **v2.0.0** *(not yet written)* · Database **v3.0** *(not yet written)* |
| **Supersedes** | **CR-59** (identity-free anonymous reporting) — superseded in full |
| **Retains** | **CR-60** (React Native migration) — **unchanged and reaffirmed** |
| **Status** | **Specified; not implemented; not tested.** |

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1.0 | 31 Aug 2026 | Initial change record |
| 1.1 | 1 Sep 2026 | Uniform staff authentication made explicit; permission contradictions corrected; privacy ordering corrected; offline OTP corrected; queued vs submitted separated; state machine canonicalised; protected contact added |
| 1.2 | 2 Sep 2026 | Authentication-factor terminology corrected — identifier is not a factor, staff login is two-factor; Technical System Administrator removed from the civic authentication matrix; interface language reduced to Urdu and English; voice-first AI reporting model added; pre-authentication consent persistence corrected; step-up timing corrected; `ACCEPTED` and `CLOSED` added; appeal pseudo-transition removed; terminology unified on `CivicReport` |
| **1.3** | **2 Sep 2026** | **Staff official-reporting foundation added** — `REP-05` replaced by shared **`STF-10`**; `CAP_VOICE_CONFIRM` replaced by **`CAP_RENDERING_CONFIRM_OWN`**. **`DRAFT` removed from `CivicReport.state`** — a CivicReport is created atomically at `SUBMITTED`; **12 canonical states, 15 enum values**. **`AWAITING_CITIZEN_REVIEW` renamed `AWAITING_REPORTER_REVIEW`.** **AI-failure contradiction resolved** — `REVIEW_REQUIRED` never bypasses reporter confirmation; the `TRANSCRIPTION_REVIEW_REQUIRED` submission path is **withdrawn**. **Contractor access to original citizen audio and to the ASR transcript removed.** **Exact-rendering-version confirmation binding specified.** **Retention wording corrected** — "immutable while retained", not permanently retained. **`official_identifier` renamed `staff_reference`** and removed from login. **"Roman Urdu" removed as a spoken language.** **Detailed use cases explicitly deferred** |

> **Scope of this revision.** This is a **documentation-finalisation** revision. **No use case, click-by-click journey, portal tutorial or detailed interaction flow is created here.** Behavioural detail that genuinely belongs to a portal use case is marked `DEFERRED — define during the portal use-case phase`.

---

## 1. Executive statement

Parakh's Release 0 citizen authentication changes from **identity-free anonymous reporting** to **mobile-number accounts verified by SMS OTP**. The actor model changes from four actors (`CZ`, `REP`, `MOD`, `ADM`) to **five civic portals**: Citizen, Street Representative, UC Officer, Contractor, Mayor & Operations.

Revision 1.2 added the **voice-first** reporting model. **Revision 1.3 completes the reporting foundation**: official staff reporting becomes a shared, properly authorised function; the boundary between the pre-submission pipeline and the official civic record is made exact; and three privacy and integrity defects are closed.

**Moderator and Administrator are removed as standalone portals.** Every responsibility is mapped in §9.

---

## 2. Why this is a new baseline, not an amendment

A mechanical search of the ten active documents on 31 August 2026 found **1,101 occurrences** of superseded terms — `Moderator` 388, `Administrator` 313, `anonymous` 249, `AnonymousAccessGrant` 47, `tracking token` 26, `identity-free` 25, others 53.

> `Moderator` appears 288 times in the SRS alone, in **semantically distinct roles** — actor, permission holder, transition owner, test fixture, screen owner. **No find-and-replace remaps those correctly.** **SRS v2.0.0 must therefore be authored as a new baseline, and `Parakh_Prototype_SRS_v1.4.2.md` is retained unchanged as the superseded record.**

> **SRS v2.0.0 has not been written.** Until it exists, **this change record is the binding architecture source** for the identity, authentication, RBAC, data-model and reporting-foundation decisions it contains.

---

## 3. Authentication — corrected terminology

### 3.1 An identifier is not a factor

| Element | What it is | What it is **not** |
|---|---|---|
| **Mobile number** | **Account identifier.** It names the account | **Not an authentication factor.** It is not secret and is often known to others |
| **Password** | **Knowledge factor** — something the user knows | — |
| **SMS OTP** | **Possession factor** — proof of control of the registered handset | — |

### 3.2 Citizen authentication

**Mobile number (identifier) + six-digit SMS OTP (possession factor). No password in Release 0.**

> **This is single-factor authentication using a possession factor.** It is **not** two-factor merely because the citizen types a number and then a code. **No document may describe citizen login as two-factor.**

Behaviour: first successful OTP verification **creates** the `CitizenAccount`; later verification **signs in** to the existing account. Report access is by **authenticated account ownership** through *My Reports*.

**Withdrawn and not to be restored:** anonymous citizen reporting · anonymous tracking tokens · submission recovery codes · identity-free access · password-based citizen login.

### 3.3 Staff authentication — the four civic portals

**Official mobile number (identifier) + user-created password (knowledge) + six-digit SMS OTP (possession).**

> **This is two-factor authentication.** Password and OTP are the two factors. **The mobile number is not a third factor, and no document may call this three-factor authentication.**

Applies identically to **Street Representative · UC Officer · Contractor · Mayor & Operations**. One central authentication service; authorisation is evaluated **after** authentication.

**Excluded from Release 0:** TOTP authenticator applications · passkeys · WebAuthn · hardware security keys · different login technologies per staff role · server-side biometric authentication · administrator-created passwords · passwords sent by SMS, email, WhatsApp or on paper. **Device biometric unlock** may later be offered as an optional **local** convenience for unlocking the app; **it never replaces server authentication and is not implemented.**

**Account lifecycle rules:** an authorised official creates or invites the account → single-use invitation → SMS OTP verification of the official number → **the user creates their own password** → an active `RoleAssignment` must also exist before any portal privilege applies → the system issues a **revocable** session → **suspended, revoked or expired accounts cannot authenticate**, and suspension or revocation **invalidates active sessions**.

### 3.4 Technical System Administrator — outside the civic authentication model

> **Out-of-band infrastructure authentication controlled by the deployment environment — not specified as part of the civic application login.**

**The Technical System Administrator:** is **not** a sixth civic portal · has **no civic role assignment** · **cannot** view civic reports, evidence, citizen identity, voice recordings, transcripts, staff notes or civic audit narrative · **may** perform deployment, backup, configuration and cryptographic integrity operations **only**.

**It is excluded from the civic authentication matrix and from the RBAC matrix.** Revision 1.1 wrongly gave it a mobile+password+OTP civic login. **That is withdrawn.**

### 3.5 SMS OTP — honest limitations

SMS OTP is **not immune** to SIM swap, SS7 interception, malicious SIM-port requests, or a shared handset. **No document may claim otherwise.** Release 0 mitigations: strict rate limits, uniform responses, session revocation on suspicious recovery, step-up for sensitive actions, notification to the previous number on change where feasible, and audit of every credential event. **Stronger factors are deferred, not denied.**

### 3.6 Step-up authentication

**One step-up rule for the four civic staff portals.** *(Citizens and the Technical System Administrator are **not** covered by this rule.)*

```text
recent_auth_at = max(mfa_satisfied_at, step_up_satisfied_at)
```

| Aspect | Rule |
|---|---|
| Method | **Fresh six-digit SMS OTP** |
| Window | **10 minutes** measured from `recent_auth_at` |
| Inside the window | **Do not ask again** |
| Outside the window | Require a fresh OTP; on success update `step_up_satisfied_at` |
| Audit | The step-up is audited. **The OTP and the mobile number never appear in audit text** |
| Offline | **Impossible** |

> **Why this correction matters.** Revision 1.1 compared only `step_up_satisfied_at`, which is null immediately after login. A user who had just completed the login OTP would have been asked for **another** OTP seconds later. Taking the **maximum** of both timestamps fixes it.

**Applies to:** rejecting a report · assigning or reassigning a contractor · closing a case · creating, suspending or revoking an account · changing a role or scope · approving or suspending a contractor organisation · generating an export · exceptional intervention · initiating protected citizen contact.
**Does not apply to:** routine queue viewing, ordinary progress viewing, non-sensitive navigation.

---

## 4. Interface language — Urdu and English only

**The citizen application interface offers exactly two written languages: Urdu and English.**

**Punjabi is removed as a written interface option for Release 0.** The **`TBD — Punjabi script choice: Shahmukhi or Gurmukhi` is withdrawn**, because Parakh will not ship a separate Punjabi written interface.

**Spoken input supports Urdu, Punjabi, English and natural code-switched speech.**

> **Roman Urdu is not a spoken language.** It is a **written representation** of Urdu in Latin script. The accurate statement about model output is:
>
> **"The intermediate ASR text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output."**

> **Interface language and report language are separate decisions.** Buttons, instructions, privacy notices, consent text, statuses and help are shown in **Urdu or English**. **The displayed civic-report rendering is always Urdu script**, even when the interface language is English. **Switching the interface to English does not turn the report rendering into English.**

---

## 5. Voice-first reporting — the primary path

**The reporter is never required to type a complete complaint.**

Architectural sequence — **not a use case**:

1. Reporter selects **Report an Issue**
2. Reporter chooses the issue category
3. Reporter captures evidence per the evidence policy *(see §14 — an open decision)*
4. Reporter records speech
5. **The original audio is stored as immutable evidence**
6. AI processes the audio after secure upload
7. The system produces an **Urdu-script civic rendering**
8. Reporter reviews, listens to, re-records or corrects a specific field
9. **Reporter confirms the exact active rendering version** — §11
10. **Only after confirmation may a `CivicReport` be created** — §10
11. **The confirmed rendering and the original audio remain traceably linked throughout the approved retention period** — §13

**Permitted alternatives:** re-recording · correcting a specific critical field · **optional short text correction as an accessibility fallback** · audio playback · Urdu text-to-speech read-back where technically feasible and **clearly marked as generated playback**.

`DEFERRED — define during the portal use-case phase`: the exact controls, screen sequence, button labels, main success flow, alternate flows and failure flows of this path.

---

## 6. Three speech artefacts — precise terminology

**Not every transformation is "transcription".** Three distinct artefacts exist:

| Artefact | What it is | Rules |
|---|---|---|
| **Original voice recording** | What the reporter actually said | **Immutable while retained. Never overwritten by AI output. The authoritative source for later review** |
| **Intermediate source-language ASR output** | AI speech-to-text of what was spoken. **The text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output** | Preserved internally for traceability where technically available. **Clearly labelled AI-generated. Not a verified human statement.** **Not shown to citizens or contractors** |
| **Urdu-script civic rendering** | The standardised Urdu-script representation shown to reporter and authorised staff | May involve **transcription, transliteration, normalisation or translation** depending on what was spoken. **Clearly labelled AI-generated until the reporter confirms it** |

> **An English-to-Urdu transformation is translation and normalisation, not word-for-word transcription.** Calling it transcription would misrepresent what the system did to the reporter's words, which matters when the rendering is later treated as a civic record.

**The rendering must preserve:** location · issue type · severity · time · quantities · **negation** · infrastructure type · safety risk · evidence references.

---

## 7. AI must not silently change decision-critical information

**Critical fields:** location · street, ward, village or UC · issue category · severity · time · dates · quantities · **negation** · affected infrastructure · safety risk · affected people · evidence references.

**On low confidence the system must:** preserve the original recording → **visibly mark the uncertain field** → ask a **short targeted confirmation question** → allow replay or re-recording → **not guess** → route for authorised human review if still unresolved.

**AI may assist with:** speech recognition · Urdu-script rendering · category suggestion · critical-field extraction · low-confidence detection · clarification suggestions.

**AI must never make the final decision on:** report acceptance · rejection · verification · assignment · completion approval · dispute · appeal · closure.

---

## 8. Pre-submission pipeline — distinct from the civic state machine

**AI transcription and Urdu rendering are not available offline. No on-device model has been implemented or tested, and none is claimed.**

**All draft and AI-processing states belong to `ClientSubmission`. They are NOT civic case states:**

`LOCAL_DRAFT` → `WAITING_FOR_CONNECTION` → `UPLOADING` → `TRANSCRIPTION_PROCESSING` → **`AWAITING_REPORTER_REVIEW`** → `READY_TO_SUBMIT`
plus `SUBMISSION_FAILED`.

> **Renamed at rev 1.3.** `AWAITING_CITIZEN_REVIEW` becomes **`AWAITING_REPORTER_REVIEW`**, because the same pipeline serves both citizen reporters and authorised staff official reporters.

**Offline behaviour:** an already-authenticated reporter may record voice offline → the original audio is held in **encrypted local application storage** → the draft shows **"Waiting for connection"** → **no AI transcript is fabricated locally** → **no official report reference is issued** → on reconnection the audio uploads under an **idempotent** submission → AI processing begins after secure upload → the reporter reviews and confirms → **only then is a `CivicReport` created**.

### 8.1 AI-processing failure — the contradiction resolved

**Revision 1.2 said both "no official submission without reporter confirmation" and "where approved, allow submission flagged `TRANSCRIPTION_REVIEW_REQUIRED`". Those cannot both hold. The second is withdrawn.**

**Release 0 rule:**

| # | Rule |
|---|---|
| 1 | AI-processing failure **preserves the encrypted draft and the original recording** |
| 2 | The draft **remains a `ClientSubmission`** — no `CivicReport` is created |
| 3 | The reporter may later **retry or re-record** |
| 4 | Where authorised human transcript review is available, the reviewer may **produce or correct a new Urdu-rendering version** |
| 5 | **The rendering returns to the original reporter for confirmation** |
| 6 | **No staff reviewer confirms on the reporter's behalf** |
| 7 | A `CivicReport` is created **only after the original reporter confirms the current version** |
| 8 | AI failure **must never create plausible replacement text** |
| 9 | **Audio-only official submission is not part of Release 0** |

**`REVIEW_REQUIRED` may remain a `VoiceTranscriptionArtifact.processing_status` or a draft-review status. It must never bypass reporter confirmation and must never become a `CivicReport` lifecycle state.** **`TRANSCRIPTION_REVIEW_REQUIRED` is withdrawn as a submission path.**

`DEFERRED — define during the portal use-case phase`: the human-transcript-review workflow, its queue, its notifications and its screen behaviour.

**Five states the interface must never conflate:** queued locally · uploaded for processing · awaiting reporter review · officially submitted · received by Parakh.

---

## 9. Moderator and Administrator responsibility mapping — nothing is deleted

### 9.1 Moderator (`MOD`) → new owner

| Old responsibility | Old requirement | **New owner** | Capability |
|---|---|---|---|
| Review submitted report queue | `FR-MOD-001` | **UC Officer** | `CAP_CASE_TRIAGE` |
| Open a report for moderation | `FR-MOD-002` | **UC Officer** | `CAP_CASE_TRIAGE` |
| **Accept a report** | `FR-MOD-003` | **UC Officer** | **`CAP_CASE_ACCEPT` → produces `ACCEPTED`** |
| Request clarification | `FR-MOD-004` | **UC Officer**, **Street Representative** | `CAP_CASE_CLARIFY` |
| Reject with coded reason | `FR-MOD-006` | **UC Officer** | `CAP_CASE_REJECT` — step-up |
| **Final administrative closure** | `FR-REP-101` | **UC Officer** | **`CAP_CASE_CLOSE` → produces `CLOSED`** |
| Decide appeals | `FR-ADM-102`, `BR-030` | **Mayor & Ops** | `CAP_APPEAL_DECIDE` |
| Read case audit history | `FR-AUD-003` | **Mayor & Ops**; UC Officer scope-limited | `CAP_AUDIT_READ` |
| Proxy completion | `FR-FIX-001` | **Contractor** | — *(a real contractor portal now exists; proxy is unnecessary)* |
| Safeguarding queue | `FR-SAF-002` | **Mayor & Ops** | `CAP_SAFEGUARDING` — P1 |

### 9.2 Administrator (`ADM`) → new owner

| Old responsibility | Old requirement | **New owner** | Capability |
|---|---|---|---|
| Create operator accounts | `FR-ADM-003` | **Mayor & Ops** | `CAP_ACCOUNT_ADMIN` — **explicit, never automatic** |
| Participant attestation | `FR-ADM-001` | **Removed** | Citizens self-register by OTP |
| Capability grants with expiry | `FR-ADM-002` | **Mayor & Ops** | `CAP_ROLE_ASSIGN` |
| Second-factor reset | `FR-AUTH-008` | **Self-service** via password reset | **SMS OTP needs no admin reset** |
| **Integrity verification** | `FR-AUD-005` | **Technical System Administrator** | **`CAP_AUDIT_INTEGRITY_VERIFY` — technical only** |
| **Civic audit narrative** | `FR-AUD-003` | **Mayor & Ops** | **`CAP_AUDIT_READ` — never the Technical System Administrator** |
| Environment / configuration | `FR-OPS-*` | **Technical System Administrator** | *(infrastructure)* |

> **Ordinary case-management authority never implies account-administration authority.** A UC Officer with `CAP_CASE_TRIAGE` cannot create another UC Officer without a separate `CAP_ACCOUNT_ADMIN` grant.

---

## 10. Canonical incident state machine — twelve states

**Revision 1.2 listed `DRAFT` as the first `CivicReport` state. That was wrong.** A draft is not an official civic record: it has no report reference, no official existence and no civic accountability. Keeping `DRAFT` in the lifecycle enum invited a report to be created before confirmation.

**`DRAFT` is removed from `CivicReport.state`.**

### 10.1 The creation rule

A `CivicReport` is created **only** after all four preconditions hold:

1. The **Urdu-script civic rendering exists**
2. The **reporter has confirmed the current active rendering version** — §11
3. **Required evidence validation has passed** — §14
4. The **backend accepts the submission**

```text
ClientSubmission.READY_TO_SUBMIT
        │
        └──▶  atomic server transaction
                 ├─ create CivicReport(state = SUBMITTED)
                 ├─ issue the human-readable, non-sequential report_reference
                 ├─ bind confirmed_rendering_artifact_id and rendering_version
                 ├─ record ReportOwnership
                 └─ append the audit event
```

**The report reference is issued in the same server transaction that creates the `CivicReport`.** **No reference exists before that transaction commits.** **A queued draft has no `CivicReport` and no official reference.**

**The transition `pipeline → DRAFT → SUBMITTED` is withdrawn.** The first state of a `CivicReport` is **`SUBMITTED`**.

### 10.2 The twelve canonical states

`SUBMITTED` → `UNDER_VERIFICATION` → `VERIFIED` → `UC_REVIEW` → **`ACCEPTED`** → `CONTRACTOR_ASSIGNED` → `IN_PROGRESS` → `COMPLETION_SUBMITTED` → `COMPLETION_VERIFICATION` → `PENDING_CITIZEN_CONFIRMATION` → `RESOLVED_CONFIRMED` → **`CLOSED`**

Plus `REOPENED`, `REJECTED`, `CANCELLED` — **15 enum values in total**.

**Ownership:** reporter confirmation of the voice rendering permits creation at `SUBMITTED` · Street Representative verification produces `VERIFIED` · **system** routes to `UC_REVIEW` · UC Officer acceptance produces **`ACCEPTED`** · UC Officer assignment produces `CONTRACTOR_ASSIGNED` · contractor acceptance produces `IN_PROGRESS` · completion evidence produces `COMPLETION_SUBMITTED` · **system** routes to `COMPLETION_VERIFICATION` · a **conflict-free** Street Representative verifies · citizen confirmation produces `RESOLVED_CONFIRMED` · **UC Officer** performs final administrative closure producing **`CLOSED`**.

**`RESOLVED_CONFIRMED` and `CLOSED` may share the citizen-facing label "Fixed", but the internal states remain distinct.**

**Ordinary closure:** UC Officer only · correct scope · no conflict · recent OTP within the window · **mandatory closure reason or checklist** · only after eligible prerequisites · audited. **Mayor & Ops cannot perform ordinary closure.**

`DEFERRED — define during the portal use-case phase`: the detailed actor interaction sequence for every transition, including queues, notifications, alternate paths and error recovery.

### 10.3 Formal appeal

The case **remains `REOPENED`**. The appeal is tracked on the dispute record:

**`Dispute.appeal_status ∈ { NOT_FILED · FILED · UNDER_REVIEW · DECIDED }`**

An **independent Mayor & Ops actor who was not a prior actor on that case** decides it. Appeal events are audited, and **the case-state transition following the decision is explicit**, not implied. **No parenthesised pseudo-state such as `REOPENED → (appeal)` exists.**

---

## 11. Reporter confirmation — exact rendering-version binding

**The problem this closes.** A cached or offline client could hold an obsolete Urdu rendering and confirm it after a newer version had been produced. The report would then be created from text the reporter never actually saw in its current form.

### 11.1 What every confirmation must carry

| Field | Purpose |
|---|---|
| `voice_transcription_artifact_id` | Which artefact is being confirmed |
| `client_submission_id` | Which draft it belongs to |
| `rendering_version` | Which version of the rendering |
| **Rendering content hash** | Proof the client displayed **this exact text** |
| **Reporter subject type** | `citizen` or `staff` |
| **Reporter account ID** | Who confirmed |
| Confirmation timestamp | When |
| **Idempotency key** | Prevents a duplicate `CivicReport` on retry |

### 11.2 What the backend must verify

| # | Check |
|---|---|
| 1 | The artefact **belongs to the authenticated reporter's own draft** |
| 2 | The rendering is the **active version** |
| 3 | The **supplied content hash matches** the stored rendering |
| 4 | The rendering **has not been superseded** |
| 5 | The confirmation **has not already produced another report** |
| 6 | The **idempotency key cannot create a duplicate `CivicReport`** |

**A stale confirmation is rejected with a documented conflict error, and the client must then retrieve the latest rendering.** **The server never silently accepts an older version, and never silently upgrades the confirmation to the newer one.**

`DEFERRED — define during the portal use-case phase`: the exact screen interaction when a stale confirmation is rejected.

---

## 12. Staff official reporting — shared foundation

### 12.1 The contradiction this resolves

Revision 1.2 contained an architectural contradiction:

- `CAP_REPORT_OFFICIAL` allowed **any** authorised staff user to submit an official report;
- rendering confirmation was restricted to **citizens only**;
- the screen inventory placed official reporting only at **`REP-05`**, under Street Representative.

**UC Officers, Contractors and Mayor & Operations therefore had a capability they could not exercise, and any staff reporter would have been unable to confirm their own rendering.**

### 12.2 The correction

**`REP-05` is replaced by one shared staff screen: `STF-10 — Report an Issue Officially`.** It is available to **all four authenticated human staff roles holding `CAP_REPORT_OFFICIAL`**. **Four duplicate reporting screens are not created.** The inventory total does not increase — `REP` moves from 5 screens to 4, `STF` from 9 to 10.

**Architecture-level rules:**

| # | Rule |
|---|---|
| 1 | The **authenticated staff account is recorded** on the report |
| 2 | **Exactly one acting `RoleAssignment` is recorded** |
| 3 | The staff reporter **may submit an official incident report** |
| 4 | The staff reporter **may confirm only their own official-report rendering** |
| 5 | A staff user **cannot confirm a citizen's rendering** |
| 6 | A staff user **cannot confirm another staff user's rendering** |
| 7 | Submission **creates an account-level `ConflictExclusion`** |
| 8 | Conflict exclusion applies **across every current and future role held by that account** |

### 12.3 `CAP_RENDERING_CONFIRM_OWN` replaces `CAP_VOICE_CONFIRM`

**`CAP_VOICE_CONFIRM` is withdrawn.** Its name and its citizen-only scope both misdescribed the function.

| Holder | May confirm |
|---|---|
| **Citizen** | **Their own citizen draft only** |
| **Authorised staff reporter** *(holds `CAP_REPORT_OFFICIAL`)* | **Their own staff-official draft only** |

> **`CAP_RENDERING_CONFIRM_OWN` never permits confirmation on another person's behalf** — not by a moderator, not by a reviewer, not by an administrator, not by a Mayor & Ops user, not by a Technical System Administrator.

`DEFERRED — define during the portal use-case phase`: the buttons, screen sequence, main success flow, alternate flows and failure flows of `STF-10`.

`DEFERRED — define during the portal use-case phase`: who performs the `PENDING_CITIZEN_CONFIRMATION` step when the reporter was a staff official rather than a citizen.

---

## 13. Contractor privacy — original audio removed

**Revision 1.2 gave contractors access to the original citizen voice recording for assigned reports. That is withdrawn.**

A voice recording is **biometric-adjacent** and identifies the speaker in a way text does not. A contractor is an external commercial party who needs to know **what to fix and where** — not **who said it, or how they sound**.

**The contractor work packet may contain:**

- The **confirmed Urdu civic rendering**
- Issue category
- Required location
- **Relevant redacted photo/video evidence**
- Work instructions
- Safe access information
- Progress and completion requirements

**It must not contain:**

- **Original citizen audio**
- **Intermediate source-language ASR transcript**
- Citizen mobile number
- `CitizenAccount` ID
- Citizen name
- Internal staff notes
- Unrestricted audit narrative

**Retained access:** the citizen keeps access to **their own** recording · Street Representative and UC Officer access remains **scope-limited and only where required for verification** · Mayor & Ops access is **authorised, scope-limited and audited**.

**This must be enforced server-side, not by template omission.**

---

## 14. Retention wording — corrected

**Revision 1.2 implied that raw citizen voice recordings are permanently retained while the legally approved retention period remains undecided. That claim is withdrawn.**

**Approved wording:**

- **Original audio is immutable while retained.**
- **Original audio and the confirmed rendering remain traceably linked throughout the approved retention period.**
- **Raw audio is deleted according to the approved retention policy.**
- **A permitted non-reversible hash, deletion tombstone and audit event may remain after deletion.**
- **A hash or tombstone must never be described as recoverable audio.**

> **`TBD — legal or institutional review required`: the raw-audio retention duration.** No duration is stated, implied or assumed anywhere in this documentation set.

> **`TBD — Hassan decision required`: is at least one live photo required for every Release 0 report, or may named categories be submitted without one?** **A voice recording is not a substitute for every form of visual evidence.** The voice pipeline does not resolve this and must not be read as resolving it.

---

## 15. Report and case terminology

**`CivicReport` is the principal record throughout the entire lifecycle.** After acceptance it may be **described to users** as an accepted case. **No separate `CivicCase` entity is created**, and legacy wording implying that an undefined record springs into existence on acceptance is removed.

---

## 16. Account-creation chain — locked

| Account | Created or invited by |
|---|---|
| **Citizen** | **Self-created** after successful SMS OTP verification |
| **Street Representative** | **UC Officer**, within the UC Officer's own authorised scope |
| **UC Officer** | **Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`** |
| **Contractor** | **Mayor/Ops user holding `CAP_ACCOUNT_ADMIN`**, after contractor-organisation approval |
| **Mayor/Ops** | Initial account bootstrapped out-of-band; later accounts invited by an authorised Mayor/Ops Account Administrator |
| **Technical System Administrator** | Provisioned out-of-band through the deployment environment. **Not a civic portal** |

**Public staff signup is impossible for every staff role.** **No administrator may choose, view, transmit or store another user's password.** **Account activation and role authorisation are separate** — an `ACTIVE` `StaffAccount` with no active `RoleAssignment` has **no staff-portal privileges**.

### 16.1 Staff identifier terminology — corrected

**Revision 1.2 carried both `StaffAccount.official_identifier` and a protected mobile number in `StaffCredential`. Two ambiguous login identifiers is a defect.**

| Field | Rev 1.3 status |
|---|---|
| **Login identifier** | **The official mobile number**, stored only through the protected `StaffCredential` design |
| **`official_identifier`** | **Renamed `staff_reference`.** **Not used for login.** **Optional.** An administrative or employee reference only. **Not returned unless a caller explicitly needs it** |

---

## 17. Multi-role staff architecture

**One `StaffAccount` holds zero, one or many `RoleAssignment`s.**

After authentication:

| # | Rule |
|---|---|
| 1 | **Exactly one `RoleAssignment` is selected as the acting role** |
| 2 | Privileged requests carry the **acting `RoleAssignment` ID** |
| 3 | Permissions are evaluated **only against that one assignment** |
| 4 | **Capabilities from multiple assignments are never combined** |
| 5 | **Role switching is explicit** |
| 6 | Role expiry or revocation is checked **at the point of action** |
| 7 | **Account-level conflict exclusions apply regardless of the currently selected role** |

> **The architectural example:** *"A UC Officer who submits an official report remains excluded from verifying, accepting, assigning, approving, closing or deciding a dispute on that report — even after switching to a Street Representative or Mayor/Ops assignment."*

`DEFERRED — define during the portal use-case phase`: the role-switching interaction and its screen behaviour.

---

## 18. Privacy effect — honestly stated

| | v1.4.2 | **v2.0.0** |
|---|---|---|
| Citizen identifier collected? | **No** | **Yes — mobile number** |
| Voice recording stored? | Yes | **Yes, and now bound to an identified account** |
| Can Parakh link a citizen's reports? | Weakly, by content | **Yes, by account** |
| Can a reporter be compelled to be identified? | No identifier existed | **Yes** |
| Who can see the number? | n/a | **No operational user, in any form.** Contact is system-mediated |
| Who can hear the original audio? | Broad | **Citizen (own) · Rep and UC Officer scope-limited for verification · Mayor & Ops authorised and audited. Never the contractor** |

> **This is a real reduction in reporter protection and is not presented as neutral.** Someone reporting a civic failure is often least protected from the authority concerned. **v2.0.0 accepts that cost** for account-based tracking, notification, dispute handling and abuse control. **The mitigation is access restriction, not anonymity.** **Citizens must never be described as anonymous, untraceable or identity-free.**

**Voice adds a second sensitivity.** The original audio is **biometric-adjacent**. It is stored, processed by AI, and retained under the approved retention policy. **This must be disclosed before the first recording**, and it is, at `CIT-02`.

> **`TBD — Hassan decision required`: external AI provider and data-processing location.** **No provider, no hosting location and no legal approval is named or assumed anywhere in this documentation set.**

---

## 19. Requirements affected

**Superseded in full:** `FR-ANON-001` … `FR-ANON-011` · `FR-AUTH-004a` · `C-6a` · `BR-007a` · `BR-039` · `BR-040` · `DR-20` · `INV-ANON-01/02` · entities `AnonymousAccessGrant`, `SubmissionRecovery` · endpoints `API-030` *(anonymous form)*, `API-110`–`API-119` · screens `CZ-17`–`CZ-21`.

**Superseded by the uniform-auth decision:** every requirement mandating **TOTP** for staff — `FR-AUTH-007` in its TOTP form, `NFR-SEC-010` as written, and entities `MfaEnrolment`, `MfaRecoveryCode`.

**Superseded by the language decision:** every requirement providing a **Punjabi written interface**. **Punjabi speech input is retained and strengthened.**

**Superseded at rev 1.3:** `CAP_VOICE_CONFIRM` → **`CAP_RENDERING_CONFIRM_OWN`** · screen `REP-05` → **`STF-10`** · `CivicReport.state = DRAFT` → **removed** · `AWAITING_CITIZEN_REVIEW` → **`AWAITING_REPORTER_REVIEW`** · `TRANSCRIPTION_REVIEW_REQUIRED` as a submission path → **withdrawn** · contractor access to original audio and ASR transcript → **withdrawn** · `official_identifier` → **`staff_reference`, not a login identifier**.

**Retained:** `DR-19` React Native · `DR-6` backend stack · `BR-002` live capture · `BR-022` no-deletion · `BR-041` account-level conflict · evidence integrity · audit chaining · human final decisions.

**Reinstated in amended form:** `C-6` → **`C-6b`**, requiring a verified *account*, not an attested institutional identity.

---

## 20. Risks

| Risk | Severity | Mitigation | Residual |
|---|---|---|---|
| Reporter deterrence once identified | **High** | Access restriction; explanation before consent | **Real. Accepted by decision** |
| SIM swap / OTP interception | **High** | Rate limits, revocation on recovery, step-up | **Not eliminable with SMS OTP** |
| **ASR accuracy on Punjabi and code-switched speech** | **High** | Confidence marking, targeted clarification, human review, immutable original audio | **Real and unmeasured — no accuracy figure is claimed** |
| **AI silently altering a critical fact** | **High** | Critical-field extraction with per-field confidence; reporter confirmation required before creation | Mitigated by design, **not by measurement** |
| **Reporter cannot read the Urdu rendering** | **High** | Audio read-back, original-recording replay, icon-led controls | **Requires usability testing — not performed** |
| **Stale rendering confirmed from a cached client** | **Medium-High** | Version, content hash, supersession and idempotency checks — §11 | Mitigated by design, **not by testing** |
| Shared phones | **Medium-High** | Logout-all; no sensitive data on the home screen | Partially mitigated |
| Phone-number recycling | **Medium** | Re-verification after dormancy | **`TBD — Hassan decision required`** |
| SMS cost and deliverability | **Medium** | Rate caps; in-app primary, SMS optional | **No provider integration exists or is claimed** |

---

## 21. Versioning

| Document | From | **To** | Status |
|---|---|---|---|
| This record | 1.2 | **1.3** | **Returned in this package** — controlled revision, **no new change request** |
| RBAC and Scope Matrix | 1.2 | **1.3** | **Returned in this package** |
| Data Model and Identity Schema | 1.2 | **1.3** | **Returned in this package** |
| Screen Inventory and Navigation | 1.2 | **1.3** | **Returned in this package** |
| API Contract | 2.0 | **3.0** | **Returned in this package** |
| Technical Stack | 1.2 | **1.3** | **Returned in this package** |
| **SRS** | 1.4.2 | **2.0.0** | **NOT WRITTEN.** `Parakh_Prototype_SRS_v1.4.2.md` is preserved unchanged as the superseded baseline |
| **Build Specification** | 1.3.1 | **2.0.0** | **NOT WRITTEN.** It is an extraction of the SRS P0 set and cannot be regenerated before SRS v2.0.0 exists |
| **Database Architecture** | 2.7 | **3.0** | **NOT WRITTEN.** v2.7 still describes `AnonymousAccessGrant` |

## 22. Detailed use cases — intentionally deferred

**Detailed citizen, Street Representative, UC Officer, Contractor and Mayor/Ops use cases are intentionally deferred until the identity, authentication, RBAC, data model, screen inventory, API foundation and SRS baseline are approved.**

The future use-case phase will separately define: what each actor clicks · detailed reporting steps · queues and task handling · alternate paths · error recovery · notifications · verification procedure · contractor assignment procedure · completion procedure · citizen confirmation and dispute procedure · portal tutorials.

`docs/use-cases/AUTHENTICATION_AND_INCIDENT_REPORTING_USE_CASES.md` is **not modified by this revision** and remains a superseded record of the anonymous model.

## 23. Approval

Approved by **Hassan Jalal**. **No implementation, build, test, deployment, SMS-provider integration, AI-provider selection, security certification, user testing, partnership or legal approval exists or is claimed.**

---

*Specified; not implemented; not tested.*
