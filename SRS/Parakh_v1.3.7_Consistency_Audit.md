# Parakh — v1.3.7 Consistency Audit

**9 August 2026 · Hassan Jalal, Founder & Project Lead**

## Provenance

The edit phase wrote both documents to disk and released all in-memory state. `gen/audit137.py` then **reopened the saved files** and ran every check against those exact bytes, computing the digests below during that run. **This audit records the results of that run; it does not reproduce the script or its raw output.**

| File | SHA-256 | MD5 | Words |
|---|---|---|---|
| `Parakh_Prototype_SRS_v1.3.7.md` | `f698b56eaf0b32f2b7e2e0e86441fab8ad3b121bc20596571858ef2dbf66264b` | `82a852b12936286177dd19cafa030936` | **128,730** |
| `Parakh_Release_0_Build_Specification_v1.2.7.md` | `b3b613629962ab56710c2bee48264eda87ab420754a8cbfae01b55ecd5ac38f2` | `071ea78bfaa7fab20a0a85a9abb6db3b` | **13,762** |

> **Words** = whitespace-delimited word count, `len(text.split())`. **This is not a model token count**; the v1.3.6 audit mislabelled the same figure as "Tokens" and that label is corrected here.

All earlier versions preserved unchanged.

---

## Why the v1.3.6 audit was invalid

It reported 23/23 PASS while two contradictions survived in the files:

- **Release §26** still carried fifteen slices, *"45 of the 83 P0 requirements"*, `0B-1 … 0B-6`, *"the remaining 38"*, an `R-6` figure of 83, and performance measurement listed as mandatory Wave 0B work — every one of which contradicted the Master.
- **Master §0.1** was structurally broken: the v1.3.4 Change cell was empty, v1.3.5 was absent, and the v1.3.6 row sat **after the document footer** as an orphan.

Neither was detected because no check inspected Release §26 or the revision-history table. **Checks 14–23 below exist specifically to make those failures detectable, and checks 32–35 were added by the micro-patch for the same reason.**

---

## Verified structural totals

| Measure | Value |
|---|---|
| Functional requirements | **149** — 84 P0 · 46 P1 · 19 P2 |
| Screens | **51** — 34 P0 · 16 P1 · 1 P2 |
| API contract IDs | **61** — 41 P0 · 19 P1 · 1 P2 |
| Acceptance tests | **203** — 129 P0 · 55 P1 · 19 P2 |
| RTM mappings | **149** |
| Data entities | **49** — 38 P0 · 11 later-release |
| Error codes | **49** |
| Non-functional requirements | **84** — 45 P0 · 37 P1 · 2 P2 |
| Decisions | **58** — 56 open · 2 closed |
| Build blockers | **14**, of which **10** block field testing |
| Wave 0A | **47 FRs** across **8 slices** |
| Wave 0B | **37 FRs** across **10 slices** |
| Total slices | **18** |
| P0 union | **84**, intersection empty |
| Acceptance formats | **134 Given/When/Then + 15 external-verification records = 149** |
| §35 gate rows | **18**, all unsigned |

---

## Thirty-five checks

