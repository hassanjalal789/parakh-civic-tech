# Mobile SRS v2.4.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.3.0** (6 Oct 2026) → **v2.4.0** (7 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** Decisions recorded; conflicting requirements amended; superseded text is marked, not deleted. Requirement identifiers and counts are unchanged (124 FR, 86 NFR, 12 SC) |
| Authority | Hassan Jalal's decisions of 7 October 2026, given in chat and recorded in the repository as `DG-57`, `DG-59` and `DG-67` ([`docs/planning/DECISIONS_AND_GAPS.md`](../docs/planning/DECISIONS_AND_GAPS.md)). **`DG-66` (`DR-26`, `TBD-M16`) is not decided**: he asked for an explanation first ([`docs/planning/DR-26_REVIEW.md`](../docs/planning/DR-26_REVIEW.md)) |
| Files | New: `Parakh_Mobile_App_SRS_v2.4.0.md` (SHA-256 `169eabb6…`). **v2.3.0 is kept unmodified** (SHA-256 `cbf5d9c5…`) as the superseded baseline |
| Method | 25 exact replacements from v2.3.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 7 October 2026 | Status |
|---|---|---|
| — | A report the citizen has successfully submitted goes to the server and enters the standard verification workflow | **Unchanged**: already the rule (`DG-56`, `FR-PUB.28`) |
| `DG-64` | An ordinary local draft that was never submitted is kept for at most 48 hours, then deleted, unless an explicitly approved requirement says otherwise | **Confirmed**; unchanged |
| `DG-67` | A pending submission is retried for up to 48 hours from the original submission attempt, and **deleted from the phone if it still cannot be completed**; failed or unconfirmed submissions are never kept beyond that. While pending it is clearly distinguished from a saved draft and shown as not yet confirmed | **Resolved** (was Proposed); differs from the proposal |
| `DG-57` | Server clean-up of incomplete or abandoned uploads: **72 hours, approved**, with safeguards so that uploads still being processed or transferred are not deleted. Separate from the 48-hour device rules | **Resolved** (was Proposed) |
| `DG-59` | Drafts, pending submissions, temporary report data, photographs, videos and other sensitive local material are kept out of iCloud and equivalent backups where the platform allows it. iOS when built with Xcode; Android documented and excluded where supported | **Resolved** (was Open) |
| `DG-66` | Whether amending `SC-10` lapses `DR-26` | **Not decided.** Explanation prepared for review; `DR-26` unchanged |

## 2. Contradictions with approved requirements — flagged, and how the later decision applies

Each contradiction is between two decisions of the same authority. The later one is applied, and the earlier text is struck through, not deleted.

| Earlier approved text | The 7 October decision | Applied as |
|---|---|---|
| `DG-14` (4 Oct) and `FR-PUB.28` (v2.2.0): after 48 hours "stop automatic retries, **keep the local draft**, tell the citizen plainly that submission was not confirmed, and check the server … before offering another attempt" | The pending submission "should be automatically deleted"; "do not keep failed or unconfirmed submissions indefinitely after this period" | The *keep* clause is superseded; **deletion at 48 hours**; `TBD-M15` resolved |
| `FR-COMMON.12` (legacy `FR-OFF-003`–`FR-OFF-005`): "shall delete the local copy of a submitted item **only after confirmed server receipt**" | Deletion after 48 hours without confirmation | Amended: "…or, unconfirmed, 48 hours after the first press of Submit". **The legacy identifiers are preserved; the legacy text is overridden on this point** |
| `DG-65` (6 Oct): "before … deleting local data, the client checks the submission's status on the server" | Automatic deletion at 48 hours, even when no check is possible | **The status check is made where the server can be reached; the deletion happens regardless.** The server keeps any report that exists, so a report that arrived is never lost |
| `FR-COMMON.13` (v2.3.0): a submitted draft is preserved "until the server confirms receipt or the reporter cancels" | At most 48 hours from Submit | Amended accordingly |

## 3. How the decisions were applied — readings recorded, not new decisions

