/**
 * Weekly Goals Library
 *
 * High-level goal management functions including week utilities,
 * progress calculation, and integration helpers.
 */

import {
  getGoalsForWeek,
  getGoalById,
  upsertWeeklyGoal,
  updateGoalProgress,
  updateGoalStatus,
  getProgressForGoal,
  recordGoalProgress,
  calculateGoalTotalMinutes,
  getNonGoalsForWeek,
  createNonGoalAlert,
  getUnacknowledgedAlerts,
  getEventsForDateRange,
  type StoredWeeklyGoal,
  type StoredNonGoal,
  type StoredGoalProgress,
  type StoredNonGoalAlert,
  type StoredEvent,
} from "./calendar-db.js";

// Re-export types for convenience
export type {
  StoredWeeklyGoal,
  StoredNonGoal,
  StoredGoalProgress,
  StoredNonGoalAlert,
};

// ============================================================================
// Week ID Utilities
// ============================================================================

/**
 * Get the ISO week ID for a given date
 * Format: "YYYY-WWW" (e.g., "2026-W14")
 */
export function getWeekIdForDate(date: Date): string {
  // Create a copy to avoid mutating the input
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday = 7 instead of 0
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Get the current week ID
 */
export function getCurrentWeekId(): string {
  return getWeekIdForDate(new Date());
}

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
export function getWeekDateRange(weekId: string): { start: Date; end: Date } {
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

  // End of requested week (Sunday 23:59:59.999)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

/**
 * Convert a week ID to a Things 3 tag format
 * Things uses lowercase without hash: "w14-2026"
 */
export function weekIdToThingsTag(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  return `w${week}-${year}`;
}

/**
 * Parse a Things 3 tag to a week ID
 * Input: "w14-2026" -> Output: "2026-W14"
 */
export function thingsTagToWeekId(tag: string): string | null {
  const match = tag.match(/^w(\d{1,2})-(\d{4})$/i);
  if (!match) return null;
  const week = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Get the previous week's ID
 */
export function getPreviousWeekId(weekId: string): string {
  const { start } = getWeekDateRange(weekId);
  const prevWeekDate = new Date(start);
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  return getWeekIdForDate(prevWeekDate);
}

/**
 * Get the next week's ID
 */
export function getNextWeekId(weekId: string): string {
  const { start } = getWeekDateRange(weekId);
  const nextWeekDate = new Date(start);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  return getWeekIdForDate(nextWeekDate);
}

/**
 * Format a week ID for display
 * Example: "2026-W14" -> "Week 14, 2026 (Mar 30 - Apr 5)"
 */
export function formatWeekIdForDisplay(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  const { start, end } = getWeekDateRange(weekId);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  return `Week ${week}, ${year} (${formatDate(start)} - ${formatDate(end)})`;
}

// ============================================================================
// Goal Management
// ============================================================================

/**
 * Goal summary with computed fields
 */
export interface GoalSummary {
  goal: StoredWeeklyGoal;
  totalMinutesContributed: number;
  eventCount: number;
  isOnTrack: boolean;
  remainingMinutes: number;
}

/**
 * Get goals for a week with computed summaries
 */
export async function getWeeklyGoalSummaries(weekId: string): Promise<GoalSummary[]> {
  const goals = await getGoalsForWeek(weekId);
  const summaries: GoalSummary[] = [];

  for (const goal of goals) {
    const totalMinutes = await calculateGoalTotalMinutes(goal.id);
    const progress = await getProgressForGoal(goal.id);
    const estimatedMinutes = goal.estimated_minutes || 0;
    const remainingMinutes = Math.max(0, estimatedMinutes - totalMinutes);

    // Consider on track if progress >= 50% or if there's no time estimate
    const isOnTrack =
      goal.status === "completed" ||
      estimatedMinutes === 0 ||
      totalMinutes >= estimatedMinutes * 0.5;

    summaries.push({
      goal,
      totalMinutesContributed: totalMinutes,
      eventCount: progress.length,
      isOnTrack,
      remainingMinutes,
    });
  }

  return summaries;
}

/**
 * Recalculate and update progress percent for a goal
 */
export async function recalculateGoalProgress(goalId: string): Promise<number> {
  const goal = await getGoalById(goalId);
  if (!goal) return 0;

  const totalMinutes = await calculateGoalTotalMinutes(goalId);
  const estimatedMinutes = goal.estimated_minutes || 0;

  let progressPercent = 0;
  if (estimatedMinutes > 0) {
    progressPercent = Math.min(100, Math.round((totalMinutes / estimatedMinutes) * 100));
  } else if (totalMinutes > 0) {
    // If no estimate, any progress is 100%
    progressPercent = 100;
  }

  await updateGoalProgress(goalId, progressPercent);
  return progressPercent;
}

/**
 * Mark a goal as complete
 */
export async function completeGoal(goalId: string): Promise<void> {
  await updateGoalStatus(goalId, "completed");
}

/**
 * Mark a goal as cancelled
 */
export async function cancelGoal(goalId: string): Promise<void> {
  await updateGoalStatus(goalId, "cancelled");
}

/**
 * Reactivate a completed or cancelled goal
 */
export async function reactivateGoal(goalId: string): Promise<void> {
  await updateGoalStatus(goalId, "active");
}

// ============================================================================
// Non-Goal Detection
// ============================================================================

/**
 * Alert with enriched data
 */
export interface EnrichedAlert {
  alert: StoredNonGoalAlert;
  nonGoal: StoredNonGoal | null;
  event: StoredEvent | null;
}

/**
 * Check events against non-goals and create alerts
 * Returns newly created alerts
 */
export async function detectNonGoalMatches(
  weekId: string,
  events: StoredEvent[]
): Promise<StoredNonGoalAlert[]> {
  const nonGoals = await getNonGoalsForWeek(weekId);
  const newAlerts: StoredNonGoalAlert[] = [];
  const now = new Date().toISOString();

  for (const nonGoal of nonGoals) {
    if (!nonGoal.active) continue;

    try {
      const pattern = new RegExp(nonGoal.pattern, "i");

      for (const event of events) {
        // Check if event matches the pattern
        const matches =
          pattern.test(event.summary) ||
          (event.description && pattern.test(event.description));

        // Also check color match if specified
        const colorMatches = nonGoal.color_id
          ? event.color_id === nonGoal.color_id
          : false;

        if (matches || colorMatches) {
          const alert = await createNonGoalAlert({
            non_goal_id: nonGoal.id,
            event_id: event.id,
            detected_at: now,
            acknowledged: 0,
          });
          newAlerts.push(alert);
        }
      }
    } catch {
      // Invalid regex pattern - skip this non-goal
      console.warn(`Invalid regex pattern in non-goal ${nonGoal.id}: ${nonGoal.pattern}`);
    }
  }

  return newAlerts;
}

/**
 * Run non-goal detection for a week using stored events
 */
export async function runNonGoalDetectionForWeek(
  weekId: string
): Promise<StoredNonGoalAlert[]> {
  const { start, end } = getWeekDateRange(weekId);
  const events = await getEventsForDateRange(start, end);
  return detectNonGoalMatches(weekId, events);
}

/**
 * Get enriched alerts with non-goal and event details
 */
export async function getEnrichedAlertsForWeek(
  weekId: string
): Promise<EnrichedAlert[]> {
  const alerts = await getUnacknowledgedAlerts(weekId);
  const { start, end } = getWeekDateRange(weekId);
  const events = await getEventsForDateRange(start, end);
  const nonGoals = await getNonGoalsForWeek(weekId);

  const eventMap = new Map(events.map((e) => [e.id, e]));
  const nonGoalMap = new Map(nonGoals.map((ng) => [ng.id, ng]));

  return alerts.map((alert) => ({
    alert,
    nonGoal: nonGoalMap.get(alert.non_goal_id) || null,
    event: eventMap.get(alert.event_id) || null,
  }));
}

// ============================================================================
// Goal Type Inference
// ============================================================================

/**
 * Infer goal type from title and notes
 */
export function inferGoalType(
  title: string,
  notes?: string
): "time" | "outcome" | "habit" {
  const text = `${title} ${notes || ""}`.toLowerCase();

  // Time-based patterns: "4 hours", "2h", "30 minutes", "1.5 hrs"
  const timePatterns = /(\d+\.?\d*)\s*(hours?|h|hrs?|minutes?|min|m)\b/i;
  if (timePatterns.test(text)) {
    return "time";
  }

  // Habit patterns: "3x", "daily", "weekly", "every day"
  const habitPatterns = /\b(daily|weekly|\d+x|every\s*(day|week)|routine)\b/i;
  if (habitPatterns.test(text)) {
    return "habit";
  }

  // Default to outcome
  return "outcome";
}

/**
 * Parse estimated minutes from goal text
 * Examples: "4 hours", "2h", "30 minutes", "1.5 hrs"
 */
export function parseEstimatedMinutes(text: string): number | null {
  const patterns = [
    { regex: /(\d+\.?\d*)\s*(hours?|h|hrs?)/i, multiplier: 60 },
    { regex: /(\d+\.?\d*)\s*(minutes?|min|m)\b/i, multiplier: 1 },
  ];

  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return Math.round(parseFloat(match[1]) * multiplier);
    }
  }

  return null;
}

// ============================================================================
// Export helpers for optimizer integration
// ============================================================================

/**
 * Convert a weekly goal to optimizer-compatible format
 */
export interface OptimizerGoal {
  id: string;
  name: string;
  totalMinutes: number;
  remainingMinutes: number;
  colorId: string;
  priority: number;
  recurring: boolean;
}

/**
 * Get active weekly goals in optimizer format
 */
export async function getGoalsForOptimizer(weekId: string): Promise<OptimizerGoal[]> {
  const summaries = await getWeeklyGoalSummaries(weekId);

  return summaries
    .filter((s) => s.goal.status === "active" && s.goal.goal_type === "time")
    .map((s) => ({
      id: `weekly-${s.goal.id}`,
      name: s.goal.title,
      totalMinutes: s.goal.estimated_minutes || 120,
      remainingMinutes: s.remainingMinutes,
      colorId: s.goal.color_id || "2", // Default to Sage
      priority: 1,
      recurring: false,
    }));
}
