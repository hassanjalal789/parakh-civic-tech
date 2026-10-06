#!/usr/bin/env python3
"""Generate and validate the Parakh project tracker from canonical CSV data.

Canonical data (version-controlled, the only source of truth):
    tracking/data/tasks.csv, milestones.csv, requirements.csv,
    decisions.csv, validation.csv
Generated views (never edit by hand except the allowed workbook fields):
    tracking/Parakh_Project_Tracker.xlsx
    docs/planning/TRACEABILITY.md

Usage (from the repository root, inside the tracker virtual environment):
    python scripts/generate_tracker.py              # validate data, write workbook + traceability
    python scripts/generate_tracker.py --check      # validate canonical data only
    python scripts/generate_tracker.py --validate   # reopen the saved workbook and check it
    python scripts/generate_tracker.py --discard-workbook-edits   # overwrite un-imported edits (explicit)

Workbook edits to allowed fields are brought back with scripts/tracker_import.py.
See tracking/README.md.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "tracking" / "data"
WORKBOOK = ROOT / "tracking" / "Parakh_Project_Tracker.xlsx"
TRACE = ROOT / "docs" / "planning" / "TRACEABILITY.md"
DECISIONS_MD = ROOT / "docs" / "planning" / "DECISIONS_AND_GAPS.md"

DATA_FILES = ["tasks.csv", "milestones.csv", "requirements.csv", "decisions.csv", "validation.csv"]
STATUSES = ["Not Started", "In Progress", "Blocked", "In Review", "Done"]
TRANSITIONS = {  # allowed status changes (same status is always allowed)
    "Not Started": {"In Progress", "Blocked"},
    "In Progress": {"Blocked", "In Review", "Done", "Not Started"},
    "Blocked": {"Not Started", "In Progress"},
    "In Review": {"In Progress", "Done", "Blocked"},
    "Done": {"In Progress"},  # reopen when evidence no longer establishes readiness
}
VALIDATION_RESULTS = ["Passed", "Failed", "Not Run", "Blocked"]
# Excel stores at most 32,767 characters in one cell. The editable-field baseline is
# split across several _meta cells below that limit; each part carries a prefix so
# that no part can begin with "=" and be read as a formula.
EXCEL_CELL_LIMIT = 32767
META_PART_CHARS = 30000
META_PART_PREFIX = "part:"
DECISION_STATUSES = ["Open", "Proposed", "Interim", "Partly resolved", "Resolved", "Resolved by override", "Deferred"]
PRIORITIES = ["MUST", "SHOULD", "COULD"]
EDITABLE = ["status", "owner", "planned_start", "planned_end", "actual_start", "actual_end",
            "blocked_reason", "evidence_refs", "notes"]
DATE_FIELDS = ["planned_start", "planned_end", "actual_start", "actual_end"]
RETIRED_SCREENS = {"REP-05": "retired at rev 1.3, replaced by STF-10", "STF-11": "PROPOSED, not approved (DG-21)"}
SCREEN_RE = re.compile(r"\b(?:CIT|STF|REP|UCO|CON|MAY)-\d{2}\b")
FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)  # deterministic workbook bytes


class DataError(Exception):
    pass


# --------------------------------------------------------------------------- loading
def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in fields})
    path.write_text(buf.getvalue(), encoding="utf-8")


def load(data_dir: Path = DATA) -> dict[str, list[dict[str, str]]]:
    return {name[:-4]: read_csv(data_dir / name) for name in DATA_FILES}


def data_hash(data_dir: Path = DATA) -> str:
    h = hashlib.sha256()
    for name in DATA_FILES:
        h.update(name.encode())
        h.update((data_dir / name).read_bytes())
    return h.hexdigest()


def split(value: str) -> list[str]:
    return [v.strip() for v in value.split(";") if v.strip()] if value else []


# --------------------------------------------------------------------------- validation
def validate(d: dict, decisions_md: Path | None = DECISIONS_MD) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors make the data unusable; warnings are reported."""
    errors: list[str] = []
    warnings: list[str] = []
    tasks, ms, reqs, decs, vals = d["tasks"], d["milestones"], d["requirements"], d["decisions"], d["validation"]

    for label, rows in (("tasks", tasks), ("milestones", ms), ("requirements", reqs), ("decisions", decs),
                        ("validation", vals)):
        for r in rows:
            for field, value in r.items():
                if value and len(value) > EXCEL_CELL_LIMIT:
                    errors.append(f"{label}: {field} is longer than one Excel cell holds ({len(value)} characters)")

    def dupes(rows, key, label):
        c = Counter(r[key] for r in rows)
        for k, n in c.items():
            if n > 1:
                errors.append(f"duplicate {label} ID {k} ({n} rows)")

    dupes(tasks, "task_id", "task")
    dupes(ms, "milestone_id", "milestone")
    dupes(reqs, "req_id", "requirement")
    dupes(decs, "dg_id", "decision")
    dupes(vals, "validation_id", "validation")

    task_ids = {t["task_id"] for t in tasks}
    ms_ids = {m["milestone_id"] for m in ms}
    req_ids = {r["req_id"] for r in reqs}
    dg_ids = {x["dg_id"] for x in decs}

    for t in tasks:
        tid = t["task_id"]
        if not re.fullmatch(r"T-\d{3}", tid):
            errors.append(f"{tid}: task ID format must be T-nnn")
        if t["status"] not in STATUSES:
            errors.append(f"{tid}: invalid status '{t['status']}'")
        if t["priority"] not in PRIORITIES:
            errors.append(f"{tid}: invalid priority '{t['priority']}'")
        if t["milestone_id"] not in ms_ids:
            errors.append(f"{tid}: unknown milestone {t['milestone_id']}")
        if t["status"] == "Blocked" and not t["blocked_reason"].strip():
            errors.append(f"{tid}: Blocked requires blocked_reason")
        if t["status"] == "Done" and not t["evidence_refs"].strip():
            errors.append(f"{tid}: Done requires evidence_refs")
        if t["status"] == "Done" and not t["actual_end"]:
            errors.append(f"{tid}: Done requires actual_end")
        for dep in split(t["dependencies"]):
            if dep not in task_ids:
                errors.append(f"{tid}: unknown dependency {dep}")
            if dep == tid:
                errors.append(f"{tid}: depends on itself")
        for ref in split(t["requirement_refs"]):
            if ref not in req_ids:
                errors.append(f"{tid}: unknown requirement {ref}")
        for ref in split(t["decision_blockers"]):
            if ref not in dg_ids:
                errors.append(f"{tid}: unknown decision {ref}")
        for f in DATE_FIELDS:
            if t[f] and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", t[f]):
                errors.append(f"{tid}: {f} must be YYYY-MM-DD, got '{t[f]}'")
        if t["planned_start"] and t["planned_end"] and t["planned_end"] < t["planned_start"]:
            errors.append(f"{tid}: planned_end before planned_start")
        for field in ("screen_refs", "title", "deliverable", "acceptance_criteria"):
            for sid in SCREEN_RE.findall(t[field]):
                if sid in RETIRED_SCREENS and "PROPOSED" not in t[field] and sid != "STF-11":
                    errors.append(f"{tid}: references retired screen {sid} ({RETIRED_SCREENS[sid]})")
        for sid in split(t["screen_refs"]):
            if sid in RETIRED_SCREENS:
                errors.append(f"{tid}: screen_refs lists {sid} ({RETIRED_SCREENS[sid]})")
        for f in ("purpose", "deliverable", "acceptance_criteria", "owner", "effort_hours"):
            if not t[f].strip():
                errors.append(f"{tid}: missing {f}")

    # dependency cycles
    graph = {t["task_id"]: [x for x in split(t["dependencies"]) if x in task_ids] for t in tasks}
    state: dict[str, int] = {}

    def visit(n, stack):
        state[n] = 1
        for m in graph[n]:
            if state.get(m) == 1:
                errors.append("dependency cycle: " + " -> ".join(stack + [n, m]))
            elif state.get(m) is None:
                visit(m, stack + [n])
        state[n] = 2

    for n in graph:
        if state.get(n) is None:
            visit(n, [])

    # Done tasks must not depend on unfinished work
    status_of = {t["task_id"]: t["status"] for t in tasks}
    for t in tasks:
        if t["status"] == "Done":
            for dep in split(t["dependencies"]):
                if status_of.get(dep) != "Done":
                    errors.append(f"{t['task_id']}: Done but dependency {dep} is {status_of.get(dep)}")

    # Application work (milestones M2-M11) may be Done only with executed evidence:
    # its evidence_refs must cite at least one validation row whose result is Passed.
    passed = {v["validation_id"] for v in vals if v["result"] == "Passed"}
    for t in tasks:
        if t["status"] == "Done" and t["milestone_id"] not in ("M0", "M1"):
            cited = set(re.findall(r"VAL-\d{3}", t["evidence_refs"]))
            if not cited & passed:
                errors.append(f"{t['task_id']}: Done application task must cite a Passed validation (VAL-nnn) in evidence_refs")

    for m in ms:
        for dep in split(m["depends_on"]):
            if dep not in ms_ids:
                errors.append(f"{m['milestone_id']}: unknown milestone dependency {dep}")

    for x in decs:
        if x["status"] not in DECISION_STATUSES:
            errors.append(f"{x['dg_id']}: invalid decision status '{x['status']}'")
        for ref in split(x["affected_tasks"]):
            if ref not in task_ids and ref != "—":
                errors.append(f"{x['dg_id']}: unknown affected task {ref}")

    for v in vals:
        if v["result"] not in VALIDATION_RESULTS:
            errors.append(f"{v['validation_id']}: invalid result '{v['result']}'")
        if v["task_id"] not in task_ids:
            errors.append(f"{v['validation_id']}: unknown task {v['task_id']}")
        if v["result"] in ("Passed", "Failed") and not v["date"]:
            errors.append(f"{v['validation_id']}: executed check needs a date")

    covered = {ref for t in tasks for ref in split(t["requirement_refs"])}
    uncovered = sorted(req_ids - covered, key=natural)
    if uncovered:
        warnings.append(f"{len(uncovered)} requirements have no planned task: " + ", ".join(uncovered))

    if decisions_md is not None and decisions_md.exists():
        md_rows = {}
        for line in decisions_md.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\| (DG-\d{2}) \| .* \| (\w+) \| ([^|]+?) \| [^|]+ \| [^|]* \|$", line)
            if m:
                md_rows.setdefault(m.group(1), m.group(3).strip())
        csv_rows = {x["dg_id"]: x["status"] for x in decs}
        for k in sorted(set(md_rows) | set(csv_rows)):
            if k not in md_rows:
                errors.append(f"{k}: in decisions.csv but not in DECISIONS_AND_GAPS.md summary table")
            elif k not in csv_rows:
                errors.append(f"{k}: in DECISIONS_AND_GAPS.md but not in decisions.csv")
            elif md_rows[k] != csv_rows[k]:
                errors.append(f"{k}: status differs (md '{md_rows[k]}' vs csv '{csv_rows[k]}')")
    return errors, warnings


