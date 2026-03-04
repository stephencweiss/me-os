import { NextRequest, NextResponse } from "next/server";
import { getDb, getGoalsForWeek, getGoalById } from "@/lib/db";

/**
 * Things 3 Todo structure
 */
interface Things3Todo {
  id: string;
  title: string;
  notes?: string;
  tags?: string[];
  when?: string;
  deadline?: string;
  completed?: boolean;
  checklist?: string[];
  project?: string;
  area?: string;
}

/**
 * Sync result summary
 */
interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  completed: number;
  errors: string[];
  goals: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

/**
 * Parse a Things 3 tag to a week ID
 * Input: "w14-2026" -> Output: "2026-W14"
 */
function thingsTagToWeekId(tag: string): string | null {
  const match = tag.match(/^w(\d{1,2})-(\d{4})$/i);
  if (!match) return null;
  const week = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Find week tag in a Things 3 todo's tags
 */
function findWeekTag(tags: string[]): string | null {
  for (const tag of tags) {
    const weekId = thingsTagToWeekId(tag);
    if (weekId) return weekId;
  }
  return null;
}

/**
 * Infer goal type from title and notes
 */
function inferGoalType(title: string, notes?: string): "time" | "outcome" | "habit" {
  const text = `${title} ${notes || ""}`.toLowerCase();

  // Time-based patterns: "4 hours", "2h", "30 minutes"
  const timePatterns = /(\d+\.?\d*)\s*(hours?|h|hrs?|minutes?|min|m)\b/i;
  if (timePatterns.test(text)) {
    return "time";
  }

  // Habit patterns: "3x", "daily", "weekly"
  const habitPatterns = /\b(daily|weekly|\d+x|every\s*(day|week)|routine)\b/i;
  if (habitPatterns.test(text)) {
    return "habit";
  }

  return "outcome";
}

/**
 * Parse estimated minutes from goal text
 */
function parseEstimatedMinutes(text: string): number | null {
  const patterns = [
    { regex: /(\d+\.?\d*)\s*(hours?|h|hrs?)/i, multiplier: 60 },
    { regex: /(\d+\.?\d*)\s*(minutes?|min|m)\b/i, multiplier: 1 },
  ];

  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      return Math.round(parseFloat(match[1]) * multiplier);
    }
  }

  return null;
}

/**
 * Generate composite goal ID
 */
function generateGoalId(things3Id: string, weekId: string): string {
  return `${things3Id}:${weekId}`;
}

/**
 * POST /api/goals/sync
 *
 * Sync goals from Things 3 todos to the database.
 * The webapp can't call Things 3 MCP directly, so this endpoint
 * accepts pre-fetched todos from the skill layer.
 *
 * Body:
 *   - todos: Things3Todo[] - Array of todos from Things 3
 *   - weekId?: string - Optional week to filter to (e.g., "2026-W10")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { todos, weekId: targetWeekId } = body;

    // Validate todos array
    if (!todos || !Array.isArray(todos)) {
      return NextResponse.json(
        { error: "todos array is required" },
        { status: 400 }
      );
    }

    // Validate weekId format if provided
    if (targetWeekId) {
      const weekPattern = /^\d{4}-W\d{2}$/;
      if (!weekPattern.test(targetWeekId)) {
        return NextResponse.json(
          { error: "Invalid weekId format. Expected YYYY-WWW (e.g., 2026-W10)" },
          { status: 400 }
        );
      }
    }

    const db = getDb();
    const now = new Date().toISOString();

    const result: SyncResult = {
      created: 0,
      updated: 0,
      unchanged: 0,
      completed: 0,
      errors: [],
      goals: [],
    };

    for (const todo of todos as Things3Todo[]) {
      try {
        // Validate todo has required fields
        if (!todo.id || !todo.title) {
          result.errors.push(`Todo missing id or title`);
          continue;
        }

        // Check if it has a week tag
        if (!todo.tags || todo.tags.length === 0) {
          continue; // Skip todos without tags
        }

        // Get the week from the todo's tags
        const weekId = findWeekTag(todo.tags);
        if (!weekId) {
          continue; // Skip todos without week tags
        }

        // If targeting a specific week, skip others
        if (targetWeekId && weekId !== targetWeekId) {
          continue;
        }

        const goalId = generateGoalId(todo.id, weekId);
        const goalType = inferGoalType(todo.title, todo.notes);
        const estimatedMinutes = parseEstimatedMinutes(`${todo.title} ${todo.notes || ""}`);

        // Check if goal exists
        const existingGoals = await getGoalsForWeek(weekId);
        const existing = existingGoals.find((g) => g.things3_id === todo.id);

        if (!existing) {
          // Insert new goal
          await db.execute({
            sql: `
              INSERT INTO weekly_goals (
                id, things3_id, week_id, title, notes, estimated_minutes,
                goal_type, color_id, status, progress_percent, completed_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              goalId,
              todo.id,
              weekId,
              todo.title,
              todo.notes ?? null,
              estimatedMinutes,
              goalType,
              null,
              todo.completed ? "completed" : "active",
              todo.completed ? 100 : 0,
              todo.completed ? now : null,
              now,
              now,
            ],
          });
          result.created++;
          result.goals.push({ id: goalId, title: todo.title, status: todo.completed ? "completed" : "active" });
        } else if (todo.completed && existing.status !== "completed") {
          // Mark as completed
          await db.execute({
            sql: `UPDATE weekly_goals SET status = ?, completed_at = ?, progress_percent = 100, updated_at = ? WHERE id = ?`,
            args: ["completed", now, now, existing.id],
          });
          result.completed++;
          result.goals.push({ id: existing.id, title: existing.title, status: "completed" });
        } else if (
          existing.title !== todo.title ||
          existing.notes !== (todo.notes || null)
        ) {
          // Update existing
          await db.execute({
            sql: `UPDATE weekly_goals SET title = ?, notes = ?, updated_at = ? WHERE id = ?`,
            args: [todo.title, todo.notes ?? null, now, existing.id],
          });
          result.updated++;
          result.goals.push({ id: existing.id, title: todo.title, status: existing.status });
        } else {
          result.unchanged++;
          result.goals.push({ id: existing.id, title: existing.title, status: existing.status });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to sync "${todo.title}": ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error syncing goals:", error);
    return NextResponse.json(
      { error: "Failed to sync goals" },
      { status: 500 }
    );
  }
}
