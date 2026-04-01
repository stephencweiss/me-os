import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getEvents, getGoalsForWeek, getWeekDateRange } from "@/lib/db-supabase";
import {
  analyzeWeek,
  type EventForAnalysis,
  type GoalForAnalysis,
} from "@/lib/anthropic";
import {
  checkRateLimit,
  incrementRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

/**
 * POST /api/ai/analyze-week
 *
 * Analyze a week's calendar and goals using AI.
 *
 * Body:
 *   - weekId: Week ID in ISO format (YYYY-WWW) - required
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Check rate limit
  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Daily AI request limit exceeded. Try again tomorrow." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit.remaining, rateLimit.limit),
      }
    );
  }

  try {
    const body = await request.json();
    const { weekId } = body;

    if (!weekId) {
      return NextResponse.json(
        { error: "weekId is required" },
        { status: 400 }
      );
    }

    // Validate week format
    const weekRegex = /^\d{4}-W\d{2}$/;
    if (!weekRegex.test(weekId)) {
      return NextResponse.json(
        { error: "weekId must be in YYYY-WWW format (e.g., 2026-W10)" },
        { status: 400 }
      );
    }

    // Get date range for the week
    const { startDate, endDate } = getWeekDateRange(weekId);

    // Fetch events and goals in parallel
    const [events, goals] = await Promise.all([
      getEvents(userId, startDate, endDate),
      getGoalsForWeek(userId, weekId),
    ]);

    // Transform events for AI analysis
    const eventsForAnalysis: EventForAnalysis[] = events.map((e) => ({
      id: e.id,
      summary: e.summary,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      durationMinutes: e.duration_minutes,
      colorId: e.color_id,
      colorName: e.color_name,
      colorMeaning: e.color_meaning,
      account: e.account,
      calendarName: e.calendar_name,
    }));

    // Transform goals for AI analysis
    const goalsForAnalysis: GoalForAnalysis[] = goals.map((g) => ({
      id: g.id,
      title: g.title,
      goalType: g.goal_type as "time" | "outcome" | "habit",
      estimatedMinutes: g.estimated_minutes,
      progressPercent: g.progress_percent,
      status: g.status,
      colorId: g.color_id,
    }));

    // Analyze with AI
    const analysis = await analyzeWeek(eventsForAnalysis, goalsForAnalysis, weekId);

    // Increment rate limit counter
    await incrementRateLimit(userId);

    return NextResponse.json({
      success: true,
      weekId,
      eventCount: events.length,
      goalCount: goals.length,
      analysis,
    }, {
      headers: rateLimitHeaders(rateLimit.remaining - 1, rateLimit.limit),
    });
  } catch (error) {
    console.error("Error analyzing week:", error);
    return NextResponse.json(
      { error: "Failed to analyze week" },
      { status: 500 }
    );
  }
  });
}
