/**
 * Calendar Database Module
 *
 * SQLite/Turso database for storing calendar events, daily summaries,
 * and change logs for historical tracking and visualization.
 *
 * Supports:
 * - Turso cloud database (production)
 * - Local SQLite file (development)
 * - In-memory SQLite (testing)
 */

import { createClient, Client, InStatement } from "@libsql/client";
import * as path from "path";
import * as fs from "fs";
import type { CalendarEvent, DailySummary, ColorSummary } from "./time-analysis.js";
import type { CalendarType } from "./calendar-filter.js";

// Database location
const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_DB_PATH = path.join(DATA_DIR, "calendar.db");
const CONFIG_DIR = path.join(process.cwd(), "config");
const TURSO_CONFIG_PATH = path.join(CONFIG_DIR, "turso.json");

// Database client instance
let client: Client | null = null;
let currentDbPath: string = "";

interface TursoConfig {
  url: string;
  authToken: string;
}

/**
 * Load Turso configuration from config file
 */
function loadTursoConfig(): TursoConfig | null {
  if (!fs.existsSync(TURSO_CONFIG_PATH)) {
    return null;
  }
  try {
    const content = fs.readFileSync(TURSO_CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Event record stored in the database
 */
export interface StoredEvent {
  id: string; // Composite: google_event_id + date
  google_event_id: string;
  date: string; // YYYY-MM-DD
  account: string;
  calendar_name: string;
  calendar_type: CalendarType;
  summary: string;
  description: string | null;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  duration_minutes: number;
  color_id: string;
  color_name: string;
  color_meaning: string;
  is_all_day: number; // 0 or 1
  is_recurring: number; // 0 or 1
  recurring_event_id: string | null;
  first_seen: string; // ISO timestamp
  last_seen: string; // ISO timestamp
  attended: string; // 'attended', 'skipped', 'unknown'
}

/**
 * Daily summary record stored in the database
 */
export interface StoredDailySummary {
  date: string; // YYYY-MM-DD (PRIMARY KEY)
  total_scheduled_minutes: number;
  total_gap_minutes: number;
  categories_json: string; // JSON array of ColorSummary
  is_work_day: number; // 0 or 1
  analysis_hours_start: number;
  analysis_hours_end: number;
  snapshot_time: string; // ISO timestamp
}

/**
 * Event change record for tracking modifications
 */
export interface EventChange {
  id?: number; // AUTO INCREMENT
  event_id: string;
  google_event_id: string;
  change_type: "added" | "removed" | "modified";
  change_time: string; // ISO timestamp
  old_value_json: string | null;
  new_value_json: string | null;
  field_changed: string | null; // e.g., "summary", "start_time", etc.
}

/**
 * User preference record
 */
export interface UserPreference {
  key: string;
  value: string;
}

/**
 * Weekly goal record synced from Things 3
 */
export interface StoredWeeklyGoal {
  id: string; // Composite: things3_id + week_id
  things3_id: string;
  week_id: string; // ISO week: "2026-W14"
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
 * Non-goal (anti-pattern) record - week-scoped
 */
export interface StoredNonGoal {
  id: string;
  week_id: string; // ISO week: "2026-W14"
  title: string;
  pattern: string; // Regex pattern to match events
  color_id: string | null;
  reason: string | null;
  active: number; // 0 or 1
  created_at: string;
}

/**
 * Goal progress record linking goals to events
 */
export interface StoredGoalProgress {
  id?: number; // AUTO INCREMENT
  goal_id: string;
  event_id: string;
  matched_at: string;
  match_type: "auto" | "manual";
  match_confidence: number | null;
  minutes_contributed: number;
}

/**
 * Non-goal alert record
 */
export interface StoredNonGoalAlert {
  id?: number; // AUTO INCREMENT
  non_goal_id: string;
  event_id: string;
  detected_at: string;
  acknowledged: number; // 0 or 1
}

/**
 * Initialize the database, creating tables if they don't exist
 * @param dbPath Optional path to the database file. Use ":memory:" for in-memory testing.
 *               If not provided, uses Turso cloud if configured, otherwise local SQLite.
 */
export async function initDatabase(dbPath?: string): Promise<Client> {
  // Determine which database to use
  let requestedPath: string;
  let tursoConfig: TursoConfig | null = null;

  if (dbPath) {
    // Explicit path provided (local SQLite or :memory:)
    requestedPath = dbPath;
  } else {
    // Check for Turso config
    tursoConfig = loadTursoConfig();
    if (tursoConfig) {
      requestedPath = tursoConfig.url;
    } else {
      requestedPath = DEFAULT_DB_PATH;
    }
  }

  // If we already have a client and it's for a different path, close it first
  if (client && currentDbPath !== requestedPath) {
    client.close();
    client = null;
  }

  if (client) return client;

  currentDbPath = requestedPath;

  // Create client based on configuration
  if (tursoConfig && !dbPath) {
    // Use Turso cloud
    console.log("Connecting to Turso cloud database...");
    client = createClient({
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
  } else if (requestedPath === ":memory:") {
    // In-memory database for testing
    client = createClient({
      url: ":memory:",
    });
  } else {
    // Local SQLite file
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    client = createClient({
      url: `file:${requestedPath}`,
    });
  }

  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      google_event_id TEXT NOT NULL,
      date TEXT NOT NULL,
      account TEXT NOT NULL,
      calendar_name TEXT NOT NULL,
      calendar_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      color_id TEXT NOT NULL,
      color_name TEXT NOT NULL,
      color_meaning TEXT NOT NULL,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurring_event_id TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      attended TEXT NOT NULL DEFAULT 'unknown'
    );

    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_events_google_id ON events(google_event_id);
    CREATE INDEX IF NOT EXISTS idx_events_account ON events(account);

    CREATE TABLE IF NOT EXISTS daily_summaries (
      date TEXT PRIMARY KEY,
      total_scheduled_minutes INTEGER NOT NULL,
      total_gap_minutes INTEGER NOT NULL,
      categories_json TEXT NOT NULL,
      is_work_day INTEGER NOT NULL DEFAULT 1,
      analysis_hours_start INTEGER NOT NULL,
      analysis_hours_end INTEGER NOT NULL,
      snapshot_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      google_event_id TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('added', 'removed', 'modified')),
      change_time TEXT NOT NULL,
      old_value_json TEXT,
      new_value_json TEXT,
      field_changed TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_changes_time ON event_changes(change_time);
    CREATE INDEX IF NOT EXISTS idx_changes_event ON event_changes(event_id);
    CREATE INDEX IF NOT EXISTS idx_changes_type ON event_changes(change_type);

    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Weekly goals synced from Things 3
    CREATE TABLE IF NOT EXISTS weekly_goals (
      id TEXT PRIMARY KEY,
      things3_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      estimated_minutes INTEGER,
      goal_type TEXT NOT NULL CHECK(goal_type IN ('time', 'outcome', 'habit')),
      color_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      progress_percent INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(things3_id, week_id)
    );

    CREATE INDEX IF NOT EXISTS idx_goals_week ON weekly_goals(week_id);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON weekly_goals(status);
    CREATE INDEX IF NOT EXISTS idx_goals_things3 ON weekly_goals(things3_id);

    -- Non-goals (anti-patterns) - week-scoped
    CREATE TABLE IF NOT EXISTS non_goals (
      id TEXT PRIMARY KEY,
      week_id TEXT NOT NULL,
      title TEXT NOT NULL,
      pattern TEXT NOT NULL,
      color_id TEXT,
      reason TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_non_goals_week ON non_goals(week_id);
    CREATE INDEX IF NOT EXISTS idx_non_goals_active ON non_goals(active);

    -- Goal-to-event matching for progress tracking
    CREATE TABLE IF NOT EXISTS goal_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      matched_at TEXT NOT NULL,
      match_type TEXT NOT NULL CHECK(match_type IN ('auto', 'manual')),
      match_confidence REAL,
      minutes_contributed INTEGER NOT NULL,
      UNIQUE(goal_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_progress_goal ON goal_progress(goal_id);
    CREATE INDEX IF NOT EXISTS idx_progress_event ON goal_progress(event_id);

    -- Alerts when events match non-goals
    CREATE TABLE IF NOT EXISTS non_goal_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      non_goal_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      UNIQUE(non_goal_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_non_goal ON non_goal_alerts(non_goal_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON non_goal_alerts(acknowledged);
  `);

  return client;
}

/**
 * Get the database client
 */
export async function getDatabase(): Promise<Client> {
  if (!client) {
    return initDatabase();
  }
  return client;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (client) {
    client.close();
    client = null;
    currentDbPath = "";
  }
}

/**
 * Generate a composite ID for an event (google_event_id + date)
 */
function generateEventId(googleEventId: string, date: string): string {
  return `${googleEventId}:${date}`;
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Convert a CalendarEvent to a StoredEvent
 */
function calendarEventToStored(event: CalendarEvent, now: string): StoredEvent {
  const date = formatDateKey(event.start);
  return {
    id: generateEventId(event.id, date),
    google_event_id: event.id,
    date,
    account: event.account,
    calendar_name: event.calendarName,
    calendar_type: event.calendarType,
    summary: event.summary,
    description: event.description || null,
    start_time: event.start.toISOString(),
    end_time: event.end.toISOString(),
    duration_minutes: event.durationMinutes,
    color_id: event.colorId,
    color_name: event.colorName,
    color_meaning: event.colorMeaning,
    is_all_day: event.isAllDay ? 1 : 0,
    is_recurring: event.isRecurring ? 1 : 0,
    recurring_event_id: event.recurringEventId,
    first_seen: now,
    last_seen: now,
    attended: "unknown",
  };
}

/**
 * Convert a StoredEvent to a CalendarEvent
 */
export function storedEventToCalendar(stored: StoredEvent): CalendarEvent {
  return {
    id: stored.google_event_id,
    account: stored.account,
    calendarName: stored.calendar_name,
    calendarType: stored.calendar_type as CalendarType,
    summary: stored.summary,
    description: stored.description || undefined,
    start: new Date(stored.start_time),
    end: new Date(stored.end_time),
    durationMinutes: stored.duration_minutes,
    colorId: stored.color_id,
    colorName: stored.color_name,
    colorMeaning: stored.color_meaning,
    isAllDay: stored.is_all_day === 1,
    isRecurring: stored.is_recurring === 1,
    recurringEventId: stored.recurring_event_id,
  };
}

/**
 * Convert a libsql row to StoredEvent
 */
function rowToStoredEvent(row: Record<string, unknown>): StoredEvent {
  return {
    id: row.id as string,
    google_event_id: row.google_event_id as string,
    date: row.date as string,
    account: row.account as string,
    calendar_name: row.calendar_name as string,
    calendar_type: row.calendar_type as CalendarType,
    summary: row.summary as string,
    description: row.description as string | null,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    duration_minutes: row.duration_minutes as number,
    color_id: row.color_id as string,
    color_name: row.color_name as string,
    color_meaning: row.color_meaning as string,
    is_all_day: row.is_all_day as number,
    is_recurring: row.is_recurring as number,
    recurring_event_id: row.recurring_event_id as string | null,
    first_seen: row.first_seen as string,
    last_seen: row.last_seen as string,
    attended: (row.attended as string) || "unknown",
  };
}

/**
 * Insert or update an event in the database
 * Returns whether the event was new or modified
 */
export async function upsertEvent(
  event: CalendarEvent
): Promise<{ action: "inserted" | "updated" | "unchanged"; changes?: string[] }> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const stored = calendarEventToStored(event, now);

  // Check if event exists
  const result = await database.execute({
    sql: "SELECT * FROM events WHERE id = ?",
    args: [stored.id],
  });

  const existing = result.rows.length > 0 ? rowToStoredEvent(result.rows[0] as Record<string, unknown>) : undefined;

  if (!existing) {
    // Insert new event
    await database.execute({
      sql: `
        INSERT INTO events (
          id, google_event_id, date, account, calendar_name, calendar_type,
          summary, description, start_time, end_time, duration_minutes,
          color_id, color_name, color_meaning, is_all_day, is_recurring,
          recurring_event_id, first_seen, last_seen, attended
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        stored.id,
        stored.google_event_id,
        stored.date,
        stored.account,
        stored.calendar_name,
        stored.calendar_type,
        stored.summary,
        stored.description,
        stored.start_time,
        stored.end_time,
        stored.duration_minutes,
        stored.color_id,
        stored.color_name,
        stored.color_meaning,
        stored.is_all_day,
        stored.is_recurring,
        stored.recurring_event_id,
        stored.first_seen,
        stored.last_seen,
        stored.attended,
      ],
    });
    return { action: "inserted" };
  }

  // Check for changes
  const changes: string[] = [];
  const fieldsToCheck = [
    "summary",
    "description",
    "start_time",
    "end_time",
    "duration_minutes",
    "color_id",
    "color_name",
    "color_meaning",
    "is_all_day",
  ] as const;

  for (const field of fieldsToCheck) {
    if (existing[field] !== stored[field]) {
      changes.push(field);
    }
  }

  if (changes.length > 0) {
    // Update existing event
    await database.execute({
      sql: `
        UPDATE events SET
          summary = ?,
          description = ?,
          start_time = ?,
          end_time = ?,
          duration_minutes = ?,
          color_id = ?,
          color_name = ?,
          color_meaning = ?,
          is_all_day = ?,
          is_recurring = ?,
          recurring_event_id = ?,
          last_seen = ?
        WHERE id = ?
      `,
      args: [
        stored.summary,
        stored.description,
        stored.start_time,
        stored.end_time,
        stored.duration_minutes,
        stored.color_id,
        stored.color_name,
        stored.color_meaning,
        stored.is_all_day,
        stored.is_recurring,
        stored.recurring_event_id,
        now,
        stored.id,
      ],
    });
    return { action: "updated", changes };
  }

  // No changes, just update last_seen
  await database.execute({
    sql: "UPDATE events SET last_seen = ? WHERE id = ?",
    args: [now, stored.id],
  });
  return { action: "unchanged" };
}

/**
 * Insert or update a daily summary
 */
export async function upsertDailySummary(summary: DailySummary): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const date = formatDateKey(summary.date);

  await database.execute({
    sql: `
      INSERT OR REPLACE INTO daily_summaries (
        date, total_scheduled_minutes, total_gap_minutes,
        categories_json, is_work_day, analysis_hours_start,
        analysis_hours_end, snapshot_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      date,
      summary.totalScheduledMinutes,
      summary.totalGapMinutes,
      JSON.stringify(summary.byColor),
      summary.isWorkDay ? 1 : 0,
      summary.analysisHours.start,
      summary.analysisHours.end,
      now,
    ],
  });
}

/**
 * Log an event change
 */
export async function logEventChange(change: Omit<EventChange, "id">): Promise<void> {
  const database = await getDatabase();

  await database.execute({
    sql: `
      INSERT INTO event_changes (
        event_id, google_event_id, change_type, change_time,
        old_value_json, new_value_json, field_changed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      change.event_id,
      change.google_event_id,
      change.change_type,
      change.change_time,
      change.old_value_json,
      change.new_value_json,
      change.field_changed,
    ],
  });
}

/**
 * Get events for a date range
 */
export async function getEventsForDateRange(start: Date, end: Date): Promise<StoredEvent[]> {
  const database = await getDatabase();
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  const result = await database.execute({
    sql: `
      SELECT * FROM events
      WHERE date >= ? AND date <= ?
      ORDER BY date, start_time
    `,
    args: [startKey, endKey],
  });

  return result.rows.map((row) => rowToStoredEvent(row as Record<string, unknown>));
}

/**
 * Get events for a specific date
 */
export async function getEventsForDate(date: Date): Promise<StoredEvent[]> {
  const database = await getDatabase();
  const dateKey = formatDateKey(date);

  const result = await database.execute({
    sql: "SELECT * FROM events WHERE date = ? ORDER BY start_time",
    args: [dateKey],
  });

  return result.rows.map((row) => rowToStoredEvent(row as Record<string, unknown>));
}

/**
 * Get daily summaries for a date range
 */
export async function getDailySummaries(start: Date, end: Date): Promise<StoredDailySummary[]> {
  const database = await getDatabase();
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  const result = await database.execute({
    sql: `
      SELECT * FROM daily_summaries
      WHERE date >= ? AND date <= ?
      ORDER BY date
    `,
    args: [startKey, endKey],
  });

  return result.rows.map((row) => ({
    date: row.date as string,
    total_scheduled_minutes: row.total_scheduled_minutes as number,
    total_gap_minutes: row.total_gap_minutes as number,
    categories_json: row.categories_json as string,
    is_work_day: row.is_work_day as number,
    analysis_hours_start: row.analysis_hours_start as number,
    analysis_hours_end: row.analysis_hours_end as number,
    snapshot_time: row.snapshot_time as string,
  }));
}

/**
 * Get recent event changes
 */
export async function getRecentChanges(
  limit: number = 50,
  changeType?: "added" | "removed" | "modified"
): Promise<EventChange[]> {
  const database = await getDatabase();

  let result;
  if (changeType) {
    result = await database.execute({
      sql: `
        SELECT * FROM event_changes
        WHERE change_type = ?
        ORDER BY change_time DESC
        LIMIT ?
      `,
      args: [changeType, limit],
    });
  } else {
    result = await database.execute({
      sql: `
        SELECT * FROM event_changes
        ORDER BY change_time DESC
        LIMIT ?
      `,
      args: [limit],
    });
  }

  return result.rows.map((row) => ({
    id: row.id as number,
    event_id: row.event_id as string,
    google_event_id: row.google_event_id as string,
    change_type: row.change_type as "added" | "removed" | "modified",
    change_time: row.change_time as string,
    old_value_json: row.old_value_json as string | null,
    new_value_json: row.new_value_json as string | null,
    field_changed: row.field_changed as string | null,
  }));
}

/**
 * Get all stored event IDs for a date range
 * Used for detecting deleted events
 */
export async function getStoredEventIds(start: Date, end: Date): Promise<Set<string>> {
  const database = await getDatabase();
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  const result = await database.execute({
    sql: "SELECT id FROM events WHERE date >= ? AND date <= ?",
    args: [startKey, endKey],
  });

  return new Set(result.rows.map((r) => r.id as string));
}

/**
 * Mark an event as removed (log the removal but keep the record)
 */
export async function markEventRemoved(eventId: string): Promise<void> {
  const database = await getDatabase();

  // Get the existing event for logging
  const result = await database.execute({
    sql: "SELECT * FROM events WHERE id = ?",
    args: [eventId],
  });

  if (result.rows.length > 0) {
    const existing = rowToStoredEvent(result.rows[0] as Record<string, unknown>);
    await logEventChange({
      event_id: eventId,
      google_event_id: existing.google_event_id,
      change_type: "removed",
      change_time: new Date().toISOString(),
      old_value_json: JSON.stringify(existing),
      new_value_json: null,
      field_changed: null,
    });
  }

  // Delete the event from the main table
  await database.execute({
    sql: "DELETE FROM events WHERE id = ?",
    args: [eventId],
  });
}

/**
 * Get aggregate statistics for a date range
 */
export async function getAggregateStats(
  start: Date,
  end: Date
): Promise<{
  totalDays: number;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  byCategory: Map<string, { minutes: number; count: number }>;
}> {
  const summaries = await getDailySummaries(start, end);
  const byCategory = new Map<string, { minutes: number; count: number }>();

  let totalScheduled = 0;
  let totalGap = 0;

  for (const summary of summaries) {
    totalScheduled += summary.total_scheduled_minutes;
    totalGap += summary.total_gap_minutes;

    const categories = JSON.parse(summary.categories_json) as ColorSummary[];
    for (const cat of categories) {
      const existing = byCategory.get(cat.colorId) || { minutes: 0, count: 0 };
      byCategory.set(cat.colorId, {
        minutes: existing.minutes + cat.totalMinutes,
        count: existing.count + cat.eventCount,
      });
    }
  }

  return {
    totalDays: summaries.length,
    totalScheduledMinutes: totalScheduled,
    totalGapMinutes: totalGap,
    byCategory,
  };
}

/**
 * Get change statistics for a date range
 */
export async function getChangeStats(
  start: Date,
  end: Date
): Promise<{
  added: number;
  removed: number;
  modified: number;
}> {
  const database = await getDatabase();
  const startKey = start.toISOString();
  const endKey = end.toISOString();

  const result = await database.execute({
    sql: `
      SELECT change_type, COUNT(*) as count
      FROM event_changes
      WHERE change_time >= ? AND change_time <= ?
      GROUP BY change_type
    `,
    args: [startKey, endKey],
  });

  const stats = { added: 0, removed: 0, modified: 0 };
  for (const row of result.rows) {
    const changeType = row.change_type as string;
    const count = row.count as number;
    if (changeType === "added") stats.added = count;
    if (changeType === "removed") stats.removed = count;
    if (changeType === "modified") stats.modified = count;
  }

  return stats;
}

/**
 * Update event attendance status
 */
export async function updateEventAttendance(
  eventId: string,
  attended: "attended" | "skipped" | "unknown"
): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "UPDATE events SET attended = ? WHERE id = ?",
    args: [attended, eventId],
  });
}

/**
 * Get user preference
 */
export async function getPreference(key: string): Promise<string | null> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT value FROM user_preferences WHERE key = ?",
    args: [key],
  });
  return result.rows.length > 0 ? (result.rows[0].value as string) : null;
}

