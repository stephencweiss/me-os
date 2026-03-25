# Navigation IA — Web and Mobile

**Status:** Draft (design)  
**Date:** 2026-03-24

## Goals

- **Home = today’s agenda** — first screen is operational “what’s on today,” not the weekly analytics view.
- **Job-shaped routes** — URLs read like the task (e.g. `/today`, `/week`, `/goals`).
- **Secondary actions** — calendar sync, accounts, deep settings live outside primary nav (header / overflow / settings stack).
- **Mobile** — bottom navigation for 3–4 primary destinations; avoid crowding with secondary tools.
- **Sharing** — canonical, shareable URLs for primary views.

## Information architecture

| Route        | Purpose |
|-------------|---------|
| `/`         | **Redirect** to `/today` (301/308 or Next.js `redirect`; see Implementation). |
| `/today`    | Today’s agenda (current `DayView` behavior). |
| `/week`     | Weekly roll-up: range selector, charts, filters (current Dashboard “calendar” tab). |
| `/goals`    | Weekly goals (current `WeeklyGoals`). |
| `/settings` | Settings and nested routes (`/settings/accounts`, etc.). |

**Legacy:** If `/day` exists today, keep a **permanent redirect** to `/today` so bookmarks and tests stay valid.

### Web chrome

- **Top:** primary nav as real links — **Today \| Week \| Goals** — driven by URL (`usePathname` / `<Link>`), not local tab state.
- **Right (or overflow on narrow desktop):** Settings, Sync calendar, user menu — secondary pattern unchanged in spirit.

### Mobile chrome

- **Bottom tab bar:** Today, Week, Goals; optional fourth tab **More** or **Settings** if a fourth tap target is needed.
- Secondary actions: top-right icon(s) and/or inside Settings — not duplicated on every tab.

## Week view: remembering the selected range (7 / 14 / 30 / 90 days)

Two reasonable places to persist the user’s last choice: **URL** (query or segment) vs **local storage** (or `sessionStorage`).

### Option A — URL (e.g. `/week?range=14`)

**Benefits**

- **Shareable and reproducible** — “look at my last 14 days” is one link; support and screenshots align with what you see.
- **Browser-native** — Back/forward can change range; refresh keeps the same view without extra code.
- **Multi-device honesty** — No false expectation that the phone “remembers” what the laptop had unless you use an account-backed preference later.

**Drawbacks**

- **Noisier URLs** — Query params are slightly uglier; must validate and clamp `range` to allowed values server- and client-side.
- **Implementation detail leaks** — If you ever rename or add ranges, old links need handling (redirect or accept legacy values).

### Option B — local storage (or `sessionStorage`)

**Benefits**

- **Clean canonical URL** — `/week` stays short; good if you care about “pretty” links in marketing or docs.
- **Personal default** — Survives refresh and revisits on **this** browser profile without touching the URL.

**Drawbacks**

- **Not shareable** — Sending `/week` does not include range; two people see different data for the “same” link.
- **Per-browser, not per-user** — New device or incognito resets; can confuse if users expect sync.
- **Hydration / SSR** — Client must read storage after mount; first paint may flash default range unless you accept a mismatch or defer data fetch (Next.js nuance in implementation).
- **Privacy / clearing data** — Clearing site data wipes the preference (usually fine, but worth knowing).

### Decision: URL first

Use **URL query** for `/week` range (`?range=7|14|30|90`) as the source of truth. Default navigation to Week should land on **`/week?range=7`** (or equivalent redirect) so the bar always reflects state.

**Optional later:** mirror last valid range to local storage **only when the query is omitted**, with rule: explicit query always wins; if absent, use stored value or fallback to `7`. Not part of the initial implementation.

The comparison above (Option A vs B) remains for historical context.

## Redirect behavior for `/`

- **`/` must redirect to `/today`** — not duplicate content — so shared/bookmarked “home” and canonical “today” stay consistent.
- Use a **permanent redirect** in production if stable (`308` preserves method; `301` is common for GET-only home). Next.js `redirect()` in `app/page.tsx` is acceptable for app routes.

## Non-goals (this spec)

- Visual design tokens, icon set, or exact bottom-tab component API.
- Capacitor-specific native tab plugins (implementation may wrap the same route map).

## Implementation plan

See **[docs/plans/2026-03-24-navigation-ia.md](../plans/2026-03-24-navigation-ia.md)** — route files, shared layout / nav, redirects, Dashboard split, URL `range`, tests, and rollout order.
