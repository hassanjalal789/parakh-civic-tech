# Parakh — Use-Case Pack README

| Field | Value |
|---|---|
| **Pack version** | **1.0** |
| **Date** | 2 September 2026 |
| **Status** | **Specified; not implemented; not tested.** |
| **Owner** | Hassan Jalal — Founder & Project Lead |
| **Authority** | **CR-61 rev 1.3** *(binding until SRS v2.0.0 exists)* |

---

## 1. What this pack is

Twelve documents describing **every user journey across all five Parakh civic portals**, written so that a product owner can follow the story and a developer can implement without guessing.

For every important action the pack answers, in one place:

> **Who** performs it, on **which screen**, after **what authentication**, by **clicking what**, using **which API**, under **which permission and scope**, changing **which data and state**, producing **which audit record**, and what happens if it **succeeds or fails**.

**No feature in this pack has been built, run or tested.**

## 2. Files, in reading order

| # | File | Contents |
|---|---|---|
| **09** | `09_USE_CASE_DECISION_REGISTER.md` | **Read this first.** 15 pre-drafting blockers, 5 of them Blockers, 4 genuine document-vs-document contradictions |
| **00** | `00_PARAKH_USE_CASE_PACK_README.md` | This file — conventions, precedence, ID scheme |
| **01** | `01_CITIZEN_PORTAL_USE_CASES.md` | Citizen — React Native app |
| **02** | `02_STREET_REPRESENTATIVE_PORTAL_USE_CASES.md` | Street Representative — Django/HTMX |
| **03** | `03_UC_OFFICER_PORTAL_USE_CASES.md` | UC Officer — Django/HTMX |
| **04** | `04_CONTRACTOR_PORTAL_USE_CASES.md` | Contractor — Django/HTMX |
| **05** | `05_MAYOR_AND_OPERATIONS_PORTAL_USE_CASES.md` | Mayor & Operations — Django/HTMX |
| **06** | `06_CROSS_PORTAL_END_TO_END_WORKFLOWS.md` | 23 workflows crossing portal boundaries |
| **07** | `07_USE_CASE_TRACEABILITY_MATRIX.md` | One row per use case, plus five reverse-coverage tables |
| **08** | `08_USE_CASE_ACCEPTANCE_TESTS.md` | Given/When/Then, every one traced |
| **10** | `10_USE_CASE_CONSISTENCY_AUDIT.md` | Skeptical audit against 24 prohibited patterns |
| **11** | `11_USE_CASE_CHANGE_MANIFEST.md` | What was created, with byte counts and hashes |

## 3. Source precedence

| Rank | Source | Version |
|---|---|---|
| 1 | **Change record** | `CR-61 rev 1.3` |
| 2 | **RBAC · Data Model · API Contract · Screen Inventory** | `1.3` · `1.3` · `3.0` · `1.3` |
| 3 | **SRS · Build Specification** | **Not usable — see below** |
| 4 | **Technical Stack** | `1.3` |
| 5 | **Test Catalogue** | `1.0` |
| 6 | **README · Development Journal** | Contextual, non-normative |

> **Rank 3 is empty in practice.** `SRS v2.0.0` has not been written. `Parakh_Prototype_SRS_v1.4.2.md` is the **superseded anonymous-model baseline** and is preserved byte-identical; it is used for **nothing** in this pack. `Parakh_Release_0_Build_Specification_v1.3.1.md` is an extraction of that superseded SRS and is likewise unused. See **D-15**.

**Conflicts are never silently resolved.** Each is recorded in `09_USE_CASE_DECISION_REGISTER.md` with the conflicting sources named.

## 4. Identifier conventions

| Kind | Format | Example |
|---|---|---|
| Use case | `UC-<PORTAL>-NNN` | `UC-CIT-014`, `UC-UCO-007` |
| Shared staff use case | `UC-STF-NNN` | `UC-STF-010` *(shared official reporting)* |
| Cross-portal workflow | `WF-NN` | `WF-02` |
| Acceptance test | `AT-<AREA>-NNN` | `AT-AUTH-004` |
| Decision | `D-NN` | `D-04` |
| Screen | As in Screen Inventory v1.3 | `CIT-11`, `STF-10`, `UCO-03` |
| API | As in API Contract v3.0 | `API-135`, `API-163` |
| Capability | As in RBAC v1.3 | `CAP_RENDERING_CONFIRM_OWN` |
| State | As in RBAC v1.3 §9 | `ACCEPTED`, `PENDING_CITIZEN_CONFIRMATION` |

**Identifiers are never invented.** Where this pack proposes something new — `STF-11`, `Staff-pre-role` — it is marked **PROPOSED** and confined to a labelled branch.

## 5. Conventions inside each portal file

Every portal file has four parts:

