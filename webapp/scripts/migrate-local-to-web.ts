#!/usr/bin/env npx tsx
/**
 * Migrate Local Mode to Web Mode
 *
 * This script exports data from the local Turso database and imports it
 * into Supabase for a specific user account.
 *
 * Usage (run from webapp directory):
 *   npx tsx scripts/migrate-local-to-web.ts --email user@example.com [--dry-run]
 *
 * Prerequisites:
 *   - Local Turso database configured (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
 *   - Supabase configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *   - User must already exist in Supabase auth
 */

import { createClient as createTursoClient } from "@libsql/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

// ============================================================================
// Configuration
// ============================================================================

const args = parseArgs({
  options: {
    email: { type: "string", short: "e" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

if (args.values.help || !args.values.email) {
  console.log(`
Migrate Local Mode to Web Mode

Usage:
  npx tsx scripts/migrate-local-to-web.ts --email user@example.com [--dry-run]

Options:
  --email, -e     Email of the user to migrate data to (required)
  --dry-run       Show what would be migrated without making changes
  --help, -h      Show this help message
`);
  process.exit(args.values.help ? 0 : 1);
}

const targetEmail = args.values.email;
const dryRun = args.values["dry-run"] ?? false;

// ============================================================================
// Database Clients
// ============================================================================

function getTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is required");
  }

  return createTursoClient({ url, authToken });
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  return createSupabaseClient(url, serviceRoleKey);
}

// ============================================================================
// Migration Functions
// ============================================================================

interface MigrationStats {
  events: { total: number; migrated: number; skipped: number };
  goals: { total: number; migrated: number; skipped: number };
  nonGoals: { total: number; migrated: number; skipped: number };
  preferences: { total: number; migrated: number; skipped: number };
  goalProgress: { total: number; migrated: number; skipped: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserId(supabase: any, email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return null;
  }

  const user = data.users.find((u: { email?: string }) => u.email === email);
  return user?.id || null;
}

async function migrateEvents(
  turso: ReturnType<typeof createTursoClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  stats: MigrationStats
): Promise<void> {
  console.log("\n📅 Migrating events...");

  const result = await turso.execute("SELECT * FROM events");
  stats.events.total = result.rows.length;

  if (dryRun) {
    console.log(`  Would migrate ${result.rows.length} events`);
    return;
  }

  for (const row of result.rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("events") as any).upsert({
      id: row.id,
      user_id: userId,
      google_event_id: row.google_event_id,
      date: row.date,
      account: row.account,
      calendar_name: row.calendar_name,
      calendar_type: row.calendar_type,
      summary: row.summary,
      description: row.description,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: row.duration_minutes,
      color_id: row.color_id,
      color_name: row.color_name,
      color_meaning: row.color_meaning,
      is_all_day: row.is_all_day === 1,
      is_recurring: row.is_recurring === 1,
      recurring_event_id: row.recurring_event_id,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      attended: row.attended,
    });

    if (error) {
      console.error(`  ⚠️  Failed to migrate event ${row.id}: ${error.message}`);
      stats.events.skipped++;
    } else {
      stats.events.migrated++;
    }
  }

  console.log(
    `  ✓ Migrated ${stats.events.migrated} events (${stats.events.skipped} skipped)`
  );
}

async function migrateGoals(
  turso: ReturnType<typeof createTursoClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  stats: MigrationStats
): Promise<void> {
  console.log("\n🎯 Migrating weekly goals...");

  const result = await turso.execute("SELECT * FROM weekly_goals");
  stats.goals.total = result.rows.length;

  if (dryRun) {
    console.log(`  Would migrate ${result.rows.length} goals`);
    return;
  }

  for (const row of result.rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("weekly_goals") as any).upsert({
      id: row.id,
      user_id: userId,
      week_id: row.week_id,
      title: row.title,
      notes: row.notes,
      estimated_minutes: row.estimated_minutes,
      goal_type: row.goal_type,
      color_id: row.color_id,
      status: row.status,
      progress_percent: row.progress_percent,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });

    if (error) {
      console.error(`  ⚠️  Failed to migrate goal ${row.id}: ${error.message}`);
      stats.goals.skipped++;
    } else {
      stats.goals.migrated++;
    }
  }

  console.log(
    `  ✓ Migrated ${stats.goals.migrated} goals (${stats.goals.skipped} skipped)`
  );
}

async function migrateNonGoals(
  turso: ReturnType<typeof createTursoClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  stats: MigrationStats
): Promise<void> {
  console.log("\n🚫 Migrating non-goals...");

  const result = await turso.execute("SELECT * FROM non_goals");
  stats.nonGoals.total = result.rows.length;

  if (dryRun) {
    console.log(`  Would migrate ${result.rows.length} non-goals`);
    return;
  }

  for (const row of result.rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("non_goals") as any).upsert({
      id: row.id,
      user_id: userId,
      week_id: row.week_id,
      title: row.title,
      pattern: row.pattern,
      color_id: row.color_id,
      reason: row.reason,
      active: row.active === 1,
      status: row.status,
      created_at: row.created_at,
    });

    if (error) {
      console.error(
        `  ⚠️  Failed to migrate non-goal ${row.id}: ${error.message}`
      );
      stats.nonGoals.skipped++;
    } else {
      stats.nonGoals.migrated++;
    }
  }

  console.log(
    `  ✓ Migrated ${stats.nonGoals.migrated} non-goals (${stats.nonGoals.skipped} skipped)`
  );
}

