/**
 * Calendar Sync Module
 *
 * Fetches calendar events from Google Calendar and syncs them to the
 * local SQLite database, detecting changes (additions, modifications, removals).
 */

import {
  initDatabase,
  upsertEvent,
  upsertDailySummary,
  logEventChange,
  getStoredEventIds,
  markEventRemoved,
  formatDateKey,
  getEventsForDateRange,
  type StoredEvent,
} from "./calendar-db.js";
import {
  fetchEvents,
  generateDailySummary,
  type CalendarEvent,
  type DailySummary,
} from "./time-analysis.js";

/**
 * Sync result statistics
 */
export interface SyncResult {
  dateRange: { start: Date; end: Date };
  events: {
    total: number;
    added: number;
    modified: number;
    removed: number;
    unchanged: number;
  };
  dailySummaries: number;
  duration: number; // milliseconds
}

/**
 * Options for syncing calendar
 */
export interface SyncOptions {
  /** Number of days to sync (default: 30) */
  days?: number;
  /** Start date for sync (overrides days) */
  startDate?: Date;
  /** End date for sync (overrides days) */
  endDate?: Date;
  /** Whether to log verbose output */
  verbose?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

/**
 * Get date range from options
 */
function getDateRange(options: SyncOptions): { start: Date; end: Date } {
  if (options.startDate && options.endDate) {
    return { start: options.startDate, end: options.endDate };
  }

  const days = options.days ?? 30;
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * Generate all dates in a range
 */
function* dateRange(start: Date, end: Date): Generator<Date> {
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    yield new Date(current);
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Sync calendar events to the database
 */
export async function syncCalendar(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now();
  const log = options.onProgress ?? (() => {});

  // Initialize database
  log("Initializing database...");
  await initDatabase();

  // Determine date range
  const { start, end } = getDateRange(options);
  log(`Syncing events from ${formatDateKey(start)} to ${formatDateKey(end)}`);

  // Fetch events from Google Calendar
  log("Fetching events from Google Calendar...");
  const fetchedEvents = await fetchEvents(start, end);
  log(`Fetched ${fetchedEvents.length} events`);

  // Get existing stored event IDs for comparison
  const storedIds = await getStoredEventIds(start, end);
  const fetchedIds = new Set<string>();

  // Track statistics
  const stats = {
    total: fetchedEvents.length,
    added: 0,
    modified: 0,
    removed: 0,
    unchanged: 0,
  };

  // Process each fetched event
  log("Processing events...");
  for (const event of fetchedEvents) {
    const date = formatDateKey(event.start);
    const eventId = `${event.id}:${date}`;
    fetchedIds.add(eventId);

    const result = await upsertEvent(event);

    switch (result.action) {
      case "inserted":
        stats.added++;
        await logEventChange({
          event_id: eventId,
          google_event_id: event.id,
          change_type: "added",
          change_time: new Date().toISOString(),
          old_value_json: null,
          new_value_json: JSON.stringify(event),
          field_changed: null,
        });
        if (options.verbose) {
          log(`  + Added: ${event.summary} (${date})`);
        }
        break;

      case "updated":
        stats.modified++;
        // Get old value for change log
        const oldEvents = await getEventsForDateRange(event.start, event.end);
        const oldEvent = oldEvents.find((e) => e.id === eventId);
        await logEventChange({
          event_id: eventId,
          google_event_id: event.id,
          change_type: "modified",
          change_time: new Date().toISOString(),
          old_value_json: oldEvent ? JSON.stringify(oldEvent) : null,
          new_value_json: JSON.stringify(event),
          field_changed: result.changes?.join(", ") ?? null,
        });
        if (options.verbose) {
          log(`  ~ Modified: ${event.summary} (${date}) - ${result.changes?.join(", ")}`);
        }
        break;

      case "unchanged":
        stats.unchanged++;
        break;
    }
  }

  // Find removed events (in stored but not in fetched)
  for (const storedId of storedIds) {
    if (!fetchedIds.has(storedId)) {
      stats.removed++;
      await markEventRemoved(storedId);
      if (options.verbose) {
        log(`  - Removed: ${storedId}`);
      }
    }
  }

  log(`Events: +${stats.added} ~${stats.modified} -${stats.removed} =${stats.unchanged}`);

  // Generate and store daily summaries
  log("Generating daily summaries...");
  let summaryCount = 0;

  for (const date of dateRange(start, end)) {
    const summary = await generateDailySummary(date);
    await upsertDailySummary(summary);
    summaryCount++;
  }

  log(`Generated ${summaryCount} daily summaries`);

  const duration = Date.now() - startTime;
  log(`Sync completed in ${(duration / 1000).toFixed(1)}s`);

  return {
    dateRange: { start, end },
    events: stats,
    dailySummaries: summaryCount,
    duration,
  };
}

/**
 * Sync a single day
 */
export async function syncDay(date: Date, verbose?: boolean): Promise<SyncResult> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return syncCalendar({
    startDate: dayStart,
    endDate: dayEnd,
    verbose,
  });
}

/**
 * Sync the current week
 */
export async function syncWeek(verbose?: boolean): Promise<SyncResult> {
  return syncCalendar({
    days: 7,
    verbose,
  });
}

/**
 * Get a summary of what would be synced without making changes
 */
export async function previewSync(
  options: SyncOptions = {}
): Promise<{
  dateRange: { start: Date; end: Date };
  storedCount: number;
  wouldFetch: number;
}> {
  const { start, end } = getDateRange(options);

  // Initialize database to check stored events
  await initDatabase();
  const storedIds = await getStoredEventIds(start, end);

  // Fetch events to compare
  const fetchedEvents = await fetchEvents(start, end);

  return {
    dateRange: { start, end },
    storedCount: storedIds.size,
    wouldFetch: fetchedEvents.length,
  };
}
