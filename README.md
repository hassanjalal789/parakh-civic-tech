# Parakh

An evidence-first, voice-enabled civic reporting prototype for public-service issues in Punjab, Pakistan.

**Status:** Early prototype development. No government or NGO partnership, deployment, or demonstrated impact is currently claimed.

## What Parakh is

Residents report a civic problem by **speaking** — in Urdu, Punjabi, English or a mix — and by capturing **live** photo evidence. Parakh preserves the evidence and produces an Urdu-script rendering, which the reporter checks and confirms. The report then moves through **human** verification, acceptance, assignment, completion, independent verification, the reporter's confirmation or dispute, and closure. AI assists with transcription; it never makes a civic decision.

See [`docs/project/VISION.md`](docs/project/VISION.md) for the vision and goals.

**Five civic portals in one React Native app:** Citizen · Street Representative · UC Officer · Contractor · Mayor & Operations.

## Actual implementation status (2026-10-04)

| Area | State |
|---|---|
| Requirements | Mobile SRS v2.1.0 (**draft**: 124 FR, 86 NFR, 12 security controls), CR-61 rev 1.3, use-case pack 1.0 — in `SRS/` |
| Plan and tracker | Phased plan, 118-task backlog, Excel tracker |
| Mobile app | **Citizen sign-in screens only, never run on a device.** Expo SDK 57 / React Native 0.86 app in [`mobile/`](mobile/): CIT-01…CIT-05 (language, disclosure, three separate consents, number, OTP) and a CIT-06 placeholder, wired to the backend. Urdu text is an unreviewed draft. `apps/citizen/` is still the old Flutter template, pending removal (`DG-03`) |
| Backend | **Citizen authentication only, development build.** Django 6.1.1 + DRF in [`backend/`](backend/): OTP request/verify, account creation with server-held consent, sessions (refresh rotation, logout, sign-out everywhere), masked profile, audit trail, identity vault. Runs on SQLite; PostgreSQL not installed yet. SMS is **simulated** in development — nothing is sent |
| SMS and AI providers | **Not selected** |
| Tests | Backend: 63 passing (`backend/.venv/bin/python backend/manage.py test parakh`, SQLite). Mobile: 52 passing (`cd mobile && npm run check`), plus an opt-in contract check against the dev backend. Tracker tooling: 12 passing. No device test |
| Deployment | None |

## Architecture (planned)

| Layer | Choice |
|---|---|
| Mobile | React Native 0.86 via Expo SDK 57, strict TypeScript, Android 7+ / iOS 16.4. One app holds all five portals, with isolated state per signed-in role (DR-25, DR-26) |
| Backend | Python · Django · Django REST Framework · PostgreSQL + PostGIS · Celery + Redis · write-once evidence storage (DR-6) |
| Identity | Citizens: mobile number + SMS OTP, no password, **not anonymous**. Staff: invited, own password + SMS OTP, exactly one acting role (CR-61) |

Details are in [`docs/architecture/ARCHITECTURE_OVERVIEW.md`](docs/architecture/ARCHITECTURE_OVERVIEW.md).

## Source precedence

1. [`SRS/Parakh_Mobile_App_SRS_v2.1.0.md`](SRS/Parakh_Mobile_App_SRS_v2.1.0.md)
2. [`SRS/CR_MOBILE_OTP_AND_FIVE_PORTAL_IDENTITY_MODEL.md`](SRS/CR_MOBILE_OTP_AND_FIVE_PORTAL_IDENTITY_MODEL.md) (CR-61)
3. Use-case pack `SRS/00`–`11` (actor behaviour)

Everything else in `SRS/` is preserved history. Several rank-2/3 sources the SRS cites are **missing** (`DG-05`).

- What each source governs: [`SRS/SOURCE_INDEX.md`](SRS/SOURCE_INDEX.md)
- Full register, with hashes: [`docs/planning/SOURCE_REGISTER.md`](docs/planning/SOURCE_REGISTER.md)

## Source import and setup

On 2026-10-03 every Parakh document found on the owner's Mac was copied unchanged into `SRS/`: 32 files, with 94 identical duplicates recorded. Two of those planning documents (the August roadmap PDF and evidence-plan deck) are kept locally and are not in this repository. The tracked record is [`SRS/SOURCE_IMPORT_MANIFEST.sanitized.md`](SRS/SOURCE_IMPORT_MANIFEST.sanitized.md). The original manifest and `README_SETUP.md` stay local, because they contain private paths. Their sanitized versions are tracked: [`README_SETUP.sanitized.md`](README_SETUP.sanitized.md).

## Quick start (tracker and planning tools)

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
```

```bash
.venv/bin/python scripts/generate_tracker.py
```

```bash
.venv/bin/python -m unittest discover -s tests/tracking -v
```

Backend setup: [`backend/README.md`](backend/README.md). Mobile setup: [`mobile/README.md`](mobile/README.md). The current tool gaps are listed in [`docs/setup/ENVIRONMENT_CHECK.md`](docs/setup/ENVIRONMENT_CHECK.md).

## Project map

| Path | Contents |
|---|---|
| `SRS/` | Source documents (active and historical) |
| `backend/` | Django + DRF backend — citizen authentication (development build) |
| `mobile/` | Expo SDK 57 / React Native app — citizen sign-in screens (development build) |
| `docs/api/` | Implementation notes for the citizen-authentication API |
| `docs/planning/` | [Source register](docs/planning/SOURCE_REGISTER.md), [decisions and gaps](docs/planning/DECISIONS_AND_GAPS.md), [project plan](docs/planning/PROJECT_PLAN.md), [traceability](docs/planning/TRACEABILITY.md) |
| `docs/architecture/` | Architecture overview |
| `docs/setup/` | Environment check, Git workflow |
| `docs/project/` | Vision, current state, next task, development journal, contributions |
| `tracking/` | Canonical CSV data (`data/`) and the generated Excel tracker — see [`tracking/README.md`](tracking/README.md) |
| `scripts/` | Requirement extractor, tracker generator and import tool |
| `tests/tracking/` | Tracker tests |
| `.github/` | Issue and pull-request templates |
| `apps/citizen/` | Superseded Flutter template (pending removal) |

## Limitations

- Only citizen sign-in exists, as development builds: the backend runs on SQLite (PostgreSQL is not installed) and the mobile app has never run on a device.
- SMS is simulated in development; no SMS or AI provider is selected.
- The SRS is a draft without a recorded approval.
- Five Blocker decisions affect the staff workflows.
- No user has seen or tested Parakh.
- Retention, legal and ethics approvals have not been obtained, so only synthetic data may be used.

## Contribution

**Hassan Jalal** is Parakh's founder and sole human developer and designer. Contributions are listed in [`docs/project/CONTRIBUTIONS.md`](docs/project/CONTRIBUTIONS.md), and the working rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md). No licence has been chosen yet.
