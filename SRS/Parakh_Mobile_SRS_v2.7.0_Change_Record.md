# Mobile SRS v2.7.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.6.0** (11 Oct 2026) → **v2.7.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** No requirement identifier is removed or renumbered (124 FR, 86 NFR, 12 SC). **`FR-PUB.24` is restated** under the Project Lead's decision. Its v2.6.0 statement and criteria are quoted word for word in a dated note. Other decisions are recorded as dated notes, and superseded rows are struck through, not deleted |
| Authority | Hassan Jalal's decisions of 11 October 2026 on `DG-73`, `DG-74` (its SRS placement), `DG-75` and `DG-76`, given in chat after the review in `docs/planning/DG-73_REVIEW.md` |
| Files | New: `Parakh_Mobile_App_SRS_v2.7.0.md`. **v2.6.0 is kept unmodified** (SHA-256 `2de89fc6…`) as the superseded baseline |
| Method | 34 exact replacements from v2.6.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-73` | **Location.** First the phone's current GPS position. Else its last known position, if one exists. Else the citizen describes the location in words, and **no predetermined pilot-area coordinate** is used. `DG-30` continues to apply: no map, no map provider, no address lookup; latitude and longitude shown where coordinates exist; accuracy shown where available; adjustment with directional buttons. A description-only location says plainly that precise GPS coordinates were not available. **M3:** the device-measured position and its accuracy are kept beside the citizen-adjusted position. An adjusted position is never presented as the unchanged measurement. A report remains possible without GPS when the written description is given |
| `DG-74` | Recorded in this revision, as he asked: AAC in MPEG-4, mono, a 64 kbit/s target, and a **hard maximum of 3 minutes** for a spoken description |
| `DG-75` | **The server accepts MPEG-4 audio only**, the format whose duration it can verify. AAC, MP3, WebM or WAV need a separate reviewed change |
| `DG-76` | **Accepted typed text is kept exactly as written.** No automatic trimming or normalisation after acceptance. Text that is only whitespace may be refused |

## 2. Contradiction found, and not resolved here

**`NFR-28`** (MUST): *"The complete report flow shall be achievable by voice and camera alone."*

- **The case:** there is no current position and no last known position, or location is refused.
- **The conflict:** under `DG-73` the only way to give a location is a **written** description, so a citizen who can only speak cannot complete the report.
- **Not resolved here:** `NFR-28` is not amended, and the conflict is opened as **`TBD-M19`** (repository `DG-77`).

Everything else `DG-73` changes is the text it was decided to replace (§3).

## 3. Changes, by section

| Section / item | v2.6.0 | v2.7.0 |
|---|---|---|
| Document Control | Version 2.6.0 | Version 2.7.0; status line; change-history row; `CIT-09` is built as well as `CIT-08` |
| §2.7 `DEP-04` | Map tiles for `CIT-10`, `react-native-maps` P1 | Struck through: **no map, map provider or address lookup in the first version** |
| §3.2.1 Maps | `react-native-maps`, P1 | Struck through: not used |
| §3.3 folder structure | `location.tsx — CIT-10 map · manual pin · unverified flag` | GPS · accuracy · directional buttons · written description (the old wording kept in the line) |
| §3.6 offline table | "place a pin" | Struck through: set the location by GPS, the last known position or a written description |
| §4.1.2 `CIT-10` | Last known position + manual pin · `GET /geo/reverse` | Struck through: GPS with accuracy and directional buttons, else the last known position, else a written description; no address lookup |
| §4.2 GPS / location | Fallback: manual pin, `location_unverified` | Struck through: the last known position, else a written description, both `location_unverified` |
| §4.2 Microphone | — | Plus: recordings are AAC/MPEG-4, mono, 64 kbit/s, at most 3 minutes; the server accepts MPEG-4 audio only |
| §5.2.3 `FR-PUB.10` | — | A dated note: `DG-74` and `DG-75`. Stopping at the limit is not trimming |
| §5.2.3 `FR-PUB.12` | — | A dated note: `DG-76`, typed text and corrections stored exactly as written |
| §5.2.5 `FR-PUB.24` | Manual pin; buttons as well as dragging; traced to `GET /geo/reverse` | **Restated:** title, statement, source, traces and criteria. The v2.6.0 statement and criteria are quoted in a dated note; `TBD-M18` resolved; the `NFR-28` conflict named |
| §6.2.7 `CivicReport` | `location` | A dated note: the measured, reported and description fields; a report always has coordinates or a description |
| §9.1 `FR-PUB.24` | geo reverse · `location`, `location_unverified` | The API struck through; the new fields |
| §11.4 | 39 `[TBD]`, 31 open | **`TBD-M18` resolved, `TBD-M19` opened**: 40 `[TBD]`, 31 open; the counts in §11.1 and Appendices D and E follow |
| Appendix F | — | `CIT-09` built; **F.0 for v2.7.0** (v2.6.0 becomes F.0.1 … v2.2.0 F.0.5) |

## 4. Records outside the SRS

- **Decision register:**
  - `DG-73` → **Resolved**;
  - `DG-75`, `DG-76` added, **Resolved**;
  - `DG-74` notes that it is now in the SRS;
  - **`DG-77`** (the `NFR-28` conflict) and **`DG-78`** (who may see the measured position, a privacy question for the staff portals) opened, **Open**.
- **Tasks:** `T-051` is unblocked, and its deliverable and acceptance criteria follow `DG-73`.
- **Requirement index:** regenerated; only `FR-PUB.24` changed (title, statement, source, entities).
- **Design:** `docs/planning/DG-73_LOCATION_DATA_DESIGN.md` — the fields, the migrations, and the conflict and privacy checks made before the code changed.

## 5. Implementation (verified before this revision was committed)

- **`DG-73`:**
  - **Server:** `measured_*`, `reported_*`, `location_description`, and the derived `location_source` and `location_unverified`. The draft and report migrations rename the old position and accuracy fields and add the rest. A database check gives every report coordinates or a description. Purge clears every location field.
  - **Phone:** local migration 3 only adds columns; `setLocation` writes a location in one step.
  - The `CIT-10` screen itself is `T-051`.
- **`DG-74`:** the recorder stops at 3 minutes; device and server refuse a longer recording (`400 recording_duration`).
- **`DG-75`:** the server's recording types are `audio/mp4`, `audio/m4a` and `audio/x-m4a` only. `audio/3gpp` is also no longer accepted, being 3GPP rather than MPEG-4.
- **`DG-76`:** the server no longer trims typed text, the typed-text transcription, or the reporter's corrections. A change of whitespace alone is not counted as a correction. The content hash still uses its canonical form.

## 6. Not changed

- **No requirement removed or renumbered.** 124 FR, 86 NFR, 12 SC. **`NFR-28` is not amended.**
- **The other evidence bounds:** 1–3 photos, one video of up to 60 seconds.
- **v2.6.0 is retained unmodified** as the superseded baseline.
