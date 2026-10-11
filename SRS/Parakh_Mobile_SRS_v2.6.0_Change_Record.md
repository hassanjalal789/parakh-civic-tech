# Mobile SRS v2.6.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.5.0** (7 Oct 2026) → **v2.6.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** Decisions recorded as dated notes; **no requirement statement is removed, renumbered or reworded** (124 FR, 86 NFR, 12 SC). Superseded status text is marked, not deleted |
| Authority | Hassan Jalal's decisions of 11 October 2026 on `DG-30`, `DG-71` and `DG-72`, given in chat and recorded in the repository as approvals, with the earlier proposals kept as written |
| Files | New: `Parakh_Mobile_App_SRS_v2.6.0.md` (SHA-256 `2de89fc6…`). **v2.5.0 is kept unmodified** (SHA-256 `cbe55ea3…`) as the superseded baseline |
| Method | 25 exact replacements from v2.5.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-30` | **The first version's location**: from the phone's GPS; latitude and longitude shown with the reported GPS accuracy; adjusted with simple directional controls (buttons); **no external map or address-lookup provider** |
| `DG-71` | **A video includes sound.** The microphone is required for video; if it is refused or unavailable, video recording stays unavailable — **never a silent fallback**. Photo capture stays available where its own permission is granted. The screen explains why video is unavailable and lets the citizen grant the microphone where appropriate |
| `DG-72` | **The capture settings are kept**: photos at about 3 megapixels and 70 % quality; video at about 4.5 Mbit/s; the approved duration and count limits unchanged |

## 2. Contradictions found, and not resolved here

`DG-30` conflicts with two parts of the approved text. **Neither is changed**: both are reported to the Project Lead and opened as **`TBD-M18`** (repository `DG-73`).

| Approved text | Conflict with `DG-30` |
|---|---|
| `FR-PUB.24` acceptance: *"the pin can be moved using buttons as well as by dragging"* | With no map, there is nothing to drag; `DG-30` names directional buttons only |
| `FR-PUB.24` traces and the `CIT-10` row of §4.1: `GET /geo/reverse` | An address lookup; `DG-30` requires no address-lookup provider |

`DG-30` also sets **no starting point for a manual position when location is refused or unavailable**, which `FR-PUB.24` requires (marked `location_unverified`). That is part of `TBD-M18` too.

`DG-71` and `DG-72` conflict with nothing: `DG-71` fills a gap (§4.2 defined a microphone fallback only for `CIT-09`), and `DG-72` sets values `NFR-8` and `DG-54` left open.

## 3. Changes, by section

| Section / item | v2.5.0 | v2.6.0 |
|---|---|---|
| Document Control | Version 2.5.0; "not tested on any physical device"; "No reporting screen exists yet" | Version 2.6.0; status line; change-history row; **tested on one physical Android phone**; `CIT-08` is the first reporting screen built (the old wording kept in brackets or struck through) |
| §4.2 Microphone row | Text fallback for `CIT-09` | Plus: video on `CIT-08` needs the microphone; refused or unavailable, no video and never a silent one; photos unaffected (`DG-71`) |
| §5.2.2 `FR-PUB.4` | — | A dated note after the criteria: a video includes sound (`DG-71`); recording settings approved (`DG-72`); bounds unchanged |
| §5.2.5 `FR-PUB.24` | — | A dated note after the criteria: `DG-30` recorded; the two conflicting parts named and left unchanged (`TBD-M18`) |
| §7 `NFR-8` | Source column: amended at v2.3.0 by `DG-63` | Plus, in the source column: the values approved by `DG-72`. **The statement is unchanged** |
| §11.4 | 38 `[TBD]`, 30 open | **`TBD-M18` opened**: 39 `[TBD]`, 31 open; the counts in §11.1 and Appendices D and E follow |
| Appendix F | "No physical device run"; "No device test"; "No screen ... built" | Struck through or qualified, with the physical-phone tests and the built screens stated; **F.0 for v2.6.0** (v2.5.0 becomes F.0.1 … v2.2.0 F.0.4) |

## 4. Records outside the SRS

- **Decision register:** `DG-30`, `DG-71`, `DG-72` → **Resolved** (Hassan Jalal, 2026-10-11), each with his decision in the resolution note and the earlier proposal kept in the recommendation; **`DG-73` opened** (Open, owned by Hassan Jalal) for the `CIT-10` conflicts.
- **Tasks:** `T-051` now waits on `DG-73` instead of `DG-30`; `T-049` has no open decision left.
- **Requirement index:** regenerated; only `NFR-8`'s source note changed.

## 5. Implementation

- **`DG-72`:** no change in behaviour; the settings in `mobile/src/domain/captureSettings.ts` are marked approved.
- **`DG-71`:** the as-built behaviour already matched (video unavailable without the microphone, with an explanation and a way to grant it; photos unaffected). Two safeguards were added so a video can never be kept without sound:
  - on the phone, a video whose file holds no sound track is refused and deleted, with a plain explanation; the camera is explicitly not muted;
  - on the server, a video without a sound track is refused with `400`, field `video_sound`.
  - Not detectable without decoding: a sound track that holds only silence, as when another app holds the microphone. Android's own microphone-access switch is outside the app's control.
- **`DG-30`:** nothing is built yet; `T-051` follows when its turn comes and after `DG-73`.

## 6. Not changed

- **No requirement removed, renumbered or reworded.** 124 FR, 86 NFR, 12 SC.
- **The bounds:** 1–3 photos, one video of up to 60 seconds, 40 MiB.
- **v2.5.0 is retained unmodified** as the superseded baseline.
