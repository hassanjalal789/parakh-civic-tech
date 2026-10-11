# DG-73 — location data design (E2 + E3, M3)

| Field | Value |
|---|---|
| Date | 2026-10-11 (Asia/Karachi) |
| Decision | Hassan Jalal, 2026-10-11: `DG-73` approved with a combined fallback flow. The order is current GPS, then the last known position, then a written location description, with no pilot-area coordinate. Both the measured GPS position and the citizen-adjusted position are preserved (M3). The flow follows `DG-30`: no map, no map provider, no address lookup, coordinates and accuracy shown, directional buttons |
| Purpose | The analysis he asked for before code changes: every affected field, the migrations, and conflicts with approved requirements |
| Status | The design below is implemented in the same change. The field names and the body shape are **PROPOSED** (a routine technical choice, reversible); the rules they carry are his decision |

## 1. The information to keep, and its names

Names say who produced each value: **`measured_*`** is what the phone measured, and **`reported_*`** is the position the citizen confirms.

| Information | Server field (`ClientSubmission`, `CivicReport`) | Phone field (local `drafts`) | API-130 `location` |
|---|---|---|---|
| Measured latitude, longitude | `measured_latitude`, `measured_longitude` | same names | `measured.latitude`, `measured.longitude` |
| Measured accuracy (metres, as the phone reports it; may be absent) | `measured_accuracy_m` | same | `measured.accuracy_m` |
| Which reading: a current fix, or the phone's last known position | `measured_fix` = `current` \| `last_known` | same | `measured.fix` |
| When the phone measured it (the reading's own time) | `measured_at` | same | `measured.measured_at` |
| The position the citizen confirms | `reported_latitude`, `reported_longitude` | same | `reported.latitude`, `reported.longitude` |
| Written location description (only when no coordinates exist) | `location_description` | same | `description` |
| Source, derived by the server | `location_source` = `gps_current` \| `gps_last_known` \| `adjusted` \| `description` | same | — (in responses) |
| Unverified flag, derived by the server | `location_unverified` | — | — (in responses) |

**Rules (server-enforced):**

- **With coordinates:** `measured` and `reported` are both present, and `description` is absent. `reported` equal to `measured` (to 6 decimal places) means "not adjusted". A different `reported` is **`adjusted`**. The measured values are kept unchanged either way.
- **Without coordinates:** `measured` and `reported` are both absent, and `description` is required. It must not be blank and is at most 500 characters. It is stored exactly as written. The source is `description`, and the screens say plainly that precise GPS coordinates were not available.
- **`location_unverified`** is true for every source except an unadjusted current GPS fix. This applies the existing rule of `FR-PUB.24` ("on denial or unavailability … shall mark the location `location_unverified`") to the last known position. It also covers M3: "an adjusted location must never be represented as though it were the unchanged device-measured GPS position".
- An adjusted position has **no accuracy of its own**. The accuracy belongs to the measurement.

**Beyond the decision's list:**

- **`measured_at`** is the one field that was not named in the decision. Without it, a last known position from hours earlier cannot be told apart from a fresh one. It is the phone's own timestamp for the reading, and it is separate from the report's operative capture time (`captured_at`, `FR-PUB.25`), which is not changed.
- **The 500-character description limit** is a technical safeguard, like the 4,000 characters for typed text. It is reversible and not a product rule.

## 2. Every affected place

| Layer | What changes |
|---|---|
| Phone, local store (`mobile/src/storage/schema.ts`) | Migration 3 **adds** the eight `measured_*`, `reported_*` and `location_description` columns. The store never drops or rewrites a column, so `latitude`, `longitude`, `accuracy_m` and `location_unverified` stay, unused. No version of the app ever wrote them, because `CIT-10` was not built |
| Phone, `DraftRow`, `EDITABLE` (`mobile/src/storage/drafts.ts`) | The new fields. Location is written in one step (`setLocation`), so a partial location never exists |
| Phone, `mobile/src/domain/location.ts` (new) | The location kinds, the derived source and flag (the same rules as the server), and the API-130 `location` body |
| Phone, legacy copy (`mobile/src/storage/legacy/migrate.ts`) | Unchanged: it copies the old columns of the 5 October store, which never held a location |
| API contract (`docs/api/CITIZEN_REPORTING_CONTRACT.md`) | The API-130 `location` object; the draft response; the API-151 report detail; the purge lists |
| Server, `drafts.ClientSubmission` | `latitude`, `longitude` and `location_accuracy_m` renamed to `reported_latitude`, `reported_longitude` and `measured_accuracy_m`. Added: `measured_latitude`, `measured_longitude`, `measured_fix`, `measured_at`, `location_description`. `location_source` widened to 16 characters, with the new values |
| Server, `reports.CivicReport` | The same fields. `reported_*` become nullable. A database check requires either reported coordinates or a written description, so a report always has a location |
| Server, services | API-130 parsing and validation; the editable fields; purge (cancellation, expiry) clears every location field; draft and report serialization; report creation copies every field |
| Server, migrations | `drafts` 0005 and `reports` 0003: renames, additions, and a data step for existing rows (§3) |
| Tests | Backend: the draft payload helper, location tests, hardening sweep, purge test. Phone: schema, location domain, `setLocation` |

## 3. Migrations

- **Server:** the development database holds **no drafts and no reports** (checked read-only, 2026-10-11), so no real data is affected. The data step still maps rows generically and adds nothing that was not recorded:
  - a pre-`DG-73` `device` row: its position becomes both `measured_*` and `reported_*`. Its fix kind and time are unknown, so they stay empty, and the source stays `device`, kept as a legacy value;
  - a `manual` row: the position becomes `reported_*` only, and the source stays `manual`;
  - a purged row: the source becomes empty.
- **Phone:** migration 3 is additive and runs in one transaction with its version record, like migrations 1–2. The T-049 test draft is not affected, because the phone receives this code only after Metro is restarted. That happens after the draft expires at 20:57 PKT.

## 4. Conflicts with approved requirements

### A genuine contradiction — reported, not overridden

**`NFR-28` (MUST):** "The complete report flow shall be achievable by voice and camera alone" (also `FR-PUB.9`: "a reporter can complete a report by voice and camera alone").

- **The case:** no current fix, no last known position (or location permission refused).
- **The conflict:** under `DG-73`, the only way to continue is a **written** description. A citizen who can only speak cannot complete the report.
- **What is done:** the written fallback is built as approved. `NFR-28` is **not** amended. The conflict is opened as **`TBD-M19`** (register **`DG-77`**) for your decision. For example, the description could also be spoken, or the main recording could count as the description.
- **Previous design:** `FR-PUB.24`'s manual pin did not solve this case either. Without a map and without a starting point, it had no position to start from.

### Changed by your decision, recorded as such

- **`FR-PUB.24`:**
  - "manual pin" on denial or unavailability is replaced by the last known position, then the written description;
  - the dragging criterion and `GET /geo/reverse` are removed.
- **`DEP-04`, the Maps row (§3.2.1), the folder-structure line (§3.3), the traceability row (§9.1), the offline table ("place a pin") and the §4.1.2 and §4.2 rows** are amended. The superseded wording is kept and struck through.
- **The use-case pack** (`UC-CIT-033`–`035`) is lower precedence and is not edited.

### Checked, no conflict

| Requirement | Result |
|---|---|
| `BR-009` / §6.4.4: "collect only data required by an approved requirement"; no background location | The measured position (M3), the last known position (E2) and the description (E3) are now approved. The app reads the last known position only in the foreground, with the location permission, so it is not background collection. `measured_at` is the one field added beyond the list (§1) |
| `NFR-58` / `FR-COMMON` logging rule: no precise coordinates in any log | No route logs a request body. The description is free text and is treated like typed text: never logged |
| `FR-PUB.25`: capture time is operative and never overwritten | Unchanged. `measured_at` is a separate field |
| `FR-COMMON.16`: denial leads to the defined fallback, never to a dead end | The written description is the defined fallback |
| §4.3.5 contractor packet: `location` *(required precision only)* | Compatible: a contractor would receive only the reported position, never the measured one. That is for when the portals are built |
| Submission (API-140, `FR-PUB.27`) | A report is possible with a written description and no coordinates, as you required. The database check enforces that a report has one or the other |

## 5. Privacy and security implications to flag

1. **The measured position can reveal where the citizen was.** M3 keeps it even when the citizen moves the position to the issue, so the original fix may be the citizen's home or workplace. Today only the citizen sees their own report. **Who among staff may see the measured position**, and whether it is shown to anyone other than for verification, is not decided. It is opened as **`DG-78`** (Open) for when the staff portals are built. Until then no staff route exists.
2. **The last known position may be old, and from somewhere else.** The phone keeps it from any app's last location request. Storing `measured_at` and marking it unverified keeps that honest. The screen will show its age.
3. **The written description is free text.** It may contain names or addresses. It is purged with the rest of the draft on cancellation or expiry (`DG-55`, `DG-57`), never logged, and stored exactly as written.
4. **No new permission, module or network call.** `expo-location` is already in the app, in the foreground only, and there is no map or address service.
