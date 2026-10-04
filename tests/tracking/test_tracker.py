"""Tests for the tracker generator and import tool.

Run from the repository root:
    .venv/bin/python -m unittest discover -s tests/tracking -v
"""
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import generate_tracker as gt  # noqa: E402
import tracker_import as ti  # noqa: E402
from openpyxl import load_workbook  # noqa: E402


class TrackerTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.data = self.tmp / "data"
        shutil.copytree(gt.DATA, self.data)
        self.wb = self.tmp / "tracker.xlsx"
        self.build()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def build(self):
        d = gt.load(self.data)
        gt.build_workbook(d, self.wb, gt.data_hash(self.data))

    def edit_workbook(self, task_id, field, value):
        wb = load_workbook(self.wb)
        ws = wb["Tasks"]
        header = [c.value for c in ws[2]]
        for r in range(3, ws.max_row + 1):
            if ws.cell(row=r, column=1).value == task_id:
                ws.cell(row=r, column=header.index(field) + 1, value=value)
        wb.save(self.wb)

    def edit_csv(self, task_id, field, value):
        rows = gt.read_csv(self.data / "tasks.csv")
        for r in rows:
            if r["task_id"] == task_id:
                r[field] = value
        gt.write_csv(self.data / "tasks.csv", rows, list(rows[0].keys()))

    def task(self, task_id):
        return next(t for t in gt.read_csv(self.data / "tasks.csv") if t["task_id"] == task_id)


class TestCanonicalData(unittest.TestCase):
    def test_repository_data_validates(self):
        errors, _warnings = gt.validate(gt.load())
        self.assertEqual(errors, [])

    def test_every_requirement_has_a_planned_task(self):
        m = gt.metrics(gt.load())
        self.assertEqual(m["req_covered"], m["req_total"])

    def test_done_application_task_requires_passed_validation(self):
        d = gt.load()
        t = next(t for t in d["tasks"] if t["milestone_id"] == "M3")
        t.update(status="Done", evidence_refs="backend/ (no validation cited)", actual_end="2026-10-03")
        errors, _ = gt.validate(d, decisions_md=None)
        self.assertTrue(any(t["task_id"] in e and "Passed validation" in e for e in errors))

    def test_cycle_is_detected(self):
        d = gt.load()
        d["tasks"][0]["dependencies"] = d["tasks"][1]["task_id"]
        d["tasks"][1]["dependencies"] = d["tasks"][0]["task_id"]
        errors, _ = gt.validate(d, decisions_md=None)
        self.assertTrue(any("cycle" in e for e in errors))

    def test_blocked_without_reason_is_rejected(self):
        d = gt.load()
        t = next(t for t in d["tasks"] if t["status"] == "Not Started")
        t["status"] = "Blocked"
        errors, _ = gt.validate(d, decisions_md=None)
        self.assertTrue(any("Blocked requires blocked_reason" in e for e in errors))


class TestWorkbook(TrackerTestCase):
    def test_saved_workbook_validates(self):
        d = gt.load(self.data)
        self.assertEqual(gt.validate_workbook(self.wb, d, gt.data_hash(self.data)), [])

    def test_generation_is_deterministic(self):
        first = self.wb.read_bytes()
        self.build()
        self.assertEqual(first, self.wb.read_bytes())


class TestImport(TrackerTestCase):
    def test_edit_is_imported(self):
        self.edit_workbook("T-012", "status", "In Progress")
        self.edit_workbook("T-012", "notes", "Started capacity check")
        rc = ti.apply(self.data, self.wb)
        self.assertEqual(rc, 0)
        self.assertEqual(self.task("T-012")["status"], "In Progress")
        self.assertEqual(self.task("T-012")["notes"], "Started capacity check")

    def test_newer_canonical_change_is_not_overwritten(self):
        self.edit_workbook("T-013", "notes", "workbook note")
        self.edit_csv("T-013", "notes", "canonical note written after generation")
        rc = ti.apply(self.data, self.wb)
        self.assertEqual(rc, 1)  # conflict reported
        self.assertEqual(self.task("T-013")["notes"], "canonical note written after generation")

    def test_unknown_id_and_invalid_status_are_rejected(self):
        wb = load_workbook(self.wb)
        ws = wb["Tasks"]
        ws.cell(row=3, column=1, value="T-999")
        wb.save(self.wb)
        self.edit_workbook("T-014", "status", "Finished")
        changes, _conflicts, rejected = ti.plan_import(self.wb, gt.read_csv(self.data / "tasks.csv"))
        self.assertTrue(any("T-999" in r for r in rejected))
        self.assertTrue(any("T-014" in r and "invalid status" in r for r in rejected))
        self.assertFalse(any(c[0] == "T-014" for c in changes))

    def test_done_without_evidence_is_rejected(self):
        self.edit_workbook("T-015", "status", "In Progress")
        ti.apply(self.data, self.wb)
        self.build()
        self.edit_workbook("T-015", "status", "Done")
        _changes, _conflicts, rejected = ti.plan_import(self.wb, gt.read_csv(self.data / "tasks.csv"))
        self.assertTrue(any("Done requires evidence_refs" in r for r in rejected))

    def test_regeneration_refuses_to_drop_unimported_edits(self):
        self.edit_workbook("T-016", "notes", "not yet imported")
        pending = gt.pending_workbook_edits(self.wb, gt.read_csv(self.data / "tasks.csv"))
        self.assertTrue(any("T-016.notes" in p for p in pending))


if __name__ == "__main__":
    unittest.main()
