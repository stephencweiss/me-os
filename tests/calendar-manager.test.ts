/**
 * Calendar Manager Tests
 *
 * TDD: Write tests first, then implement to make them pass.
 */

import { describe, it, expect } from "vitest";
import {
  buildOverlapGroups,
  calculateOverlapMinutes,
  suggestCategory,
  extractRecurringParentId,
  findUnlabeledEvents,
  calculateFlexSlots,
  OverlapGroup,
  FlexSlot,
} from "../lib/calendar-manager.js";
import type { CalendarEvent } from "../lib/time-analysis.js";

// Helper to create test events
function createEvent(
  id: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  summary = "Test Event"
): CalendarEvent {
  const start = new Date(2026, 1, 22, startHour, startMinute); // Feb 22, 2026
  const end = new Date(2026, 1, 22, endHour, endMinute);
  return {
    id,
    account: "test",
    summary,
    start,
    end,
    durationMinutes: (end.getTime() - start.getTime()) / 60000,
    colorId: "1",
    colorName: "Lavender",
    colorMeaning: "1:1s / People",
    isAllDay: false,
  };
}

describe("buildOverlapGroups", () => {
  it("returns empty array for non-overlapping events", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0), // 9:00-10:00
      createEvent("b", 11, 0, 12, 0), // 11:00-12:00
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(0);
  });

  it("groups two overlapping events", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0), // 9:00-10:00
      createEvent("b", 9, 30, 10, 30), // 9:30-10:30 (overlaps with a)
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[0].events.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("chains overlapping events into single group", () => {
    // A: 10:00-10:30
    // B: 10:15-10:45 (overlaps A)
    // C: 10:30-11:00 (overlaps B, touches A)
    // D: 10:30-11:30 (overlaps B, C)
    // E: 11:00-11:30 (overlaps C, D)
    // All should be in one group
    const events = [
      createEvent("a", 10, 0, 10, 30),
      createEvent("b", 10, 15, 10, 45),
      createEvent("c", 10, 30, 11, 0),
      createEvent("d", 10, 30, 11, 30),
      createEvent("e", 11, 0, 11, 30),
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(5);
  });

  it("handles exact same start/end times", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0),
      createEvent("b", 9, 0, 10, 0), // Same time as a
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it("handles back-to-back events (no overlap)", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0), // 9:00-10:00
      createEvent("b", 10, 0, 11, 0), // 10:00-11:00 (starts when a ends)
    ];

    const groups = buildOverlapGroups(events);

    // Back-to-back events don't overlap (end == start is not overlap)
    expect(groups).toHaveLength(0);
  });

  it("creates separate groups for non-connected overlaps", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0), // Group 1: 9:00-10:00
      createEvent("b", 9, 30, 10, 30), // Group 1: overlaps a
      createEvent("c", 14, 0, 15, 0), // Group 2: 14:00-15:00
      createEvent("d", 14, 30, 15, 30), // Group 2: overlaps c
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(2);
    expect(groups[0].events.map((e) => e.id).sort()).toEqual(["a", "b"]);
    expect(groups[1].events.map((e) => e.id).sort()).toEqual(["c", "d"]);
  });

  it("returns group with correct time span", () => {
    const events = [
      createEvent("a", 9, 0, 10, 0),
      createEvent("b", 9, 30, 11, 0), // Extends past a
    ];

    const groups = buildOverlapGroups(events);

    expect(groups[0].timeSlot.start).toEqual(new Date(2026, 1, 22, 9, 0));
    expect(groups[0].timeSlot.end).toEqual(new Date(2026, 1, 22, 11, 0));
  });

  it("excludes all-day events", () => {
    const events: CalendarEvent[] = [
      createEvent("a", 9, 0, 10, 0),
      createEvent("b", 9, 30, 10, 30),
      {
        ...createEvent("c", 0, 0, 23, 59),
        isAllDay: true,
      },
    ];

    const groups = buildOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[0].events.every((e) => !e.isAllDay)).toBe(true);
  });
});

