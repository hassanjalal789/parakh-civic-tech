# Parakh — Use-Case Pack Change Manifest

| Field | Value |
|---|---|
| **Manifest version** | **1.0** |
| **Date** | 2 September 2026 |
| **Phase** | **Portal use-case phase** — the phase deferred by CR-61 rev 1.3 |
| **Status** | **Specified; not implemented; not tested.** |
| **Authority** | CR-61 rev 1.3 · RBAC v1.3 · Data Model v1.3 · Screen Inventory v1.3 · API Contract v3.0 · Technical Stack v1.3 · Test Catalogue v1.0 |

> **Every file listed below exists in this package with the byte count and hash shown.** **Nothing is claimed as created, built, tested or validated unless the exact file is returned.**

---

## 1. Files created — all eleven returned

| # | File | Bytes | sha256 (16) | Lines |
|---|---|--:|---|--:|
| 00 | `00_PARAKH_USE_CASE_PACK_README.md` | 9,207 | `c0e6165a08c7e1d2` | 134 |
| 01 | `01_CITIZEN_PORTAL_USE_CASES.md` | 59,478 | `68db99471c681922` | 540 |
| 02 | `02_STREET_REPRESENTATIVE_PORTAL_USE_CASES.md` | 32,650 | `b8deba7d97e07af6` | 311 |
| 03 | `03_UC_OFFICER_PORTAL_USE_CASES.md` | 35,431 | `80ae9a7dfe612e26` | 352 |
| 04 | `04_CONTRACTOR_PORTAL_USE_CASES.md` | 30,502 | `6420114587003066` | 316 |
| 05 | `05_MAYOR_AND_OPERATIONS_PORTAL_USE_CASES.md` | 36,058 | `3e877798cc8bf292` | 359 |
| 06 | `06_CROSS_PORTAL_END_TO_END_WORKFLOWS.md` | 31,408 | `d0e6686dd25154b4` | 471 |
| 07 | `07_USE_CASE_TRACEABILITY_MATRIX.md` | 40,876 | `d0fb915599513daa` | 433 |
| 08 | `08_USE_CASE_ACCEPTANCE_TESTS.md` | 49,003 | `d7495b6be6b9ebfb` | 369 |
| 09 | `09_USE_CASE_DECISION_REGISTER.md` | 25,083 | `9991b37aee1507f2` | 273 |
| 10 | `10_USE_CASE_CONSISTENCY_AUDIT.md` | 16,087 | `d84f638b4a21f02c` | 212 |
| 11 | `11_USE_CASE_CHANGE_MANIFEST.md` | *this file* | — | — |

**All files live in `docs/use-cases/`.**

## 2. Files deliberately left byte-identical

| File | Bytes | sha256 (16) | Why |
|---|--:|---|---|
| `docs/use-cases/AUTHENTICATION_AND_INCIDENT_REPORTING_USE_CASES.md` | 95,595 | `1dc84f871c4dcbd1` | **The superseded anonymous-model use-case set.** It was explicitly out of scope. **Not modified, not renamed, not deleted** |
| `Parakh_Prototype_SRS_v1.4.2.md` | 881,491 | `09cb43499c56a095` | Superseded historical baseline |
| `Parakh_Release_0_Build_Specification_v1.3.1.md` | 97,885 | `ed1cd6dce666a6fc` | Extraction of the superseded SRS |
| `DATABASE_ARCHITECTURE.md` | 124,202 | `83f8107f1e2d26c4` | Stale at v2.7 — **named, not silently patched** |
| `docs/security/AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` | 76,630 | `c77477911d504097` | Stale at v1.2 — named, not patched |
| CR-61 rev 1.3, RBAC v1.3, Data Model v1.3, Screen Inventory v1.3, API Contract v3.0, Technical Stack v1.3 | — | — | **The authoritative sources this pack was written from.** Reading them does not change them |

> **No source document was edited to make a use case fit.** Where a source contradicted itself, the contradiction was recorded in `09_USE_CASE_DECISION_REGISTER.md`, not silently resolved.

