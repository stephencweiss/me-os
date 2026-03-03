/**
 * Things 3 Sync Library
 *
 * Handles syncing goals between Things 3 and the local database.
 * Uses the Things 3 MCP server for reading and writing todos.
 *
 * Note: This module expects the Things 3 MCP server to be available.
 * MCP tool calls are made by the skill layer, not directly here.
 */

import {
  upsertWeeklyGoal,
  updateGoalStatus,
  getGoalsForWeek,
  type StoredWeeklyGoal,
} from "./calendar-db.js";

import {
  thingsTagToWeekId,
  weekIdToThingsTag,
  inferGoalType,
  parseEstimatedMinutes,
} from "./weekly-goals.js";

// ============================================================================
// Things 3 Data Types
// ============================================================================

/**
 * Todo item from Things 3 MCP
 * This matches the structure returned by the things3 MCP server
 */
export interface Things3Todo {
  id: string;
  title: string;
  notes?: string;
  tags?: string[];
  when?: string; // Schedule date
  deadline?: string;
  completed?: boolean;
  checklist?: string[];
  project?: string;
  area?: string;
}

/**
 * Project from Things 3 MCP
 */
export interface Things3Project {
  id: string;
  title: string;
  notes?: string;
  tags?: string[];
  area?: string;
}

/**
 * Sync result summary
 */
export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  completed: number;
  errors: string[];
  goals: StoredWeeklyGoal[];
}

// ============================================================================
// Parsing and Conversion
// ============================================================================

/**
 * Find week tag in a Things 3 todo's tags
 */
export function findWeekTag(tags: string[]): string | null {
  for (const tag of tags) {
    const weekId = thingsTagToWeekId(tag);
    if (weekId) return weekId;
  }
  return null;
}

/**
 * Check if a todo is a goal (has a week tag)
 */
export function isWeeklyGoal(todo: Things3Todo): boolean {
  return !!(todo.tags && findWeekTag(todo.tags));
}

/**
 * Check if a todo is a non-goal (has specific non-goal indicator)
 * Convention: todos with "non-goal" or "avoid" tag
 */
export function isNonGoal(todo: Things3Todo): boolean {
  if (!todo.tags) return false;
  return todo.tags.some(
    (tag) =>
      tag.toLowerCase() === "non-goal" ||
      tag.toLowerCase() === "non-goals" ||
      tag.toLowerCase() === "avoid"
  );
}

/**
 * Convert a Things 3 todo to a WeeklyGoal
 */
export function things3TodoToWeeklyGoal(
  todo: Things3Todo,
  weekId: string
): Omit<StoredWeeklyGoal, "id" | "created_at" | "updated_at"> {
  const goalType = inferGoalType(todo.title, todo.notes);
  const estimatedMinutes = parseEstimatedMinutes(`${todo.title} ${todo.notes || ""}`);

  return {
    things3_id: todo.id,
    week_id: weekId,
    title: todo.title,
    notes: todo.notes || null,
    estimated_minutes: estimatedMinutes,
    goal_type: goalType,
    color_id: null, // Will be set by user or inferred later
    status: todo.completed ? "completed" : "active",
    progress_percent: todo.completed ? 100 : 0,
    completed_at: todo.completed ? new Date().toISOString() : null,
  };
}

// ============================================================================
// Sync Logic
// ============================================================================

/**
 * Sync goals from Things 3 todos to local database
 */
