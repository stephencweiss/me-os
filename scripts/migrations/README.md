# SQL migrations (manual apply)

MeOS does **not** ship a `db:push` / `supabase db push` script on every branch. These files are **source-of-truth DDL** you run against the database that backs the webapp.

## Supabase (production / web mode)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your **me-os** project.
2. Go to **SQL Editor** → **New query**.
3. Open this repo file in an editor: **`scripts/migrations/003_alignment_mobile.sql`**.
4. Copy **the entire file** (Postgres section only—the SQLite block at the bottom is commented and harmless to include, or stop before the `--- SQLite` comment if you prefer).
5. Paste into the SQL Editor and click **Run**.

You should see success for `ALTER TABLE`, `CREATE TABLE`, indexes, RLS, and policies.

**Re-running:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` are idempotent. **`CREATE POLICY`** is not—if you run the full file twice, policy creation may error with “already exists.” That’s OK if the first run succeeded; or edit the file to `DROP POLICY IF EXISTS ...` before `CREATE POLICY` for a repeatable script.

**CLI (optional):** If you have `psql` and the Postgres connection string (Supabase **Project Settings → Database**):

```bash
psql "$DATABASE_URL" -f scripts/migrations/003_alignment_mobile.sql
```

(Run from repo root; path to the file must be correct.)

## Local Turso / SQLite (MEOS_MODE=local)

The **Postgres** file does not run on Turso. For local SQLite:

- Either run only the **commented SQLite section** at the bottom of `003_alignment_mobile.sql` in your SQLite shell / Turso console, **or**
- Rely on the webapp: the Turso path **auto-creates** `weekly_audit_state` and attempts `ALTER TABLE weekly_goals ADD COLUMN constraints_json` on first audit/alignment use (see `webapp/lib/db.ts`).

## Order

If you are bootstrapping a **new** Supabase project from scratch, apply **`001_initial_schema.sql`** first, then **`003_alignment_mobile.sql`** (and any other numbered migrations in between if present).
