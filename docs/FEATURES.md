# Calendar Dashboard - Feature Roadmap

**GitHub Issue**: https://github.com/stephencweiss/me-os/issues/27

This document tracks features for the calendar dashboard webapp.

---

## MVP (Phase 2a)

Core interactive features to make the dashboard usable.

- [ ] **Calendar/account filters** - Dropdown to select which calendars to include
- [ ] **Pie chart percentages** - Show % alongside hours in category breakdown
- [ ] **Week markers on timeline** - Shaded regions or vertical lines for week boundaries
- [ ] **Fix overlap handling** - Merge overlapping events in time calculations (show actual hours, not >24h/day)
- [ ] **Interactive date range picker** - Select 7d, 30d, 90d, or custom date ranges

---

## Phase 2b - Event Management

Allow users to interact with individual events.

- [ ] **Mark "did not attend"** - Click event to mark as skipped (affects time calculations)
- [ ] **Event drill-down** - Click chart segment to see individual events in that category
- [ ] **Conflict detection UI** - Highlight double-booked time periods

---

## Phase 2c - Optimization

Performance and efficiency improvements.

- [ ] **Use stored data for summaries** - Generate daily summaries from DB instead of re-fetching from Google Calendar
- [ ] **Incremental sync** - Only fetch changed events (use syncToken or updatedMin)
- [ ] **Background sync** - Auto-sync on schedule (Vercel cron or local cron)

---

## Future Ideas

Nice-to-have features for later consideration.

- [ ] **Goals integration** - Show progress toward weekly goals on dashboard
- [ ] **Predictions** - "At this rate, you'll spend X hours in meetings this month"
- [ ] **Export to CSV/PDF** - Download reports for sharing
- [ ] **Mobile-friendly responsive design** - Better experience on phones/tablets
- [ ] **Dark mode** - Reduce eye strain

---

## Completed

### Phase 1 (Static Dashboard) - DONE

- [x] SQLite database with events, daily_summaries, event_changes tables
- [x] Calendar sync with change detection (added/modified/removed)
- [x] Static HTML dashboard with Chart.js
- [x] CLI scripts: `npm run sync`, `npm run dashboard`
- [x] Multi-account support (personal, personal2, work)

---

## How to Update This Document

When a feature is completed:
1. Move it from its current section to "Completed"
2. Add `[x]` checkbox
3. Note any relevant details (PR number, date, etc.)

When adding new features:
1. Add to appropriate section based on priority
2. Use `- [ ]` checkbox format
3. Include brief description of what the feature does