## 3. What was produced — counts, computed

| Measure | Value | Arithmetic |
|---|--:|---|
| **Use cases** | **163** | `CIT 58 + REP 24 + UCO 29 + CON 24 + MAY 28 = 163` |
| **Golden journeys** | **5** | one per portal, each numbered from Step 0 |
| **Golden-journey steps** | **90** | `CIT 30 + REP 13 + UCO 16 + CON 14 + MAY 17 = 90` — counted from each file's closing line, not estimated |
| **Cross-portal workflows** | **23** | `WF-01` … `WF-23`, no gaps |
| **Acceptance-test IDs** | **23 groups** | `AT-AUTH`, `AT-OTP`, `AT-INV`, `AT-ROLE`, `AT-SCOPE`, `AT-PERM`, `AT-CONF`, `AT-PIPE`, `AT-IDEM`, `AT-STATE`, `AT-ELIG`, `AT-PRV`, `AT-AI`, `AT-OFF`, `AT-SESS`, `AT-STEP`, `AT-AUD`, `AT-SYS`, `AT-LANG`, `AT-TECH`, `AT-OFF`, `AT-EVID`, `AT-A11Y` |
| **Decisions registered** | **15** | `D-01` … `D-15` |
| **Blocker decisions** | **5** | `D-01`, `D-02`, `D-04`/`D-05`, `D-06`, `D-13` |
| **Labelled conditional branches** | **6** | written instead of invented answers |
| **Screens covered** | **58 / 58** | 0 orphans |
| **APIs covered** | **46 / 46** | 0 orphans |
| **Capabilities covered** | **25 / 28** | 3 explained, not orphaned |
| **Mermaid diagrams** | **1** | `WF-01` only — used where it materially helps; **the written steps remain authoritative** |

## 4. Phase 0 — the fifteen mandated checks

**All fifteen were performed before any use case was written.** Four turned out to be genuine document-vs-document contradictions rather than merely missing decisions.

| # | Check | Finding |
|---|---|---|
| 1 | Staff-official confirmation state | **`TBD`** — deferred identically in three sources; the case would stall |
| 2 | Staff reporter tracking their own report | **`TBD`** — no screen, no ownership read path |
| 3 | `STF-11` approved? | **PROPOSED** — not in the approved inventory; would move the total 58 → 59 |
| 4 | Acting-role selection without the header | **CONTRADICTION** — `API-120` is `Staff-authenticated`; circular |
| 5 | Pre-role vs acting-role session | **CONTRADICTION** — `acting_role_assignment_id` nullability undefined |
| 6 | Contractor organisation self-dealing | **`TBD`** — exclusion is account-keyed only |
| 7 | Purpose-bound OTP tickets | **PROPOSED** — purposes exist on the entity, ticket binding does not |
| 8 | Pre-auth consent persistence | **LOCKED** on persistence · **PROPOSED** on integrity |
| 9 | Staff voice-processing notice | **GAP** — citizens get one; staff get nothing, and `ConsentRecord` cannot hold a staff consent |
| 10 | RN local encryption | **GAP** — asserted, no mechanism named; engineering check required |
| 11 | Offline staff voice recording | **CONTRADICTION** — claimed on a Django/HTMX portal with no offline queue |
| 12 | Two idempotency contexts | **CONTRADICTION** — one header name, one UNIQUE constraint, two operations |
| 13 | Citizen name collected? | **CONTRADICTION** — privacy matrix grants a field the data model does not have |
| 14 | Mandatory photo | **`TBD`** — open in all three sources, both branches written |
| 15 | SRS incorporated? | **LOCKED** — v2.0.0 not written; CR-61 rev 1.3 is binding |

## 5. Verification performed

**43 mechanical checks executed against the saved bytes. 43 pass, 0 fail.** **8/8 planted defects detected by self-test.**

