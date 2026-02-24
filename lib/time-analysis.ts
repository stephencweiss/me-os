/**
 * Time Analysis Library
 *
 * Provides functions for analyzing calendar time usage:
 * - Gap detection (unscheduled time)
 * - Time aggregation by color/category
 * - Daily and weekly summaries
 */

import { getAllAuthenticatedClients } from "./google-auth.js";
import { calendar_v3 } from "googleapis";
import * as fs from "fs";
import * as path from "path";

// Load color definitions for semantic meanings
const CONFIG_DIR = path.join(process.cwd(), "config");
const colorsPath = path.join(CONFIG_DIR, "colors.json");
const colorDefinitions: Record<string, { name: string; meaning: string }> = fs.existsSync(colorsPath)
  ? JSON.parse(fs.readFileSync(colorsPath, "utf-8"))
  : {};

// Google Calendar color names
const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  "1": "Lavender",
  "2": "Sage",
  "3": "Grape",
  "4": "Flamingo",
  "5": "Banana",
  "6": "Tangerine",
  "7": "Peacock",
  "8": "Graphite",
  "9": "Blueberry",
  "10": "Basil",
  "11": "Tomato",
};

export interface CalendarEvent {
  id: string;
  account: string;
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
}

export interface TimeGap {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface ColorSummary {
  colorId: string;
  colorName: string;
  colorMeaning: string;
  totalMinutes: number;
  eventCount: number;
  events: string[];
}

export interface DailySummary {
  date: Date;
  dateString: string;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  events: CalendarEvent[];
  allDayEvents: CalendarEvent[];
  gaps: TimeGap[];
  byColor: ColorSummary[];
}

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  days: DailySummary[];
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  byColor: ColorSummary[];
  accounts: string[];
}

/**
 * Fetch events from all accounts for a date range
 */
