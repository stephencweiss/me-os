/**
 * Schedule Library Tests
 *
 * Tests for the schedule configuration system that defines
 * waking hours and work hours by day of week.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSchedule,
  getScheduleForDate,
  isWorkDay,
  getWorkHours,
  getWakingHours,
  getAvailableHours,
  getDefaultSchedule,
  type WeeklySchedule,
  type DaySchedule,
  type TimePeriod,
} from "../lib/schedule.js";
import * as fs from "fs";
import * as path from "path";

// Test fixtures
const testConfigDir = path.join(process.cwd(), "tests", "fixtures", "config");

// Helper to create dates for specific days
function createDate(dayOfWeek: number, hour: number = 12): Date {
  // Find the next occurrence of this day of week
  const date = new Date("2026-02-23T12:00:00"); // Monday
  const currentDay = date.getDay();
  const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysToAdd);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Day indices: 0=Sunday, 1=Monday, ..., 6=Saturday
const MONDAY = 1;
const TUESDAY = 2;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;
const SATURDAY = 6;
const SUNDAY = 0;

describe("Schedule Library", () => {
  describe("getDefaultSchedule", () => {
    it("returns a valid default schedule", () => {
      const schedule = getDefaultSchedule();

      expect(schedule.defaultSchedule.weekday.awakePeriod).toEqual({
        start: 6,
        end: 22,
      });
      expect(schedule.defaultSchedule.weekday.workPeriod).toEqual({
        start: 9,
        end: 17,
      });
      expect(schedule.defaultSchedule.weekend.awakePeriod).toEqual({
        start: 6,
        end: 22,
      });
      expect(schedule.defaultSchedule.weekend.workPeriod).toBeNull();
    });
  });

  describe("loadSchedule", () => {
    it("loads schedule from config file when it exists", () => {
      // Create test config directory and file
      const testDir = path.join(testConfigDir, "schedule-test-1");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(
        path.join(testDir, "schedule.json"),
        JSON.stringify({
          defaultSchedule: {
            weekday: {
              awakePeriod: { start: 7, end: 23 },
              workPeriod: { start: 10, end: 18 },
            },
            weekend: {
              awakePeriod: { start: 8, end: 22 },
              workPeriod: null,
            },
          },
        })
      );

      const schedule = loadSchedule(path.join(testDir, "schedule.json"));

      expect(schedule.defaultSchedule.weekday.awakePeriod.start).toBe(7);
      expect(schedule.defaultSchedule.weekday.workPeriod?.start).toBe(10);

      // Cleanup
      fs.unlinkSync(path.join(testDir, "schedule.json"));
      fs.rmdirSync(testDir);
    });

    it("returns default schedule if file is missing", () => {
      const schedule = loadSchedule("/nonexistent/path/schedule.json");

      expect(schedule.defaultSchedule.weekday.awakePeriod).toEqual({
        start: 6,
        end: 22,
      });
    });

    it("returns default schedule if file is invalid JSON", () => {
      const testDir = path.join(testConfigDir, "schedule-test-2");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "schedule.json"), "invalid json {");

      const schedule = loadSchedule(path.join(testDir, "schedule.json"));

      expect(schedule.defaultSchedule.weekday.awakePeriod).toEqual({
        start: 6,
        end: 22,
      });

      // Cleanup
      fs.unlinkSync(path.join(testDir, "schedule.json"));
      fs.rmdirSync(testDir);
    });
  });

  describe("getScheduleForDate", () => {
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: { start: 7, end: 23 },
          workPeriod: null,
        },
      },
      overrides: {
        friday: {
          workPeriod: { start: 9, end: 16 },
        },
      },
      holidays: ["2026-12-25"],
    };

    it("returns weekday schedule for Monday", () => {
      const monday = createDate(MONDAY);
      const daySchedule = getScheduleForDate(monday, schedule);

      expect(daySchedule.awakePeriod).toEqual({ start: 6, end: 22 });
      expect(daySchedule.workPeriod).toEqual({ start: 9, end: 17 });
    });

    it("returns weekday schedule for Tuesday", () => {
      const tuesday = createDate(TUESDAY);
      const daySchedule = getScheduleForDate(tuesday, schedule);

      expect(daySchedule.workPeriod).toEqual({ start: 9, end: 17 });
    });

    it("returns weekend schedule for Saturday", () => {
      const saturday = createDate(SATURDAY);
      const daySchedule = getScheduleForDate(saturday, schedule);

      expect(daySchedule.awakePeriod).toEqual({ start: 7, end: 23 });
      expect(daySchedule.workPeriod).toBeNull();
    });

    it("returns weekend schedule for Sunday", () => {
      const sunday = createDate(SUNDAY);
      const daySchedule = getScheduleForDate(sunday, schedule);

      expect(daySchedule.workPeriod).toBeNull();
    });

    it("applies day override for Friday", () => {
      const friday = createDate(FRIDAY);
      const daySchedule = getScheduleForDate(friday, schedule);

      // Should use override work period
      expect(daySchedule.workPeriod).toEqual({ start: 9, end: 16 });
      // Should still use weekday awake period (not overridden)
      expect(daySchedule.awakePeriod).toEqual({ start: 6, end: 22 });
    });

    it("treats holiday as weekend schedule", () => {
      const christmas = new Date("2026-12-25T12:00:00");
      const daySchedule = getScheduleForDate(christmas, schedule);

      // Should be treated like weekend (no work)
      expect(daySchedule.workPeriod).toBeNull();
    });
  });

  describe("isWorkDay", () => {
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: null,
        },
      },
      holidays: ["2026-07-04"],
    };

    it("returns true for weekday with work period", () => {
      const monday = createDate(MONDAY);
      expect(isWorkDay(monday, schedule)).toBe(true);
    });

    it("returns true for Friday (weekday)", () => {
      const friday = createDate(FRIDAY);
      expect(isWorkDay(friday, schedule)).toBe(true);
    });

    it("returns false for Saturday", () => {
      const saturday = createDate(SATURDAY);
      expect(isWorkDay(saturday, schedule)).toBe(false);
    });

    it("returns false for Sunday", () => {
      const sunday = createDate(SUNDAY);
      expect(isWorkDay(sunday, schedule)).toBe(false);
    });

    it("returns false for holiday", () => {
      const july4 = new Date("2026-07-04T12:00:00");
      expect(isWorkDay(july4, schedule)).toBe(false);
    });
  });

  describe("getWorkHours", () => {
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: null,
        },
      },
      overrides: {
        friday: {
          workPeriod: { start: 9, end: 15 },
        },
      },
    };

    it("returns work hours for weekday", () => {
      const monday = createDate(MONDAY);
      const hours = getWorkHours(monday, schedule);

      expect(hours).toEqual({ start: 9, end: 17 });
    });

    it("returns null for weekend", () => {
      const saturday = createDate(SATURDAY);
      const hours = getWorkHours(saturday, schedule);

      expect(hours).toBeNull();
    });

    it("returns overridden work hours for Friday", () => {
      const friday = createDate(FRIDAY);
      const hours = getWorkHours(friday, schedule);

      expect(hours).toEqual({ start: 9, end: 15 });
    });
  });

  describe("getWakingHours", () => {
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: { start: 7, end: 23 },
          workPeriod: null,
        },
      },
    };

    it("returns weekday waking hours", () => {
      const monday = createDate(MONDAY);
      const hours = getWakingHours(monday, schedule);

      expect(hours).toEqual({ start: 6, end: 22 });
    });

    it("returns weekend waking hours", () => {
      const saturday = createDate(SATURDAY);
      const hours = getWakingHours(saturday, schedule);

      expect(hours).toEqual({ start: 7, end: 23 });
    });
  });

  describe("getAvailableHours", () => {
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: { start: 6, end: 22 },
          workPeriod: { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: { start: 7, end: 23 },
          workPeriod: null,
        },
      },
    };

    it("returns work hours for work goals on weekday", () => {
      const monday = createDate(MONDAY);
      const hours = getAvailableHours(monday, "work", schedule);

      expect(hours).toEqual({ start: 9, end: 17 });
    });

    it("returns waking hours for personal goals on weekday", () => {
      const monday = createDate(MONDAY);
      const hours = getAvailableHours(monday, "personal", schedule);

      expect(hours).toEqual({ start: 6, end: 22 });
    });

    it("returns waking hours on weekend regardless of goal type", () => {
      const saturday = createDate(SATURDAY);

      const workHours = getAvailableHours(saturday, "work", schedule);
      const personalHours = getAvailableHours(saturday, "personal", schedule);

      // Both should return waking hours since there's no work period on weekend
      expect(workHours).toEqual({ start: 7, end: 23 });
      expect(personalHours).toEqual({ start: 7, end: 23 });
    });

    it("returns waking hours for any goal type", () => {
      const monday = createDate(MONDAY);
      const hours = getAvailableHours(monday, "any", schedule);

      expect(hours).toEqual({ start: 6, end: 22 });
    });
  });
});
