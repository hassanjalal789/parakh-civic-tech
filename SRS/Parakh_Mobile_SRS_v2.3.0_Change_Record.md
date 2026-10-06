# Mobile SRS v2.3.0 — Change Record

| Field | Value |
|---|---|
| Document | `PARAKH-SRS-MOBILE` |
| From → to | **v2.2.0** (4 Oct 2026) → **v2.3.0** (6 Oct 2026) |
| Author | Hassan Jalal |
| Kind | **MINOR.** Decisions recorded; conflicting requirements amended; superseded text is marked, not deleted. Requirement identifiers and counts are unchanged (124 FR, 86 NFR, 12 SC) |
| Authority | Hassan Jalal's decisions of 6 October 2026, recorded in the repository as `DG-61` to `DG-65` ([`docs/planning/DECISIONS_AND_GAPS.md`](../docs/planning/DECISIONS_AND_GAPS.md)). Two consequent questions are raised, not decided: `DG-66` (`TBD-M16`) and `DG-67` (`TBD-M15`) |
| Files | New: `Parakh_Mobile_App_SRS_v2.3.0.md` (SHA-256 `cbf5d9c5…`). **v2.2.0 is kept unmodified** (SHA-256 `74882c31…`) as the superseded baseline |
| Method | 65 exact replacements from v2.2.0, each asserted to match once |

## 1. The decisions

| ID | Decision of 6 October 2026 |
|---|---|
| `DG-61` | **The reporter can enter the report text by speaking or by typing** — two equal ways; neither is forced. Typing is no longer only a fallback |
| `DG-62` | **Report text in Urdu and English.** The reporter reviews and confirms their own transcription and every translated version before final submission. **AI and automated validation run on the server only**; that processing is temporary processing, not submission. **AI never silently changes confirmed text, never approves a report and never replaces Street Representative or UC Officer verification**; any proposed text change needs the reporter's confirmation |
| `DG-63` | **No application-managed encryption for local drafts and their media** — `DR-23` superseded for them; no draft-unlock key and no lost-key reset. Tokens in secure storage, HTTPS, account isolation, server authorization and the operating system's protections are unchanged. **The citizen's captured file is used directly.** Existing encrypted drafts are handled safely, never wiped silently |
| `DG-64` | **An unsubmitted draft and its local media are deleted 2 days after the draft was created**; editing or reopening never extends that |
| `DG-65` | **Submission only when the reporter presses Submit after reviewing.** Failed submission is retried for 48 hours from the first attempt; retries stop on confirmed success or cancellation; duplicates are prevented; a lost response is told apart from an unsubmitted draft, with a status check before a retry or a deletion |
| `DG-56` | **Unchanged:** Street Representative first, then UC Officer |
| `DG-57` | **Unchanged and still proposed:** server clean-up timing stays separate from the 48-hour retry rule; the 72-hour value is not approved |

## 2. How the decisions were applied — readings recorded, not new decisions