| # | Check | Result |
|---|---|:--:|
| 1 | 149 unique FRs | **PASS** |
| 2 | FR distribution 84 P0 / 46 P1 / 19 P2 | **PASS** |
| 3 | 51 screens — 34 P0 / 16 P1 / 1 P2 | **PASS** |
| 4 | 61 API contract IDs — 41 P0 / 19 P1 / 1 P2 | **PASS** |
| 5 | 203 acceptance tests — 129 P0 / 55 P1 / 19 P2 | **PASS** |
| 6 | 149 RTM mappings, all unique | **PASS** |
| 7 | 49 data entities — 38 P0 + 11 later-release | **PASS** |
| 8 | 49 unique error codes, catalogue intro agrees | **PASS** |
| 9 | 84 NFRs — 45 P0 / 37 P1 / 2 P2 | **PASS** |
| 10 | 58 decisions — 56 open, 2 closed | **PASS** |
| 11 | 14 build blockers, 10 of them field-test | **PASS** |
| 12 | 134 Given/When/Then + 15 external-verification records = 149 | **PASS** |
| 13 | Master §30.6 membership: 47 / 37, disjoint, union 84 | **PASS** |
| **14** | **Release §26 states 47 Wave 0A FRs across 8 slices** | **PASS** |
| **15** | **Release §26 states 37 Wave 0B FRs across 10 slices** | **PASS** |
| **16** | **Release §26 wave union = 84 with zero overlap** | **PASS** |
| **17** | **`R-6` references 84, not 83** | **PASS** |
| **18** | **No P1 performance NFR described as mandatory Wave 0B work** | **PASS** |
| **19** | **Total current slice count = 18** | **PASS** — 8 + 10 |
| **20** | **Revision history contains every version through v1.3.7 exactly once** | **PASS** — 1.0, 1.1, 1.2, 1.3, 1.3.1–1.3.7 |
| **21** | **No revision-history Change cell is empty** | **PASS** — 11 rows populated |
| **22** | **No orphan Markdown table row outside its table** | **PASS** |
| **23** | **Master footer is the last non-blank line** | **PASS** |
| **24** | **Current SRC-6 references use v1.2.7** | **PASS** |
| **25** | **`TBD-009` does not imply approval of `R-6`/`R-7`** | **PASS** |
| **26** | **All current version and companion references agree** | **PASS** |
| **27** | **No stale active claim of 83 P0, 45-of-83, 38 remaining, six 0B slices, 15 slices or SRC-6 v1.2.3** | **PASS** *(failed first run)* |
| **28** | **Valid Markdown table widths throughout both documents** | **PASS** *(failed first run)* |
| 29 | No undefined reference in either document | **PASS** |
| 30 | Release authentication corrections preserved from v1.2.6 | **PASS** |
| 31 | No partnership, approval, deployment, real-user or impact claim | **PASS** |
| **32** | **All current audit-script references use `audit137.py`; no current `audit136.py` reference remains** | **PASS** |
| **33** | **Historical Master revision rows use their correct per-version audit filenames** | **PASS** |
| **34** | **Historical Release v1.2.6 references Master v1.3.6; current v1.2.7 references Master v1.3.7** | **PASS** |
| **35** | **The audit has exactly one physical row per check, IDs contiguous 1–35, heading and denominator both 35** | **PASS** |

**35 / 35 PASS.** Checks 27 and 28 failed on the first run of the v1.3.7 pass — a `83 P0` mention lacked a historical label and the new `SRC-6` row in §0.2 had five cells against a seven-cell header. Both documents were corrected, saved, reopened and the complete audit re-run.

---

## What changed in v1.3.7

### Micro-patch applied in place to the v1.3.7 files

**Documentation and provenance only. No architecture, requirement, priority, API, authentication, screen, entity, workflow, test, Wave-membership, total or scope change.**

1. **Master §34** now cites `gen/audit137.py`. It had cited `gen/audit136.py`, which was the script of the previous release.
2. **Master §0.1 historical audit filenames restored.** The v1.3, v1.3.1 and v1.3.2 rows had been globally rewritten to point at the current audit. Each now cites its own — `Parakh_v1.3_Consistency_Audit.md`, `Parakh_v1.3.1_Consistency_Audit.md`, `Parakh_v1.3.2_Consistency_Audit.md`. The v1.3.4 and v1.3.5 rows were already correct and are untouched; only the v1.3.7 row cites the v1.3.7 audit. **The earlier claim that historical rows were already preserved correctly was wrong, and this record corrects it.**
3. **v1.3.4 enum expressed safely** as `Session.mfa_assurance ∈ {none, mfa, recovery}`, removing unescaped table pipes from that cell.
4. **Release v1.2.6 revision row** now references **Master SRS v1.3.6**, the version it was actually regenerated against. The v1.2.7 row and the parent and footer references continue to cite Master v1.3.7.
5. **Release §26 emphasis repaired** — the invalid nested bold around `R-6`/`R-7` is now one valid emphasis span. Meaning unchanged.
6. **This audit's check list made literally accurate** — the grouped `1–12` row is replaced by twelve individually numbered rows, and checks **32–35** are added, giving **35 physical rows, IDs contiguous 1–35**, matching the declared count and the PASS denominator.

