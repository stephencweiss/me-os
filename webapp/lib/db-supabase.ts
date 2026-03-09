/**
 * Supabase Database Client for Multi-Tenant Webapp
 *
 * Connects to Supabase Postgres for reading/writing calendar and goals data.
 * All functions require userId parameter for multi-tenant data isolation.
 *
 * Note: While Postgres has RLS policies configured, we use service role key
 * with explicit user_id filtering since NextAuth manages auth separately
 * from Supabase Auth. This provides defense-in-depth.
 */

import { createServerClient } from "./supabase-server";
import type {
  Database,
  Event,
  EventUpdate,
  DailySummary,
  WeeklyGoal,
  WeeklyGoalUpdate,
  WeeklyGoalInsert,
  NonGoal,
  NonGoalInsert,
  GoalProgress,
  GoalProgressInsert,
  NonGoalAlert,
  NonGoalAlertUpdate,
  UserPreferenceInsert,
  Json,
} from "./database.types";

// ============================================================================
// Types (re-exported for compatibility with existing code)
// ============================================================================

export type DbEvent = Event;
export type DbDailySummary = DailySummary;
export type DbWeeklyGoal = WeeklyGoal;
export type DbNonGoal = NonGoal;
export type DbGoalProgress = GoalProgress;
export type DbNonGoalAlert = NonGoalAlert;

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
 * Computed summary for a single day (used when filtering)
 */
export interface ComputedDailySummary {
  date: string;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  categories: Category[];
  isWorkDay: boolean;
}

// ============================================================================
// Color Definitions
// ============================================================================

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

// ============================================================================
// Events
// ============================================================================

/**
 * Get events for a date range
 */
export async function getEvents(
  userId: string,
  startDate: string,
  endDate: string,
  options?: {
    calendars?: string[];
    accounts?: string[];
    attended?: string[];
    uncategorized?: boolean;
  }
): Promise<Event[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("events") as any)
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (options?.calendars && options.calendars.length > 0) {
    query = query.in("calendar_name", options.calendars);
  }

  if (options?.accounts && options.accounts.length > 0) {
    query = query.in("account", options.accounts);
  }

  if (options?.attended && options.attended.length > 0) {
    query = query.in("attended", options.attended);
  }

  if (options?.uncategorized) {
    query = query.or("color_id.eq.default,color_id.eq.,color_id.is.null");
  }

  const { data, error } = await query.order("date", { ascending: false }).order("start_time");

  if (error) {
    throw new Error(`Failed to get events: ${error.message}`);
  }

  return (data || []) as Event[];
}

/**
 * Get a single event by ID
 */
export async function getEventById(userId: string, eventId: string): Promise<Event | null> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("events") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("id", eventId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    throw new Error(`Failed to get event: ${error.message}`);
  }

  return data as Event | null;
}

/**
 * Update event attendance status
 */
export async function updateAttendance(
  userId: string,
  eventId: string,
  attended: "attended" | "skipped" | "unknown"
): Promise<void> {
  const supabase = createServerClient();

  const updateData: EventUpdate = {
    attended,
    last_seen: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("events") as any)
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", eventId);

  if (error) {
    throw new Error(`Failed to update attendance: ${error.message}`);
  }
}

/**
 * Update event color
 */
export async function updateEventColor(
  userId: string,
  eventId: string,
  colorId: string
): Promise<Event | null> {
  const colorDef = COLOR_DEFINITIONS[colorId];
  if (!colorDef) {
    throw new Error(`Invalid color ID: ${colorId}`);
  }

  const supabase = createServerClient();

  const updateData: EventUpdate = {
    color_id: colorId,
    color_name: colorDef.name,
    color_meaning: colorDef.meaning,
    last_seen: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("events") as any)
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", eventId);

  if (error) {
    throw new Error(`Failed to update event color: ${error.message}`);
  }

  return getEventById(userId, eventId);
}

// ============================================================================
// Calendars and Accounts
// ============================================================================

/**
 * Get distinct calendars
 */
export async function getCalendars(
  userId: string
): Promise<{ calendar_name: string; account: string }[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("events") as any)
    .select("calendar_name, account")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to get calendars: ${error.message}`);
  }

  // Get distinct combinations
  const seen = new Set<string>();
  const calendars: { calendar_name: string; account: string }[] = [];

  for (const row of (data || []) as { calendar_name: string; account: string }[]) {
    const key = `${row.account}:${row.calendar_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      calendars.push({ calendar_name: row.calendar_name, account: row.account });
    }
  }

  return calendars.sort((a, b) =>
    a.account.localeCompare(b.account) || a.calendar_name.localeCompare(b.calendar_name)
  );
}

/**
 * Get distinct accounts
 */
