/**
 * Turso Database Client for Webapp
 *
 * Connects to the Turso cloud database for reading calendar data.
 * Configured via environment variables.
 */

import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/**
 * Get database client singleton
 */
export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL environment variable is required");
    }

    client = createClient({
      url,
      authToken,
    });
  }

  return client;
}

/**
 * Event from database
 */
export interface DbEvent {
  id: string;
  google_event_id: string;
  date: string;
  account: string;
  calendar_name: string;
  calendar_type: string;
  summary: string;
  description: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  color_id: string;
  color_name: string;
  color_meaning: string;
  is_all_day: number;
  is_recurring: number;
  recurring_event_id: string | null;
  first_seen: string;
  last_seen: string;
  attended: string;
}

/**
 * Daily summary from database
 */
export interface DbDailySummary {
  date: string;
  total_scheduled_minutes: number;
  total_gap_minutes: number;
  categories_json: string;
  is_work_day: number;
  analysis_hours_start: number;
  analysis_hours_end: number;
  snapshot_time: string;
}

/**
 * Category from daily summary
 */
export interface Category {
  colorId: string;
  colorName: string;
  colorMeaning: string;
  totalMinutes: number;
  eventCount: number;
  events: string[];
}

/**
 * Get events for a date range
 */
export async function getEvents(
  startDate: string,
  endDate: string,
  options?: {
    calendars?: string[];
    accounts?: string[];
  }
): Promise<DbEvent[]> {
  const db = getDb();

  let query = `
    SELECT * FROM events
    WHERE date >= ? AND date <= ?
  `;
  const params: (string | number)[] = [startDate, endDate];

  if (options?.calendars && options.calendars.length > 0) {
    const placeholders = options.calendars.map(() => "?").join(", ");
    query += ` AND calendar_name IN (${placeholders})`;
    params.push(...options.calendars);
  }

  if (options?.accounts && options.accounts.length > 0) {
    const placeholders = options.accounts.map(() => "?").join(", ");
    query += ` AND account IN (${placeholders})`;
    params.push(...options.accounts);
  }

  query += " ORDER BY date DESC, start_time ASC";

  const result = await db.execute({ sql: query, args: params });
  return result.rows as unknown as DbEvent[];
}

/**
 * Get daily summaries for a date range
 */
export async function getDailySummaries(
  startDate: string,
  endDate: string
): Promise<DbDailySummary[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT * FROM daily_summaries
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC
    `,
    args: [startDate, endDate],
  });

  return result.rows as unknown as DbDailySummary[];
}

/**
 * Get distinct calendars
 */
export async function getCalendars(): Promise<{ calendar_name: string; account: string }[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT DISTINCT calendar_name, account
      FROM events
      ORDER BY account, calendar_name
    `,
    args: [],
  });

  return result.rows as unknown as { calendar_name: string; account: string }[];
}

/**
 * Get distinct accounts
 */
export async function getAccounts(): Promise<string[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT DISTINCT account
      FROM events
      ORDER BY account
    `,
    args: [],
  });

  return result.rows.map((row) => row.account as string);
}

/**
 * Update event attendance status
 */
export async function updateAttendance(
  eventId: string,
  attended: "attended" | "skipped" | "unknown"
): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE events SET attended = ?, last_seen = ? WHERE id = ?`,
    args: [attended, new Date().toISOString(), eventId],
  });
}

/**
 * Get user preference
 */
export async function getPreference(key: string): Promise<string | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT value FROM user_preferences WHERE key = ?`,
    args: [key],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].value as string;
}

/**
 * Set user preference
 */
export async function setPreference(key: string, value: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `
      INSERT INTO user_preferences (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    args: [key, value],
  });
}

/**
 * Get all preferences
 */
export async function getAllPreferences(): Promise<Record<string, string>> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT key, value FROM user_preferences`,
    args: [],
  });

  const prefs: Record<string, string> = {};
  for (const row of result.rows) {
    prefs[row.key as string] = row.value as string;
  }

  return prefs;
}

/**
 * Computed summary for a single day (used when filtering)
 */
export interface ComputedDailySummary {
  date: string;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  categories: Category[];
  isWorkDay: boolean;
}

/**
 * Compute summaries from events on-the-fly (used when filters are applied)
 *
 * This function queries the events table directly and computes summaries
 * dynamically, allowing for account/calendar filtering that isn't possible
 * with pre-computed daily_summaries.
 */
export async function computeSummariesFromEvents(
  startDate: string,
  endDate: string,
  options?: { accounts?: string[]; calendars?: string[] }
): Promise<{ summaries: ComputedDailySummary[] }> {
  // 1. Fetch filtered events
  const events = await getEvents(startDate, endDate, options);

  // 2. Group events by date
  const eventsByDate = new Map<string, DbEvent[]>();
  for (const event of events) {
    const existing = eventsByDate.get(event.date) || [];
    existing.push(event);
    eventsByDate.set(event.date, existing);
  }

  // 3. Compute summary for each date
  const summaries: ComputedDailySummary[] = [];
  for (const [date, dayEvents] of eventsByDate) {
    // Calculate total scheduled minutes (sum of all event durations)
    const totalScheduledMinutes = dayEvents.reduce(
      (sum, e) => sum + e.duration_minutes,
      0
    );

    // Group by color to compute categories
    const colorGroups = new Map<
      string,
      { minutes: number; count: number; name: string; meaning: string; eventIds: string[] }
    >();
    for (const event of dayEvents) {
      const existing = colorGroups.get(event.color_id) || {
        minutes: 0,
        count: 0,
        name: event.color_name,
        meaning: event.color_meaning,
        eventIds: [],
      };
      existing.minutes += event.duration_minutes;
      existing.count += 1;
      existing.eventIds.push(event.id);
      colorGroups.set(event.color_id, existing);
    }

    const categories: Category[] = Array.from(colorGroups.entries()).map(
      ([colorId, data]) => ({
        colorId,
        colorName: data.name,
        colorMeaning: data.meaning,
        totalMinutes: data.minutes,
        eventCount: data.count,
        events: data.eventIds,
      })
    );

    // Determine if work day (weekday = Mon-Fri)
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;

    // Gap minutes: simplified calculation (would need analysis hours config for full accuracy)
    const totalGapMinutes = 0;

    summaries.push({
      date,
      totalScheduledMinutes,
      totalGapMinutes,
      categories,
      isWorkDay,
    });
  }

  // Sort by date descending (most recent first)
  summaries.sort((a, b) => b.date.localeCompare(a.date));

  return { summaries };
}