| Point | Reading in v2.3.0 | Why |
|---|---|---|
| "Their own transcription" | The **transcription** — the reporter's words as text, in the language used — is shown and confirmed. The **raw intermediate speech-recognition output** (model-specific, possibly mixed scripts) **stays internal**, as before | The decision requires confirming the transcription. Keeping the raw output internal preserves `FR-PUB.16`'s reason: one authoritative set of texts |
| A text in two languages | Every rendering version holds three texts — the **transcription**, the **Urdu text** and the **English text** — under **one content hash**, so one confirmation covers all three. Identical texts may be shown once | "Confirm their own transcription and any translated version" |
| Corrections | **AI never overwrites a text the reporter wrote or corrected.** When the reporter corrects one text, the server may re-derive the other AI-produced texts; that is a new version that the reporter must confirm | "Any proposed text change requires citizen confirmation" |
| Why a file exists | The camera writes each photo to a file; a video is recorded only to a file; the recorder writes the voice to a file. An in-memory picture reference cannot survive an app restart, and a draft must survive restarts for up to 2 days. **The smallest exception is the capture module's own file**: the voice recording is written straight into app-private storage, and a photo or video is moved (renamed) out of the cache into app-private storage. Nothing is copied, re-encoded or encrypted | The decision asked for this check before any file is kept, and forbids claiming a file-free implementation |
| `NFR-8` (downscale before upload) | Amended: photos are **sized at capture** by the camera's quality and picture-size settings; **no downscaled copy** is made or uploaded | A downscaled copy would be an extra copy, and it would no longer match the hash computed at capture |
| `LDS-3` (pre-authentication consent) | `DR-23` still governs it **if** it is ever persisted. At v2.3.0 it is held in memory only and sent with the OTP request | The decision covers drafts and their media only |
| `SC-10` and the `DR-26` condition | `SC-10` amended. **Whether the amendment lapses `DR-26` is reserved to the Project Lead** — `TBD-M16` (`DG-66`) | `DR-26` is conditional on `SC-01`–`SC-12` |
| A submission unconfirmed after 48 hours | Kept, labelled *not confirmed*, with a server check before another attempt (`DG-14`); **no upper bound is invented** — `TBD-M15` (`DG-67`) | `DG-64` covers drafts whose Submit was never pressed |
| The expiry timestamp | `expires_at = created_at + 48 hours` (172,800 s), set at creation from the device clock in UTC, never changed. A user who changes the device clock can move the deletion earlier or later | "Document the exact expiry timestamp used" |
| Encrypted drafts from the 5 October build | Moved once into the new store with their original `created_at`; the old database, media and key are removed only after the copy is verified; a store whose key cannot be read is left untouched | "Handle any existing encrypted drafts safely; do not silently wipe existing user data" |

## 3. Changes, by section

