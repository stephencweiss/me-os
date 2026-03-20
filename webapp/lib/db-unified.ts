/**
 * Unified Database Layer
 *
 * Provides a single interface that works in both modes:
 * - Local mode (MEOS_MODE=local): Uses Turso/SQLite via db.ts (no userId)
 * - Web mode: Uses Supabase via db-supabase.ts (with userId)
 *
 * All functions accept userId as first param. In local mode, userId is ignored.
 */

import { isLocalMode } from "./auth-helpers";
import * as turso from "./db";
import * as supabase from "./db-supabase";
import type { WeeklyAuditAction } from "./db-supabase";

// Re-export types and constants that are common
export type { Category } from "./db-supabase";
export { COLOR_DEFINITIONS } from "./db-supabase";

// Re-export DB types for backward compatibility
export type { DbEvent } from "./db";
export type { DbWeeklyGoal, DbNonGoal, DbNonGoalAlert, DbDailySummary } from "./db";

/**
 * Unified event type (compatible with both backends)
 */
export type UnifiedEvent = turso.DbEvent | supabase.DbEvent;
export type UnifiedGoal = turso.DbWeeklyGoal | supabase.DbWeeklyGoal;
export type UnifiedNonGoal = turso.DbNonGoal | supabase.DbNonGoal;

// =============================================================================
// Events
// =============================================================================

export async function getEvents(
  userId: string | null,
  startDate: string,
  endDate: string,
  options?: {
    calendars?: string[];
    accounts?: string[];
    attended?: string[];
    uncategorized?: boolean;
  }
) {
  if (isLocalMode() || !userId) {
    return turso.getEvents(startDate, endDate, options);
  }
  return supabase.getEvents(userId, startDate, endDate, options);
}

export async function getEventById(userId: string | null, eventId: string) {
  if (isLocalMode() || !userId) {
    return turso.getEventById(eventId);
  }
  return supabase.getEventById(userId, eventId);
}

export async function updateEventColor(
  userId: string | null,
  eventId: string,
  colorId: string
) {
  if (isLocalMode() || !userId) {
    return turso.updateEventColor(eventId, colorId);
  }
  return supabase.updateEventColor(userId, eventId, colorId);
}

export async function updateAttendance(
  userId: string | null,
  eventId: string,
  attended: "attended" | "skipped" | "unknown"
) {
  if (isLocalMode() || !userId) {
    return turso.updateAttendance(eventId, attended);
  }
  return supabase.updateAttendance(userId, eventId, attended);
}

// =============================================================================
// Calendars & Accounts
// =============================================================================

export async function getCalendars(userId: string | null) {
  if (isLocalMode() || !userId) {
    return turso.getCalendars();
  }
  return supabase.getCalendars(userId);
}

export async function getAccounts(userId: string | null) {
  if (isLocalMode() || !userId) {
    return turso.getAccounts();
  }
  return supabase.getAccounts(userId);
}

// =============================================================================
// Daily Summaries
// =============================================================================

export async function getDailySummaries(
  userId: string | null,
  startDate: string,
  endDate: string
) {
  if (isLocalMode() || !userId) {
    return turso.getDailySummaries(startDate, endDate);
  }
  return supabase.getDailySummaries(userId, startDate, endDate);
}

export async function computeSummariesFromEvents(
  userId: string | null,
  startDate: string,
  endDate: string,
  options?: { accounts?: string[]; calendars?: string[] }
) {
  if (isLocalMode() || !userId) {
    return turso.computeSummariesFromEvents(startDate, endDate, options);
  }
  return supabase.computeSummariesFromEvents(userId, startDate, endDate, options);
}

// =============================================================================
// User Preferences
// =============================================================================

export async function getPreference(userId: string | null, key: string) {
  if (isLocalMode() || !userId) {
    return turso.getPreference(key);
  }
  return supabase.getPreference(userId, key);
}

export async function setPreference(
  userId: string | null,
  key: string,
  value: string
) {
  if (isLocalMode() || !userId) {
    return turso.setPreference(key, value);
  }
  return supabase.setPreference(userId, key, value);
}

export async function getAllPreferences(userId: string | null) {
  if (isLocalMode() || !userId) {
    return turso.getAllPreferences();
  }
  return supabase.getAllPreferences(userId);
}

// =============================================================================
// Weekly Goals
// =============================================================================

export async function getGoalsForWeek(userId: string | null, weekId: string) {
  if (isLocalMode() || !userId) {
    return turso.getGoalsForWeek(weekId);
  }
  return supabase.getGoalsForWeek(userId, weekId);
}

export async function getGoalById(userId: string | null, goalId: string) {
  if (isLocalMode() || !userId) {
    return turso.getGoalById(goalId);
  }
  return supabase.getGoalById(userId, goalId);
}

export async function updateGoalProgress(
  userId: string | null,
  goalId: string,
  progressPercent: number
) {
  if (isLocalMode() || !userId) {
    return turso.updateGoalProgress(goalId, progressPercent);
  }
  return supabase.updateGoalProgress(userId, goalId, progressPercent);
}

export async function updateGoalStatus(
  userId: string | null,
  goalId: string,
  status: "active" | "completed" | "cancelled"
) {
  if (isLocalMode() || !userId) {
    return turso.updateGoalStatus(goalId, status);
  }
  return supabase.updateGoalStatus(userId, goalId, status);
}

export async function createGoal(
  userId: string | null,
  params: {
    weekId: string;
    title: string;
    colorId?: string | null;
    estimatedMinutes?: number | null;
    notes?: string | null;
    goalType?: "time" | "outcome" | "habit";
  }
) {
  if (isLocalMode() || !userId) {
    return turso.createGoal(params);
  }
  return supabase.createGoal(userId, params);
}

