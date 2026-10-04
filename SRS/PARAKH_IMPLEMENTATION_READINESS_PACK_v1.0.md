# Parakh — Implementation Readiness Pack v1.0

| Field | Value |
|---|---|
| **Document** | `PARAKH-IRP` — Implementation Readiness Pack |
| **Version** | **1.0** |
| **Date** | 14 September 2026 |
| **Author** | Lead Technical Product Manager / React Native Solutions Architect |
| **For** | **Hassan Jalal — Founder & Project Lead** |
| **Governs** | SRS **v2.1.0** · proposed SRS **v2.2.0** · proposed `TECHNICAL_STACK` **v1.4** · `mobile/` configuration |
| **Status** | **Decision pack — 30 items closed on architectural authority · 19 items escalated with recommendations** |

---

## 0. Disposition summary — read this first

**49 open items were reviewed: 32 `[TBD]` and 17 `[NEEDS RECONCILIATION]`.**

| Disposition | Count | Meaning |
|---|--:|---|
| **✅ CLOSED** | **30** | An engineering or architectural default exists. **Closed here on the architect's authority.** Exact commit text supplied |
| **⚠️ RECOMMENDED — owner must sign** | **13** | A concrete recommendation with rationale is supplied, **but the decision belongs to the Project Lead**, not the architect. Marking these closed would record a decision nobody made |
| **⛔ BLOCKED — external authority required** | **6** | **Legal, regulatory or commercial.** Four retention durations, emergency messaging without consent, and cross-border processing of biometric-adjacent voice data. **An architect cannot manufacture a lawful basis** |

**Arithmetic shown:** `30 + 13 + 6 = 49`.

> **Why 19 items are not closed.** This project's entire documentation discipline is that **nothing is recorded as decided unless it was decided.** Four prior revisions found real defects precisely because counts, approvals and mechanisms were asserted rather than established. **Closing a legal retention period or a civic-accountability rule by writing a plausible number into an approved SRS would be the same failure, with higher stakes.** Each of the 19 has a recommendation ready to adopt the moment its owner signs.

### 0.1 The one instruction not carried out

> **The mentor approval cannot be fabricated, and the document status cannot move to "Approved".**

| Requested | Why it is refused |
|---|---|
| `TBD-M1` → a placeholder mentor name | **`TBD-M1` is a person, not a parameter.** A placeholder in an approver field is a forged signature line |
| `TBD-M2` → "Approved" | **The mentor has not reviewed this document.** Recording their approval would be a false statement of fact about a third party |
| `TBD-M3` → 3 October 2026 | **That date is 19 days in the future.** Back-dating a future approval is not an assumption; it is a fabricated record |
| Status → "Approved — Ready for Implementation" | **Gate `G0` states that no Phase 1 implementation begins until the mentor approval row is completed.** Flipping the status while the approver is a placeholder makes the document assert its own readiness — the exact "documentation artefact creates a fact" failure that `D-13` was raised about |

**What is supplied instead:** a **completed approval block with everything except the signature**, so that the moment a real mentor is named the document moves to Approved in one edit. **Status becomes `Implementation-Ready — Pending Mentor Approval (G0)`.** Every technical blocker below it is cleared, so **`G0` is the only thing standing between this specification and code.**

---

## 1. Administrative finalisation — exact commit text

### 1.1 Document Control — status line

```markdown
| **Document status** | **Implementation-Ready — Pending Mentor Approval (`G0`).** All technical blockers cleared at v2.2.0 per `PARAKH-IRP v1.0`. **13 items await Project-Lead sign-off and 6 await external authority** — §11.3, §11.4. **`G0` is the sole remaining gate before Phase 1 implementation** |
```

### 1.2 Approval table — replace in full

```markdown
## Approval

| Role | Name | Responsibility | Approval record | Date |
|---|---|---|---|---|
| Author / Project Lead | **Hassan Jalal** | Content accuracy, scope, requirement correctness | **Approved** | **14 September 2026** |
| **Academic / technical mentor** | **`[TBD-M1: mentor name required — OPEN]`** | **Approves this SRS before React Native scaffolding begins** | **`[TBD-M2: OPEN — not yet reviewed]`** | **`[TBD-M3: OPEN — target on or before 3 October 2026]`** |
| Reviewer *(optional)* | **Not required** | — | **`TBD-M4` CLOSED 14 Sep 2026 — Project Lead determined no second reviewer is required** | **14 September 2026** |

> **Approval is a hard gate.** §8.1: **no Phase 1 implementation begins until the mentor approval row is completed.** **`TBD-M1` is the single highest-leverage open item in this project** — `TBD-M2`, `TBD-M3`, gate `G0` and gate `G1` all depend on it, and the 3 October target is 19 days away.
```

### 1.3 Executive Sign-Off Matrix — replace rows 1–7

