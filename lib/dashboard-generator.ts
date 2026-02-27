/**
 * Dashboard Generator Module
 *
 * Generates an HTML dashboard with visualizations from the calendar database.
 * Uses Chart.js for charts and produces a self-contained HTML file.
 */

import * as fs from "fs";
import * as path from "path";
import {
  initDatabase,
  getDailySummaries,
  getRecentChanges,
  getAggregateStats,
  getChangeStats,
  formatDateKey,
  type StoredDailySummary,
  type EventChange,
} from "./calendar-db.js";
import type { ColorSummary } from "./time-analysis.js";

// Output location
const OUTPUT_DIR = path.join(process.cwd(), "output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "dashboard.html");

// Load color definitions
const CONFIG_DIR = path.join(process.cwd(), "config");
const colorsPath = path.join(CONFIG_DIR, "colors.json");
const colorDefinitions: Record<string, { name: string; meaning: string }> = fs.existsSync(colorsPath)
  ? JSON.parse(fs.readFileSync(colorsPath, "utf-8"))
  : {};

// Chart.js color palette (CSS colors for each category)
const CHART_COLORS: Record<string, string> = {
  "1": "#8E7CC3", // Lavender
  "2": "#6AA84F", // Sage
  "3": "#674EA7", // Grape
  "4": "#E06666", // Flamingo
  "5": "#FFD966", // Banana
  "6": "#F6B26B", // Tangerine
  "7": "#45818E", // Peacock
  "8": "#999999", // Graphite
  "9": "#3D85C6", // Blueberry
  "10": "#93C47D", // Basil
  "11": "#CC0000", // Tomato
  default: "#CCCCCC", // Default gray
};

export interface DashboardOptions {
  /** Number of days to include (default: 30) */
  days?: number;
  /** Start date (overrides days) */
  startDate?: Date;
  /** End date (overrides days) */
  endDate?: Date;
  /** Output file path (default: output/dashboard.html) */
  outputPath?: string;
}

interface DashboardData {
  dateRange: { start: string; end: string };
  summary: {
    totalDays: number;
    totalScheduledHours: number;
    totalGapHours: number;
    avgScheduledPerDay: number;
    avgGapPerDay: number;
  };
  weekOverWeek: {
    thisWeek: { scheduled: number; gap: number };
    lastWeek: { scheduled: number; gap: number };
    scheduledChange: number;
    gapChange: number;
  };
  byCategory: Array<{
    colorId: string;
    colorName: string;
    meaning: string;
    totalMinutes: number;
    eventCount: number;
    chartColor: string;
  }>;
  dailyData: Array<{
    date: string;
    scheduled: number;
    gap: number;
    categories: ColorSummary[];
  }>;
  recentChanges: Array<{
    type: string;
    time: string;
    eventId: string;
    summary: string;
  }>;
  changeStats: {
    added: number;
    removed: number;
    modified: number;
  };
  generatedAt: string;
}

/**
 * Get date range from options
 */
function getDateRange(options: DashboardOptions): { start: Date; end: Date } {
  if (options.startDate && options.endDate) {
    return { start: options.startDate, end: options.endDate };
  }

  const days = options.days ?? 30;
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * Get last week's date range
 */
function getLastWeekRange(): { start: Date; end: Date } {
  const end = new Date();
  end.setDate(end.getDate() - 7);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * Get this week's date range
 */
function getThisWeekRange(): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * Gather all data needed for the dashboard
 */
async function gatherDashboardData(options: DashboardOptions): Promise<DashboardData> {
  await initDatabase();

  const { start, end } = getDateRange(options);
  const summaries = await getDailySummaries(start, end);
  const changes = await getRecentChanges(50);
  const stats = await getAggregateStats(start, end);
  const changeStats = await getChangeStats(start, end);

  // This week vs last week comparison
  const thisWeekRange = getThisWeekRange();
  const lastWeekRange = getLastWeekRange();
  const thisWeekStats = await getAggregateStats(thisWeekRange.start, thisWeekRange.end);
  const lastWeekStats = await getAggregateStats(lastWeekRange.start, lastWeekRange.end);

  // Calculate week over week changes
  const thisWeekScheduled = thisWeekStats.totalScheduledMinutes / 60;
  const lastWeekScheduled = lastWeekStats.totalScheduledMinutes / 60;
  const thisWeekGap = thisWeekStats.totalGapMinutes / 60;
  const lastWeekGap = lastWeekStats.totalGapMinutes / 60;

  const scheduledChange =
    lastWeekScheduled > 0
      ? ((thisWeekScheduled - lastWeekScheduled) / lastWeekScheduled) * 100
      : 0;
  const gapChange =
    lastWeekGap > 0 ? ((thisWeekGap - lastWeekGap) / lastWeekGap) * 100 : 0;

  // Build category breakdown
  const byCategory: DashboardData["byCategory"] = [];
  for (const [colorId, data] of stats.byCategory) {
    const def = colorDefinitions[colorId];
    byCategory.push({
      colorId,
      colorName: def?.name || colorId,
      meaning: def?.meaning || "",
      totalMinutes: data.minutes,
      eventCount: data.count,
      chartColor: CHART_COLORS[colorId] || CHART_COLORS.default,
    });
  }
  // Sort by total time descending
  byCategory.sort((a, b) => b.totalMinutes - a.totalMinutes);

  // Build daily data for charts
  const dailyData: DashboardData["dailyData"] = summaries.map((s) => ({
    date: s.date,
    scheduled: s.total_scheduled_minutes,
    gap: s.total_gap_minutes,
    categories: JSON.parse(s.categories_json) as ColorSummary[],
  }));

  // Format recent changes
  const recentChanges: DashboardData["recentChanges"] = changes.map((c) => {
    let summary = "";
    if (c.new_value_json) {
      try {
        const event = JSON.parse(c.new_value_json);
        summary = event.summary || "";
      } catch {
        summary = "";
      }
    } else if (c.old_value_json) {
      try {
        const event = JSON.parse(c.old_value_json);
        summary = event.summary || "";
      } catch {
        summary = "";
      }
    }

    return {
      type: c.change_type,
      time: c.change_time,
      eventId: c.google_event_id,
      summary,
    };
  });

  const totalScheduledHours = stats.totalScheduledMinutes / 60;
  const totalGapHours = stats.totalGapMinutes / 60;

  return {
    dateRange: {
      start: formatDateKey(start),
      end: formatDateKey(end),
    },
    summary: {
      totalDays: stats.totalDays,
      totalScheduledHours,
      totalGapHours,
      avgScheduledPerDay: stats.totalDays > 0 ? totalScheduledHours / stats.totalDays : 0,
      avgGapPerDay: stats.totalDays > 0 ? totalGapHours / stats.totalDays : 0,
    },
    weekOverWeek: {
      thisWeek: { scheduled: thisWeekScheduled, gap: thisWeekGap },
      lastWeek: { scheduled: lastWeekScheduled, gap: lastWeekGap },
      scheduledChange,
      gapChange,
    },
    byCategory,
    dailyData,
    recentChanges,
    changeStats,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format hours for display
 */
function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Generate the HTML dashboard
 */
function generateHTML(data: DashboardData): string {
  const categoryLabels = JSON.stringify(data.byCategory.map((c) => c.meaning || c.colorName));
  const categoryData = JSON.stringify(data.byCategory.map((c) => Math.round(c.totalMinutes / 60 * 10) / 10));
  const categoryColors = JSON.stringify(data.byCategory.map((c) => c.chartColor));

  const dailyLabels = JSON.stringify(data.dailyData.map((d) => d.date));
  const dailyScheduled = JSON.stringify(data.dailyData.map((d) => Math.round(d.scheduled / 60 * 10) / 10));
  const dailyGap = JSON.stringify(data.dailyData.map((d) => Math.round(d.gap / 60 * 10) / 10));

  // Build stacked data for daily breakdown by category
  const allCategories = new Set<string>();
  for (const day of data.dailyData) {
    for (const cat of day.categories) {
      allCategories.add(cat.colorId);
    }
  }

  const stackedDatasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
  }> = [];

  for (const colorId of allCategories) {
    const def = colorDefinitions[colorId];
    const dayValues = data.dailyData.map((d) => {
      const cat = d.categories.find((c) => c.colorId === colorId);
      return cat ? Math.round(cat.totalMinutes / 60 * 10) / 10 : 0;
    });

    stackedDatasets.push({
      label: def?.meaning || def?.name || colorId,
      data: dayValues,
      backgroundColor: CHART_COLORS[colorId] || CHART_COLORS.default,
    });
  }

  const changeIcon = (change: number) => {
    if (change > 5) return "↑";
    if (change < -5) return "↓";
    return "→";
  };

  const changeClass = (change: number) => {
    if (change > 5) return "positive";
    if (change < -5) return "negative";
    return "neutral";
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendar Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      padding: 20px;
      line-height: 1.5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 30px;
    }

    header h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 5px;
    }

    header .date-range {
      color: #86868b;
      font-size: 14px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .card h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #86868b;
      margin-bottom: 8px;
    }

    .card .value {
      font-size: 32px;
      font-weight: 600;
    }

    .card .subtext {
      font-size: 13px;
      color: #86868b;
      margin-top: 5px;
    }

    .card .change {
      font-size: 14px;
      margin-top: 5px;
    }

    .change.positive { color: #34c759; }
    .change.negative { color: #ff3b30; }
    .change.neutral { color: #86868b; }

    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .chart-card h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .chart-container {
      position: relative;
      height: 300px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .changes-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .changes-table th {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #e5e5e5;
      font-weight: 600;
      color: #86868b;
      font-size: 12px;
      text-transform: uppercase;
    }

    .changes-table td {
      padding: 10px;
      border-bottom: 1px solid #f5f5f5;
    }

    .changes-table tr:hover {
      background: #f9f9f9;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge.added { background: #d1fae5; color: #065f46; }
    .badge.removed { background: #fee2e2; color: #991b1b; }
    .badge.modified { background: #e0e7ff; color: #3730a3; }

    .category-list {
      list-style: none;
      margin-top: 10px;
    }

    .category-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .category-list li:last-child {
      border-bottom: none;
    }

    .category-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      margin-right: 10px;
    }

    .category-name {
      flex: 1;
      display: flex;
      align-items: center;
    }

    .category-value {
      font-weight: 500;
    }

    footer {
      text-align: center;
      padding: 20px;
      color: #86868b;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Calendar Dashboard</h1>
      <p class="date-range">${data.dateRange.start} to ${data.dateRange.end} • Generated ${new Date(data.generatedAt).toLocaleString()}</p>
    </header>

    <div class="cards">
      <div class="card">
        <h3>Total Scheduled</h3>
        <div class="value">${formatHours(data.summary.totalScheduledHours)}</div>
        <div class="subtext">${formatHours(data.summary.avgScheduledPerDay)} avg/day</div>
      </div>

      <div class="card">
        <h3>Unstructured Time</h3>
        <div class="value">${formatHours(data.summary.totalGapHours)}</div>
        <div class="subtext">${formatHours(data.summary.avgGapPerDay)} avg/day</div>
      </div>

      <div class="card">
        <h3>This Week vs Last</h3>
        <div class="value">${formatHours(data.weekOverWeek.thisWeek.scheduled)}</div>
        <div class="change ${changeClass(data.weekOverWeek.scheduledChange)}">
          ${changeIcon(data.weekOverWeek.scheduledChange)} ${Math.abs(Math.round(data.weekOverWeek.scheduledChange))}% from last week
        </div>
      </div>

      <div class="card">
        <h3>Calendar Changes</h3>
        <div class="value">${data.changeStats.added + data.changeStats.removed + data.changeStats.modified}</div>
        <div class="subtext">+${data.changeStats.added} added, -${data.changeStats.removed} removed</div>
      </div>
    </div>

    <div class="charts">
      <div class="chart-card">
        <h2>Time by Category</h2>
        <div class="chart-container">
          <canvas id="categoryChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h2>Category Breakdown</h2>
        <ul class="category-list">
          ${data.byCategory
            .slice(0, 10)
            .map(
              (c) => `
            <li>
              <span class="category-name">
                <span class="category-color" style="background: ${c.chartColor}"></span>
                ${c.meaning || c.colorName}
              </span>
              <span class="category-value">${formatHours(c.totalMinutes / 60)}</span>
            </li>
          `
            )
            .join("")}
        </ul>
      </div>

      <div class="chart-card full-width">
        <h2>Daily Trends</h2>
        <div class="chart-container">
          <canvas id="trendsChart"></canvas>
        </div>
      </div>

      <div class="chart-card full-width">
        <h2>Daily Breakdown by Category</h2>
        <div class="chart-container">
          <canvas id="stackedChart"></canvas>
        </div>
      </div>

      <div class="chart-card full-width">
        <h2>Recent Changes</h2>
        <table class="changes-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Event</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${data.recentChanges
              .slice(0, 20)
              .map(
                (c) => `
              <tr>
                <td><span class="badge ${c.type}">${c.type}</span></td>
                <td>${c.summary || "(No title)"}</td>
                <td>${new Date(c.time).toLocaleString()}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Generated by MeOS Calendar Dashboard
    </footer>
  </div>

  <script>
    // Category donut chart
    new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: {
        labels: ${categoryLabels},
        datasets: [{
          data: ${categoryData},
          backgroundColor: ${categoryColors},
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + 'h';
              }
            }
          }
        }
      }
    });

    // Daily trends line chart
    new Chart(document.getElementById('trendsChart'), {
      type: 'line',
      data: {
        labels: ${dailyLabels},
        datasets: [
          {
            label: 'Scheduled',
            data: ${dailyScheduled},
            borderColor: '#007aff',
            backgroundColor: 'rgba(0, 122, 255, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Unstructured',
            data: ${dailyGap},
            borderColor: '#ff9500',
            backgroundColor: 'rgba(255, 149, 0, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });

    // Stacked bar chart
    new Chart(document.getElementById('stackedChart'), {
      type: 'bar',
      data: {
        labels: ${dailyLabels},
        datasets: ${JSON.stringify(stackedDatasets)}
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate the dashboard HTML file
 */
export async function generateDashboard(options: DashboardOptions = {}): Promise<string> {
  const outputPath = options.outputPath || OUTPUT_PATH;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Gather data and generate HTML
  const data = await gatherDashboardData(options);
  const html = generateHTML(data);

  // Write file
  fs.writeFileSync(outputPath, html);

  return outputPath;
}

/**
 * Get dashboard data without generating HTML (for testing or API use)
 */
export async function getDashboardData(options: DashboardOptions = {}): Promise<DashboardData> {
  return gatherDashboardData(options);
}