describe("calculateOverlapMinutes", () => {
  it("returns correct overlap for partially overlapping events", () => {
    const a = createEvent("a", 9, 0, 10, 0); // 9:00-10:00
    const b = createEvent("b", 9, 30, 10, 30); // 9:30-10:30

    const overlap = calculateOverlapMinutes(a, b);

    expect(overlap).toBe(30); // 9:30-10:00 = 30 minutes
  });

  it("returns 0 for non-overlapping events", () => {
    const a = createEvent("a", 9, 0, 10, 0);
    const b = createEvent("b", 11, 0, 12, 0);

    const overlap = calculateOverlapMinutes(a, b);

    expect(overlap).toBe(0);
  });

  it("returns full duration when one event is contained in another", () => {
    const a = createEvent("a", 9, 0, 12, 0); // 9:00-12:00
    const b = createEvent("b", 10, 0, 11, 0); // 10:00-11:00 (inside a)

    const overlap = calculateOverlapMinutes(a, b);

    expect(overlap).toBe(60); // 10:00-11:00 = 60 minutes
  });

  it("returns full duration for identical times", () => {
    const a = createEvent("a", 9, 0, 10, 0);
    const b = createEvent("b", 9, 0, 10, 0);

    const overlap = calculateOverlapMinutes(a, b);

    expect(overlap).toBe(60);
  });

  it("returns 0 for back-to-back events", () => {
    const a = createEvent("a", 9, 0, 10, 0);
    const b = createEvent("b", 10, 0, 11, 0);

    const overlap = calculateOverlapMinutes(a, b);

    expect(overlap).toBe(0);
  });
});

// ============================================================================
// Categorization Tests
// ============================================================================

describe("suggestCategory", () => {
  it('suggests Lavender for "1:1 with Alice"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "1:1 with Alice");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("1");
    expect(suggestion.colorName).toBe("Lavender");
    expect(suggestion.confidence).toBeGreaterThan(0.5);
  });

  it('suggests Lavender for "one on one with Bob"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "one on one with Bob");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("1");
    expect(suggestion.colorName).toBe("Lavender");
  });

  it('suggests Lavender for "Sync with Carol"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "Sync with Carol");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("1");
    expect(suggestion.colorName).toBe("Lavender");
  });

  it('suggests Flamingo for "Team standup"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "Team standup");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("4");
    expect(suggestion.colorName).toBe("Flamingo");
    expect(suggestion.meaning).toBe("Meetings");
  });

  it('suggests Grape for "Sprint review"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "Sprint review");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("3");
    expect(suggestion.colorName).toBe("Grape");
  });

  it('suggests Sage for "Focus time"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "Focus time");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("2");
    expect(suggestion.colorName).toBe("Sage");
  });

  it('suggests Sage for "Deep work"', () => {
    const event = createEvent("a", 9, 0, 10, 0, "Deep work on project");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("2");
    expect(suggestion.colorName).toBe("Sage");
  });

  it('suggests Tangerine for "Family dinner"', () => {
    const event = createEvent("a", 18, 0, 19, 0, "Family dinner");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("6");
    expect(suggestion.colorName).toBe("Tangerine");
    expect(suggestion.meaning).toBe("Family Time");
  });

  it('suggests Blueberry for "Morning gym workout"', () => {
    const event = createEvent("a", 6, 0, 7, 0, "Morning gym workout");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("9");
    expect(suggestion.colorName).toBe("Blueberry");
    expect(suggestion.meaning).toBe("Fitness");
  });

  it('suggests Basil for "Coffee with friends"', () => {
    const event = createEvent("a", 10, 0, 11, 0, "Coffee with friends");

    const suggestion = suggestCategory(event);

    expect(suggestion.colorId).toBe("10");
    expect(suggestion.colorName).toBe("Basil");
    expect(suggestion.meaning).toBe("Social");
  });

  it("returns low confidence for unknown patterns", () => {
    const event = createEvent("a", 9, 0, 10, 0, "Random meeting about stuff");

    const suggestion = suggestCategory(event);

    expect(suggestion.confidence).toBeLessThan(0.5);
  });
});