/**
 * Set user preference
 */
export async function setPreference(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)",
    args: [key, value],
  });
}

/**
 * Get all user preferences
 */
export async function getAllPreferences(): Promise<Record<string, string>> {
  const database = await getDatabase();
  const result = await database.execute("SELECT key, value FROM user_preferences");
  const prefs: Record<string, string> = {};
  for (const row of result.rows) {
    prefs[row.key as string] = row.value as string;
  }
  return prefs;
}

// ============================================================================
// Weekly Goals CRUD Operations
// ============================================================================

/**
 * Convert a libsql row to StoredWeeklyGoal
 */
function rowToStoredGoal(row: Record<string, unknown>): StoredWeeklyGoal {
  return {
    id: row.id as string,
    things3_id: row.things3_id as string,
    week_id: row.week_id as string,
    title: row.title as string,
    notes: row.notes as string | null,
    estimated_minutes: row.estimated_minutes as number | null,
    goal_type: row.goal_type as "time" | "outcome" | "habit",
    color_id: row.color_id as string | null,
    status: row.status as "active" | "completed" | "cancelled",
    progress_percent: row.progress_percent as number,
    completed_at: row.completed_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Generate a composite ID for a weekly goal (things3_id + week_id)
 */
function generateGoalId(things3Id: string, weekId: string): string {
  return `${things3Id}:${weekId}`;
}

/**
 * Get goals for a specific week
 */
export async function getGoalsForWeek(weekId: string): Promise<StoredWeeklyGoal[]> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT * FROM weekly_goals WHERE week_id = ? ORDER BY created_at",
    args: [weekId],
  });
  return result.rows.map((row) => rowToStoredGoal(row as Record<string, unknown>));
}

