# Contributing to Parakh

Parakh uses a documented development process so that changes remain traceable, testable, and honestly attributable.

## Development Workflow

For every meaningful feature, fix, or technical change:

1. Create or link a GitHub Issue.
2. Define the requirement and acceptance criteria before implementation.
3. Create a separate branch.
4. Make clear, meaningful commits.
5. Run the relevant tests.
6. Open a Pull Request.
7. Review the change against its acceptance criteria.
8. Merge only after required checks and testing are complete.
9. Record important evidence, decisions, failures, and results in the project documentation.

Direct feature development on `main` should be avoided.

## Branch Naming

Use clear branch names:

- `feature/...` for new functionality
- `fix/...` for bug fixes
- `docs/...` for documentation
- `test/...` for testing work
- `chore/...` for repository or maintenance work

Examples:

`feature/citizen-report-capture`

`fix/offline-sync-error`

`docs/architecture-update`

## Commit Messages

Commit messages should explain what changed.

Preferred examples:

`feat(capture): add live evidence capture`

`fix(auth): prevent unauthorized case access`

`test(permissions): add contractor access tests`

`docs(workflow): update case-state documentation`

Avoid vague messages such as `update`, `changes`, or `final`.

## Pull Requests

Every meaningful Pull Request should include:

- the linked Issue
- requirements implemented
- a clear description of the change
- tests performed and their results
- relevant evidence
- privacy or security considerations
- known limitations

Use the repository Pull Request template.

## Testing

A feature is not considered complete only because the interface works.

Relevant unit, integration, workflow, permission, negative, and manual tests should be completed where applicable.

Test failures and known limitations must be documented rather than hidden.

## Privacy and Security

Never commit:

- passwords, API keys, tokens, or secrets
- participant identities or consent records
- unnecessary personal information
- precise sensitive locations
- unredacted real-world participant data

Security and privacy requirements should be treated as release requirements, not optional improvements.

## Evidence and Auditability

Important development work should remain traceable through:

- GitHub Issues
- branches and commits
- Pull Requests
- test results
- Development Journal entries
- project evidence archives

Failures, revisions, and scope changes should be documented alongside successful work.

## Attribution

Contributions should be attributed according to the work actually performed.

Code, research, design, testing, documentation, and other contributions should not be claimed by someone who did not perform them.

## Definition of Done

A change is considered complete when:

- the requirement has been implemented
- acceptance criteria have been satisfied
- relevant tests pass
- no unresolved critical privacy or security problem remains
- the Pull Request has been reviewed
- known limitations are documented
- required evidence and documentation are updated

## Future Contributions

Parakh is currently under active development. Contribution procedures may evolve as the project becomes public and additional contributors join.

Before beginning substantial work, contributors should review the current README, Issues, technical documentation, and project status.
