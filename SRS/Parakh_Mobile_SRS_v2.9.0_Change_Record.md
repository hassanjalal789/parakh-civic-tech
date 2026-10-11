# Mobile SRS v2.9.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.8.0** (11 Oct 2026) → **v2.9.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** No requirement identifier is removed or renumbered (124 FR, 86 NFR, 12 SC). `FR-PUB.24`'s statement and two criteria are amended; the v2.8.0 statement and changed criterion are quoted in a dated note |
| Authority | Hassan Jalal's decisions of 11 October 2026 on `DG-79`, `DG-80` and the age of a last known position, given in chat |
| Files | New: `Parakh_Mobile_App_SRS_v2.9.0.md`. **v2.8.0 is kept unmodified** (SHA-256 `9ca338d9…`) as the superseded baseline |
| Method | 27 exact replacements from v2.8.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-79` | A spoken location description has a **hard maximum of 1 minute**. The recorder stops at 60 seconds, phone and server enforce the same limit, and a longer recording is not accepted. The recording format and settings stay as approved |
| `DG-80` | **Contractors see only the citizen's final reported (adjusted) location**, never the original device-measured position. Other authorized staff keep both (`DG-78`) |
| Last known age (repository `DG-82`) | A last known position is a fallback **only if it is no more than 30 minutes old**. An older one is not used, and the spoken or written description follows. The age of a last known position that is used is shown, and it is marked unverified |

## 2. Contradictions and gaps — reported, nothing overridden

| Finding | Handling |
|---|---|
| **Without coordinates**, a contractor's "final reported location" is a written description or a spoken recording. Neither decision says which a contractor receives; §4.3.5 never gives a contractor the `voice_original` | Not decided. **`TBD-M21`** opened (repository `DG-83`) |
| **"Not accepted" above 1 minute** | The same 0.5-second container-rounding tolerance as the approved 60-second video limit and the 3-minute recording limit applies. A file the recorder stopped at exactly 60 seconds can read slightly over 60 seconds in its container; without the tolerance it would be lost |
| **The 30-minute age** is measured where the reading is taken | Enforced on the phone (the platform's `maxAge`, and the app's own check of the reading's time). The server cannot verify the age after the fact, because a draft may reach it much later |

## 3. Changes, by section

| Section / item | v2.8.0 | v2.9.0 |
|---|---|---|
| Document Control | Version 2.8.0 | Version 2.9.0; status line; change-history row |
| §4.2 Microphone | spoken location description | Plus: at most 1 minute |
| §4.3.5 contractor row | `location` *(required precision only)* | Plus: the final reported location only; never the device-measured position, its accuracy, kind or time. A dated note: `DG-80`, `TBD-M21` |
| §5.2.5 `FR-PUB.24` | last known position, if one exists; spoken description length unset | **Amended:** at most 30 minutes old, its age shown; a spoken description of at most 1 minute. The v2.8.0 statement and criterion are quoted in a dated note |
| §6.2.9 `EvidenceObject` | `location_voice` | Plus: at most 1 minute |
| §11.4 | 41 `[TBD]`, 31 open | **`TBD-M20` resolved, `TBD-M21` opened**: 42 `[TBD]`, 31 open; the counts in §11.1 and Appendices D and E follow |
| Appendix F | — | **F.0 for v2.9.0** (v2.8.0 becomes F.0.1 … v2.2.0 F.0.7) |

## 4. Records outside the SRS

- **Decision register:**
  - `DG-79`, `DG-80` → **Resolved**;
  - **`DG-82`** (the age of a last known position) added, **Resolved**;
  - **`DG-83`** (what a contractor receives without coordinates) added, **Open**.
- **Requirement index:** regenerated; only `FR-PUB.24`'s statement changed.

## 5. Implementation (verified before this revision was committed)

- **`DG-79`:**
  - **server:** `PARAKH_LOCATION_RECORDING_MAX_SECONDS = 60`; a longer `location_voice` gets `400 location_recording_duration` with `max_seconds: 60`;
  - **phone:** the recorder stops a location recording at 60 seconds, and a longer file is refused and deleted with a plain message.
- **Last known age:** `getLastKnownPositionAsync({ maxAge: 30 min })`, plus the app's own check of the reading's time. An older reading is not used; the screen says so and offers the spoken or written description.
- **`DG-80`:** no contractor interface exists. The rule is recorded in the SRS and the API contract.

## 6. Not changed

- **No requirement removed or renumbered.**
- The report recording's 3 minutes (`DG-74`).
- **v2.8.0 is retained unmodified** as the superseded baseline.