/**
 * Get a single goal by ID
 */
export async function getGoalById(goalId: string): Promise<StoredWeeklyGoal | null> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT * FROM weekly_goals WHERE id = ?",
    args: [goalId],
  });
  return result.rows.length > 0 ? rowToStoredGoal(result.rows[0] as Record<string, unknown>) : null;
}

/**
 * Insert or update a weekly goal
 */
export async function upsertWeeklyGoal(
  goal: Omit<StoredWeeklyGoal, "id" | "created_at" | "updated_at">
): Promise<StoredWeeklyGoal> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const id = generateGoalId(goal.things3_id, goal.week_id);

  // Check if goal exists
  const existing = await getGoalById(id);

  if (!existing) {
    // Insert new goal
    await database.execute({
      sql: `
        INSERT INTO weekly_goals (
          id, things3_id, week_id, title, notes, estimated_minutes,
          goal_type, color_id, status, progress_percent, completed_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        goal.things3_id,
        goal.week_id,
        goal.title,
        goal.notes,
        goal.estimated_minutes,
        goal.goal_type,
        goal.color_id,
        goal.status,
        goal.progress_percent,
        goal.completed_at,
        now,
        now,
      ],
    });
  } else {
    // Update existing goal
    await database.execute({
      sql: `
        UPDATE weekly_goals SET
          title = ?, notes = ?, estimated_minutes = ?, goal_type = ?,
          color_id = ?, status = ?, progress_percent = ?, completed_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        goal.title,
        goal.notes,
        goal.estimated_minutes,
        goal.goal_type,
        goal.color_id,
        goal.status,
        goal.progress_percent,
        goal.completed_at,
        now,
        id,
      ],
    });
  }

  return (await getGoalById(id))!;
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(goalId: string, progressPercent: number): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.execute({
    sql: "UPDATE weekly_goals SET progress_percent = ?, updated_at = ? WHERE id = ?",
    args: [progressPercent, now, goalId],
  });
}

