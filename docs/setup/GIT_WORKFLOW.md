# Git Workflow

| Field | Value |
|---|---|
| Created | 2026-10-03 (Asia/Karachi), tasks `T-001`, `T-115` |
| Applies to | Every working session |
| Related | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (Hassan's existing rules) · `DG-37` |

## 1. Repository facts (verified 2026-10-03)

| Item | Value | How verified |
|---|---|---|
| **Active working location** | `PARAKH/` on the Desktop (named `PARAKH PROJECT/` until it was found renamed on 2026-10-09) — **the only place work happens** | Owner instruction 2026-10-03 |
| Git root | Same folder | `git rev-parse --show-toplevel` |
| Origin | `https://github.com/hassanjalal789/parakh-civic-tech.git` (no credentials embedded in the URL) | `git remote -v` |
| Remote default branch | `main` | `git ls-remote --symref origin HEAD` |
| Visibility | **Private.** The unauthenticated GitHub API returns 404 while authenticated fetch works | `curl` of the API; `git fetch` |
| Branches | **Only `main`**, locally and on GitHub (local `main` tracks `origin/main`). The initialization branch `setup/project-initialization` was deleted locally and on GitHub on 2026-10-04 (`T-119`), after verification that its only commit, `cb79f82`, is contained in `main`'s squash commit `0e3d8ec`. The commit itself was not changed | `git branch -a`; `git ls-remote --heads origin` |
| Commit identity | Hassan Jalal, set in the repository-local config, unchanged | `git config --local user.name` / `user.email` |
| Credential helper | `osxkeychain` (system Git config) | `git config --get credential.helper` |
| Branch protection on `main` | **Unknown** — needs `gh` or an authenticated API call, neither of which is available | — |
| **Inactive backup** | The clone in the Documents folder (`Parakh repo/parakh-civic-tech`): same history at `4196969`; its untracked drafts are byte-identical to the ones carried here. **Do not commit, pull or push there.** Deleting it is Hassan's decision (`DG-49`) | SHA-256 comparison |

## 2. How the Desktop folder became the repository (`T-115`)

| Step | What was done |
|---|---|
| Inspect | The Desktop folder was not a Git repository (it held only the imported `SRS/` and `README_SETUP.md`). The Documents clone was a valid repository: `main` and `setup/project-initialization` at `4196969`, origin on GitHub, five untracked draft folders |
| Compare | Every tracked and untracked file of the clone was compared with the same path in the Desktop folder. **2 shared paths, both identical**; the clone's 21 untracked `SRS/` files were byte-identical to files already in the flat Desktop `SRS/`; **0 differing files** |
| Copy (not move) | `rsync -a --ignore-existing` copied `.git/`, tracked files and untracked drafts into the Desktop folder. It excluded the clone's duplicate `SRS/` copies and Flutter caches (`apps/citizen/.dart_tool/`, `apps/citizen/build/`). Nothing was overwritten |
| Verify | `git fsck --no-dangling` clean; `git rev-parse HEAD` = `4196969520cc1d1b2e58f63fe87fc04816639afe` in both clones; same branches and origin; `git diff HEAD` empty (no tracked file changed); draft hashes identical |
| Not done | No `git init`, no new history, no force operation, no change to remotes or Git config, nothing deleted |

### Working-tree status after reconciliation

**Valid Git repository ≠ clean working tree.** The repository is valid (fsck clean, history intact). At this point its working tree was **not** clean: initialization drafts and imported documents were untracked.

The status at each later checkpoint is recorded in [`docs/project/CURRENT_STATE.md`](../project/CURRENT_STATE.md).

## 3. Branch policy

| Rule | Detail |
|---|---|
| `main` | **Completed, verified checkpoints reach `main` regularly** (Hassan's instruction, 2026-10-03, `DG-37`). Use a normal direct push to `main` where branch rules permit it; where rules require a pull request, use the PR and the permitted merge (squash preferred). Never force-push, never bypass protections, never rewrite published history. `main` stays the default branch |
| Working branches | Optional, short-lived, for work that is not yet verified. Name them with the `CONTRIBUTING.md` prefixes: `feature/…`, `fix/…`, `docs/…`, `test/…`, `chore/…`. Each is integrated into `main` once verified. **`setup/project-initialization` was squash-merged into `main` on 2026-10-03 and receives no further work** |
| Issues | `CONTRIBUTING.md` asks for a GitHub Issue per meaningful change. The tracker (`tracking/data/tasks.csv`) is the canonical task record; a GitHub Issue per task is optional (`DG-37`) |
| Attribution | Commits are authored by Hassan Jalal's configured Git identity |
| History | Never force-push, never amend or rebase a pushed commit, never rewrite history to tidy it. **2026-10-04:** at Hassan's instruction the GitHub repository was re-created and its history restarted from one initial commit; the earlier history is kept locally and is not pushed (`T-120`) |

## 4. Standing checkpoint process (every completed task increment)

1. `git status --short --branch`. Separate task-owned changes from anything else. Preserve unrelated or staged work.
2. Review the diff; run the checks appropriate to the change. Fix task-caused failures before calling the task complete.
3. Update `tracking/data/*.csv`, the affected docs, `docs/project/DEVELOPMENT_JOURNAL.md`, `CURRENT_STATE.md` and `NEXT_TASK.md`.
4. If tracker data changed: `.venv/bin/python scripts/generate_tracker.py`, then `--validate`.
5. Inspect the full staged diff, including new and binary files.
6. Check for secrets, personal data and build artifacts. **Stage explicit paths**, never `git add -A` blindly.
7. Commit with a clear message that names the task ID (`docs(T-004): …`, `feat(T-039): …`).
8. Push normally: to `main` directly where branch rules permit it, otherwise push the working branch and complete the required pull request and permitted merge.
9. Verify with `git ls-remote origin main` (and the branch, if one was used) that the remote holds the commit. Report hash, branch, validation and push result.

**Not a checkpoint:** every keystroke, timer ticks, or unverified work described as finished. A deliberate work-in-progress commit is labelled `wip(T-xxx): …` and never marks a task Done.

## 5. When something fails

| Situation | Response |
|---|---|
| Push fails (network or auth) | Keep the local commit, record **Pending push** in `CURRENT_STATE.md` with the cause, and continue safe local work. Retry once the cause is fixed. Never loop on authentication prompts |
| Non-fast-forward rejection | `git fetch`, inspect the divergence, integrate normally if the remote change is expected; otherwise ask Hassan one focused question. **Never force-push** |
| CI | Recorded as **Pending** until its result is observed. A failed required check reopens the task or qualifies it |
| Commit-hash bookkeeping | Do not commit just to record the latest hash. The journal entry's commit is discoverable from history. Optional post-push receipts go in the git-ignored `.local/` folder |

## 6. Limits

This workflow runs only during active working sessions. No background daemon, file watcher, scheduled push or bypass mode is installed. When Hassan edits files by hand, the next session inspects the diff and commits only understood, in-scope changes.
