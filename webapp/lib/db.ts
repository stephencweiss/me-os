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
    attended?: string[];
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

  if (options?.attended && options.attended.length > 0) {
    const placeholders = options.attended.map(() => "?").join(", ");
    query += ` AND attended IN (${placeholders})`;
    params.push(...options.attended);
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
 * Color definitions mapping colorId to name and meaning
 */
export const COLOR_DEFINITIONS: Record<string, { name: string; meaning: string }> = {
  "1": { name: "Lavender", meaning: "1:1s / People" },
  "2": { name: "Sage", meaning: "Studying / Learning" },
  "3": { name: "Grape", meaning: "Project Work" },
  "4": { name: "Flamingo", meaning: "Meetings" },
  "5": { name: "Banana", meaning: "Household / Pets" },
  "6": { name: "Tangerine", meaning: "Family Time" },
  "7": { name: "Peacock", meaning: "Personal Projects" },
  "8": { name: "Graphite", meaning: "Routines / Logistics" },
  "9": { name: "Blueberry", meaning: "Fitness" },
  "10": { name: "Basil", meaning: "Social" },
  "11": { name: "Tomato", meaning: "Urgent / Blocked" },
};

/**
 * Get a single event by ID
 */
export async function getEventById(eventId: string): Promise<DbEvent | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM events WHERE id = ?`,
    args: [eventId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as unknown as DbEvent;
}

/**
 * Update event color
 */
export async function updateEventColor(
  eventId: string,
  colorId: string
): Promise<DbEvent | null> {
  const db = getDb();
  const colorDef = COLOR_DEFINITIONS[colorId];

  if (!colorDef) {
    throw new Error(`Invalid color ID: ${colorId}`);
  }

  await db.execute({
    sql: `UPDATE events SET color_id = ?, color_name = ?, color_meaning = ?, last_seen = ? WHERE id = ?`,
    args: [colorId, colorDef.name, colorDef.meaning, new Date().toISOString(), eventId],
  });

  // Return updated event
  const result = await db.execute({
    sql: `SELECT * FROM events WHERE id = ?`,
    args: [eventId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as unknown as DbEvent;
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

// ============================================================================
// Computed Summaries (for filtering)
// ============================================================================

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

// ============================================================================
// Weekly Goals
// ============================================================================

/**
 * Weekly goal from database
 */
export interface DbWeeklyGoal {
  id: string;
  things3_id: string;
  week_id: string;
  title: string;
  notes: string | null;
  estimated_minutes: number | null;
  goal_type: "time" | "outcome" | "habit";
  color_id: string | null;
  status: "active" | "completed" | "cancelled";
  progress_percent: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Non-goal from database
 */
export interface DbNonGoal {
  id: string;
  week_id: string;
  title: string;
  pattern: string;
  color_id: string | null;
  reason: string | null;
  active: number;
  created_at: string;
}

/**
 * Non-goal alert from database
 */
export interface DbNonGoalAlert {
  id: number;
  non_goal_id: string;
  event_id: string;
  detected_at: string;
  acknowledged: number;
}

/**
 * Get goals for a week
 */
export async function getGoalsForWeek(weekId: string): Promise<DbWeeklyGoal[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM weekly_goals WHERE week_id = ? ORDER BY created_at`,
    args: [weekId],
  });

  return result.rows as unknown as DbWeeklyGoal[];
}

/**
 * Get a single goal by ID
 */
export async function getGoalById(goalId: string): Promise<DbWeeklyGoal | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM weekly_goals WHERE id = ?`,
    args: [goalId],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as DbWeeklyGoal;
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  goalId: string,
  progressPercent: number
): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE weekly_goals SET progress_percent = ?, updated_at = ? WHERE id = ?`,
    args: [progressPercent, new Date().toISOString(), goalId],
  });
}

/**
 * Update goal status
 */
export async function updateGoalStatus(
  goalId: string,
  status: "active" | "completed" | "cancelled"
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const completedAt = status === "completed" ? now : null;

  await db.execute({
    sql: `UPDATE weekly_goals SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
    args: [status, completedAt, now, goalId],
  });
}

/**
 * Get goal progress records
 */
export async function getGoalProgress(goalId: string): Promise<number> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT SUM(minutes_contributed) as total FROM goal_progress WHERE goal_id = ?`,
    args: [goalId],
  });

  return (result.rows[0]?.total as number) || 0;
}

// ============================================================================
// Non-Goals
// ============================================================================

/**
 * Get non-goals for a week
 */
export async function getNonGoalsForWeek(weekId: string): Promise<DbNonGoal[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM non_goals WHERE week_id = ? AND active = 1 ORDER BY created_at`,
    args: [weekId],
  });

  return result.rows as unknown as DbNonGoal[];
}

/**
 * Get unacknowledged alerts for a week
 */
export async function getUnacknowledgedAlerts(weekId: string): Promise<DbNonGoalAlert[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT a.* FROM non_goal_alerts a
      JOIN non_goals ng ON a.non_goal_id = ng.id
      WHERE ng.week_id = ? AND a.acknowledged = 0
      ORDER BY a.detected_at DESC
    `,
    args: [weekId],
  });

  return result.rows as unknown as DbNonGoalAlert[];
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: number): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: `UPDATE non_goal_alerts SET acknowledged = 1 WHERE id = ?`,
    args: [alertId],
  });
}

// ============================================================================
// Goal Creation
// ============================================================================

/**
 * Parameters for creating a new goal
 */
export interface CreateGoalParams {
  weekId: string;
  title: string;
  colorId?: string | null;
  estimatedMinutes?: number | null;
  notes?: string | null;
  goalType?: "time" | "outcome" | "habit";
}

/**
 * Generate a unique things3_id for webapp-created goals
 */
