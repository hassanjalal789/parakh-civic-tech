# Project Plan

| Field | Value |
|---|---|
| Created | Saturday 2026-10-03 (Asia/Karachi), task `T-004` |
| Owner | Hassan Jalal — sole human developer and designer |
| Requirement baseline | Mobile SRS v2.3.0 (S-01; v2.2.0 is S-01b, v2.1.0 is S-01a), CR-61 rev 1.3 (S-02), use-case pack 1.0 — see [SOURCE_REGISTER.md](SOURCE_REGISTER.md) |
| Task data | [`tracking/data/tasks.csv`](../../tracking/data/tasks.csv) (115 tasks) and [`milestones.csv`](../../tracking/data/milestones.csv) (12 milestones). Status lives there, not here |
| Implementation status today | Updated 2026-10-04: backend citizen authentication (`backend/`, 63 passing tests on SQLite) and the mobile citizen sign-in screens (`mobile/`, 52 passing tests; never run on a device) exist in development. No PostgreSQL database and no device build exist. `apps/citizen` is still the default Flutter template that conflicts with DR-19 (`DG-03`). Task status lives in `tracking/data/tasks.csv` |

## 1. What this plan commits to

The plan covers the complete approved product: all five portals, 58 screens, 124 FRs, 86 NFRs and 12 SC controls. It delivers that scope in the SRS's three phases, plus setup and operations work. It makes the **first usable deliverable**, the vertical slice in section 4, explicit. It also shows, with arithmetic, why the full Phase 1 does not fit 1 November 2026.

Documentation and validation are part of every task's acceptance criteria. There is no "cleanup at the end" milestone.

## 2. Phase terminology — mapping (`DG-07`)

| Term | Where it comes from | Meaning | Used in this plan as |
|---|---|---|---|
| **P0 / Release 0** | Prototype SRS v1.3.7, Build Spec v1.2.7 (historical) | Pre-CR-61 technical demonstration: Moderator/Admin, Flutter | Not used. Its surviving IDs are reached through S-01 |
| **P1 / P2** (legacy release tags) | Same historical documents | Later releases of the old model | Not used |
| **P1 — Phase 1** | S-01 §1.2.5 | Authentication and the public submission interface (citizen) | **Phase 1** |
| **P2 — Phase 2** | S-01 §1.2.5, §8.3 | Staff authentication, read access, state isolation, `STF-10` | **Phase 2** |
| **P3 — Phase 3** | S-01 §1.2.5, §8.4 | Portal processing workflows, analytics, hardening | **Phase 3** |
| **P?** | S-01 | Not assignable until a decision closes (`FR-PUB.8`, `FR-PORTAL.30`) | Planned, but blocked on the decision |
| **R0 / P1** in the module table | S-01 §3.2.1 | "Required in Release 0" / "later module" | R0 = needed in Phase 1; "P1 module" = later (e.g. maps, background tasks, Sentry, Maestro) |
| **G0–G3** | S-01 §8.1 | Gates: SRS approved · scaffold delivered · Blockers triaged · Phase 1 exit | G1 (mentor scaffolds) is superseded by `DG-01`; G0 depends on `DG-01`'s open part |
| **Phases 1–3** of the execution plan and roadmap (S-24, S-25) | Historical | Alpha, field test, and Aug–Oct timelines | Not used |
| **Setup, Ops** | This plan | Initialization and readiness, and operations/release work that is not a product phase | Milestones M0–M1 and M11 |

## 3. Planning assumptions — stated, not hidden

| # | Assumption | Status | If false |
|---|---|---|---|
| A1 | **20 working hours per week** on Parakh | **Unconfirmed** — `DG-38` | Every elapsed-time figure below scales |
| A2 | Hassan has no recorded React Native experience (`ASM-08`) | From S-01 | Effort ranges already include learning time; the upper bound is the realistic case |
| A3 | Effort ranges are **working hours**, including tests and documentation | Estimate | Re-estimated at each milestone checkpoint |
| A4 | Development uses **labelled development adapters** for SMS and AI until providers are chosen (`DG-15`, `DG-16`, `DG-48`) | Recommended | Without them nothing can be integrated end to end |
| A5 | **Android first** on a physical device; iOS needs Xcode, which is not installed (`T-024`) | Environment fact | iOS evidence comes later and is never inferred from Android |
| A6 | Synthetic data only. No real citizen data until the approvals in `T-114` exist | Binding (C-7, NFR-80) | — |

Dates are in Asia/Karachi. Week 1 starts **Monday 2026-10-05**.

## 4. The smallest real vertical slice (milestone M6)

> **A synthetic citizen signs in with an OTP, captures a live photo and a voice recording, reviews the Urdu rendering, confirms that exact version, submits, and then sees the report — with its server-issued reference — listed from the backend's `API-150`.**

A mobile screen showing hardcoded success **does not** complete this slice. All of the following must exist and run:

