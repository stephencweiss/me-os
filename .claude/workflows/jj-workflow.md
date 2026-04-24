# Jujutsu (jj) stacked diffs workflow

This repo uses [Jujutsu (jj)](https://github.com/martinvonz/jj) with a stacked-diffs style workflow so humans and sub-agents can work in isolation and integrate cleanly.

## Why stacked diffs?

- Small, reviewable changes
- **Multiple agents in parallel** without stepping on the same working tree
- Easier revert and rebase than a single giant commit

## Setup

### Install jj

```bash
brew install jj
```

### Colocate with git (one-time)

From the repo root:

```bash
cd /path/to/me-os
jj git init --colocate
```

### Repo jj config (workspace-aware log, aliases)

```bash
./scripts/jj-setup-config.sh
```

Copies `config/jj-repo-config.toml` into `.jj/repo/config.toml` and optionally installs `lazyjj`.

User identity (if needed):

```bash
jj config set --user user.name "Your Name"
jj config set --user user.email "your@email.com"
```

### Create a workspace

```bash
# Human
./scripts/jj-workspace-start.sh sw-feature-name

# Agent (name becomes ai-<name>)
./scripts/jj-workspace-start.sh --agent api-refactor

# Open in Cursor (human mode only — agent mode prints instructions)
./scripts/jj-workspace-start.sh -o sw-feature-name
```

Creates `../worktrees/me-os/<workspace-name>/`, copies local env/config via `worktree-setup-env.sh`, runs `pnpm install`.

## Core concepts

| Concept | Description |
|---------|-------------|
| **Change** | Mutable commit; change id stable across rebases |
| **Revision** | Specific version of a change |
| **Working copy** | The change you are editing (`@`) |
| **trunk()** | Alias for `main@origin` (see `config/jj-repo-config.toml`) |

## Daily workflow (human)

### 1. Sync

```bash
jj git fetch --remote origin
jj rebase -d trunk()
```

### 2. New change on trunk

```bash
jj new trunk() -m "Add weekly goal sync endpoint"
```

### 3. Edit, inspect, describe

```bash
jj diff
jj describe -m "Add weekly goal sync endpoint

- Validate input with zod
- Tests for 401 and happy path"
```

### 4. Stack more slices

```bash
jj new -m "Wire UI to sync API"
```

### 5. Inspect stack

```bash
jj log
jj stack    # trunk()..@
jj ls       # flat log, no graph
```

### Mid-stack edits

```bash
jj edit <change-id>
# fix
jj new <top-change-id>   # return to tip when done
```

## PRs from bookmarks

MeOS convention: bookmark name matches the Git branch you push.

```bash
jj bookmark set sw-my-feature -r @
jj git push --remote origin --bookmark sw-my-feature
gh pr create --base main --head sw-my-feature
```

Stacked PRs: bookmark each layer, push each, open PRs with dependent bases (see `CLAUDE.md`).

## Agent collaboration

| Actor | Workspace name |
|-------|----------------|
| Human | e.g. `sw-feature` |
| Agent | `ai-<task>` (via `--agent`) |

### Lifecycle

```
create → work → observe → harvest → cleanup
```

**Create**

```bash
./scripts/jj-workspace-start.sh --agent goal-api
cd ../worktrees/me-os/ai-goal-api
jj new trunk() -m "Implement goal sync API"
```

**Work**

- Edit files; jj tracks changes
- Keep one logical change: `jj amend` (squash into `@`)
- Update message: `jj describe -m "..."`
- Verify: `pnpm test`, `pnpm --filter web test:run` as appropriate

**Observe (human, main checkout)**

```bash
lazyjj
# or: watch -n 1 --color jj log
```

Log template shows `[workspace-name]` for each working copy.

**Harvest**

```bash
jj new <agent-change-id>
jj describe -m "Review ai-goal-api implementation"
pnpm test
# bookmark + push + PR as usual
```

**Cleanup**

```bash
./scripts/jj-workspace-done.sh ai-goal-api
```

### Agent rules

- Do **not** use raw `git` for commits/push
- Do **not** create bookmarks or push unless the human explicitly asks
- Do **not** delete `.jj`
- Prefer **`jj amend`** over chains of WIP commits

## Command cheat sheet

| Command | Purpose |
|---------|---------|
| `jj new trunk() -m "..."` | New change on main |
| `jj amend` | Squash working copy into current revision |
| `jj describe` | Edit message |
| `jj diff` | Working copy diff |
| `jj log` / `jj ls` / `jj stack` | History |
| `jj rebase -d trunk()` | Rebase onto main |
| `jj bookmark set NAME -r @` | Branch/bookmark |
| `jj git fetch` / `jj git push` | Remote sync |

## TypeScript / MeOS verification

From repo root:

```bash
pnpm test
pnpm --filter web test:run
```

From `web/`:

```bash
pnpm dev
```

## Troubleshooting

**Conflicts after rebase**

```bash
jj edit <conflicted-change>
# fix files
jj resolve
```

**Undo**

```bash
jj op log
jj op restore <operation-id>
```

**Git vs jj drift**

```bash
jj git import
```

For bookmark push safety, see [jj bookmark docs](https://docs.jj-vcs.dev/latest/bookmarks/#pushing-bookmarks-safety-checks).