| Point | Reading | Why |
|---|---|---|
| "48 hours from the original submission attempt" | **From the citizen's first press of Submit**: `submission_expires_at = submission_requested_at + 48 hours`, fixed at the first press and never extended by a later press | The citizen's attempt is the press; the device makes its first request at that moment |
| A draft submitted late in its lifetime | Its 48 hours as a pending submission count from Submit, so it can stay on the phone up to 96 hours after creation in total | The two rules are separate: 48 hours for a draft, 48 hours from Submit for a pending submission |
| What is deleted | The local pending submission and its media. The device then asks the server to drop its temporary copy; **the server keeps any report that exists** (`E_ALREADY_SUBMITTED`), and the citizen finds it under My Reports | "Submitted reports and their protected evidence are preserved" (`DG-55`) |
| Telling the citizen | The store reports how many pending submissions it deleted; the screens (`T-052`) must say so plainly | The decision requires the distinction during the period; saying what happened afterwards follows `FR-COMMON.11` |
| `DG-57` "after 72 hours" | **72 hours without activity**, as the approved proposal stated. Activity is an upload chunk, an edit, a manifest update, a correction, a confirmation, or the start or end of a processing job; a job that never ends stops protecting its draft 72 hours after it started | "Safeguards that prevent deletion of uploads still actively being processed or transferred" |
| Per-object clean-up | The 72 hours are counted per draft. An abandoned item inside a draft that is still active is removed when that draft is submitted, cancelled or purged | This is the implemented and approved proposal; per-item expiry was not part of it |
| `DG-59` on Android | `allowBackup="false"`, plus data-extraction rules excluding every storage domain from cloud backup and device-to-device transfer, plus full-backup rules for Android 11 and lower. Android 16 QPR2's transfer to iOS is not declared: it needs the app's iOS team id, which does not exist | "Wherever technically supported" |
| `DG-59` on iOS | The session tokens are stored for this device only (now). The drafts database and media directories are marked excluded from backup with the iOS build | "When the project is tested or built through Xcode"; no Xcode is installed |
| "The current Flutter application" | **The current app is the Expo / React Native app in `mobile/`** (`DR-19`). `apps/citizen/` is the superseded Flutter template awaiting removal (`DG-03`), so the device procedure targets the React Native app | Source precedence: `DR-19` governs |

## 4. Changes, by section

| Section / requirement | v2.3.0 | v2.4.0 | Decision |
|---|---|---|---|
| Document Control | Version 2.3.0 | Version 2.4.0, 7 Oct 2026; status, implementation status and change-history row | — |
| §3.6.3 storage boundary | — | New note: backups (`DG-59`) | `DG-59` |
| §3.6.4 Retry window | Kept after 48 h, labelled not confirmed (`TBD-M15`) | Shown as a pending submission, not yet confirmed; **deleted at 48 hours from Submit**, after a last status check where reachable | `DG-67` |
| §3.6.4 Status check | Before a retry or a deletion | Plus: at the end of the 48 hours the copy is deleted even if the server cannot be reached | `DG-67` |
| §3.6.4 Server clean-up | Period not approved | **72 hours without activity, approved**; what counts as activity | `DG-57` |
| `FR-PUB.28` | Keep the draft after 48 hours | The *keep* clause struck; distinction from saved drafts; deletion at 48 hours; new criteria (old ones kept as comments) | `DG-67` |
| `FR-COMMON.12` | Delete only after confirmed receipt | …or, unconfirmed, 48 hours after Submit; new criteria | `DG-67` |
| `FR-COMMON.13` | Until receipt or cancellation | …and at most 48 hours from Submit | `DG-67` |
| §6.4.1 retention | Temporary data expiry `DG-57` proposed; the Submit-pressed copy kept (`TBD-M15`) | 72 hours without activity, approved; the Submit-pressed copy deleted 48 hours after Submit | `DG-57`, `DG-67` |
| §11.1, §11.4, Appendices D, E | 37 `[TBD]`, 31 open | **37 `[TBD]`, 30 open**: `TBD-M15` resolved, its row kept and marked | `DG-67` |
| Appendix A glossary | — | Pending submission; server clean-up period | `DG-57`, `DG-67` |
| Appendix F | — | F.0 for v2.4.0 (the v2.3.0 table becomes F.0.1, v2.2.0 F.0.2) | — |

## 5. Not changed

- **No requirement removed or renumbered.** 124 FR, 86 NFR, 12 SC.
- **`DR-26`, `SC-10` and `TBD-M16` are unchanged** while Hassan reviews `DR-26`.
- **No authorization rule and no state-machine transition changed.** The verification sequence (`DG-56`) is unchanged.
- **The evidence bounds are unchanged:** 1–3 live photos and one optional live video of up to 60 seconds.
- **The four remaining Blockers stay open:** `RC-07`, `RC-08`, `RC-17`, `RC-18`.
- **v2.3.0 is retained unmodified** as the superseded baseline.
