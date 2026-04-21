# Skill: Subagent orchestration

Use this workflow when coordinating multiple subagents to complete a complex task.

---

## Should you use subagents?

Before orchestrating, apply this heuristic. Subagents add overhead — only use them when the tradeoff is worth it.

### Use subagents when

| Signal | Example |
|--------|---------|
| **Task count > 1 and tasks are independent** | Generate tests for many modules |
| **Work is embarrassingly parallel** | Lint, typecheck, and build in parallel |
| **Each task has a clear artifact** | One spec in, one review doc out |
| **Total work exceeds ~60% of a single context window** | Large refactor across `web/` + `supabase/` |
| **Tasks are repetitive with variation** | “Do X for each of these N routes” |

### Stay single-agent when

| Signal | Example |
|--------|---------|
| **Tasks are deeply interdependent** | Each step reshapes the next |
| **Requirements are likely to emerge mid-task** | Exploratory feature work |
| **The work fits comfortably in one context** | Focused bug fix or single-file change |
| **Speed matters more than scale** | Tight iteration loops |
| **Debugging fidelity is critical** | You need the full reasoning chain visible |

### Quick test

1. **Can I define the output artifact before starting?** If no → single agent.
2. **Are there 3+ tasks that don't depend on each other?** If no → single agent.
3. **Would a single agent hit context limits?** If no → single agent.

If all three are yes → subagents are worth it.

---

## Core principles

**The orchestrator is a switchboard, not a transcript.**  
Route work and hold references. Do not accumulate subagent output in working memory.

**Subagents get clean context.**  
They receive only what you pass. Be deliberate.

**Externalize all state.**  
The task ledger and artifacts live on disk.

---

## Setup: task ledger

Before spawning subagents, ensure a ledger exists (see `.tasks/README.md`):

```bash
mkdir -p .tasks/artifacts
# Copy template if starting fresh:
cp .tasks/ledger.template.json .tasks/ledger.json
# Then edit goal, tasks, timestamps.
```

Update the ledger file as tasks complete — not the chat transcript.

---

## Spawning subagents

### Pass in

- Task description (scoped, unambiguous)
- Paths to inputs (not inlined contents)
- Output path for results
- Shared conventions (format, naming)

### Do not pass in

- Full orchestrator history
- Unrelated prior task outputs
- Long reasoning chains

### Template prompt

```
Task: <description>

Inputs: <list of file paths>
Output: Write your result to <output-path>

Constraints:
- Return only a terse status when done: { "status": "done", "artifact": "<output-path>" }
- Do not summarize inputs; act on them directly
```

---

## Receiving results

Prefer a terse status:

```json
{ "status": "done", "artifact": "./.tasks/artifacts/developer/dev-001.log" }
```

On receipt:

1. Update `ledger.json` with status and artifact path
2. Do not read the artifact into context unless the next task requires it
3. Pass artifact paths forward, not contents

---

## Context management

| Situation | Action |
|-----------|--------|
| Subagent result received | Write to disk, update ledger, drop from context |
| Next task needs prior output | Pass file path; subagent reads it |
| Orchestrator context is heavy | Summarize one checkpoint block or compact |
| Task failed | Log to ledger; retry with failure context in prompt |

---

## Subagent design guidelines

- **Single responsibility:** one subagent, one primary artifact
- **Self-contained:** runnable with only what it is given
- **Explicit output contract:** path and format specified
- **Avoid shared mutable state:** prefer distinct artifact paths per task

---

## Parallel vs sequential

**Parallel:** No dependencies — spawn together, collect statuses.  
**Sequential:** B needs A’s artifact — pass the path when spawning B.  
When in doubt, prefer sequential.

---

## Failure handling

1. Log `"status": "failed"` and error detail in the ledger
2. Retry, skip, or abort
3. Retry = new subagent with failure context appended
4. Avoid complex recovery logic in the orchestrator itself

---

## Persona registry

Each persona lives under `.claude/personas/`. Prepend the persona file to the task prompt (see `README.md` in that folder).

| Persona | File | When to invoke |
|---------|------|----------------|
| Architect | `architect.md` | Before implementation |
| Developer | `developer.md` | After architecture |
| Staff Engineer | `staff-engineer.md` | After Developer (always in review gate) |
| TypeScript Expert | `typescript-expert.md` | After Developer for TS / Next / React |
| Database Administrator | `database-administrator.md` | Schema, SQL, Supabase migrations |
| Security Reviewer | `security-reviewer.md` | Auth, tokens, PII, crypto |
| Performance Specialist | `performance-specialist.md` | Hot paths, query cost, bundle size |
| QA Engineer | `qa-engineer.md` | After review gate |
| Tester | `tester.md` | After QA plan |
| Technical Writer | `technical-writer.md` | After implementation is stable |

Post-Developer reviewers can run in parallel. Invoke only the personas that match the work.

### Typical SDLC flow

```
Architect → Developer → ┬→ Staff Engineer ─────────┐
                         ├→ Security Reviewer ───────┤
                         ├→ Database Administrator ──┤
                         ├→ Performance Specialist ───┤
                         └→ TypeScript Expert ────────┘
                                      ↓
                                QA Engineer
                                      ↓
                                   Tester
                                      ↓
                            Technical Writer
```

### Spawning a persona-based subagent

```markdown
[Contents of .claude/personas/staff-engineer.md]

---

Task: Review the change under ../worktrees/me-os/ai-feature/ against the plan at docs/superpowers/plans/feature.md.
Output: Write your review to .tasks/artifacts/reviews/staff/rev-staff-001.md
Format: <override default output shape here if needed>
```

---

## Reference: `CLAUDE.md` entry

See `CLAUDE.md` → **Subagent orchestration** and **Multi-agent development (jj)** for repo-specific commands (`pnpm test`, workspace paths, prohibited agent actions).
