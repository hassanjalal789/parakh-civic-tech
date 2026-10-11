# SRS folder — what to read and what is history

Every file in this folder was copied **unchanged** on 2026-10-03. Nothing here has been edited to fit a later decision.

The full register, with hashes, versions, read limitations and missing sources, is [`docs/planning/SOURCE_REGISTER.md`](../docs/planning/SOURCE_REGISTER.md).

## Active — read these

| File | Governs |
|---|---|
| `Parakh_Mobile_App_SRS_v2.8.0.md` | Mobile client, all 58 screens in one React Native app (`DR-25`/`DR-26`), the 124 FR / 86 NFR baseline, phases, with Hassan's decisions of 4 Oct 2026 (photos, video, temporary data and cancellation, retry window, typed renderings, verification sequence) and 6 Oct 2026 (speech or typing, Urdu and English text confirmed by the reporter, no app encryption for drafts, a 2-day draft lifetime, explicit submission) and 7 Oct 2026 (a pending submission deleted 48 hours after Submit and shown apart from drafts, server clean-up after 72 hours without activity, no backups of local data; `DR-26` confirmed in force, with `SC-10` amended for citizen-side drafts and pending submissions) and 11 Oct 2026 (the first version's location by GPS and directional buttons with no map provider, a video includes sound, the capture settings kept; the conflicting `CIT-10` text opened as `TBD-M18`), and later on 11 Oct 2026 (location by GPS, else the last known position, else a written description, with the measured and adjusted positions both kept; recordings of at most 3 minutes, MPEG-4 audio only; typed text kept exactly as written; `TBD-M18` resolved, the `NFR-28` conflict opened as `TBD-M19`), and lastly on 11 Oct 2026 (the location may be described by voice, `NFR-28` preserved; staff see the measured and the final position distinctly; the `CIT-10` settings; `TBD-M19` resolved, `TBD-M20` opened for contractors). **Draft: awaiting approval.** Changes: `Parakh_Mobile_SRS_v2.8.0_Change_Record.md` |
| `CR_MOBILE_OTP_AND_FIVE_PORTAL_IDENTITY_MODEL.md` | CR-61 rev 1.3: identity, OTP accounts, five portals, reporting model, state machine |
| `RBAC_AND_SCOPE_MATRIX.md`, `DATA_MODEL_AND_IDENTITY_SCHEMA.md`, `API_CONTRACT.md`, `SCREEN_INVENTORY_AND_NAVIGATION.md`, `TECHNICAL_STACK.md`, `TEST_CATALOGUE_IDENTITY_FOUNDATION.md` | Permissions, entities, endpoints, screens, stack, planned tests. **These are copies edited in place in another workspace on 2026-10-03; the v1.3 originals are lost. Read them with [`docs/planning/RECONCILIATION_2026-10-03.md`](../docs/planning/RECONCILIATION_2026-10-03.md), which says which 3 Oct changes are accepted, deferred or rejected** |
| `CR-60_REACT_NATIVE_MIGRATION.md` | DR-19 React Native (approved 20 Aug 2026) |
| `00`–`11_*USE_CASE*.md` | Use-case pack 1.0: actor behaviour, journeys, workflows, decisions `D-01`…`D-15`. **Its "staff portals are Django/HTMX" column is superseded by `DR-25`** |

## Historical — preserved, not to be implemented

| File | Why it is history |
|---|---|
| `AUTHENTICATION_AND_INCIDENT_REPORTING_USE_CASES.md` | Anonymous-reporting model (CR-59), superseded by CR-61 |
| `DATABASE_ARCHITECTURE.md` (v2.4) | Pre-CR-61 37-entity model; not compatible with the identity model |
| `Parakh_Prototype_SRS_v1.3.7.md`, `Parakh_Release_0_Build_Specification_v1.1.md` / `v1.2.7.md`, `Parakh_v1.3.7_Consistency_Audit.md` | Moderator/Administrator, Flutter-era baseline |
| `Parakh_Use_Case_Document_v1.0.pdf`, `Parakh_User_Training_and_Operations_Manual_v1.0.pdf`, `Parakh_Developer_Director_Handoff_v1.2.1_FINAL.pptx` | Derived from Master Document v1.2.1 (Moderator, student track, Flutter) |
| `CR-59_ANONYMOUS_CITIZEN_REPORTING.md`, `Parakh_Prototype_SRS_v1.4.2.md`, `AUTHENTICATION_ROLE_ASSIGNMENT_AND_ANONYMOUS_REPORTING.md` | Anonymous-model baseline (CR-59), superseded by CR-61. SRS v1.4.2 is still the source of legacy `NFR-*`/`BR-*` text |
| `Parakh_Mobile_App_SRS_v2.7.0.md` | **Superseded by v2.8.0 on 2026-10-11** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.6.0.md` | **Superseded by v2.7.0 on 2026-10-11** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.5.0.md` | **Superseded by v2.6.0 on 2026-10-11** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.4.0.md` | **Superseded by v2.5.0 on 2026-10-07** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.3.0.md` | **Superseded by v2.4.0 on 2026-10-07** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.2.0.md` | **Superseded by v2.3.0 on 2026-10-06** and kept unmodified as its baseline |
| `Parakh_Mobile_App_SRS_v2.1.0.md` | **Superseded by v2.2.0 on 2026-10-04** and kept unmodified as its baseline |
| `CHANGE_MANIFEST_CR61_r1.3.md`, `Parakh_Mobile_SRS_v*_Change_Record.md` | Change history. The CR-61 manifest proves which v1.3 bytes existed. The v2.2.0 to v2.8.0 records list the 4, 6, 7 and 11 Oct 2026 changes |
| `PARAKH_IMPLEMENTATION_READINESS_PACK_v1.0.md` | **AI-authored proposals** (14 Sep). Nothing in it is a decision of Hassan's unless he adopts it (`DG-51`) |
| `Parakh_Roadmap_One_Page_Summary.md`, `Parakh_Execution_and_Responsibility_Roadmap_2026.pdf`, `Parakh_Execution_Ownership_and_Evidence_Plan.pptx` | Assume an external developer and a 10 Oct 2026 deadline. Superseded by the sole-developer instruction of 2026-10-03; their evidence and proof-chain principles survive. The roadmap PDF and the evidence-plan deck are kept locally and are not in the repository |

## Local-only files (ignored by Git)

| File | Why it is not committed |
|---|---|
| `SOURCE_IMPORT_MANIFEST.md` | Import record that names unrelated personal files it excluded |
| `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `pilot-scope.md`, `bug-report.md`, `development-task.md`, `pull_request_template.md` | Snapshot copies of files tracked elsewhere in this repository: byte-identical to commit `4196969`, except `CONTRIBUTING.md`, from which two statements were removed on 2026-10-04 at Hassan's instruction |

## Missing

The **v1.3 / v3.0 / v1.0 originals** of the six specifications the SRS cites are still missing. Only their copies edited on 2026-10-03 (above) exist. See `DG-05`.
