# DR-26 — explanation for review (`DG-66`, `TBD-M16`)

| Field | Value |
|---|---|
| Date | 2026-10-07 (Asia/Karachi) |
| Asked by | Hassan Jalal, 2026-10-07: explain `DR-26` before anything about it is changed or closed |
| Status | **Decided by Hassan Jalal on 2026-10-07, after this review: `DR-26` remains in force** (`DG-66` resolved, `TBD-M16` resolved; Mobile SRS v2.5.0). The analysis below is kept as he reviewed it |
| Sources | Mobile SRS v2.4.0 §1.4.3.1 (`DR-25`), §1.4.3.2 (`DR-26`), §7.4.2 (`SC-01`–`SC-12`), §10.3 exit criteria 17–24, §11.3 `RC-23`, §11.4 `TBD-M13`, `TBD-M16`; v2.1.0 and v2.2.0 for `SC-10` as first written |

## 0. The decision (2026-10-07)

- **`DR-26` remains active and is not cancelled.** It governs the architecture — the five portals within the approved React Native application — and is not fundamentally a draft-encryption decision.
- **The `SC-10` amendment of 2026-10-06 is an explicit owner-approved amendment** of the controls associated with `DR-26`, not a failure of its condition: the "amendment" row of §7.
- It covers **citizen-side drafts and pending submissions** only. They need no Parakh-specific encryption key, draft lock or application-encrypted draft store beyond the operating system's protections, the app sandbox and the approved backup exclusion (`DG-59`).
- **No unrelated control is weakened.**
- **The question in §5 about staff and Mayor data is answered "not decided":** encryption and storage at rest of future staff, Union Council, contractor, Mayor and administrative data is a separate open decision, brought back when those features are built — `DG-68`, `TBD-M17`.

## 1. What `DR-26` is

`DR-26` is a decision record in the Mobile SRS (§1.4.3.2), decided on **14 September 2026** at SRS v2.1.0 and approved by Hassan Jalal as Project Lead.

**It formally overrides `[SRC-STACK §2]`** — section 2 of `TECHNICAL_STACK` v1.3 — **on a single point: the client platform of the four staff portals.** The overridden sentence is:

> "The four staff portals are not migrated to React Native… React Native Web does not replace the staff portals."

With the override, **`DR-25` — the Unified Binary Architecture — is the binding client architecture.** All 58 approved screens (Citizen, shared staff, Street Representative, UC Officer, Contractor, Mayor & Operations) ship in **one React Native app**.

`DR-26` closes the contradiction `RC-23` ("resolved by override"). It does **not** close `TBD-M13`: `TECHNICAL_STACK` v1.3 still contains the overridden sentence until it is re-issued under a change request. The SRS says so itself: *an override is not an amendment.*

## 2. What it overrides, and what it does not

| Overridden | Not overridden |
|---|---|
| The client platform of the `REP`, `UCO`, `CON` and `MAY` portals, which becomes React Native in the same app | `DR-6`: the backend stays Python, Django, DRF, PostgreSQL/PostGIS, Celery/Redis and write-once evidence storage |
| The matching statement in `[SRC-SCREEN §5]` | The 58-screen inventory. No screen is created, retired or renumbered |
| The staff-portal scope exclusion in `[SRC-CR60 §4]` | `DR-19`: React Native, strict TypeScript, Expo SDK 57 |
| — | **Any permission, capability, scope rule, state transition or privacy rule.** `[SRC-RBAC]` and `[SRC-DATA]` are untouched |

**It does not override any security control or storage requirement.** It is a decision about *which client renders the staff portals*.

## 3. Why it was introduced

`DR-25` (v2.0.0) reversed `DR-21`, which had kept the staff portals in Django/HTMX. That put `DR-25` in direct conflict with an approved source, `[SRC-STACK §2]`, recorded as `RC-23`. **`DR-26` resolves the conflict by overruling the source** instead of withdrawing `DR-25`.

The SRS gives these reasons:

- **`RC-10` closes.** Offline recording on `STF-10` (staff official reporting) becomes possible on React Native; it was contradictory for a server-rendered page.
- **One evidence pipeline.** Staff reporting reuses the citizen client's camera, audio, hashing, `ClientSubmission` pipeline, confirmation contract and offline queue. No second, web-based copy is needed.
- **Native staff capability:** push to staff queues, the native camera for field and completion verification, and offline drafting in the field.

It accepted three costs:

- **`R-21`:** 35 screens of scope return.
- **`R-22`:** citizen data becomes co-resident with administrative authority in one process.
- **`R-23`:** the compiled bundle, which anyone can read, now maps the privileged API surface.

## 4. The condition attached to it

