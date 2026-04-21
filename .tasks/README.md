# Task ledger

Externalized state for multi-agent orchestration (see `.claude/workflows/orchestration.md`).

## Layout

```
.tasks/
├── ledger.json           # Orchestration state (commit when it describes a real plan)
├── ledger.template.json  # Copy to start a new ledger
├── artifacts/            # Gitignored — agent outputs
│   ├── architect/
│   ├── developer/
│   ├── reviews/
│   │   ├── staff/
│   │   ├── dba/
│   │   ├── typescript/
│   │   ├── security/
│   │   └── performance/
│   ├── qa/
│   └── tester/
└── README.md
```

## Schema

See `ledger.template.json`. Key ideas:

- Each task has `persona`, `status`, optional `workspace` (jj workspace name), optional `artifact` path.
- The orchestrator updates `ledger.json` on disk; subagents write artifacts under `artifacts/`.

## Review artifact paths (MeOS)

| Persona | Example artifact |
|---------|------------------|
| Staff Engineer | `.tasks/artifacts/reviews/staff/rev-staff-001.md` |
| TypeScript Expert | `.tasks/artifacts/reviews/typescript/rev-ts-001.md` |
| DBA | `.tasks/artifacts/reviews/dba/rev-dba-001.md` |
| Security | `.tasks/artifacts/reviews/security/rev-security-001.md` |
| Performance | `.tasks/artifacts/reviews/performance/rev-perf-001.md` |

## Verification commands (for Tester / Developer)

```bash
pnpm test
pnpm --filter web test:run
```

## See also

- `.claude/personas/README.md`
- `.claude/workflows/orchestration.md`
- `.claude/workflows/jj-workflow.md`
