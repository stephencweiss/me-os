# Orchestration example (MeOS)

End-to-end pattern: **Architect → Developer (jj workspace) → parallel reviews → QA → Tester**, using `ledger-helpers.sh`.

## Scenario

Add a small **Next.js route handler** under `web/app/api/...` with validation, plus a **Supabase migration** — enough surface for Staff + TypeScript + DBA reviewers.

## 1. Init ledger

```bash
cd /Users/sweiss/code/me-os
source .claude/skills/orchestrate/ledger-helpers.sh
ledger_init "Add example API + migration for feature X"
```

## 2. Add tasks

```bash
ledger_add_task "arch-001" "Design API + DB approach" "architect" "null" ""
ledger_add_task "dev-001" "Implement in jj workspace" "developer" "ai-example-api" "arch-001"
ledger_add_task "rev-staff-001" "Staff review" "staff-engineer" "null" "dev-001"
ledger_add_task "rev-ts-001" "TypeScript review" "typescript-expert" "null" "dev-001"
ledger_add_task "rev-dba-001" "DBA review" "database-administrator" "null" "dev-001"
ledger_add_task "qa-001" "Test strategy" "qa-engineer" "null" "rev-staff-001,rev-ts-001,rev-dba-001"
ledger_add_task "test-001" "Run tests" "tester" "null" "qa-001"

ledger_summary
```

## 3. Spawn Architect

Prompt shape:

```markdown
[Contents of .claude/personas/architect.md]

---

Task: Design API + migration approach for feature X
Inputs:
- Plan/spec: docs/superpowers/plans/....md (or issue)
- Existing API patterns: web/app/api/

Output: .tasks/artifacts/architect/arch-001.md
```

Update when done:

```bash
ledger_update_status "arch-001" "done" ".tasks/artifacts/architect/arch-001.md"
```

## 4. Developer workspace

```bash
./scripts/jj-workspace-start.sh --agent example-api
cd ../worktrees/me-os/ai-example-api
jj new trunk() -m "Add example API and migration"
```

## 5. Spawn Developer

```markdown
[Contents of .claude/personas/developer.md]

---

Task: Implement per architecture
Inputs:
- Architecture: .tasks/artifacts/architect/arch-001.md
Output:
- Code: this workspace (../worktrees/me-os/ai-example-api)
- Log: .tasks/artifacts/developer/dev-001.log

Requirements:
- pnpm test && pnpm --filter web test:run before handoff
- jj amend; no bookmark/push
```

```bash
ledger_update_status "dev-001" "done" ".tasks/artifacts/developer/dev-001.log"
```

## 6. Review gate (parallel)

Staff + TypeScript Expert + DBA prompts: read-only review of the **same** workspace tree; write to:

- `.tasks/artifacts/reviews/staff/rev-staff-001.md`
- `.tasks/artifacts/reviews/typescript/rev-ts-001.md`
- `.tasks/artifacts/reviews/dba/rev-dba-001.md`

Then `ledger_update_status` each to `done`.

## 7. QA → Tester

QA writes `.tasks/artifacts/qa/qa-001.md`; Tester runs `pnpm test` / web tests per plan and writes `.tasks/artifacts/tester/test-001.md`.

## 8. Human harvest

From **main checkout** (or wherever your jj op runs):

```bash
cd /Users/sweiss/code/me-os
jj new <change-id-from-ai-example-api>
pnpm test
./scripts/jj-workspace-done.sh ai-example-api
ledger_complete
```

Adjust paths if your main repo directory differs.

## Takeaways

- Ledger + artifacts stay **out of** orchestrator context
- **typescript** review dir matches `ledger-helpers.sh` and `.tasks/README.md`
- **Parallel reviews** after a single Developer handoff mirror pulse-log’s Pattern C
