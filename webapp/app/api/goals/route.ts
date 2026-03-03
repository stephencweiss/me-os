import { NextRequest, NextResponse } from "next/server";
import {
  getGoalsForWeek,
  getGoalById,
  updateGoalProgress,
  updateGoalStatus,
  getGoalProgress,
} from "@/lib/db";

/**
 * GET /api/goals
 *
 * Query params:
 *   - week: Week ID in ISO format (YYYY-WWW) - required
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const week = searchParams.get("week");

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
    const goals = await getGoalsForWeek(week);

    // Enrich goals with progress data
    const enrichedGoals = await Promise.all(
      goals.map(async (goal) => {
        const totalMinutesLogged = await getGoalProgress(goal.id);
        return {
          ...goal,
          totalMinutesLogged,
        };
      })
    );

    return NextResponse.json({
      goals: enrichedGoals,
      count: enrichedGoals.length,
      weekId: week,
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/goals
 *
 * Body:
 *   - goalId: Goal ID to update
 *   - progressPercent?: number (0-100)
 *   - status?: "active" | "completed" | "cancelled"
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { goalId, progressPercent, status } = body;

    if (!goalId) {
      return NextResponse.json(
        { error: "goalId is required" },
        { status: 400 }
      );
    }

    // Verify goal exists
    const goal = await getGoalById(goalId);
    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Update progress if provided
    if (progressPercent !== undefined) {
      if (typeof progressPercent !== "number" || progressPercent < 0 || progressPercent > 100) {
        return NextResponse.json(
          { error: "progressPercent must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      await updateGoalProgress(goalId, progressPercent);
    }

    // Update status if provided
    if (status !== undefined) {
      if (!["active", "completed", "cancelled"].includes(status)) {
        return NextResponse.json(
          { error: "status must be 'active', 'completed', or 'cancelled'" },
          { status: 400 }
        );
      }
      await updateGoalStatus(goalId, status);
    }

    // Fetch updated goal
    const updatedGoal = await getGoalById(goalId);

    return NextResponse.json({
      success: true,
      goal: updatedGoal,
    });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}