| Component | Needed for | Status today | Provided by |
|---|---|---|---|
| Django + DRF API with deny-by-default auth | Every call | None | `T-027` |
| PostgreSQL + PostGIS with a separate identity-vault schema and role | Accounts, phone credentials, reports | Not installed | `T-023`, `T-028` |
| Append-only audit service | Account creation, confirmation, report creation | None | `T-029` |
| OTP challenge service + **development SMS adapter** | Sign-in | None | `T-038`–`T-041` |
| Evidence upload with server-side hash recompute, local write-once storage substitute | Photo and voice | None | `T-053`, `T-054` |
| Celery + Redis job + **mock AI adapter** (labelled) | Rendering | Not installed | `T-023`, `T-056`, `T-057` |
| Confirmation (`API-135`) and atomic report creation (`API-140`) | Submission | None | `T-060`, `T-061` |
| Expo SDK 57 development build on an Android device, SQLCipher-encrypted drafts | Client | No JDK, SDK 36 or device | `T-022`, `T-031`, `T-046`, `T-047` |
| Citizen screens `CIT-01`…`CIT-15` (slice subset) | UI | None | `T-042`–`T-063` |

**Blocked integrations, and the work that continues meanwhile.**

- **Blocked:** the real SMS provider (`T-065`, `DG-15`) and the real AI provider (`T-059`, `DG-16`).
- **Continues meanwhile:** everything else in the slice proceeds behind the adapter boundaries.
- **What the slice proves without them:** the evidence, confirmation and idempotency chain end to end. It does **not** prove SMS delivery or AI quality, and the evidence record (`T-064`) must say so.

## 5. Milestones

Effort is the sum of the task ranges in `tasks.csv`. Elapsed weeks assume A1 (20 h/week) and are sequential, because there is one developer.

| ID | Milestone | Phase | Observable outcome | Entry | Exit criteria (evidence) | Effort (h) | Elapsed at 20 h/wk |
|---|---|---|---|---|---|--:|--:|
| **M0** | Project initialization | Setup | Sources, plan, tracker, instructions and state are in the repository; setup branch pushed | Owner instruction 2026-10-03 | M0 tasks Done with evidence; remote branch verified | 22–38 | this session |
| **M1** | Decisions and toolchain readiness | Setup | Phase-1-gating decisions recorded; Android toolchain and local services verified | M0 pushed | `DG-04/09/10/11/12/13/15/16/38` decided or explicitly deferred; `adb devices`, `psql`, `redis-cli ping` verified | 16–32 (incl. decision time) | ~1–1.5 wk |
| **M2** | Foundations | P1 | Backend and mobile skeletons build, test and run in CI; PROPOSED Phase 1 contract | M1 | `T-027`…`T-036` Done; CI green; dev build on a device | 44–73 | 2.2–3.7 wk |
| **M3** | Citizen authentication | P1 | A synthetic citizen signs up and signs in (development SMS adapter) | M2 | Integration tests for API-121/122/003/004/128; device run of CIT-01…05 | 35–56 | 1.8–2.8 wk |
| **M4** | Live capture and encrypted local drafts | P1 | Evidence, voice and location captured offline into owner-bound encrypted storage | M3 | `DEP-08` SQLCipher device record; queue-survival test | 32–57 | 1.6–2.9 wk |
| **M5** | Upload and AI rendering (dev adapter) | P1 | Upload with server hash checks; a labelled mock rendering is reviewed and corrected | M4 | Integration tests; failure path preserves the draft | 35–59 | 1.8–3.0 wk |
| **M6** | **First vertical slice** | P1 | Section 4 | M5 | `T-064` evidence record on an Android device | 24–40 | 1.2–2.0 wk |
| **M7** | Phase 1 completion features | P1 | Clarification, resolution feedback, notifications, profile, help, accessibility | M6 | Tests + manual checklists | 36–58 | 1.8–2.9 wk |
| **M8** | Phase 1 exit (G3) and submission package | P1 | Exit report against criteria 1–16, with honest gaps; demonstration package | M7 | `PHASE1_EXIT_REPORT.md` | 17–30 | 0.9–1.5 wk |
| **M9** | Phase 2: staff auth, isolation, official reporting | P2 | Two-factor staff sign-in with one acting role; principals isolated; bundle controls proven | M8 | Exit criteria 17–24 | 67–110 | 3.4–5.5 wk |
| **M10** | Phase 3: portal workflows | P3 | A report moves through verification → acceptance → assignment → completion → confirmation → closure | M9; Blockers `DG-19…22` decided | Workflow tests `WF-02`…`WF-23` | 106–181 | 5.3–9.1 wk |
| **M11** | Operations, release and pilot readiness | Ops | Environments, backups, procedures and approvals before any real data | M8 (demo), M10 (pilot) | Rehearsal and approval records | 28–50 + external | 1.4–2.5 wk + external |

**Totals.**

| Scope | Effort (h) | At 20 h/week |
|---|--:|--:|
| Vertical slice (M2–M6) | 170–285 | 8.5–14 weeks |
| Full Phase 1 (M2–M8) | 223–373 | 11–19 weeks |