function generateWebappThings3Id(): string {
  return `webapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate composite goal ID
 */
function generateGoalId(things3Id: string, weekId: string): string {
  return `${things3Id}:${weekId}`;
}

/**
 * Create a new weekly goal
 */
export async function createGoal(params: CreateGoalParams): Promise<DbWeeklyGoal> {
  const db = getDb();
  const now = new Date().toISOString();
  const things3Id = generateWebappThings3Id();
  const id = generateGoalId(things3Id, params.weekId);

  await db.execute({
    sql: `
      INSERT INTO weekly_goals (
        id, things3_id, week_id, title, notes, estimated_minutes,
        goal_type, color_id, status, progress_percent, completed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      things3Id,
      params.weekId,
      params.title,
      params.notes ?? null,
      params.estimatedMinutes ?? null,
      params.goalType ?? "outcome",
      params.colorId ?? null,
      "active",
      0,
      null,
      now,
      now,
    ],
  });

  const created = await getGoalById(id);
  if (!created) {
    throw new Error("Failed to create goal");
  }
  return created;
}

// ============================================================================
// Non-Goal Creation
// ============================================================================

/**
 * Parameters for creating a new non-goal
 */
export interface CreateNonGoalParams {
  weekId: string;
  title: string;
  pattern?: string | null;
  colorId?: string | null;
  reason?: string | null;
}

/**
 * Create a new non-goal
 */
export async function createNonGoal(params: CreateNonGoalParams): Promise<DbNonGoal> {
  const db = getDb();
  const now = new Date().toISOString();
  // Add random suffix to ensure uniqueness even within same millisecond
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = `ng-${params.weekId}-${Date.now()}-${randomSuffix}`;

  await db.execute({
    sql: `
      INSERT INTO non_goals (id, week_id, title, pattern, color_id, reason, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      params.weekId,
      params.title,
      params.pattern ?? ".*",
      params.colorId ?? null,
      params.reason ?? null,
      1,
      now,
    ],
  });

  const created = await getNonGoalById(id);
  if (!created) {
    throw new Error("Failed to create non-goal");
  }
  return created;
}

/**
 * Get a single non-goal by ID
 */
export async function getNonGoalById(nonGoalId: string): Promise<DbNonGoal | null> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM non_goals WHERE id = ?`,
    args: [nonGoalId],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as DbNonGoal;
}

// ============================================================================
// Week Utilities
// ============================================================================

/**
 * Parse a week ID into year and week number
 */
export function parseWeekId(weekId: string): { year: number; week: number } {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week ID format: ${weekId}. Expected "YYYY-WWW" (e.g., "2026-W14")`);
  }
  return {
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10),
  };
}

/**
 * Get the date range (Monday-Sunday) for a week ID
 * Returns dates in YYYY-MM-DD format for database queries
 */
export function getWeekDateRange(weekId: string): { startDate: string; endDate: string } {
  const { year, week } = parseWeekId(weekId);

  // ISO week 1 is the week containing the first Thursday of the year
  // Which is also the week containing January 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Make Sunday = 7

  // Start of week 1 (Monday)
  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Start of requested week (Monday)
  const weekStart = new Date(week1Start);
  weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);

  // End of requested week (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return { startDate: formatDate(weekStart), endDate: formatDate(weekEnd) };
}

// ============================================================================
// Goal Progress
// ============================================================================

/**
 * Goal progress record from database
 */
export interface DbGoalProgress {
  id: number;
  goal_id: string;
  event_id: string;
  matched_at: string;
  match_type: "auto" | "manual";
  match_confidence: number | null;
  minutes_contributed: number;
}

/**
 * Record goal progress (link event to goal)
 */
export async function recordGoalProgress(params: {
  goalId: string;
  eventId: string;
  matchType: "auto" | "manual";
  matchConfidence: number | null;
  minutesContributed: number;
}): Promise<DbGoalProgress> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT OR REPLACE INTO goal_progress (
        goal_id, event_id, matched_at, match_type, match_confidence, minutes_contributed
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      params.goalId,
      params.eventId,
      now,
      params.matchType,
      params.matchConfidence,
      params.minutesContributed,
    ],
  });

  const result = await db.execute({
    sql: `SELECT * FROM goal_progress WHERE goal_id = ? AND event_id = ?`,
    args: [params.goalId, params.eventId],
  });

  return result.rows[0] as unknown as DbGoalProgress;
}

/**
 * Get all progress records for a goal
 */
export async function getProgressRecordsForGoal(goalId: string): Promise<DbGoalProgress[]> {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY matched_at`,
    args: [goalId],
  });

  return result.rows as unknown as DbGoalProgress[];
}

/**
 * Recalculate and update goal progress percentage
 */
export async function recalculateGoalProgress(goalId: string): Promise<number> {
  const db = getDb();

  // Get total minutes contributed
  const totalResult = await db.execute({
    sql: `SELECT SUM(minutes_contributed) as total FROM goal_progress WHERE goal_id = ?`,
    args: [goalId],
  });
  const totalMinutes = (totalResult.rows[0]?.total as number) || 0;

  // Get goal's estimated minutes
  const goal = await getGoalById(goalId);
  if (!goal) return 0;

  let progressPercent = 0;
  if (goal.estimated_minutes && goal.estimated_minutes > 0) {
    progressPercent = Math.min(100, Math.round((totalMinutes / goal.estimated_minutes) * 100));
  } else if (totalMinutes > 0) {
    // If no estimate, any progress is 100%
    progressPercent = 100;
  }

  // Update the goal
  await db.execute({
    sql: `UPDATE weekly_goals SET progress_percent = ?, updated_at = ? WHERE id = ?`,
    args: [progressPercent, new Date().toISOString(), goalId],
  });

  return progressPercent;
}
