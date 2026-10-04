# Parakh Mobile SRS v1.1.0 — Change Record and Audit

| Field | Value |
|---|---|
| **File** | `docs/srs/Parakh_Mobile_App_SRS_v1.1.0.md` |
| **Version** | **1.1.0** — MINOR *(supersedes v1.0.0; v1.0.0 retained unmodified)* |
| **Bytes** | **352172** *(v1.0.0: 325,942)* |
| **Lines** | **4395** |
| **sha256 (16)** | `1fab42a086d2ef35` |
| **Date** | 13 September 2026 |
| **Audit** | **144 checks · 144 pass · 0 fail** · **24/24 planted defects detected** |
| **Status** | **Specified; not implemented; not tested.** |

> **MINOR is the correct increment.** **No requirement was removed and none was reversed.** Four decisions were added, one endpoint was reclassified, and five conflicts were closed. Per §1.2.3, **every identifier survives** — resolved rows keep their IDs and record how they closed.

---

## 1. The five resolutions

| # | Conflict | Decision | Where | Effect |
|---|---|---|---|---|
| 1 | **`RC-05`** — `API-120` required the header it existed to obtain | **`DR-22`** — sixth transport class **`Staff-pre-role`**; `D-04` and `D-05` **formally approved**; `API-120` reclassified; `acting_role_assignment_id` **nullable** | §4.3.1 · §4.3.1.1 | **One Blocker cleared.** Zero-capability session reaching exactly `API-125`, `API-120`, `API-004` |
| 2 | **`RC-16`** — encryption asserted, no mechanism named | **`DR-23`** — **`expo-sqlite` compiled against SQLCipher** (`useSQLCipher: true`), 256-bit `expo-crypto` key held **only** in `expo-secure-store`, `PRAGMA key` first, **`LDS-4` encrypted before write**, **fail closed** if the key is unreadable | §3.6.3.1 · §6.3 · `NFR-48` | **`D-10` closed.** **`DEP-08` stays open** — a decision is not a build |
| 3 | **`RC-02`** — no iOS target anywhere | **`DR-24`** — **iOS 16.4**, inherited from the pinned Expo SDK 57 | §2.4.1 · §2.4.1.1 · `NFR-74` | **`TBD-M6` closed.** `NFR-74` moves to **[MUST] · P1** |
| 4–5 | **`RC-01` / `RC-04`** — two interfaces or five portals; is the portal React Native? | **`DR-21`** — **no `STF-*` screen is built in React Native in any phase.** I-2 is the existing **Django/HTMX** portals | §1.4.3.1 · §5.3 · §8.3 · §8.4 | **40 screens of Phase 2/3 React Native scope deleted.** `[SRC-STACK §2]` upheld unchanged |

### 1.1 One instruction was carried out differently, and why

> The brief proposed **`expo-sqlite/kv-store`** for `LDS-2` and `LDS-3`.

**`expo-sqlite/kv-store` is an AsyncStorage-compatible key–value API built on SQLite. It is not an encryption provider and encrypts nothing.** Writing it into `NFR-48` would have produced a requirement that cannot be satisfied — precisely the failure `D-10` was raised to prevent, and the same class of defect as the original *"encrypted"* assertion.

The brief allowed *"or an equivalent React Native SQLite encryption library"*. **`DR-23` uses SQLCipher on the already-selected `expo-sqlite` module**, which:

- adds **no new dependency**;
- requires a **prebuild**, which Parakh already mandates (`[SRC-STACK §1]`);
- is **unavailable in Expo Go**, which Parakh already excludes;
- keeps `expo-secure-store` to **keys only, never media** — the boundary at `[SRC-STACK §4]`.

**The correction is recorded in the document itself (§3.6.3.1), not applied silently.**

## 2. Verification performed before writing