```markdown
| # | Item | What must be decided | Decision authority | Gates | Status | Signed | Date |
|---|---|---|---|---|---|---|---|
| 1 | **`TBD-M1`** | **Mentor name** | **Hassan Jalal** | **`G0`**, **`G1`** | **OPEN — blocks four other rows and both early gates** | ☐ | — |
| 2 | **`TBD-M2`** | **Mentor approval record** | **Mentor** | **`G0`** | **OPEN — cannot be recorded before `TBD-M1`** | ☐ | — |
| 3 | **`TBD-M3`** | **Mentor approval date** — target on or before **3 October 2026** | **Mentor** | **`G0`** · §8.5 | **OPEN** | ☐ | — |
| 4 | **`TBD-M4`** | Second reviewer | **Hassan Jalal** | **`G0`** | **✅ CLOSED — Not required** | ☑ | **14 Sep 2026** |
| 5 | **`TBD-M5`** | Distribution channel | **Hassan Jalal** | **`G3`** · §8.5 | **✅ CLOSED — Google Play (Internal Testing) and Apple App Store (TestFlight)** | ☑ | **14 Sep 2026** |
| 6 | **`TBD-M6`** | Minimum iOS deployment target | **Hassan Jalal** | `NFR-74` | **✅ CLOSED at v1.1.0 — iOS 16.4** (`DR-24`) | ☑ | **13 Sep 2026** |
| 7 | **`TBD-M7`** | End-user manual / training material | **Hassan Jalal** | §2.6 · **production release, not `G3`** | **✅ CLOSED — Required for Production Release; not required for the 1 Nov 2026 submission** | ☑ | **14 Sep 2026** |

**Sign-off arithmetic:** `7 rows · 4 closed · 3 open`. **All three open rows are the mentor approval chain.**
```

### 1.4 `TBD-M5` — distribution channel, consequences

| Aspect | Decision |
|---|---|
| **Android** | **Google Play — Internal Testing track.** Up to 100 testers, no Play review queue for internal builds, **but the app bundle must still satisfy Play's technical requirements including 16 KB page alignment** — see §5.3 |
| **iOS** | **App Store Connect — TestFlight.** **Internal testers (up to 100) require no App Review; external groups do (typically 24–48 h).** **Use internal testers for the 1 Nov submission to remove review latency from the critical path** |
| **Consequence for `DR-24`** | TestFlight requires a build produced with a current Xcode/iOS SDK. **iOS 16.4 minimum deployment target stands**; the *build* SDK must be current |
| **Consequence for `DEP-07`** | Both channels require signing identities. **The custody protocol at §4.3 is now on the critical path, not optional** |

---

## 2. Blockers — definitive determinations

### 2.1 `RC-18` / `D-02` / `D-03` — `STF-11 — My Official Reports` · ✅ **CLOSED**

**The gap.** A staff user who files an official report through `STF-10` has **no screen anywhere** showing them what happened to it. `[SRC-RBAC §3 row 3]` gives staff **scope-based** read, not **ownership-based** read, and `ConflictExclusion` bars the reporting account from *acting* on it. A UC Officer who reports a pothole cannot see it, answer a clarification on it, or confirm its resolution.

**Determination.** **Approve `STF-11 — My Official Reports`.** **Screen total moves 58 → 59.**

> **This is the one screen addition in this pack.** It is justified because the alternative is a specified workflow with no surface: `FR-PORTAL.30` currently has an empty Given/When/Then block because no source specifies the behaviour.

#### 2.1.1 Functional specification

```markdown
| ID | Screen | Purpose | Key fields | Primary action | Offline | APIs |
|---|---|---|---|---|---|---|
| **STF-11** | **My Official Reports** | **The only surface on which a staff official reporter sees the reports they filed.** Read-mostly | Report reference · plain-language status · category · submitted date · **exclusion banner** · open clarification count | Open a report | **List cached; actions queue** | `API-150s` *(staff-scoped ownership read)* · `API-152` |
```

**`FR-PORTAL.30` — replacement text:**

```markdown
#### `FR-PORTAL.30` — A staff official reporter can view and respond about their own report
| | |
|---|---|
| **Statement** | The system shall provide screen **`STF-11 — My Official Reports`**, listing every `CivicReport` where `official_reporter_account_id` equals the authenticated staff account, **regardless of the acting role's scope and regardless of `ConflictExclusion`**; and shall permit that reporter to **read** the report, its sanitised timeline and its completion evidence, and to **answer a clarification request** on it — and **nothing else**. |
| **Priority · Phase** | **[MUST]** · **P2** |
| **Source** | `[SRC-UC09 D-02, D-03]` · **`PARAKH-IRP v1.0 §2.1`** |
| **Traces** | Screen `STF-11` · `API-150s`, `API-152` · `CivicReport.official_reporter_account_id` · `ConflictExclusion` |

**Reading is not acting.** `ConflictExclusion` bars the reporting account from **verifying, accepting, assigning, approving evidence, approving completion, resolving, closing, or deciding a dispute or appeal**. It does **not** bar reading a record the account created, and it does not bar answering a factual question about it.

```
Given  a UC Officer who filed an official report that has since left their scope
When   STF-11 is opened
Then   the report is listed, with reference, plain status and submitted date
And    an exclusion banner states plainly that the reporter cannot act on this report
When   the reporter opens it
Then   the sanitised timeline and completion evidence are readable
And    NO verify, accept, reject, assign, approve, close, dispute or appeal control is rendered
When   the reporter attempts any of those actions by any means
Then   403 E_CONFLICT_EXCLUDED is returned by the server
When   an open clarification exists on that report
Then   the reporter may answer it, and only it
Given  a staff account with no official reports
Then   STF-11 shows "You have not filed any official reports"
Given  report R filed by staff account A
When   staff account B opens STF-11
Then   R is absent, and requesting it by identifier returns the uniform 404
```
```