| Part | Contents |
|---|---|
| **A** | Portal purpose, boundaries and **prohibited actions** |
| **B** | Actor and account summary — who invites, identifier, factors, activation, scope, statuses, login blockers, step-up, logout |
| **C** | **The 0-to-100 golden journey** — one continuous screen-by-screen walkthrough from "no account" to "signed out", numbered from **Step 0**, with fourteen columns per step |
| **D** | **Formal use cases** — thirty fields each |

**Golden-journey step columns:** Step · Screen · User sees · User action · System action · API · Data · Authorization · State · Audit · Success · Failure · Offline · Accessibility/language.

**Formal use-case fields (30):** ID · Name · Primary actor · Supporting actors · Goal · Trigger · Preconditions · Authentication · Authorization · Scope · Input data · Main success flow (from Step 0) · Alternate flows · Exception flows · Offline · Security and privacy · Accessibility and language · Entities read · Entities written · APIs · Screens · Capabilities · Audit events · State transitions · Postconditions · Notifications · Acceptance criteria · Given/When/Then · Dependencies · Open decisions.

## 6. The five portals

| Portal | Code | Client | Signup | Identifier | Factors |
|---|---|---|---|---|---|
| **Citizen** | `CIT` | **React Native** | **Self-service** | Mobile number | **One — SMS OTP (possession)** |
| **Street Representative** | `REP` | Django/HTMX/Alpine | Invited by **UC Officer** | Official mobile number | **Two — password + SMS OTP** |
| **UC Officer** | `UCO` | Django/HTMX/Alpine | Invited by **Mayor/Ops** with `CAP_ACCOUNT_ADMIN` | Official mobile number | **Two** |
| **Contractor** | `CON` | Django/HTMX/Alpine | Invited by **Mayor/Ops** after organisation approval | Official mobile number | **Two** |
| **Mayor & Operations** | `MAY` | Django/HTMX/Alpine | Bootstrapped once, then invited by a Mayor/Ops Account Administrator | Official mobile number | **Two** |

> **The mobile number is an account identifier, not an authentication factor.** Staff login is **two-factor**. Citizen login is **single-factor**, possession-based.
>
> **The Technical System Administrator is not a sixth portal.** It has no civic application login, no `RoleAssignment`, and appears in **no use case in this pack**.

## 7. Rules that hold in every use case

| Rule | Consequence |
|---|---|
| **Deny by default** | An absent capability is a denial, not a default-allow |
| **Server-side authorization** | Hiding a button is never sufficient. Every use case names the server check |
| **Exactly one acting role** | Capabilities are never combined across assignments |
| **Account-level conflict exclusion** | Survives role switching, present and future |
| **No confirmation on another's behalf** | `CAP_RENDERING_CONFIRM_OWN` is subject-type aware and never delegable |
| **No citizen phone number to operational staff** | Not masked, not partial, not on hover |
| **No citizen name anywhere** | **The field does not exist** — see **D-13** |
| **No contractor access to citizen audio or ASR output** | Server-side filtering, not template omission |
| **A queued draft is not a report** | No `CivicReport`, no reference, "Waiting to send" |
| **`DRAFT` is not a `CivicReport` state** | Creation is atomic at `SUBMITTED` |
| **AI never decides** | Verification, acceptance, rejection, assignment, completion, dispute, appeal and closure are human |
| **AI failure never submits** | Draft and recording preserved; no plausible replacement text |
| **OTP and AI processing never work offline** | Named plainly on screen, never a silent queue |

## 8. Language and accessibility, applied throughout

**Citizen written interface: Urdu and English only.** **Spoken input: Urdu, Punjabi, English and natural code-switched speech** — the citizen never selects a spoken language before recording. **The civic rendering is always Urdu script**, whatever the interface language.

> **Roman Urdu is a written representation of Urdu in Latin script, not a spoken language.** The intermediate ASR text may use Urdu script, Latin/English script, Romanized Urdu or mixed scripts depending on model output.

Every screen: ≥48dp targets · WCAG 2.1 AA contrast · colour never the sole carrier of meaning · usable at 200% text scale · full RTL mirroring for Urdu with **digits, phone numbers, OTPs and report references staying LTR** · icons always paired with text · **no security or RBAC jargon in citizen UI** · **no blank spinner without naming what is happening**.

## 9. Honest status

**Nothing in this pack has been implemented, built, deployed, tested, piloted, adopted, certified or reviewed.** No AI provider, SMS provider, hosting location, legal approval or data-retention approval exists or is assumed. No test in `08_USE_CASE_ACCEPTANCE_TESTS.md` has been written as code or executed. No accuracy, deliverability or performance figure is claimed anywhere.

**Five Blocker-severity decisions remain open.** They are named in `09_USE_CASE_DECISION_REGISTER.md`, and the use cases that depend on them carry labelled conditional branches rather than invented answers.

---

*Specified; not implemented; not tested.*
