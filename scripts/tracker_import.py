#!/usr/bin/env python3
"""Import allowed workbook edits back into tracking/data/tasks.csv.

Only these Task fields can be imported:
    status, owner, planned_start, planned_end, actual_start, actual_end,
    blocked_reason, evidence_refs, notes

How conflicts are decided (a three-way comparison per field):
    baseline  = the value when the workbook was generated (hidden _meta sheet)
    workbook  = the value now in the workbook
    canonical = the value now in tasks.csv

    workbook == baseline              -> not edited, nothing to do
    workbook != baseline, canonical == baseline  -> apply the edit (after validation)
    workbook == canonical             -> already applied
    otherwise                         -> CONFLICT: both changed; reported, not applied

Rows with unknown task IDs, invalid statuses, disallowed transitions, malformed dates,
Blocked without a reason, or Done without evidence are rejected. Nothing is written
unless every accepted change validates; use --dry-run to preview.

Usage (repository root, tracker venv):
    python scripts/tracker_import.py --dry-run
    python scripts/tracker_import.py
    python scripts/generate_tracker.py        # regenerate the workbook afterwards
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_tracker as gt  # noqa: E402


def plan_import(workbook: Path, tasks: list[dict]) -> tuple[list[tuple[str, str, str, str]], list[str], list[str]]:
    """Return (changes, conflicts, rejections). changes = (task_id, field, old, new)."""
    rows, meta = gt.read_workbook_tasks(workbook)
    canon = {t["task_id"]: t for t in tasks}
    changes, conflicts, rejected = [], [], []
    for tid, rec in rows.items():
        if tid not in canon:
            rejected.append(f"{tid}: unknown task ID (not in tasks.csv)")
            continue
        base = meta["baseline"].get(tid)
        if base is None:
            rejected.append(f"{tid}: row has no generation baseline; regenerate the workbook first")
            continue
        for f in gt.EDITABLE:
            wv, bv, cv = rec.get(f, ""), base.get(f, ""), canon[tid].get(f, "")
            if wv == bv or wv == cv:
                continue
            if cv != bv:
                conflicts.append(f"{tid}.{f}: workbook '{wv}', canonical changed to '{cv}' since generation (was '{bv}')")
                continue
            changes.append((tid, f, cv, wv))
    # validate the proposed end state of each touched row
    proposed = {tid: dict(canon[tid]) for tid in {c[0] for c in changes}}
    for tid, f, _old, new in changes:
        proposed[tid][f] = new
    bad = set()
    for tid, row in proposed.items():
        old_status, new_status = canon[tid]["status"], row["status"]
        if new_status not in gt.STATUSES:
            rejected.append(f"{tid}: invalid status '{new_status}' (allowed: {', '.join(gt.STATUSES)})"); bad.add(tid)
        elif new_status != old_status and new_status not in gt.TRANSITIONS[old_status]:
            rejected.append(f"{tid}: transition {old_status} -> {new_status} is not allowed"); bad.add(tid)
        if new_status == "Blocked" and not row["blocked_reason"].strip():
            rejected.append(f"{tid}: Blocked requires blocked_reason"); bad.add(tid)
        if new_status == "Done" and not row["evidence_refs"].strip():
            rejected.append(f"{tid}: Done requires evidence_refs"); bad.add(tid)
        if new_status == "Done" and not row["actual_end"]:
            rejected.append(f"{tid}: Done requires actual_end"); bad.add(tid)
        for f in gt.DATE_FIELDS:
            if row[f] and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", row[f]):
                rejected.append(f"{tid}: {f} '{row[f]}' is not a date"); bad.add(tid)
    changes = [c for c in changes if c[0] not in bad]
    return changes, conflicts, rejected


def apply(data_dir: Path, workbook: Path, dry_run: bool = False) -> int:
    tasks_path = data_dir / "tasks.csv"
    tasks = gt.read_csv(tasks_path)
    fields = list(tasks[0].keys())
    changes, conflicts, rejected = plan_import(workbook, tasks)
    for c in conflicts:
        print("CONFLICT:", c)
    for r in rejected:
        print("REJECTED:", r)
    for tid, f, old, new in changes:
        print(f"{'WOULD APPLY' if dry_run else 'APPLY'}: {tid}.{f}: '{old}' -> '{new}'")
    if not changes:
        print("No importable changes.")
    if dry_run or not changes:
        return 1 if (conflicts or rejected) else 0
    by_id = {t["task_id"]: t for t in tasks}
    for tid, f, _old, new in changes:
        by_id[tid][f] = new
    gt.write_csv(tasks_path, tasks, fields)
    d = gt.load(data_dir)
    errors, _ = gt.validate(d, decisions_md=None)
    if errors:  # should not happen; restore is via git
        print("ERROR after import (restore with `git checkout tracking/data/tasks.csv`):", *errors, sep="\n  ")
        return 1
    print(f"Imported {len(changes)} change(s) into {tasks_path}. Regenerate the workbook next.")
    return 1 if (conflicts or rejected) else 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Import allowed workbook edits into tasks.csv")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workbook", type=Path, default=gt.WORKBOOK)
    args = ap.parse_args(argv)
    if not args.workbook.exists():
        print("Workbook not found:", args.workbook)
        return 1
    return apply(gt.DATA, args.workbook, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