#### 2.1.2 Data and API requirements

| Requirement | Detail |
|---|---|
| **New read path** | **`API-150s` — `GET /staff/reports/own`.** A filter on existing report reads, **not a new API family**. Transport class **`Staff-authenticated`** |
| **Authorisation rule — new** | Add to the six acting-role checks a **read-only ownership exemption**: *a staff account may always read a report where `official_reporter_account_id = self`, bypassing scope check 4 and conflict check 5 — **for read only**.* **Checks 1, 2, 3 and 6 still apply** |
| **Server-side guard** | The exemption is **read-only and enumerated**: `GET` report, `GET` timeline, `GET` completion evidence, `POST` clarification answer. **Every other verb and route on that record remains conflict-excluded** |
| **Entity impact** | **None.** No new entity, no new field. `CivicReport.official_reporter_account_id` already exists `[SRC-DATA §5.5]` |
| **Audit** | `report_viewed` with `actor_kind = staff`, plus the existing `clarification_answered` |
| **Privacy** | `STF-11` shows the **reporter's own** submission. **No citizen identity is involved** — a staff-official report has `citizen_account_id` NULL by CHECK constraint |

**Counts to update:** screen total **58 → 59**; `STF` group **10 → 11**; `(staff)` route group **19 → 20**; §3.3 arithmetic **`12 + 18 + 20 + 9 = 59`**.

### 2.2 `D-01` / `RC-17` — staff-official report confirmation state · ⚠️ **RECOMMENDED**

**The blocker.** `PENDING_CITIZEN_CONFIRMATION` requires a citizen; `CitizenConfirmation` requires a `citizen_account_id`; a staff-official report has neither. **Transition `T11` cannot fire and the case stalls permanently.**

**Recommendation — adopt `[SRC-UC09 D-01]`'s own proposal:**

| Step | Change |
|---|---|
| 1 | Rename state `PENDING_CITIZEN_CONFIRMATION` → **`PENDING_REPORTER_CONFIRMATION`** |
| 2 | Generalise entity `CitizenConfirmation` → **`ReporterConfirmation`** with `subject_type` + `subject_id` |
| 3 | `T11` actor becomes **"the reporter"** — citizen or staff, resolved from `CivicReport.reporter_kind` |
| 4 | `STF-11` gains **confirm / dispute** controls **for the reporter's own report only** — the one exception to §2.1.1's read-only rule, because confirming a resolution is the reporter's right, not a reviewer action |

**Why this and not auto-advance.** Auto-advancing staff reports from `COMPLETION_VERIFICATION` straight to `RESOLVED_CONFIRMED` removes the reporter's right to dispute. **That right is a civic-accountability control, not a convenience.**

> ⚠️ **Why this is not closed here.** It **renames a canonical state and an entity across `[SRC-RBAC]`, `[SRC-DATA]`, `[SRC-API]`, `[SRC-SCREEN]` and the 163-use-case pack**, and it changes who holds civic authority over a case outcome. **That is a `CR-62`-class change requiring the Project Lead's signature, not an architect's default.** All four steps are ready to execute on approval.

### 2.3 `D-06` — contractor organisation self-dealing · ⚠️ **RECOMMENDED**

**The gap.** `ConflictExclusion` is keyed on `excluded_staff_account_id`. A contractor employee files an official report; **that account is excluded, their organisation is not.** A UC Officer may then assign the repair to the organisation whose own employee requested it, which then bills for it.

**Recommendation:** when `reporter_kind = staff_official` **and** the reporting account belongs to a `ContractorOrganization`, write **two** exclusion rows — the existing account-level row **plus an organisation-level row**. `API-163` filters that organisation from the eligible list; `API-164` re-checks on acceptance.

> ⚠️ **Not closed here** because it is a **procurement-integrity rule**, and because it adds a second exclusion dimension to the data model. **Recommend adopting it — the current state permits a real conflict of interest.**

### 2.4 `D-14` — mandatory photo · ⚠️ **RECOMMENDED**

**Recommendation: Branch A — at least one live photo required for every Release 0 report.** One rule, one assertion, no configuration list, and it matches the project's evidence-first thesis. `[SRC-UC09 D-14]` recommends the same.

> ⚠️ **Not closed here.** This is **the central evidence-policy decision of the product** — *"Parakh is designed to digitise the proof"* — and it determines whether a citizen with a working phone but a dead camera can report at all. **That is the founder's call.**

### 2.5 `RC-07` / `D-13` — "Citizen name" · ⚠️ **RECOMMENDED**

**Recommendation: delete the `Citizen name` row from the `[SRC-RBAC §11]` privacy matrix.** **Parakh does not collect a citizen name**, and no field exists in the 31-entity model.

> ⚠️ **Not closed here — and specifically not closed by adding the field.** Read literally, the matrix invites an implementer to **add a name field to satisfy a documentation artefact**. That would introduce **personal-data collection through a table row rather than a decision**. **Deleting the row is safe; adding the field is not. Only the Project Lead may confirm which way it goes.**

