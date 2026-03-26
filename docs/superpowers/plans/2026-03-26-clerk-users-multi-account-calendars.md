# Clerk identity, app-owned users, multi–Google-account calendars — implementation plan

> **For agentic workers:** After `/plan-eng-review` (or inline refinement), use **subagent-driven-development** or **executing-plans** task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** READY TO IMPLEMENT — eng review decisions locked (see below). **Scope:** greenfield Clerk + new `public.users` / RLS path; **no dual support or migration tooling for existing NextAuth users** in this phase.

**Goal:** Replace **NextAuth + Google as login** with **Clerk (email/password only)** as the identity provider, while **MeOS owns user records and profile data in Postgres** (single shared Supabase project for web + mobile). **Google Calendar remains required** for core features, but as **one or more linked Google accounts per MeOS user** (existing `linked_google_accounts` direction). **Migration:** everyone re-signs in; no automatic account mapping from `next_auth.users`.

**Non-goals (for this plan):** Social login via Clerk; calendar-agnostic product; self-hosted auth.

**Related prior work:** `docs/superpowers/plans/2026-03-19-web-calendar-sync.md` (NextAuth-centric); schema today FKs `user_id` → `next_auth.users(id)` and RLS policies use `auth.uid()` (see notes below).

---

## Locked decisions

| Topic | Decision |
|--------|-----------|
| Identity | Clerk, **email/password only** (no social providers in Clerk). |
| Profile / app state | **Stored in our database** (not only Clerk metadata). |
| Google | **Necessary**; connected as **integration OAuth** (tokens in `linked_google_accounts` or successor). Multiple Google accounts per user supported. |
| Migration | **Re-sign-in** acceptable; old NextAuth sessions / user rows can be abandoned or archived. |
| Mobile | **Clerk-backed** user; mobile Google OAuth flows updated to attach tokens to app user, not NextAuth session creation assumptions. |
| Multi-tenancy | **Multiple humans**, one Supabase database; isolation via **RLS + Clerk JWT** (Supabase third-party auth). |
| Supabase access (v1) | **JWT path:** anon (or user-scoped) client with **Clerk-issued JWT**; RLS policies compare JWT claims to `user_id`. Not optimizing for legacy NextAuth users in this phase. |
| User bootstrap | **Clerk webhook** (`user.created` / `user.updated`) **plus lazy upsert** on first authenticated request as backup. |
| JWT ↔ DB identity | **Internal UUID only** for all `user_id` FKs (`public.users.id`). **Do not** use Clerk `sub` as the Postgres user key. RLS compares row `user_id` to JWT claim **`app_user_id`** (stringified UUID, same value as `public.users.id`). Keep **`clerk_user_id`** on `public.users` for lookup and webhooks. **Rationale:** IdP-agnostic rows — switching auth vendors later mainly remaps provider ids and JWT config, not every FK in the app. |

---

## Eng review — locked decisions (2026-03-26)

| Item | Choice |
|------|--------|
| Q1 — Supabase access | **B:** Third-party JWT from Clerk + RLS; **no** requirement to preserve behavior for current NextAuth users during this work. |
| Q2 — `public.users` row | **A:** Webhook + lazy upsert fallback. |
| Q3 — JWT subject vs app id | **`app_user_id` claim** mirrors **`public.users.id` (UUID)**; **`sub`** is Clerk-only and not used for RLS or FKs. |

---

## CEO review vs eng review

**Recommendation: go straight to `/plan-eng-review`** (optionally a short CEO pass only if you want to challenge positioning, pricing, or “who is the customer” for multi-user MeOS).

**Rationale:** The strategic fork (multi-user, Clerk email-only, DB-owned profile, Google as linked accounts) is already chosen. What remains is **architecture, migration sequencing, JWT/RLS shape, and test coverage** — eng review territory. CEO review pays off when scope or problem framing is still fuzzy.

---

## Architecture sketch

