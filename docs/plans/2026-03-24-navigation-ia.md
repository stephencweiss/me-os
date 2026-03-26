# Plan: Navigation IA (routes, URL-first week range, mobile bottom nav)

**Spec:** [docs/specs/2026-03-24-navigation-ia-design.md](../specs/2026-03-24-navigation-ia-design.md)  
**Date:** 2026-03-24

## Scope

Implement job-shaped primary routes, `/` → `/today`, legacy `/day` → `/today`, URL-driven **week range** (`?range=`), shared primary navigation (web top + mobile bottom), and split today vs week vs goals from the current monolithic `Dashboard` tab state.

**Out of scope for this plan:** localStorage fallback for omitted `range` (optional follow-up per spec). Capacitor-native tab bars unless the web bottom nav is insufficient.

## 1. Routes and redirects

| Change | Detail |
|--------|--------|
| `app/page.tsx` | Replace `Dashboard` default export with `redirect("/today")` from `next/navigation` (permanent redirect policy: use `redirect` default 307 in dev; document or configure permanent if required for SEO — usually acceptable for app shell). |
| `app/today/page.tsx` | New route rendering current `DayView` (move import from `app/day/page.tsx`). |
| `app/day/page.tsx` | Replace with `redirect("/today")` or `permanentRedirect` so old URLs keep working. |
| `app/week/page.tsx` | New route rendering **week roll-up only** (extract from `Dashboard` — see §2). |
| `app/goals/page.tsx` | New route rendering **goals only** (extract from `Dashboard` — see §2). |

**Canonical week URL:** On navigation to Week, use **`/week?range=7`** as the default target (links and redirects) so the address bar always reflects state without a silent default inside client-only state. Alternative acceptable pattern: allow bare `/week` and immediately `router.replace` to `/week?range=7` on the client — slightly more flicker; prefer defaulting links to `?range=7`.

## 2. Refactor `Dashboard.tsx`

- **Extract** “calendar tab” body (filters, summary cards, charts, event drill-down) into a dedicated component, e.g. `WeekOverview.tsx` or `WeekDashboard.tsx`, driven by props: `days` derived from validated `range` query.
- **Extract** shared header chrome that today/week/goals will use, or split into:
  - `PrimaryNav` — Today \| Week \| Goals (`Link` + `usePathname()` for active styles).
  - `AppTopBar` — optional wrapper: title area + `PrimaryNav` + secondary actions (Sync, Settings).
- **Remove** internal `activeTab` / `TabType` from the week page path; goals content only lives on `/goals`.
- **Week range:**
  - Read `searchParams.range` in the **server** `page.tsx` if you prefetch, or in a **client** wrapper with `useSearchParams` — pick one consistent with how `Dashboard` currently fetches (today it is client `useEffect` + `fetch`). Minimum: parse `range` on client, validate against `ALLOWED = [7, 14, 30, 90]`, clamp invalid/missing to `7`, and when user clicks a range button call `router.push` / `router.replace` with updated query so URL stays source of truth.
  - Deep links: `/week?range=30` must load 30-day data without manual UI toggling.

## 3. Layout and navigation UI

- Add a **route group** (optional) `app/(main)/layout.tsx` wrapping `today`, `week`, `goals` with shared layout containing:
  - **Desktop:** horizontal primary nav at top (existing visual language: segmented control style can become link-styled tabs).
  - **Mobile:** fixed **bottom tab bar** with the same three routes; use `md:` or `lg:` breakpoints to hide bottom bar on larger screens and show top nav (or show both if product prefers — spec assumes bottom on mobile, top on web).
- **Settings routes** (`/settings`, `/settings/accounts`, …): either keep current standalone layouts or nest under a layout **without** the three-tab primary nav (spec: secondary). Do not force Today/Week/Goals on full-screen settings flows unless you add a minimal “back to app” affordance.
- **DayView** and week page: ensure secondary actions (Sync calendar, Settings) remain available consistent with current `Dashboard` header — possibly via shared `AppTopBar` used only on main shell routes.

## 4. Link and redirect hygiene

- Update **settings** “home” links from `href="/"` to **`/today`** if you want post-login land + bookmarks to match primary IA; keeping `"/"` is still valid (redirect). Prefer **`/today`** in visible UI labels for clarity (“Today” not “Home”).
- **`login` callback:** `callbackUrl ?? "/"` remains fine (`/` → `/today`). Optionally default `callbackUrl` to `/today` in UI for clarity.
- Search codebase for **`/day`** references; update tests and any docs to **`/today`**.

## 5. Tests

- **`safe-redirect-path.test.ts`:** change example path from `/day` to `/today` (or add `/today` case) so allowed-path tests reflect new IA.
- **New or updated component tests:** `PrimaryNav` active state given pathname; week page parses `range` correctly (table-driven: valid, invalid, missing → 7).
- **Integration (optional):** request `/` and assert redirect location `/today` (if test harness supports Next redirects).

## 6. Verification

- Manually: `/`, `/day` → `/today`; `/week`, `/week?range=14`; `/goals`; settings pages without broken layout; mobile width bottom nav visible and tappable.
- Run `pnpm --filter web test:run` and root `pnpm test` if web tests are part of CI.

## 7. Ordering (suggested)

1. Redirects: `/` and `/day` → `/today`; add `app/today/page.tsx` (move content from `/day`).
2. Extract `WeekOverview` + `app/week/page.tsx` with URL `range` + `router` updates.
3. Add `app/goals/page.tsx` using extracted goals-only view.
4. Introduce `(main)` layout + `PrimaryNav` + mobile bottom bar; strip old `Dashboard` tabs from week page.
5. Clean up dead `Dashboard` export from `app/page.tsx` (already redirect-only); remove or slim `Dashboard.tsx` into week-specific module.
6. Tests and link sweep.

## Risks / notes

- **Bundle size:** three routes may each import large chart libs; acceptable if only week imports Recharts; today/goals should avoid pulling charts.
- **SSR:** `DayView` and week data fetching are client-heavy today; URL-first range does not require SSR for v1.