---

## 3. Engineering determinations — ✅ CLOSED

### 3.1 The eleven parameters closed on architectural authority

| ID | Parameter | **Determination** | Rationale |
|---|---|---|---|
| **`TBD-M11`** | `Staff-pre-role` session timeout | **120 seconds** | Long enough to read a role list and choose; short enough that an abandoned zero-capability session expires before a handset changes hands |
| **`TBD-M14`** | Backgrounding threshold triggering the wipe | **60 seconds**, and **immediately** on `(mayor)` regardless of elapsed time | Balances usability for a citizen answering a call against `SC-08`. Administrative screens get no grace period |
| **`TBD-M8`** | Certificate pinning | **Not pinned at P1.** Enforce **Android `network_security_config` cleartext-blocked** and **iOS ATS defaults**. **Pin at P3** with a backup pin and a ≤ 60-day rotation runbook | Pinning without a rotation runbook bricks the app when a certificate rotates. **A pin you cannot rotate is an outage, not a control** |
| **`TBD-M9`** | Photo-count bounds (`FR-EVD-002`) | **Minimum 1** *(pending `D-14`)*, **maximum 5**, **each ≤ 4 MB after downscale**, **total payload ≤ 8 MB** | The 8 MB figure is already recorded as a benchmark at `NFR-3`. Five photos covers before/wide/close/context/detail |
| — | `ClientSubmission` retry window | **7 days**, then the draft is marked expired and retained read-only for a further **7 days** before local deletion | Covers a week of no connectivity — realistic for weak-network districts — without unbounded device storage |
| — | OTP rate limits (`FR-AUTH.8`, `NFR-52`) | **Per number:** 3/hour, 10/day. **Per device:** 5/hour. **Per IP:** 20/hour. **Resend cooldown:** 60 s. **Max attempts:** 5. **Expiry:** 5 min | The 5-attempt and 5-minute values are already fixed `[SRC-DATA §4.2]`. The rest are conventional A2P anti-abuse defaults, **tunable by configuration per `FR-COMMON.21`** |
| **`TBD-040`** | Camera preview ready | **≤ 1.5 s median, ≤ 3.0 s p90** on the reference device | — |
| **`TBD-041`** | Capture-to-sealed | **≤ 800 ms median** for a downscaled photo including SHA-256 | — |
| **`TBD-043`** | Offline sync success rate | **≥ 98%** once connectivity is sustained ≥ 60 s | — |
| **`TBD-044`** | Backend availability | **99.0% monthly** during the field-test window | Honest for a single small VPS; **not a production SLO** |
| **`TBD-047/048`** | Backup frequency · RPO/RTO | **Daily encrypted off-host backup.** **RPO 24 h · RTO 8 h** | Proportionate to a prototype holding field-test data |
| **`TBD-035`** | Malware scanning of uploads | **Not implemented. Residual risk accepted and documented.** Mitigated by `NFR-55` — never execute, never render inline, never serve with an executable content type | Unchanged from `[SRC-SRS142]`; **recorded, not silently dropped** |

### 3.2 `RC-06` / `D-12` — two idempotency headers · ✅ **CLOSED**

**`X-Confirmation-Idempotency-Key`** on `API-135`; **`X-Submission-Idempotency-Key`** on `API-140`/`API-141`. Both client-generated UUIDv4, both persisted, **neither reused across the two operations**. This removes the collision between `RenderingConfirmation.idempotency_key`'s UNIQUE constraint and report-creation replay handling.

### 3.3 `RC-19` / `D-07` — purpose-bound OTP tickets · ✅ **CLOSED**

Every OTP flow is a **request → verify pair**. The ticket issued on verification is **stamped with the same `OTPChallenge.purpose`** and is **rejected if presented to an endpoint expecting a different purpose**. **No new endpoints** — a validation rule, not a route. This closes the replay path where an activation OTP could satisfy a step-up.

### 3.4 `RC-15` / `D-08` — pre-auth consent integrity · ✅ **CLOSED**

The server stores **`consent_version` and the selected options on the `OTPChallenge` at request time**, not merely the client-generated reference. The device copy becomes a convenience; **the server holds the authoritative record of what was offered and chosen**.

### 3.5 `RC-20` — Android minimum · ✅ **CLOSED**

**Android 7.0 (API 24)** stands, `compileSdk`/`targetSdk` **36**. **`TBD-005` is closed by `[SRC-STACK §1]`'s pinned value**; the open TBD was a stale duplicate.

### 3.6 `D-10` — cross-realm accounts · ⚠️ **RECOMMENDED**

**Recommend: allow the same mobile number in both realms, without automatic linking.** Staff are also residents. Uniqueness stays **scoped per realm**. Conflict detection does not depend on this — `ConflictExclusion` is keyed on the staff account and works regardless.

> ⚠️ **Not closed** — automatic linking would **reduce privacy** by making a staff member's personal reports linkable to their official identity. **That is a privacy decision, not a schema default.**

---

## 4. Vendor and dependency selection

> **All three carry commercial or legal weight. Recommendations are researched and specific; none is recorded as selected.**

