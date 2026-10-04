# Mobile SRS v2.2.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.1.0** (14 Sep 2026) → **v2.2.0** (4 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** Decisions recorded and TBD items resolved; no approved requirement removed or reversed. Requirement identifiers and counts are unchanged (124 FR, 86 NFR, 12 SC) |
| Authority | Hassan Jalal's decisions of 4 October 2026, recorded in the repository as `DG-09`, `DG-14`, `DG-47`, `DG-53`, `DG-54`, `DG-55` and `DG-56` ([`docs/planning/DECISIONS_AND_GAPS.md`](../docs/planning/DECISIONS_AND_GAPS.md)) |
| Files | New: `Parakh_Mobile_App_SRS_v2.2.0.md`. **v2.1.0 is kept unmodified** as the superseded baseline, as the SRS's own version rule requires |

## 1. The decisions

| ID | Decision of 4 October 2026 |
|---|---|
| `DG-47` | **1–3 live photos per report**: at least one, at most three, through the in-app camera. Enforced in the interface and on the server. It decides **`D-14` (Branch A)** and closes **`TBD-M9`** |
| `DG-09` | **Superseded by `DG-47`.** The 3 October decision had made the photo optional. Photos are now mandatory, and `E_EVIDENCE_REQUIRED` applies to citizen intake again |
| `DG-54` | **One optional live video of up to 60 seconds**, through the in-app camera, under the live-capture rule. It never replaces the photos. The duration is enforced on the device and on the server |
| `DG-55` | **Unfinished drafts stay on the device.** Server uploads before final submission are **temporary processing data**. Cancellation stops processing and deletes the temporary content, the uploaded media and all derived content. Submitted reports and their protected evidence are preserved. A cancellation racing a successful submission returns the existing reference |
| `DG-14` | **Automatic submission retry for 48 hours** from the citizen's first final-submission attempt, with the same identifier and idempotency key. After that: automatic retries stop, the draft is kept, the citizen is told plainly that submission was not confirmed, and the server is checked for an existing report before another attempt |
| `DG-53` | **A typed description gets an Urdu-script rendering and the reporter's confirmation**, exactly as a voice description does. The typed fallback stays |
| `DG-56` | **Verification sequence:** the Street Representative verifies first; the UC Officer then reviews and accepts, before contractor assignment or any later stage. No verification stage is skipped. **`DG-41` (the Urdu-text reviewer) stays open** |

## 2. Changes, by section

