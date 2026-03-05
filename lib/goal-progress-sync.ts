/**
 * Goal Progress Sync Library
 *
 * Syncs calendar events to goal progress by auto-matching events
 * based on color, keywords, and other heuristics.
 */

import type { StoredWeeklyGoal, StoredEvent, StoredGoalProgress } from "./calendar-db.js";
import {
  getGoalsForWeek,
  getEventsForDateRange,
  getProgressForGoal,
  recordGoalProgress,
  calculateGoalTotalMinutes,
  updateGoalProgress,
  getGoalById,
  formatDateKey,
} from "./calendar-db.js";
import {
  processBatchMatches,
  type MatchResult,
  type BatchMatchResult,
  MATCH_THRESHOLDS,
} from "./goal-matcher.js";

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  weekId: string;
  goalsProcessed: number;
  eventsProcessed: number;
  autoMatched: number;
  needsReview: number;
  alreadyMatched: number;
  progressRecords: {
    goalId: string;
    eventId: string;
    minutes: number;
    confidence: number;
  }[];
  affectedGoals: {
    goalId: string;
    title: string;
    previousProgress: number;
    newProgress: number;
  }[];
}

export interface SyncOptions {
  /** Only perform dry run without actually recording progress */
  dryRun?: boolean;
  /** Force re-match even if events already have progress recorded */
  forceRematch?: boolean;
}

// ============================================================================
// Week Date Range Calculation
// ============================================================================

/**
 * Parse a week ID (e.g., "2026-W14") into year and week number
 */
