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
import {
  loadSchedule,
  getScheduleForDate,
  isWorkDay,
  getWakingHours,
  getTimePeriodDates,
  type WeeklySchedule,
} from "./schedule.js";
import {
  CalendarType,
  loadCalendarFilterConfig,
  getCalendarType,
  getCalendarTypeBehavior,
  shouldIncludeEvent,
} from "./calendar-filter.js";

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
  calendarName: string;
  calendarType: CalendarType;
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
  events: CalendarEvent[];           // Active events (count toward time)
  allDayEvents: CalendarEvent[];
  availabilityEvents: CalendarEvent[]; // Availability context (e.g., on-call)
  referenceEvents: CalendarEvent[];    // Reference/FYI events
  gaps: TimeGap[];
  byColor: ColorSummary[];
  isWorkDay: boolean;
  analysisHours: { start: number; end: number }; // Hours used for gap analysis
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
 * Fetch events from all accounts and all calendars for a date range.
 * Applies calendar type filtering and tags events with their calendar type.
 */
export async function fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
  const clients = await getAllAuthenticatedClients();
  const allEvents: CalendarEvent[] = [];
  const filterConfig = loadCalendarFilterConfig();

  for (const { account, calendar } of clients) {
    try {
      // Get all calendars for this account
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items || [];

      // Fetch events from each calendar
      for (const cal of calendars) {
        if (!cal.id) continue;

        // Skip holiday calendars (they add noise)
        if (cal.id.includes("#holiday@group")) continue;

        // Determine calendar type
        const calendarInfo = {
          id: cal.id,
          summary: cal.summary || cal.id,
          primary: cal.primary || false,
          accessRole: cal.accessRole || "reader",
        };
        const calendarType = getCalendarType(calendarInfo, filterConfig);

        // Skip excluded calendars
        if (calendarType === "excluded") {
          continue;
        }

        // Check if this is a shared calendar without explicit type config
        const isSharedCalendarWithoutExplicitType =
          !cal.primary &&
          cal.accessRole !== "owner" &&
          !filterConfig.calendarTypes[cal.id] &&
          !filterConfig.calendarTypes[cal.summary || ""];

        try {
          const response = await calendar.events.list({
            calendarId: cal.id,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
          });

          for (const event of response.data.items || []) {
            // For shared calendars without explicit type, filter by attendee status
            if (isSharedCalendarWithoutExplicitType) {
              const shouldInclude = shouldIncludeEvent(
                {
                  attendees: event.attendees,
                  organizer: event.organizer,
                },
                account,
                calendarType as CalendarType,
                true
              );
              if (!shouldInclude) {
                continue;
              }
            }

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
              calendarName: cal.summary || cal.id,
              calendarType: calendarType as CalendarType,
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
          // Silently skip calendars we can't read (e.g., some shared calendars)
          console.error(`Failed to fetch events from ${cal.summary || cal.id} for ${account}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch calendars for ${account}:`, err);
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
 * @param schedule - Optional schedule config (loaded from config if not provided)
 * @param overrideHours - Optional explicit hours override (for backward compatibility)
 */
export async function generateDailySummary(
  date: Date,
  schedule?: WeeklySchedule,
  overrideHours?: { start: number; end: number }
): Promise<DailySummary> {
  // Load schedule if not provided
  const effectiveSchedule = schedule || loadSchedule();

  // Determine analysis hours based on schedule
  let analysisStart: number;
  let analysisEnd: number;

  if (overrideHours) {
    // Explicit override takes precedence (backward compatibility)
    analysisStart = overrideHours.start;
    analysisEnd = overrideHours.end;
  } else {
    // Use schedule - work hours for work days, waking hours for non-work days
    const daySchedule = getScheduleForDate(date, effectiveSchedule);
    if (daySchedule.workPeriod) {
      analysisStart = daySchedule.workPeriod.start;
      analysisEnd = daySchedule.workPeriod.end;
    } else {
      // Weekend/holiday - use waking hours
      analysisStart = daySchedule.awakePeriod.start;
      analysisEnd = daySchedule.awakePeriod.end;
    }
  }

  const dayStart = new Date(date);
  dayStart.setHours(analysisStart, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(analysisEnd, 0, 0, 0);

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);

  // Fetch events for the entire day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const allEvents = await fetchEvents(startOfDay, nextDay);

  // Separate events by calendar type
  const activeEvents = allEvents.filter(e => e.calendarType === "active");
  const availabilityEvents = allEvents.filter(e => e.calendarType === "availability");
  const referenceEvents = allEvents.filter(e => e.calendarType === "reference");
  const blockingEvents = allEvents.filter(e => e.calendarType === "blocking");

  // For gap calculation, use active + blocking events (both fill gaps)
  const gapFillingEvents = [...activeEvents, ...blockingEvents];
  const analysisHourEvents = gapFillingEvents.filter(e =>
    !e.isAllDay && e.end > dayStart && e.start < dayEnd
  );

  const gaps = calculateGaps(analysisHourEvents, dayStart, dayEnd);

  // Only count active timed events for time breakdowns
  const timedActiveEvents = activeEvents.filter(e => !e.isAllDay);
  const allDayEvents = allEvents.filter(e => e.isAllDay);
  const byColor = groupByColor(timedActiveEvents);

  // Use effective time to avoid double-counting overlapping active events
  const totalScheduledMinutes = calculateEffectiveScheduledTime(activeEvents);
  const totalGapMinutes = gaps.reduce((sum, g) => sum + g.durationMinutes, 0);

  const isWorkDayResult = isWorkDay(date, effectiveSchedule);

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
    events: timedActiveEvents,
    allDayEvents,
    availabilityEvents: availabilityEvents.filter(e => !e.isAllDay),
    referenceEvents: referenceEvents.filter(e => !e.isAllDay),
    gaps,
    byColor,
    isWorkDay: isWorkDayResult,
    analysisHours: { start: analysisStart, end: analysisEnd },
  };
}

/**
 * Generate a weekly summary
 *
 * @param weekStart - Start date of the week (typically Sunday or Monday)
 * @param schedule - Optional schedule config (loaded from config if not provided)
 */
export async function generateWeeklyReport(
  weekStart: Date,
  schedule?: WeeklySchedule
): Promise<WeeklySummary> {
  // Load schedule if not provided
  const effectiveSchedule = schedule || loadSchedule();

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

    // Get schedule for this specific day
    const daySchedule = getScheduleForDate(date, effectiveSchedule);
    const isWorkDayResult = daySchedule.workPeriod !== null;

    // Use work hours for work days, waking hours for weekends/holidays
    const analysisStart = isWorkDayResult
      ? daySchedule.workPeriod!.start
      : daySchedule.awakePeriod.start;
    const analysisEnd = isWorkDayResult
      ? daySchedule.workPeriod!.end
      : daySchedule.awakePeriod.end;

    const dayStart = new Date(date);
    dayStart.setHours(analysisStart, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(analysisEnd, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    // Filter events for this day
    const dayEvents = allEvents.filter(e =>
      e.start >= startOfDay && e.start < nextDay
    );

    // Separate events by calendar type
    const activeEvents = dayEvents.filter(e => e.calendarType === "active");
    const availabilityEvents = dayEvents.filter(e => e.calendarType === "availability");
    const referenceEvents = dayEvents.filter(e => e.calendarType === "reference");
    const blockingEvents = dayEvents.filter(e => e.calendarType === "blocking");

    // For gap calculation, use active + blocking events (both fill gaps)
    const gapFillingEvents = [...activeEvents, ...blockingEvents];
    const analysisHourEvents = gapFillingEvents.filter(e =>
      !e.isAllDay && e.end > dayStart && e.start < dayEnd
    );

    const gaps = calculateGaps(analysisHourEvents, dayStart, dayEnd);

    // Only count active timed events for time breakdowns
    const timedActiveEvents = activeEvents.filter(e => !e.isAllDay);
    const allDayDayEvents = dayEvents.filter(e => e.isAllDay);
    const byColor = groupByColor(timedActiveEvents);

    // Use effective time to avoid double-counting overlapping active events
    const totalScheduledMinutes = calculateEffectiveScheduledTime(activeEvents);
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
      events: timedActiveEvents,
      allDayEvents: allDayDayEvents,
      availabilityEvents: availabilityEvents.filter(e => !e.isAllDay),
      referenceEvents: referenceEvents.filter(e => !e.isAllDay),
      gaps,
      byColor,
      isWorkDay: isWorkDayResult,
      analysisHours: { start: analysisStart, end: analysisEnd },
    });
  }

  // Aggregate weekly totals (only active timed events)
  const totalScheduledMinutes = days.reduce((sum, d) => sum + d.totalScheduledMinutes, 0);
  const totalGapMinutes = days.reduce((sum, d) => sum + d.totalGapMinutes, 0);
  const activeTimedEvents = allEvents.filter(e => !e.isAllDay && e.calendarType === "active");
  const byColor = groupByColor(activeTimedEvents);

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
  lines.push("Days with significant unstructured time:");
  lines.push("");

  for (const day of report.days) {
    if (day.totalGapMinutes >= 60) {
      const dayName = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const hoursLabel = day.isWorkDay
        ? `work hours ${formatHour(day.analysisHours.start)}-${formatHour(day.analysisHours.end)}`
        : `waking hours ${formatHour(day.analysisHours.start)}-${formatHour(day.analysisHours.end)}`;
      lines.push(`- **${dayName}:** ${formatDuration(day.totalGapMinutes)} (${hoursLabel})`);

      // Show largest gaps
      const largeGaps = day.gaps.filter(g => g.durationMinutes >= 30).slice(0, 3);
      for (const gap of largeGaps) {
        const startTime = gap.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const endTime = gap.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        lines.push(`  - ${startTime} - ${endTime} (${formatDuration(gap.durationMinutes)})`);
      }
    }
  }
  lines.push("");

  // Availability context (e.g., on-call)
  const allAvailabilityEvents = report.days.flatMap(d => d.availabilityEvents || []);
  if (allAvailabilityEvents.length > 0) {
    lines.push("## Availability Context");
    lines.push("*Events that show context (e.g., on-call) but don't count toward time tracking.*");
    lines.push("");

    for (const day of report.days) {
      if (day.availabilityEvents && day.availabilityEvents.length > 0) {
        const dayName = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        lines.push(`**${dayName}:**`);
        for (const event of day.availabilityEvents) {
          const startTime = event.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const endTime = event.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          lines.push(`- ${startTime} - ${endTime}: ${event.summary} [${event.calendarName}]`);
        }
      }
    }
    lines.push("");
  }

  // Reference events (FYI)
  const allReferenceEvents = report.days.flatMap(d => d.referenceEvents || []);
  if (allReferenceEvents.length > 0) {
    lines.push("## Reference (FYI)");
    lines.push("*Events from reference calendars, shown for context only.*");
    lines.push("");

    for (const day of report.days) {
      if (day.referenceEvents && day.referenceEvents.length > 0) {
        const dayName = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        lines.push(`**${dayName}:**`);
        for (const event of day.referenceEvents) {
          const startTime = event.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const endTime = event.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          lines.push(`- ${startTime} - ${endTime}: ${event.summary} [${event.calendarName}]`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format an hour as a simple time string (e.g., 9am, 5pm)
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
