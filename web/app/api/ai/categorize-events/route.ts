import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getEvents, getWeekDateRange } from "@/lib/db-supabase";
import { categorizeEvents, type EventForAnalysis } from "@/lib/anthropic";
import {
  checkRateLimit,
  incrementRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

/**
 * POST /api/ai/categorize-events
 *
 * Get AI-powered categorization suggestions for uncategorized events.
 *
 * Body:
 *   - weekId: Week ID to categorize events for (YYYY-WWW) - optional
 *   - startDate: Start date (YYYY-MM-DD) - optional, defaults to 7 days ago
 *   - endDate: End date (YYYY-MM-DD) - optional, defaults to today
 *
 * Note: Provide either weekId OR (startDate, endDate), not both.
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
    const { weekId, startDate: rawStartDate, endDate: rawEndDate } = body;

    let startDate: string;
    let endDate: string;

    if (weekId) {
      // Validate week format
      const weekRegex = /^\d{4}-W\d{2}$/;
      if (!weekRegex.test(weekId)) {
        return NextResponse.json(
          { error: "weekId must be in YYYY-WWW format (e.g., 2026-W10)" },
          { status: 400 }
        );
      }
      const range = getWeekDateRange(weekId);
      startDate = range.startDate;
      endDate = range.endDate;
    } else if (rawStartDate && rawEndDate) {
      // Validate date formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(rawStartDate) || !dateRegex.test(rawEndDate)) {
        return NextResponse.json(
          { error: "Dates must be in YYYY-MM-DD format" },
          { status: 400 }
        );
      }
      startDate = rawStartDate;
      endDate = rawEndDate;
    } else {
      // Default to last 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      startDate = start.toISOString().split("T")[0];
      endDate = end.toISOString().split("T")[0];
    }

    // Fetch events, filtering for uncategorized only
    const events = await getEvents(userId, startDate, endDate, {
      uncategorized: true,
    });

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No uncategorized events found in the specified range",
        startDate,
        endDate,
        suggestions: [],
      }, {
        headers: rateLimitHeaders(rateLimit.remaining, rateLimit.limit),
      });
    }

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

    // Get categorization suggestions from AI
    const suggestions = await categorizeEvents(eventsForAnalysis);

    // Increment rate limit counter
    await incrementRateLimit(userId);

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      uncategorizedCount: events.length,
      suggestions,
    }, {
      headers: rateLimitHeaders(rateLimit.remaining - 1, rateLimit.limit),
    });
  } catch (error) {
    console.error("Error categorizing events:", error);
    return NextResponse.json(
      { error: "Failed to categorize events" },
      { status: 500 }
    );
  }
  });
}
