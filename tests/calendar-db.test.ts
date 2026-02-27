/**
 * Calendar Database Tests
 *
 * Tests for the SQLite database module that stores calendar events,
 * daily summaries, and change logs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initDatabase,
  closeDatabase,
  upsertEvent,
  upsertDailySummary,
  logEventChange,
  getEventsForDateRange,
  getEventsForDate,
  getDailySummaries,
  getRecentChanges,
  getStoredEventIds,
  markEventRemoved,
  getAggregateStats,
  getChangeStats,
  formatDateKey,
  storedEventToCalendar,
  type StoredEvent,
  type StoredDailySummary,
  type EventChange,
} from "../lib/calendar-db.js";
import type { CalendarEvent, DailySummary, ColorSummary } from "../lib/time-analysis.js";

// Test fixtures
function createTestEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const start = new Date("2026-02-26T10:00:00");
  const end = new Date("2026-02-26T11:00:00");
  return {
    id: "test-event-1",
    account: "test@example.com",
    calendarName: "Test Calendar",
    calendarType: "active",
    summary: "Test Meeting",
    description: "A test meeting",
    start,
    end,
    durationMinutes: 60,
    colorId: "3",
    colorName: "Grape",
    colorMeaning: "Project Work",
    isAllDay: false,
    isRecurring: false,
    recurringEventId: null,
    ...overrides,
  };
}

function createTestDailySummary(overrides: Partial<DailySummary> = {}): DailySummary {
  const date = new Date("2026-02-26");
  return {
    date,
    dateString: "2026-02-26",
    totalScheduledMinutes: 480,
    totalGapMinutes: 60,
    events: [],
    allDayEvents: [],
    availabilityEvents: [],
    referenceEvents: [],
    gaps: [],
    byColor: [
      {
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        totalMinutes: 240,
        eventCount: 2,
        events: ["Meeting 1", "Meeting 2"],
      },
    ],
    isWorkDay: true,
    analysisHours: { start: 9, end: 17 },
    coverageGaps: [],
    coverageOptOuts: [],
    coverageLifecycleProposals: [],
    ...overrides,
  };
}

describe("Calendar Database", () => {
  beforeEach(async () => {
    // Close any existing database and initialize a fresh in-memory database for each test
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("formatDateKey", () => {
    it("formats a date as YYYY-MM-DD", () => {
      const date = new Date("2026-02-26T10:30:00");
      expect(formatDateKey(date)).toBe("2026-02-26");
    });

    it("handles dates with different timezones consistently", () => {
      const date = new Date("2026-02-26T23:30:00Z");
      // The key should be based on UTC date
      const key = formatDateKey(date);
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("upsertEvent", () => {
    it("inserts a new event", async () => {
      const event = createTestEvent();
      const result = await upsertEvent(event);

      expect(result.action).toBe("inserted");
    });

    it("returns unchanged for identical event", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const result = await upsertEvent(event);
      expect(result.action).toBe("unchanged");
    });

    it("detects modified events", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const modifiedEvent = { ...event, summary: "Updated Meeting" };
      const result = await upsertEvent(modifiedEvent);

      expect(result.action).toBe("updated");
      expect(result.changes).toContain("summary");
    });

    it("detects time changes", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const modifiedEvent = {
        ...event,
        start: new Date("2026-02-26T11:00:00"),
        end: new Date("2026-02-26T12:00:00"),
      };
      const result = await upsertEvent(modifiedEvent);

      expect(result.action).toBe("updated");
      expect(result.changes).toContain("start_time");
      expect(result.changes).toContain("end_time");
    });

    it("detects color changes", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const modifiedEvent = {
        ...event,
        colorId: "4",
        colorName: "Flamingo",
        colorMeaning: "Meetings",
      };
      const result = await upsertEvent(modifiedEvent);

      expect(result.action).toBe("updated");
      expect(result.changes).toContain("color_id");
    });
  });

  describe("getEventsForDateRange", () => {
    it("returns events within the date range", async () => {
      const event1 = createTestEvent({ id: "event-1", start: new Date("2026-02-25T10:00:00"), end: new Date("2026-02-25T11:00:00") });
      const event2 = createTestEvent({ id: "event-2", start: new Date("2026-02-26T10:00:00"), end: new Date("2026-02-26T11:00:00") });
      const event3 = createTestEvent({ id: "event-3", start: new Date("2026-02-27T10:00:00"), end: new Date("2026-02-27T11:00:00") });

      await upsertEvent(event1);
      await upsertEvent(event2);
      await upsertEvent(event3);

      const results = await getEventsForDateRange(
        new Date("2026-02-25"),
        new Date("2026-02-26")
      );

      expect(results.length).toBe(2);
      expect(results.map(e => e.google_event_id)).toContain("event-1");
      expect(results.map(e => e.google_event_id)).toContain("event-2");
    });

    it("returns empty array when no events in range", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const results = await getEventsForDateRange(
        new Date("2026-03-01"),
        new Date("2026-03-05")
      );

      expect(results.length).toBe(0);
    });
  });

  describe("getEventsForDate", () => {
    it("returns events for a specific date", async () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2", start: new Date("2026-02-27T10:00:00"), end: new Date("2026-02-27T11:00:00") });

      await upsertEvent(event1);
      await upsertEvent(event2);

      const results = await getEventsForDate(new Date("2026-02-26"));

      expect(results.length).toBe(1);
      expect(results[0].google_event_id).toBe("event-1");
    });
  });

  describe("upsertDailySummary", () => {
    it("inserts a daily summary", async () => {
      const summary = createTestDailySummary();

      // Should not throw
      await expect(upsertDailySummary(summary)).resolves.not.toThrow();

      const results = await getDailySummaries(
        new Date("2026-02-26"),
        new Date("2026-02-26")
      );

      expect(results.length).toBe(1);
      expect(results[0].total_scheduled_minutes).toBe(480);
    });

    it("updates existing summary", async () => {
      const summary1 = createTestDailySummary({ totalScheduledMinutes: 480 });
      const summary2 = createTestDailySummary({ totalScheduledMinutes: 520 });

      await upsertDailySummary(summary1);
      await upsertDailySummary(summary2);

      const results = await getDailySummaries(
        new Date("2026-02-26"),
        new Date("2026-02-26")
      );

      expect(results.length).toBe(1);
      expect(results[0].total_scheduled_minutes).toBe(520);
    });

    it("stores categories as JSON", async () => {
      const summary = createTestDailySummary();
      await upsertDailySummary(summary);

      const results = await getDailySummaries(
        new Date("2026-02-26"),
        new Date("2026-02-26")
      );

      const categories = JSON.parse(results[0].categories_json) as ColorSummary[];
      expect(categories.length).toBe(1);
      expect(categories[0].colorId).toBe("3");
    });
  });

  describe("logEventChange", () => {
    it("logs event additions", async () => {
      await logEventChange({
        event_id: "test:2026-02-26",
        google_event_id: "test",
        change_type: "added",
        change_time: new Date().toISOString(),
        old_value_json: null,
        new_value_json: JSON.stringify({ summary: "New Event" }),
        field_changed: null,
      });

      const changes = await getRecentChanges(10);

      expect(changes.length).toBe(1);
      expect(changes[0].change_type).toBe("added");
    });

    it("logs event modifications", async () => {
      await logEventChange({
        event_id: "test:2026-02-26",
        google_event_id: "test",
        change_type: "modified",
        change_time: new Date().toISOString(),
        old_value_json: JSON.stringify({ summary: "Old Title" }),
        new_value_json: JSON.stringify({ summary: "New Title" }),
        field_changed: "summary",
      });

      const changes = await getRecentChanges(10);

      expect(changes.length).toBe(1);
      expect(changes[0].change_type).toBe("modified");
      expect(changes[0].field_changed).toBe("summary");
    });
  });

  describe("getRecentChanges", () => {
    it("returns changes ordered by time descending", async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);

      await logEventChange({
        event_id: "test1:2026-02-26",
        google_event_id: "test1",
        change_type: "added",
        change_time: earlier.toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      await logEventChange({
        event_id: "test2:2026-02-26",
        google_event_id: "test2",
        change_type: "added",
        change_time: now.toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      const changes = await getRecentChanges(10);

      expect(changes.length).toBe(2);
      expect(changes[0].google_event_id).toBe("test2");
      expect(changes[1].google_event_id).toBe("test1");
    });

    it("filters by change type", async () => {
      await logEventChange({
        event_id: "test1:2026-02-26",
        google_event_id: "test1",
        change_type: "added",
        change_time: new Date().toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      await logEventChange({
        event_id: "test2:2026-02-26",
        google_event_id: "test2",
        change_type: "removed",
        change_time: new Date().toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      const added = await getRecentChanges(10, "added");
      const removed = await getRecentChanges(10, "removed");

      expect(added.length).toBe(1);
      expect(removed.length).toBe(1);
    });

    it("respects the limit", async () => {
      for (let i = 0; i < 10; i++) {
        await logEventChange({
          event_id: `test${i}:2026-02-26`,
          google_event_id: `test${i}`,
          change_type: "added",
          change_time: new Date().toISOString(),
          old_value_json: null,
          new_value_json: null,
          field_changed: null,
        });
      }

      const changes = await getRecentChanges(5);

      expect(changes.length).toBe(5);
    });
  });

  describe("getStoredEventIds", () => {
    it("returns set of event IDs in date range", async () => {
      const event1 = createTestEvent({ id: "event-1" });
      const event2 = createTestEvent({ id: "event-2", start: new Date("2026-02-27T10:00:00"), end: new Date("2026-02-27T11:00:00") });

      await upsertEvent(event1);
      await upsertEvent(event2);

      const ids = await getStoredEventIds(
        new Date("2026-02-26"),
        new Date("2026-02-26")
      );

      expect(ids.size).toBe(1);
      expect(ids.has("event-1:2026-02-26")).toBe(true);
    });
  });

  describe("markEventRemoved", () => {
    it("deletes event and logs removal", async () => {
      const event = createTestEvent();
      await upsertEvent(event);

      const eventId = `${event.id}:2026-02-26`;
      await markEventRemoved(eventId);

      // Event should be deleted
      const events = await getEventsForDate(new Date("2026-02-26"));
      expect(events.length).toBe(0);

      // Change should be logged
      const changes = await getRecentChanges(10, "removed");
      expect(changes.length).toBe(1);
      expect(changes[0].event_id).toBe(eventId);
    });
  });

  describe("getAggregateStats", () => {
    it("aggregates stats across multiple days", async () => {
      const summary1 = createTestDailySummary({
        date: new Date("2026-02-25"),
        totalScheduledMinutes: 480,
        totalGapMinutes: 60,
      });
      const summary2 = createTestDailySummary({
        date: new Date("2026-02-26"),
        totalScheduledMinutes: 420,
        totalGapMinutes: 120,
      });

      await upsertDailySummary(summary1);
      await upsertDailySummary(summary2);

      const stats = await getAggregateStats(
        new Date("2026-02-25"),
        new Date("2026-02-26")
      );

      expect(stats.totalDays).toBe(2);
      expect(stats.totalScheduledMinutes).toBe(900);
      expect(stats.totalGapMinutes).toBe(180);
    });

    it("aggregates categories across days", async () => {
      const summary1 = createTestDailySummary({
        date: new Date("2026-02-25"),
        byColor: [
          { colorId: "3", colorName: "Grape", colorMeaning: "Project Work", totalMinutes: 120, eventCount: 1, events: [] },
        ],
      });
      const summary2 = createTestDailySummary({
        date: new Date("2026-02-26"),
        byColor: [
          { colorId: "3", colorName: "Grape", colorMeaning: "Project Work", totalMinutes: 180, eventCount: 2, events: [] },
        ],
      });

      await upsertDailySummary(summary1);
      await upsertDailySummary(summary2);

      const stats = await getAggregateStats(
        new Date("2026-02-25"),
        new Date("2026-02-26")
      );

      expect(stats.byCategory.get("3")?.minutes).toBe(300);
      expect(stats.byCategory.get("3")?.count).toBe(3);
    });
  });

  describe("getChangeStats", () => {
    it("counts changes by type", async () => {
      const now = new Date();

      await logEventChange({
        event_id: "test1:2026-02-26",
        google_event_id: "test1",
        change_type: "added",
        change_time: now.toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      await logEventChange({
        event_id: "test2:2026-02-26",
        google_event_id: "test2",
        change_type: "added",
        change_time: now.toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      await logEventChange({
        event_id: "test3:2026-02-26",
        google_event_id: "test3",
        change_type: "removed",
        change_time: now.toISOString(),
        old_value_json: null,
        new_value_json: null,
        field_changed: null,
      });

      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const stats = await getChangeStats(yesterday, tomorrow);

      expect(stats.added).toBe(2);
      expect(stats.removed).toBe(1);
      expect(stats.modified).toBe(0);
    });
  });

  describe("storedEventToCalendar", () => {
    it("converts stored event back to CalendarEvent", async () => {
      const original = createTestEvent();
      await upsertEvent(original);

      const stored = (await getEventsForDate(new Date("2026-02-26")))[0];
      const converted = storedEventToCalendar(stored);

      expect(converted.id).toBe(original.id);
      expect(converted.summary).toBe(original.summary);
      expect(converted.colorId).toBe(original.colorId);
      expect(converted.durationMinutes).toBe(original.durationMinutes);
      expect(converted.isAllDay).toBe(original.isAllDay);
    });
  });
});