/**
 * Update goal status
 */
export async function updateGoalStatus(
  goalId: string,
  status: "active" | "completed" | "cancelled"
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const completedAt = status === "completed" ? now : null;

  await database.execute({
    sql: "UPDATE weekly_goals SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    args: [status, completedAt, now, goalId],
  });
}

/**
 * Delete a weekly goal
 */
export async function deleteWeeklyGoal(goalId: string): Promise<void> {
  const database = await getDatabase();
  // Also delete associated progress records
  await database.execute({
    sql: "DELETE FROM goal_progress WHERE goal_id = ?",
    args: [goalId],
  });
  await database.execute({
    sql: "DELETE FROM weekly_goals WHERE id = ?",
    args: [goalId],
  });
}

// ============================================================================
// Non-Goals CRUD Operations
// ============================================================================

/**
 * Convert a libsql row to StoredNonGoal
 */
function rowToStoredNonGoal(row: Record<string, unknown>): StoredNonGoal {
  return {
    id: row.id as string,
    week_id: row.week_id as string,
    title: row.title as string,
    pattern: row.pattern as string,
    color_id: row.color_id as string | null,
    reason: row.reason as string | null,
    active: row.active as number,
    created_at: row.created_at as string,
  };
}

/**
 * Get non-goals for a specific week
 */
