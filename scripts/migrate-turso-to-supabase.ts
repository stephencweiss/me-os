#!/usr/bin/env -S pnpm exec tsx
/**
 * Migration Script: Turso → Supabase
 *
 * This script migrates data from the local Turso/SQLite database to Supabase.
 * It's designed for single-user migration when transitioning from CLI to web app.
 *
 * Usage:
 *   1. Set up Supabase project and run `pnpm db:push` (includes 00000 next_auth + MeOS migrations)
 *   2. Create a user account in the web app (sign in with Google)
 *   3. Get your Supabase user ID from the auth.users table
 *   4. Run: pnpm exec tsx scripts/migrate-turso-to-supabase.ts --user-id <your-user-id>
 *
 * Options:
 *   --user-id <id>     Required. Your Supabase user ID (UUID)
 *   --dry-run          Preview changes without writing to Supabase
 *   --export-only      Only export to JSON, don't import
 *   --import-only      Only import from existing JSON export
 */

import { createClient as createTursoClient } from "@libsql/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Types matching the Turso schema
interface TursoEvent {
  id: string;
  google_event_id: string;
  date: string;
  account: string;
  calendar_name: string;
  calendar_type: string;
  summary: string;
  description: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  color_id: string;
  color_name: string;
  color_meaning: string;
  is_all_day: number;
  is_recurring: number;
  recurring_event_id: string | null;
  first_seen: string;
  last_seen: string;
  attended: string;
  auto_categorized: number;
}

interface TursoDailySummary {
  date: string;
  total_scheduled_minutes: number;
  total_gap_minutes: number;
  categories_json: string;
  is_work_day: number;
  analysis_hours_start: number;
  analysis_hours_end: number;
  snapshot_time: string;
}

interface TursoWeeklyGoal {
  id: string;
  things3_id: string;
  week_id: string;
  title: string;
  notes: string | null;
  estimated_minutes: number | null;
  goal_type: string;
  color_id: string | null;
  status: string;
  progress_percent: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TursoNonGoal {
  id: string;
  week_id: string;
  title: string;
  pattern: string;
  color_id: string | null;
  reason: string | null;
  active: number;
  created_at: string;
}

interface TursoGoalProgress {
  id: number;
  goal_id: string;
  event_id: string;
  matched_at: string;
  match_type: string;
  match_confidence: number | null;
  minutes_contributed: number;
}

interface TursoNonGoalAlert {
  id: number;
  non_goal_id: string;
  event_id: string;
  detected_at: string;
  acknowledged: number;
}

interface TursoUserPreference {
  key: string;
  value: string;
}

interface ExportData {
  exportedAt: string;
  events: TursoEvent[];
  dailySummaries: TursoDailySummary[];
  weeklyGoals: TursoWeeklyGoal[];
  nonGoals: TursoNonGoal[];
  goalProgress: TursoGoalProgress[];
  nonGoalAlerts: TursoNonGoalAlert[];
  userPreferences: TursoUserPreference[];
}

// Parse command line arguments
function parseArgs(): {
  userId: string | null;
  dryRun: boolean;
  exportOnly: boolean;
  importOnly: boolean;
} {
  const args = process.argv.slice(2);
  let userId: string | null = null;
  let dryRun = false;
  let exportOnly = false;
  let importOnly = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--user-id":
        userId = args[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--export-only":
        exportOnly = true;
        break;
      case "--import-only":
        importOnly = true;
        break;
    }
  }

  return { userId, dryRun, exportOnly, importOnly };
}