export async function getAccounts(userId: string): Promise<string[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("events") as any)
    .select("account")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to get accounts: ${error.message}`);
  }

  const rows = (data || []) as { account: string }[];
  const accounts = [...new Set(rows.map((row) => row.account))];
  return accounts.sort();
}

// ============================================================================
// Daily Summaries
// ============================================================================

/**
 * Get daily summaries for a date range
 */
export async function getDailySummaries(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailySummary[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("daily_summaries") as any)
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to get daily summaries: ${error.message}`);
  }

  return (data || []) as DailySummary[];
}

/**
 * Compute summaries from events on-the-fly (used when filters are applied)
 */
export async function computeSummariesFromEvents(
  userId: string,
  startDate: string,
  endDate: string,
  options?: { accounts?: string[]; calendars?: string[] }
): Promise<{ summaries: ComputedDailySummary[] }> {
  // 1. Fetch filtered events
  const events = await getEvents(userId, startDate, endDate, options);

  // 2. Group events by date
  const eventsByDate = new Map<string, Event[]>();
  for (const event of events) {
    const existing = eventsByDate.get(event.date) || [];
    existing.push(event);
    eventsByDate.set(event.date, existing);
  }

  // 3. Compute summary for each date
  const summaries: ComputedDailySummary[] = [];
  for (const [date, dayEvents] of eventsByDate) {
    const totalScheduledMinutes = dayEvents.reduce(
      (sum, e) => sum + e.duration_minutes,
      0
    );

    // Group by color
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

    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;

    summaries.push({
      date,
      totalScheduledMinutes,
      totalGapMinutes: 0,
      categories,
      isWorkDay,
    });
  }

  summaries.sort((a, b) => b.date.localeCompare(a.date));
  return { summaries };
}

// ============================================================================
// User Preferences
// ============================================================================

/**
 * Get user preference
 */
export async function getPreference(userId: string, key: string): Promise<string | null> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("user_preferences") as any)
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get preference: ${error.message}`);
  }

  return (data as { value: string } | null)?.value ?? null;
}

/**
 * Set user preference
 */
export async function setPreference(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const supabase = createServerClient();

  const upsertData: UserPreferenceInsert = {
    user_id: userId,
    key,
    value,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("user_preferences") as any).upsert(upsertData, {
    onConflict: "user_id,key",
  });

  if (error) {
    throw new Error(`Failed to set preference: ${error.message}`);
  }
}

/**
 * Get all preferences
 */
export async function getAllPreferences(userId: string): Promise<Record<string, string>> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("user_preferences") as any)
    .select("key, value")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to get preferences: ${error.message}`);
  }

  const prefs: Record<string, string> = {};
  for (const row of (data || []) as { key: string; value: string }[]) {
    prefs[row.key] = row.value;
  }

  return prefs;
}

// ============================================================================
// Weekly Goals
// ============================================================================

/**
 * Get goals for a week
 */
export async function getGoalsForWeek(userId: string, weekId: string): Promise<WeeklyGoal[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("weekly_goals") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to get goals: ${error.message}`);
  }

  return (data || []) as WeeklyGoal[];
}

/**
 * Get a single goal by ID
 */
export async function getGoalById(userId: string, goalId: string): Promise<WeeklyGoal | null> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("weekly_goals") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("id", goalId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get goal: ${error.message}`);
  }

  return data as WeeklyGoal | null;
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  userId: string,
  goalId: string,
  progressPercent: number
): Promise<void> {
  const supabase = createServerClient();

  const updateData: WeeklyGoalUpdate = {
    progress_percent: progressPercent,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("weekly_goals") as any)
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", goalId);

  if (error) {
    throw new Error(`Failed to update goal progress: ${error.message}`);
  }
}

/**
 * Update goal status
 */
export async function updateGoalStatus(
  userId: string,
  goalId: string,
  status: "active" | "completed" | "cancelled"
): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  const updateData: WeeklyGoalUpdate = {
    status,
    completed_at: status === "completed" ? now : null,
    updated_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("weekly_goals") as any)
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", goalId);

  if (error) {
    throw new Error(`Failed to update goal status: ${error.message}`);
  }
}

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
 * Create a new weekly goal
 */
export async function createGoal(
  userId: string,
  params: CreateGoalParams
): Promise<WeeklyGoal> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = `goal-${params.weekId}-${Date.now()}-${randomSuffix}`;

  const insertData: WeeklyGoalInsert = {
    id,
    user_id: userId,
    week_id: params.weekId,
    title: params.title,
    notes: params.notes ?? null,
    estimated_minutes: params.estimatedMinutes ?? null,
    goal_type: params.goalType ?? "outcome",
    color_id: params.colorId ?? null,
    status: "active",
    progress_percent: 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("weekly_goals") as any)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create goal: ${error.message}`);
  }

  return data as WeeklyGoal;
}

// ============================================================================
// Non-Goals
// ============================================================================

/**
 * Get non-goals for a week
 */
export async function getNonGoalsForWeek(userId: string, weekId: string): Promise<NonGoal[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("non_goals") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .eq("active", true)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to get non-goals: ${error.message}`);
  }

  return (data || []) as NonGoal[];
}