export async function fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
  const clients = await getAllAuthenticatedClients();
  const allEvents: CalendarEvent[] = [];

  for (const { account, calendar } of clients) {
    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      for (const event of response.data.items || []) {
        const isAllDay = !event.start?.dateTime && !!event.start?.date;
        const start = parseEventTime(event.start);
        const end = parseEventTime(event.end);

        if (!start || !end) continue;

        const colorId = event.colorId || "default";
        const colorName = colorId === "default" ? "Default" : GOOGLE_CALENDAR_COLORS[colorId] || colorId;
        const colorMeaning = colorDefinitions[colorId]?.meaning || "";

        // For all-day events, don't count their duration in time analysis
        // They represent days, not hours
        const durationMinutes = isAllDay ? 0 : Math.round((end.getTime() - start.getTime()) / (1000 * 60));

        // Check if this is a recurring event instance
        const recurringEventId = event.recurringEventId || null;
        const isRecurring = !!recurringEventId;

        allEvents.push({
          id: event.id || "",
          account,
          summary: event.summary || "(No title)",
          start,
          end,
          durationMinutes,
          colorId,
          colorName,
          colorMeaning,
          isAllDay,
          isRecurring,
          recurringEventId,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch events for ${account}:`, err);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  return allEvents;
}

function parseEventTime(time?: calendar_v3.Schema$EventDateTime): Date | null {
  if (!time) return null;
  if (time.dateTime) return new Date(time.dateTime);
  if (time.date) return new Date(time.date + "T00:00:00");
  return null;
}

/**
 * Calculate gaps (unscheduled time) between events
 *
 * @param events - List of events for the day
 * @param dayStart - Start of the work day (e.g., 9:00 AM)
 * @param dayEnd - End of the work day (e.g., 6:00 PM)
 */
export function calculateGaps(
  events: CalendarEvent[],
  dayStart: Date,
  dayEnd: Date
): TimeGap[] {
  const gaps: TimeGap[] = [];

  // Filter events that overlap with the day window
  // Exclude all-day events since they don't block specific time slots
  const dayEvents = events.filter(e =>
    !e.isAllDay && e.end > dayStart && e.start < dayEnd
  ).sort((a, b) => a.start.getTime() - b.start.getTime());

  if (dayEvents.length === 0) {
    // Entire day is a gap
    gaps.push({
      start: dayStart,
      end: dayEnd,
      durationMinutes: Math.round((dayEnd.getTime() - dayStart.getTime()) / (1000 * 60)),
    });
    return gaps;
  }

  // Merge overlapping events to avoid double-counting
  const mergedIntervals = mergeOverlappingIntervals(dayEvents.map(e => ({
    start: Math.max(e.start.getTime(), dayStart.getTime()),
    end: Math.min(e.end.getTime(), dayEnd.getTime()),
  })));

  // Check gap before first event
  const firstStart = mergedIntervals[0].start;
  if (firstStart > dayStart.getTime()) {
    gaps.push({
      start: dayStart,
      end: new Date(firstStart),
      durationMinutes: Math.round((firstStart - dayStart.getTime()) / (1000 * 60)),
    });
  }

  // Check gaps between events
  for (let i = 0; i < mergedIntervals.length - 1; i++) {
    const currentEnd = mergedIntervals[i].end;
    const nextStart = mergedIntervals[i + 1].start;

    if (nextStart > currentEnd) {
      gaps.push({
        start: new Date(currentEnd),
        end: new Date(nextStart),
        durationMinutes: Math.round((nextStart - currentEnd) / (1000 * 60)),
      });
    }
  }

  // Check gap after last event
  const lastEnd = mergedIntervals[mergedIntervals.length - 1].end;
  if (lastEnd < dayEnd.getTime()) {
    gaps.push({
      start: new Date(lastEnd),
      end: dayEnd,
      durationMinutes: Math.round((dayEnd.getTime() - lastEnd) / (1000 * 60)),
    });
  }

  return gaps;
}

/**
 * Merge overlapping time intervals
 */
function mergeOverlappingIntervals(intervals: { start: number; end: number }[]): { start: number; end: number }[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping, merge
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Calculate actual scheduled time after merging overlapping events
 * This avoids double-counting when events overlap (e.g., on-call + meetings)
 */
export function calculateEffectiveScheduledTime(events: CalendarEvent[]): number {
  const timedEvents = events.filter(e => !e.isAllDay);
  if (timedEvents.length === 0) return 0;

  const intervals = timedEvents.map(e => ({
    start: e.start.getTime(),
    end: e.end.getTime(),
  }));

  const merged = mergeOverlappingIntervals(intervals);
  return merged.reduce((sum, interval) => {
    return sum + Math.round((interval.end - interval.start) / (1000 * 60));
  }, 0);
}

/**
 * Group events by color and calculate totals
 */
export function groupByColor(events: CalendarEvent[]): ColorSummary[] {
  const colorMap = new Map<string, ColorSummary>();

  for (const event of events) {
    const key = event.colorId;

    if (!colorMap.has(key)) {
      colorMap.set(key, {
        colorId: event.colorId,
        colorName: event.colorName,
        colorMeaning: event.colorMeaning,
        totalMinutes: 0,
        eventCount: 0,
        events: [],
      });
    }

    const summary = colorMap.get(key)!;
    summary.totalMinutes += event.durationMinutes;
    summary.eventCount++;
    summary.events.push(event.summary);
  }

  // Sort by total time descending
  return Array.from(colorMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Generate a daily summary
 *
 * @param date - The date to analyze
 * @param workDayStart - Hour the work day starts (default: 9)
 * @param workDayEnd - Hour the work day ends (default: 18)
 */
export async function generateDailySummary(
  date: Date,
  workDayStart: number = 9,
  workDayEnd: number = 18
): Promise<DailySummary> {
  const dayStart = new Date(date);
  dayStart.setHours(workDayStart, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(workDayEnd, 0, 0, 0);

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  // Fetch events for the entire day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const events = await fetchEvents(startOfDay, nextDay);

  // Filter to timed events within work hours for gap calculation
  const workHourEvents = events.filter(e =>
    !e.isAllDay && e.end > dayStart && e.start < dayEnd
  );

  const gaps = calculateGaps(workHourEvents, dayStart, dayEnd);

  // Only count timed events (not all-day) for time breakdowns
  const timedEvents = events.filter(e => !e.isAllDay);
  const allDayEvents = events.filter(e => e.isAllDay);
  const byColor = groupByColor(timedEvents);

  // Use effective time to avoid double-counting overlapping events
  const totalScheduledMinutes = calculateEffectiveScheduledTime(events);
  const totalGapMinutes = gaps.reduce((sum, g) => sum + g.durationMinutes, 0);

  return {
    date,
    dateString: date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    totalScheduledMinutes,
    totalGapMinutes,
    events: timedEvents,
    allDayEvents,
    gaps,
    byColor,
  };
}

/**
 * Generate a weekly summary
 *
 * @param weekStart - Start date of the week (typically Sunday or Monday)
 * @param workDayStart - Hour the work day starts (default: 9)
 * @param workDayEnd - Hour the work day ends (default: 18)
 */
export async function generateWeeklyReport(
  weekStart: Date,
  workDayStart: number = 9,
  workDayEnd: number = 18
): Promise<WeeklySummary> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Fetch all events for the week
  const allEvents = await fetchEvents(weekStart, weekEnd);

  // Get unique accounts
  const accounts = [...new Set(allEvents.map(e => e.account))];

  // Generate daily summaries
  const days: DailySummary[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);

    const dayStart = new Date(date);
    dayStart.setHours(workDayStart, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(workDayEnd, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    // Filter events for this day
    const dayEvents = allEvents.filter(e =>
      e.start >= startOfDay && e.start < nextDay
    );

    // Filter to timed events within work hours for gap calculation
    const workHourEvents = dayEvents.filter(e =>
      !e.isAllDay && e.end > dayStart && e.start < dayEnd
    );

    const gaps = calculateGaps(workHourEvents, dayStart, dayEnd);

    // Only count timed events (not all-day) for time breakdowns
    const timedDayEvents = dayEvents.filter(e => !e.isAllDay);
    const allDayDayEvents = dayEvents.filter(e => e.isAllDay);
    const byColor = groupByColor(timedDayEvents);

    // Use effective time to avoid double-counting overlapping events
    const totalScheduledMinutes = calculateEffectiveScheduledTime(dayEvents);
    const totalGapMinutes = gaps.reduce((sum, g) => sum + g.durationMinutes, 0);

    days.push({
      date,
      dateString: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      totalScheduledMinutes,
      totalGapMinutes,
      events: timedDayEvents,
      allDayEvents: allDayDayEvents,
      gaps,
      byColor,
    });
  }

  // Aggregate weekly totals (only timed events)
  const totalScheduledMinutes = days.reduce((sum, d) => sum + d.totalScheduledMinutes, 0);
  const totalGapMinutes = days.reduce((sum, d) => sum + d.totalGapMinutes, 0);
  const timedEvents = allEvents.filter(e => !e.isAllDay);
  const byColor = groupByColor(timedEvents);

  return {
    weekStart,
    weekEnd,
    days,
    totalScheduledMinutes,
    totalGapMinutes,
    byColor,
    accounts,
  };
}

/**
 * Format minutes as hours and minutes string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get the start of the current week (Sunday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a weekly report as markdown
 */
export function formatWeeklyReportMarkdown(report: WeeklySummary): string {
  const lines: string[] = [];

  lines.push(`# Weekly Time Report`);
  lines.push(`**Week of ${report.weekStart.toLocaleDateString()}**`);
  lines.push(`**Accounts:** ${report.accounts.join(", ")}`);
  lines.push("");

  // Overall summary
  lines.push("## Summary");
  lines.push(`- **Total Scheduled:** ${formatDuration(report.totalScheduledMinutes)}`);
  lines.push(`- **Total Unstructured (work hours):** ${formatDuration(report.totalGapMinutes)}`);
  lines.push("");

  // Time by category
  lines.push("## Time by Category");
  lines.push("| Category | Color | Time | Events |");
  lines.push("|----------|-------|------|--------|");

  for (const color of report.byColor) {
    const category = color.colorMeaning || color.colorName;
    lines.push(`| ${category} | ${color.colorName} | ${formatDuration(color.totalMinutes)} | ${color.eventCount} |`);
  }
  lines.push("");

  // Daily breakdown
  lines.push("## Daily Breakdown");

  for (const day of report.days) {
    const dayName = day.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    lines.push(`### ${dayName}`);

    // Show all-day events first
    if (day.allDayEvents && day.allDayEvents.length > 0) {
      const allDayLabels = day.allDayEvents.map(e => `${e.summary} [${e.account}]`).join(", ");
      lines.push(`**All-day:** ${allDayLabels}`);
    }

    if (day.events.length === 0 && (!day.allDayEvents || day.allDayEvents.length === 0)) {
      lines.push("*(No events)*");
    } else if (day.events.length > 0) {
      lines.push(`- Scheduled: ${formatDuration(day.totalScheduledMinutes)} (after merging overlaps)`);
      lines.push(`- Unstructured: ${formatDuration(day.totalGapMinutes)}`);

      // Top categories for the day
      if (day.byColor.length > 0) {
        lines.push("- Categories: " + day.byColor.slice(0, 3).map(c =>
          `${c.colorMeaning || c.colorName} (${formatDuration(c.totalMinutes)})`
        ).join(", "));
      }
    }
    lines.push("");
  }

  // Gap analysis
  lines.push("## Unstructured Time (Gaps)");
  lines.push("Days with significant unstructured time during work hours (9am-6pm):");
  lines.push("");

  for (const day of report.days) {
    if (day.totalGapMinutes >= 60) {
      const dayName = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      lines.push(`- **${dayName}:** ${formatDuration(day.totalGapMinutes)}`);

      // Show largest gaps
      const largeGaps = day.gaps.filter(g => g.durationMinutes >= 30).slice(0, 3);
      for (const gap of largeGaps) {
        const startTime = gap.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const endTime = gap.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        lines.push(`  - ${startTime} - ${endTime} (${formatDuration(gap.durationMinutes)})`);
      }
    }
  }

  return lines.join("\n");
}