def natural(s: str):
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", s)]


# --------------------------------------------------------------------------- metrics
def metrics(d: dict) -> dict:
    tasks, reqs, vals, decs = d["tasks"], d["requirements"], d["validation"], d["decisions"]
    by_status = Counter(t["status"] for t in tasks)
    total = len(tasks)
    covered = defaultdict(list)
    for t in tasks:
        for r in split(t["requirement_refs"]):
            covered[r].append(t["task_id"])
    done_ids = {t["task_id"] for t in tasks if t["status"] == "Done"}
    reqs_with_done = [r for r in reqs if any(tid in done_ids for tid in covered.get(r["req_id"], []))]
    milestone_rows = []
    for m in d["milestones"]:
        mt = [t for t in tasks if t["milestone_id"] == m["milestone_id"]]
        must = [t for t in mt if t["priority"] == "MUST"]
        open_dec = sorted({dg for t in mt for dg in split(t["decision_blockers"])
                           if any(x["dg_id"] == dg and x["status"] not in ("Resolved", "Resolved by override")
                                  for x in decs)}, key=natural)
        must_done = sum(1 for t in must if t["status"] == "Done")
        blocked = sum(1 for t in mt if t["status"] == "Blocked")
        if mt and must_done == len(must) and not blocked:
            readiness = "Complete (all MUST tasks Done, none blocked)"
        else:
            readiness = f"Not complete — {len(must) - must_done} MUST task(s) not Done, {blocked} blocked"
        milestone_rows.append(dict(m, tasks=len(mt), done=sum(1 for t in mt if t["status"] == "Done"),
                                   must=len(must), must_done=must_done, blocked=blocked,
                                   open_decisions=";".join(open_dec), readiness=readiness))
    app_tests_specified = sum(len(split(r["srs_tests"])) for r in reqs)
    return dict(
        total=total, by_status=by_status, done=by_status.get("Done", 0), blocked=by_status.get("Blocked", 0),
        pct_done=(by_status.get("Done", 0) / total * 100) if total else 0.0,
        req_total=len(reqs), req_covered=sum(1 for r in reqs if covered.get(r["req_id"])),
        req_with_done=len(reqs_with_done), covered=covered,
        val_by_result=Counter(v["result"] for v in vals), val_total=len(vals),
        app_tests_specified=app_tests_specified,
        dec_open=sum(1 for x in decs if x["status"] not in ("Resolved", "Resolved by override")),
        dec_total=len(decs), milestones=milestone_rows,
    )