### Corrections carried in the v1.3.7 pass itself


Documentation integrity only. **No architecture, authentication, privacy, evidence, API, role, permission, entity, screen, workflow, priority, test or product-scope decision was altered.**

1. **Release §26 replaced** with verified summary totals: `0A-1 … 0A-8`, 47 of 84; `0B-1 … 0B-10`, remaining 37; 18 slices; `R-6` at 84; `NFR-PERF-001…005` stated **P1 and not mandatory**. §26 no longer reproduces a membership list and points to Master §30.6.
2. **Master §0.1 repaired** — the v1.3.4 description restored from the v1.3.4 source, v1.3.5 added, the orphan v1.3.6 row moved into the table, v1.3.7 added, and the footer restored as the final non-blank line. Historical rows keep their own audit filenames; none was invented.
3. **`SRC-6` added to §0.2** as v1.2.7, explicitly **derived and never overriding the Master**; §0.6 corrected from v1.2.3 to v1.2.7.
4. **`TBD-009` clarified** — it settled the **four-actor demonstration boundary** only, **not** the 84-requirement scope or the 18-route count, which remain `R-6` and `R-7`, unapproved.
5. **Stale current language corrected** — §36.2's 83 relabelled an intermediate historical figure beside the current 84; `CR-54`'s 15 slices labelled historical beside the current 18; §37.7 now cites v1.3.7; the "twenty required checks" claim removed; the "script and raw output are reproduced" claim replaced with a truthful statement; §30.6's absolute claim narrowed to *the only authoritative requirement-membership list*.
6. **Audit column relabelled** from `Tokens` to `Words`.

---

## Remaining open items — none resolved editorially

`TBD-058` credential policy · `TBD-049`/`TBD-050` hosting and backup · `TBD-053` sole-Administrator recovery · nine further field-test decisions · `TBD-029` export coarsening · **14 non-functional requirements with no approved numeric target** · **no independent security or privacy review** · **74 of 203 test rows are deferred specifications** · **all 18 §35 gate rows unsigned** · **`R-6` and `R-7` unapproved, so 84 requirements and 18 routes are proposed, not frozen**.

| Activity | Permitted? |
|---|---|
| Architecture and repository scaffolding | **YES** |
| Release 0 backlog frozen | **NO** — `R-6`, `R-7` |
| Demonstration deployment | **NO** — `TBD-049`, `TBD-050` |
| Real-participant field testing | **NO** — 10 decisions and 18 gate rows |
| Public launch | **NO** — out of scope for these documents |

**These documents establish no government approval, no formal partnership, no deployment, no real user and no demonstrated social impact. Minors remain excluded. No real participant data may be collected until the blocking decisions are approved and the §35 gate is signed.**

---

## Determination

**All 35 checks pass against the reopened saved bytes. The v1.3.7 documentation baseline is frozen.**

Structural totals are unchanged by the micro-patch; the diff contains documentation and provenance corrections only. Freezing the baseline is not scope approval: `R-6` and `R-7` remain Hassan Jalal's to decide, and the four permission gates are unchanged.

---

*Parakh — v1.3.7 Consistency Audit · 9 August 2026 · Hassan Jalal, Founder & Project Lead. Thirty-five checks executed by `gen/audit137.py` against files reopened from disk.*
