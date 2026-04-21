---
name: jj-workspace
description: Use when starting isolated jj workspace work — human feature branch or sub-agent parallel workstream
---

# Jujutsu workspace (MeOS)

## When to use

Use when work should be isolated so it does not clash with other sessions or agents:

- Multi-file feature or refactor
- Parallel agent workstream
- You need a single reviewable jj change without WIP commit noise

**Skip for:** quick one-file fixes in the main checkout, read-only exploration, or planning-only work.

## What this does

Creates a jj workspace under `../worktrees/me-os/<name>/` (see `scripts/jj-workspace-start.sh`), with env copied and `pnpm install` run.

## Steps

### 1. Create workspace

Agent / parallel work:

```bash
./scripts/jj-workspace-start.sh --agent <short-name>
```

Human:

```bash
./scripts/jj-workspace-start.sh sw-<feature>
```

### 2. Enter workspace

```bash
cd ../worktrees/me-os/ai-<short-name>   # or sw-<feature>
```

### 3. Start a change

```bash
jj new trunk() -m "Short imperative summary"
```

### 4. Implement

- Edit files
- `jj diff` to inspect
- After each logical chunk: `jj amend`
- Refresh the message with `jj describe -m "..."` when scope shifts

### 5. Verify

```bash
pnpm test
pnpm --filter web test:run
```

Use `cd web && pnpm dev` when UI work needs manual checks.

### 6. Handoff

Report:

- Workspace path
- Change id (`jj log` / `jj ls`)
- Tests run and result
- Blockers or follow-ups

## Prohibited (agents unless human explicitly overrides)

1. `git add` / `git commit` / `git push` for delivering work
2. Multiple abandoned WIP commits instead of `jj amend`
3. `jj bookmark set` / `jj git push` without human instruction
4. Deleting `.jj`
5. Editing another agent’s workspace directory

Humans handle bookmarks, push, PRs, and `jj-workspace-done.sh` cleanup.

## Commands

| Command | Purpose |
|---------|---------|
| `jj new trunk() -m "..."` | Start from main |
| `jj amend` | Squash into current revision |
| `jj describe -m "..."` | Update description |
| `jj diff` / `jj log` / `jj ls` | Inspect |

## Troubleshooting

**Not a jj repo** — Human runs `jj git init --colocate` at repo root.

**Workspace already exists** — Pick a new name or run `./scripts/jj-workspace-done.sh <name>` from the repo root.

**Full workflow details** — `.claude/workflows/jj-workflow.md`
