# Parakh — Change Manifest: CR-61 revision 1.3

**2 September 2026 · Documentation-finalisation phase · Hassan Jalal, Founder & Project Lead**

| Field | Value |
|---|---|
| **Manifest version** | **1.0** |
| **Covers** | The identity, authentication, RBAC, data-model, reporting-foundation, screen-structure, API and stack corrections locked by **CR-61 rev 1.3** |
| **Supersedes** | `docs/CHANGE_MANIFEST_v1.4.2.md` *(retained unchanged as the manifest of the superseded anonymous baseline)* |
| **Status** | **Specified; not implemented; not tested.** |

> **Every file listed as created or modified below exists in this package with the byte count and hash shown.** **Nothing is claimed as created, scaffolded, built, tested or validated unless the exact file is returned.**

> **Detailed citizen, Street Representative, UC Officer, Contractor and Mayor/Ops use cases are intentionally deferred until the identity, authentication, RBAC, data model, screen inventory, API foundation and SRS baseline are approved.**

---

## 1. Files modified — returned in this package

| File | From | **To** | Bytes | sha256 (16) |
|---|---|---|--:|---|
| `docs/change-records/CR_MOBILE_OTP_AND_FIVE_PORTAL_IDENTITY_MODEL.md` | rev 1.2 | **rev 1.3** | 39,419 | `0ff7bbb7051b5fea` |
| `docs/security/RBAC_AND_SCOPE_MATRIX.md` | 1.2 | **1.3** | 33,544 | `9786ac1379d7a139` |
| `docs/architecture/DATA_MODEL_AND_IDENTITY_SCHEMA.md` | 1.2 | **1.3** | 39,552 | `05f718477a36db86` |
| `docs/design/SCREEN_INVENTORY_AND_NAVIGATION.md` | 1.2 | **1.3** | 39,701 | `0a6d2d10d9b3bbd2` |
| `docs/api/API_CONTRACT.md` | 2.0 | **3.0** | 30,001 | `9dacf256f554b5a3` |
| `docs/architecture/TECHNICAL_STACK.md` | 1.2 | **1.3** | 14,276 | `238f412be2ea1890` |
| `README.md` | — | **rewritten** | *see §7* | *see §7* |
| `docs/DEVELOPMENT_JOURNAL.md` | — | **entry appended** | *see §7* | *see §7* |

## 2. Files created — returned in this package

| File | Purpose |
|---|---|
| `docs/testing/TEST_CATALOGUE_IDENTITY_FOUNDATION.md` | Consolidated test specification for the locked decisions. **Every entry: `Specified; not implemented; not executed`** |
| `docs/CHANGE_MANIFEST_CR61_r1.3.md` | This file |
| `Parakh_CR61_r1.3_Consistency_Audit.md` | Mechanical audit of the returned files |

## 3. Files deliberately left byte-identical

| File | Why |
|---|---|
| `Parakh_Prototype_SRS_v1.4.2.md` | **Superseded historical baseline.** The approved strategy is to author **SRS v2.0.0 as a new baseline**, not to rewrite v1.4.2. Editing it would falsify a historical record |
| `Parakh_Release_0_Build_Specification_v1.3.1.md` | It is an **extraction of the SRS P0 set**. Regenerating it before SRS v2.0.0 exists would produce a P0 set with no authoritative parent |
| `docs/use-cases/AUTHENTICATION_AND_INCIDENT_REPORTING_USE_CASES.md` | **Explicitly out of scope.** Use cases are deferred to a later phase |
| `docs/change-records/CR-59_ANONYMOUS_CITIZEN_REPORTING.md` | Superseded change record. **Preserved, not rewritten** |
| `docs/change-records/CR-60_REACT_NATIVE_MIGRATION.md` | **Retained and reaffirmed.** Also now the sole home of the historical Flutter→React Native module mapping |
| `Parakh_v1.4.2_Consistency_Audit.md` · `docs/CHANGE_MANIFEST_v1.4.1.md` · `docs/CHANGE_MANIFEST_v1.4.2.md` | Historical audit and manifest records |
| All earlier SRS, Build Spec and Master Document versions | Historical. **Never edited** |

## 4. Files that require an update but are outside this package

**These are named honestly. None is claimed as updated.**