# --------------------------------------------------------------------------- workbook
def editable_snapshot(tasks: list[dict]) -> dict[str, dict[str, str]]:
    return {t["task_id"]: {f: t[f] for f in EDITABLE} for t in tasks}


def cell_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return str(v).strip()


def read_workbook_tasks(path: Path) -> tuple[dict[str, dict[str, str]], dict]:
    """Return (task rows keyed by ID with editable fields as text, metadata)."""
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=False)
    meta_ws = wb["_meta"]
    meta = {}
    for row in meta_ws.iter_rows(min_row=1, values_only=True):
        if row and row[0]:
            meta[row[0]] = row[1]
    if meta.get("editable_baseline_parts"):
        count = int(meta["editable_baseline_parts"])
        raw = "".join(str(meta.get(f"editable_baseline_json_{i}") or "").removeprefix(META_PART_PREFIX)
                      for i in range(1, count + 1))
    else:  # a workbook written before the baseline was split
        raw = meta.get("editable_baseline_json") or ""
    try:
        baseline = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"{path.name}: the saved editable-field baseline cannot be read (it may have been cut off). "
            "Restore the workbook from Git, or regenerate with --discard-workbook-edits"
        ) from exc
    ws = wb["Tasks"]
    header = [cell_text(c.value) for c in ws[2]]
    rows = {}
    for r in ws.iter_rows(min_row=3, values_only=True):
        rec = {header[i]: cell_text(v) for i, v in enumerate(r) if i < len(header) and header[i]}
        if rec.get("task_id"):
            rows[rec["task_id"]] = rec
    return rows, {"data_hash": meta.get("data_hash"), "baseline": baseline}


