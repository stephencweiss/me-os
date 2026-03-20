#!/usr/bin/env -S pnpm exec tsx

/**
 * Sync Goals Script
 *
 * CLI tool for syncing weekly goals from Things 3 to the local database.
 *
 * Usage:
 *   pnpm exec tsx scripts/sync-goals.ts [options]
 *
 * Options:
 *   --week <YYYY-WNN>  Target week (default: current week)
 *   --dry-run          Show what would be synced without making changes
 *   --help             Show this help message
 *
 * Note: This script requires the Things 3 MCP server to provide todo data.
 * When run standalone, it expects todos to be piped in as JSON.
 *
 * Example:
 *   # Pipe todos from Things 3 MCP
 *   echo '[{"id":"1","title":"Test goal","tags":["w10-2026"]}]' | pnpm exec tsx scripts/sync-goals.ts
 */

import {
  syncGoalsFromThings3,
  formatSyncResult,
  type Things3Todo,
} from "../lib/things3-sync.js";

import {
  getCurrentWeekId,
  formatWeekIdForDisplay,
  runNonGoalDetectionForWeek,
} from "../lib/weekly-goals.js";

import {
  initDatabase,
  closeDatabase,
  getGoalsForWeek,
  type StoredWeeklyGoal,
} from "../lib/calendar-db.js";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  weekId: string;
  dryRun: boolean;
  help: boolean;
  detectNonGoals: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    weekId: getCurrentWeekId(),
    dryRun: false,
    help: false,
    detectNonGoals: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--week" && args[i + 1]) {
      result.weekId = args[++i];
    } else if (arg === "--no-detect") {
      result.detectNonGoals = false;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
Sync Goals - Sync weekly goals from Things 3 to local database

Usage:
  pnpm exec tsx scripts/sync-goals.ts [options]

Options:
  --week <YYYY-WNN>  Target week ID (default: current week)
  --dry-run          Preview changes without applying them
  --no-detect        Skip non-goal detection
  --help, -h         Show this help message

Examples:
  # Sync current week (reads from stdin)
  echo '[...]' | pnpm exec tsx scripts/sync-goals.ts

  # Sync specific week
  echo '[...]' | pnpm exec tsx scripts/sync-goals.ts --week 2026-W14

  # Preview changes
  echo '[...]' | pnpm exec tsx scripts/sync-goals.ts --dry-run

Input Format (JSON on stdin):
  [
    {
      "id": "things3-id",
      "title": "Goal title",
      "notes": "Optional notes",
      "tags": ["w10-2026"],
      "completed": false
    }
  ]
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log(`\n📅 Syncing goals for ${formatWeekIdForDisplay(args.weekId)}\n`);

  // Initialize database
  await initDatabase();

  try {
    // Read todos from stdin
    const chunks: Buffer[] = [];

    // Check if stdin has data
    if (!process.stdin.isTTY) {
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
    }

    const input = Buffer.concat(chunks).toString("utf-8").trim();

    if (!input) {
      // No input - just show current goals
      console.log("No input provided. Showing current goals:\n");
      const goals = await getGoalsForWeek(args.weekId);

      if (goals.length === 0) {
        console.log("No goals found for this week.\n");
        console.log("Tip: Pipe Things 3 todos as JSON to sync goals:");
        console.log('  echo \'[{"id":"1","title":"Goal","tags":["w10-2026"]}]\' | pnpm exec tsx scripts/sync-goals.ts\n');
      } else {
        displayGoals(goals);
      }

      return;
    }

    // Parse todos from input
    let todos: Things3Todo[];
    try {
      todos = JSON.parse(input);
      if (!Array.isArray(todos)) {
        throw new Error("Input must be a JSON array");
      }
    } catch (e) {
      console.error("Failed to parse input JSON:", e);
      process.exit(1);
    }

    console.log(`📥 Received ${todos.length} todos from input\n`);

    if (args.dryRun) {
      console.log("🔍 Dry run mode - no changes will be made\n");
      // Just show what would be synced
      const weekTodos = todos.filter((t) => {
        const tags = t.tags || [];
        return tags.some((tag) => tag.toLowerCase().includes("w") && tag.includes("-"));
      });
      console.log(`Found ${weekTodos.length} todos with week tags\n`);

      for (const todo of weekTodos) {
        const status = todo.completed ? "✅" : "⬜";
        console.log(`  ${status} ${todo.title}`);
        console.log(`     Tags: ${(todo.tags || []).join(", ")}`);
      }
      return;
    }

    // Sync goals
    const result = await syncGoalsFromThings3(todos, args.weekId);
    console.log(formatSyncResult(result));

    // Detect non-goals if enabled
    if (args.detectNonGoals && result.goals.length > 0) {
      console.log("\n🔍 Running non-goal detection...\n");
      const alerts = await runNonGoalDetectionForWeek(args.weekId);
      if (alerts.length > 0) {
        console.log(`⚠️  Found ${alerts.length} events matching non-goals`);
      } else {
        console.log("✅ No non-goal matches detected");
      }
    }
  } finally {
    closeDatabase();
  }
}

function displayGoals(goals: StoredWeeklyGoal[]): void {
  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");
  const cancelled = goals.filter((g) => g.status === "cancelled");

  if (active.length > 0) {
    console.log("### Active Goals\n");
    for (const goal of active) {
      const progress = goal.progress_percent > 0 ? ` (${goal.progress_percent}%)` : "";
      console.log(`  ⬜ ${goal.title}${progress}`);
      if (goal.estimated_minutes) {
        console.log(`     Estimated: ${goal.estimated_minutes} minutes`);
      }
    }
    console.log();
  }

  if (completed.length > 0) {
    console.log("### Completed Goals\n");
    for (const goal of completed) {
      console.log(`  ✅ ${goal.title}`);
    }
    console.log();
  }

  if (cancelled.length > 0) {
    console.log("### Cancelled Goals\n");
    for (const goal of cancelled) {
      console.log(`  ❌ ${goal.title}`);
    }
    console.log();
  }
}

// Run
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
