/**
 * Per-goal scheduling / alignment windows (E4).
 * Shared contract with Phase 2 slot-finder — keep this module the single parser.
 */

export type GoalConstraints = {
  /** Local hour 0–24 (e.g. 9 = 09:00 start of scoring window) */
  workingHours?: { start: number; end: number };
  /** 0 = Sunday … 6 = Saturday (JavaScript getUTCDay) */
  daysOfWeek?: number[];
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Parse `weekly_goals.constraints_json` from DB (object or JSON string).
 * Invalid shapes return null so callers can treat as “no custom constraints”.
 */
export function parseGoalConstraints(raw: unknown): GoalConstraints | null {
  if (raw == null) return null;

  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return null;
  }

  const o = obj as Record<string, unknown>;
  const out: GoalConstraints = {};

  if (o.workingHours != null && typeof o.workingHours === "object" && !Array.isArray(o.workingHours)) {
    const wh = o.workingHours as Record<string, unknown>;
    const start = wh.start;
    const end = wh.end;
    if (isFiniteNumber(start) && isFiniteNumber(end) && start >= 0 && end <= 24 && start < end) {
      out.workingHours = { start, end };
    }
  }

  if (Array.isArray(o.daysOfWeek)) {
    const days = o.daysOfWeek.filter((d): d is number => isFiniteNumber(d) && d >= 0 && d <= 6);
    if (days.length > 0) {
      out.daysOfWeek = days;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}
