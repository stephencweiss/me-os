/**
 * Calendar Manager Tests
 *
 * TDD: Write tests first, then implement to make them pass.
 */

import { describe, it, expect } from "vitest";
import {
  buildOverlapGroups,
  calculateOverlapMinutes,
  OverlapGroup,
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
