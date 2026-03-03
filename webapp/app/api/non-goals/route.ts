import { NextRequest, NextResponse } from "next/server";
import {
  getNonGoalsForWeek,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  createNonGoal,
} from "@/lib/db";

/**
 * GET /api/non-goals
 *
 * Query params:
 *   - week: Week ID in ISO format (YYYY-WWW) - required
 *   - includeAlerts: Include unacknowledged alerts (default: true)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const week = searchParams.get("week");
  const includeAlerts = searchParams.get("includeAlerts") !== "false";

  if (!week) {
    return NextResponse.json(
      { error: "week query parameter is required (format: YYYY-WWW)" },
      { status: 400 }
    );
  }

  // Validate week format
  const weekRegex = /^\d{4}-W\d{2}$/;
  if (!weekRegex.test(week)) {
    return NextResponse.json(
      { error: "Week must be in YYYY-WWW format (e.g., 2026-W10)" },
      { status: 400 }
    );
  }

  try {
    const nonGoals = await getNonGoalsForWeek(week);

    let alerts: Awaited<ReturnType<typeof getUnacknowledgedAlerts>> = [];
    if (includeAlerts) {
      alerts = await getUnacknowledgedAlerts(week);
    }

    return NextResponse.json({
      nonGoals,
      alerts,
      count: nonGoals.length,
      alertCount: alerts.length,
      weekId: week,
    });
  } catch (error) {
    console.error("Error fetching non-goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch non-goals" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/non-goals
 *
 * Body:
 *   - alertId: Alert ID to acknowledge
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: "alertId is required" },
        { status: 400 }
      );
    }

    if (typeof alertId !== "number") {
      return NextResponse.json(
        { error: "alertId must be a number" },
        { status: 400 }
      );
    }

    await acknowledgeAlert(alertId);

    return NextResponse.json({
      success: true,
      alertId,
      acknowledged: true,
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/non-goals
 *
 * Create a new non-goal (anti-pattern to avoid).
 *
 * Body:
 *   - weekId: Week ID in ISO format (YYYY-WWW) - required
 *   - title: Non-goal title - required
 *   - pattern?: Regex pattern to match events (default: ".*")
 *   - colorId?: Google Calendar color ID to match
 *   - reason?: Why this should be avoided
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekId, title, pattern, colorId, reason } = body;

    // Validate required fields
    if (!weekId) {
      return NextResponse.json(
        { error: "weekId is required" },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
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

    // Validate title is a non-empty string
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate pattern if provided (must be valid regex)
    if (pattern !== undefined && pattern !== null) {
      if (typeof pattern !== "string") {
        return NextResponse.json(
          { error: "pattern must be a string" },
          { status: 400 }
        );
      }
      try {
        new RegExp(pattern);
      } catch {
        return NextResponse.json(
          { error: "pattern must be a valid regular expression" },
          { status: 400 }
        );
      }
    }

    // Create the non-goal
    const nonGoal = await createNonGoal({
      weekId,
      title: title.trim(),
      pattern: pattern ?? null,
      colorId: colorId ?? null,
      reason: reason ?? null,
    });

    return NextResponse.json({
      success: true,
      nonGoal,
    });
  } catch (error) {
    console.error("Error creating non-goal:", error);
    return NextResponse.json(
      { error: "Failed to create non-goal" },
      { status: 500 }
    );
  }
}
