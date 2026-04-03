# Plan: Replace NextAuth + Google web login with Clerk

## Decision (locked)

- **Web** and **native (Capacitor)** both use **Clerk** for authentication.
- **No** long-term dual stack (NextAuth for mobile + Clerk for web). NextAuth is **removed from the web app** once migration is complete.
- **Calendar access** remains **linked Google accounts** (MeOS OAuth via `/api/google/link/*`), not “sign in with Google” as the primary IdP unless product changes it in Clerk.

## Goal

- **Web**: Users sign in via **Clerk** (`/login`, `/sign-up`), not NextAuth `signIn("google")`.
- **Native**: Sessions use **Clerk** (see Phase 3); NextAuth mobile routes are removed from the repo.
- **Identity for APIs**: `requireAuth()` / `getOptionalAuth()` resolve **`public.users.id`** from **Clerk `publicMetadata.app_user_id`**, with bootstrap via `/api/meos/ensure-user` + webhooks.
- **Supabase**: Tenant path (`withTenantSupabaseForApi`) uses Clerk session tokens with **`app_user_id`** claim.

---

## Status on branch `sw-clerk-supabase-jwt` (Mar 2026)

This branch combines:

1. **Clerk JWT + Supabase RLS** — anon client + tenant JWT, `ensure-user`, webhook bootstrap (earlier commits on this branch).
2. **Clerk UI slice** — cherry-pick **`d4345f95`** from `sw-clerk-login` as **`2dcea9cc`** (middleware, SignIn/SignUp, `ClerkProvider`, settings/UserMenu).
3. **NextAuth removal (web)** — uncommitted / pending commit: deletes Auth.js routes, `next-auth` + `@auth/supabase-adapter`, SessionProvider, mobile NextAuth handoff, and related tests/libs.

### Implemented after NextAuth removal

| Area | State |
|------|--------|
| **`web/proxy.ts`** | `clerkMiddleware` + `auth.protect()`. **Public:** `/login`, `/sign-up`, `/privacy`, `/terms`, `/api/health`, `/api/webhooks/clerk`, `/api/meos/ensure-user`. **Not** public: `/api/auth/*` (routes removed). |
| **`/login`**, **`/sign-up`** | Clerk `<SignIn />` / `<SignUp />` |
| **`providers.tsx`** | `ClerkProvider` + `ClerkBootstrapSession` + `CapacitorAuthBridge` only — **no** `SessionProvider` |
| **`auth-helpers.ts`** | **Clerk only** — `app_user_id` from `publicMetadata`; **401 `CLERK_APP_USER_PENDING`** if missing |
| **Google Calendar link** | `/api/google/link/start` → `/api/google/link/callback` + PKCE/state cookie (`AUTH_SECRET` / `NEXTAUTH_SECRET` / `CLERK_SECRET_KEY`) |
| **`web/package.json`** | No `next-auth`, no `@auth/supabase-adapter` |
| **Capacitor** | `CapacitorAuthBridge` reduced; native should use Clerk in WebView (full validation = Phase 3) |

### Deleted or heavily trimmed (high level)

- `web/app/api/auth/**` (`[...nextauth]`, mobile `google/start|callback`, `complete`)
- `web/lib/auth.ts`, `auth.config.ts`, `auth-session-cookie.ts`, `auth-request-url.ts`, `mobile-oauth-store.ts`, `mobile-session-handoff.ts`, `google-sign-in-shell.tsx`
- NextAuth mocks/tests; `auth-request-url` test file
- `mirrorLinkedGoogleFromNextAuthIfNeeded` and NextAuth-based linking assumptions in `linked-google-accounts.ts`

**DB:** `next_auth` schema may still exist in Supabase from historical migrations; optional drop in a later migration.

---

## Target state (reference)

| Area | Target |
|------|--------|
| Middleware | `clerkMiddleware`; public routes as listed above |
| Client | `useUser`, `useClerk().signOut` — no NextAuth |
| `auth-helpers` | Clerk only |
| Google link | `AUTH_URL` or `NEXTAUTH_URL` = public app URL for OAuth (variable names are legacy; not NextAuth sessions) |

---

## Phase 3 — Native (Capacitor): Clerk end-to-end

**Still required for native parity:** physical-device testing, session persistence, and any redirect URL updates now that `/api/auth/mobile/*` is gone. See historical file list in plan archive if needed.

