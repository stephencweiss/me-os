# Design plan: Slot finder + iOS widget + weekly audit

**Status:** Draft (from `/plan-design-review`, 2026-03-19)  
**Product context:** MeOS — protection goals, deterministic slots first, suggest-before-move, personal dogfood.  
**CEO scope:** E2 JSON schema first, E3 weekly audit vertical, E4 per-goal working hours; E1/E5/E6 deferred (see repo `TODOS.md`).

---

## Design system note

There is **no repo `DESIGN.md`**. This plan **aligns with existing webapp patterns**:

- **Tailwind** utility styling, **`dark:`** variants where the rest of the app uses them.
- **`Button`** (`web/app/components/Button.tsx`): variants `primary` | `secondary` | `ghost` | `danger`; sizes `sm` | `md` | `lg`.
- **Typography:** match weekly goals / calendar views — no new font stack unless you add `DESIGN.md` later.

---

## Pass 1 — Information architecture (target: 9/10)

### Web — slot finder (primary surface before widget)

**Goal:** Answer in under 5 seconds: *“Where can I put this goal today / this week?”*

```
┌─────────────────────────────────────────────────────────────┐
│  Header: goal title + week range              [Edit goal]   │
├─────────────────────────────────────────────────────────────┤
│  PRIMARY: "Best slot today"                                 │
│   • Time range + day label                                  │
│   • One-line constraint summary (E1 deferred — optional)    │
│   • [Open in Calendar]  [Show alternates ▼]                 │
├─────────────────────────────────────────────────────────────┤
│  SECONDARY: week strip or list — Mon→Sun, one row per day    │
│   • Each row: best slot OR "No fit" + [Adjust]              │
├─────────────────────────────────────────────────────────────┤
│  TERTIARY: "Constraints" accordion                          │
│   • Duration, cadence, per-goal hours (E4)                  │
│   • Calendars included / excluded                           │
└─────────────────────────────────────────────────────────────┘
```

**Navigation:** Entry from **weekly goals** row action (“Find time”) or dedicated `/protect` route — pick one in implementation; avoid both doing different things.

**Constraint worship (3 things only on first paint):** (1) best slot today, (2) week progress toward protected minutes, (3) one affordance to adjust constraints.

### iOS widget (small + medium)

- **Small:** Goal short name + **start–end** of top slot today, or **“No slot fits”** + tap to open app.
- **Medium:** Same + **secondary line**: minutes still needed this week / next best day.

### Weekly audit (E3)

- **Push title:** Plain language, e.g. “Did your week match what you wanted?”
- **Tap →** in-app **single screen**: summary + **Dismiss** / **Snooze 3d** / **Open slot finder** (no multi-step funnel).

---

## Pass 2 — Interaction state coverage (target: 8/10)

| Feature | Loading | Empty | Error | Success | Partial |
|--------|---------|-------|-------|---------|--------|
| Load slot suggestions | Skeleton or spinner on primary block | No goal selected → warm CTA to pick/create goal | Calendar sync/API failure → message + retry | Slots rendered | Some days “no fit” while others OK → per-row state |
| Edit constraints (E4) | Save debounce / inline “Saving…” | N/A | Validation message (e.g. end before start) | Toast or inline “Saved” | Stale slots → “Recalculate” chip |
| Open in Calendar | N/A | N/A | N/A | Opens deep link or copy ICS snippet (decide one) | N/A |
| Widget | Placeholder or last-good data policy (E5 deferred) | “No goal” line + tap to open | Don’t show fake times; neutral string | Show slot | Show “Partial week” if some days missing |
| Weekly audit notification | N/A | N/A | Delivery failure is OS-level | Sheet with actions | Snoozed state remembered |

**Empty-state warmth:** No goal → *“Pick something to protect this week”* + primary **Create goal** (not “No items”).

---

## Pass 3 — User journey & emotional arc (target: 8/10)

| Step | User does | User should feel | Design support |
|------|-----------|------------------|----------------|
| 1 | Opens slot finder | Relief (“it’s not another calendar grid”) | One hero answer first |
| 2 | Sees “no fit” | In control, not judged | Explain *constraint*, suggest **one** relax control |
| 3 | Opens Calendar | Trust | Slot time matches what they saw |
| 4 | Glances widget | Reassured / nudged | No clutter; optional progress |
| 5 | Gets weekly audit | Reflective, not guilty | Short copy; dismiss easy |

**5-second / 5-minute / 5-year:** Glance correctness (5s); adjust constraints and recalc (5min); schema + trust ladder stable for years (5yr).

---

## Pass 4 — AI slop risk (target: 8/10)

**Avoid:** Generic “dashboard” of cards, purple gradients, three-column marketing layout, chat-first UI for the **core** flow.

**Do:** Dense, **calendar-native** language (time ranges, day names), **single primary** recommendation, tool chrome that feels like **instrument panel** not landing page.

**NL (later):** Secondary entry — e.g. “Try: 1h writing before noon” as **chips** that map to constraint fields, not a blank chat thread.

---

## Pass 5 — Design system alignment (target: 7/10 until DESIGN.md exists)

- Reuse **Button**, existing **form patterns** from `GoalForm` / `WeeklyGoals`.
- **New components** only if needed: `SlotCard`, `DayRow`, `ConstraintAccordion` — keep in `web/app/components/`.

**Gap:** Add **`DESIGN.md`** when you want tokens (radius, spacing scale) documented; optional `/design-consultation` later.

---

## Pass 6 — Responsive & accessibility (target: 8/10)

- **Mobile web:** Primary block full width; week list **vertical** scroll; touch targets **≥ 44px** on actions.
- **Keyboard:** Accordion and alternates expandable with **Enter/Space**; focus order: primary CTA → week list → constraints.
- **Screen readers:** `aria-live="polite"` on recalculated results; slot times as readable text, not only icons.
- **Contrast:** Follow existing light/dark classes; don’t rely on color alone for “good/bad” slot (use text).

---

## Pass 7 — Unresolved decisions (implementer must choose)

| Decision | If deferred |
|----------|-------------|
| **Entry route** — goals-only vs `/protect` | Duplicate entrypoints confuse users |
| **“Open in Calendar”** — Google deep link vs copy time | Broken expectations on tap |
| **Widget refresh** — timeline + last-good vs only-after-open | E5 will force this later |
| **Audit copy tone** — neutral vs coachy | Brand feel; easy to change in strings |
| **JSON Schema owner** — OpenAPI vs standalone `.schema.json` | E2 requires one source of truth |

---

## NOT in scope (design)

- Android widget layouts.
- Full NL chat UX as primary.
- Marketing website visual language.

---

## Completion summary (design review)

| Dimension | Before | After |
|-----------|--------|-------|
| Info architecture | 3/10 | 9/10 (this doc) |
| Interaction states | 2/10 | 8/10 |
| Journey | 3/10 | 8/10 |
| AI slop risk | 5/10 | 8/10 |
| Design system | 4/10 | 7/10 (no DESIGN.md) |
| Responsive / a11y | 2/10 | 8/10 |
| Unresolved decisions | many | 5 listed |

**Overall:** ~**4/10 → 8/10** — ready for implementation planning; run **`/design-review`** on the live UI after build.

**Next:** `/plan-eng-review` (after your chosen order), then implement against **E2 schema** + this doc.
