#!/usr/bin/env node
/**
 * Weekly Report Generator
 *
 * Standalone CLI script that generates a weekly time report.
 * Can be run without the LLM for automation or cron jobs.
 *
 * Usage:
 *   npx ts-node scripts/weekly-report.ts                    # Current week
 *   npx ts-node scripts/weekly-report.ts --week 2024-01-15  # Specific week
 *   npx ts-node scripts/weekly-report.ts --yesterday        # Yesterday only
 *   npx ts-node scripts/weekly-report.ts --json             # Output as JSON
 */

import {
  generateWeeklyReport,
  generateDailySummary,
  formatWeeklyReportMarkdown,
  formatDuration,
  getWeekStart,
} from "../lib/time-analysis.js";
import { loadSchedule } from "../lib/schedule.js";

/**
 * Format an hour as a simple time string (e.g., 9am, 5pm)
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let mode: "week" | "yesterday" | "today" = "week";
  let targetDate = new Date();
  let outputJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--week" && args[i + 1]) {
      targetDate = new Date(args[i + 1]);
      i++;
    } else if (arg === "--yesterday") {
      mode = "yesterday";
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    } else if (arg === "--today") {
      mode = "today";
      targetDate = new Date();
    } else if (arg === "--tomorrow") {
      mode = "today"; // reuse today's format
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Weekly Report Generator

Usage:
  npx ts-node scripts/weekly-report.ts [options]

Options:
  --week <date>    Generate report for week containing <date> (YYYY-MM-DD)
  --yesterday      Generate report for yesterday only
  --today          Generate report for today only
  --tomorrow       Generate report for tomorrow only
  --json           Output as JSON instead of markdown
  --help, -h       Show this help message

Examples:
  npx ts-node scripts/weekly-report.ts                    # Current week
  npx ts-node scripts/weekly-report.ts --week 2024-01-15  # Week of Jan 15, 2024
  npx ts-node scripts/weekly-report.ts --yesterday        # Yesterday only
  npx ts-node scripts/weekly-report.ts --json             # JSON output
      `);
      process.exit(0);
    }
  }

  try {
    if (mode === "yesterday" || mode === "today") {
      const label = mode === "yesterday" ? "Yesterday" : "Today";
      console.error(`Generating ${label}'s report...`);

      const summary = await generateDailySummary(targetDate);

      if (outputJson) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(`# ${label}'s Time Report`);
        console.log(`**${summary.dateString}**\n`);

        // Show all-day events first
        if (summary.allDayEvents && summary.allDayEvents.length > 0) {
          console.log("## All-Day Events");
          for (const event of summary.allDayEvents) {
            console.log(`- ${event.summary} [${event.account}]`);
          }
          console.log("");
        }

        console.log("## Summary");
        const hoursLabel = summary.isWorkDay
          ? `work hours ${formatHour(summary.analysisHours.start)}-${formatHour(summary.analysisHours.end)}`
          : `waking hours ${formatHour(summary.analysisHours.start)}-${formatHour(summary.analysisHours.end)}`;
        console.log(`- **Total Scheduled:** ${formatDuration(summary.totalScheduledMinutes)} (after merging overlaps)`);
        console.log(`- **Unstructured Time (${hoursLabel}):** ${formatDuration(summary.totalGapMinutes)}`);
        console.log(`- **Event Count:** ${summary.events.length} timed events\n`);

        console.log("## Time by Category");
        console.log("| Category | Color | Time | Events |");
        console.log("|----------|-------|------|--------|");

        for (const color of summary.byColor) {
          const category = color.colorMeaning || color.colorName;
          console.log(`| ${category} | ${color.colorName} | ${formatDuration(color.totalMinutes)} | ${color.eventCount} |`);
        }
        console.log("");
        console.log("*Note: Category times may exceed scheduled time if events overlap.*\n");

        console.log("## Events");
        for (const event of summary.events) {
          const startTime = event.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const endTime = event.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const colorLabel = event.colorMeaning || event.colorName;
          console.log(`- ${startTime} - ${endTime}: ${event.summary} [${event.account}] [${colorLabel}]`);
        }
        console.log("");

        if (summary.gaps.length > 0) {
          console.log("## Unstructured Time Blocks");
          for (const gap of summary.gaps) {
            const startTime = gap.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const endTime = gap.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            console.log(`- ${startTime} - ${endTime}: ${formatDuration(gap.durationMinutes)}`);
          }
        }
      }
    } else {
      // Weekly report
      const weekStart = getWeekStart(targetDate);
      console.error(`Generating weekly report for week of ${weekStart.toLocaleDateString()}...`);

      const report = await generateWeeklyReport(weekStart);

      if (outputJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatWeeklyReportMarkdown(report));
      }
    }

    console.error("\nReport complete!");
  } catch (err: any) {
    console.error("Error generating report:", err.message);
    process.exit(1);
  }
}

main();