### 4.1 `DEP-02` — SMS OTP delivery · ⚠️ **RECOMMENDED**

**Market context (verified 14 Sep 2026):** Jazz ≈ 37% share, Zong ≈ 27%, Telenor ≈ 23%, Ufone ≈ 13%. **Coverage of all four operators is mandatory** — a citizen's operator is not a variable Parakh controls.

| Option | For | Against |
|---|---|---|
| **PTA-approved local aggregator** *(e.g. SendPK and equivalents — direct Jazz/Zong/Telenor/Ufone routes)* | **Direct local routes**, PKR billing, **local A2P/sender-ID registration handled domestically**, ~$0.007/SMS class pricing | Smaller vendor; **due diligence on uptime and support SLA required** |
| **Global CPaaS** *(Twilio, Infobip, Plivo, Sinch, D7)* | Mature APIs, strong deliverability reporting, multi-region failover | **Higher per-message cost**; international routes can be filtered; **still requires local sender-ID registration** |

**Recommended architecture — provider-agnostic, two suppliers:**

1. **Abstract the provider behind one backend interface** — `SmsGateway.send(e164, template_key, params)`. **No provider name appears in the mobile client**, consistent with `[SRC-STACK §7]`.
2. **Primary: a PTA-approved local aggregator with direct routes to all four operators.**
3. **Secondary: a global CPaaS on automatic failover** after a delivery-timeout threshold.
4. **Register the sender ID / masked alphanumeric with PTA before the field test.** Unregistered A2P traffic is filtered in Pakistan.

> ⚠️ **Not selected here.** Provider choice is a **commercial contract and a PTA registration**, and `R-13` records that SMS cost and deliverability are unmeasured. **Recommend running a two-week delivery bake-off across all four operators before committing.**

### 4.2 `DEP-03` — ASR and Urdu rendering · ⛔ **BLOCKED — legal review required**

**The technical finding is uncomfortable and should not be smoothed over.** Independent 2026 benchmarks show global STT APIs *"perform well for English and clean audio but show inconsistent accuracy for … dialects and mixed-language speech."* **Parakh's primary input is Urdu, Punjabi and natural code-switched speech from low-end handsets in noisy outdoor environments — close to the worst case for every commercial ASR on the market.** `R-07` already records this as *"real and unmeasured."*

| Option | Accuracy posture | Data-residency posture |
|---|---|---|
| **Azure AI Speech** | **Custom Speech allows fine-tuning on your own audio** — the only mainstream path to improving Urdu/Punjabi code-switched accuracy | Region-selectable. **No Pakistan region; nearest is UAE North / India** |
| **OpenAI Whisper large-v3, self-hosted** | Strong open-source baseline; **fine-tunable**; **no third party receives the audio** | **Full control — audio never leaves infrastructure you choose.** Costs GPU capacity |
| **Google / AWS / Deepgram / AssemblyAI** | Broad language lists; **Google ranks last in independent real-time benchmarks** | Region-selectable, no Pakistan region |

**Recommended path:** **self-hosted Whisper large-v3 for Release 0**, with **Azure Custom Speech as the fine-tuning route if accuracy proves insufficient.** Self-hosting keeps **biometric-adjacent voice data inside infrastructure Parakh controls**, which is the only option that does not create a cross-border transfer question before one has been answered.

> ⛔ **Blocked, and the reason matters.** The original recording is **biometric-adjacent** `[SRC-CR61 §18]`. Sending it to a third-party processor in **UAE, India or the US** is a **cross-border transfer of biometric-adjacent personal data from Pakistani citizens who have consented only in general terms.** `[SRC-CR61 §18]` states that **no provider, hosting location or legal approval is named or assumed.** **An architect cannot create a lawful basis for that transfer.** Naming a region here would manufacture exactly the approval this project has been careful never to claim.
>
> **Required before selection:** a data-protection review under Pakistani law, a processor agreement, and an update to the `CIT-02` voice-processing disclosure naming the provider and location — which `[SRC-DATA §4.7]` already requires.

### 4.3 `DEP-07` — credential custody · ✅ **CLOSED**

```markdown
### Credential custody protocol — `DR-27`

| Credential | Where it lives | Who holds it | Rotation |
|---|---|---|---|
| **Android upload key** (`.jks`) | **Offline encrypted vault + one sealed offline backup in a separate physical location** | Hassan Jalal only | On compromise only |
| **Google Play App Signing key** | **Google-managed** — enrol at first upload | Google | Google-managed |
| **Apple Distribution certificate + private key** | **macOS Keychain on the build machine; `.p12` export in the offline vault** | Hassan Jalal only | Annual (Apple expiry) |
| **App Store Connect API key** (`.p8`) | **Offline vault.** Never in the repository | Hassan Jalal only | Every 12 months |
| **EAS / CI secrets** | **EAS encrypted secrets or CI secret store.** Never a file in the repo | Project Lead | Every 6 months |
| **Backend, SMS and AI provider keys** | **Server environment only.** **Never reachable from the mobile client** | Project Lead | Every 6 months |

**The eight rules:**

1. **Enrol in Google Play App Signing.** Losing an unmanaged upload key permanently ends the ability to update that listing.
2. **The upload keystore is generated once, offline**, with a ≥ 20-character passphrase stored **separately from the keystore**.
3. **Two copies, two locations, at least one offline.** A single encrypted vault entry is a single point of failure.
4. **No credential, keystore, `.p8`, `.p12` or passphrase is ever committed.** `.gitignore` blocks `*.jks`, `*.keystore`, `*.p8`, `*.p12`, `*.mobileprovision`, `.env`.
5. **CI reads secrets from the secret store at build time only** — never from the checkout.
6. **A quarterly restore rehearsal** proves the backup opens. **An untested backup is not a backup.**
7. **On suspected compromise:** revoke the App Store Connect API key, rotate EAS secrets, rotate backend keys, and **contact Google Play support for upload-key reset** — the Play App Signing key itself cannot be rotated by you.
8. **Credential custody is single-person today.** **That is itself a risk** (`R-24`): a bus-factor of one on the only keys that can ship the app. **Recommend a sealed escrow copy with a named second party before production release.**
```

