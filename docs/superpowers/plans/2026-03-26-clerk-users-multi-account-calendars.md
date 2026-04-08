# Clerk identity, app-owned users, multi–Google-account calendars — implementation plan

> **For agentic workers:** After `/plan-eng-review` (or inline refinement), use **subagent-driven-development** or **executing-plans** task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** IN PROGRESS — all implementation for this plan happens in the **jj workspace `clerk-users`** only (see workflow below). **Scope:** greenfield Clerk + new `public.users` / RLS path; **no dual support or migration tooling for existing NextAuth users** in this phase.

**Goal:** Replace **NextAuth + Google as login** with **Clerk (email/password only)** as the identity provider, while **MeOS owns user records and profile data in Postgres** (single shared Supabase project for web + mobile). **Google Calendar remains required** for core features, but as **one or more linked Google accounts per MeOS user** (existing `linked_google_accounts` direction). **Migration:** everyone re-signs in; no automatic account mapping from `next_auth.users`.

**Non-goals (for this plan):** Social login via Clerk; calendar-agnostic product; self-hosted auth.

**Related prior work:** `docs/superpowers/plans/2026-03-19-web-calendar-sync.md` (NextAuth-centric). Historical note: pre-`00007` schema referenced `next_auth.users`; RLS previously used `auth.uid()` while the app often used service role + explicit `user_id` filters.

**Implementation notes**

- `supabase/migrations/00007_public_users_clerk_rls.sql` — truncates tenant + NextAuth data, creates `public.users`, repoints FKs to `public.users`, RLS uses JWT claim `app_user_id`. **Apply with `pnpm db:push`** when ready; then run **`pnpm db:types`** to refresh generated types (hand-added `AppUser` types exist until then).
- Configure **Supabase → Authentication → Third-party auth** with Clerk JWT + **Clerk JWT template** adding `app_user_id` from user `publicMetadata`.
- **Bootstrap (web):** `POST /api/webhooks/clerk`, `POST /api/meos/ensure-user`, `web/lib/app-user-bootstrap.ts` — lives on `main@git` and is rebased under the jj stack below.

## Development workflow (jj) — canonical for this plan

1. **Working copy:** use only the workspace at **`~/code/worktrees/me-os/clerk-users`** (path may be **`../worktrees/me-os/clerk-users`** relative to the main repo). Do not land Clerk-plan code on the default workspace / random git branches without going through this line.
2. **Before starting:** `cd ~/code/worktrees/me-os/clerk-users` (or your equivalent).
3. **Each slice:** `jj new -m "feat: …"` (or `jj describe` then commit) so the change is one focused revision; keep the stack ordered **oldest at bottom, newest at `@`**.
4. **Bookmarks (one per slice, stacked):** after a slice is done, `jj bookmark create sw-clerk-<slice> -r <that-revision>` (or move an existing bookmark with `jj bookmark move`). Example bookmarks on this line: `sw-clerk-00007` (migration), `sw-clerk-docs` (plan/migration README notes). Add new names like `sw-clerk-login`, `sw-clerk-google-link`, etc. as you go.
5. **Publish:** from repo root context, `jj git fetch --remote origin`, then `jj git push --remote origin --bookmark <name>` for each bookmark you want on GitHub; open **stacked PRs** with `gh` (`--head` = bookmark name) per CLAUDE.md.
6. **Sync with main:** when `main@git` advances, `jj rebase -s <bottom-of-your-stack> -d main@git` (or rebase the whole clerk stack onto `main@git`).

