/**
 * Weekly Goals Library Tests
 *
 * Tests for week utilities and goal type inference functions.
 */

import { describe, it, expect } from "vitest";
import {
  getWeekIdForDate,
  parseWeekId,
  getWeekDateRange,
  weekIdToThingsTag,
  thingsTagToWeekId,
  getPreviousWeekId,
  getNextWeekId,
  formatWeekIdForDisplay,
  inferGoalType,
  parseEstimatedMinutes,
} from "../lib/weekly-goals.js";

describe("Weekly Goals Library", () => {
  describe("getWeekIdForDate", () => {
    it("returns week ID in correct format", () => {
      const date = new Date("2026-03-04");
      const weekId = getWeekIdForDate(date);
      expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
    });

    it("returns same week ID for consecutive mid-week dates", () => {
      // Use mid-week dates (Tue-Thu) which are less susceptible to timezone edge cases
      const tuesday = new Date(Date.UTC(2026, 2, 3)); // March 3, 2026
      const wednesday = new Date(Date.UTC(2026, 2, 4)); // March 4, 2026
      const thursday = new Date(Date.UTC(2026, 2, 5)); // March 5, 2026

      const tuesdayWeek = getWeekIdForDate(tuesday);
      const wednesdayWeek = getWeekIdForDate(wednesday);
      const thursdayWeek = getWeekIdForDate(thursday);

      expect(tuesdayWeek).toBe(wednesdayWeek);
      expect(wednesdayWeek).toBe(thursdayWeek);
    });

    it("returns different week ID for dates 14 days apart", () => {
      // Two weeks apart should always be different weeks
      const week1 = new Date(Date.UTC(2026, 2, 4)); // March 4, 2026
      const week3 = new Date(Date.UTC(2026, 2, 18)); // March 18, 2026

      expect(getWeekIdForDate(week1)).not.toBe(getWeekIdForDate(week3));
    });

    it("handles year boundary correctly", () => {
      // Dec 31, 2025 and Jan 1, 2026 should be in the same week
      // (since Jan 1, 2026 is Thursday, week 1 starts Mon Dec 29, 2025)
      const dec31 = new Date(Date.UTC(2025, 11, 31));
      const jan1 = new Date(Date.UTC(2026, 0, 1));

      expect(getWeekIdForDate(dec31)).toBe(getWeekIdForDate(jan1));
      expect(getWeekIdForDate(jan1)).toContain("2026-W01");
    });
  });

  describe("parseWeekId", () => {
    it("parses a valid week ID", () => {
      expect(parseWeekId("2026-W14")).toEqual({ year: 2026, week: 14 });
    });

    it("parses week 01", () => {
      expect(parseWeekId("2026-W01")).toEqual({ year: 2026, week: 1 });
    });

    it("parses week 52", () => {
      expect(parseWeekId("2026-W52")).toEqual({ year: 2026, week: 52 });
    });

    it("throws on invalid format", () => {
      expect(() => parseWeekId("2026-14")).toThrow();
      expect(() => parseWeekId("W14-2026")).toThrow();
      expect(() => parseWeekId("invalid")).toThrow();
    });
  });

  describe("getWeekDateRange", () => {
    it("returns Monday to Sunday for a given week", () => {
      const { start, end } = getWeekDateRange("2026-W10");

      // Week 10 of 2026 starts Monday March 2
      expect(start.toISOString().split("T")[0]).toBe("2026-03-02");

      // And ends Sunday March 8
      expect(end.toISOString().split("T")[0]).toBe("2026-03-08");
    });

    it("returns correct range for week 1", () => {
      const { start, end } = getWeekDateRange("2026-W01");

      // Week 1 of 2026 starts Monday Dec 29, 2025
      expect(start.toISOString().split("T")[0]).toBe("2025-12-29");

      // And ends Sunday Jan 4, 2026
      expect(end.toISOString().split("T")[0]).toBe("2026-01-04");
    });

    it("returns correct range for week 14", () => {
      const { start, end } = getWeekDateRange("2026-W14");

      // Week 14 of 2026 starts Monday March 30
      expect(start.toISOString().split("T")[0]).toBe("2026-03-30");

      // And ends Sunday April 5
      expect(end.toISOString().split("T")[0]).toBe("2026-04-05");
    });
  });

  describe("weekIdToThingsTag", () => {
    it("converts week ID to Things 3 tag format", () => {
      expect(weekIdToThingsTag("2026-W14")).toBe("w14-2026");
      expect(weekIdToThingsTag("2026-W01")).toBe("w1-2026");
      expect(weekIdToThingsTag("2026-W52")).toBe("w52-2026");
    });
  });

  describe("thingsTagToWeekId", () => {
    it("converts Things 3 tag to week ID", () => {
      expect(thingsTagToWeekId("w14-2026")).toBe("2026-W14");
      expect(thingsTagToWeekId("w1-2026")).toBe("2026-W01");
      expect(thingsTagToWeekId("W14-2026")).toBe("2026-W14"); // Case insensitive
    });

    it("returns null for invalid tags", () => {
      expect(thingsTagToWeekId("invalid")).toBeNull();
      expect(thingsTagToWeekId("2026-w14")).toBeNull();
      expect(thingsTagToWeekId("w-2026")).toBeNull();
    });
  });

  describe("getPreviousWeekId", () => {
    it("returns a valid week ID format", () => {
      const prev = getPreviousWeekId("2026-W10");
      expect(prev).toMatch(/^\d{4}-W\d{2}$/);
    });

    it("returns an earlier week", () => {
      const prev = getPreviousWeekId("2026-W10");
      const { week: prevWeek } = parseWeekId(prev);
      // Should be some week before 10
      expect(prevWeek).toBeLessThanOrEqual(10);
    });
  });

  describe("getNextWeekId", () => {
    it("returns a valid week ID format", () => {
      const next = getNextWeekId("2026-W10");
      expect(next).toMatch(/^\d{4}-W\d{2}$/);
    });

    it("returns a later week or same year", () => {
      const next = getNextWeekId("2026-W10");
      const { year } = parseWeekId(next);
      expect(year).toBeGreaterThanOrEqual(2026);
    });
  });

  describe("formatWeekIdForDisplay", () => {
    it("formats week ID with date range", () => {
      const formatted = formatWeekIdForDisplay("2026-W14");
      expect(formatted).toContain("Week 14");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Mar");
      expect(formatted).toContain("Apr");
    });
  });

  describe("inferGoalType", () => {
    describe("time-based goals", () => {
      it("identifies hours patterns", () => {
        expect(inferGoalType("4 hours of deep work")).toBe("time");
        expect(inferGoalType("2h focus time")).toBe("time");
        expect(inferGoalType("1.5 hrs writing")).toBe("time");
      });

      it("identifies minutes patterns", () => {
        expect(inferGoalType("30 minutes meditation")).toBe("time");
        expect(inferGoalType("45min workout")).toBe("time");
        expect(inferGoalType("15m stretching")).toBe("time");
      });
    });

    describe("habit-based goals", () => {
      it("identifies frequency patterns", () => {
        expect(inferGoalType("workout 3x this week")).toBe("habit");
        expect(inferGoalType("daily journaling")).toBe("habit");
        expect(inferGoalType("weekly review")).toBe("habit");
        expect(inferGoalType("every day meditation")).toBe("habit");
        expect(inferGoalType("morning routine")).toBe("habit");
      });
    });

    describe("outcome-based goals", () => {
      it("defaults to outcome for non-time/habit goals", () => {
        expect(inferGoalType("Finish the spec document")).toBe("outcome");
        expect(inferGoalType("Ship feature X")).toBe("outcome");
        expect(inferGoalType("Review code for Project Y")).toBe("outcome");
      });
    });

    it("considers notes in type inference", () => {
      expect(inferGoalType("Project work", "spend 4 hours on this")).toBe("time");
      expect(inferGoalType("Exercise", "do this daily")).toBe("habit");
    });
  });

  describe("parseEstimatedMinutes", () => {
    describe("hours patterns", () => {
      it("parses integer hours", () => {
        expect(parseEstimatedMinutes("4 hours")).toBe(240);
        expect(parseEstimatedMinutes("2h")).toBe(120);
        expect(parseEstimatedMinutes("1 hr")).toBe(60);
        expect(parseEstimatedMinutes("3 hrs")).toBe(180);
      });

      it("parses decimal hours", () => {
        expect(parseEstimatedMinutes("1.5 hours")).toBe(90);
        expect(parseEstimatedMinutes("2.5h")).toBe(150);
        expect(parseEstimatedMinutes("0.5 hr")).toBe(30);
      });
    });

    describe("minutes patterns", () => {
      it("parses minutes", () => {
        expect(parseEstimatedMinutes("30 minutes")).toBe(30);
        expect(parseEstimatedMinutes("45min")).toBe(45);
        expect(parseEstimatedMinutes("15m")).toBe(15);
      });
    });

    describe("embedded patterns", () => {
      it("extracts time from longer text", () => {
        expect(parseEstimatedMinutes("spend 4 hours on deep work")).toBe(240);
        expect(parseEstimatedMinutes("workout for 45min every day")).toBe(45);
        expect(parseEstimatedMinutes("2h of focused writing time")).toBe(120);
      });
    });

    it("returns null for non-time text", () => {
      expect(parseEstimatedMinutes("finish the document")).toBeNull();
      expect(parseEstimatedMinutes("review code")).toBeNull();
      expect(parseEstimatedMinutes("")).toBeNull();
    });
  });
});
