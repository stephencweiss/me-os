---
name: orchestrate
description: Coordinate persona-based multi-agent development with task ledger management (MeOS)
---

# Skill: Orchestrate

Coordinate multiple personas in a structured SDLC-style flow with state in **`.tasks/ledger.json`**. Pair with **`.claude/personas/`**, **`.claude/skills/jj-workspace/SKILL.md`**, and **`.claude/workflows/jj-workflow.md`**.

Ported from [pulse-log](https://github.com/stephencweiss/pulse-log) `main` / `jj-workflows`; adapted for TypeScript, Next.js (`web/`), `pnpm`, and Supabase.

## When to use

Use when:

- A feature needs design → implement → **review gate** → QA → test execution
- Multiple **parallel workstreams** need separate jj workspaces
- You want **human-visible** progress (`ledger_summary`, `lazyjj`)

Skip for: one-file fixes, pure exploration, or when the user wants direct hands-on coding.

## Core principles

1. **Externalize state** — ledger on disk, not chat context
2. **Paths, not contents** — hand off file paths between personas
3. **Single writer** — orchestrator updates the ledger
4. **Clear handoffs** — each persona writes an artifact; next step reads the path
5. **Observable** — ledger + jj log show progress

## Patterns

### A: Sequential SDLC

```
Architect → Developer (jj workspace) → Review gate → QA Engineer → Tester
```

### B: Parallel workstreams

Multiple `Developer` personas in `ai-*` workspaces → per-stream reviews → integration Developer.

### C: Review gate (after Developer)

Spawn in **parallel** (read-only on the same workspace):

- **Always:** Staff Engineer + **TypeScript Expert** (this repo is TS-first)
- **If** `supabase/migrations/` or SQL touched: Database Administrator
- **If** auth, cookies, Clerk, tokens, RLS, or PII paths: Security Reviewer
- **If** hot path / N+1 / bundle regressions: Performance Specialist

Use `jj diff --git` / file lists from the developer workspace to decide.

## Ledger helpers

```bash
source .claude/skills/orchestrate/ledger-helpers.sh
ledger_init "Goal text"
ledger_add_task "arch-001" "Design approach" "architect" "null" ""
ledger_add_task "dev-001" "Implement" "developer" "ai-my-feature" "arch-001"
ledger_check_deps "dev-001"
ledger_update_status "arch-001" "done" ".tasks/artifacts/architect/arch-001.md"
ledger_summary
ledger_complete
```

## Spawning personas

Prepend **`[Contents of .claude/personas/<name>.md]`** then task block. See **`.claude/skills/orchestrate/EXAMPLE.md`** for a full MeOS-shaped walkthrough.

### Developer (MeOS)

- Create workspace: `./scripts/jj-workspace-start.sh --agent <short-name>`
- Verify: `pnpm test` and `pnpm --filter web test:run` (and `cd web && pnpm dev` when UI needs eyes)
- Use **`jj amend`**; do not bookmark/push unless the human asks

### Tester (MeOS)

- Run the test commands from `CLAUDE.md` / the QA plan — not `swift test`

## Failure handling

- Developer **failed** → retry with failure context (cap retries), or re-run Architect, or mark ledger `blocked` for human input
- Reviewer **revise/reject** → consolidate feedback → Developer → re-run reviewers

Do not proceed to QA until required reviewers are satisfied.

## Superpowers integration

| Skill | Role |
|-------|------|
| `brainstorming` | Before Architect |
| `writing-plans` | Plan output feeds Architect/Developer |
| `dispatching-parallel-agents` | Pattern B developers |
| `subagent-driven-development` | Same-session task loop; use personas + this ledger |
| `verification-before-completion` | Final gate after Tester |
| `requesting-code-review` / `receiving-code-review` | Review gate templates |

## Worked example

See **EXAMPLE.md** (schema/API-style flow with `../worktrees/me-os/ai-…` paths).