> "`DR-26` is granted conditional on §7.4.2. The twelve controls `SC-01`–`SC-12` and the requirements `FR-COMMON.23`–`.26` and `NFR-91`–`NFR-96` are [MUST], and Phase 2 does not exit without exit criteria 17–24. **If those controls are descoped, the override lapses and `RC-23` re-opens.**"

The twelve controls exist to contain `R-22` and `R-23`. They cover:

- **`SC-01`:** server-side authorization only;
- **`SC-02`–`SC-04`:** a fail-closed gateway, one interceptor profile, no acting-role header from a citizen;
- **`SC-05`–`SC-07`:** per-principal state isolation, the wipe protocol, no leakage between Mayor and other roles;
- **`SC-08`:** masking privileged screens;
- **`SC-09`:** scrubbed crash reports;
- **`SC-10`:** local data at rest;
- **`SC-11`:** honest root and jailbreak posture;
- **`SC-12`:** the bundle treated as published.

## 5. How `DR-26` relates to draft encryption

**Only indirectly, through `SC-10`, one of the twelve controls that form its condition.** `DR-26` itself says nothing about encryption or storage.

| Version | `SC-10` | Mitigates |
|---|---|---|
| v2.1.0 (when `DR-26` was granted) and v2.2.0 | "Local data at rest is **encrypted** — `LDS-2`/`LDS-3` under SQLCipher, `LDS-4` encrypted before write, key in `expo-secure-store`, released and dropped from memory on every wipe" | Device seizure; offline extraction |
| v2.3.0 onwards (Hassan Jalal's decision `DG-63`, 6 Oct) | "Local data at rest is **protected**" — tokens only in `expo-secure-store`; drafts and media app-private, bound to the account, kept out of backups, deleted when their lifetime ends; the connection released on every wipe; **no application encryption of drafts and media** | The same |

So `DG-63` changed **the mechanism of one of `DR-26`'s twelve conditions** for drafts and media. The open question is whether that change is an **amendment by the same authority** or a **descoping** of `SC-10`. If it is a descoping, the condition says the override lapses. That question is `TBD-M16` / `DG-66`, and it is reserved to Hassan.

**What else `SC-10` covers, which `DG-63` did not change:**

- tokens kept only in secure storage;
- the local database connection released on every wipe;
- `LDS-3`, the pre-authentication consent, which is not stored on the device today.

The other eleven controls are untouched.

**A point for the review:** under `DR-25` the same app will later hold **staff and Mayor data** (for example `STF-10` offline drafts). `DG-63` speaks of "local drafts and their media" without naming portals. Whether its "no application encryption" also applies to staff and Mayor local data, which is the data `R-22` was about, is not stated anywhere. **This is a question, not a finding.**

## 6. What cancelling (lapsing) `DR-26` would do

| Area | Effect |
|---|---|
| **Governing source** | `[SRC-STACK §2]` governs again: the staff portals are **not** React Native. `RC-23` re-opens as an open, High contradiction |
| **Architecture** | The active architecture — five portals in one React Native app, no web views for staff portals — would no longer have authority; the approved source would say the opposite. Either the staff portals return to the Django/HTMX design of `DR-21`, or a change request re-issues `TECHNICAL_STACK` (`TBD-M13`), or a new decision replaces `DR-26` |
| **Phase 2 plan** | The staff and Mayor screens planned in React Native (`REP-*`, `UCO-*`, `CON-*`, `MAY-*`, `STF-*`) would lose their basis; `RC-10` (offline staff recording) returns |
| **Code that exists today** | **Nothing built so far depends on `DR-26`.** The citizen screens, the draft store, the submission queue and the backend are unaffected: the citizen portal is React Native under `DR-19`, and no staff portal exists yet |
| **The twelve controls** | They would no longer be the override's condition. Most remain good practice, and several are required elsewhere (`SC-01` by `NFR-43`; `SC-09` by `NFR-58`) |

## 7. The choices, and their consequences

None of these is recommended here.

| If `DG-63`'s change to `SC-10` is treated as… | Then |
|---|---|
| **An amendment by the same authority** | `DR-26` stands with `SC-10` as amended; `TBD-M16` and `DG-66` close; nothing else changes. *(This was the recommendation recorded in `DG-66` on 2026-10-06; it is not a decision.)* |
| **A descoping** | `DR-26` lapses and `RC-23` re-opens, with the effects in §6, until a change request or a new decision |
| **An amendment that needs a narrower scope** | `DR-26` stands, but application encryption is restored for some local data — for example staff and Mayor local data — which would narrow `DG-63` |

## 8. Change log

| Date | Change |
|---|---|
| 2026-10-07 | Written at Hassan Jalal's request, for review. No record changed |
| 2026-10-07 | Decided by Hassan Jalal (§0). Records changed: `DG-66` resolved, `DG-68` opened, Mobile SRS v2.5.0 |