describe("extractRecurringParentId", () => {
  it("extracts parent from instance ID with date suffix", () => {
    const instanceId = "sa8vq84c1lf1g1cr653erfp7m4_20260222T130000Z";

    const parentId = extractRecurringParentId(instanceId);

    expect(parentId).toBe("sa8vq84c1lf1g1cr653erfp7m4");
  });

  it("returns null for non-recurring event ID", () => {
    const eventId = "abc123xyz";

    const parentId = extractRecurringParentId(eventId);

    expect(parentId).toBeNull();
  });

  it("handles IDs with multiple underscores", () => {
    // Some IDs might have underscores in the base part
    const instanceId = "event_with_underscores_20260222T130000Z";

    const parentId = extractRecurringParentId(instanceId);

    expect(parentId).toBe("event_with_underscores");
  });

  it("returns null for ID with underscore but no date pattern", () => {
    const eventId = "event_with_underscore_but_no_date";

    const parentId = extractRecurringParentId(eventId);

    expect(parentId).toBeNull();
  });
});

describe("findUnlabeledEvents", () => {
  it("returns events with no colorId", () => {
    const events: CalendarEvent[] = [
      { ...createEvent("a", 9, 0, 10, 0), colorId: "1" },
      { ...createEvent("b", 10, 0, 11, 0), colorId: "" },
      { ...createEvent("c", 11, 0, 12, 0), colorId: "3" },
    ];

    const unlabeled = findUnlabeledEvents(events);

    expect(unlabeled).toHaveLength(1);
    expect(unlabeled[0].id).toBe("b");
  });

  it("returns events with default colorId", () => {
    const events: CalendarEvent[] = [
      { ...createEvent("a", 9, 0, 10, 0), colorId: "1" },
      { ...createEvent("b", 10, 0, 11, 0), colorId: "default" },
    ];

    const unlabeled = findUnlabeledEvents(events);

    expect(unlabeled).toHaveLength(1);
    expect(unlabeled[0].id).toBe("b");
  });

  it("returns empty array when all events are labeled", () => {
    const events: CalendarEvent[] = [
      { ...createEvent("a", 9, 0, 10, 0), colorId: "1" },
      { ...createEvent("b", 10, 0, 11, 0), colorId: "3" },
    ];

    const unlabeled = findUnlabeledEvents(events);

    expect(unlabeled).toHaveLength(0);
  });

  it("returns all events when none are labeled", () => {
    const events: CalendarEvent[] = [
      { ...createEvent("a", 9, 0, 10, 0), colorId: "" },
      { ...createEvent("b", 10, 0, 11, 0), colorId: "" },
    ];

    const unlabeled = findUnlabeledEvents(events);

    expect(unlabeled).toHaveLength(2);
  });
});

// ============================================================================
// Flex Slot Tests
// ============================================================================

