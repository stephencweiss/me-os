#!/usr/bin/env node
/**
 * Dashboard Generator CLI
 *
 * Generates an HTML dashboard from the synced calendar data.
 * Includes visualizations for time by category, trends, and changes.
 *
 * Usage:
 *   npx ts-node scripts/generate-dashboard.ts                # Last 30 days
 *   npx ts-node scripts/generate-dashboard.ts --days 7       # Last 7 days
 *   npx ts-node scripts/generate-dashboard.ts --open         # Open in browser
 */

import { generateDashboard, type DashboardOptions } from "../lib/dashboard-generator.js";
import { closeDatabase } from "../lib/calendar-db.js";
import { exec } from "child_process";

function printHelp(): void {
  console.log(`
Dashboard Generator CLI

Generates an HTML dashboard with visualizations from your synced calendar data.
Charts include time by category, daily trends, and recent changes.

Usage:
  npx ts-node scripts/generate-dashboard.ts [options]

Options:
  --days <N>              Include last N days (default: 30)
  --from <date>           Start date (YYYY-MM-DD)
  --to <date>             End date (YYYY-MM-DD)
  --output <path>         Output file path (default: output/dashboard.html)
  --open                  Open in browser after generation
  --help, -h              Show this help message

Examples:
  npx ts-node scripts/generate-dashboard.ts                # Last 30 days
  npx ts-node scripts/generate-dashboard.ts --days 7       # Last week
  npx ts-node scripts/generate-dashboard.ts --days 90      # Last quarter
  npx ts-node scripts/generate-dashboard.ts --open         # Open in browser

Prerequisites:
  Sync your calendar first:
    npx ts-node scripts/sync-calendar.ts
  `);
}

function openInBrowser(filePath: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${filePath}"`;
  } else if (platform === "win32") {
    command = `start "" "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`Could not open browser: ${error.message}`);
      console.log(`Please open manually: ${filePath}`);
    }
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: DashboardOptions = {};
  let shouldOpen = false;

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

    if (arg === "--output" && args[i + 1]) {
      options.outputPath = args[i + 1];
      i++;
      continue;
    }

    if (arg === "--open") {
      shouldOpen = true;
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

  try {
    console.log("Generating dashboard...");
    const outputPath = await generateDashboard(options);
    console.log(`Dashboard generated: ${outputPath}`);

    if (shouldOpen) {
      console.log("Opening in browser...");
      openInBrowser(outputPath);
    } else {
      console.log("Run with --open to view in browser.");
    }
  } catch (error) {
    console.error("Generation failed:", error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
