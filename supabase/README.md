# Supabase (MeOS webapp)

- **`migrations/`** — Ordered Postgres DDL: `00000` Auth.js `next_auth`, then MeOS (`00001`+).
- **Apply from repo root:** `pnpm db:push` (see `scripts/migrations/README.md`).

This layout matches the workflow used in **animus-training/training-app** (`db-push.mjs` + Management API).
