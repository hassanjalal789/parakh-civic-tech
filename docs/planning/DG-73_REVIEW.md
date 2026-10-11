# DG-73 — CIT-10 text that conflicts with DG-30, for review (`TBD-M18`)

| Field | Value |
|---|---|
| Date | 2026-10-11 (Asia/Karachi) |
| Asked by | Hassan Jalal, 2026-10-11: before deciding, show the conflicting text, how it conflicts, proposed replacement wording, and what would change |
| Status | **Not decided. Nothing in the SRS, the register or the code has been changed.** Everything under "Proposed" is a proposal for Hassan, not an approved requirement |
| Sources | Mobile SRS v2.6.0 §5.2.5 `FR-PUB.24`, §4.1.2 (`CIT-10` row), §4.2 (location row), §2.7 `DEP-04`, §3.2.1 (Maps row), §3.3 (folder structure), §9.1 (traceability), §11.4.2 `TBD-M18`; register `DG-30`, `DG-73`; task `T-051`; use-case pack `UC-CIT-033`–`UC-CIT-035`; backend `parakh/drafts/services.py` (draft location) |

## 0. What DG-30 approved (Hassan Jalal, 2026-10-11)

For the first version of Parakh:

- the location comes from the phone's **GPS**;
- the **latitude, longitude and reported GPS accuracy** are shown;
- the citizen **adjusts the position with simple directional controls (buttons)**;
- **no external map or address-lookup provider** is required.

## 1. The existing text that conflicts, word for word

### Listed in `TBD-M18` (v2.6.0)

| # | Where | Exact text |
|---|---|---|
| A | `FR-PUB.24`, statement (last sentence) | "Pin placement shall be operable **by buttons, not only by drag**." |
| B | `FR-PUB.24`, acceptance criteria | "And    the pin can be moved using buttons as well as by dragging" |
| C | `FR-PUB.24`, Traces | "Screen `CIT-10` · `expo-location` · `GET /geo/reverse`" |
| D | §4.1.2 citizen screens, `CIT-10` row | "\| `CIT-10` \| Confirm location \| Place the issue accurately \| Last known position + manual pin \| `GET /geo/reverse` \|" |
| E | `FR-PUB.24`, statement and acceptance criteria (a gap, not a contradiction) | "on denial or unavailability it shall allow a manual pin and shall mark the location **`location_unverified`**" · "Given  location permission is denied / Then   a manual pin is offered and the result is marked location_unverified / And    with no connection, the last known position plus manual pin is offered" |

### Found during this review, not yet in `TBD-M18`

| # | Where | Exact text |
|---|---|---|
| F | §2.7, `DEP-04` | "\| `DEP-04` \| Map tiles for `CIT-10` — `react-native-maps` is **P1**, not R0 \| `[SRC-STACK §4]` \|" |
| G | §3.2.1 module selection, Maps row | "\| Maps \| **`react-native-maps`** \| **P1** \| Dev build \|" |
| H | §3.3 folder structure | "location.tsx       # CIT-10  map · manual pin · unverified flag" |
| I | §9.1 traceability, `FR-PUB.24` row | "\| `FR-PUB.24` \| `CIT-10` \| geo reverse \| `location`, `location_unverified` \| `FR-EVD-101/102` \| `AT-PUB-024` \| P1 \|" |

### Outside the SRS

| # | Where | Exact text |
|---|---|---|
| J | Task `T-051`, deliverable | "CIT-10 screen + GET /geo/reverse" |
| K | Task `T-051`, acceptance criteria | "Denied GPS still allows a manual pin flagged location_unverified; pin movable by buttons; capture time sent and never overwritten" |
| L | Use-case pack `UC-CIT-033`–`035` (lower precedence than the SRS) | "`CIT-10` shows a map, a pin at the device position and an address hint. Citizen taps **Use my location** or drags the pin. Reverse geocoding fills the address hint." · APIs: "`GET /geo/reverse`" · Accessibility: "Address hint in the selected interface language" |

## 2. How each one conflicts with DG-30

| # | Conflict |
|---|---|
| A, B | Dragging needs a map, or at least a surface to drag across. DG-30 has no map, only directional buttons. "Not only by drag" and "as well as by dragging" require a drag gesture that the approved design does not have. As written, a CIT-10 built to DG-30 fails `FR-PUB.24`'s acceptance test. |
| C, D, I, J | `GET /geo/reverse` turns coordinates into an address. That is an address-lookup service, which DG-30 excludes, and the server has no such route. Each trace names something the approved design does not include. |
| E | Not a contradiction but a gap. `FR-PUB.24` requires a manual position when location is refused or unavailable. DG-30 adjusts a position with buttons, but says nothing about **where that position starts** when there is no GPS fix. Without a map, buttons can only move a point that already exists. The server also requires a latitude and a longitude on every draft (`services.py`: `location` must be an object with coordinates). |
| F, G, H | All three plan a map for `CIT-10` (`react-native-maps`, "map · manual pin"). DG-30 approved no map. |
| K | "Pin" assumes a map. Under DG-30 it would mean a position shown as numbers and adjusted with buttons. The rest of K is consistent with DG-30. |
| L | It describes the map, dragging and reverse-geocoding design. The SRS takes precedence over it, so it needs no edit. It shows where the old design came from. |

**A second gap DG-30 does not settle (M):** if the citizen moves a GPS position with the buttons, is the result still a **device** position, or does it become **manual** and `location_unverified`? Today the server marks a location unverified only when its source is `manual` or the device says so. A position moved by hand away from the GPS fix is no longer what the GPS measured.

## 3. Proposed replacement wording (for Hassan to approve, change or reject)