// Load Turso config
function loadTursoConfig(): { url: string; authToken: string } | null {
  const configPath = path.join(process.cwd(), "config", "turso.json");
  if (!fs.existsSync(configPath)) {
    // Try local SQLite database
    const localDbPath = path.join(process.cwd(), "data", "calendar.db");
    if (fs.existsSync(localDbPath)) {
      return { url: `file:${localDbPath}`, authToken: "" };
    }
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// Export data from Turso
async function exportFromTurso(): Promise<ExportData> {
  const config = loadTursoConfig();
  if (!config) {
    throw new Error(
      "No Turso config or local database found. Check config/turso.json or data/calendar.db"
    );
  }

  console.log("Connecting to Turso database...");
  const turso = createTursoClient({
    url: config.url,
    authToken: config.authToken || undefined,
  });

  console.log("Exporting events...");
  const eventsResult = await turso.execute("SELECT * FROM events");
  const events = eventsResult.rows as unknown as TursoEvent[];
  console.log(`  Found ${events.length} events`);

  console.log("Exporting daily summaries...");
  const summariesResult = await turso.execute("SELECT * FROM daily_summaries");
  const dailySummaries =
    summariesResult.rows as unknown as TursoDailySummary[];
  console.log(`  Found ${dailySummaries.length} summaries`);

  console.log("Exporting weekly goals...");
  let weeklyGoals: TursoWeeklyGoal[] = [];
  try {
    const goalsResult = await turso.execute("SELECT * FROM weekly_goals");
    weeklyGoals = goalsResult.rows as unknown as TursoWeeklyGoal[];
    console.log(`  Found ${weeklyGoals.length} goals`);
  } catch {
    console.log("  No weekly_goals table found");
  }

  console.log("Exporting non-goals...");
  let nonGoals: TursoNonGoal[] = [];
  try {
    const nonGoalsResult = await turso.execute("SELECT * FROM non_goals");
    nonGoals = nonGoalsResult.rows as unknown as TursoNonGoal[];
    console.log(`  Found ${nonGoals.length} non-goals`);
  } catch {
    console.log("  No non_goals table found");
  }

  console.log("Exporting goal progress...");
  let goalProgress: TursoGoalProgress[] = [];
  try {
    const progressResult = await turso.execute("SELECT * FROM goal_progress");
    goalProgress = progressResult.rows as unknown as TursoGoalProgress[];
    console.log(`  Found ${goalProgress.length} progress records`);
  } catch {
    console.log("  No goal_progress table found");
  }

  console.log("Exporting non-goal alerts...");
  let nonGoalAlerts: TursoNonGoalAlert[] = [];
  try {
    const alertsResult = await turso.execute("SELECT * FROM non_goal_alerts");
    nonGoalAlerts = alertsResult.rows as unknown as TursoNonGoalAlert[];
    console.log(`  Found ${nonGoalAlerts.length} alerts`);
  } catch {
    console.log("  No non_goal_alerts table found");
  }

  console.log("Exporting user preferences...");
  let userPreferences: TursoUserPreference[] = [];
  try {
    const prefsResult = await turso.execute("SELECT * FROM user_preferences");
    userPreferences = prefsResult.rows as unknown as TursoUserPreference[];
    console.log(`  Found ${userPreferences.length} preferences`);
  } catch {
    console.log("  No user_preferences table found");
  }

  turso.close();

  return {
    exportedAt: new Date().toISOString(),
    events,
    dailySummaries,
    weeklyGoals,
    nonGoals,
    goalProgress,
    nonGoalAlerts,
    userPreferences,
  };
}

// Save export to JSON file
function saveExport(data: ExportData): string {
  const exportDir = path.join(process.cwd(), "data", "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const filename = `turso-export-${new Date().toISOString().split("T")[0]}.json`;
  const filepath = path.join(exportDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\nExport saved to: ${filepath}`);
  return filepath;
}

// Load export from JSON file
function loadExport(): ExportData {
  const exportDir = path.join(process.cwd(), "data", "exports");
  const files = fs
    .readdirSync(exportDir)
    .filter((f) => f.startsWith("turso-export-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error("No export files found. Run with --export-only first.");
  }

  const filepath = path.join(exportDir, files[0]);
  console.log(`Loading export from: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

// Import data to Supabase
async function importToSupabase(
  data: ExportData,
  userId: string,
  dryRun: boolean
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  console.log("\nConnecting to Supabase...");
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  // Verify user exists
  const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    throw new Error(`User not found: ${userId}. Please sign in to the web app first.`);
  }
  console.log(`Importing for user: ${user.user?.email}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would import:");
    console.log(`  - ${data.events.length} events`);
    console.log(`  - ${data.dailySummaries.length} daily summaries`);
    console.log(`  - ${data.weeklyGoals.length} weekly goals`);
    console.log(`  - ${data.nonGoals.length} non-goals`);
    console.log(`  - ${data.goalProgress.length} goal progress records`);
    console.log(`  - ${data.nonGoalAlerts.length} non-goal alerts`);
    console.log(`  - ${data.userPreferences.length} user preferences`);
    return;
  }

  // Import events
  if (data.events.length > 0) {
    console.log(`\nImporting ${data.events.length} events...`);
    const eventsToInsert = data.events.map((e) => ({
      id: e.id,
      user_id: userId,
      google_event_id: e.google_event_id,
      date: e.date,
      account: e.account,
      calendar_name: e.calendar_name,
      calendar_type: e.calendar_type,
      summary: e.summary,
      description: e.description,
      start_time: e.start_time,
      end_time: e.end_time,
      duration_minutes: e.duration_minutes,
      color_id: e.color_id,
      color_name: e.color_name,
      color_meaning: e.color_meaning,
      is_all_day: e.is_all_day === 1,
      is_recurring: e.is_recurring === 1,
      recurring_event_id: e.recurring_event_id,
      first_seen: e.first_seen,
      last_seen: e.last_seen,
      attended: e.attended,
      auto_categorized: e.auto_categorized === 1,
    }));

    // Insert in batches of 500
    for (let i = 0; i < eventsToInsert.length; i += 500) {
      const batch = eventsToInsert.slice(i, i + 500);
      const { error } = await supabase.from("events").upsert(batch);
      if (error) {
        console.error(`  Error inserting events batch ${i / 500 + 1}:`, error.message);
      } else {
        console.log(`  Inserted batch ${i / 500 + 1} (${batch.length} events)`);
      }
    }
  }

  // Import daily summaries
  if (data.dailySummaries.length > 0) {
    console.log(`\nImporting ${data.dailySummaries.length} daily summaries...`);
    const summariesToInsert = data.dailySummaries.map((s) => ({
      user_id: userId,
      date: s.date,
      total_scheduled_minutes: s.total_scheduled_minutes,
      total_gap_minutes: s.total_gap_minutes,
      categories_json: JSON.parse(s.categories_json),
      is_work_day: s.is_work_day === 1,
      analysis_hours_start: s.analysis_hours_start,
      analysis_hours_end: s.analysis_hours_end,
      snapshot_time: s.snapshot_time,
    }));

    const { error } = await supabase.from("daily_summaries").upsert(summariesToInsert);
    if (error) {
      console.error("  Error inserting summaries:", error.message);
    } else {
      console.log("  Done");
    }
  }

  // Import weekly goals (transform from things3_id format to native format)
  if (data.weeklyGoals.length > 0) {
    console.log(`\nImporting ${data.weeklyGoals.length} weekly goals...`);
    const goalsToInsert = data.weeklyGoals.map((g) => ({
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      week_id: g.week_id,
      title: g.title,
      notes: g.notes,
      estimated_minutes: g.estimated_minutes,
      goal_type: g.goal_type,
      color_id: g.color_id,
      status: g.status,
      progress_percent: g.progress_percent,
      completed_at: g.completed_at,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    const { error } = await supabase.from("weekly_goals").upsert(goalsToInsert);
    if (error) {
      console.error("  Error inserting goals:", error.message);
    } else {
      console.log("  Done");
    }
  }

  // Import non-goals
  if (data.nonGoals.length > 0) {
    console.log(`\nImporting ${data.nonGoals.length} non-goals...`);
    const nonGoalsToInsert = data.nonGoals.map((n) => ({
      id: n.id,
      user_id: userId,
      week_id: n.week_id,
      title: n.title,
      pattern: n.pattern,
      color_id: n.color_id,
      reason: n.reason,
      active: n.active === 1,
      created_at: n.created_at,
    }));

    const { error } = await supabase.from("non_goals").upsert(nonGoalsToInsert);
    if (error) {
      console.error("  Error inserting non-goals:", error.message);
    } else {
      console.log("  Done");
    }
  }

  // Import user preferences
  if (data.userPreferences.length > 0) {
    console.log(`\nImporting ${data.userPreferences.length} user preferences...`);
    const prefsToInsert = data.userPreferences.map((p) => ({
      user_id: userId,
      key: p.key,
      value: p.value,
    }));

    const { error } = await supabase.from("user_preferences").upsert(prefsToInsert);
    if (error) {
      console.error("  Error inserting preferences:", error.message);
    } else {
      console.log("  Done");
    }
  }

  // Note: goal_progress and non_goal_alerts require the goal IDs to match
  // Since we're generating new IDs for goals, we skip these for now
  if (data.goalProgress.length > 0) {
    console.log(`\nSkipping ${data.goalProgress.length} goal progress records (requires ID mapping)`);
  }
  if (data.nonGoalAlerts.length > 0) {
    console.log(`Skipping ${data.nonGoalAlerts.length} non-goal alerts (requires ID mapping)`);
  }

  console.log("\nMigration complete!");
}

// Main
async function main() {
  const { userId, dryRun, exportOnly, importOnly } = parseArgs();

  console.log("=== Turso to Supabase Migration ===\n");

  if (!exportOnly && !importOnly && !userId) {
    console.error("Error: --user-id is required for migration");
    console.log("\nUsage:");
    console.log(
      "  pnpm exec tsx scripts/migrate-turso-to-supabase.ts --user-id <your-user-id>"
    );
    console.log(
      "  pnpm exec tsx scripts/migrate-turso-to-supabase.ts --export-only"
    );
    console.log(
      "  pnpm exec tsx scripts/migrate-turso-to-supabase.ts --import-only --user-id <your-user-id>"
    );
    console.log(
      "  pnpm exec tsx scripts/migrate-turso-to-supabase.ts --dry-run --user-id <your-user-id>"
    );
    process.exit(1);
  }

  let data: ExportData;

  if (importOnly) {
    data = loadExport();
  } else {
    data = await exportFromTurso();
    saveExport(data);
  }

  if (!exportOnly && userId) {
    await importToSupabase(data, userId, dryRun);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