| Section / requirement | v2.2.0 | v2.3.0 | Decision |
|---|---|---|---|
| Document Control | Version 2.2.0 | Version 2.3.0, 6 Oct 2026; status and implementation status updated (an emulator run; the 5 October store superseded); change-history row | — |
| §2.3.3 low-end devices | Images downscaled before upload | Images sized at capture, no second copy | `DG-63` |
| §2.7 `DEP-08` | SQLCipher verification must be discharged before `G3` | Superseded for drafts and media; applies again only if `LDS-3` is persisted | `DG-63` |
| §3.2 diagram, §3.2.1 module table, §3.3 folder tree | SQLCipher, key in SecureStore, encrypted before write | Note under the diagram; the encryption row marked superseded (SQLCipher kept only to move the old drafts); tree comments updated | `DG-63` |
| §3.4.3.2 wipe, steps 4–5 | Purge decrypted buffers; release SQLCipher and drop the key | Purge in-memory buffers; release the draft database connection | `DG-63` |
| §3.4.3.3 not wiped | Drafts encrypted at rest | Drafts bound to the account, kept only within their lifetime | `DG-63`, `DG-64` |
| §3.6.1 offline table | AI transcription and Urdu rendering | AI transcription, Urdu and English text | `DG-62` |
| §3.6.3 storage boundary | `LDS-2`/`LDS-3` under SQLCipher, `LDS-4` encrypted, a DB key in `LDS-1` | No DB key; `LDS-2` and `LDS-4` app-private without application encryption; `LDS-3` note; notes on the decision, the necessary file and the transition | `DG-63` |
| §3.6.3.1 `DR-23` | In force | **Superseded for drafts and their media**; the record kept unchanged as history | `DG-63` |
| §3.6.4 synchronisation rules | Retry-window row | **New rows:** explicit submission, status check, draft lifetime, server clean-up. Retry-window row: retries stop on success or cancellation | `DG-64`, `DG-65`, `DG-57` |
| §4.1.2 `CIT-08`, `CIT-09`, `CIT-11` | Encrypted storage; voice primary; confirm the rendering | The captured file in app-private storage; speak or type; confirm all three texts, then Submit | `DG-61`–`DG-65` |
| §5.2.3 heading | Voice-first reporting — the primary description path | Spoken or typed reporting — two equal ways | `DG-61` |
| `FR-PUB.9` | Voice primary; "type instead" a fallback | **Speaking and typing are both offered**; neither required | `DG-61` |
| `FR-PUB.12` | Typed fallback when the microphone is unavailable | **Typed report text** at any time; never altered by AI; Urdu and English versions confirmed | `DG-61`, `DG-62` |
| `FR-PUB.13` | The rendering is always Urdu script | The report text is produced in **both Urdu and English** | `DG-62` |
| `FR-PUB.14` | No transcription or rendering on the device | Also no translation or automated validation on the device; processing is temporary, not submission | `DG-62` |
| `FR-PUB.16` | Three artefacts; no ASR output shown | Five artefacts; the transcription, the Urdu text and the English text shown and confirmed; the raw output internal | `DG-62` |
| `FR-PUB.19` | A correction is a new version | Plus: AI never overwrites the reporter's text; AI re-derivations are new versions needing confirmation; nothing changes confirmed text, approves a report or replaces verification | `DG-62`, `DG-56` |
| `FR-PUB.20` | Preserve the encrypted draft | Preserve the draft | `DG-63` |
| `FR-PUB.21` | Eight confirmation fields | **Nine**: plus `reviewed_texts`; the content hash covers all three texts | `DG-62` |
| `FR-PUB.26`, `FR-PUB.27` | The Urdu rendering | The transcription, the Urdu text and the English text | `DG-62` |
| `FR-PUB.28` | 48-hour retry | **Never automatic before Submit**; status check before a retry or a deletion; retries stop on success or cancellation. New criteria | `DG-65` |
| `FR-COMMON.12` | Delete a local item only after confirmed receipt | That rule for submitted items; **an unsubmitted draft is deleted at the end of its 2-day lifetime**. New criteria | `DG-64`, `DG-65` |
| `FR-COMMON.13` | Survives termination and restart | For as long as it is kept | `DG-64`, `DG-65` |
| `FR-COMMON.25` | "…and stay unreadable"; source `DR-23` | "…and stay closed to another principal"; enforced by the account binding, not by encryption | `DG-63`, `DG-64` |
| §6.3 local data | SQLCipher, encrypted media, a DB key | `expo-sqlite` app-private, the captured files, no key; `expires_at` | `DG-63`, `DG-64` |
| §6.4.1 retention | — | Two rows: the unsubmitted local draft (2 days) and the local copy of a submitted draft (`TBD-M15`) | `DG-64`, `DG-65` |
| `NFR-8` | Downscale before upload | Sized at capture, no copy | `DG-63` |
| `NFR-48` | Queue encrypted with a keystore key | Tokens in the keystore; the queue app-private, account-bound and lifetime-limited | `DG-63` |
| `SC-10` | Local data at rest is encrypted | Local data at rest is protected — tokens in the keystore; drafts app-private, account-bound, out of backups, lifetime-limited; `TBD-M16` | `DG-63` |
| §11.2 `R-19`, §11.3 `RC-16` | SQLCipher risk High | Superseded for drafts; risk Low | `DG-63` |
| §11.1, §11.4 | 35 `[TBD]`, 29 open | **37 `[TBD]`, 31 open**: `TBD-M15`, `TBD-M16` opened | `DG-66`, `DG-67` |
| §12 glossary, Appendices D, E, F | — | Glossary: transcription, English text, draft lifetime; counts; F.0 for v2.3.0 (the v2.2.0 table becomes F.0.1) | — |

## 4. Not changed

- **No requirement removed or renumbered.** 124 FR, 86 NFR, 12 SC.
- **No authorization rule and no state-machine transition changed.** The verification sequence (`DG-56`) is confirmed again.
- **The photo and video bounds are unchanged:** 1–3 live photos and one optional live video of up to 60 seconds.
- **Tokens stay in `expo-secure-store`**; HTTPS, account isolation and server authorization are unchanged.
- **The four remaining Blockers stay open:** `RC-07`, `RC-08`, `RC-17`, `RC-18`. **`DG-41`** (the Urdu-text reviewer) is unaffected.
- **v2.2.0 is retained unmodified** as the superseded baseline.