| File | Current | Why it is stale | Blocked on |
|---|---|---|---|
| **SRS v2.0.0** | **Does not exist** | The governing specification for the five-portal model has not been written | Authoring effort. **CR-61 rev 1.3 is binding until it exists** |
| **Build Specification v2.0.0** | Does not exist | It is an extraction of the SRS P0 set | **SRS v2.0.0** |
| `DATABASE_ARCHITECTURE.md` | v2.7 | Still describes `AnonymousAccessGrant`, the anonymous grant model and a 38-entity P0A freeze | A v3.0 revision against Data Model v1.3 (**31 entities**) |
| `docs/security/AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` | v1.2 | Describes the four-actor anonymous model in full | Replacement by the RBAC matrix and CR-61, or an explicit superseded banner |
| `mobile/` *(8 configuration files)* | — | Written for the anonymous model. **They contain no application source, so no behavioural contradiction exists**, but the README wording and environment placeholders need revision | Mobile implementation start |

## 5. Substantive changes in this revision

### 5.1 Staff official reporting — the contradiction resolved

`CAP_REPORT_OFFICIAL` allowed any authorised staff user to report, but rendering confirmation was citizen-only and the single reporting screen sat under Street Representative. **UC Officers, Contractors and Mayor & Operations held a capability they could not exercise.**

| Change | Effect |
|---|---|
| `REP-05` **retired**, shared **`STF-10 — Report an Issue Officially`** added | `REP` 5 → 4, `STF` 9 → 10, **total unchanged at 58** |
| `CAP_VOICE_CONFIRM` → **`CAP_RENDERING_CONFIRM_OWN`** | Citizen confirms own citizen draft; authorised staff reporter confirms own official draft; **nobody confirms for anybody else** |
| `ClientSubmission.reporter_subject_type` added | The pipeline is never ambiguous about who must confirm |
| `ConflictExclusion` created in the creation transaction | Account-level, across every current and future role |

### 5.2 Draft pipeline versus official record

| Change | Effect |
|---|---|
| **`DRAFT` removed from `CivicReport.state`** | **15 enum values, 12 canonical states** |
| Atomic creation rule specified | `ClientSubmission.READY_TO_SUBMIT` → **`CivicReport(state = SUBMITTED)`** in one transaction |
| `report_reference` issued in the same transaction | **A queued draft has no report and no reference** |
| `AWAITING_CITIZEN_REVIEW` → **`AWAITING_REPORTER_REVIEW`** | The pipeline serves both citizen and staff reporters |

### 5.3 AI-processing failure

The rev 1.2 contradiction — "no submission without confirmation" **and** "submit as `TRANSCRIPTION_REVIEW_REQUIRED`" — is resolved. **The submission bypass is withdrawn.** `REVIEW_REQUIRED` survives only as a `VoiceTranscriptionArtifact.processing_status` and a draft-review status. **Audio-only official submission is not part of Release 0.**

### 5.4 Contractor privacy

Contractor access to the **original citizen voice recording** and the **intermediate ASR output** is removed from the RBAC capability table, permission matrix, privacy-filtering matrix, `CON-02`, API response shapes and the test catalogue. **Enforced server-side, not by template omission.**

### 5.5 Exact rendering-version confirmation

New entity **`RenderingConfirmation`** (entities **30 → 31**) binding `voice_transcription_artifact_id`, `client_submission_id`, `rendering_version`, `rendering_content_hash`, reporter subject type, reporter account ID, timestamp and idempotency key. **Six server-side checks.** A stale confirmation returns `409 E_RENDERING_SUPERSEDED` or `409 E_RENDERING_HASH_MISMATCH`.

### 5.6 Retention wording

"Permanently retained" is withdrawn. **Original audio is immutable while retained** · linked to the confirmed rendering **throughout the approved retention period** · **deleted according to the approved retention policy** · a hash, tombstone and audit event may remain · **a hash or tombstone is never described as recoverable audio**. Duration remains `TBD — legal or institutional review required`.

### 5.7 Staff identifier

`StaffAccount.official_identifier` → **`staff_reference`**: optional, administrative or employee reference only, **never a login identifier**. **The login identifier is the official mobile number**, held only in the protected `StaffCredential`.

### 5.8 Language precision

**"Roman Urdu" is removed as a spoken language.** The approved wording is used instead: *"The intermediate ASR text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output."* Spoken input is **Urdu, Punjabi, English and natural code-switched speech**.

### 5.9 Flutter removal from active documents

The Flutter→React Native module-mapping column is removed from `TECHNICAL_STACK.md`. **The historical mapping lives only in `CR-60`, clearly labelled superseded.** As CR-60 and the Development Journal both record: **there was never a Flutter implementation in this repository.**

## 6. Counts — recomputed, never inherited

