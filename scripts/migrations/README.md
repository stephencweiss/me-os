# Database migrations (Supabase / Postgres)

Canonical SQL lives in **`supabase/migrations/`** at the repo root (versioned `00000_…`, `00001_…`, …).

## Apply migrations (recommended): `pnpm db:push`

Same pattern as **animus-training/training-app** (`scripts/db-push.mjs`): migrations run through the **Supabase Management API** (HTTPS), so you do not need a direct Postgres connection from your laptop.

### One-time setup

1. **Access token** — In [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens), create a token.

2. **Env** — In **`web/.env.local`** (or repo-root `.env.local`), set:

   | Variable | Purpose |
   |----------|---------|
   | `SUPABASE_ACCESS_TOKEN` | Management API (for `db:push` only; not used by the Next.js app) |
   | `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_PROJECT_REF` | Identifies the project |

### Commands (from repo root)

```bash
pnpm db:status       # pending vs applied
pnpm db:push         # apply pending migrations (dev: loads web/.env.local)
pnpm db:push -- --dry-run
pnpm db:push:prod    # uses web/.env.production or .env.production
pnpm db:types        # regenerate web/lib/database.types.ts (runs `pnpm dlx supabase`; network on first use)
pnpm db:types:check  # CI: ensure database.types.ts looks generated
```

### Existing database (you already ran SQL by hand)

If tables exist but **`supabase_migrations.schema_migrations`** is empty or behind, `db:push` may try to re-apply old steps. Either:

- **Preferred:** Insert rows for migrations you have already applied (version = numeric prefix of the file, e.g. `00000` for `00000_next_auth_schema.sql`), then run `pnpm db:status` / `pnpm db:push`, or  
- Continue using **SQL Editor** for one-off fixes only, and still use `db:push` for **new** migrations going forward.

## Manual apply (fallback)

Supabase Dashboard → **SQL Editor** → paste the contents of a file under **`supabase/migrations/`** → Run. Prefer order `00000` → `00005` unless you know your DB state.

### `psql` (optional)

```bash
psql "$DATABASE_URL" -f supabase/migrations/00005_repoint_user_fk_to_next_auth.sql
```

## Local Turso / SQLite (`MEOS_MODE=local`)

Postgres migrations do not run on Turso. For alignment features, use the SQLite section in **`supabase/migrations/00003_alignment_mobile.sql`** comments, or rely on the webapp Turso bootstrap in `web/lib/db.ts`.

## File order (new Supabase project)

| Order | File | Purpose |
|-------|------|---------|
| 0 | `00000_next_auth_schema.sql` | **Auth.js / NextAuth** — `next_auth` schema, `uid()`, sessions, accounts, verification_tokens ([upstream](https://authjs.dev/getting-started/adapters/supabase)) |
| 1 | `00001_initial_schema.sql` | Core MeOS tables |
| 2 | `00002_user_fk_next_auth.sql` | `user_id` → `next_auth.users` |
| 3 | `00003_alignment_mobile.sql` | `weekly_audit_state`, `constraints_json` |
| 4 | `00004_events_removed_at.sql` | `events.removed_at` + index |
| 5 | `00005_repoint_user_fk_to_next_auth.sql` | Full FK repoint + `weekly_audit_state` (for DBs that ever pointed at `auth.users`) |

**Re-running:** Most statements are idempotent. **`CREATE POLICY`** may error if policies already exist—that is OK if the first run succeeded.