def pending_workbook_edits(path: Path, tasks: list[dict]) -> list[str]:
    """Edits in the saved workbook that canonical data does not yet contain."""
    if not path.exists():
        return []
    rows, meta = read_workbook_tasks(path)
    canon = editable_snapshot(tasks)
    pending = []
    for tid, rec in rows.items():
        base = meta["baseline"].get(tid)
        if base is None:
            continue
        for f in EDITABLE:
            wv, bv, cv = rec.get(f, ""), base.get(f, ""), canon.get(tid, {}).get(f, "")
            if wv != bv and wv != cv:
                pending.append(f"{tid}.{f}: workbook '{wv}' (canonical '{cv}')")
    return pending


def build_workbook(d: dict, path: Path, dhash: str) -> None:
    from openpyxl import Workbook
    from openpyxl.formatting.rule import CellIsRule
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    m = metrics(d)
    wb = Workbook()
    head_font = Font(bold=True, color="FFFFFF")
    head_fill = PatternFill("solid", fgColor="1F4E5A")
    note_font = Font(italic=True, color="404040")
    wrap = Alignment(wrap_text=True, vertical="top")

    def table(ws, note, headers, rows, widths, text_cols=(), date_cols=()):
        ws.cell(row=1, column=1, value=note).font = note_font
        ws.cell(row=1, column=1).alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=min(len(headers), 8))
        ws.row_dimensions[1].height = 48
        for c, h in enumerate(headers, 1):
            cell = ws.cell(row=2, column=c, value=h)
            cell.font, cell.fill, cell.alignment = head_font, head_fill, Alignment(wrap_text=True, vertical="center")
        for r_i, row in enumerate(rows, 3):
            for c, h in enumerate(headers, 1):
                v = row.get(h, "")
                if h in date_cols and v:
                    v = dt.date.fromisoformat(v)
                cell = ws.cell(row=r_i, column=c, value=v)
                cell.alignment = wrap
                if h in date_cols and v:
                    cell.number_format = "yyyy-mm-dd"
                elif h in text_cols or isinstance(v, str):
                    cell.number_format = "@"
        for c, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(c)].width = w
        ws.freeze_panes = "B3"
        last = get_column_letter(len(headers))
        ws.auto_filter.ref = f"A2:{last}{max(2, len(rows) + 2)}"
        return len(rows) + 2

    # Overview -------------------------------------------------------------
    ov = wb.active
    ov.title = "Overview"
    ov.column_dimensions["A"].width = 58
    ov.column_dimensions["B"].width = 22
    ov.column_dimensions["C"].width = 70
    lines = [
        ("Parakh Project Tracker", "", ""),
        ("Generated view of tracking/data/*.csv. Canonical data lives in Git; edit only the allowed Task fields here and import them with scripts/tracker_import.py.", "", ""),
        ("Data version (SHA-256 of canonical CSVs)", dhash[:16], "Full hash in the hidden _meta sheet"),
        ("", "", ""),
        ("TASKS (static values computed from canonical rows)", "Count", "Definition"),
        ("Total tasks", m["total"], "Every row in tasks.csv. No task is cancelled or archived."),
    ]
    for s in STATUSES:
        lines.append((f"Tasks — {s}", m["by_status"].get(s, 0), ""))
    lines += [
        ("Task completion %", round(m["pct_done"], 1),
         "Done tasks ÷ total tasks × 100. Unweighted. Not a measure of product readiness; acceptance evidence is."),
        ("", "", ""),
        ("REQUIREMENTS", "Count", "Definition"),
        ("Requirements in baseline (FR + NFR + SC)", m["req_total"], "From the Mobile SRS v2.3.0 via scripts/extract_requirements.py"),
        ("Requirements with ≥1 planned task (planning coverage)", m["req_covered"],
         "PLANNING coverage only. It does not mean anything is built."),
        ("Requirements with ≥1 Done task", m["req_with_done"],
         "Done tasks so far are setup tasks; this is not implementation evidence for the requirement."),
        ("", "", ""),
        ("TESTS AND CHECKS", "Count", "Definition"),
        ("Validation checks recorded", m["val_total"], "Rows in validation.csv"),
    ]
    for r in VALIDATION_RESULTS:
        lines.append((f"Checks — {r}", m["val_by_result"].get(r, 0), ""))
    lines += [
        ("Application acceptance tests specified (SRS trace references)", m["app_tests_specified"],
         "AT-*/TEST-* references in the SRS §9.1 matrix. Specified only."),
        ("Application acceptance tests executed", 0,
         "No application code exists yet; no acceptance test has been run."),
        ("", "", ""),
        ("DECISIONS", "Count", "Definition"),
        ("Decision/gap items", m["dec_total"], "DECISIONS_AND_GAPS.md"),
        ("Not yet resolved", m["dec_open"], "Status other than Resolved / Resolved by override"),
        ("", "", ""),
        ("LIVE RECOUNT (formulas)", "Formula", "Written as formulas and recalculated by your spreadsheet application on open. NOT evaluated or verified in the environment that generated this file."),
    ]
    start_formula_row = len(lines) + 1
    for s in STATUSES:
        lines.append((f"Live count — {s}", f'=COUNTIF(Tasks!$Q$3:$Q${m["total"] + 2},"{s}")', ""))
    lines += [
        ("", "", ""),
        ("SHEETS", "", ""),
        ("Tasks", "", "One row per task. Allowed edits: status, owner, dates, blocked_reason, evidence_refs, notes."),
        ("Milestones", "", "Readiness depends on MUST tasks and blockers, not on an average percentage."),
        ("Requirements", "", "Requirement baseline with the tasks that plan for each one."),
        ("Decisions and Risks", "", "Decision register index; Hassan owns every product decision."),
        ("Validation", "", "Executed and pending checks with result Passed / Failed / Not Run / Blocked."),
    ]
    for i, (a, b, c) in enumerate(lines, 1):
        ov.cell(row=i, column=1, value=a)
        cb = ov.cell(row=i, column=2, value=b)
        ov.cell(row=i, column=3, value=c).alignment = wrap
        if isinstance(b, str) and not b.startswith("="):
            cb.number_format = "@"
        if a.isupper() or i == 1:
            ov.cell(row=i, column=1).font = Font(bold=True, size=14 if i == 1 else 11)
    ov.freeze_panes = "A2"

    # Tasks ----------------------------------------------------------------
    ts = wb.create_sheet("Tasks")
    t_fields = list(d["tasks"][0].keys())
    widths = {"task_id": 9, "title": 42, "milestone_id": 8, "phase": 8, "module": 14, "portal": 12, "purpose": 40,
              "deliverable": 40, "requirement_refs": 28, "use_case_refs": 22, "screen_refs": 16, "api_refs": 18,
              "dependencies": 16, "priority": 9, "owner": 16, "effort_hours": 9, "status": 13, "blocked_reason": 30,
              "decision_blockers": 16, "acceptance_criteria": 50, "test_refs": 18, "evidence_refs": 30,
              "planned_start": 12, "planned_end": 12, "actual_start": 12, "actual_end": 12, "notes": 36}
    assert t_fields.index("status") == 16, "status must stay in column Q (formulas reference it)"
    n = table(ts, "Tasks — one row per stable task ID. Allowed edits: status, owner, planned/actual dates, blocked_reason, evidence_refs, notes. Then run scripts/tracker_import.py.",
              t_fields, d["tasks"], [widths.get(f, 14) for f in t_fields], date_cols=DATE_FIELDS)
    dv = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=False)
    ts.add_data_validation(dv)
    dv.add(f"Q3:Q{n}")
    fills = {"Done": "E2F0D9", "Blocked": "F8D7DA", "In Progress": "FFF3CD", "In Review": "DDEBF7"}
    for s, color in fills.items():
        ts.conditional_formatting.add(f"Q3:Q{n}", CellIsRule(operator="equal", formula=[f'"{s}"'],
                                                             fill=PatternFill("solid", fgColor=color)))

    # Milestones -----------------------------------------------------------
    msw = wb.create_sheet("Milestones")
    mf = ["milestone_id", "name", "phase", "outcome", "entry_conditions", "exit_criteria", "evidence", "depends_on",
          "target_start", "target_end", "historical_target", "tasks", "done", "must", "must_done", "blocked",
          "open_decisions", "readiness", "notes"]
    mrows = [{k: (str(v) if isinstance(v, int) else v) for k, v in r.items()} for r in m["milestones"]]
    table(msw, "Milestones — readiness is 'Complete' only when every MUST task is Done and none is blocked. Target dates are planning targets; historical targets are preserved, not met.",
          mf, mrows, [8, 34, 8, 44, 30, 40, 30, 10, 12, 12, 22, 7, 7, 7, 9, 8, 22, 36, 30],
          date_cols=["target_start", "target_end"])

    # Requirements ---------------------------------------------------------
    rq = wb.create_sheet("Requirements")
    rf = ["req_id", "kind", "module", "title", "statement", "priority", "phase", "planned_tasks", "screens", "apis",
          "srs_tests", "legacy_ids", "source_doc", "source_ref"]
    rrows = [dict(r, planned_tasks=";".join(m["covered"].get(r["req_id"], []))) for r in d["requirements"]]
    table(rq, "Requirements — Mobile SRS v2.3.0 baseline (FR, NFR, SC). 'planned_tasks' is planning coverage, not implementation evidence.",
          rf, rrows, [13, 6, 14, 40, 60, 9, 6, 20, 16, 16, 22, 24, 22, 30])

    # Decisions ------------------------------------------------------------
    dsh = wb.create_sheet("Decisions and Risks")
    df = list(d["decisions"][0].keys())
    table(dsh, "Decisions and gaps — primary narrative in docs/planning/DECISIONS_AND_GAPS.md. Hassan Jalal owns product decisions; no PROPOSED item is approved by appearing here. SRS risks R-01…R-23 are in the SRS §11.2.",
          df, d["decisions"], [8, 46, 12, 8, 14, 18, 40, 36, 52, 18, 10, 12, 36])

    # Validation -----------------------------------------------------------
    vs = wb.create_sheet("Validation")
    vf = list(d["validation"][0].keys())
    table(vs, "Validation — executed and pending checks. 'Passed' means the recorded command passed in the recorded environment; it is not evidence of any other claim.",
          vf, d["validation"], [9, 8, 40, 46, 30, 9, 11, 40, 40], date_cols=["date"])

    # _meta (hidden) -------------------------------------------------------
    meta = wb.create_sheet("_meta")
    meta.append(["data_hash", dhash])
    meta.append(["generator", "scripts/generate_tracker.py"])
    meta.append(["editable_fields", ",".join(EDITABLE)])
    baseline = json.dumps(editable_snapshot(d["tasks"]), sort_keys=True)
    parts = [baseline[i:i + META_PART_CHARS] for i in range(0, len(baseline), META_PART_CHARS)] or [""]
    meta.append(["editable_baseline_parts", len(parts)])
    for i, part in enumerate(parts, 1):
        meta.append([f"editable_baseline_json_{i}", META_PART_PREFIX + part])
    meta.sheet_state = "hidden"

    fixed = dt.datetime(*FIXED_ZIP_TIME)
    wb.properties.creator = "scripts/generate_tracker.py"
    wb.properties.lastModifiedBy = "scripts/generate_tracker.py"
    wb.properties.created = fixed
    wb.properties.modified = fixed
    wb.calculation.fullCalcOnLoad = True
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.xlsx")
    wb.save(tmp)
    normalize_zip(tmp, path)
    tmp.unlink()