/**
 * Get a single non-goal by ID
 */
export async function getNonGoalById(
  userId: string,
  nonGoalId: string
): Promise<NonGoal | null> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("non_goals") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("id", nonGoalId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get non-goal: ${error.message}`);
  }

  return data as NonGoal | null;
}

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
export async function createNonGoal(
  userId: string,
  params: CreateNonGoalParams
): Promise<NonGoal> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = `ng-${params.weekId}-${Date.now()}-${randomSuffix}`;

  const insertData: NonGoalInsert = {
    id,
    user_id: userId,
    week_id: params.weekId,
    title: params.title,
    pattern: params.pattern ?? ".*",
    color_id: params.colorId ?? null,
    reason: params.reason ?? null,
    active: true,
    created_at: now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("non_goals") as any)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create non-goal: ${error.message}`);
  }

  return data as NonGoal;
}

// ============================================================================
// Non-Goal Alerts
// ============================================================================

/**
 * Get unacknowledged alerts for a week
 */
export async function getUnacknowledgedAlerts(
  userId: string,
  weekId: string
): Promise<NonGoalAlert[]> {
  const supabase = createServerClient();

  // First get non-goal IDs for this week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nonGoals, error: ngError } = await (supabase.from("non_goals") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("week_id", weekId);

  if (ngError) {
    throw new Error(`Failed to get non-goals: ${ngError.message}`);
  }

  if (!nonGoals || nonGoals.length === 0) {
    return [];
  }

  const nonGoalIds = (nonGoals as { id: string }[]).map((ng) => ng.id);

  // Get alerts for these non-goals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("non_goal_alerts") as any)
    .select("*")
    .eq("user_id", userId)
    .in("non_goal_id", nonGoalIds)
    .eq("acknowledged", false)
    .order("detected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get alerts: ${error.message}`);
  }

  return (data || []) as NonGoalAlert[];
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(userId: string, alertId: number): Promise<void> {
  const supabase = createServerClient();

  const updateData: NonGoalAlertUpdate = {
    acknowledged: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("non_goal_alerts") as any)
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", alertId);

  if (error) {
    throw new Error(`Failed to acknowledge alert: ${error.message}`);
  }
}

// ============================================================================
// Goal Progress
// ============================================================================

/**
 * Get total progress minutes for a goal
 */
export async function getGoalProgressMinutes(userId: string, goalId: string): Promise<number> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("goal_progress") as any)
    .select("minutes_contributed")
    .eq("user_id", userId)
    .eq("goal_id", goalId);

  if (error) {
    throw new Error(`Failed to get goal progress: ${error.message}`);
  }

  const rows = (data || []) as { minutes_contributed: number }[];
  return rows.reduce((sum, row) => sum + row.minutes_contributed, 0);
}

/**
 * Record goal progress (link event to goal)
 */
export async function recordGoalProgress(
  userId: string,
  params: {
    goalId: string;
    eventId: string;
    matchType: "auto" | "manual";
    matchConfidence: number | null;
    minutesContributed: number;
  }
): Promise<GoalProgress> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  const upsertData: GoalProgressInsert = {
    user_id: userId,
    goal_id: params.goalId,
    event_id: params.eventId,
    matched_at: now,
    match_type: params.matchType,
    match_confidence: params.matchConfidence,
    minutes_contributed: params.minutesContributed,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("goal_progress") as any)
    .upsert(upsertData, {
      onConflict: "goal_id,event_id",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record goal progress: ${error.message}`);
  }

  return data as GoalProgress;
}

/**
 * Get all progress records for a goal
 */
export async function getProgressRecordsForGoal(
  userId: string,
  goalId: string
): Promise<GoalProgress[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("goal_progress") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("goal_id", goalId)
    .order("matched_at");

  if (error) {
    throw new Error(`Failed to get progress records: ${error.message}`);
  }

  return (data || []) as GoalProgress[];
}

/**
 * Recalculate and update goal progress percentage
 */
export async function recalculateGoalProgress(
  userId: string,
  goalId: string
): Promise<number> {
  const totalMinutes = await getGoalProgressMinutes(userId, goalId);
  const goal = await getGoalById(userId, goalId);

  if (!goal) return 0;

  let progressPercent = 0;
  if (goal.estimated_minutes && goal.estimated_minutes > 0) {
    progressPercent = Math.min(100, Math.round((totalMinutes / goal.estimated_minutes) * 100));
  } else if (totalMinutes > 0) {
    progressPercent = 100;
  }

  await updateGoalProgress(userId, goalId, progressPercent);
  return progressPercent;
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
 */
export function getWeekDateRange(weekId: string): { startDate: string; endDate: string } {
  const { year, week } = parseWeekId(weekId);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;

  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const weekStart = new Date(week1Start);
  weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return { startDate: formatDate(weekStart), endDate: formatDate(weekEnd) };
}