1. **`public.users` (or `app_users`)** — canonical MeOS user row: stable **`id` (UUID)** primary key, **`clerk_user_id` (text, unique, not null)**, timestamps, optional profile columns (display name, timezone, etc.). All existing `user_id` FKs eventually reference this table (not `next_auth.users`).

2. **Clerk JWT → Postgres RLS** — Register Clerk as **third-party JWT provider** in Supabase; use a Supabase client with the **user’s Clerk JWT** (not service role) for tenant-scoped reads/writes so RLS applies. RLS policies: **`user_id = (auth.jwt()->>'app_user_id')::uuid`** (verify exact `auth.jwt()` / `current_setting` syntax for your Supabase version). **`sub` is ignored** for tenant checks.

3. **Google OAuth** — **Decouple from login.** After Clerk session exists, user runs **“Connect Google”** (and “Add another account”) with scopes needed for Calendar. Tokens encrypted and stored per row in **`linked_google_accounts`**, keyed by **`public.users.id`**. Remove calendar scopes from “sign-in” (there is no Google sign-in anymore).

4. **Remove NextAuth** — Delete or replace `web/lib/auth.ts`, `auth.config.ts`, `[...nextauth]` route, login page Google button flow, and any **mobile** session creation that assumes NextAuth user ids (`createDatabaseSessionForGoogleUser`, etc.).

5. **`next_auth` schema** — Stop writing to `next_auth.users` / sessions. Optionally retain tables empty for a transition period or drop in a later migration after code no longer references them.

---

## Current schema / RLS caveat

Initial migration comments state **`user_id` references `next_auth.users`**, while policies use **`auth.uid()`** (`00001_initial_schema.sql`). If the app primarily uses **service role** server-side, RLS may never have enforced tenant isolation in practice. **Eng review must:** trace all Supabase access paths (server components, API routes, mobile), then define **one** supported model: either **RLS enforced with Clerk JWT** on client-facing queries, or **RLS + service role** with explicit `user_id` filters everywhere (and tighten any leaks).

---

## Phased tasks (high level)

Eng review should turn these into ordered, committable steps with file-level ownership.

### Phase A — Design resolution (no code or minimal spikes)

- [ ] Document JWT claim shape and Supabase **Third-party auth** (or alternative) setup steps in plan appendix.
- [ ] Decide **`public.users` table name** and minimal profile columns v1.
- [ ] Confirm **Clerk Organizations** out of scope for v1 (unless you want orgs early).

### Phase B — Database

- [ ] Add migration: create **`public.users`** with UUID PK + `clerk_user_id` + profile columns.
- [ ] Add migration: **new FK target** — either alter all `user_id` FKs from `next_auth.users` → `public.users`, or introduce parallel columns (avoid if possible); handle **`linked_google_accounts`** uniqueness (`UNIQUE(user_id, google_email)` retained).
- [ ] **RLS:** replace `auth.uid()` policies with **`user_id = (auth.jwt()->>'app_user_id')::uuid`** (or equivalent); reject requests where claim is missing.
- [ ] `pnpm db:push` / `pnpm db:types`; regenerate types.

### Phase C — Web app auth

- [ ] Integrate **Clerk** (`@clerk/nextjs` or current recommended SDK for App Router).
- [ ] **Webhook or sign-up hook:** on Clerk user created, **upsert `public.users`** (map `clerk_user_id` → row); handle email verification gates if required.
- [ ] Replace **`/login`** with Clerk sign-in/sign-up; remove Google sign-in UI copy that conflates login + Calendar.
- [ ] Protect routes via Clerk middleware; pass **internal `users.id`** to server code that queries Supabase.

### Phase D — Google linking

- [ ] Implement **Connect Google** OAuth flow (Next.js route handlers) scoped to logged-in Clerk user; persist to **`linked_google_accounts`**.
- [ ] Update **calendar sync** and any code that assumed “tokens arrived at Google sign-in” to use linked accounts only.
- [ ] Settings UI: list linked accounts, add another, disconnect, sync per account or aggregate (product decision).