export async function syncGoalsFromThings3(
  todos: Things3Todo[],
  targetWeekId?: string
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    completed: 0,
    errors: [],
    goals: [],
  };

  for (const todo of todos) {
    try {
      // Skip if not a weekly goal
      if (!isWeeklyGoal(todo)) continue;

      // Get the week from the todo's tags
      const weekId = findWeekTag(todo.tags || []);
      if (!weekId) continue;

      // If targeting a specific week, skip others
      if (targetWeekId && weekId !== targetWeekId) continue;

      // Convert and upsert
      const goalData = things3TodoToWeeklyGoal(todo, weekId);
      const existingGoals = await getGoalsForWeek(weekId);
      const existing = existingGoals.find((g) => g.things3_id === todo.id);

      const goal = await upsertWeeklyGoal(goalData);
      result.goals.push(goal);

      if (!existing) {
        result.created++;
      } else if (todo.completed && existing.status !== "completed") {
        result.completed++;
      } else if (
        existing.title !== todo.title ||
        existing.notes !== (todo.notes || null)
      ) {
        result.updated++;
      } else {
        result.unchanged++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to sync "${todo.title}": ${message}`);
    }
  }

  return result;
}

/**
 * Mark local goals as completed if they're completed in Things 3
 */
export async function syncCompletionStatus(
  todos: Things3Todo[],
  weekId: string
): Promise<{ completed: string[]; reactivated: string[] }> {
  const result = { completed: [] as string[], reactivated: [] as string[] };
  const localGoals = await getGoalsForWeek(weekId);

  for (const goal of localGoals) {
    const matchingTodo = todos.find((t) => t.id === goal.things3_id);
    if (!matchingTodo) continue;

    if (matchingTodo.completed && goal.status === "active") {
      await updateGoalStatus(goal.id, "completed");
      result.completed.push(goal.title);
    } else if (!matchingTodo.completed && goal.status === "completed") {
      await updateGoalStatus(goal.id, "active");
      result.reactivated.push(goal.title);
    }
  }

  return result;
}

// ============================================================================
// Things 3 URL Generation
// ============================================================================

/**
 * Generate a Things 3 URL to create a new goal
 */
export function generateCreateGoalUrl(
  title: string,
  weekId: string,
  options?: {
    notes?: string;
    deadline?: string;
    list?: string;
    checklist?: string[];
  }
): string {
  const tag = weekIdToThingsTag(weekId);
  const params = new URLSearchParams();

  params.set("title", title);
  params.set("tags", tag);

  if (options?.notes) {
    params.set("notes", options.notes);
  }

  if (options?.deadline) {
    params.set("deadline", options.deadline);
  }

  if (options?.list) {
    params.set("list", options.list);
  }

  if (options?.checklist && options.checklist.length > 0) {
    params.set("checklist-items", options.checklist.join("\n"));
  }

  // Set "when" to beginning of the week for visibility
  params.set("when", "this week");

  return `things:///add?${params.toString()}`;
}

/**
 * Generate a Things 3 URL to show goals for a week
 */
export function generateSearchGoalsUrl(weekId: string): string {
  const tag = weekIdToThingsTag(weekId);
  return `things:///search?query=${encodeURIComponent(`#${tag}`)}`;
}

/**
 * Generate a Things 3 URL to complete a goal (requires auth token)
 */
export function generateCompleteGoalUrl(
  things3Id: string,
  authToken: string
): string {
  const params = new URLSearchParams();
  params.set("id", things3Id);
  params.set("completed", "true");
  params.set("auth-token", authToken);
  return `things:///update?${params.toString()}`;
}

// ============================================================================
// MCP Tool Helpers
// ============================================================================

/**
 * Build parameters for Things 3 MCP search
 */
export function buildSearchParams(weekId: string): { query: string } {
  const tag = weekIdToThingsTag(weekId);
  return { query: `#${tag}` };
}

/**
 * Build parameters for Things 3 MCP create
 */
export function buildCreateParams(
  title: string,
  weekId: string,
  options?: {
    notes?: string;
    tags?: string[];
    deadline?: string;
    checklist?: string[];
  }
): Record<string, unknown> {
  const weekTag = weekIdToThingsTag(weekId);
  const tags = [weekTag, ...(options?.tags || [])];

  return {
    title,
    tags: tags.join(","),
    notes: options?.notes,
    deadline: options?.deadline,
    "checklist-items": options?.checklist?.join("\n"),
    when: "this week",
  };
}

/**
 * Format sync result for display
 */
export function formatSyncResult(result: SyncResult): string {
  const lines: string[] = ["## Sync Complete\n"];

  lines.push(`- **Created:** ${result.created} new goals`);
  lines.push(`- **Updated:** ${result.updated} goals`);
  lines.push(`- **Completed:** ${result.completed} goals marked done`);
  lines.push(`- **Unchanged:** ${result.unchanged} goals`);

  if (result.errors.length > 0) {
    lines.push("\n### Errors\n");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (result.goals.length > 0) {
    lines.push("\n### Goals\n");
    for (const goal of result.goals) {
      const status = goal.status === "completed" ? "" : "";
      lines.push(`- ${status} ${goal.title} (${goal.goal_type})`);
    }
  }

  return lines.join("\n");
}