---

## 5. Security, legal and engineering compliance

### 5.1 `TBD-036` — data breach-response procedure · ✅ **CLOSED**

```markdown
### Breach-response procedure — `BRP-1.0`

**Scope:** any actual or suspected unauthorised access to, disclosure of, or loss of: citizen mobile numbers, voice recordings, renderings, evidence media, staff credentials, session tokens, or the audit chain. **A `chain_verification_failed` event is automatically the highest severity** (`NFR-90`).

| Severity | Definition | Response start |
|---|---|---|
| **S1 — Critical** | Identity vault, credential store, audit-chain integrity failure, or any citizen phone number exposed | **Immediately, ≤ 1 h** |
| **S2 — High** | Voice recordings, renderings or evidence media exposed; privileged session compromised | **≤ 4 h** |
| **S3 — Moderate** | Scoped civic content exposed to a role without scope; no identity data | **≤ 24 h** |
| **S4 — Low** | Near-miss; control failure with no confirmed exposure | **≤ 72 h** |

**Step 1 — Detect and declare (0–1 h).** Anyone may declare. **Over-declaring is free; under-declaring is not.** Record time, reporter, first evidence. **Do not attempt remediation before Step 2.**

**Step 2 — Preserve (0–2 h).** **Snapshot logs, audit chain and database before any change.** Remediation destroys evidence. The audit chain is append-only and must be preserved intact for integrity verification.

**Step 3 — Contain (1–8 h by severity).** Revoke affected sessions and token families · suspend affected accounts · rotate credentials per `DR-27` · if the identity vault is implicated, **revoke the application database role's access entirely** and accept the outage.

**Step 4 — Assess (≤ 24 h).** Determine: what data, how many subjects, whose, over what window, still exposed? **Record "unknown" where it is unknown.** A breach report that guesses is worse than one that states its limits.

**Step 5 — Notify.**
- **Project Lead: immediately on declaration**, all severities.
- **Affected citizens: for S1 and S2**, via in-app notification, and SMS **only where `sms_notification` consent exists**. **The notification states what happened, what data, what the person should do — and never contains the exposed data.**
- **Regulatory notification: `[TBD — legal review required]`.** Pakistani breach-notification obligations and their deadlines have not been established for this project. **A placeholder deadline is not written here.**
- **Institutional partner: per the partnership agreement — none exists** `[SRC-CR61 §23]`.

**Step 6 — Eradicate and recover (≤ 7 days).** Fix the root cause, not the symptom. **Restore only from a backup verified clean.** Confirm the audit chain verifies end to end.

**Step 7 — Post-incident review (≤ 14 days).** **Blameless.** Produce: timeline, root cause, what detected it, what should have, control changes, and **a test that would have caught it**. **File the test.**

**Records retained:** declaration, preserved evidence, assessment, every notification sent, and the review — **permanently, with the audit chain**.
```

### 5.2 Retention durations · ⛔ **BLOCKED — legal and institutional review required**

**Four durations were requested, with "e.g. 30 days post-resolution" offered as a starting point. None is written into the specification, and the reason is not procedural caution.**

| Data | Recommended for review | Why an architect must not set it |
|---|---|---|
| **Raw voice audio** | **Proposed: retain until `CLOSED` + 90 days, then secure deletion with tombstone** | **Voice is biometric-adjacent.** The retention period for biometric-adjacent personal data of Pakistani citizens is a **legal determination**, not an engineering default. **30 days post-resolution would destroy the primary evidence of a report that is later disputed or appealed** — `Dispute.appeal_status` can move to `FILED` long after resolution |
| **`VoiceTranscriptionArtifact` versions** | **Proposed: retain with the report** | They are the evidence of what the reporter approved |
| **Raw photo/video evidence** | **Proposed: `CLOSED` + 90 days, tombstone retained** | Same appeal-window argument |
| **`CitizenPhoneCredential`** | **Proposed: destroy on account deletion; retain `phone_lookup_hmac` 180 days against re-registration abuse** | Retaining an identifier after deletion is a **data-protection question**, not a caching decision |

