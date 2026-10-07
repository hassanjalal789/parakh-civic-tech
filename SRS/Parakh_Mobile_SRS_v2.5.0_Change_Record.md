# Mobile SRS v2.5.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.4.0** (7 Oct 2026) → **v2.5.0** (7 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** A governance decision recorded; superseded text is marked, not deleted. Requirement identifiers and counts are unchanged (124 FR, 86 NFR, 12 SC) |
| Authority | Hassan Jalal's governance decision of 7 October 2026 on `DR-26` and `SC-10`, given in chat after he reviewed [`docs/planning/DR-26_REVIEW.md`](../docs/planning/DR-26_REVIEW.md). Recorded in the repository as `DG-66` (resolved) and `DG-68` (opened) |
| Files | New: `Parakh_Mobile_App_SRS_v2.5.0.md` (SHA-256 `cbe55ea3…`). **v2.4.0 is kept unmodified** (SHA-256 `169eabb6…`) as the superseded baseline |
| Method | 19 exact replacements from v2.4.0, each asserted to match once |

## 1. The decision

| Point | Decision of 7 October 2026 |
|---|---|
| `DR-26` | **Remains active and is not cancelled.** It governs the architectural decision that the citizen, staff, Union Council, contractor and Mayor & Operations portals stay within the approved React Native application. Its purpose is architectural and operational, not fundamentally a draft-encryption decision |
| The `SC-10` amendment of 6 Oct 2026 (`DG-63`) | **An explicit owner-approved amendment of the security controls associated with `DR-26`** — not a failure of `DR-26`'s condition and not grounds for it to lapse |
| Scope of the amendment | **Citizen-side drafts and pending submissions**: no separate Parakh-specific encryption key, draft lock or application-level encrypted draft store beyond the operating system's protections, the app sandbox and the approved backup exclusion (`DG-59`) |
| Limits | It **does not authorize weakening unrelated security controls**, and it is **not automatically extended** to future staff, Union Council, contractor, Mayor or administrative data |
| Future staff and administrative data | Their encryption and storage requirements stay **a separate unresolved security decision**, brought back for approval when those features are implemented — `TBD-M17`, repository `DG-68` |

## 2. Changes, by section

| Section / item | v2.4.0 | v2.5.0 |
|---|---|---|
| Document Control | Version 2.4.0 | Version 2.5.0; status line; change-history row |
| §1.4.3.2 `DR-26` | Conditional on `SC-01`–`SC-12`; "if descoped, the override lapses" | Unchanged condition, plus a **Status: in force** row and a note: the `SC-10` amendment is an owner-approved amendment, not a descoping; the override does not lapse; `RC-23` stays resolved |
| §3.6.3 note on `DG-63` | No application encryption of `LDS-2`/`LDS-4` | Plus: **scope is citizen-side drafts and pending submissions**; staff and administrative data at rest are `TBD-M17` |
| `NFR-48` | The offline queue app-private, account-bound, lifetime-limited | Plus: covers citizen-side drafts and pending submissions; staff and administrative data at rest are `TBD-M17` |
| `SC-10` | "Whether this amendment affects the condition on `DR-26` is `TBD-M16`" | That sentence struck. **The Project Lead's explicit, approved amendment; `DR-26` remains in force**; scope citizen-side drafts and pending submissions; no other control weakened; staff and administrative data not covered (`TBD-M17`). Enforced-by adds `DG-59`, `DG-66` |
| §11.3 `RC-23` | Resolved by override, conditional on §7.4.2 | Plus: the `SC-10` amendment is not a descoping; the row stays resolved |
| §11.4 `TBD-M16` | Open | **Resolved at v2.5.0**; its text kept |
| §11.4 `TBD-M17` | — | **Opened**: staff, Union Council, contractor, Mayor & Operations and administrative data at rest on the device |
| §11.1, Appendices D, E | 37 `[TBD]`, 30 open | **38 `[TBD]`, 30 open** (one resolved, one opened) |
| Appendix A `DR-26` | Conditional; "an override is not an amendment" | Plus: in force; the `SC-10` amendment is owner-approved, not a descoping |
| Appendix F | — | F.0 for v2.5.0 (v2.4.0 becomes F.0.1, v2.3.0 F.0.2, v2.2.0 F.0.3) |

## 3. Records outside the SRS

- **Decision register:**
  - `DG-66` resolved;
  - `DG-63` scope noted (citizen-side drafts and pending submissions);
  - `DG-02` notes that `DR-26` was confirmed in force;
  - **`DG-68` opened** (Open, owned by Hassan Jalal).
- **Tasks:** `T-089` (the twelve controls) and `T-090` (`STF-10` official reporting, the first feature that would keep staff data on a device) now list `DG-68` as a decision blocker.
- **`docs/planning/DR-26_REVIEW.md`:** marked decided, with the analysis kept as written.

## 4. Implementation

**No implementation change is needed.** The code never treated `DR-26` as able to lapse. The only places that mention it are:

- two tracker labels that name `SC-01`–`SC-12` as "conditions of DR-26", which stays true;
- a comment in `mobile/src/storage/drafts.ts` that cites `SC-10` for account binding.

The draft store already implements the amended `SC-10` for citizen drafts and pending submissions:

- no application key;
- app-private, account-bound and lifetime-limited;
- no Android backups;
- tokens this-device-only.

**No staff or administrative data is stored on the device today.** The staff and Mayor portals do not exist yet.

## 5. Not changed

- **No requirement removed or renumbered.** 124 FR, 86 NFR, 12 SC.
- **`SC-01`–`SC-09`, `SC-11` and `SC-12` are unchanged**, as are `FR-COMMON.23`–`.26`, `NFR-91`–`NFR-96` and exit criteria 17–24.
- **`DR-26`'s general condition is unchanged:** descoping the controls would still lapse it. The `SC-10` amendment is recorded as not being a descoping.
- **`TBD-M13` stays open:** `TECHNICAL_STACK` v1.3 still contains the overridden sentence.
- **v2.4.0 is retained unmodified** as the superseded baseline.
