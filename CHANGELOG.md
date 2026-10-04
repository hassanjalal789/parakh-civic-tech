# Changelog

All notable changes to Parakh will be documented in this file.

This changelog records meaningful product, technical, documentation, testing, and release changes. Minor formatting changes and routine commits do not need individual entries.

## [Unreleased]

### Added
- Initial private GitHub repository for Parakh.
- Flutter Android citizen-app scaffold.
- Project README with early-prototype status.
- GitHub Project board for the 10 October 2026 pilot.
- Repository labels for priority, components, testing, and security.
- Development Task issue template.
- Bug Report issue template.
- Pull Request template.
- CONTRIBUTING.md with documented development and contribution rules.
- 2026-10-03 — Project initialization (`setup/project-initialization`):
  - Source documents imported unchanged into `SRS/`, with a source register and an active index.
  - Decision and gap register (DG-01…DG-50).
  - Phased project plan.
  - Requirement index extracted from the Mobile SRS v2.1.0 (124 FR, 86 NFR, 12 SC).
  - Canonical backlog: 115 tasks, 12 milestones.
  - Excel tracker, with its generator, import tool and tests.
  - Traceability matrix.
  - Environment check, Git workflow and architecture overview.
  - Current-state and next-task records, development journal and contribution records.
  - Root `.gitignore`.
- 2026-10-03 — Backend citizen authentication, development build (`T-027`, `T-037`…`T-041`): OTP request and verification, account creation with server-held consent, sessions, masked profile, audit trail, identity vault; 63 tests.
- 2026-10-04 — Mobile skeleton and citizen sign-in screens CIT-01…CIT-05 with a CIT-06 placeholder (`T-031`, `T-033`, `T-042`, `T-043`); 52 tests.
- 2026-10-04 — Session refresh on the device: one shared refresh on 401, one retry, and sign-out with a plain notice when the session has ended (`T-044`). Log redaction on every backend log handler (`T-030`).
- 2026-10-04 — CI workflow for the backend, mobile and tracker checks (`T-034`).

### Changed
- Established the workflow: Issue → Branch → Implementation → Testing → Pull Request → Review → Merge → Evidence → Development Journal.
- 2026-10-03 — The canonical working location moved to the Desktop `PARAKH PROJECT` folder. History and remote are preserved; the earlier Documents clone is an inactive backup.
- 2026-10-03 — `README.md` rewritten around the current requirements baseline. The original status line is kept.
- 2026-10-03 — Workflow: completed, verified checkpoints reach `main` regularly — by direct push where permitted, otherwise by pull request and merge (`DG-37`). The setup branch was squash-merged into `main`.
- 2026-10-03 — `docs/pilot-scope.md` gained a dated status note: the 10 Oct target and the Moderator/Administrator role are superseded. The original text is unchanged.
- 2026-10-04 — The obsolete `setup/project-initialization` branch was deleted locally and on GitHub after verification that its content is on `main` (`T-119`). No history was rewritten.
- 2026-10-04 — The GitHub repository was re-created (private) at Hassan's instruction. Its history starts from one initial commit; the earlier history is kept locally (`T-120`).
- 2026-10-04 — `README.md` limitations and set-up pointers brought up to date.

### Fixed
- None yet.

### Security
- Established repository rules against committing secrets, unnecessary personal data, participant information, or sensitive evidence.

## Release History

No formal Parakh release has been published yet.
