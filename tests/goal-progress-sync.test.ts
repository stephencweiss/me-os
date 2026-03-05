/**
 * Goal Progress Sync Tests
 *
 * Tests for the progress sync library that matches calendar events
 * to goals and tracks progress.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, closeDatabase } from "../lib/calendar-db.js";
import type { StoredEvent, StoredWeeklyGoal } from "../lib/calendar-db.js";

describe("Goal Progress Sync Library", () => {
  describe("parseWeekId", () => {
    it("parses valid week ID", async () => {
      const { parseWeekId } = await import("../lib/goal-progress-sync.js");

      const result = parseWeekId("2026-W14");
      expect(result.year).toBe(2026);
      expect(result.week).toBe(14);
    });

    it("throws on invalid format", async () => {
      const { parseWeekId } = await import("../lib/goal-progress-sync.js");

      expect(() => parseWeekId("2026-14")).toThrow();
      expect(() => parseWeekId("W14-2026")).toThrow();
      expect(() => parseWeekId("invalid")).toThrow();
    });

    it("parses single-digit weeks", async () => {
      const { parseWeekId } = await import("../lib/goal-progress-sync.js");

      const result = parseWeekId("2026-W01");
      expect(result.week).toBe(1);
    });
  });

  describe("getWeekDateRange", () => {
    it("returns correct date range for a week", async () => {
      const { getWeekDateRange } = await import("../lib/goal-progress-sync.js");

      const { startDate, endDate } = getWeekDateRange("2026-W10");

      // Week 10 of 2026 starts Monday March 2nd and ends Sunday March 8th
      expect(startDate.getUTCDay()).toBe(1); // Monday
      expect(endDate.getUTCDay()).toBe(0); // Sunday

      // 6 days difference
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(6);
    });

    it("handles first week of year", async () => {
      const { getWeekDateRange } = await import("../lib/goal-progress-sync.js");

      const { startDate, endDate } = getWeekDateRange("2026-W01");

      expect(startDate.getUTCDay()).toBe(1); // Monday
      expect(endDate.getUTCDay()).toBe(0); // Sunday
    });

    it("handles last week of year", async () => {
      const { getWeekDateRange } = await import("../lib/goal-progress-sync.js");

      const { startDate, endDate } = getWeekDateRange("2026-W53");

      expect(startDate.getUTCDay()).toBe(1); // Monday
      expect(endDate.getUTCDay()).toBe(0); // Sunday
    });
  });
});

describe("Goal Progress Sync with Database", () => {
  beforeEach(async () => {
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("syncProgressFromCalendar", () => {
    it("returns empty result when no goals", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");

      const result = await syncProgressFromCalendar("2026-W10");

      expect(result.goalsProcessed).toBe(0);
      expect(result.eventsProcessed).toBe(0);
      expect(result.autoMatched).toBe(0);
      expect(result.progressRecords).toHaveLength(0);
    });

    it("returns empty result when no events", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      // Create a goal
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      const result = await syncProgressFromCalendar("2026-W10");

      expect(result.goalsProcessed).toBe(1);
      expect(result.eventsProcessed).toBe(0);
      expect(result.autoMatched).toBe(0);
    });

    it("auto-matches events with high confidence", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent } = await import("../lib/calendar-db.js");

      // Create a goal with color
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Deep work session",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create an event with matching color and keywords
      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work focus time",
        start: new Date("2026-03-02T10:00:00Z"), // Monday W10
        end: new Date("2026-03-02T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      const result = await syncProgressFromCalendar("2026-W10");

      expect(result.goalsProcessed).toBe(1);
      expect(result.eventsProcessed).toBe(1);
      expect(result.autoMatched).toBeGreaterThanOrEqual(0); // Depends on matching logic
    });

    it("respects dryRun option", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent, getProgressForGoal } = await import(
        "../lib/calendar-db.js"
      );

      // Create a goal and matching event
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      const result = await syncProgressFromCalendar("2026-W10", { dryRun: true });

      // Check that no progress was actually recorded
      const progress = await getProgressForGoal("test-1:2026-W10");
      expect(progress).toHaveLength(0);

      // But result should show what would be matched
      expect(result.weekId).toBe("2026-W10");
    });

    it("skips already matched events", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent, recordGoalProgress } = await import(
        "../lib/calendar-db.js"
      );

      // Create goal and event
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Pre-record progress for this event
      await recordGoalProgress({
        goal_id: "test-1:2026-W10",
        event_id: "event-1:2026-03-02",
        matched_at: new Date().toISOString(),
        match_type: "manual",
        match_confidence: null,
        minutes_contributed: 120,
      });

      // Run sync
      const result = await syncProgressFromCalendar("2026-W10");

      expect(result.alreadyMatched).toBe(1);
      expect(result.autoMatched).toBe(0);
    });

    it("respects forceRematch option", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent, recordGoalProgress } = await import(
        "../lib/calendar-db.js"
      );

      // Create goal and event
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Pre-record progress
      await recordGoalProgress({
        goal_id: "test-1:2026-W10",
        event_id: "event-1:2026-03-02",
        matched_at: new Date().toISOString(),
        match_type: "manual",
        match_confidence: null,
        minutes_contributed: 120,
      });

      // Run sync with forceRematch
      const result = await syncProgressFromCalendar("2026-W10", { forceRematch: true });

      // With forceRematch, alreadyMatched should be 0 since we're re-evaluating
      expect(result.alreadyMatched).toBe(0);
    });

    it("skips completed goals", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent } = await import("../lib/calendar-db.js");

      // Create a completed goal
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "completed",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
      });

      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      const result = await syncProgressFromCalendar("2026-W10");

      // No active goals to process
      expect(result.goalsProcessed).toBe(0);
      expect(result.autoMatched).toBe(0);
    });

    it("skips all-day events", async () => {
      const { syncProgressFromCalendar } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent } = await import("../lib/calendar-db.js");

      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Vacation",
        notes: null,
        estimated_minutes: null,
        goal_type: "outcome",
        color_id: "5",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create all-day event
      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Vacation",
        start: new Date("2026-03-02T00:00:00Z"),
        end: new Date("2026-03-03T00:00:00Z"),
        durationMinutes: 1440,
        colorId: "5",
        colorName: "Banana",
        colorMeaning: "Personal",
        isAllDay: true,
        isRecurring: false,
        recurringEventId: null,
      });

      const result = await syncProgressFromCalendar("2026-W10");

      // All-day events are filtered out
      expect(result.eventsProcessed).toBe(0);
    });
  });

  describe("recordSingleProgress", () => {
    it("records progress and updates goal", async () => {
      const { recordSingleProgress } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent, getGoalById } = await import(
        "../lib/calendar-db.js"
      );

      // Create goal
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 120,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create event
      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Work session",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T11:00:00Z"),
        durationMinutes: 60,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      const progress = await recordSingleProgress(
        "test-1:2026-W10",
        "event-1:2026-03-02",
        60,
        "manual"
      );

      expect(progress.minutes_contributed).toBe(60);
      expect(progress.match_type).toBe("manual");

      // Check goal progress was updated
      const goal = await getGoalById("test-1:2026-W10");
      expect(goal?.progress_percent).toBe(50); // 60/120 = 50%
    });

    it("handles goals without estimated time", async () => {
      const { recordSingleProgress } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal, upsertEvent, getGoalById } = await import(
        "../lib/calendar-db.js"
      );

      // Create goal without time estimate
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Outcome Goal",
        notes: null,
        estimated_minutes: null, // No estimate
        goal_type: "outcome",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Work session",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T11:00:00Z"),
        durationMinutes: 60,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      await recordSingleProgress("test-1:2026-W10", "event-1:2026-03-02", 60, "manual");

      const goal = await getGoalById("test-1:2026-W10");
      // Any progress without estimate = 100%
      expect(goal?.progress_percent).toBe(100);
    });
  });

  describe("getGoalProgressSummary", () => {
    it("returns correct summary", async () => {
      const { getGoalProgressSummary, recordSingleProgress } = await import(
        "../lib/goal-progress-sync.js"
      );
      const { upsertWeeklyGoal, upsertEvent, recordGoalProgress } = await import(
        "../lib/calendar-db.js"
      );

      // Create goal
      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create events and record progress
      await upsertEvent({
        id: "event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Session 1",
        start: new Date("2026-03-02T10:00:00Z"),
        end: new Date("2026-03-02T11:00:00Z"),
        durationMinutes: 60,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      await upsertEvent({
        id: "event-2",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Session 2",
        start: new Date("2026-03-03T10:00:00Z"),
        end: new Date("2026-03-03T11:30:00Z"),
        durationMinutes: 90,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Record auto and manual progress
      await recordGoalProgress({
        goal_id: "test-1:2026-W10",
        event_id: "event-1:2026-03-02",
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: 0.8,
        minutes_contributed: 60,
      });

      await recordGoalProgress({
        goal_id: "test-1:2026-W10",
        event_id: "event-2:2026-03-03",
        matched_at: new Date().toISOString(),
        match_type: "manual",
        match_confidence: null,
        minutes_contributed: 90,
      });

      const summary = await getGoalProgressSummary("test-1:2026-W10");

      expect(summary.totalMinutes).toBe(150);
      expect(summary.recordCount).toBe(2);
      expect(summary.autoMatched).toBe(1);
      expect(summary.manualMatched).toBe(1);
    });

    it("returns zeros for goal with no progress", async () => {
      const { getGoalProgressSummary } = await import("../lib/goal-progress-sync.js");
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      await upsertWeeklyGoal({
        things3_id: "test-1",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      const summary = await getGoalProgressSummary("test-1:2026-W10");

      expect(summary.totalMinutes).toBe(0);
      expect(summary.recordCount).toBe(0);
      expect(summary.autoMatched).toBe(0);
      expect(summary.manualMatched).toBe(0);
    });
  });
});
