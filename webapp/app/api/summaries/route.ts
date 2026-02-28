import { NextRequest, NextResponse } from "next/server";
import {
  getDailySummaries,
  computeSummariesFromEvents,
  type Category,
} from "@/lib/db";

/**
 * Parsed daily summary with categories
 */
interface ParsedDailySummary {
  date: string;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  categories: Category[];
  isWorkDay: boolean;
  analysisHoursStart: number;
  analysisHoursEnd: number;
  snapshotTime: string;
}

/**
 * GET /api/summaries
 *
 * Query params:
 *   - start: Start date (YYYY-MM-DD) - required
 *   - end: End date (YYYY-MM-DD) - required
 *   - accounts: Comma-separated account names (optional)
 *   - calendars: Comma-separated calendar names (optional)
 *
 * When filters are provided, summaries are computed on-the-fly from events.
 * Without filters, pre-computed summaries from daily_summaries table are used.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const accountsParam = searchParams.get("accounts");
  const calendarsParam = searchParams.get("calendars");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query parameters are required" },
      { status: 400 }
    );
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start) || !dateRegex.test(end)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const hasFilters = accountsParam || calendarsParam;

  try {
    let summaries: ParsedDailySummary[];

    if (hasFilters) {
      // Compute from filtered events when filters are applied
      const options = {
        accounts: accountsParam
          ? accountsParam.split(",").map((a) => a.trim())
          : undefined,
        calendars: calendarsParam
          ? calendarsParam.split(",").map((c) => c.trim())
          : undefined,
      };
      const computed = await computeSummariesFromEvents(start, end, options);
      summaries = computed.summaries.map((s) => ({
        ...s,
        analysisHoursStart: 9,
        analysisHoursEnd: 17,
        snapshotTime: new Date().toISOString(),
      }));
    } else {
      // Use pre-computed summaries (faster) when no filters
      const rawSummaries = await getDailySummaries(start, end);
      summaries = rawSummaries.map((s) => ({
        date: s.date,
        totalScheduledMinutes: s.total_scheduled_minutes,
        totalGapMinutes: s.total_gap_minutes,
        categories: JSON.parse(s.categories_json) as Category[],
        isWorkDay: s.is_work_day === 1,
        analysisHoursStart: s.analysis_hours_start,
        analysisHoursEnd: s.analysis_hours_end,
        snapshotTime: s.snapshot_time,
      }));
    }

    // Calculate aggregate stats
    const totalMinutes = summaries.reduce(
      (sum, s) => sum + s.totalScheduledMinutes,
      0
    );
    const totalGapMinutes = summaries.reduce(
      (sum, s) => sum + s.totalGapMinutes,
      0
    );

    // Aggregate categories across all days
    const categoryTotals = new Map<
      string,
      { minutes: number; events: number; colorName: string; colorMeaning: string }
    >();

    for (const summary of summaries) {
      for (const cat of summary.categories) {
        const existing = categoryTotals.get(cat.colorId) || {
          minutes: 0,
          events: 0,
          colorName: cat.colorName,
          colorMeaning: cat.colorMeaning,
        };
        existing.minutes += cat.totalMinutes;
        existing.events += cat.eventCount;
        categoryTotals.set(cat.colorId, existing);
      }
    }

    const aggregatedCategories = Array.from(categoryTotals.entries())
      .map(([colorId, data]) => ({
        colorId,
        colorName: data.colorName,
        colorMeaning: data.colorMeaning,
        totalMinutes: data.minutes,
        totalHours: Math.round((data.minutes / 60) * 10) / 10,
        eventCount: data.events,
        percentage: Math.round((data.minutes / totalMinutes) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    return NextResponse.json({
      summaries,
      count: summaries.length,
      dateRange: { start, end },
      totals: {
        scheduledMinutes: totalMinutes,
        scheduledHours: Math.round((totalMinutes / 60) * 10) / 10,
        gapMinutes: totalGapMinutes,
        gapHours: Math.round((totalGapMinutes / 60) * 10) / 10,
      },
      aggregatedCategories,
    });
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch summaries" },
      { status: 500 }
    );
  }
}