export async function getNonGoalsForWeek(weekId: string): Promise<StoredNonGoal[]> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT * FROM non_goals WHERE week_id = ? AND active = 1 ORDER BY created_at",
    args: [weekId],
  });
  return result.rows.map((row) => rowToStoredNonGoal(row as Record<string, unknown>));
}

/**
 * Get a single non-goal by ID
 */
export async function getNonGoalById(nonGoalId: string): Promise<StoredNonGoal | null> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT * FROM non_goals WHERE id = ?",
    args: [nonGoalId],
  });
  return result.rows.length > 0 ? rowToStoredNonGoal(result.rows[0] as Record<string, unknown>) : null;
}

/**
 * Create a new non-goal
 */
export async function createNonGoal(
  nonGoal: Omit<StoredNonGoal, "id" | "created_at">
): Promise<StoredNonGoal> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  // Add random suffix to ensure uniqueness even within same millisecond
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = `ng-${nonGoal.week_id}-${Date.now()}-${randomSuffix}`;

  await database.execute({
    sql: `
      INSERT INTO non_goals (id, week_id, title, pattern, color_id, reason, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      nonGoal.week_id,
      nonGoal.title,
      nonGoal.pattern,
      nonGoal.color_id,
      nonGoal.reason,
      nonGoal.active,
      now,
    ],
  });

  return (await getNonGoalById(id))!;
}

/**
 * Update a non-goal
 */
export async function updateNonGoal(
  nonGoalId: string,
  updates: Partial<Omit<StoredNonGoal, "id" | "week_id" | "created_at">>
): Promise<void> {
  const database = await getDatabase();
  const existing = await getNonGoalById(nonGoalId);
  if (!existing) return;

  await database.execute({
    sql: `
      UPDATE non_goals SET
        title = ?, pattern = ?, color_id = ?, reason = ?, active = ?
      WHERE id = ?
    `,
    args: [
      updates.title ?? existing.title,
      updates.pattern ?? existing.pattern,
      updates.color_id ?? existing.color_id,
      updates.reason ?? existing.reason,
      updates.active ?? existing.active,
      nonGoalId,
    ],
  });
}

/**
 * Delete a non-goal (also deletes associated alerts)
 */
export async function deleteNonGoal(nonGoalId: string): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "DELETE FROM non_goal_alerts WHERE non_goal_id = ?",
    args: [nonGoalId],
  });
  await database.execute({
    sql: "DELETE FROM non_goals WHERE id = ?",
    args: [nonGoalId],
  });
}

// ============================================================================
// Goal Progress CRUD Operations
// ============================================================================

/**
 * Convert a libsql row to StoredGoalProgress
 */
function rowToStoredProgress(row: Record<string, unknown>): StoredGoalProgress {
  return {
    id: row.id as number,
    goal_id: row.goal_id as string,
    event_id: row.event_id as string,
    matched_at: row.matched_at as string,
    match_type: row.match_type as "auto" | "manual",
    match_confidence: row.match_confidence as number | null,
    minutes_contributed: row.minutes_contributed as number,
  };
}

/**
 * Get all progress records for a goal
 */
export async function getProgressForGoal(goalId: string): Promise<StoredGoalProgress[]> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT * FROM goal_progress WHERE goal_id = ? ORDER BY matched_at",
    args: [goalId],
  });
  return result.rows.map((row) => rowToStoredProgress(row as Record<string, unknown>));
}

/**
 * Record progress (link an event to a goal)
 */
export async function recordGoalProgress(
  progress: Omit<StoredGoalProgress, "id">
): Promise<StoredGoalProgress> {
  const database = await getDatabase();

  await database.execute({
    sql: `
      INSERT OR REPLACE INTO goal_progress (
        goal_id, event_id, matched_at, match_type, match_confidence, minutes_contributed
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      progress.goal_id,
      progress.event_id,
      progress.matched_at,
      progress.match_type,
      progress.match_confidence,
      progress.minutes_contributed,
    ],
  });

  // Get the inserted/updated record
  const result = await database.execute({
    sql: "SELECT * FROM goal_progress WHERE goal_id = ? AND event_id = ?",
    args: [progress.goal_id, progress.event_id],
  });

  return rowToStoredProgress(result.rows[0] as Record<string, unknown>);
}

