# Mobile SRS v2.8.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.7.0** (11 Oct 2026) → **v2.8.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** No requirement identifier is removed or renumbered (124 FR, 86 NFR, 12 SC). **`FR-PUB.24` is restated** under the Project Lead's decision; its v2.7.0 statement and changed criteria are quoted in a dated note. Other changes are dated notes |
| Authority | Hassan Jalal's decisions of 11 October 2026 on `DG-77`, `DG-78` and the `CIT-10` settings, given in chat |
| Files | New: `Parakh_Mobile_App_SRS_v2.8.0.md`. **v2.7.0 is kept unmodified** (SHA-256 `e446b270…`) as the superseded baseline |
| Method | 33 exact replacements from v2.7.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-77` | **`NFR-28` preserved.** If neither a current GPS fix nor a usable last known position is available, the citizen may describe the location **by voice**. Typing is not mandatory, and a written description stays available as an alternative. The spoken description is preserved as report evidence. **No AI interpretation or automatic location inference from it** unless separately approved. The report may proceed without coordinates when a spoken or written description is given, marked non-GPS / unverified |
| `DG-78` | **Authorized staff** see both the original device-measured position and the citizen's final reported (adjusted) position, as **two clearly distinct values**, with the device-reported accuracy where available. The original is never overwritten or discarded |
| `CIT-10` settings | **5 m per button press** (not 10). **20 seconds** to wait for a fix. **500 characters** for a written description. The **best practical GPS accuracy** is requested, the **accuracy the device reports** is displayed, and no greater precision is claimed |

## 2. Contradictions and gaps — reported, nothing overridden

| Finding | Handling |
|---|---|
| §4.3.5 gives a **contractor** `location` *(required precision only)* and never the `voice_original`. `DG-78` names "authorized staff" without saying whether contractors are included | **§4.3.5 is not amended.** `TBD-M20` is opened (repository `DG-80`) |
| **No length is set for a spoken location description** | The recording limit of `FR-PUB.10` (3 minutes, `DG-74`) is applied and **proposed** for confirmation (repository `DG-79`) |
| `CIT-03` consent: *"stores my voice recordings and processes them with AI"* (required) | Covers storing the location recording, which is not processed by AI. No conflict |

## 3. Changes, by section

| Section / item | v2.7.0 | v2.8.0 |
|---|---|---|
| Document Control | Version 2.7.0 | Version 2.8.0; status line; change-history row |
| §3.6 offline table | set the location by GPS, last known position or written description | Plus: or a spoken one |
| §4.1.2 `CIT-10` | … else a written description | Plus: or a spoken one, kept as evidence |
| §4.2 GPS / location | the last known position, else a written description | Plus: or a spoken description; typing never required |
| §4.2 Microphone | — | Plus: the spoken location description on `CIT-10` |
| §4.3.5 | — | A dated note: `DG-78`; the contractor row not amended (`TBD-M20`) |
| §5.2.5 `FR-PUB.24` | Written description only; "the reported accuracy" | **Restated:** title, statement, source, traces and two criteria (spoken or written; typing never required; no AI interpretation; the best practical accuracy; the accuracy as the device reports it). The v2.7.0 text is quoted in a dated note with the approved settings |
| §6.2.7 `CivicReport` | coordinates or a written description | Plus: or a spoken description, its recording sealed |
| §6.2.9 `EvidenceObject` | `photo` / `video` / `voice_original` | Plus `location_voice`, never processed by AI |
| §9.1 `FR-PUB.24` | — | Plus `location_voice` |
| §11.4 | 40 `[TBD]`, 31 open | **`TBD-M19` resolved, `TBD-M20` opened**: 41 `[TBD]`, 31 open; the counts in §11.1 and Appendices D and E follow |
| Appendix F | — | **F.0 for v2.8.0** (v2.7.0 becomes F.0.1 … v2.2.0 F.0.6) |

## 4. Records outside the SRS

- **Decision register:**
  - `DG-77`, `DG-78` → **Resolved**;
  - **`DG-81`** (the `CIT-10` settings) added, **Resolved**;
  - **`DG-79`** (the spoken location limit) added, **Proposed**;
  - **`DG-80`** (contractors) added, **Open**.
- **Design and checks:** `docs/planning/DG-77_DG-78_DESIGN.md`.
- **Requirement index:** regenerated; only `FR-PUB.24` changed.

## 5. Implementation (verified before this revision was committed)

- **Server:**
  - evidence kind `location_voice` (MPEG-4 audio, 20 MiB, at most 3 minutes; never sent to the AI pipeline);
  - location source `spoken_description`, with `description` renamed `written_description`;
  - API-130 `spoken_description`;
  - exactly one location recording for a spoken location and none otherwise (API-132, API-140);
  - the manifest reopened when the location changes to or from spoken;
  - every report has coordinates, a written description or a spoken one (database check).
- **Phone:**
  - **On `CIT-10`, Speak and Type are equal choices without coordinates**. Speak records, plays, deletes and re-records.
  - Nothing the reporter gave is deleted without confirmation, including when a GPS position is found later.
  - 5 m per press; `Accuracy.Highest` requested (on Android, High and above use the same high-accuracy mode); the device's accuracy shown, rounded up to 0.1 m.
- **Staff routes do not exist yet.** The server's location body already returns `measured` and `reported` as separate objects, with `accuracy_m`.

## 6. Not changed

- **No requirement removed or renumbered.** **`NFR-28` is not amended**: it is now satisfied.
- **§4.3.5's contractor row.**
- **v2.7.0 is retained unmodified** as the superseded baseline.