Square brackets mark the choices that are Hassan's.

**`FR-PUB.24` — Location capture with accuracy, and a manual fallback**

> **Statement:** The system shall capture the device's GPS position with its reported accuracy and show the latitude, the longitude and the accuracy. The reporter shall be able to adjust the position with directional buttons. On denial or unavailability, the system shall offer a manual position, adjusted with the same buttons, and shall mark the location **`location_unverified`**. The first version uses no map and no address lookup (`DG-30`).
>
> **Acceptance criteria:**
> ```
> Given  location permission is granted
> When   CIT-10 is opened
> Then   the GPS position and its accuracy are captured and shown as latitude, longitude and accuracy
> And    directional buttons move the position, and the screen shows how far and in which direction it was moved
> Given  location permission is denied, or no position can be obtained
> Then   a manual position is offered, starting from [the last known position if the phone has one, otherwise CHOICE E below]
> And    the result is marked location_unverified
> Given  the reporter moves a GPS position with the buttons
> Then   [CHOICE M below]
> And    no map, map tiles or address lookup is used
> ```
>
> **Traces:** Screen `CIT-10` · `expo-location` (the `GET /geo/reverse` trace removed).

**Choice E — where a manual position starts when there is no GPS fix**

| Option | Meaning | Consequence |
|---|---|---|
| E1 | The phone's last known position. If there is none, a configured starting point for the pilot area, set by Hassan | Reporting is never blocked. Needs one coordinate from Hassan (for example, the pilot Union Council's centre). With no map, the result can be far from the issue, and it is marked unverified |
| E2 | The last known position only. With none, the citizen cannot set a location | Simple, but reporting is blocked for a citizen who refuses location on a phone that has never had a fix. This conflicts with `UC-CIT-035`'s "Reporting is not blocked" |
| E3 | The citizen describes the place in words (for example, the nearest landmark) instead of coordinates | Needs a new field in the draft, the contract and the server, since the server requires coordinates today |

**Recommendation (not a decision): E1.** It matches `FR-PUB.24` and `UC-CIT-035` without adding a new field.

**Choice M — a GPS position moved by hand**

| Option | Meaning |
|---|---|
| M1 | Any move with the buttons makes the source `manual`, marked `location_unverified` |
| M2 | A move within the reported GPS accuracy keeps it a device position; a larger move makes it manual and unverified |
| M3 | Keep both: the GPS fix as measured and the adjusted position (a data-model and contract change) |

**Recommendation (not a decision): M1.** It is the simplest, and it never presents an adjusted position as measured.

**Other text, if A–D and F–I are approved:**

| # | Proposed text |
|---|---|
| D | "\| `CIT-10` \| Confirm location \| Place the issue accurately \| GPS position with its accuracy, adjusted with directional buttons; manual position when location is unavailable \| — \|" |
| F | "\| `DEP-04` \| ~~Map tiles for `CIT-10`~~ — none in the first version (`DG-30`); a map provider is a later decision \| `[SRC-STACK §4]` · `DG-30` \|" |
| G | Maps row struck through, with "not used in the first version (`DG-30`)" |
| H | "location.tsx       # CIT-10  GPS position · accuracy · directional buttons · unverified flag" |
| I | "\| `FR-PUB.24` \| `CIT-10` \| — \| `location`, `location_unverified` \| …" |
| J, K | Deliverable "CIT-10 screen: GPS, accuracy and directional buttons (`DG-30`)". Acceptance: "Denied or unavailable GPS still allows a manual position flagged location_unverified [starting as in choice E]; the position is moved by directional buttons; capture time sent and never overwritten" |

The superseded text would be struck through and kept, as in earlier revisions, not deleted.

## 4. What would change if approved

**Requirements and records**

- A new Mobile SRS revision (v2.7.0), with its change record:
  - amends `FR-PUB.24` (statement, acceptance criteria, traces);
  - amends the §4.1.2 `CIT-10` row, `DEP-04` (§2.7), the Maps row (§3.2.1), the folder-structure line (§3.3) and the traceability row (§9.1);
  - resolves `TBD-M18`;
  - could also record `DG-74` (the 3-minute recording limit), which v2.6.0 does not yet carry.
- Register: `DG-73` → Resolved, with the choices made for E and M.
- `T-051` unblocked, with its deliverable and acceptance criteria as in J and K.
- `SOURCE_INDEX`, `SOURCE_REGISTER`, the requirements index, the tracker and the workbook updated.
- The use-case pack is not edited, because the SRS takes precedence.

**Implementation (`T-051`)**

- A new CIT-10 screen using `expo-location` only, foreground permission, explained before Android asks (`FR-COMMON.16`). It:
  - reads the GPS position with its accuracy;
  - shows latitude, longitude and accuracy;
  - offers four directional buttons with a fixed step, showing the distance and direction moved;
  - has a way to read the GPS position again;
  - uses the last known position when there is no fix or no connection;
  - offers a manual position when location is refused, as chosen in E.
- The draft already has the fields: latitude, longitude, accuracy, source and unverified flag. No local database change is needed.
- **No map module, no map tiles and no network call for the location.** `react-native-maps` is not installed, and no new native module is needed (`expo-location` is already in the app).
- **Server:** no change for E1 or E2 with M1 or M2. A configured starting point (E1) lives in the app's settings. E3 or M3 would need contract, server and data-model changes.
- Tests: Jest for each state, and a phone test section in `PHYSICAL_ANDROID_TESTING.md`.

**Nothing else depends on `GET /geo/reverse`.** It was never built. The reporting contract already lists it as not built (`DG-30`).