/**
 * Remove progress record
 */
export async function removeGoalProgress(goalId: string, eventId: string): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "DELETE FROM goal_progress WHERE goal_id = ? AND event_id = ?",
    args: [goalId, eventId],
  });
}

/**
 * Calculate total minutes contributed to a goal
 */
export async function calculateGoalTotalMinutes(goalId: string): Promise<number> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: "SELECT SUM(minutes_contributed) as total FROM goal_progress WHERE goal_id = ?",
    args: [goalId],
  });
  return (result.rows[0]?.total as number) || 0;
}

// ============================================================================
// Non-Goal Alerts CRUD Operations
// ============================================================================

/**
 * Convert a libsql row to StoredNonGoalAlert
 */
function rowToStoredAlert(row: Record<string, unknown>): StoredNonGoalAlert {
  return {
    id: row.id as number,
    non_goal_id: row.non_goal_id as string,
    event_id: row.event_id as string,
    detected_at: row.detected_at as string,
    acknowledged: row.acknowledged as number,
  };
}

/**
 * Get unacknowledged alerts for a week
 */
export async function getUnacknowledgedAlerts(weekId: string): Promise<StoredNonGoalAlert[]> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: `
      SELECT a.* FROM non_goal_alerts a
      JOIN non_goals ng ON a.non_goal_id = ng.id
      WHERE ng.week_id = ? AND a.acknowledged = 0
      ORDER BY a.detected_at DESC
    `,
    args: [weekId],
  });
  return result.rows.map((row) => rowToStoredAlert(row as Record<string, unknown>));
}

