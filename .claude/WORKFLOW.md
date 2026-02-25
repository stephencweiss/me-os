# Git Workflow

**Default:** Use git worktrees to isolate work and enable parallel sessions.

## Creating a Worktree

```bash
./scripts/worktree-start.sh <feature-name>
cd ../worktrees/<repo-name>/<feature-name>
```

## Finishing a Worktree

```bash
cd /path/to/main/repo
./scripts/worktree-finish.sh [-d] <feature-name>
```

Use `-d` to also delete the local branch.

## Branch Naming

`{initials}-{description}` (e.g., `sw-add-dark-mode`)