def normalize_zip(src: Path, dst: Path) -> None:
    """Rewrite the xlsx with fixed entry timestamps so identical data gives identical bytes."""
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in sorted(zin.infolist(), key=lambda i: i.filename):
            data = zin.read(info.filename)
            if info.filename == "docProps/core.xml":
                data = re.sub(rb"<dcterms:modified[^>]*>[^<]*</dcterms:modified>",
                              b'<dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>', data)
            zi = zipfile.ZipInfo(info.filename, date_time=FIXED_ZIP_TIME)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zi, data)


# --------------------------------------------------------------------------- workbook validation
def validate_workbook(path: Path, d: dict, dhash: str) -> list[str]:
    from openpyxl import load_workbook
    problems = []
    wb = load_workbook(path)
    required = ["Overview", "Tasks", "Milestones", "Requirements", "Decisions and Risks", "Validation"]
    for s in required:
        if s not in wb.sheetnames:
            problems.append(f"missing sheet {s}")
    if problems:
        return problems
    try:
        rows, meta = read_workbook_tasks(path)
    except ValueError as exc:
        return [str(exc)]
    if meta["data_hash"] != dhash:
        problems.append(f"workbook data hash {str(meta['data_hash'])[:16]} != canonical {dhash[:16]} (regenerate or import)")
    canon_ids = [t["task_id"] for t in d["tasks"]]
    if sorted(rows) != sorted(canon_ids):
        problems.append(f"task IDs differ: workbook {len(rows)} vs canonical {len(canon_ids)}")
    for tid, rec in rows.items():
        if rec.get("status") not in STATUSES:
            problems.append(f"{tid}: invalid status in workbook '{rec.get('status')}'")
    ws = wb["Tasks"]
    header = [c.value for c in ws[2]]
    for f in DATE_FIELDS:
        col = header.index(f) + 1
        for r in range(3, ws.max_row + 1):
            v = ws.cell(row=r, column=col).value
            if v not in (None, "") and not isinstance(v, (dt.date, dt.datetime)):
                problems.append(f"Tasks!{f} row {r}: not a date cell ({v!r})")
    id_col = header.index("task_id") + 1
    for r in range(3, ws.max_row + 1):
        c = ws.cell(row=r, column=id_col)
        if c.value and c.number_format != "@":
            problems.append(f"Tasks!A{r}: ID not stored as text")
    deps_col = header.index("dependencies") + 1
    ids = set(rows)
    for r in range(3, ws.max_row + 1):
        for dep in split(cell_text(ws.cell(row=r, column=deps_col).value)):
            if dep not in ids:
                problems.append(f"Tasks row {r}: dependency {dep} not in workbook")
    expected_counts = {"Milestones": len(d["milestones"]), "Requirements": len(d["requirements"]),
                       "Decisions and Risks": len(d["decisions"]), "Validation": len(d["validation"])}
    for s, nrows in expected_counts.items():
        got = wb[s].max_row - 2
        if got != nrows:
            problems.append(f"{s}: {got} rows, canonical {nrows}")
    ov = wb["Overview"]
    m = metrics(d)
    found = {ov.cell(row=r, column=1).value: ov.cell(row=r, column=2).value for r in range(1, ov.max_row + 1)}
    if found.get("Total tasks") != m["total"]:
        problems.append("Overview total tasks mismatch")
    if found.get("Tasks — Done") != m["done"]:
        problems.append("Overview Done count mismatch")
    for s in STATUSES:
        f = found.get(f"Live count — {s}")
        if not (isinstance(f, str) and f == f'=COUNTIF(Tasks!$Q$3:$Q${m["total"] + 2},"{s}")'):
            problems.append(f"Overview formula for {s} has unexpected range: {f!r}")
    if not wb.calculation.fullCalcOnLoad:
        problems.append("fullCalcOnLoad not set")
    return problems