**Tracking:** GitHub issue [#108](https://github.com/stephencweiss/me-os/issues/108).

---

## Shipped (baseline before remaining slices)

Check these off in the jj line / `main@git` as they land; they are the stack under **`sw-clerk-00007`**, **`sw-clerk-docs`**, and **`main`** (bootstrap).

- [x] **DB `00007`:** `public.users`, FK repoint to `public.users`, RLS on **`app_user_id`** (`supabase/migrations/00007_public_users_clerk_rls.sql`). **Bookmark:** `sw-clerk-00007`.
- [x] **Plan / ops notes:** destructive migration callout, jj workflow in this doc. **Bookmark:** `sw-clerk-docs`.
- [x] **User bootstrap (web):** `web/lib/app-user-bootstrap.ts`, `POST /api/webhooks/clerk`, `POST /api/meos/ensure-user`, proxy allowlist for those paths, `public.users` + `AppUser` types in `database.types.ts`, `@clerk/nextjs` dependency — on **`main@git`** and rebased under the jj stack.
- [x] **Dashboard wiring (you):** Clerk session token **`role`** + **`app_user_id`**, Supabase third-party Clerk, local `.env` keys (Vercel still TODO).

---

## Execution roadmap — remaining work (jj slices)

Implement **only** under **`~/code/worktrees/me-os/clerk-users`**. Each row is one **bookmark** (`sw-clerk-<slice>`) for a **stacked PR**; order matters — use this sequence unless a hard dependency forces a tweak.

### Slice 1 — `sw-clerk-login` — Clerk owns sign-in

**Goal:** Real Clerk sessions in the browser; NextAuth can remain temporarily but must not be the gate for new flows.

- [ ] **`ClerkProvider`** in `web/app/providers.tsx` (compose with existing providers during transition).
- [ ] **Middleware:** **`clerkMiddleware`** (Next allows one middleware entry — reconcile with `web/proxy.ts` / NextAuth: either merge into a single middleware or migrate the auth gate to Clerk in this slice). **Public routes:** `/login`, static, `/api/webhooks/clerk`, `/api/meos/ensure-user`, and any Clerk / OAuth callbacks you add.
- [ ] **Replace `/login`** with Clerk **email/password** sign-in & sign-up (no Google as IdP in Clerk).
- [ ] After first successful session: call **`POST /api/meos/ensure-user`** (server layout, client effect, or dedicated “finishing sign-in” step), then **refresh Clerk session** so JWT includes **`app_user_id`**.
- [ ] **Env:** document **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**, **`CLERK_SECRET_KEY`**, **`CLERK_WEBHOOK_SIGNING_SECRET`** in `web/.env.local.example` (already partially done); **Vercel** same vars before production.

**Verify:** New user → row in **`public.users`** → **`publicMetadata.app_user_id`** set → Supabase JWT path can see claim after refresh; webhook still returns 200 from Clerk.

---

### Slice 2 — `sw-clerk-google-link` — Calendar integration only

**Goal:** Google OAuth **only** for Calendar tokens; **`user_id`** = **`public.users.id`**.

- [ ] **Connect Google** route(s): OAuth with Calendar scopes, no login conflation.
- [ ] Persist to **`linked_google_accounts`** using existing crypto/helpers; stop assuming tokens from NextAuth **`signIn`**.
- [ ] **Settings UI:** connect / disconnect / list accounts; optional per-account vs aggregate sync (decide in this slice).
- [ ] Update **`calendar-sync`** (and any callers) to use linked accounts only.

**Verify:** User with Clerk session connects two Google accounts; sync writes **`events`** only for their **`user_id`**.

---

### Slice 3 — `sw-clerk-supabase-jwt` — RLS path in the app

**Goal:** Tenant-scoped Supabase access uses **anon key + Clerk session JWT** where RLS should apply; **service role** only for webhooks, bootstrap, admin, or jobs that intentionally bypass RLS.

- [ ] Introduce a small helper (e.g. `createSupabaseForClerkUser()`) used by server components / route handlers that need RLS.
- [ ] Audit **`web/lib/db-supabase.ts`** and API routes: replace bare **`createServerClient()`** with JWT path **or** keep service role only where documented and always filter by **`appUserId`** — pick one consistent story per surface (per eng review: prefer JWT + RLS for user data).
- [ ] Add or extend tests for “wrong user cannot read other tenant’s rows” on at least one critical route.

**Verify:** Two Clerk users; cross-tenant reads fail under JWT client; happy path still works.

---

### Slice 4 — `sw-clerk-remove-nextauth` — Decommission

**Goal:** No NextAuth in production path.

- [ ] Remove **`next-auth`**, **`[...nextauth]`**, **`web/lib/auth.ts`** / **`auth.config.ts`** (and adapter) once Clerk gates the app.
- [ ] Remove **`SessionProvider`**, **`useSession`**, **`auth()` from NextAuth** from UI and server code; update **Capacitor** bridge if it assumed NextAuth cookies.
- [ ] Optional follow-up migration: drop **`next_auth`** schema when unused (**separate bookmark** if risky).

**Verify:** `pnpm next build`, `pnpm --filter web test:run`, smoke sign-in + sync.

---

### Slice 5 — `sw-clerk-mobile` — Capacitor parity

**Goal:** Mobile uses **Clerk** for identity; Google completion attaches to **`public.users.id`**.

- [ ] Clerk **native / Capacitor** sign-in per Clerk docs.
- [ ] Refactor **`/api/auth/mobile/google/*`** and **`createDatabaseSessionForGoogleUser`**-style flows to require Clerk session + same bootstrap as web.

**Verify:** iOS (or simulator) sign-in → connect Google → sync/handoff matches web.

---

### Slice 6 — `sw-clerk-hardening` — Tests, prod, cleanup

- [ ] **Vercel:** all Clerk + Supabase env vars; webhook URL **`…/app/me-os/api/webhooks/clerk`** if using **`NEXT_PUBLIC_BASE_PATH=/app/me-os`**.
- [ ] **Tests:** webhook handler (verify failure path), bootstrap unit tests (extend), optional RLS integration test with test JWT.
- [ ] **Manual:** two users × two Google accounts; invite/allowlist decision (open question in plan).
- [ ] **`pnpm test`** + **`pnpm --filter web test:run`** on the full stack before final merge.

---

## Phased tasks (reference — maps to roadmap)

The lettered phases below are the **original** breakdown; use the **Execution roadmap** above for day-to-day jj work. Checkboxes here stay as a secondary checklist.

### Phase A — Design resolution (no code or minimal spikes)

- [x] Document JWT claim shape and Supabase **Third-party auth** (appendix + dashboard).
- [x] **`public.users`** table name and minimal columns v1.
- [x] **Clerk Organizations** out of scope for v1 (unless you revisit).

### Phase B — Database

- [x] Migration **`public.users`** + FK repoint + RLS **`app_user_id`**.
- [x] `pnpm db:push` / `pnpm db:types` (regen types after apply; hand types OK until regen).

### Phase C — Web app auth

- [x] **`@clerk/nextjs`** + webhook + lazy **`ensure-user`**.
- [ ] Replace **`/login`** with Clerk; **Clerk middleware**; retire NextAuth as gate → **Slice 1–4**.

### Phase D — Google linking

- [ ] **Connect Google** + sync + settings → **Slice 2**.

### Phase E — Mobile

- [ ] **Slice 5**.

### Phase F — Decommission NextAuth

- [ ] **Slice 4**.

### Phase G — Verification

- [ ] **Slice 6**.

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

- [x] Create a **GitHub issue** referencing this plan — [#108](https://github.com/stephencweiss/me-os/issues/108).
- [x] Use a **dedicated jj workspace** for implementation — **`clerk-users`** (see **Development workflow** above); prefer jj over plain git worktrees for this line.

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
| 2026-03-27 | Planning | **Execution roadmap:** jj slices `sw-clerk-login` → `sw-clerk-google-link` → `sw-clerk-supabase-jwt` → `sw-clerk-remove-nextauth` → `sw-clerk-mobile` → `sw-clerk-hardening`; shipped baseline + reference phases A–G updated. |
