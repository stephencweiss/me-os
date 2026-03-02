#!/usr/bin/env node
/**
 * Calendar Sync CLI
 *
 * Syncs Google Calendar events to the local SQLite database.
 * Detects additions, modifications, and removals.
 *
 * Usage:
 *   npx ts-node scripts/sync-calendar.ts                    # Last 30 days
 *   npx ts-node scripts/sync-calendar.ts --days 7           # Last 7 days
 *   npx ts-node scripts/sync-calendar.ts --from 2024-01-01 --to 2024-01-31
 *   npx ts-node scripts/sync-calendar.ts --verbose          # Show each change
 */

import { syncCalendar, previewSync, type SyncOptions } from "../lib/calendar-sync.js";
import { closeDatabase } from "../lib/calendar-db.js";

function printHelp(): void {
  console.log(`
Calendar Sync CLI

Syncs Google Calendar events to the local SQLite database for historical
tracking and visualization. Detects additions, modifications, and removals.

Usage:
  npx ts-node scripts/sync-calendar.ts [options]

Options:
  --days <N>              Sync last N days (default: 30)
  --from <date>           Start date (YYYY-MM-DD)
  --to <date>             End date (YYYY-MM-DD)
  --preview               Show what would be synced without making changes
  --verbose, -v           Show each change as it happens
  --help, -h              Show this help message

Examples:
  npx ts-node scripts/sync-calendar.ts                    # Last 30 days
  npx ts-node scripts/sync-calendar.ts --days 7           # Last week
  npx ts-node scripts/sync-calendar.ts --days 90          # Last 90 days
  npx ts-node scripts/sync-calendar.ts --from 2024-01-01 --to 2024-01-31
  npx ts-node scripts/sync-calendar.ts --preview          # Preview changes
  npx ts-node scripts/sync-calendar.ts -v                 # Verbose output

Database Location:
  data/calendar.db

After syncing, generate a dashboard with:
  npx ts-node scripts/generate-dashboard.ts
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: SyncOptions = {};
  let preview = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--days" && args[i + 1]) {
      options.days = parseInt(args[i + 1], 10);
      if (isNaN(options.days) || options.days <= 0) {
        console.error("Error: --days must be a positive number");
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === "--from" && args[i + 1]) {
      const date = new Date(args[i + 1]);
      if (isNaN(date.getTime())) {
        console.error("Error: Invalid --from date. Use YYYY-MM-DD format.");
        process.exit(1);
      }
      options.startDate = date;
      i++;
      continue;
    }

    if (arg === "--to" && args[i + 1]) {
      const date = new Date(args[i + 1]);
      if (isNaN(date.getTime())) {
        console.error("Error: Invalid --to date. Use YYYY-MM-DD format.");
        process.exit(1);
      }
      options.endDate = date;
      i++;
      continue;
    }

    if (arg === "--preview") {
      preview = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }

    console.error(`Error: Unknown argument: ${arg}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  // Validate date range options
  if ((options.startDate && !options.endDate) || (!options.startDate && options.endDate)) {
    console.error("Error: Both --from and --to must be specified together.");
    process.exit(1);
  }

  if (options.startDate && options.endDate && options.startDate > options.endDate) {
    console.error("Error: --from date must be before --to date.");
    process.exit(1);
  }

  // Set up progress logging
  options.onProgress = (message: string) => {
    console.log(message);
  };

  try {
    if (preview) {
      console.log("Preview mode - no changes will be made\n");
      const result = await previewSync(options);
      console.log(`Date range: ${result.dateRange.start.toDateString()} to ${result.dateRange.end.toDateString()}`);
      console.log(`Currently stored: ${result.storedCount} events`);
      console.log(`Would fetch: ${result.wouldFetch} events from Google Calendar`);
    } else {
      const result = await syncCalendar(options);

      console.log("\n=== Sync Summary ===");
      console.log(`Date range: ${result.dateRange.start.toDateString()} to ${result.dateRange.end.toDateString()}`);
      console.log(`Total events: ${result.events.total}`);
      console.log(`  Added:     +${result.events.added}`);
      console.log(`  Modified:  ~${result.events.modified}`);
      console.log(`  Removed:   -${result.events.removed}`);
      console.log(`  Unchanged: =${result.events.unchanged}`);
      console.log(`Daily summaries: ${result.dailySummaries}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    }
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
