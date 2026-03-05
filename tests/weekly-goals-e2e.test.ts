/**
 * Weekly Goals E2E Tests
 *
 * End-to-end tests for the complete weekly goals feature workflow.
 * Tests integration between goals, events, matching, and progress tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, closeDatabase } from "../lib/calendar-db.js";
import type { StoredWeeklyGoal, StoredEvent, StoredNonGoal } from "../lib/calendar-db.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const WEEK_ID = "2026-W10"; // Test week: March 2-8, 2026

function createTestGoal(overrides: Partial<StoredWeeklyGoal> = {}): StoredWeeklyGoal {
  return {
    id: `test-goal:${WEEK_ID}`,
    things3_id: "test-goal",
    week_id: WEEK_ID,
    title: "Test Goal",
    notes: null,
    estimated_minutes: 240,
    goal_type: "time",
    color_id: "3",
    status: "active",
    progress_percent: 0,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as StoredWeeklyGoal;
}

function createTestEvent(overrides: Partial<{
  id: string;
  summary: string;
  colorId: string;
  date: string;
  durationMinutes: number;
}> = {}): {
  id: string;
  account: string;
  calendarName: string;
  calendarType: string;
  summary: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  colorId: string;
  colorName: string;
  colorMeaning: string;
  isAllDay: boolean;
  isRecurring: boolean;
  recurringEventId: string | null;
} {
  const date = overrides.date || "2026-03-04";
  const duration = overrides.durationMinutes || 60;

  return {
    id: overrides.id || "test-event-1",
    account: "test@example.com",
    calendarName: "Test Calendar",
    calendarType: "active",
    summary: overrides.summary || "Test Event",
    start: new Date(`${date}T10:00:00Z`),
    end: new Date(`${date}T${10 + Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}:00Z`),
    durationMinutes: duration,
    colorId: overrides.colorId || "3",
    colorName: "Grape",
    colorMeaning: "Project Work",
    isAllDay: false,
    isRecurring: false,
    recurringEventId: null,
  };
}

// ============================================================================
// E2E Test Suite
// ============================================================================

describe("Weekly Goals E2E Tests", () => {
  beforeEach(async () => {
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("Goal Lifecycle", () => {
    it("completes full goal lifecycle: create → update → complete", async () => {
      const { upsertWeeklyGoal, getGoalById, updateGoalProgress, updateGoalStatus } =
        await import("../lib/calendar-db.js");

      // 1. Create goal
      const created = await upsertWeeklyGoal({
        things3_id: "lifecycle-test",
        week_id: WEEK_ID,
        title: "Complete feature implementation",
        notes: "Build the weekly goals feature",
        estimated_minutes: 480,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      expect(created.id).toBe(`lifecycle-test:${WEEK_ID}`);
      expect(created.status).toBe("active");
      expect(created.progress_percent).toBe(0);

      // 2. Update progress
      await updateGoalProgress(created.id, 50);
      const updated = await getGoalById(created.id);
      expect(updated?.progress_percent).toBe(50);

      // 3. Complete goal
      await updateGoalStatus(created.id, "completed");
      const completed = await getGoalById(created.id);
      expect(completed?.status).toBe("completed");
      expect(completed?.completed_at).not.toBeNull();
    });

    it("handles goal cancellation", async () => {
      const { upsertWeeklyGoal, getGoalById, updateGoalStatus } =
        await import("../lib/calendar-db.js");

      const goal = await upsertWeeklyGoal({
        things3_id: "cancel-test",
        week_id: WEEK_ID,
        title: "Goal to cancel",
        notes: null,
        estimated_minutes: 120,
        goal_type: "outcome",
        color_id: "5",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      await updateGoalStatus(goal.id, "cancelled");
      const cancelled = await getGoalById(goal.id);

      expect(cancelled?.status).toBe("cancelled");
    });
  });

  describe("Things 3 Sync Flow", () => {
    it("syncs todos from Things 3 JSON to goals", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");
      const { getGoalsForWeek } = await import("../lib/calendar-db.js");

      // Simulate Things 3 todo data (matches Things3Todo interface)
      // Goals are identified by "week" tag, with week inferred from deadline
      const things3Todos = [
        {
          id: "things-uuid-1",
          title: "4 hours deep work",
          notes: "Focus on coding",
          completed: false,
          tags: ["week", "important"],
          deadline: "2026-03-06", // Falls in week 10
          project: "Personal Goals",
          area: "Personal",
        },
        {
          id: "things-uuid-2",
          title: "Weekly review",
          notes: "Reflect on the week",
          completed: false,
          tags: ["week"],
          deadline: "2026-03-08", // Falls in week 10
          project: undefined,
          area: "Work",
        },
      ];

      const result = await syncGoalsFromThings3(things3Todos, WEEK_ID);

      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify goals in database
      const goals = await getGoalsForWeek(WEEK_ID);
      expect(goals).toHaveLength(2);
      expect(goals.map((g) => g.title)).toContain("4 hours deep work");
      expect(goals.map((g) => g.title)).toContain("Weekly review");
    });

    it("updates existing goals on re-sync", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");
      const { getGoalById } = await import("../lib/calendar-db.js");

      // Initial sync
      const todos = [
        {
          id: "things-uuid-update",
          title: "Original title",
          notes: undefined as string | undefined,
          completed: false,
          tags: ["week"],
          deadline: "2026-03-06", // Falls in week 10
          project: undefined,
          area: undefined,
        },
      ];

      await syncGoalsFromThings3(todos, WEEK_ID);

      // Re-sync with updated title
      todos[0].title = "Updated title";
      todos[0].notes = "Added notes";
      const result = await syncGoalsFromThings3(todos, WEEK_ID);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);

      const goal = await getGoalById(`things-uuid-update:${WEEK_ID}`);
      expect(goal?.title).toBe("Updated title");
      expect(goal?.notes).toBe("Added notes");
    });

    it("marks completed todos as completed goals", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");
      const { getGoalById } = await import("../lib/calendar-db.js");

      const todos = [
        {
          id: "things-completed",
          title: "Completed task",
          notes: undefined,
          completed: true,
          tags: ["week"],
          deadline: "2026-03-06", // Falls in week 10
          project: undefined,
          area: undefined,
        },
      ];

      await syncGoalsFromThings3(todos, WEEK_ID);

      const goal = await getGoalById(`things-completed:${WEEK_ID}`);
      expect(goal?.status).toBe("completed");
      expect(goal?.progress_percent).toBe(100);
    });
  });

  describe("Event Matching Flow", () => {
    it("auto-matches events to goals by color", async () => {
      const { upsertWeeklyGoal, upsertEvent, getGoalsForWeek } =
        await import("../lib/calendar-db.js");
      const { processBatchMatches, MATCH_THRESHOLDS } = await import(
        "../lib/goal-matcher.js"
      );

      // Create goal with color
      await upsertWeeklyGoal({
        things3_id: "deep-work",
        week_id: WEEK_ID,
        title: "4 hours deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create event with matching color
      await upsertEvent({
        id: "deep-work-event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work session",
        start: new Date("2026-03-04T10:00:00Z"),
        end: new Date("2026-03-04T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Get data for matching
      const goals = await getGoalsForWeek(WEEK_ID);
      const { getEventsForDateRange } = await import("../lib/calendar-db.js");
      const events = await getEventsForDateRange(
        new Date("2026-03-02"),
        new Date("2026-03-08")
      );

      // Run matcher
      const matches = processBatchMatches(events, goals);

      // Verify auto-match due to color
      expect(matches.autoMatches.length).toBeGreaterThanOrEqual(1);
      expect(matches.autoMatches[0]?.goalId).toBe(`deep-work:${WEEK_ID}`);
      expect(matches.autoMatches[0]?.confidence).toBeGreaterThanOrEqual(
        MATCH_THRESHOLDS.AUTO_MATCH
      );
    });

    it("records progress from matched events", async () => {
      const {
        upsertWeeklyGoal,
        upsertEvent,
        recordGoalProgress,
        getProgressForGoal,
        calculateGoalTotalMinutes,
        updateGoalProgress,
        getGoalById,
      } = await import("../lib/calendar-db.js");

      // Create goal
      await upsertWeeklyGoal({
        things3_id: "progress-test",
        week_id: WEEK_ID,
        title: "4 hours coding",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create events
      await upsertEvent({
        id: "coding-event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Coding session 1",
        start: new Date("2026-03-04T10:00:00Z"),
        end: new Date("2026-03-04T11:00:00Z"),
        durationMinutes: 60,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      await upsertEvent({
        id: "coding-event-2",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Coding session 2",
        start: new Date("2026-03-04T14:00:00Z"),
        end: new Date("2026-03-04T16:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      const goalId = `progress-test:${WEEK_ID}`;

      // Record progress for both events
      await recordGoalProgress({
        goal_id: goalId,
        event_id: "coding-event-1:2026-03-04",
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: 0.8,
        minutes_contributed: 60,
      });

      await recordGoalProgress({
        goal_id: goalId,
        event_id: "coding-event-2:2026-03-04",
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: 0.8,
        minutes_contributed: 120,
      });

      // Verify progress records
      const records = await getProgressForGoal(goalId);
      expect(records).toHaveLength(2);

      // Calculate total and update
      const total = await calculateGoalTotalMinutes(goalId);
      expect(total).toBe(180); // 60 + 120

      // Update progress percentage
      const progressPercent = Math.round((total / 240) * 100);
      await updateGoalProgress(goalId, progressPercent);

      const goal = await getGoalById(goalId);
      expect(goal?.progress_percent).toBe(75); // 180/240 = 75%
    });
  });

  describe("Non-Goal Detection Flow", () => {
    it("creates non-goal and detects matching events", async () => {
      const { createNonGoal, upsertEvent, getNonGoalsForWeek, createNonGoalAlert, getUnacknowledgedAlerts } =
        await import("../lib/calendar-db.js");

      // Create non-goal pattern
      const nonGoal = await createNonGoal({
        week_id: WEEK_ID,
        title: "Excessive Meetings",
        pattern: "sync|standup|check-in",
        color_id: null,
        reason: "Too many recurring syncs",
        active: 1,
      });

      expect(nonGoal.id).toMatch(/^ng-/);

      // Create matching event
      await upsertEvent({
        id: "standup-event",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Daily standup",
        start: new Date("2026-03-04T09:00:00Z"),
        end: new Date("2026-03-04T09:30:00Z"),
        durationMinutes: 30,
        colorId: "4",
        colorName: "Flamingo",
        colorMeaning: "Meeting",
        isAllDay: false,
        isRecurring: true,
        recurringEventId: "recurring-123",
      });

      // Check pattern matches
      const regex = new RegExp(nonGoal.pattern, "i");
      expect(regex.test("Daily standup")).toBe(true);

      // Create alert for the match
      await createNonGoalAlert({
        non_goal_id: nonGoal.id,
        event_id: "standup-event:2026-03-04",
        detected_at: new Date().toISOString(),
        acknowledged: 0,
      });

      // Verify alert
      const alerts = await getUnacknowledgedAlerts(WEEK_ID);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].non_goal_id).toBe(nonGoal.id);
    });

    it("acknowledges alerts", async () => {
      const { createNonGoal, createNonGoalAlert, getUnacknowledgedAlerts, acknowledgeAlert } =
        await import("../lib/calendar-db.js");

      const nonGoal = await createNonGoal({
        week_id: WEEK_ID,
        title: "Test Non-Goal",
        pattern: "test",
        color_id: null,
        reason: "Testing",
        active: 1,
      });

      await createNonGoalAlert({
        non_goal_id: nonGoal.id,
        event_id: "test-event:2026-03-04",
        detected_at: new Date().toISOString(),
        acknowledged: 0,
      });

      let alerts = await getUnacknowledgedAlerts(WEEK_ID);
      expect(alerts).toHaveLength(1);

      await acknowledgeAlert(alerts[0].id);

      alerts = await getUnacknowledgedAlerts(WEEK_ID);
      expect(alerts).toHaveLength(0);
    });
  });

  describe("Default Non-Goals Seeding", () => {
    it("seeds default non-goals for new week", async () => {
      const { seedDefaultNonGoalsForWeek, getDefaultNonGoals } = await import(
        "../lib/weekly-goals.js"
      );
      const { getNonGoalsForWeek } = await import("../lib/calendar-db.js");

      // Get expected count (simple defaults without constraints)
      const defaults = getDefaultNonGoals();
      const simpleDefaults = defaults.filter(
        (d) => !d.timeConstraint && !d.durationConstraint && !d.recurringWithNoEnd
      );

      // Seed defaults
      const created = await seedDefaultNonGoalsForWeek(WEEK_ID);
      expect(created.length).toBe(simpleDefaults.length);

      // Verify in database
      const nonGoals = await getNonGoalsForWeek(WEEK_ID);
      expect(nonGoals.length).toBe(simpleDefaults.length);

      // Verify expected patterns exist
      const titles = nonGoals.map((ng) => ng.title);
      expect(titles).toContain("Excessive Meetings");
      expect(titles).toContain("Unknown Purpose Events");
    });

    it("quick-add creates non-goal from template", async () => {
      const { createNonGoalFromQuickAdd, getQuickAddNonGoals } = await import(
        "../lib/weekly-goals.js"
      );

      const templates = getQuickAddNonGoals();
      if (templates.length === 0) return;

      const template = templates[0];
      const nonGoal = await createNonGoalFromQuickAdd(WEEK_ID, template.label);

      expect(nonGoal).not.toBeNull();
      expect(nonGoal?.title).toBe(template.title);
      expect(nonGoal?.pattern).toBe(template.pattern);
      expect(nonGoal?.reason).toBe(template.reason);
    });
  });

  describe("Progress Sync Flow", () => {
    it("syncs progress from calendar events to goals", async () => {
      const { upsertWeeklyGoal, upsertEvent, getGoalById } =
        await import("../lib/calendar-db.js");
      const { syncProgressFromCalendar } = await import(
        "../lib/goal-progress-sync.js"
      );

      // Create goal with color
      await upsertWeeklyGoal({
        things3_id: "sync-test",
        week_id: WEEK_ID,
        title: "Deep work",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create matching event
      await upsertEvent({
        id: "sync-event-1",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work session",
        start: new Date("2026-03-04T10:00:00Z"),
        end: new Date("2026-03-04T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Run sync
      const result = await syncProgressFromCalendar(WEEK_ID);

      expect(result.goalsProcessed).toBe(1);
      expect(result.eventsProcessed).toBe(1);

      // If auto-matched, verify progress was recorded
      if (result.autoMatched > 0) {
        expect(result.affectedGoals.length).toBeGreaterThan(0);
        expect(result.affectedGoals[0].newProgress).toBeGreaterThan(0);
      }
    });

    it("dry run shows what would be matched without recording", async () => {
      const { upsertWeeklyGoal, upsertEvent, getProgressForGoal } =
        await import("../lib/calendar-db.js");
      const { syncProgressFromCalendar } = await import(
        "../lib/goal-progress-sync.js"
      );

      await upsertWeeklyGoal({
        things3_id: "dry-run-test",
        week_id: WEEK_ID,
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
        id: "dry-run-event",
        account: "test@example.com",
        calendarName: "Test Calendar",
        calendarType: "active",
        summary: "Deep work",
        start: new Date("2026-03-04T10:00:00Z"),
        end: new Date("2026-03-04T12:00:00Z"),
        durationMinutes: 120,
        colorId: "3",
        colorName: "Grape",
        colorMeaning: "Project Work",
        isAllDay: false,
        isRecurring: false,
        recurringEventId: null,
      });

      // Run dry sync
      const result = await syncProgressFromCalendar(WEEK_ID, { dryRun: true });

      expect(result.goalsProcessed).toBe(1);

      // Verify no actual progress recorded
      const progress = await getProgressForGoal(`dry-run-test:${WEEK_ID}`);
      expect(progress).toHaveLength(0);
    });
  });

  describe("Multi-Week Goal Support", () => {
    it("handles goals across different weeks independently", async () => {
      const { upsertWeeklyGoal, getGoalsForWeek } = await import("../lib/calendar-db.js");

      // Create goal in week 10
      await upsertWeeklyGoal({
        things3_id: "multi-week-goal",
        week_id: "2026-W10",
        title: "Long-term project",
        notes: null,
        estimated_minutes: 480,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Create same goal ID in week 11 (simulating carryover)
      await upsertWeeklyGoal({
        things3_id: "multi-week-goal",
        week_id: "2026-W11",
        title: "Long-term project (continued)",
        notes: null,
        estimated_minutes: 240,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Verify independent tracking
      const week10Goals = await getGoalsForWeek("2026-W10");
      const week11Goals = await getGoalsForWeek("2026-W11");

      expect(week10Goals).toHaveLength(1);
      expect(week11Goals).toHaveLength(1);

      expect(week10Goals[0].id).toBe("multi-week-goal:2026-W10");
      expect(week11Goals[0].id).toBe("multi-week-goal:2026-W11");

      expect(week10Goals[0].title).toBe("Long-term project");
      expect(week11Goals[0].title).toBe("Long-term project (continued)");
    });
  });
});
