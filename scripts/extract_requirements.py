#!/usr/bin/env python3
"""Extract the active requirement baseline from the Mobile SRS into CSV.

Source:  SRS/Parakh_Mobile_App_SRS_v2.7.0.md   (PARAKH-SRS-MOBILE v2.7.0)
Output:  tracking/data/requirements.csv

The CSV is a *derived index* of the SRS, not a new requirement source. Each
row keeps the SRS identifier verbatim. Statements are copied from the SRS and
lightly de-formatted (Markdown emphasis and backticks removed) so the
spreadsheet stays readable; the SRS text remains authoritative.

Run from the repository root:
    python3 scripts/extract_requirements.py          # write the CSV
    python3 scripts/extract_requirements.py --check  # fail if CSV is stale
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRS = ROOT / "SRS" / "Parakh_Mobile_App_SRS_v2.7.0.md"
OUT = ROOT / "tracking" / "data" / "requirements.csv"

FIELDS = [
    "req_id", "kind", "module", "title", "statement", "priority", "phase",
    "source_doc", "source_ref", "screens", "apis", "entities", "legacy_ids",
    "srs_tests",
]

PRIO_PHASE = re.compile(r"\[(MUST|SHOULD|COULD|WON'T-P1)\]\s*·\s*(P\?|P\d)")


def clean(text: str) -> str:
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" |")


def ids(cell: str, pattern: str) -> str:
    found = re.findall(pattern, cell)
    seen: list[str] = []
    for item in found:
        if item not in seen:
            seen.append(item)
    return ";".join(seen)


def parse_fr(lines: list[str]) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    for line in lines:
        head = re.match(r"^#### `(FR-[A-Z]+\.\d+)` — (.+)$", line)
        if head:
            req_id = head.group(1)
            current = {f: "" for f in FIELDS}
            current.update(
                req_id=req_id,
                kind="FR",
                module=req_id.split(".")[0],
                title=clean(head.group(2)),
                source_doc="PARAKH-SRS-MOBILE v2.1.0 §5",
            )
            rows[req_id] = current
            continue
        if current is None:
            continue
        if line.startswith("| **Statement** |"):
            current["statement"] = clean(line.split("|", 2)[2])
        elif line.startswith("| **Priority · Phase** |"):
            m = PRIO_PHASE.search(line.replace("*", ""))
            if m:
                current["priority"], current["phase"] = m.group(1), m.group(2)
        elif line.startswith("| **Source** |"):
            current["source_ref"] = clean(line.split("|", 2)[2])
        elif line.startswith("#") and not line.startswith("####"):
            current = None
    return rows


def parse_matrix(lines: list[str], rows: dict[str, dict[str, str]]) -> None:
    """§9.1 — FR → screen · API · entity · legacy ID · test · phase."""
    in_matrix = False
    for line in lines:
        if line.startswith("## 9.1"):
            in_matrix = True
            continue
        if in_matrix and line.startswith("## 9.2"):
            break
        if not in_matrix or not line.startswith("| `FR-"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 7:
            continue
        req_id = cells[0].strip("` ")
        row = rows.get(req_id)
        if row is None:
            continue
        row["screens"] = ids(cells[1], r"(?:CIT|STF|REP|UCO|CON|MAY)-\d{2}")
        row["apis"] = ids(cells[2], r"API-\d{3}")
        row["entities"] = clean(cells[3])
        row["legacy_ids"] = clean(cells[4])
        row["srs_tests"] = ids(cells[5], r"(?:AT|TEST)-[A-Z]+-\d{3}")


def parse_table_reqs(lines: list[str], prefix: str, kind: str) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    section = ""
    pattern = re.compile(r"^\| \*\*`(" + prefix + r"-\d+)`\*\* \|")
    for line in lines:
        if line.startswith("## ") or line.startswith("### ") or line.startswith("#### "):
            section = line.lstrip("# ").strip()
        m = pattern.match(line)
        if not m:
            continue
        req_id = m.group(1)
        if req_id in rows:  # keep the first (defining) occurrence
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        row = {f: "" for f in FIELDS}
        row.update(req_id=req_id, kind=kind, statement=clean(cells[1]))
        sec_no = section.split(" ", 1)[0]
        row["source_doc"] = f"PARAKH-SRS-MOBILE v2.1.0 §{sec_no}"
        row["module"] = clean(section.split(" ", 1)[1]) if " " in section else section
        if kind == "NFR":
            pp = PRIO_PHASE.search(line.replace("*", ""))
            if pp:
                row["priority"], row["phase"] = pp.group(1), pp.group(2)
            row["legacy_ids"] = clean(cells[-1])
            row["title"] = row["statement"][:90]
        else:  # SC — unified-bundle security controls, conditions of DR-26
            row["title"] = row["statement"][:90]
            row["source_ref"] = "Mitigates: " + clean(cells[2]) + " · Enforced by: " + clean(cells[3])
            row["priority"] = "MUST"
            # SRS §10.3 places SC exit evidence at Phase 2 (criteria 17-24);
            # SC-11 is realised by NFR-95, which the SRS tags P3.
            row["phase"] = "P3" if req_id == "SC-11" else "P2"
        rows[req_id] = row
    return rows


def build() -> tuple[str, int, int, int]:
    lines = SRS.read_text(encoding="utf-8").splitlines()
    frs = parse_fr(lines)
    parse_matrix(lines, frs)
    nfrs = parse_table_reqs(lines, "NFR", "NFR")
    scs = parse_table_reqs(lines, "SC", "SC")

    def nkey(r: str) -> tuple[str, int]:
        head, num = re.match(r"^(.*?)[.-](\d+)$", r).groups()
        return head, int(num)

    ordered = [frs[k] for k in frs]  # SRS order
    ordered += sorted(nfrs.values(), key=lambda r: nkey(r["req_id"]))
    ordered += sorted(scs.values(), key=lambda r: nkey(r["req_id"]))

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    for row in ordered:
        writer.writerow(row)
    return buf.getvalue(), len(frs), len(nfrs), len(scs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="exit 1 if the CSV differs from a fresh extraction")
    args = parser.parse_args()
    text, n_fr, n_nfr, n_sc = build()
    digest = hashlib.sha256(SRS.read_bytes()).hexdigest()[:16]
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != text:
            print(f"STALE: {OUT.relative_to(ROOT)} does not match {SRS.name} (sha256 {digest})")
            return 1
        print(f"OK: requirements.csv matches {SRS.name} — FR {n_fr}, NFR {n_nfr}, SC {n_sc}")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} — FR {n_fr}, NFR {n_nfr}, SC {n_sc} from {SRS.name} (sha256 {digest})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