## 6. The 1 November 2026 target — what fits

The SRS gives **1 November 2026** as the target submission date and **3 October** as SRS approval (G0). Those are historical targets: G0 has no approval record, and `DG-01` remains open. The 10 October date in `docs/pilot-scope.md` came from a plan that assumed an external developer (`DG-04`).

| From Mon 5 Oct to Sun 1 Nov | Working hours available | What fits (lower–upper estimate) |
|---|--:|---|
| At 20 h/week (A1) | ~80 h | M1 + M2, and **part** of M3 |
| At 40 h/week | ~160 h | M1 + M2 + M3 + M4 at the optimistic end; **not** the vertical slice at the realistic end |

**Recommendation** (Hassan decides under `DG-04`):

- **Keep 1 Nov as an honest checkpoint**, not as "Phase 1 delivered". Target for that date: foundations plus citizen authentication working end to end on a real Android device. That covers `CIT-01`…`CIT-05`, with the backend and audit underneath and the development SMS adapter clearly labelled.
- **Treat the vertical slice (M6) as the first usable deliverable.** Earliest realistic date: about the end of November at 40 h/week, or mid-December to mid-January at 20 h/week.
- **Defer, do not delete.** Every remaining Phase 1 requirement stays planned in M7–M8. Phase 2 and Phase 3 stay planned in M9–M10.

**Why the full scope does not fit:**

- The dependency chain is strictly sequential for one person: toolchain → backend skeleton → auth → capture → upload/AI → confirm/submit.
- Two external integrations (SMS, AI) have no provider.
- SQLCipher must be proven on a device before any draft can honestly be called encrypted.

## 7. First-week sequence (Mon 5 – Sun 11 Oct 2026)

| Order | Task | What Hassan does | Hours |
|---|---|---|--:|
| 1 | `T-011` | Review and merge the setup PR into `main` | 0.5–1 |
| 2 | `T-012`, `T-020` | Decide the target and weekly hours (`DG-04`, `DG-38`); say whether any academic approval gate applies (`DG-01`) | 1–1.5 |
| 3 | `T-019` | Approve removing the Flutter scaffold (`DG-03`) | 0.5 |
| 4 | `T-013`–`T-016` | Decide photo rule, idempotency headers, OTP purpose binding, consent integrity, OTP numbers (recommendations in DECISIONS_AND_GAPS §4.2) | 2–4 |
| 5 | `T-022` | Install JDK 17 + Android SDK 36 + connect a device; record versions | 2–4 |
| 6 | `T-023` | Install PostgreSQL/PostGIS and Redis; record versions | 1–3 |
| 7 | `T-026` | Look for the missing RBAC/Data/API/Screen/Stack/Test documents | 1–3 |
| 8 | `T-017`, `T-018`, `T-021` | Start the provider and device decisions (they need not close this week) | 1–3 |
| 9 | `T-027` | Start the backend skeleton once T-023 passes | rest of the week |

Week 1 ends with M1 complete or with each open item explicitly deferred, and with `T-027` in progress.

## 8. Not in the current release — kept, not deleted

| Item | Why it waits | Where it is planned |
|---|---|---|
| Real SMS and AI providers | No decision (`DG-15`, `DG-16`) | `T-065`, `T-059` (Blocked) |
| iOS verification | Xcode not installed | `T-024`, `T-080` |
| All staff portals | Phase 2/3 by the SRS | M9, M10 |
| Staff-official reporting lifecycle completion | Blockers `DG-20`, `DG-21`, `DG-23` | `T-090`, `T-104` (Blocked) |
| Export, safeguarding | COULD / no requirement (`DG-46`, `DG-34`) | `T-102`; none |
| Usability testing with real users | Ethics and consent approvals needed | `T-106` (Blocked) |
| Push notifications, maps provider, background sync, crash reporting, E2E automation | Later modules per S-01 §3.2.1 | Within M7/M9 tasks once a requirement needs them |

## 9. Risks that shape the schedule

These are from S-01 §11.2. Mitigations are planned in the tasks shown.

| Risk | Effect | Response in this plan |
|---|---|---|
| R-01/R-02 no SMS / AI provider | No real end-to-end demonstration | Development adapters (`DG-48`); decisions `T-017`/`T-018` in week 1 |
| R-03 no backend | Phase 1 would be UI against stubs | The backend is built first (M2–M3), before most screens |
| R-18/R-21 no React Native experience; 35 screens restored by DR-25 | Schedule | Upper-bound estimates; Phase 1 scope protected; staff scope after M8 |
| R-19 SQLCipher build risk | No honest encryption claim | `T-046` spike early in M4, on a real device |
| R-16 background sync restricted | Queue reliability | Foreground-first sync (`DG-31`) |

## 10. How this plan changes

Status changes happen in `tracking/data/tasks.csv`, never here. This document changes only when scope, phase mapping, assumptions or milestone structure change. Each change is recorded in the [development journal](../project/DEVELOPMENT_JOURNAL.md) together with the decision that caused it.