| Round | Result | Detail |
|---|---|---|
| 1 | 42 checks, 37 pass, **5 fail** | **1 real document defect** — a malformed `AT-ROLE-005` table row. **4 check defects** — a literal-string match, a regex matching `AI` inside `API`, a screen-ID allowlist missing the retired and proposed identifiers, and a per-line label check that should have been section-aware |
| Repair | — | The table row was fixed. The four checks were rewritten to be **stricter and context-aware**, not merely looser |
| 2 | **43 checks, 43 pass, 0 fail** | — |
| Self-test | **8/8 detected** | Citizen password · contractor audio · AI offline · `DRAFT` state · malformed row · ID gap · unlabelled `STF-11` · promotional language |
| Extra | verified | The `AI…offline` check was tested against **both** a false positive *(a failure-branch list)* and a true positive *(a real offline claim)*. It stays quiet on the first and fires on the second |

## 6. Scope compliance

| Constraint | Held? |
|---|:--:|
| No source document modified to fit a use case | **✓** |
| `AUTHENTICATION_AND_INCIDENT_REPORTING_USE_CASES.md` byte-identical | **✓** |
| No government rule, institutional process, permission, screen, API, state, dataset or partnership invented | **✓** |
| Every unresolved matter marked `TBD — Hassan decision required` or `TBD — legal or institutional review required` | **✓** |
| No PROPOSED item written as if approved | **✓** |
| Every use case traced to screen, API, capability, entity, state and audit event | **✓** |
| No implementation, test result, deployment or adoption claimed | **✓** |
| No AI provider, SMS provider, hosting location or legal approval named | **✓** |
| No promotional or prestige language | **✓** |

## 7. What a developer still cannot build without an answer

**Five things.** They are not stylistic preferences; each one stops an implementer.

| # | Question | Decision |
|---|---|---|
| 1 | **What happens to a staff-official report after completion verification?** As specified, it stalls forever | `D-01` |
| 2 | **How does a staff reporter see their own report?** No screen exists | `D-02` / `D-03` |
| 3 | **How does the first `POST /auth/role/select` succeed** when its transport class demands the header it exists to obtain? | `D-04` / `D-05` |
| 4 | **May a contractor organisation be assigned work its own employee requested?** | `D-06` |
| 5 | **Does a citizen name exist?** The privacy matrix says Mayor/Ops can see one; the data model has no such field | `D-13` |

**Nine further High-severity items** are listed in `10_USE_CASE_CONSISTENCY_AUDIT.md` §6.2.

## 8. Recommended next steps, in order

| # | Step | Why first |
|---|---|---|
| 1 | **Resolve the five Blockers** in `09_USE_CASE_DECISION_REGISTER.md` | Every one of them stops an implementer mid-sentence |
| 2 | **Correct the four source contradictions** — `API-120` class, `STF-10` offline claim, idempotency headers, the "Citizen name" privacy row | They are defects in the approved documents, not in this pack |
| 3 | **Author SRS v2.0.0** as a new baseline | Until it exists, `CR-61 rev 1.3` plus this pack is the specification, which is an uncomfortable place for a project to sit |
| 4 | **Regenerate the Build Specification** as v2.0.0 | It is an extraction of the SRS P0 set and cannot precede it |
| 5 | **Revise `DATABASE_ARCHITECTURE.md` to v3.0** against Data Model v1.3 — 31 entities | v2.7 still describes `AnonymousAccessGrant` |
| 6 | **Run the engineering feasibility check on local encryption** (`D-10`) | It is an implementability question, not a documentation one |
| 7 | **Re-run this audit** after each of the above | Counts should be recomputed, never inherited |

## 9. Honest status

**Nothing in this pack has been implemented, built, deployed, tested, piloted, adopted, certified or independently reviewed.** No test in `08_USE_CASE_ACCEPTANCE_TESTS.md` exists as code, and none has been executed. No accuracy, deliverability or performance figure appears anywhere. No AI provider, SMS provider, hosting location, legal approval or data-retention approval exists or is assumed.

**No screen has been designed. No citizen has spoken into this system. No officer has closed a case in it.**

---

*Specified; not implemented; not tested.*
