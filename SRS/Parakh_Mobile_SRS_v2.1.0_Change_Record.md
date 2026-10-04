# Parakh Mobile SRS v2.1.0 — Change Record and Audit

| Field | Value |
|---|---|
| **File** | `docs/srs/Parakh_Mobile_App_SRS_v2.1.0.md` |
| **Version** | **2.1.0** — MINOR *(v2.0.0 retained)* |
| **Bytes · Lines** | **403075** · **4829** |
| **sha256 (16)** | `2d5fef5224ea6959` |
| **Audit** | **176 checks · 176 pass · 0 fail** · **39/39 planted defects detected** |
| **Status** | **Specified; not implemented; not tested.** |

---

## 1. Of the three asks, one was outstanding

| Ask | State on arrival | Action |
|---|---|---|
| **Resolve `RC-23`** | **OPEN** | **Done — `DR-26`, §7.4.2, twelve controls** |
| **State isolation `FR-COMMON.23`–`.26`, `NFR-91`–`93`** | **Already written at v2.0.0** — 4 FRs, 3 NFRs, §3.4.3, exit criteria 17–20 | Verified present; nothing regenerated |
| **Routing tree past `MAY-06`** | **Already complete at v2.0.0** — `MAY-07` intervention · `MAY-08` protected contact · `MAY-09` appeal · `(common)` · `src/` | Verified present; nothing regenerated |

> **Two of the three asks described a truncated copy, not the file.** Regenerating them would have produced a second, divergent copy of material that already exists. **The third was real and is now closed.**

## 2. `DR-26` — the override, and its limits

**`[SRC-STACK §2]` is formally overridden on one point: the client platform of the four staff portals.** `DR-25` becomes binding.

| Overridden | **Not** overridden |
|---|---|
| Client platform of `REP`, `UCO`, `CON`, `MAY` | **`DR-6`** — the entire backend |
| The matching sentence in `[SRC-SCREEN §5]` | **The 58-screen inventory** — nothing created, retired or renumbered |
| The scope exclusion in `[SRC-CR60 §4]` | **`DR-19`**, and **every permission, capability, scope, state and privacy rule** |

**The override is conditional.** `SC-01`–`SC-12`, `FR-COMMON.23`–`.26` and `NFR-91`–`NFR-96` are **`[MUST]`**, and Phase 2 does not exit without criteria **17–24**. **If those controls are descoped, the override lapses and `RC-23` re-opens.**

> **An override is not an amendment.** `TECHNICAL_STACK v1.3` **still contains the overridden sentence**. Until it is re-issued at v1.4 under a change request, **two approved documents state opposite things, and a reader consulting only `TECHNICAL_STACK` will be misled.** **`TBD-M13` stays open. No source file was modified.**

## 3. The security section says what it cannot do

§7.4.2 opens with the baseline rather than the controls:

- **The bundle is readable by anyone who installs the app.** Every route, screen name, API path and capability name for `MAY` and `STF` is now published. **`R-23` records this and it is not eliminable.**
- **Client-side guards cannot survive a rooted device.** `SC-11` detects and records; **detection is a signal, not a defence**, and is **not** an authorization control.
- **No obfuscation or reverse-engineering claim is made.**

**What `DR-25` actually changed about risk:** it did **not** create a path for a citizen to perform an administrative action — the server refused that before and refuses it now. **It created a published map of the administrative surface, and citizen data co-resident with administrative data in one process.** `SC-01`–`SC-12` address those two and claim nothing more.

## 4. Three real defects found in the process

| # | Defect | How found | Origin |
|---|---|---|---|
| 1 | **Footer read "Specification v1.0.0"** on a file whose Document Control said 2.1.0 | Final-line check | **Carried silently through v1.1.0 and v2.0.0.** The earlier footer check matched *any* occurrence of the version string — including an unrelated `[SRC-CR61 §21]` note — so it passed while the footer was wrong. **Now anchored to the last line** |
| 2 | **Appendix D still claimed "80 allocated" NFRs** and "120 requirements" | New Appendix-D binding checks | A v2.0.0 edit script aborted mid-run on a bad anchor; **its earlier replacements were discarded with it.** Glossary rows for `DR-25` were lost the same way and are now restored |
| 3 | **Three checks matched the wrong occurrence** — `SC-08` from a cross-reference, "Retained, not deleted" from the glossary, "An override is not an amendment" from two places | Self-test misses | **All three now scan only their own section.** Stricter, not looser |

## 5. Counts

| Measure | v2.0.0 | **v2.1.0** |
|---|--:|--:|
| Functional requirements | 124 | **124** |
| NFRs allocated | 83 | **86** |
| Security controls | — | **12** (`SC-01`–`SC-12`) |
| Reconciliations | 23 *(18 open)* | **23** *(**17 open** — `RC-23` closed)* |
| `[TBD]` items | 35 *(32 open)* | **35** *(32 open)* |
| Risks | 22 | **23** |
| Phase-2 exit criteria | 20 | **24** |
| Blockers | 5 | **5** |

**Five Blockers remain** — `RC-07`, `RC-08`, `RC-17`, `RC-18`, `D-14`. **None is affected by `DR-26`.** `ASM-03` and `ASM-04` unchanged: **no SMS provider and no AI provider selected.**

---

*Specified; not implemented; not tested.*