# --------------------------------------------------------------------------- traceability
def build_traceability(d: dict, path: Path, dhash: str) -> None:
    m = metrics(d)
    tasks = {t["task_id"]: t for t in d["tasks"]}
    lines = [
        "# Traceability Matrix",
        "",
        "> **Generated by `scripts/generate_tracker.py`. Do not edit by hand.** Edit `tracking/data/*.csv` and regenerate.",
        f"> Data version `{dhash[:16]}`.",
        "",
        "## How to read this",
        "",
        "- **Planning coverage is not completion.** A requirement row with a task means work is planned, not that anything is built.",
        "- **Task status** shows each planned task's current status. Only setup tasks are Done.",
        "- **Use cases** come from the tasks that plan the requirement. Use-case pack test IDs, where cited, are prefixed `UCP:` (`DG-08`).",
        "- **SRS tests** are the `AT-*`/`TEST-*` IDs from SRS §9.1. **All are specified; none has been executed.**",
        "- Missing contracts: no `API_CONTRACT v3.0` is available (`DG-05`). API IDs below are the SRS's own; unnumbered routes are named by path in the PROPOSED contract (`T-036`, `DG-43`).",
        "",
        "## Summary",
        "",
        "| Measure | Value |",
        "|---|---|",
        f"| Requirements (FR + NFR + SC) | {m['req_total']} |",
        f"| With at least one planned task | {m['req_covered']} |",
        f"| Without a planned task | {m['req_total'] - m['req_covered']} |",
        f"| Tasks | {m['total']} ({m['done']} Done, {m['blocked']} Blocked) |",
        f"| Application acceptance tests executed | 0 |",
        "",
    ]
    uncovered = [r["req_id"] for r in d["requirements"] if not m["covered"].get(r["req_id"])]
    if uncovered:
        lines += ["### Requirements without a planned task", "", ", ".join(uncovered), ""]
    for kind, label in (("FR", "Functional requirements"), ("NFR", "Non-functional requirements"),
                        ("SC", "Unified-bundle security controls (conditions of DR-26)")):
        lines += [f"## {label}", "",
                  "| Requirement | Ph | Pri | Title | Planned tasks (status) | Use cases | Screens | APIs | SRS tests |",
                  "|---|---|---|---|---|---|---|---|---|"]
        for r in d["requirements"]:
            if r["kind"] != kind:
                continue
            tids = m["covered"].get(r["req_id"], [])
            tstat = "<br>".join(f"{tid} ({tasks[tid]['status']})" for tid in tids) or "**none**"
            ucs = sorted({u for tid in tids for u in split(tasks[tid]["use_case_refs"])}, key=natural)
            screens = r["screens"] or ";".join(sorted({s for tid in tids for s in split(tasks[tid]["screen_refs"])}))
            apis = r["apis"] or ";".join(sorted({a for tid in tids for a in split(tasks[tid]["api_refs"])}))
            title = r["title"].replace("|", "\\|")
            lines.append(f"| `{r['req_id']}` | {r['phase']} | {r['priority']} | {title} | {tstat} | "
                         f"{', '.join(ucs) or '—'} | {screens.replace(';', ', ') or '—'} | {apis.replace(';', ', ') or '—'} | "
                         f"{r['srs_tests'].replace(';', ', ') or '—'} |")
        lines.append("")
    lines += ["## Reverse check — retired and proposed screens", "",
              "| Screen | Status | Referenced by tasks |", "|---|---|---|"]
    for sid, why in RETIRED_SCREENS.items():
        refs = [t["task_id"] for t in d["tasks"] if sid in t["screen_refs"]]
        lines.append(f"| `{sid}` | {why} | {', '.join(refs) or 'none'} |")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Generate and validate the Parakh tracker")
    ap.add_argument("--check", action="store_true", help="validate canonical data only")
    ap.add_argument("--validate", action="store_true", help="reopen the saved workbook and validate it")
    ap.add_argument("--discard-workbook-edits", action="store_true",
                    help="overwrite a workbook that holds edits not yet imported")
    args = ap.parse_args(argv)

    d = load()
    errors, warnings = validate(d)
    for w in warnings:
        print("WARNING:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        print(f"{len(errors)} data error(s); nothing written.")
        return 1
    dhash = data_hash()
    m = metrics(d)
    print(f"Canonical data OK — {m['total']} tasks, {len(d['milestones'])} milestones, {m['req_total']} requirements "
          f"({m['req_covered']} with planned tasks), {m['dec_total']} decisions, {m['val_total']} checks. "
          f"Data version {dhash[:16]}")
    if args.check:
        return 0
    if args.validate:
        if not WORKBOOK.exists():
            print("ERROR: workbook not found:", WORKBOOK)
            return 1
        problems = validate_workbook(WORKBOOK, d, dhash)
        for p in problems:
            print("WORKBOOK:", p)
        if problems:
            return 1
        print(f"Workbook OK — 6 required sheets, {m['total']} task rows match canonical data, statuses valid, "
              f"dates are date cells, IDs stored as text, dependencies resolve, formula ranges as expected. "
              f"Formulas are written, not evaluated here (recalculated on open).")
        return 0
    try:
        pending = [] if args.discard_workbook_edits else pending_workbook_edits(WORKBOOK, d["tasks"])
    except ValueError as exc:
        print("ERROR:", exc)
        return 2
    if pending:
        print("REFUSING to overwrite the workbook: it holds edits not yet imported:")
        for p in pending:
            print("  ", p)
        print("Run scripts/tracker_import.py first, or pass --discard-workbook-edits deliberately.")
        return 2
    build_workbook(d, WORKBOOK, dhash)
    build_traceability(d, TRACE, dhash)
    print(f"Wrote {WORKBOOK.relative_to(ROOT)} and {TRACE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