| Measure | Rev 1.2 | **Rev 1.3** | Arithmetic |
|---|--:|--:|---|
| **Screens** | 58 | **58** | `23 + 10 + 4 + 8 + 4 + 9 = 58` |
| — Citizen | 23 | 23 | `CIT-01 … CIT-23` |
| — Shared staff | 9 | **10** | `STF-01 … STF-10` |
| — Street Representative | 5 | **4** | `REP-01 … REP-04` |
| — UC Officer | 8 | 8 | `UCO-01 … UCO-08` |
| — Contractor | 4 | 4 | `CON-01 … CON-04` |
| — Mayor & Operations | 9 | 9 | `MAY-01 … MAY-09` |
| **Active entities** | 30 | **31** | `6 + 3 + 6 + 15 + 1 = 31` |
| **`CivicReport.state` values** | 16 | **15** | `DRAFT` removed |
| — canonical lifecycle states | 13 | **12** | `SUBMITTED … CLOSED` |
| — exception states | 3 | 3 | `REOPENED`, `REJECTED`, `CANCELLED` |
| **Permission-matrix rows** | 33 | **34** | ASR-output access split from rendering access |
| **Pipeline states** | 7 | 7 | `AWAITING_CITIZEN_REVIEW` renamed, not added |
| **Test assertions in the new catalogue** | — | **111** | Counted from the assertion rows of `TEST_CATALOGUE_IDENTITY_FOUNDATION.md`, not estimated |

**Screen total logic.** `REP-05` was **retired** and one shared `STF-10` **added**. Four duplicate reporting screens — one per staff role — would have produced 61 screens for one function and is explicitly rejected.

## 7. Verification of the two remaining modified files

| File | Bytes | sha256 (16) |
|---|--:|---|
| `README.md` | *recorded in the consistency audit after the final write* | *ibid.* |
| `docs/DEVELOPMENT_JOURNAL.md` | *recorded in the consistency audit after the final write* | *ibid.* |

**Both are listed in the consistency audit with the hash of the saved bytes.** Neither is claimed here as complete before that audit ran.

## 8. What is not claimed

**Not claimed anywhere:** implementation · schema · migration · build · executed test · device run · deployment · government adoption · partnership · pilot · real users · security review or certification · SMS-provider integration · AI-provider selection · measured ASR accuracy · legal approval · data-retention approval.

**Status vocabulary in use:** *Specified* · *Designed* · *Deferred* · *Superseded* · *Not written*. **Everything in this package is at most *Specified*.**

## 9. Deferred to the portal use-case phase

**Detailed citizen, Street Representative, UC Officer, Contractor and Mayor/Ops use cases are intentionally deferred until the identity, authentication, RBAC, data model, screen inventory, API foundation and SRS baseline are approved.**

The future phase will separately define: what each actor clicks · detailed reporting steps · queues and task handling · alternate paths · error recovery · notifications · verification procedure · contractor assignment procedure · completion procedure · citizen confirmation and dispute procedure · portal tutorials.

**Nineteen `DEFERRED — define during the portal use-case phase` markers** are placed across the returned documents where a behavioural decision was genuinely required but belongs to that phase. **No interaction was invented to fill one.**

## 10. Open decisions carried forward

| Decision | Marker |
|---|---|
| Whether every report requires a live photo | `TBD — Hassan decision required` |
| No-citizen-response closure policy | `TBD — Hassan decision required` |
| Repeated-reopening limit | `TBD — Hassan decision required` |
| One mobile number in both citizen and staff realms | `TBD — Hassan decision required` |
| AI provider | `TBD — Hassan decision required` |
| AI-processing location | `TBD — Hassan decision required` |
| SMS/OTP provider · OTP cost and delivery policy | `TBD — Hassan decision required` |
| `ClientSubmission` retry-window duration | `TBD — Hassan decision required` |
| Numeric rate-limit thresholds | `TBD — Hassan decision required` |
| Android signing-credential custody | `TBD — Hassan decision required` |
| Phone-number recycling / dormancy re-verification | `TBD — Hassan decision required` |
| **Raw-audio retention duration** | **`TBD — legal or institutional review required`** |
| Evidence, artefact and credential retention durations | `TBD — legal or institutional review required` |
| Emergency contact without consent | `TBD — legal or institutional review required` |
| Lawful basis for processing · data-governance authority | `TBD — legal or institutional review required` |

**None of these blocked any unrelated correction in this package.**

---

*Specified; not implemented; not tested.*
