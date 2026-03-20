---
status: ACTIVE
created: 2026-03-19
amended: 2026-03-19
---

# Design: Mobile goal alignment — native iOS client

Product decision for **Phase 1 alignment mobile** (see `plans/ceo-mobile-goal-alignment.md`, `plans/eng-review-mobile-goal-alignment-phase1.md`, `plans/mobile-alignment-mvp-build.md`).

## Client strategy (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Primary mobile experience** | **Native iOS app** (not a website in Safari as the product) | You want an **app** on the phone: OS integration, navigation, and polish that read as “real iOS,” not a shrunken dashboard. |
| **UI stack** | **SwiftUI** | Best fit for **Apple polish**, long-term maintenance in one ecosystem, and **shared language** with **Phase 2 WidgetKit** (widgets are Swift/SwiftUI, not React). |
| **Android** | **Explicitly out of scope for now** | Optimize for speed and quality on **one** platform first. A future Android app (or RN) is a **separate product decision**; it is not required for Phase 1. |
| **Responsive web / `/m/*` / Capacitor** | **Not the mobile product** | Those remain useful for **quick validation** or **internal dogfood**, but they are **not** the target experience for your personal bar on mobile. |
| **Backend contract** | Existing **MeOS webapp APIs** | Phase 1 server work centers on **`GET /api/week-alignment`**, **`POST /api/week-alignment/audit`**, and **`schemas/alignment-mobile-v1.json`**. The iOS app is a **consumer** of that contract. |
| **Auth** | **Native-friendly session** (eng **Track C**) | NextAuth **cookie** sessions do not apply to a standalone app the way they do in a browser. Plan for **Google Sign-In (or ASWebAuthenticationSession) + tokens or session** the API accepts—spike and lock before heavy UI. |
| **Widgets (Phase 2)** | **Swift / WidgetKit** | Home-screen widgets stay **native** regardless of main-app framework; SwiftUI for the main app avoids a two-language split for *your* Apple surfaces. |

## What “polish” implies (non-exhaustive)

- System typography, Dynamic Type, safe areas, native sheets/navigation.
- Clear **401 → sign-in** flow (no fake “logged in” empty states).
- Honest **syncHint** copy (`fresh` / `stale` / `unknown`) surfaced in UI, aligned with the DTO.
- Audit UX: dismiss, snooze, backoff consistent with `weekly_audit_state` and eng review.

## Local testing (backend before SwiftUI)

See **`docs/testing-week-alignment-local.md`** (where to `cd`, `pnpm` commands, env, Supabase migration, browser vs local mode, manual GET/POST checks, and how to open a PR from jj).

## References

- API: `webapp/app/api/week-alignment/route.ts`, `webapp/app/api/week-alignment/audit/route.ts`
- DTO builder: `webapp/lib/week-alignment-core.ts`, `webapp/lib/week-alignment.ts`
- JSON Schema: `schemas/alignment-mobile-v1.json`
- Slot-first widget spec (Phase 2, separate): `docs/designs/slot-finder-widget.md`
