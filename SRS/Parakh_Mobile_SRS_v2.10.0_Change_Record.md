# Mobile SRS v2.10.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.9.0** (11 Oct 2026) → **v2.10.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** **No requirement statement changes** (124 FR, 86 NFR, 12 SC). §4.3.5 is amended by addition; §6.2.9 gets a dated note |
| Authority | Hassan Jalal's decision of 11 October 2026 on `DG-83`, given in chat |
| Files | New: `Parakh_Mobile_App_SRS_v2.10.0.md`. **v2.9.0 is kept unmodified** (SHA-256 `7c71ca89…`) as the superseded baseline |
| Method | 20 exact replacements from v2.9.0, each asserted to match once |

## 1. The decision

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-83` | When a report has no GPS coordinates: **a contractor may receive the citizen's written location description**. A contractor **must not receive or play the original spoken location recording**; it remains protected report evidence, outside the contractor-facing view. **If the location was given only by voice and no approved written transcription exists, the raw recording is not exposed to the contractor merely to provide location access.** The case stays clearly identifiable so that an authorized internal staff workflow can resolve it or provide the operational location. `DG-80` is unchanged: contractors receive only the final operational location, never the device-measured position or its accuracy |

## 2. Contradictions

**None found.** §4.3.5 already never gives a contractor the `voice_original`, and `DG-77` already forbids AI interpretation of the location recording. The decision extends both.

## 3. Changes, by section

| Section / item | v2.9.0 | v2.10.0 |
|---|---|---|
| Document Control | Version 2.9.0 | Version 2.10.0; status line; change-history row |
| §4.3.5 contractor row | final reported location only; never the device-measured position | Plus: without coordinates, the written description if one exists; never the spoken location recording (no reference, URL or playback). A dated note: `DG-83`, the voice-only case kept identifiable for staff |
| §6.2.9 `EvidenceObject` | `location_voice` | Plus: never in a contractor-facing view |
| §11.4 | 42 `[TBD]`, 31 open | **`TBD-M21` resolved**: 42 `[TBD]`, 30 open; the counts in §11.1 and Appendices D and E follow |
| Appendix F | — | **F.0 for v2.10.0** (v2.9.0 becomes F.0.1 … v2.2.0 F.0.8) |

## 4. Records outside the SRS

- **Decision register:** `DG-83` → **Resolved**.
- **API contract:** the contractor visibility rule.
- **Contractor-portal acceptance criteria:** `T-096` (the contractor packet) and `T-095` (assignment) updated.
- **Requirement index:** unchanged.

## 5. Implementation

**None needed yet.** No contractor or staff interface exists. The voice-only case is already identifiable in the data: `location_source = spoken_description`, with no coordinates and no written description. **How the staff workflow provides the operational location is not designed here.** It belongs with the staff portals.
