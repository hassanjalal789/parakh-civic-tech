# Parakh Mobile SRS v2.0.0 — Change Record and Audit

| Field | Value |
|---|---|
| **File** | `docs/srs/Parakh_Mobile_App_SRS_v2.0.0.md` |
| **Version** | **2.0.0** — **MAJOR** *(v1.1.0 retained unmodified)* |
| **Bytes · Lines** | **387000** · **4720** |
| **sha256 (16)** | `e6739d21b16ea4c4` |
| **Date** | 14 September 2026 |
| **Audit** | **165 checks · 165 pass · 0 fail** · **33/33 planted defects detected** |
| **Status** | **Specified; not implemented; not tested.** |

> **MAJOR, not MINOR.** §1.2.3 makes **reversal of an approved requirement** a MAJOR increment, and `DR-21` — approved less than 24 hours earlier — is reversed in full. **v1.1.0 is preserved unmodified.**

---

## 1. `DR-25` — the Unified Binary Architecture

**All 58 approved screens now ship in one React Native binary.** The inventory total is unchanged; **the binary's share moves 23 → 58**.

| Layer | Change |
|---|---|
| **§3.2 Presentation** | Expanded to **Citizen · Staff (`STF-01`…`STF-10`) · Mayor & Operations** plus `REP`, `UCO`, `CON`. Counted: `12 (auth) + 18 (citizen) + 19 (staff) + 9 (mayor) = 58` |
| **§3.2.2 Transport** | **Four role-specific interceptor profiles** — `citizen`, `staff-pre-role`, `staff`, `mayor`. **`X-Acting-Role-Assignment-ID` retained exactly as specified.** Exactly one profile active; **never composed or unioned** |
| **§3.3 Route tree** | **`app/(auth)` secure gateway** + isolated **`(citizen)`**, **`(staff)`**, **`(mayor)`**. No group mounts until the gateway resolves a principal; the gateway **fails closed** |
| **§3.4.3 State** | **Namespaced Zustand per principal · one `QueryClient` per principal · eight-step ordered fail-closed wipe protocol** on every transition |

**New requirements:** `FR-COMMON.23`–`.26` · `NFR-91`–`NFR-93`. **New tests:** `AT-COM-023`–`026`. **New exit criteria:** 17–20.

## 2. Three judgements worth challenging

| # | What I did | Why |
|---|---|---|
| 1 | **Made this 2.0.0, not the implied minor bump** | The document's own rule leaves no discretion. Reversing `DR-21` is a MAJOR event, and labelling it otherwise would make the version string lie |
| 2 | **Opened `RC-23` rather than quietly complying** | `[SRC-STACK §2]`: *"The four staff portals are **not** migrated to React Native."* `[SRC-CR60 §4]` puts them explicitly out of scope. **`DR-25` overrules an approved source this SRS does not own.** Recording that is the whole discipline of this project — the alternative was a spec that silently contradicts its own authority. **Closing it needs `TECHNICAL_STACK` v1.4 and a change request — `TBD-M13`** |
| 3 | **Wrote `MAY-01`…`MAY-09` as pre-existing, not "newly added"** | They have been in the approved inventory since Screen Inventory v1.0 `[SRC-SCREEN §5.5]`. **`DR-25` adds them to the binary, not to Parakh.** No `MAY-*` identifier was created or renumbered |

## 3. What this costs

| Cost | Detail |
|---|---|
| **`R-21` — 35 screens of scope return** | `DR-21` deleted them and called that *"the single largest risk reduction available"*. **Reversing it restores that risk in full.** It lands in **P2/P3, after the 1 November submission — P1 is untouched** |
| **`R-22` — citizen data now co-resident with administrative authority** | A residual cache entry surviving a logout is **a rendered privacy breach**, not a stale list. §3.4.3 exists solely because of this, and exit criteria 17–20 exist because it cannot be assumed |
| **`RC-23` opened** | Two approved documents now state opposite things. **`[SRC-STACK §2]` remains the approved source until amended** |
| **`TBD-M14` opened** | The backgrounding threshold that triggers a wipe. **No source states a value and none was invented** |

## 4. What it buys

**`RC-10` is resolved favourably — the only conflict this revision closes without cost.** The `STF-10` offline-recording claim was contradictory *only* because the staff portals were Django/HTMX with no offline queue. **On React Native it becomes satisfiable**, and `D-11`'s online-only workaround is no longer needed. Staff also gain one evidence pipeline instead of two, native camera for verification, and push to staff queues.

## 5. What did not change

**Five Blockers remain** — `RC-07`, `RC-08`, `RC-17`, `RC-18`, `D-14`. **None depends on client technology; `DR-25` does not touch them, exactly as `DR-21` did not.** `ASM-03` and `ASM-04` are unchanged: **no SMS provider and no AI provider are selected.** **No source document was modified. No code exists.**

## 6. Counts

| Measure | v1.1.0 | **v2.0.0** |
|---|--:|--:|
| Functional requirements | 120 | **124** |
| NFRs allocated | 80 | **83** |
| Acceptance tests | 119 | **123** |
| Screens in the binary | 23 | **58** *(of 58 approved — inventory unchanged)* |
| Decision records | `DR-1`…`DR-24` | **`DR-1`…`DR-25`** |
| Reconciliations | 22 *(17 open)* | **23** *(**18 open**)* |
| `[TBD]` items | 33 *(30 open)* | **35** *(**32 open**)* |
| Risks | 20 | **22** |
| Blockers | 5 | **5** |

## 7. Also corrected

**A stale footer in v1.1.0** read *"Specification v1.0.0"* after the version had been bumped in Document Control. **Fixed in place**; v1.1.0 is otherwise byte-identical and still passes its own audit. A matching check now binds the footer to Document Control so it cannot drift again.

---

*Specified; not implemented; not tested.*
