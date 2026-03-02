/**
 * Goal Matcher Library Tests
 *
 * Tests for event-to-goal matching heuristics and confidence scoring.
 */

import { describe, it, expect } from "vitest";
import {
  extractKeywords,
  keywordOverlapRatio,
  calculateMatch,
  matchEventsToGoals,
  getAutoMatches,
  getMatchesNeedingConfirmation,
  getUnmatchedEvents,
  processBatchMatches,
  MATCH_THRESHOLDS,
  MATCH_WEIGHTS,
} from "../lib/goal-matcher.js";
import type { StoredEvent, StoredWeeklyGoal } from "../lib/calendar-db.js";

// Test fixtures
function createTestEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: "event-1",
    account: "test@example.com",
    calendar_name: "Test Calendar",
    calendar_type: "active",
    summary: "Test Event",
    description: null,
    date: "2026-03-04",
    start_time: "2026-03-04T10:00:00",
    end_time: "2026-03-04T11:00:00",
    duration_minutes: 60,
    color_id: "3",
    color_name: "Grape",
    color_meaning: "Project Work",
    is_all_day: 0,
    is_recurring: 0,
    recurring_event_id: null,
    attended: "unknown",
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    removed_at: null,
    ...overrides,
  } as StoredEvent;
}

function createTestGoal(overrides: Partial<StoredWeeklyGoal> = {}): StoredWeeklyGoal {
  return {
    id: "goal-1",
    things3_id: "things-1",
    week_id: "2026-W10",
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

describe("Goal Matcher", () => {
  describe("extractKeywords", () => {
    it("extracts meaningful words", () => {
      const keywords = extractKeywords("Deep work on project documentation");
      expect(keywords).toContain("deep");
      expect(keywords).toContain("work");
      expect(keywords).toContain("project");
      expect(keywords).toContain("documentation");
    });

    it("filters stop words", () => {
      const keywords = extractKeywords("The quick brown fox");
      expect(keywords).not.toContain("the");
      expect(keywords).toContain("quick");
      expect(keywords).toContain("brown");
      expect(keywords).toContain("fox");
    });

    it("filters short words", () => {
      const keywords = extractKeywords("I am on it");
      expect(keywords).toHaveLength(0);
    });

    it("handles empty string", () => {
      expect(extractKeywords("")).toHaveLength(0);
    });

    it("lowercases all keywords", () => {
      const keywords = extractKeywords("Deep Work FOCUS");
      expect(keywords).toEqual(["deep", "work", "focus"]);
    });
  });

  describe("keywordOverlapRatio", () => {
    it("returns 1 for identical keywords", () => {
      const keywords = ["deep", "work", "focus"];
      expect(keywordOverlapRatio(keywords, keywords)).toBe(1);
    });

    it("returns 0 for no overlap", () => {
      expect(keywordOverlapRatio(["deep", "work"], ["play", "rest"])).toBe(0);
    });

    it("calculates partial overlap correctly", () => {
      // 1 overlap out of 2 minimum size
      expect(keywordOverlapRatio(["deep", "work"], ["deep", "play"])).toBe(0.5);
    });

    it("returns 0 for empty arrays", () => {
      expect(keywordOverlapRatio([], ["deep"])).toBe(0);
      expect(keywordOverlapRatio(["deep"], [])).toBe(0);
      expect(keywordOverlapRatio([], [])).toBe(0);
    });
  });

  describe("calculateMatch", () => {
    it("gives high confidence for color match", () => {
      const event = createTestEvent({ color_id: "3" });
      const goal = createTestGoal({ color_id: "3" });

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeGreaterThanOrEqual(MATCH_WEIGHTS.COLOR);
      expect(result.matchReasons).toContainEqual(
        expect.stringContaining("Color matches")
      );
    });

    it("gives confidence for title keyword match", () => {
      const event = createTestEvent({ summary: "Deep work session" });
      const goal = createTestGoal({ title: "4 hours deep work" });

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchReasons).toContainEqual(
        expect.stringContaining("Title contains")
      );
    });

    it("gives confidence for notes/description match", () => {
      const event = createTestEvent({
        description: "Working on the API documentation",
      });
      const goal = createTestGoal({
        notes: "Focus on API documentation this week",
      });

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchReasons).toContainEqual(
        expect.stringContaining("Description matches")
      );
    });

    it("combines multiple match signals", () => {
      const event = createTestEvent({
        color_id: "3",
        summary: "Deep work session",
      });
      const goal = createTestGoal({
        color_id: "3",
        title: "4 hours deep work",
      });

      const result = calculateMatch(event, goal);
      // Should have both color and keyword match
      expect(result.confidence).toBeGreaterThan(MATCH_WEIGHTS.COLOR);
      expect(result.matchReasons.length).toBeGreaterThanOrEqual(2);
    });

    it("caps confidence at 1.0", () => {
      const event = createTestEvent({
        color_id: "3",
        summary: "Deep work focus session",
        description: "Working on project documentation",
      });
      const goal = createTestGoal({
        color_id: "3",
        title: "4 hours deep work focus",
        notes: "Work on project documentation",
      });

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("returns 0 confidence for no match", () => {
      const event = createTestEvent({
        color_id: "1",
        summary: "Team standup",
      });
      const goal = createTestGoal({
        color_id: "3",
        title: "Deep work session",
      });

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBe(0);
      expect(result.matchReasons).toHaveLength(0);
    });
  });

  describe("matchEventsToGoals", () => {
    it("matches events to best goals", () => {
      const events = [
        createTestEvent({ id: "e1", summary: "Deep work", color_id: "3" }),
        createTestEvent({ id: "e2", summary: "Team standup", color_id: "4" }),
      ];
      const goals = [
        createTestGoal({ id: "g1", title: "4 hours deep work", color_id: "3" }),
        createTestGoal({ id: "g2", title: "Weekly meetings", color_id: "4" }),
      ];

      const matches = matchEventsToGoals(events, goals);
      expect(matches.length).toBeLessThanOrEqual(events.length);
    });

    it("skips inactive goals", () => {
      const events = [createTestEvent({ summary: "Deep work", color_id: "3" })];
      const goals = [
        createTestGoal({
          title: "Deep work session",
          color_id: "3",
          status: "completed",
        }),
      ];

      const matches = matchEventsToGoals(events, goals);
      expect(matches).toHaveLength(0);
    });

    it("assigns each event to at most one goal", () => {
      const events = [createTestEvent({ id: "e1", color_id: "3" })];
      const goals = [
        createTestGoal({ id: "g1", color_id: "3" }),
        createTestGoal({ id: "g2", color_id: "3" }),
      ];

      const matches = matchEventsToGoals(events, goals);
      const eventIds = matches.map((m) => m.eventId);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });

  describe("getAutoMatches", () => {
    it("returns only high-confidence matches", () => {
      const matches = [
        { goalId: "g1", eventId: "e1", confidence: 0.8, matchReasons: [] },
        { goalId: "g2", eventId: "e2", confidence: 0.4, matchReasons: [] },
        { goalId: "g3", eventId: "e3", confidence: 0.6, matchReasons: [] },
      ];

      const autoMatches = getAutoMatches(matches);
      expect(autoMatches.every((m) => m.confidence >= MATCH_THRESHOLDS.AUTO_MATCH)).toBe(
        true
      );
    });
  });

  describe("getMatchesNeedingConfirmation", () => {
    it("returns matches in prompt range", () => {
      const matches = [
        { goalId: "g1", eventId: "e1", confidence: 0.8, matchReasons: [] },
        { goalId: "g2", eventId: "e2", confidence: 0.4, matchReasons: [] },
        { goalId: "g3", eventId: "e3", confidence: 0.2, matchReasons: [] },
      ];

      const needsConfirmation = getMatchesNeedingConfirmation(matches);
      expect(
        needsConfirmation.every(
          (m) =>
            m.confidence >= MATCH_THRESHOLDS.PROMPT_USER &&
            m.confidence < MATCH_THRESHOLDS.AUTO_MATCH
        )
      ).toBe(true);
    });
  });

  describe("getUnmatchedEvents", () => {
    it("returns events not in matches", () => {
      const events = [
        createTestEvent({ id: "e1" }),
        createTestEvent({ id: "e2" }),
        createTestEvent({ id: "e3" }),
      ];
      const matches = [
        { goalId: "g1", eventId: "e1", confidence: 0.8, matchReasons: [] },
      ];

      const unmatched = getUnmatchedEvents(events, matches);
      expect(unmatched.map((e) => e.id)).toEqual(["e2", "e3"]);
    });
  });

  describe("processBatchMatches", () => {
    it("categorizes matches correctly", () => {
      const events = [
        createTestEvent({ id: "e1", summary: "Deep work", color_id: "3" }),
        createTestEvent({ id: "e2", summary: "Meeting", color_id: "4" }),
        createTestEvent({ id: "e3", summary: "Lunch break", color_id: "8" }),
      ];
      const goals = [
        createTestGoal({ id: "g1", title: "Deep work session", color_id: "3" }),
      ];

      const result = processBatchMatches(events, goals);

      expect(result.totalEventsProcessed).toBe(3);
      expect(result.totalGoalsChecked).toBe(1);
      expect(result.autoMatches.length + result.needsConfirmation.length + result.unmatchedEvents.length).toBeLessThanOrEqual(3);
    });

    it("handles empty inputs", () => {
      const result = processBatchMatches([], []);

      expect(result.totalEventsProcessed).toBe(0);
      expect(result.totalGoalsChecked).toBe(0);
      expect(result.autoMatches).toHaveLength(0);
      expect(result.needsConfirmation).toHaveLength(0);
      expect(result.unmatchedEvents).toHaveLength(0);
    });
  });

  describe("MATCH_THRESHOLDS", () => {
    it("has consistent threshold ordering", () => {
      expect(MATCH_THRESHOLDS.AUTO_MATCH).toBeGreaterThan(
        MATCH_THRESHOLDS.PROMPT_USER
      );
      expect(MATCH_THRESHOLDS.PROMPT_USER).toBeGreaterThanOrEqual(
        MATCH_THRESHOLDS.NO_MATCH
      );
    });
  });

  describe("MATCH_WEIGHTS", () => {
    it("weights sum to reasonable total", () => {
      const total =
        MATCH_WEIGHTS.COLOR +
        MATCH_WEIGHTS.TITLE_KEYWORDS +
        MATCH_WEIGHTS.NOTES_MATCH;
      expect(total).toBe(1);
    });
  });
});
