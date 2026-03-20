# Planning Workflow

For new features and non-trivial changes, always write a plan first. Follow this workflow:

## 1. Create the Plan

- Save the plan as a `.md` file in **`docs/superpowers/plans/`** as the **first step** (e.g., `docs/superpowers/plans/YYYY-MM-DD-feature-name.md`). Link the design spec from `docs/superpowers/specs/` when one exists.
- Include a testing strategy section: how will we verify each step works?
- Commit the plan file before starting implementation
- **Legacy:** older plans may remain under `plans/`; new work should use `docs/superpowers/plans/`.

## 2. Create a GitHub Issue

- Create an issue on the remote repository documenting the plan
- This links all related work (commits, PRs) to a trackable issue
- Reference the plan file in the issue body

## 3. Set Up a Dedicated Worktree

- Execute all plan work in a dedicated worktree to isolate changes:
  ```bash
  ./scripts/worktree-start.sh <feature-name>
  cd ../worktrees/<repo-name>/<feature-name>
  ```
- This keeps main clean and allows parallel work

## 4. Implement with Stacked PRs (Jujutsu)

- Each step/phase in the plan should be independently verified and committed
- Initialize jj if not already done:
  ```bash
  jj git init --colocate
  jj bookmark track main --remote=origin
  ```
- Use `jj` (Jujutsu) for stacked diffs:
  ```bash
  # Start from main or your base branch
  jj new main -m "Phase 1: description"
  # ... implement phase 1 ...
  jj bookmark create sw-phase1  # create bookmark for PR

  jj new -m "Phase 2: description"  # automatically stacks on Phase 1
  # ... implement phase 2 ...
  jj bookmark create sw-phase2
  ```
- Each commit should be reviewable and revertable on its own
- Run tests after each phase before moving to the next
- View your stack: `jj log`
- Push all bookmarks: `jj git push --all`

## 5. Create PRs

- Push stacked commits and create PR(s) referencing the plan and issue
- Link to the plan file and GitHub issue in the PR description

## 6. Clean up

- After the PR(s) have been merged, clean up worktrees

```bash
cd /path/to/main/repo
./scripts/worktree-finish.sh [-d] <feature-name>
```