---

## Phase 5 — Docs & env

- **`web/.env.local.example`**, **root `.env.example`**: Clerk primary; Google link OAuth vars documented (no NextAuth session block).
- **Clerk Dashboard**: Email (or chosen strategies); Google Calendar via **linked accounts** in MeOS.

---

## Risks

- **Existing NextAuth users**: Must sign in again with Clerk; no session migration.
- **`CLERK_APP_USER_PENDING`**: Resolved by bootstrap + webhooks.
- **Subpath**: `NEXT_PUBLIC_BASE_PATH` aligned with Clerk URLs and middleware.

---

## Verification checklist (for PR #109)

- [x] `pnpm test` (root) green
- [x] `pnpm --filter web test:run` green
- [x] `pnpm --filter web build` (local; production env still worth a pass on Vercel)
- [ ] Browser: sign in, `ensure-user`, API returns app `userId`
- [ ] Browser: **Connect Google Calendar** completes; sync works
- [ ] **Out of scope for this PR:** “Link another Google account” UI, multi-account sync picker — document as follow-ups

---

## Pull request #109 — description (paste into GitHub)

**Title:** `feat(web): Clerk auth, Supabase JWT, remove NextAuth`

**Summary**

Replaces NextAuth / Auth.js on the Next.js app with **Clerk** for sign-in and session management. API routes use **`requireAuth()`** backed by Clerk **`publicMetadata.app_user_id`** (Supabase `public.users.id`). **Supabase RLS** uses the Clerk-issued JWT with the **`app_user_id`** claim (`withTenantSupabaseForApi`). **Google Calendar** access is unchanged in spirit: users connect calendars via **`/api/google/link/*`** after Clerk sign-in (not Google as the web IdP).

**Scope**

- Add / consolidate **Clerk** middleware, login and sign-up pages, `ClerkProvider`, and bootstrap (`ClerkBootstrapSession`, `/api/meos/ensure-user`, `/api/webhooks/clerk` as applicable).
- **Remove** NextAuth: `next-auth`, `@auth/supabase-adapter`, `/api/auth/[...nextauth]`, mobile Auth.js routes, `SessionProvider`, and related helpers/components.
- **Tests** updated for Clerk-only `auth-helpers`, tenant Supabase, base path, and deployment URL behavior.
- **Settings → Linked accounts:** copy clarifies Clerk vs Google Calendar linking (no “mirror from Google sign-in”).
- **Env:** document **Clerk** keys, **`AUTH_URL` / `NEXTAUTH_URL`** as the public app URL for Google **link** OAuth (legacy env names), **`TOKEN_ENCRYPTION_KEY`**, optional **`CLERK_SUPABASE_JWT_TEMPLATE`**. See `web/.env.local.example` and root `.env.example`.

**Not in this PR**

- Full **Capacitor** QA and any new native deep-link flows (tracked as follow-up).
- **Multiple linked Google accounts** UX (“link another”, sync-all) — product follow-up / stacked PR.

**How to test**

1. Copy `web/.env.local.example` → `web/.env.local` and fill Clerk, Supabase, Google OAuth, `AUTH_URL`/`NEXTAUTH_URL`, `TOKEN_ENCRYPTION_KEY`.
2. `pnpm install` (repo root), then `pnpm test` and `pnpm --filter web build`.
3. `cd web && pnpm dev` — sign in, open a protected page, run **Connect Google Calendar**, then calendar sync from Settings.

**Related doc**

- `docs/superpowers/plans/clerk-replace-nextauth-web-login.md` (this file)

---

## Branch / integration notes

**[PR #109](https://github.com/stephencweiss/me-os/pull/109)** — branch **`sw-clerk-supabase-jwt`**.

Cherry-pick **`d4345f95`** from **`sw-clerk-login`** was applied as **`2dcea9cc`**. Google link work was already on this branch from earlier merges.

**Optional:** Compare with `~/code/worktrees/me-os/clerk-users` only if something looks missing.

**Ordering for future merges:** JWT / DB → Clerk UI → Google link tweaks minimizes conflicts.

---

## Obsolete options (superseded)

~~Dual stack (NextAuth for mobile only)~~ — **rejected**; native uses Clerk.  
~~Deprecate mobile until Clerk~~ — **rejected**; native migrates to Clerk in Phase 3.