| Section / requirement | v2.1.0 | v2.2.0 | Decision |
|---|---|---|---|
| Document Control | Version 2.1.0; "not implemented" | Version 2.2.0, dated 4 Oct 2026. Implementation status: partly implemented in a development build, not deployed, not tested on a device. A change-history row is added | — |
| §3.6.4 synchronisation rules | No retry-window row | **Retry window** row: 48 hours | `DG-14` |
| §4.1.2 screens `CIT-08`, `CIT-09`, `CIT-12` | — | `CIT-08`: 1–3 photos plus an optional 60-second video. `CIT-09`: typed text rendered and confirmed like voice. `CIT-12`: 48-hour retry; Cancel deletes the temporary uploads | `DG-47`, `DG-54`, `DG-53`, `DG-14`, `DG-55` |
| §4.3.4 `E_EVIDENCE_REQUIRED` | "Branch depends on `D-14`" | Applies: 1–3 photos | `DG-47` |
| `FR-PUB.4` live capture | Photos only implied | Photos and one optional live video of up to 60 s. New criteria: recording stops at 60 s, and longer videos are refused on the device and the server | `DG-54` |
| `FR-PUB.5` hash at capture | "a photograph" | "a photograph or a video" | `DG-54` |
| `FR-PUB.6` bounds | "the approved photo-count bounds", plus the `TBD-M9` note | **1–3 photos; at most one video of up to 60 s**, enforced in the interface and on the server. New criterion: a fourth photo or a second video is refused. `TBD-M9` marked resolved | `DG-47`, `DG-54` |
| `FR-PUB.7` camera denied | "offer the manual path" | Clarified: the manual path keeps the draft and guides the citizen to grant permission. No report without a photo | `DG-47` |
| `FR-PUB.8` mandatory photo | Both branches, neither approved; phase `P?` | **Branch A chosen**, with at most three photos; phase **P1**. The Branch B criteria and the "until decided" criterion are retired | `DG-47` (`D-14`) |
| `FR-PUB.12` typed fallback | Fallback only | Typed text is rendered on the server, labelled AI-generated, and confirmed before any report exists | `DG-53` |
| `FR-PUB.16` artefacts | Voice only | Note: for a typed description, the typed text is the authoritative source and no ASR output exists | `DG-53` |
| `FR-PUB.20` AI failure | The recording is preserved | The recording, or the typed text, is preserved | `DG-53` |
| `FR-PUB.27` preconditions | Evidence validation unspecified | Evidence validation means 1–3 photos and at most one 60-second video. New criterion: no photo gets `E_EVIDENCE_REQUIRED` | `DG-47` |
| `FR-PUB.28` idempotent submission | Retry, no window | **48-hour** automatic retry, then stop, keep, inform and check. New criteria | `DG-14` |
| `FR-PUB.29` waiting to send | "offer retry, edit and cancel" | Cancel before final submission deletes the temporary server data and derived content. A cancellation after a successful submission shows the existing reference. New criteria | `DG-55` |
| `FR-COMMON.12` queue | Retry with backoff | Adds the 48-hour retry for a submitted report; unfinished drafts stay on the device | `DG-14`, `DG-55` |
| §6.2.4 `ClientSubmission` retention | "while the retry window is open — TBD" | Temporary processing data until final submission, cancellation or expiry. A submitted draft row is kept with its report | `DG-55`, `DG-57` (proposed) |
| §6.2.5 `VoiceTranscriptionArtifact` | Voice source only | The artefact can also carry a typed source: `source_audio_evidence_id` null, no ASR output | `DG-53` |
| §6.2.8 state machine | — | Note recording the verification-sequence decision | `DG-56` |
| §6.2.9 `EvidenceObject` | Write-once storage | Write-once **from final submission**. Before it, uploads are temporary processing data | `DG-55` |
| §6.4.1 retention table | `ClientSubmission` row: TBD | Two rows: temporary data (deleted on cancellation or expiry) and the submitted draft row (kept with the report) | `DG-55` |
| §8.1 gate `G2`, §10.3 exit criterion 15, §11.2 `R-04`, §11.3, §11.3.1 | Five Blockers remain | **Four Blockers remain** — `D-14` decided | `DG-47` |
| §9.1 traceability, `FR-PUB.8` | `P?` | **P1** | `DG-47` |
| §11.1, §11.4 `[TBD]` counts | 32 open | **29 open**: `D-14`, `TBD-M9` and the `ClientSubmission` retry window resolved | `DG-47`, `DG-14` |
| §12 Appendix A glossary | — | Adds *Temporary processing data* and *Sealing* | `DG-55` |
| §12 Appendices D, E | 32 `[TBD]` open, 5 Blockers | 29 open, 4 Blockers | — |
| §12 Appendix F honest status | "None exists" | A development build exists. No APK, IPA or device run. Automated tests only. Adds F.0 | — |

## 3. Not changed

- **No requirement removed or reversed.** Identifiers and counts are unchanged.
- **No authorization rule** and **no state-machine transition** changed. `DG-56` confirms the existing order.
- **The four remaining Blockers stay open:** `RC-07`, `RC-08`, `RC-17`, `RC-18`.
- **`DG-41` is not affected:** the Urdu-text reviewer is still to be named.
- **v2.1.0 is retained unmodified** as the superseded baseline.