export function parseWeekId(weekId: string): { year: number; week: number } {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid week ID format: ${weekId}. Expected "YYYY-WWW" (e.g., "2026-W14")`
    );
  }
  return {
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10),
  };
}

/**
 * Get the date range (Monday-Sunday) for a week ID
 */
export function getWeekDateRange(weekId: string): { startDate: Date; endDate: Date } {
  const { year, week } = parseWeekId(weekId);

  // ISO week 1 is the week containing the first Thursday of the year
  // Which is also the week containing January 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Make Sunday = 7

  // Start of week 1 (Monday)
  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Start of requested week (Monday)
  const startDate = new Date(week1Start);
  startDate.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);

  // End of requested week (Sunday)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);

  return { startDate, endDate };
}

// ============================================================================
// Progress Sync Functions
// ============================================================================

/**
 * Get event IDs that already have progress records for a goal
 */
async function getExistingProgressEventIds(goalId: string): Promise<Set<string>> {
  const progress = await getProgressForGoal(goalId);
  return new Set(progress.map((p) => p.event_id));
}

/**
 * Filter out events that already have progress recorded for any goal
 */
async function filterUnmatchedEvents(
  events: StoredEvent[],
  goals: StoredWeeklyGoal[],
  forceRematch: boolean
): Promise<StoredEvent[]> {
  if (forceRematch) {
    return events;
  }

  // Get all event IDs that already have progress recorded
  const matchedEventIds = new Set<string>();
  for (const goal of goals) {
    const existingIds = await getExistingProgressEventIds(goal.id);
    for (const id of existingIds) {
      matchedEventIds.add(id);
    }
  }

  return events.filter((e) => !matchedEventIds.has(e.id));
}

/**
 * Sync calendar events to goal progress for a week.
 *
 * This function:
 * 1. Loads all active goals for the week
 * 2. Loads all events for the week's date range
 * 3. Uses the goal-matcher to find auto-matches
 * 4. Records progress for auto-matched events
 * 5. Recalculates progress percentages for affected goals
 *
 * @param weekId - ISO week ID (e.g., "2026-W14")
 * @param options - Optional sync options
 * @returns Summary of sync results
 */
export async function syncProgressFromCalendar(
  weekId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { dryRun = false, forceRematch = false } = options;

  // 1. Load goals for the week (only active ones)
  const allGoals = await getGoalsForWeek(weekId);
  const activeGoals = allGoals.filter((g) => g.status === "active");

  if (activeGoals.length === 0) {
    return {
      weekId,
      goalsProcessed: 0,
      eventsProcessed: 0,
      autoMatched: 0,
      needsReview: 0,
      alreadyMatched: 0,
      progressRecords: [],
      affectedGoals: [],
    };
  }

  // 2. Get week date range and load events
  const { startDate, endDate } = getWeekDateRange(weekId);
  const allEvents = await getEventsForDateRange(startDate, endDate);

  // Filter out all-day events (they don't contribute meaningful time)
  const timedEvents = allEvents.filter((e) => !e.is_all_day);

  // 3. Filter out events that already have progress recorded
  const unmatchedEvents = await filterUnmatchedEvents(
    timedEvents,
    activeGoals,
    forceRematch
  );
  const alreadyMatched = timedEvents.length - unmatchedEvents.length;

  if (unmatchedEvents.length === 0) {
    return {
      weekId,
      goalsProcessed: activeGoals.length,
      eventsProcessed: timedEvents.length,
      autoMatched: 0,
      needsReview: 0,
      alreadyMatched,
      progressRecords: [],
      affectedGoals: [],
    };
  }

  // 4. Run the matcher
  const matchResult: BatchMatchResult = processBatchMatches(unmatchedEvents, activeGoals);

  // 5. Track affected goals for progress recalculation
  const affectedGoalIds = new Set<string>();
  const progressRecords: SyncResult["progressRecords"] = [];

  // 6. Record auto-matches (unless dry run)
  for (const match of matchResult.autoMatches) {
    const event = unmatchedEvents.find((e) => e.id === match.eventId);
    if (!event) continue;

    affectedGoalIds.add(match.goalId);

    if (!dryRun) {
      await recordGoalProgress({
        goal_id: match.goalId,
        event_id: match.eventId,
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: match.confidence,
        minutes_contributed: event.duration_minutes,
      });
    }

    progressRecords.push({
      goalId: match.goalId,
      eventId: match.eventId,
      minutes: event.duration_minutes,
      confidence: match.confidence,
    });
  }

  // 7. Recalculate progress for affected goals
  const affectedGoals: SyncResult["affectedGoals"] = [];

  for (const goalId of affectedGoalIds) {
    const goal = await getGoalById(goalId);
    if (!goal) continue;

    const previousProgress = goal.progress_percent;

    if (!dryRun) {
      // Calculate new progress
      const totalMinutes = await calculateGoalTotalMinutes(goalId);
      let newProgress = 0;

      if (goal.estimated_minutes && goal.estimated_minutes > 0) {
        newProgress = Math.min(
          100,
          Math.round((totalMinutes / goal.estimated_minutes) * 100)
        );
      } else if (totalMinutes > 0) {
        newProgress = 100;
      }

      await updateGoalProgress(goalId, newProgress);

      affectedGoals.push({
        goalId,
        title: goal.title,
        previousProgress,
        newProgress,
      });
    } else {
      // For dry run, calculate what the progress would be
      const currentMinutes = await calculateGoalTotalMinutes(goalId);
      const addedMinutes = progressRecords
        .filter((p) => p.goalId === goalId)
        .reduce((sum, p) => sum + p.minutes, 0);
      const totalMinutes = currentMinutes + addedMinutes;

      let newProgress = 0;
      if (goal.estimated_minutes && goal.estimated_minutes > 0) {
        newProgress = Math.min(
          100,
          Math.round((totalMinutes / goal.estimated_minutes) * 100)
        );
      } else if (totalMinutes > 0) {
        newProgress = 100;
      }

      affectedGoals.push({
        goalId,
        title: goal.title,
        previousProgress,
        newProgress,
      });
    }
  }

  return {
    weekId,
    goalsProcessed: activeGoals.length,
    eventsProcessed: timedEvents.length,
    autoMatched: matchResult.autoMatches.length,
    needsReview: matchResult.needsConfirmation.length,
    alreadyMatched,
    progressRecords,
    affectedGoals,
  };
}

/**
 * Record progress for a single event-goal pairing.
 * Used for manual matching from UI or skill.
 *
 * @param goalId - The goal ID to record progress for
 * @param eventId - The event ID that contributed to the goal
 * @param minutes - Minutes contributed (usually event duration)
 * @param matchType - Whether this was auto or manual match
 * @param confidence - Match confidence (null for manual)
 */
export async function recordSingleProgress(
  goalId: string,
  eventId: string,
  minutes: number,
  matchType: "auto" | "manual" = "manual",
  confidence: number | null = null
): Promise<StoredGoalProgress> {
  const progress = await recordGoalProgress({
    goal_id: goalId,
    event_id: eventId,
    matched_at: new Date().toISOString(),
    match_type: matchType,
    match_confidence: confidence,
    minutes_contributed: minutes,
  });

  // Recalculate goal progress
  const goal = await getGoalById(goalId);
  if (goal) {
    const totalMinutes = await calculateGoalTotalMinutes(goalId);
    let newProgress = 0;

    if (goal.estimated_minutes && goal.estimated_minutes > 0) {
      newProgress = Math.min(
        100,
        Math.round((totalMinutes / goal.estimated_minutes) * 100)
      );
    } else if (totalMinutes > 0) {
      newProgress = 100;
    }

    await updateGoalProgress(goalId, newProgress);
  }

  return progress;
}

/**
 * Get a summary of progress for a goal.
 */
export async function getGoalProgressSummary(goalId: string): Promise<{
  totalMinutes: number;
  recordCount: number;
  autoMatched: number;
  manualMatched: number;
}> {
  const records = await getProgressForGoal(goalId);

  return {
    totalMinutes: records.reduce((sum, r) => sum + r.minutes_contributed, 0),
    recordCount: records.length,
    autoMatched: records.filter((r) => r.match_type === "auto").length,
    manualMatched: records.filter((r) => r.match_type === "manual").length,
  };
}
