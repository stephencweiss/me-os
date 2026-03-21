import * as db from "./db-unified";
import {
  buildAlignmentMobileV1,
  computeSyncHintFromCalendarData,
  type AlignmentMobileAudit,
  type AlignmentMobileGoal,
  type AlignmentMobileV1,
  type SyncHint,
  type WeekAlignmentGoalRow,
  ALIGNMENT_MOBILE_SCHEMA_VERSION,
  CALENDAR_STALE_AFTER_MS,
  MAX_AUDIT_PROMPTS_PER_WEEK,
} from "./week-alignment-core";

export {
  buildAlignmentMobileV1,
  computeSyncHintFromCalendarData,
  ALIGNMENT_MOBILE_SCHEMA_VERSION,
  CALENDAR_STALE_AFTER_MS,
  MAX_AUDIT_PROMPTS_PER_WEEK,
};
export type {
  AlignmentMobileAudit,
  AlignmentMobileGoal,
  AlignmentMobileV1,
  SyncHint,
  WeekAlignmentGoalRow,
};

function maxParsedDate(isoStrings: string[]): Date | null {
  let best: number | null = null;
  for (const s of isoStrings) {
    const t = Date.parse(s);
    if (!Number.isNaN(t) && (best === null || t > best)) {
      best = t;
    }
  }
  return best === null ? null : new Date(best);
}

/**
 * Load goals, progress, calendar hints, and audit state for GET /api/week-alignment.
 */
export async function loadWeekAlignmentMobileV1(
  userId: string | null,
  weekId: string,
  now: Date = new Date()
): Promise<AlignmentMobileV1> {
  const goals = await db.getGoalsForWeek(userId, weekId);
  const ids = goals.map((g) => g.id);
  const progressByGoalId = await db.getGoalProgressMinutesBatch(userId, ids);

  const { startDate, endDate } = db.getWeekDateRange(weekId);
  const events = await db.getEvents(userId, startDate, endDate);
  const summaries = await db.getDailySummaries(userId, startDate, endDate);

  const latestEventSeen = maxParsedDate(events.map((e) => e.last_seen));
  const latestSummarySnapshot = maxParsedDate(summaries.map((s) => s.snapshot_time));

  const syncHint = computeSyncHintFromCalendarData(latestEventSeen, latestSummarySnapshot, now);
  const auditRow = await db.getWeeklyAuditState(userId, weekId);

  return buildAlignmentMobileV1({
    weekId,
    generatedAt: now.toISOString(),
    goals: goals as WeekAlignmentGoalRow[],
    progressByGoalId,
    syncHint,
    auditRow,
    now,
  });
}
