# SQL migrations (manual apply)

MeOS does **not** ship a `db:push` / `supabase db push` script on every branch. These files are **source-of-truth DDL** you run against the database that backs the webapp.

## Prerequisites (Supabase + NextAuth)

The webapp uses **NextAuth** with **`@auth/supabase-adapter`**. User rows live in **`next_auth.users`**, not **`auth.users`** (Supabase Auth).

1. Apply the **Auth.js / Supabase adapter** schema first so **`next_auth.users`** exists:  
   https://authjs.dev/getting-started/adapters/supabase  
2. Then run **`001_initial_schema.sql`** (it references **`next_auth.users`** for every `user_id` FK).

If you applied an **older** `001` that referenced **`auth.users`**, goal/event inserts can fail with:

`violates foreign key constraint "weekly_goals_user_id_fkey"`

→ Run **`004_repoint_user_fk_to_next_auth.sql`** once to fix existing databases.

## Supabase (production / web mode)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your **me-os** project.
2. Go to **SQL Editor** → **New query**.
3. Paste the migration file contents and **Run**.

Suggested order for a **new** project:

| File | Purpose |
|------|---------|
| Auth.js adapter SQL | Creates **`next_auth`** schema + tables |
| **`001_initial_schema.sql`** | Events, goals, summaries, … |
| **`003_alignment_mobile.sql`** | `weekly_audit_state`, `constraints_json` |
| **`004_repoint_user_fk_to_next_auth.sql`** | Only if you previously ran 001/003 with **`auth.users`** FKs |

**Re-running:** Some statements are idempotent (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`). **`CREATE POLICY`** in `001` / `003` may error if policies already exist—that is OK if the first run succeeded.

**CLI (optional):**

```bash
psql "$DATABASE_URL" -f scripts/migrations/004_repoint_user_fk_to_next_auth.sql
```

(Run from repo root; adjust path and file name.)

## Local Turso / SQLite (MEOS_MODE=local)

The **Postgres** files do not run on Turso. For local SQLite:

- Either run only the **commented SQLite section** at the bottom of `003_alignment_mobile.sql`, **or**
- Rely on the webapp: the Turso path **auto-creates** `weekly_audit_state` and attempts `ALTER TABLE weekly_goals ADD COLUMN constraints_json` on first use (see `webapp/lib/db.ts`).