async function migratePreferences(
  turso: ReturnType<typeof createTursoClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  stats: MigrationStats
): Promise<void> {
  console.log("\n⚙️  Migrating preferences...");

  const result = await turso.execute("SELECT * FROM user_preferences");
  stats.preferences.total = result.rows.length;

  if (dryRun) {
    console.log(`  Would migrate ${result.rows.length} preferences`);
    return;
  }

  for (const row of result.rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("user_preferences") as any).upsert({
      user_id: userId,
      key: row.key,
      value: row.value,
    });

    if (error) {
      console.error(
        `  ⚠️  Failed to migrate preference ${row.key}: ${error.message}`
      );
      stats.preferences.skipped++;
    } else {
      stats.preferences.migrated++;
    }
  }

  console.log(
    `  ✓ Migrated ${stats.preferences.migrated} preferences (${stats.preferences.skipped} skipped)`
  );
}

async function migrateGoalProgress(
  turso: ReturnType<typeof createTursoClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  stats: MigrationStats
): Promise<void> {
  console.log("\n📊 Migrating goal progress...");

  try {
    const result = await turso.execute("SELECT * FROM goal_progress");
    stats.goalProgress.total = result.rows.length;

    if (dryRun) {
      console.log(`  Would migrate ${result.rows.length} progress records`);
      return;
    }

    for (const row of result.rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("goal_progress") as any).upsert({
        user_id: userId,
        goal_id: row.goal_id,
        event_id: row.event_id,
        matched_at: row.matched_at,
        match_type: row.match_type,
        match_confidence: row.match_confidence,
        minutes_contributed: row.minutes_contributed,
      });

      if (error) {
        console.error(
          `  ⚠️  Failed to migrate progress record: ${error.message}`
        );
        stats.goalProgress.skipped++;
      } else {
        stats.goalProgress.migrated++;
      }
    }

    console.log(
      `  ✓ Migrated ${stats.goalProgress.migrated} progress records (${stats.goalProgress.skipped} skipped)`
    );
  } catch {
    console.log("  ℹ️  No goal_progress table found, skipping...");
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🚀 MeOS Local to Web Migration");
  console.log("================================");
  console.log(`Target user: ${targetEmail}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  const stats: MigrationStats = {
    events: { total: 0, migrated: 0, skipped: 0 },
    goals: { total: 0, migrated: 0, skipped: 0 },
    nonGoals: { total: 0, migrated: 0, skipped: 0 },
    preferences: { total: 0, migrated: 0, skipped: 0 },
    goalProgress: { total: 0, migrated: 0, skipped: 0 },
  };

  try {
    // Initialize clients
    const turso = getTursoClient();
    const supabase = getSupabaseClient();

    // Get user ID
    console.log("\n🔍 Looking up user...");
    const userId = await getUserId(supabase, targetEmail);
    if (!userId) {
      console.error(`❌ User not found: ${targetEmail}`);
      console.log("Please ensure the user has signed up in the webapp first.");
      process.exit(1);
    }
    console.log(`  ✓ Found user: ${userId}`);

    // Run migrations
    await migrateEvents(turso, supabase, userId, stats);
    await migrateGoals(turso, supabase, userId, stats);
    await migrateNonGoals(turso, supabase, userId, stats);
    await migratePreferences(turso, supabase, userId, stats);
    await migrateGoalProgress(turso, supabase, userId, stats);

    // Summary
    console.log("\n================================");
    console.log("📋 Migration Summary");
    console.log("================================");
    console.log(`Events:      ${stats.events.migrated}/${stats.events.total}`);
    console.log(`Goals:       ${stats.goals.migrated}/${stats.goals.total}`);
    console.log(
      `Non-Goals:   ${stats.nonGoals.migrated}/${stats.nonGoals.total}`
    );
    console.log(
      `Preferences: ${stats.preferences.migrated}/${stats.preferences.total}`
    );
    console.log(
      `Progress:    ${stats.goalProgress.migrated}/${stats.goalProgress.total}`
    );

    if (dryRun) {
      console.log("\n⚠️  This was a dry run. No data was actually migrated.");
      console.log("Run without --dry-run to perform the actual migration.");
    } else {
      console.log("\n✅ Migration complete!");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