describe("calculateFlexSlots", () => {
  // Default config: 6am-10pm waking hours, 30min minimum gap, no weekends
  const defaultConfig = {
    wakingHours: { start: 6, end: 22 },
    minGapMinutes: 30,
    skipWeekends: true,
  };

  it("finds gaps during waking hours", () => {
    // Feb 22, 2026 is a Sunday, let's use Monday Feb 23
    const monday = new Date(2026, 1, 23);
    const events = [
      createEventOnDate(monday, 9, 0, 10, 0), // 9:00-10:00
      createEventOnDate(monday, 14, 0, 15, 0), // 14:00-15:00
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // Expected gaps:
    // 6:00-9:00 (3h = 180min)
    // 10:00-14:00 (4h = 240min)
    // 15:00-22:00 (7h = 420min)
    expect(flexSlots.length).toBe(3);
    expect(flexSlots[0].durationMinutes).toBe(180); // 6:00-9:00
    expect(flexSlots[1].durationMinutes).toBe(240); // 10:00-14:00
    expect(flexSlots[2].durationMinutes).toBe(420); // 15:00-22:00
  });

  it("ignores gaps less than minGapMinutes", () => {
    const monday = new Date(2026, 1, 23);
    const events = [
      createEventOnDate(monday, 9, 0, 10, 0), // 9:00-10:00
      createEventOnDate(monday, 10, 20, 11, 0), // 10:20-11:00 (20 min gap before)
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // The 20-min gap (10:00-10:20) should be excluded
    const gapBetweenEvents = flexSlots.find(
      (s) => s.start.getHours() === 10 && s.start.getMinutes() === 0
    );
    expect(gapBetweenEvents).toBeUndefined();
  });

  it("ignores weekends when skipWeekends is true", () => {
    // Feb 22, 2026 is a Sunday
    const sunday = new Date(2026, 1, 22);
    const events = [createEventOnDate(sunday, 9, 0, 10, 0)];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    expect(flexSlots).toHaveLength(0);
  });

  it("includes weekends when skipWeekends is false", () => {
    const sunday = new Date(2026, 1, 22);
    const events = [createEventOnDate(sunday, 9, 0, 10, 0)];

    const flexSlots = calculateFlexSlots(events, {
      ...defaultConfig,
      skipWeekends: false,
    });

    expect(flexSlots.length).toBeGreaterThan(0);
  });

  it("excludes gaps before waking hours start", () => {
    const monday = new Date(2026, 1, 23);
    const events = [
      createEventOnDate(monday, 5, 0, 5, 30), // 5:00-5:30 (before waking hours)
      createEventOnDate(monday, 10, 0, 11, 0), // 10:00-11:00
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // Should not include any slot starting before 6:00
    const earlySlot = flexSlots.find((s) => s.start.getHours() < 6);
    expect(earlySlot).toBeUndefined();
  });

  it("excludes gaps after waking hours end", () => {
    const monday = new Date(2026, 1, 23);
    const events = [
      createEventOnDate(monday, 10, 0, 11, 0), // 10:00-11:00
      createEventOnDate(monday, 23, 0, 23, 30), // 23:00-23:30 (after waking hours)
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // Last slot should end at 22:00 (waking hours end)
    const lastSlot = flexSlots[flexSlots.length - 1];
    expect(lastSlot.end.getHours()).toBe(22);
  });

  it("handles multiple days", () => {
    const monday = new Date(2026, 1, 23);
    const tuesday = new Date(2026, 1, 24);
    const events = [
      createEventOnDate(monday, 10, 0, 11, 0),
      createEventOnDate(tuesday, 14, 0, 15, 0),
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // Should have slots for both days
    const mondaySlots = flexSlots.filter(
      (s) => s.start.getDate() === 23
    );
    const tuesdaySlots = flexSlots.filter(
      (s) => s.start.getDate() === 24
    );

    expect(mondaySlots.length).toBeGreaterThan(0);
    expect(tuesdaySlots.length).toBeGreaterThan(0);
  });

  it("returns empty array when day is fully booked", () => {
    const monday = new Date(2026, 1, 23);
    // Create events that cover all waking hours
    const events = [createEventOnDate(monday, 6, 0, 22, 0)];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    expect(flexSlots).toHaveLength(0);
  });

  it("handles overlapping events correctly", () => {
    const monday = new Date(2026, 1, 23);
    const events = [
      createEventOnDate(monday, 10, 0, 11, 0),
      createEventOnDate(monday, 10, 30, 11, 30), // Overlaps with first
    ];

    const flexSlots = calculateFlexSlots(events, defaultConfig);

    // Gap should be 11:30 to next, not 11:00
    const gapAfterEvents = flexSlots.find(
      (s) => s.start.getHours() === 11 && s.start.getMinutes() === 30
    );
    expect(gapAfterEvents).toBeDefined();
  });
});

// Helper to create events on a specific date
function createEventOnDate(
  date: Date,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  summary = "Test Event"
): CalendarEvent {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    startHour,
    startMinute
  );
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    endHour,
    endMinute
  );
  return {
    id: `event-${start.getTime()}`,
    account: "test",
    summary,
    start,
    end,
    durationMinutes: (end.getTime() - start.getTime()) / 60000,
    colorId: "1",
    colorName: "Lavender",
    colorMeaning: "1:1s / People",
    isAllDay: false,
  };
}
