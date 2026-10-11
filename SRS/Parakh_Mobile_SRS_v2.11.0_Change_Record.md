# Mobile SRS v2.11.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.10.0** (11 Oct 2026) → **v2.11.0** (11 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** Two requirement statements amended (`FR-PUB.29`, `FR-PUB.30`); identifiers and counts unchanged (124 FR, 86 NFR, 12 SC) |
| Authority | Hassan Jalal's decisions of 11 October 2026 on the pending-submission and Received screens, given in chat |
| Files | New: `Parakh_Mobile_App_SRS_v2.11.0.md`. **v2.10.0 is kept unmodified** (SHA-256 `2bce559f…`) as the superseded baseline |
| Method | 20 exact replacements from v2.10.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 11 October 2026 |
|---|---|
| `DG-84` | **Waiting to send (`CIT-12`): no Edit option.** The screen provides only **Retry** and **Cancel**. The citizen cannot modify the report from the queued/pending-submission state |
| `DG-85` | **Received (`CIT-13`): no expected response time, resolution time or SLA.** For now the screen shows only the confirmation that the report was received successfully, the `PRK-` reference, and the message "You can track its status in My Reports." No other estimated timeframe is added |

## 2. Contradictions

Both decisions change an approved requirement statement. They were reported before the change, and the earlier text is quoted in a dated note under each requirement:

- **`FR-PUB.29`** said the waiting-to-send screen *"shall offer retry, edit and cancel"*. `DG-84` removes edit.
- **`FR-PUB.30`** said the reference is shown *"together with what happens next and the expected timeframe"*. No source ever set a timeframe. `DG-85` removes it and fixes what is shown.

Nothing else conflicts. A pending submission was already not editable in the data: once Submit is pressed the draft leaves `LOCAL_DRAFT` (`DG-65`), and the store refuses edits outside it. The 48-hour retry and deletion rules (`DG-67`) and Cancel's deletion of the temporary server data (`DG-55`) are unchanged.

## 3. Changes, by section

| Section / item | v2.10.0 | v2.11.0 |
|---|---|---|
| Document Control | Version 2.10.0 | Version 2.11.0; status line; change-history row |
| §3 screen table, `CIT-12` | Cancel deletes the temporary server uploads | Plus: Retry and Cancel only, no Edit (`DG-84`) |
| §3 screen table, `CIT-13` | Official reference shown | Plus: received successfully, the reference, "You can track its status in My Reports.", no timeframe or SLA (`DG-85`) |
| §5.2.6 `FR-PUB.29` | retry, edit and cancel | **Only retry and cancel; no edit**; two acceptance criteria and a dated note |
| §5.2.6 `FR-PUB.30` | what happens next and the expected timeframe | **The confirmation and the My Reports message; no timeframe**; three acceptance criteria and a dated note |
| Appendix F | — | **F.0 for v2.11.0** (v2.10.0 becomes F.0.1 … v2.2.0 F.0.9) |

## 4. Records outside the SRS

- **Decision register:** `DG-84` and `DG-85` added, **Resolved**.
- **Requirement index:** the two statements updated (`tracking/data/requirements.csv`).
- **Task `T-062`:** acceptance criteria updated.

## 5. Implementation

`CIT-12` and `CIT-13` are built to these decisions in `T-062`.
