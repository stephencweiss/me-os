# Planning Workflow

For new features and non-trivial changes, always write a plan first. Follow this workflow:

## 1. Create the Plan

- Save the plan as a `.md` file in `plans/` as the **first step** (e.g., `plans/feature-name.md`)
- Include a testing strategy section: how will we verify each step works?
- Commit the plan file before starting implementation

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

- Each step in the plan should be independently verified and committed
- Use `jj` (Jujutsu) for stacked diffs:
  ```bash
  jj new -m "Step 1: description"
  # ... implement step 1 ...
  jj new -m "Step 2: description"
  # ... implement step 2 ...
  ```
- Each commit should be reviewable and revertable on its own
- Run tests after each step before moving to the next

## 5. Create PRs

- Push stacked commits and create PR(s) referencing the plan and issue
- Link to the plan file and GitHub issue in the PR description

## 6. Clean up

- After the PR(s) have been merged, clean up worktrees

```bash
cd /path/to/main/repo
./scripts/worktree-finish.sh [-d] <feature-name>
```