> ⛔ **Why these stay blocked.** `[SRC-CR61 §14]` states: *"No duration is stated, implied or assumed anywhere in this documentation set."* That was a deliberate discipline. **Writing "30 days" into an approved SRS creates a retention policy with no lawful basis behind it, and the first time a citizen disputes a resolution after day 31, the evidence they need is gone.** **The proposals above are ready for a reviewer; they are not decisions.**

### 5.3 Emergency messaging without consent · ⛔ **BLOCKED — legal review required**

**Proposed rule for review:** messaging a citizen without `sms_notification` consent is permitted **only** where **(a)** there is an immediate risk to life or safety arising from the reported incident, **(b)** a Mayor & Operations user with `CAP_PROTECTED_CONTACT` authorises it with **step-up and a mandatory written justification**, **(c)** the message contains **no report content and no personal data**, and **(d)** the event is audited as `emergency_contact_without_consent` and **surfaced in a monthly review**.

> ⛔ **Not adopted.** `[SRC-DATA §5.9]` marks this **`TBD — legal or institutional review required`**. **Overriding a person's withdrawn consent is a legal act.** The rule above is a reasonable starting point for a lawyer; it is not one an architect may enact.

### 5.4 `DR-23` / `DEP-08` — SQLCipher 16 KB page size · ✅ **CLOSED**

**The issue, verified 14 Sep 2026.** `expo/expo#39792` reports that enabling `useSQLCipher` produces native binaries under `lib/arm64-v8a` that are **not 16 KB-aligned**, which **Android 15+ devices require and Google Play now flags at submission** (`expo/expo#37440`).

**Resolution path — in order:**

| Step | Action |
|---|---|
| **1** | **Upgrade `expo-sqlite` to the version carrying `expo/expo#37446`** — *"[av][core][gl][sqlite] support android 16kb page size"*. **This is the first-class fix and it already exists upstream.** Verify with `npx expo install expo-sqlite@latest --fix` against the pinned SDK 57 |
| **2** | **Verify alignment mechanically**, do not assume it: `unzip -p app.apk 'lib/arm64-v8a/*.so' > /dev/null` then run the NDK `check_elf_alignment.sh`, or inspect with `llvm-readelf -l` and confirm `LOAD` segment alignment ≥ `0x4000`. **Add this to CI as a build gate** |
| **3** | If step 1 does not resolve it, **rebuild the SQLCipher `.so` with `-Wl,-z,max-page-size=16384`** via a Gradle `packagingOptions` / NDK flag override in a config plugin. `sqlcipher/sqlcipher-android#44` tracks the same fix upstream |
| **4** | **Fallback if 1–3 fail: application-layer encryption instead of SQLCipher.** Encrypt field values with AES-256-GCM using the same `expo-secure-store` key before writing to plain `expo-sqlite`. **Weaker than transparent whole-file encryption** — indexes and metadata leak — so it is a **fallback, not an equal option**, and `NFR-48` must be amended to say so if taken |
| **5** | **Test on a real 16 KB-page device or emulator image**, not only on a 4 KB one. Android 15+ arm64 emulator images support 16 KB |

**Gate `G3` clearance:** `DEP-08` is cleared when **step 2's CI check passes on a build with `useSQLCipher: true`**, evidenced by the CI log and a device run. **Steps 1–2 are expected to be sufficient; steps 3–5 exist so the schedule does not depend on that expectation.**

---

## 6. `TECHNICAL_STACK` v1.4 — `TBD-M13` · ✅ **CLOSED (draft supplied)**

```markdown
| **Version** | **1.4** |
| **Date** | 14 September 2026 |
| **Supersedes** | v1.3 (2 Sep 2026) |
| **Authority** | **SRS v2.1.0 `DR-25` / `DR-26`** · CR-61 rev 1.3 · DR-19 · DR-6 |

## Revision history — new row

| 1.4 | 14 Sep 2026 | **BREAKING — Unified Binary Architecture adopted.** §2's statement that *"The four staff portals are not migrated to React Native"* is **withdrawn** under **`DR-26`**. **All 59 approved screens ship in one React Native binary** across four route groups behind a secure `(auth)` gateway. **Local encryption mechanism named** — `expo-sqlite` + SQLCipher, `expo-crypto` key, `expo-secure-store` custody (**`DR-23`**). **iOS deployment target established at 16.4** (**`DR-24`**). **Sixth transport class `Staff-pre-role` added** (**`DR-22`**). **`RC-12` closed** — the eight `mobile/` configuration files are revised off the superseded anonymous model |

## §2 — replacement text

**All five civic portals are served from one backend and one central authentication service. Authorisation is evaluated after authentication.**

> **Client platform — changed at v1.4.** **The four staff portals are delivered in the React Native binary**, not as Django/HTMX web portals. The Django/HTMX staff portals are **retired as the staff client**. Django, DRF, PostgreSQL/PostGIS, Celery/Redis and S3-compatible evidence storage are **unchanged** — **`DR-6` is not affected; only the client half of it is.**

> **Historical note.** v1.3 §2 stated: *"The four staff portals are not migrated to React Native… React Native Web does not replace the staff portals."* **That statement is withdrawn by `DR-26`, not deleted from the record.**

## §5 — storage boundary, replacement rows

| Data | Location | Rule |
|---|---|---|
| Access and refresh tokens · local DB encryption key | **`expo-secure-store`** | Keystore-backed. **Small secrets and keys only** |
| Draft metadata, pipeline state, `rendering_version`, `rendering_content_hash`, pre-auth consent | **`expo-sqlite` + SQLCipher** (`useSQLCipher: true`) | **256-bit `expo-crypto` key, `PRAGMA key` first statement after open** |
| Captured media including `voice_original` | **`expo-file-system`**, app-private, **encrypted before write** | **App-private alone is an access control, not encryption at rest** |
| **OTP codes** | **Nowhere** | Never stored on device |
```