| Claim | Verified against | Result |
|---|---|---|
| Minimum iOS deployment target for Expo SDK 57 | Expo changelog — SDK 56 raised it from 15.1; SDK 57 is an RN-only bump listing no platform change | **iOS 16.4**, recorded with a **re-confirmation obligation** against the generated Podfile before the first iOS build |
| `expo-sqlite` supports SQLCipher | Expo SQLite documentation | **Yes** — Android, iOS, macOS; `useSQLCipher` config + prebuild; `PRAGMA key` after open; **not in Expo Go** |
| `expo-sqlite/kv-store` is an encryption library | Same | **No** — it is a key–value API. **Proposed mechanism corrected** |
| Known risk on the chosen mechanism | `expo/expo#39792` | **Android 16 KB memory-page-size issue** — recorded as **`R-19`**, gated at `G3` |

## 3. What got worse, stated plainly

| Item | Detail |
|---|---|
| **Two new `[TBD]` items** | **`TBD-M11`** — pre-role session timeout; `D-05` proposes *"a short timer"* with **no value**, and no source states one. **`TBD-M12`** — **`API_CONTRACT` must go to v3.1**, `TECHNICAL_STACK` must record `DR-23`/`DR-24`, and `app.config.ts` must add the iOS target and `useSQLCipher`. **None of those files is touched by this SRS** |
| **Two new risks** | **`R-19`** SQLCipher may not build cleanly under SDK 57. **`R-20`** iOS 16.4 and Android 7+ are **one year apart by release date but not equivalent in reach** — no parity claim is made |
| **Staff capability reduced** | Under `DR-21`, staff get a **web** experience on mobile: no push to staff, no native camera on `STF-10`, no offline anything. **Accepted by decision, not presented as neutral** |
| **Upstream documents now lag this SRS** | Three files are behind. Recorded, not fixed |

## 4. What did not change

| Still true after v1.1.0 |
|---|
| **Five Blockers remain** — `RC-07` *(citizen name)*, `RC-08` *(contractor organisation self-dealing)*, `RC-17` *(staff-official report stalls forever)*, `RC-18` *(staff reporter cannot see their own report)*, and `D-14` *(mandatory photo)*. **None depends on client technology; `DR-21` does not touch them** |
| **17 of 22 conflicts open · 30 of 33 `[TBD]` items open** |
| **`ASM-03` and `ASM-04` — no SMS provider and no AI provider are selected.** With under seven weeks to 1 November, **a citizen still cannot authenticate and the voice path still cannot produce a report** |
| **No source document was modified.** **No code exists.** No test has been written or executed |

## 5. Counts, recomputed

| Measure | v1.0.0 | **v1.1.0** | Arithmetic |
|---|--:|--:|---|
| Functional requirements | 120 | **120** | unchanged |
| NFRs allocated | 80 | **80** | unchanged; `NFR-74` gains a value |
| Transport classes | 5 | **6** | `5 + 1` |
| Decision records | `DR-1`…`DR-20` | **`DR-1`…`DR-24`** | `+4` |
| Reconciliations | 22 | **22** *(5 resolved · **17 open**)* | rows never deleted |
| `[TBD]` items | 31 | **33** *(3 resolved · **30 open**)* | `24 + 9` |
| Risks | 18 | **20** | `+ R-19, R-20` |
| Blockers | 6 | **5** | `4` cells `+ 1` rule |
| Sign-off rows | — | **7** | `TBD-M1`…`TBD-M7` · 1 resolved · 6 open |

## 6. Audit

**144 checks · 144 pass · 0 fail. 24/24 planted defects detected.**

**Three real stale markers were found and fixed** — `RC-02` in §1.4.1, `RC-05` in §3.5, and `RC-05` again on the `AuthSession` row in §6.2.9 — each still carrying an open `[NEEDS RECONCILIATION]` after the conflict had been resolved elsewhere. **Two check defects were repaired**: a section-range bug in the sign-off-matrix row count, and a scan that matched the `DR-` decision blocks instead of the register table. **The register scan is now section-scoped, which is stricter.**

New checks added at v1.1.0 verify: the transport table has **exactly six** rows · **exactly the five intended** RCs are marked resolved and **seventeen are not** · the `kv-store` correction is present · the iOS value carries its verification basis · the sign-off matrix has seven rows and names `TBD-M1`–`TBD-M7` · **`DEP-08` is still described as open** · **the upstream lag is recorded rather than claimed fixed**.

---

*Specified; not implemented; not tested.*
