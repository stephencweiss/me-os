# TODOs

## Design system

- [ ] Add **`DESIGN.md`** at repo root as the design source of truth (typography scale, spacing/radius tokens, color roles beyond Tailwind defaults, motion if any, dark-mode rules, component primitives map to `web/app/components/`).
  - Why: No single doc today; plan-design-review capped “design system alignment” at 7/10 until this exists.
  - How: `/design-consultation` or hand-author after the **mobile alignment MVP** — pick one when you start implementation.

## CEO reprioritization (2026-03-19)

- [x] Reconcile **`/plan-eng-review`** with CEO amendment — **done:** `plans/eng-review-mobile-goal-alignment-phase1.md` (Phase 1 alignment + audit + `alignment-mobile-v1` schema). Slot-finder eng spec remains `plans/eng-review-slot-finder-2026-03-19.md` (**Phase 2**; supersession banner at top).
  - Context: CEO narrative `plans/ceo-mobile-goal-alignment.md`.

## Deferred from CEO review (2026-03-19)

- [ ] Add mandatory "Why this slot?" explanation for each slot-finder suggestion.
  - Why: Improves user trust and debuggability when recommendations look surprising.
  - Context: Deferred as E1 during selective expansion; implement after slot-finder core is stable.

- [ ] Add explicit stale/offline state handling for iOS widget data.
  - Why: Prevents silent trust erosion when widget data is outdated or auth expires.
  - Context: Deferred as E5; add once widget payload + refresh path are in production use.

- [x] Promote slot-finder design into repo docs — **shipped as** `docs/designs/slot-finder-widget.md` (plan-design-review, 2026-03-19). Optional: rename to `slot-finder.md` or merge CEO plan excerpts for one canonical filename.
