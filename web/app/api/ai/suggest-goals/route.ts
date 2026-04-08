import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getEvents, getGoalsForWeek, getWeekDateRange } from "@/lib/db-supabase";
import {
  suggestGoals,
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
 * POST /api/ai/suggest-goals
 *
 * Get AI-powered goal suggestions based on calendar patterns.
 *
 * Body:
 *   - weekId: Week ID to suggest goals for (YYYY-WWW) - required
 *   - lookbackWeeks: Number of weeks to analyze for patterns (default: 2)
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
    const { weekId, lookbackWeeks = 2 } = body;

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

    // Get date range for the target week
    const { startDate: weekStart } = getWeekDateRange(weekId);

    // Calculate lookback range (N weeks before the target week)
    const lookbackStart = new Date(weekStart);
    lookbackStart.setDate(lookbackStart.getDate() - lookbackWeeks * 7);
    const lookbackStartStr = lookbackStart.toISOString().split("T")[0];

    // Fetch recent events for pattern analysis and existing goals
    const [recentEvents, existingGoals] = await Promise.all([
      getEvents(userId, lookbackStartStr, weekStart),
      getGoalsForWeek(userId, weekId),
    ]);

    // Transform events for AI analysis
    const eventsForAnalysis: EventForAnalysis[] = recentEvents.map((e) => ({
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
    const goalsForAnalysis: GoalForAnalysis[] = existingGoals.map((g) => ({
      id: g.id,
      title: g.title,
      goalType: g.goal_type as "time" | "outcome" | "habit",
      estimatedMinutes: g.estimated_minutes,
      progressPercent: g.progress_percent,
      status: g.status,
      colorId: g.color_id,
    }));

    // Get suggestions from AI
    const suggestions = await suggestGoals(
      eventsForAnalysis,
      goalsForAnalysis,
      weekId
    );

    // Increment rate limit counter
    await incrementRateLimit(userId);

    return NextResponse.json({
      success: true,
      weekId,
      existingGoalCount: existingGoals.length,
      recentEventCount: recentEvents.length,
      lookbackWeeks,
      suggestions,
    }, {
      headers: rateLimitHeaders(rateLimit.remaining - 1, rateLimit.limit),
    });
  } catch (error) {
    console.error("Error suggesting goals:", error);
    return NextResponse.json(
      { error: "Failed to suggest goals" },
      { status: 500 }
    );
  }
  });
}
