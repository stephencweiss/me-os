# Personas

Role-based agent definitions for clean, efficient multi-agent orchestration.

## Overview

Each persona defines a specialized role with:

- **Identity:** How they think and their philosophy
- **Responsibilities:** What they do (and don't do)
- **Process:** How they approach their work
- **Output format:** Default structure (can be overridden)
- **Orchestrator notes:** When to invoke, inputs, dependencies

## Available Personas

### Design & Planning

| Persona | File | When to Invoke |
|---------|------|----------------|
| **Architect** | `architect.md` | Before implementation; design technical approach, component boundaries, tradeoffs |

### Implementation

| Persona | File | When to Invoke |
|---------|------|----------------|
| **Developer** | `developer.md` | After architecture defined; implement features per spec and patterns |

### Review (run in parallel)

| Persona | File | When to Invoke |
|---------|------|----------------|
| **Staff Engineer** | `staff-engineer.md` | After Developer; review correctness, maintainability, patterns |
| **TypeScript Expert** | `typescript-expert.md` | After Developer (TypeScript / Next.js / React code); types, boundaries, idioms |
| **Database Administrator** | `database-administrator.md` | After Developer (schema/query work); review integrity, performance, migrations |
| **Security Reviewer** | `security-reviewer.md` | After Developer (auth, tokens, PII); review security, privacy, data handling |
| **Performance Specialist** | `performance-specialist.md` | After Developer (critical paths); review latency, bundle size, DB/query cost |

### Quality assurance

| Persona | File | When to Invoke |
|---------|------|----------------|
| **QA Engineer** | `qa-engineer.md` | After reviews pass; design test strategy and test cases |
| **Tester** | `tester.md` | After QA strategy defined; execute tests and report results |

### Documentation

| Persona | File | When to Invoke |
|---------|------|----------------|
| **Technical Writer** | `technical-writer.md` | After feature stable; create user and developer documentation |

## Typical SDLC flow

```
User Request
    ↓
Architect → Design approach, identify tradeoffs
    ↓
Developer → Implement per architecture
    ↓
┌───────────────────────────────────────┐
│ Review gate (parallel)                  │
├─ Staff Engineer (always)              │
├─ TypeScript Expert (TS / Next / React)│
├─ DBA (schema / queries / Supabase)    │
├─ Security Reviewer (auth / PII)         │
└─ Performance Specialist (critical paths)│
    ↓
QA Engineer → Design test strategy
    ↓
Tester → Execute tests
    ↓
Technical Writer → Document feature
    ↓
Ship!
```

## Usage with orchestration

### Loading a persona

When spawning a subagent, prepend the persona file:

```markdown
[Contents of .claude/personas/architect.md]

---

Task: Design API shape for weekly goals sync

Inputs:
- Requirements: docs/superpowers/specs/feature.md
- Current code: web/app/api/

Output: .tasks/artifacts/architect/arch-001.md
```

### Overriding output format

Use a `Format:` directive to override the persona's default output shape.

### Parallel reviews

All review personas can run simultaneously on the same implementation. The orchestrator records artifact paths in `.tasks/ledger.json` and passes paths — not full file contents — between steps.

## Context management

**Pass file paths, not file contents.** Personas read what they need; the orchestrator tracks paths in the ledger.

## Integration with superpowers skills

| Superpowers skill | Persona usage |
|-------------------|---------------|
| `brainstorming` | Often before Architect |
| `writing-plans` | Architect or planner produces implementation plan |
| `dispatching-parallel-agents` | Multiple Developer personas for parallel workstreams |
| `orchestrate` | Ledger helpers + review gate + spawn templates (`.claude/skills/orchestrate/`) |
| `subagent-driven-development` | Orchestrator loop using personas + ledger |
| `verification-before-completion` | Tester executes final verification |
| `requesting-code-review` | Triggers review gate (Staff + specialists) |

## MeOS-specific patterns

### Pattern: Web + Supabase

```
Architect (API + RLS assumptions)
    ↓
Developer (Next.js routes, server actions, types)
    ↓
┌─ Staff Engineer
├─ TypeScript Expert
└─ DBA (migrations, RLS, queries)
    ↓
QA Engineer (API + UI tests)
```

### Pattern: Skills / scripts (Node)

```
Architect (boundaries, IO)
    ↓
Developer (TypeScript scripts, tests)
    ↓
┌─ Staff Engineer
└─ TypeScript Expert
    ↓
Tester (`pnpm test`)
```

## Extending personas

1. Add `{name}.md` in this directory
2. Update this README tables
3. Update `.claude/workflows/orchestration.md` persona registry if needed

## See also

- `.claude/workflows/orchestration.md` — orchestration patterns
- `.tasks/README.md` — task ledger
- `CLAUDE.md` — jj multi-agent workflow and skill registry
