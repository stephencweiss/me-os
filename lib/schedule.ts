/**
 * Schedule Library
 *
 * Provides configurable weekly schedule for defining waking hours
 * and work hours by day of week. Used by time reports and calendar
 * optimization to understand available time slots.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

/**
 * A time period defined by start and end hours (0-23).
 */
export interface TimePeriod {
  start: number; // Hour (0-23)
  end: number; // Hour (0-23)
}

/**
 * Schedule for a single day.
 */
export interface DaySchedule {
  awakePeriod: TimePeriod;
  workPeriod: TimePeriod | null; // null = no work (weekend/holiday)
}

/**
 * Weekly schedule configuration.
 */
export interface WeeklySchedule {
  defaultSchedule: {
    weekday: DaySchedule;
    weekend: DaySchedule;
  };
  overrides?: {
    [day: string]: Partial<DaySchedule>; // "monday", "tuesday", etc.
  };
  holidays?: string[]; // ISO dates "2026-12-25"
}

// ============================================================================
// Constants
// ============================================================================

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const CONFIG_DIR = path.join(process.cwd(), "config");
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, "schedule.json");

// ============================================================================
// Default Schedule
// ============================================================================

/**
 * Returns the default schedule:
 * - Weekdays (M-F): awake 6am-10pm, work 9am-5pm
 * - Weekends (S-Su): awake 6am-10pm, no work
 */
export function getDefaultSchedule(): WeeklySchedule {
  return {
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
    overrides: {},
    holidays: [],
  };
}

// ============================================================================
// Schedule Loading
// ============================================================================

/**
 * Load schedule from a JSON config file.
 * Returns the default schedule if the file doesn't exist or is invalid.
 */
export function loadSchedule(configPath: string = DEFAULT_CONFIG_PATH): WeeklySchedule {
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultSchedule();
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate that we have the required structure
    if (!parsed.defaultSchedule?.weekday || !parsed.defaultSchedule?.weekend) {
      return getDefaultSchedule();
    }

    // Merge with defaults to ensure all fields are present
    const schedule: WeeklySchedule = {
      defaultSchedule: {
        weekday: {
          awakePeriod: parsed.defaultSchedule.weekday.awakePeriod || { start: 6, end: 22 },
          workPeriod: parsed.defaultSchedule.weekday.workPeriod ?? { start: 9, end: 17 },
        },
        weekend: {
          awakePeriod: parsed.defaultSchedule.weekend.awakePeriod || { start: 6, end: 22 },
          workPeriod: parsed.defaultSchedule.weekend.workPeriod ?? null,
        },
      },
      overrides: parsed.overrides || {},
      holidays: parsed.holidays || [],
    };

    return schedule;
  } catch {
    return getDefaultSchedule();
  }
}

// ============================================================================
// Schedule Queries
// ============================================================================

/**
 * Get the schedule for a specific date.
 * Takes into account:
 * 1. Whether it's a weekday or weekend
 * 2. Any day-specific overrides
 * 3. Holidays (treated as weekends)
 */
export function getScheduleForDate(
  date: Date,
  schedule: WeeklySchedule = getDefaultSchedule()
): DaySchedule {
  // Check if this date is a holiday
  const dateStr = formatDateISO(date);
  if (schedule.holidays?.includes(dateStr)) {
    return schedule.defaultSchedule.weekend;
  }

  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayName = DAY_NAMES[dayOfWeek];
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Start with the appropriate base schedule
  const baseSchedule = isWeekend
    ? schedule.defaultSchedule.weekend
    : schedule.defaultSchedule.weekday;

  // Apply day-specific overrides if they exist
  const override = schedule.overrides?.[dayName];
  if (override) {
    return {
      awakePeriod: override.awakePeriod || baseSchedule.awakePeriod,
      workPeriod: override.workPeriod !== undefined ? override.workPeriod : baseSchedule.workPeriod,
    };
  }

  return baseSchedule;
}

/**
 * Check if a date is a work day (has defined work hours).
 */
export function isWorkDay(
  date: Date,
  schedule: WeeklySchedule = getDefaultSchedule()
): boolean {
  const daySchedule = getScheduleForDate(date, schedule);
  return daySchedule.workPeriod !== null;
}

/**
 * Get work hours for a date.
 * Returns null if not a work day.
 */
export function getWorkHours(
  date: Date,
  schedule: WeeklySchedule = getDefaultSchedule()
): TimePeriod | null {
  const daySchedule = getScheduleForDate(date, schedule);
  return daySchedule.workPeriod;
}

/**
 * Get waking hours for a date.
 */
export function getWakingHours(
  date: Date,
  schedule: WeeklySchedule = getDefaultSchedule()
): TimePeriod {
  const daySchedule = getScheduleForDate(date, schedule);
  return daySchedule.awakePeriod;
}

/**
 * Get available hours for scheduling based on goal type.
 *
 * - "work" goals: Schedule during work hours (or waking hours if no work period)
 * - "personal" goals: Schedule during waking hours
 * - "any" goals: Schedule during waking hours
 */
export function getAvailableHours(
  date: Date,
  goalType: "work" | "personal" | "any",
  schedule: WeeklySchedule = getDefaultSchedule()
): TimePeriod {
  const daySchedule = getScheduleForDate(date, schedule);

  // For work goals, prefer work hours if available
  if (goalType === "work" && daySchedule.workPeriod) {
    return daySchedule.workPeriod;
  }

  // For personal or any goals, or work goals on non-work days, use waking hours
  return daySchedule.awakePeriod;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a date as ISO date string (YYYY-MM-DD).
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Create a Date object with specific hours from a base date and time period.
 */
export function createDateWithHour(baseDate: Date, hour: number): Date {
  const result = new Date(baseDate);
  result.setHours(hour, 0, 0, 0);
  return result;
}

/**
 * Get the time period boundaries as Date objects for a specific date.
 */
export function getTimePeriodDates(
  date: Date,
  period: TimePeriod
): { start: Date; end: Date } {
  return {
    start: createDateWithHour(date, period.start),
    end: createDateWithHour(date, period.end),
  };
}