### Phase E — Mobile

- [ ] Clerk mobile sign-in (official pattern for your shell: Capacitor, etc.).
- [ ] Refactor **mobile Google OAuth** completion path to require **Clerk session** + attach refresh/access tokens to **`public.users.id`** (same helpers as web where possible).

### Phase F — Decommission NextAuth

- [ ] Remove NextAuth dependencies, env vars (`GOOGLE_CLIENT_ID` may remain for Calendar OAuth app), and dead code paths.
- [ ] Optional migration to **drop `next_auth` tables** once confirmed unused.

### Phase G — Verification

- [ ] **Tests:** auth boundary (mock Clerk), user upsert webhook, Google link helper, RLS policy smoke tests if feasible (or integration test with test JWT).
- [ ] **Manual:** two distinct Clerk users, each with two Google accounts, sync isolation check.
- [ ] Run **`pnpm test`** and **`pnpm --filter web test:run`** before merge.

---

## Testing strategy

| Layer | What to verify |
|--------|----------------|
| DB | Migrations apply cleanly; FKs and indexes; RLS denies cross-tenant access when using JWT path under test. |
| Web | Sign-up/sign-in; `public.users` row exists; connect 2 Google accounts; sync writes `events` only for that `user_id`. |
| Mobile | Sign-in → connect Google → sync/handoff matches web semantics. |
| Regression | Weekly goals, preferences, linked accounts CRUD still scoped by internal user id. |

---

## Open questions (remaining)

1. **Existing `UNIQUE(user_id, google_email)`:** sufficient, or need multiple connections same email (unlikely)?
2. **Invite / closed alpha:** allowlist or org gating in v1?

---

## Workflow follow-ups (from `.claude/workflows/planning.md`)

- [ ] Create a **GitHub issue** referencing this plan when implementation starts.
- [ ] Use a **dedicated worktree** for implementation (`./scripts/worktree-start.sh clerk-users` or similar).

---

## Appendix: Clerk JWT and `app_user_id` (locked)

**Chosen model:** **`public.users.id`** is a **UUID** — the only id used in FKs (`user_id` everywhere). **Clerk `sub`** (`user_…`) is **not** stored as `user_id`; it lives in **`public.users.clerk_user_id`** for webhooks and admin lookup.

**JWT claim:** Clerk session tokens include **`app_user_id`** (same UUID as `public.users.id`), via a **Clerk JWT template** that reads from **`publicMetadata`** (or `privateMetadata` if you prefer it hidden from clients — JWT templates can still include it for Supabase). RLS policies compare **`user_id`** to **`(auth.jwt()->>'app_user_id')::uuid`**.

**Keeping Clerk in sync**

1. **Webhook / lazy upsert** creates `public.users` row → obtain **`id` UUID**.  
2. **Immediately** call Clerk Backend API to set **`publicMetadata: { app_user_id: "<uuid>" }`** (same value).  
3. User’s **next** Clerk session / token refresh includes **`app_user_id`** in the JWT Supabase sees.

**Edge cases**

- **First request after sign-up:** JWT may **lack** `app_user_id` until metadata is written and token refreshes — handle with **retry**, **session refresh**, or **short blocking** on client after bootstrap (implementation choice).  
- **Service role:** Any server path that keeps using **service role** (e.g. admin jobs) **bypasses RLS** — still pass explicit `user_id`; do not assume RLS there.  
- **Tests:** Build fixture JWTs that include **`app_user_id`** matching seeded `public.users.id`.

---

## Changelog

| Date | Author | Note |
|------|--------|------|
| 2026-03-26 | Planning session | Initial plan from brainstorm + user decisions. |
| 2026-03-26 | Eng review | Q1=B (Clerk JWT + RLS), Q2=A (webhook + lazy upsert); scope excludes legacy NextAuth users for this phase. |
| 2026-03-26 | Product | Locked: internal UUID + Clerk **`app_user_id`** claim (not `sub`) for RLS; sync via Clerk metadata after user row create. |
