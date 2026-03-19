import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import {
  getNonGoalsForWeek,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  createNonGoal,
  updateNonGoalStatus,
  NON_GOAL_STATUS,
  type NonGoalStatus,
} from "@/lib/db-unified";

/**
 * GET /api/non-goals
 *
 * Query params:
 *   - week: Week ID in ISO format (YYYY-WWW) - required
 *   - includeAlerts: Include unacknowledged alerts (default: true)
 */
export async function GET(request: NextRequest) {
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

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
    const nonGoals = await getNonGoalsForWeek(userId, week);

    let alerts: Awaited<ReturnType<typeof getUnacknowledgedAlerts>> = [];
    if (includeAlerts) {
      alerts = await getUnacknowledgedAlerts(userId, week);
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
 * Body (one of):
 *   - alertId: Alert ID to acknowledge
 *   - nonGoalId + status: Update non-goal status (0=active, 1=completed, 2=missed, 3=abandoned)
 */
export async function PATCH(request: NextRequest) {
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { alertId, nonGoalId, status } = body;

    // Handle alert acknowledgment
    if (alertId !== undefined) {
      if (typeof alertId !== "number") {
        return NextResponse.json(
          { error: "alertId must be a number" },
          { status: 400 }
        );
      }

      await acknowledgeAlert(userId, alertId);

      return NextResponse.json({
        success: true,
        alertId,
        acknowledged: true,
      });
    }

    // Handle non-goal status update
    if (nonGoalId !== undefined && status !== undefined) {
      if (typeof nonGoalId !== "string") {
        return NextResponse.json(
          { error: "nonGoalId must be a string" },
          { status: 400 }
        );
      }

      // Validate status is a valid value
      const validStatuses = [
        NON_GOAL_STATUS.ACTIVE,
        NON_GOAL_STATUS.COMPLETED,
        NON_GOAL_STATUS.MISSED,
        NON_GOAL_STATUS.ABANDONED,
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "status must be 0 (active), 1 (completed), 2 (missed), or 3 (abandoned)" },
          { status: 400 }
        );
      }

      const updated = await updateNonGoalStatus(userId, nonGoalId, status as NonGoalStatus);

      if (!updated) {
        return NextResponse.json(
          { error: "Non-goal not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        nonGoal: updated,
      });
    }

    return NextResponse.json(
      { error: "Either alertId or (nonGoalId + status) is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating non-goal:", error);
    return NextResponse.json(
      { error: "Failed to update" },
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
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

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
    const nonGoal = await createNonGoal(userId, {
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