/**
 * Get all alerts for a week (including acknowledged)
 */
export async function getAllAlertsForWeek(weekId: string): Promise<StoredNonGoalAlert[]> {
  const database = await getDatabase();
  const result = await database.execute({
    sql: `
      SELECT a.* FROM non_goal_alerts a
      JOIN non_goals ng ON a.non_goal_id = ng.id
      WHERE ng.week_id = ?
      ORDER BY a.detected_at DESC
    `,
    args: [weekId],
  });
  return result.rows.map((row) => rowToStoredAlert(row as Record<string, unknown>));
}

/**
 * Create a non-goal alert
 */
export async function createNonGoalAlert(
  alert: Omit<StoredNonGoalAlert, "id">
): Promise<StoredNonGoalAlert> {
  const database = await getDatabase();

  await database.execute({
    sql: `
      INSERT OR IGNORE INTO non_goal_alerts (non_goal_id, event_id, detected_at, acknowledged)
      VALUES (?, ?, ?, ?)
    `,
    args: [alert.non_goal_id, alert.event_id, alert.detected_at, alert.acknowledged],
  });

  // Get the inserted record
  const result = await database.execute({
    sql: "SELECT * FROM non_goal_alerts WHERE non_goal_id = ? AND event_id = ?",
    args: [alert.non_goal_id, alert.event_id],
  });

  return rowToStoredAlert(result.rows[0] as Record<string, unknown>);
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: number): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "UPDATE non_goal_alerts SET acknowledged = 1 WHERE id = ?",
    args: [alertId],
  });
}

/**
 * Delete an alert
 */
export async function deleteAlert(alertId: number): Promise<void> {
  const database = await getDatabase();
  await database.execute({
    sql: "DELETE FROM non_goal_alerts WHERE id = ?",
    args: [alertId],
  });
}
