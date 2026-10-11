# Tracking

## One source of truth

| File | Role |
|---|---|
| `data/tasks.csv` | **Canonical** task list. Stable IDs `T-nnn`. IDs are never reused or renumbered; gaps are allowed (`T-076` was never assigned) |
| `data/milestones.csv` | Canonical milestones `M0`–`M11` |
| `data/requirements.csv` | Requirement index **derived** from `SRS/Parakh_Mobile_App_SRS_v2.6.0.md` by `scripts/extract_requirements.py`. Do not edit by hand; edit the SRS and re-extract |
| `data/decisions.csv` | Structured index of [`docs/planning/DECISIONS_AND_GAPS.md`](../docs/planning/DECISIONS_AND_GAPS.md). IDs and statuses must match it |
| `data/validation.csv` | Executed and pending checks |
| `Parakh_Project_Tracker.xlsx` | **Generated view.** Readable and editable, but not canonical |
| `../docs/planning/TRACEABILITY.md` | **Generated** requirement → task → use case → screen → API → test matrix |

Git shows meaningful diffs for the CSV files. The workbook is regenerated from them, and its bytes are deterministic for identical data.

## Status vocabulary and transitions

| Status | Meaning | Required |
|---|---|---|
| Not Started | No work begun | — |
| In Progress | Work under way | — |
| Blocked | Cannot proceed | `blocked_reason` naming the exact dependency or decision (`DG-xx`) |
| In Review | Built; waiting for Hassan's review or a check | — |
| Done | Delivered and validated | `evidence_refs` (files, test IDs, commits) **and** `actual_end`. A paragraph is not implementation evidence for code |

Allowed transitions:

| From | To |
|---|---|
| Not Started | In Progress, Blocked |
| In Progress | Blocked, In Review, Done, Not Started |
| Blocked | Not Started, In Progress |
| In Review | In Progress, Done, Blocked |
| Done | In Progress — reopen when a changed assumption means the evidence no longer establishes readiness. Keep the old evidence and say why in `notes` |

## Everyday commands (repository root)

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
```

```bash
.venv/bin/python scripts/generate_tracker.py --check
```

```bash
.venv/bin/python scripts/generate_tracker.py
```

```bash
.venv/bin/python scripts/generate_tracker.py --validate
```

```bash
python3 scripts/extract_requirements.py --check
```

The first command is needed only once.

## Editing in Excel and bringing the edits back

1. In the **Tasks** sheet, edit only: `status`, `owner`, `planned_start`, `planned_end`, `actual_start`, `actual_end`, `blocked_reason`, `evidence_refs`, `notes`. Save the workbook.
2. Preview the import:

   ```bash
   .venv/bin/python scripts/tracker_import.py --dry-run
   ```

3. Import:

   ```bash
   .venv/bin/python scripts/tracker_import.py
   ```

4. Regenerate the workbook:

   ```bash
   .venv/bin/python scripts/generate_tracker.py
   ```

5. Commit `tracking/data/tasks.csv` together with the regenerated workbook.

**Safety rules built into the tools:**

- **Rows match by task ID.** An unknown ID is rejected.
- **Values are validated.** Invalid statuses, disallowed transitions, malformed dates, Blocked without a reason, and Done without evidence or an end date are all rejected.
- **Three-way comparison.** The workbook stores a hidden baseline of the editable fields as they were at generation time. If a field was edited in the workbook **and** also changed in `tasks.csv` since then, it is reported as a **CONFLICT** and not applied. Newer canonical data is never overwritten.
- **Edits are protected.** `generate_tracker.py` **refuses to overwrite** a workbook that holds edits not yet imported. Pass `--discard-workbook-edits` only when you really intend to drop them.
- **Data version.** The workbook records a data version (SHA-256 of the canonical CSVs) in its hidden `_meta` sheet. `--validate` reports a workbook that is stale against the current data.
- **Baseline storage.** The baseline is JSON split across several `_meta` cells (`editable_baseline_parts`, then `editable_baseline_json_1`, `_2`, …). Each part is under Excel's 32,767-character cell limit and starts with `part:`, so no part can be read as a formula. Workbooks written before 2026-10-04 kept the baseline in one `editable_baseline_json` cell and are still read. A baseline that cannot be read stops regeneration rather than discarding edits. Any canonical field longer than one Excel cell is a data error.

## Reading the Overview honestly

- **Task completion %** = Done tasks ÷ all tasks. It is unweighted and is not product readiness.
- **Planning coverage** = requirements with at least one planned task. It is **not** implementation.
- **Application acceptance tests executed: 0** until real tests run.
- **Live recount formulas** are recalculated by your spreadsheet app on open. They were not evaluated where the file was generated.
- **Milestone readiness** is "Complete" only when every MUST task in the milestone is Done and none is blocked.
