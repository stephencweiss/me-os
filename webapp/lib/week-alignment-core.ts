import { parseGoalConstraints, type GoalConstraints } from "./goal-constraints";

export const ALIGNMENT_MOBILE_SCHEMA_VERSION = 1 as const;
export const MAX_AUDIT_PROMPTS_PER_WEEK = 5;
export const CALENDAR_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export type SyncHint = "fresh" | "stale" | "unknown";

/** Minimal goal row for building the DTO (Turso + Supabase goals satisfy this). */
export type WeekAlignmentGoalRow = {
  id: string;
  title: string;
  goal_type: "time" | "outcome" | "habit";
  status: "active" | "completed" | "cancelled";
  progress_percent: number;
  estimated_minutes: number | null;
  color_id: string | null;
  constraints_json?: unknown;
};

export type WeeklyAuditStateInput = {
  dismissed_at: string | null;
  snoozed_until: string | null;
  prompt_count: number;
  last_prompt_at: string | null;
};

export type AlignmentMobileV1 = {
  schemaVersion: typeof ALIGNMENT_MOBILE_SCHEMA_VERSION;
  weekId: string;
  generatedAt: string;
  syncHint: SyncHint;
  goals: AlignmentMobileGoal[];
  audit: AlignmentMobileAudit;
};

export type AlignmentMobileGoal = {
  id: string;
  title: string;
  goalType: "time" | "outcome" | "habit";
  status: "active" | "completed" | "cancelled";
  progressPercent: number;
  minutesLogged: number;
  estimatedMinutes: number | null;
  colorId: string | null;
  constraints: GoalConstraints | null;
};

export type AlignmentMobileAudit = {
  eligibleForPrompt: boolean;
  dismissedAt: string | null;
  snoozedUntil: string | null;
  promptCount: number;
  lastPromptAt: string | null;
  maxPromptsPerWeek: number;
};

/**
 * Derive sync freshness from the newest calendar artifact in the week window.
 */
export function computeSyncHintFromCalendarData(
  latestEventSeen: Date | null,
  latestSummarySnapshot: Date | null,
  now: Date
): SyncHint {
  const times: number[] = [];
  if (latestEventSeen && !Number.isNaN(latestEventSeen.getTime())) {
    times.push(latestEventSeen.getTime());
  }
  if (latestSummarySnapshot && !Number.isNaN(latestSummarySnapshot.getTime())) {
    times.push(latestSummarySnapshot.getTime());
  }
  if (times.length === 0) {
    return "unknown";
  }
  const latest = Math.max(...times);
  if (now.getTime() - latest > CALENDAR_STALE_AFTER_MS) {
    return "stale";
  }
  return "fresh";
}

export function buildAuditBlock(
  row: WeeklyAuditStateInput | null,
  now: Date,
  maxPrompts: number = MAX_AUDIT_PROMPTS_PER_WEEK
): AlignmentMobileAudit {
  const dismissedAt = row?.dismissed_at ?? null;
  const snoozedUntil = row?.snoozed_until ?? null;
  const promptCount = row?.prompt_count ?? 0;
  const lastPromptAt = row?.last_prompt_at ?? null;

  const snoozeActive = snoozedUntil != null && new Date(snoozedUntil) > now;
  const dismissed = dismissedAt != null;

  const eligibleForPrompt = !dismissed && !snoozeActive && promptCount < maxPrompts;

  return {
    eligibleForPrompt,
    dismissedAt,
    snoozedUntil,
    promptCount,
    lastPromptAt,
    maxPromptsPerWeek: maxPrompts,
  };
}

function constraintsFromGoal(goal: WeekAlignmentGoalRow): unknown {
  return goal.constraints_json ?? null;
}

/**
 * Pure assembly of the versioned DTO from loaded rows (test-friendly).
 */
export function buildAlignmentMobileV1(params: {
  weekId: string;
  generatedAt: string;
  goals: WeekAlignmentGoalRow[];
  progressByGoalId: Record<string, number>;
  syncHint: SyncHint;
  auditRow: WeeklyAuditStateInput | null;
  now: Date;
  maxAuditPrompts?: number;
}): AlignmentMobileV1 {
  const {
    weekId,
    generatedAt,
    goals,
    progressByGoalId,
    syncHint,
    auditRow,
    now,
    maxAuditPrompts,
  } = params;

  const alignmentGoals: AlignmentMobileGoal[] = goals.map((g) => ({
    id: g.id,
    title: g.title,
    goalType: g.goal_type,
    status: g.status,
    progressPercent: g.progress_percent,
    minutesLogged: progressByGoalId[g.id] ?? 0,
    estimatedMinutes: g.estimated_minutes,
    colorId: g.color_id,
    constraints: parseGoalConstraints(constraintsFromGoal(g)),
  }));

  return {
    schemaVersion: ALIGNMENT_MOBILE_SCHEMA_VERSION,
    weekId,
    generatedAt,
    syncHint,
    goals: alignmentGoals,
    audit: buildAuditBlock(auditRow, now, maxAuditPrompts),
  };
}
