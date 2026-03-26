export const ALLOWED_WEEK_RANGE_DAYS = [7, 14, 30, 90] as const;
export type WeekRangeDays = (typeof ALLOWED_WEEK_RANGE_DAYS)[number];

export const DEFAULT_WEEK_RANGE_DAYS: WeekRangeDays = 7;

export function parseWeekRangeDays(value: string | undefined): WeekRangeDays {
  if (value === undefined || value === "") {
    return DEFAULT_WEEK_RANGE_DAYS;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || !ALLOWED_WEEK_RANGE_DAYS.includes(n as WeekRangeDays)) {
    return DEFAULT_WEEK_RANGE_DAYS;
  }
  return n as WeekRangeDays;
}

/**
 * Server: redirect when query is missing, invalid, or not canonical (e.g. "07" → "7").
 */
export function weekRangeSearchParamNeedsRedirect(
  raw: string | undefined,
  days: WeekRangeDays
): boolean {
  if (raw === undefined) return true;
  return raw !== String(days);
}