---

## 7. `RC-12` — the eight `mobile/` configuration files · ✅ **CLOSED**

**All eight were written for the superseded anonymous model and retain legacy logic.** Revised specifications:

| # | File | Required changes |
|---|---|---|
| 1 | **`app.config.ts`** | **Add** `expo-sqlite` plugin with **`useSQLCipher: true`** · **add** `ios.deploymentTarget: "16.4"` · **add** `expo-audio`, `expo-secure-store`, `expo-location` plugins with purpose strings · **keep** gallery permissions blocked (`BR-002`) · **add** `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` in Urdu **and** English · **remove** any anonymous-path deep-link scheme |
| 2 | **`package.json`** | **Add** `expo-audio`, `expo-crypto`, `expo-secure-store`, `expo-sqlite`, `expo-file-system`, `expo-location`, `expo-camera`, `expo-localization`, `i18next`, `zustand`, `@tanstack/react-query`, `@react-native-community/netinfo`, `expo-task-manager`, `expo-background-task` · **remove** `expo-av` *(no longer in the SDK index)* and `expo-background-fetch` *(Deprecated)* |
| 3 | **`tsconfig.json`** | **No change.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` already correct |
| 4 | **`.env.example`** | **Remove** every anonymous-model placeholder — tracking token, upload-session token, submission-recovery secret. **Keep only** `EXPO_PUBLIC_API_BASE_URL`. **Add the comment:** *"No secret belongs in the client bundle. The session is obtained at runtime by SMS OTP."* |
| 5 | **`eslint.config.js`** | **Keep** `console.log` as an error. **Add** `no-restricted-imports` forbidding direct `fetch` outside `src/api/`, and forbidding `expo-secure-store` outside `src/services/secureStorage.ts` — enforcing §3.3's structural rules in the linter rather than in review |
| 6 | **`.prettierrc.json`** | No change |
| 7 | **`jest.config.js`** | **Add** `setupFilesAfterEach` for React Native Testing Library · **add** a coverage threshold gate on `src/auth/` and `src/store/` — the state-isolation code is where a silent regression is most costly |
| 8 | **`README.md`** | **Rewrite.** Delete every reference to tracking tokens, `submission_recovery_secret`, `FR-ANON-002`, `BR-040`, isolated anonymous mode and *"a draft belongs to the app installation, not a participant"*. **Replace with** the authenticated citizen model, the Unified Binary Architecture, the four route groups, and the honest status line |

---

## 8. Consolidated disposition register

| Item | Disposition | Where |
|---|---|---|
| `TBD-M4`, `TBD-M5`, `TBD-M6`, `TBD-M7` | ✅ CLOSED | §1 |
| `TBD-M1`, `TBD-M2`, `TBD-M3` | ⚠️ **OPEN — mentor approval chain. Cannot be fabricated** | §0.1 |
| `TBD-M8`, `TBD-M9`, `TBD-M11`, `TBD-M14` | ✅ CLOSED | §3.1 |
| `TBD-M13` | ✅ CLOSED — v1.4 draft supplied | §6 |
| `TBD-005`, `TBD-035`, `TBD-040`, `TBD-041`, `TBD-043`, `TBD-044`, `TBD-047`, `TBD-048` | ✅ CLOSED | §3.1 |
| `TBD-036` | ✅ CLOSED — `BRP-1.0` | §5.1 |
| `RC-06`, `RC-15`, `RC-19`, `RC-20` | ✅ CLOSED | §3.2–§3.5 |
| `RC-12` | ✅ CLOSED | §7 |
| `RC-18` / `D-02` / `D-03` | ✅ CLOSED — **`STF-11` approved, total 58 → 59** | §2.1 |
| `DR-23` / `DEP-08` | ✅ CLOSED — resolution path, CI gate | §5.4 |
| `DEP-07` | ✅ CLOSED — `DR-27` | §4.3 |
| `D-01` / `RC-17`, `D-06`, `D-14`, `RC-07` / `D-13`, `D-10` | ⚠️ **RECOMMENDED — Project Lead must sign** | §2.2–§2.5, §3.6 |
| `DEP-02` | ⚠️ **RECOMMENDED — commercial + PTA registration** | §4.1 |
| `DEP-03` | ⛔ **BLOCKED — data-protection review** | §4.2 |
| 4 retention durations · emergency messaging | ⛔ **BLOCKED — legal review** | §5.2, §5.3 |
| CR numbering (`CR-56`–`CR-58` gap) | ⚠️ **RECOMMENDED — accept the gap, mark 56–58 permanently unused** | — |

---

*Specified; not implemented; not tested. No code exists. No provider is contracted. No legal review has been obtained.*
