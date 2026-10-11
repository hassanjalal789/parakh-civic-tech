# DG-77, DG-78 and the CIT-10 settings — design and checks

| Field | Value |
|---|---|
| Date | 2026-10-11 (Asia/Karachi) |
| Decisions | Hassan Jalal, 2026-10-11. **`DG-77`:** with no current or usable last known position, the citizen may describe the location by voice; typing is never mandatory; a written description stays available as an alternative; the spoken description is kept as report evidence; no AI interpretation or automatic location inference from it; the report proceeds without coordinates, marked non-GPS / unverified. **`DG-78`:** authorized staff see both the original device-measured position and the citizen's final position, as two clearly distinct values, with the device-reported accuracy where available. **CIT-10 settings:** 5 m per button press (not 10); 20 s wait for a fix; 500-character description; the best practical GPS accuracy requested; the accuracy actually reported is displayed, never a greater precision |
| Status | Implemented in the same change. Names and body shapes are **PROPOSED** (routine, reversible); the rules are his decisions |

## 1. Design

| Item | Design |
|---|---|
| The spoken location description | A recording of its own, evidence kind **`location_voice`**. It is **separate from `voice_original`**, so it is never sent to the AI pipeline (the pipeline reads `voice_original` only), never transcribed, and nothing is inferred from it. It is captured like every recording: the recorder's own file, hashed at capture, moved and never altered. The server accepts it as MPEG-4 audio only (`DG-75`). It is sealed with the report and listed among its evidence |
| Location source | `written_description` (renamed from `description`, to sit beside the new value) and **`spoken_description`**. Both are unverified, and the report states that precise GPS coordinates were not available |
| API-130 `location` | `spoken_description: true` with no coordinates and no written description. **Exactly one** of the written or spoken description stands in for coordinates (DG-77: "alternative") |
| Evidence rule (API-132) | A draft whose location is spoken holds **exactly one** `location_voice`; any other draft holds none. Changing the location to or from spoken after the manifest is complete reopens the manifest. API-140 checks it again |
| Every report has a location | The database check now accepts reported coordinates, a written description, **or** a spoken description |
| `DG-78` | The server already returns `measured` (with `accuracy_m`) and `reported` as separate objects (`DG-73`). No staff route exists yet; the rule is recorded in the SRS (§4.3.5) and the contract for when the portals are built |
| CIT-10 | No coordinates: **Speak** and **Type** offered as equal choices, neither required, neither preselected. Speak records, plays, deletes and re-records. Switching between them, or replacing a description with a GPS position found later, deletes nothing without the citizen's confirmation (`FR-COMMON.14`). Step 5 m; current fix requested at the highest accuracy (on Android, High and above use the same high-accuracy mode); the accuracy shown is the device's value, rounded **up** to 0.1 m, with a plain statement that the real position may be that far away |

## 2. Contradictions and gaps — reported, nothing overridden

| # | Finding | Handling |
|---|---|---|
| 1 | **§4.3.5 contractor packet:** `location` *"(required precision only)"*, and contractors never receive the `voice_original`. `DG-78` names "authorized staff" without saying whether contractors are included | §4.3.5 is **not changed**. Opened **`DG-80`** / `TBD-M20`: whether contractors see the measured position, and whether the spoken location recording is withheld from them like `voice_original` |
| 2 | **No length limit is set for a spoken location description** | The recorder settings and the 3-minute hard maximum of `DG-74` are applied as a reversible default, refused above it on the device and the server. **Proposed as `DG-79`** for confirmation |
| 3 | **Consent** (`CIT-03`): *"Parakh stores my voice recordings and processes them with AI"*, required | It covers storing the location recording. The location recording is **not** processed with AI, so it asks less than the consent allows. No change |
| 4 | **`NFR-28`** | Satisfied again: a voice-only citizen can give the location by voice. `TBD-M19` resolved |
| 5 | **"Usable" last known position** | No maximum age is set. Its age is shown, and it is marked unverified. Not decided here |