export async function updateGoal(
  userId: string | null,
  goalId: string,
  updates: {
    title?: string;
    notes?: string | null;
    estimatedMinutes?: number | null;
    goalType?: "time" | "outcome" | "habit";
    colorId?: string | null;
  }
) {
  if (isLocalMode() || !userId) {
    return turso.updateGoal(goalId, updates);
  }
  return supabase.updateGoal(userId, goalId, updates);
}

export async function getGoalProgressMinutes(userId: string | null, goalId: string) {
  if (isLocalMode() || !userId) {
    return turso.getGoalProgress(goalId);
  }
  return supabase.getGoalProgressMinutes(userId, goalId);
}

export async function getGoalProgressMinutesBatch(
  userId: string | null,
  goalIds: string[]
): Promise<Record<string, number>> {
  if (goalIds.length === 0) {
    return {};
  }
  if (isLocalMode() || !userId) {
    return turso.getGoalProgressMinutesBatch(goalIds);
  }
  return supabase.getGoalProgressMinutesBatch(userId, goalIds);
}

/** Fields consumed by week-alignment DTO (works for Turso + Supabase rows). */
export type WeeklyAuditStateLike = {
  dismissed_at: string | null;
  snoozed_until: string | null;
  prompt_count: number;
  last_prompt_at: string | null;
};

export async function getWeeklyAuditState(
  userId: string | null,
  weekId: string
): Promise<WeeklyAuditStateLike | null> {
  if (isLocalMode() || !userId) {
    const row = await turso.getWeeklyAuditStateLocal(weekId);
    if (!row) {
      return null;
    }
    return {
      dismissed_at: row.dismissed_at,
      snoozed_until: row.snoozed_until,
      prompt_count: row.prompt_count,
      last_prompt_at: row.last_prompt_at,
    };
  }
  const row = await supabase.getWeeklyAuditState(userId, weekId);
  if (!row) {
    return null;
  }
  return {
    dismissed_at: row.dismissed_at,
    snoozed_until: row.snoozed_until,
    prompt_count: row.prompt_count,
    last_prompt_at: row.last_prompt_at,
  };
}

export async function applyWeeklyAuditAction(
  userId: string | null,
  weekId: string,
  action: WeeklyAuditAction,
  options?: { snoozedUntil?: string }
): Promise<WeeklyAuditStateLike> {
  if (isLocalMode() || !userId) {
    const row = await turso.applyWeeklyAuditActionLocal(weekId, action, options);
    return {
      dismissed_at: row.dismissed_at,
      snoozed_until: row.snoozed_until,
      prompt_count: row.prompt_count,
      last_prompt_at: row.last_prompt_at,
    };
  }
  const row = await supabase.applyWeeklyAuditAction(userId, weekId, action, options);
  return {
    dismissed_at: row.dismissed_at,
    snoozed_until: row.snoozed_until,
    prompt_count: row.prompt_count,
    last_prompt_at: row.last_prompt_at,
  };
}

// =============================================================================
// Non-Goals
// =============================================================================

export async function getNonGoalsForWeek(userId: string | null, weekId: string) {
  if (isLocalMode() || !userId) {
    return turso.getNonGoalsForWeek(weekId);
  }
  return supabase.getNonGoalsForWeek(userId, weekId);
}

export async function getUnacknowledgedAlerts(userId: string | null, weekId: string) {
  if (isLocalMode() || !userId) {
    return turso.getUnacknowledgedAlerts(weekId);
  }
  return supabase.getUnacknowledgedAlerts(userId, weekId);
}

export async function acknowledgeAlert(userId: string | null, alertId: number) {
  if (isLocalMode() || !userId) {
    return turso.acknowledgeAlert(alertId);
  }
  return supabase.acknowledgeAlert(userId, alertId);
}

export async function createNonGoal(
  userId: string | null,
  params: {
    weekId: string;
    title: string;
    pattern?: string | null;
    colorId?: string | null;
    reason?: string | null;
  }
) {
  if (isLocalMode() || !userId) {
    return turso.createNonGoal(params);
  }
  return supabase.createNonGoal(userId, params);
}

// Re-export NON_GOAL_STATUS constants
export { NON_GOAL_STATUS, type NonGoalStatus } from "./db-supabase";

export async function updateNonGoalStatus(
  userId: string | null,
  nonGoalId: string,
  status: supabase.NonGoalStatus
) {
  if (isLocalMode() || !userId) {
    return turso.updateNonGoalStatus(nonGoalId, status);
  }
  return supabase.updateNonGoalStatus(userId, nonGoalId, status);
}

// =============================================================================
// Goal Progress
// =============================================================================

export async function recordGoalProgress(
  userId: string | null,
  params: {
    goalId: string;
    eventId: string;
    matchType: "auto" | "manual";
    matchConfidence: number | null;
    minutesContributed: number;
  }
) {
  if (isLocalMode() || !userId) {
    // Turso doesn't have this function yet - skip in local mode
    return null;
  }
  return supabase.recordGoalProgress(userId, params);
}

export async function getProgressRecordsForGoal(userId: string | null, goalId: string) {
  if (isLocalMode() || !userId) {
    // Turso doesn't have this function yet - return empty in local mode
    return [];
  }
  return supabase.getProgressRecordsForGoal(userId, goalId);
}

export async function recalculateGoalProgress(userId: string | null, goalId: string) {
  if (isLocalMode() || !userId) {
    // Turso doesn't have this function yet - return 0 in local mode
    return 0;
  }
  return supabase.recalculateGoalProgress(userId, goalId);
}

// =============================================================================
// Week Utilities (no userId needed - pure functions)
// =============================================================================

export { getWeekDateRange, parseWeekId } from "./db-supabase";
