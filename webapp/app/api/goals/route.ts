import { NextRequest, NextResponse } from "next/server";
import {
  getGoalsForWeek,
  getGoalById,
  updateGoalProgress,
  updateGoalStatus,
  getGoalProgress,
  createGoal,
  updateGoal,
  getWeekDateRange,
} from "@/lib/db";

/**
 * Generate a Things 3 URL to create a new goal
 * Uses simple "week" tag with deadline-based week inference
 */
function generateThings3CreateUrl(
  title: string,
  weekId: string,
  options?: { notes?: string; estimatedMinutes?: number }
): string {
  const params = new URLSearchParams();

  params.set("title", title);
  params.set("tags", "week");

  // Set deadline to end of week (Sunday)
  const { endDate } = getWeekDateRange(weekId);
  params.set("deadline", endDate);

  // Set "when" so it appears in This Week view
  params.set("when", "this week");

  if (options?.notes) {
    params.set("notes", options.notes);
  }

  return `things:///add?${params.toString()}`;
}

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

/**
 * POST /api/goals
 *
 * Create a new goal.
 *
 * Body:
 *   - weekId: Week ID in ISO format (YYYY-WWW) - required
 *   - title: Goal title - required
 *   - colorId?: Google Calendar color ID
 *   - estimatedMinutes?: Estimated time to complete
 *   - notes?: Additional notes
 *   - goalType?: "time" | "outcome" | "habit" (default: "outcome")
 *   - syncToThings3?: boolean - if true, include Things 3 URL in response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekId, title, colorId, estimatedMinutes, notes, goalType, syncToThings3 } = body;

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

    // Validate optional fields
    if (estimatedMinutes !== undefined && estimatedMinutes !== null) {
      if (typeof estimatedMinutes !== "number" || estimatedMinutes < 0) {
        return NextResponse.json(
          { error: "estimatedMinutes must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    if (goalType !== undefined) {
      if (!["time", "outcome", "habit"].includes(goalType)) {
        return NextResponse.json(
          { error: "goalType must be 'time', 'outcome', or 'habit'" },
          { status: 400 }
        );
      }
    }

    // Create the goal
    const trimmedTitle = title.trim();
    const goal = await createGoal({
      weekId,
      title: trimmedTitle,
      colorId: colorId ?? null,
      estimatedMinutes: estimatedMinutes ?? null,
      notes: notes ?? null,
      goalType: goalType ?? "outcome",
    });

    // Generate Things 3 URL if requested
    const response: {
      success: boolean;
      goal: typeof goal;
      things3Url?: string;
    } = {
      success: true,
      goal,
    };

    if (syncToThings3) {
      response.things3Url = generateThings3CreateUrl(trimmedTitle, weekId, {
        notes: notes ?? undefined,
        estimatedMinutes: estimatedMinutes ?? undefined,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/goals
 *
 * Update a goal's editable fields.
 *
 * Body:
 *   - goalId: Goal ID to update - required
 *   - title?: New title
 *   - notes?: New notes (or null to clear)
 *   - estimatedMinutes?: New estimate (or null to clear)
 *   - goalType?: "time" | "outcome" | "habit"
 *   - colorId?: New color ID (or null to clear)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { goalId, title, notes, estimatedMinutes, goalType, colorId } = body;

    if (!goalId) {
      return NextResponse.json(
        { error: "goalId is required" },
        { status: 400 }
      );
    }

    // Verify goal exists
    const existing = await getGoalById(goalId);
    if (!existing) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    // Validate title if provided
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "title must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    // Validate estimatedMinutes if provided
    if (estimatedMinutes !== undefined && estimatedMinutes !== null) {
      if (typeof estimatedMinutes !== "number" || estimatedMinutes < 0) {
        return NextResponse.json(
          { error: "estimatedMinutes must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    // Validate goalType if provided
    if (goalType !== undefined) {
      if (!["time", "outcome", "habit"].includes(goalType)) {
        return NextResponse.json(
          { error: "goalType must be 'time', 'outcome', or 'habit'" },
          { status: 400 }
        );
      }
    }

    // Build updates object (only include provided fields)
    const updates: {
      title?: string;
      notes?: string | null;
      estimatedMinutes?: number | null;
      goalType?: "time" | "outcome" | "habit";
      colorId?: string | null;
    } = {};

    if (title !== undefined) updates.title = title.trim();
    if (notes !== undefined) updates.notes = notes;
    if (estimatedMinutes !== undefined) updates.estimatedMinutes = estimatedMinutes;
    if (goalType !== undefined) updates.goalType = goalType;
    if (colorId !== undefined) updates.colorId = colorId;

    const updatedGoal = await updateGoal(goalId, updates);

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
