"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import EventList from "./EventList";

// Color mapping from colorId to hex color (matching Google Calendar colors)
const COLOR_MAP: Record<string, string> = {
  "1": "#7986cb", // Lavender
  "2": "#33b679", // Sage
  "3": "#8e24aa", // Grape
  "4": "#e67c73", // Flamingo
  "5": "#f6bf26", // Banana
  "6": "#f4511e", // Tangerine
  "7": "#039be5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3f51b5", // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d50000", // Tomato
  default: "#9e9e9e", // Default gray
};

interface Category {
  colorId: string;
  colorName: string;
  colorMeaning: string;
  totalMinutes: number;
  totalHours: number;
  eventCount: number;
  percentage: number;
}

interface DailySummary {
  date: string;
  totalScheduledMinutes: number;
  totalGapMinutes: number;
  categories: {
    colorId: string;
    colorName: string;
    colorMeaning: string;
    totalMinutes: number;
    eventCount: number;
  }[];
  isWorkDay: boolean;
}

interface SummariesResponse {
  summaries: DailySummary[];
  count: number;
  dateRange: { start: string; end: string };
  totals: {
    scheduledMinutes: number;
    scheduledHours: number;
    gapMinutes: number;
    gapHours: number;
  };
  aggregatedCategories: Category[];
}

interface CalendarsResponse {
  calendars: { calendar_name: string; account: string }[];
  accounts: string[];
  byAccount: { account: string; calendars: string[] }[];
}

interface Event {
  id: string;
  date: string;
  summary: string;
  calendar_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  color_id: string;
  attended: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [summaries, setSummaries] = useState<SummariesResponse | null>(null);
  const [calendars, setCalendars] = useState<CalendarsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Event list state
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventList, setShowEventList] = useState(false);
  const [eventListTitle, setEventListTitle] = useState("Events");
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      try {
        const [summariesRes, calendarsRes] = await Promise.all([
          fetch(
            `/api/summaries?start=${formatDate(start)}&end=${formatDate(end)}`
          ),
          fetch("/api/calendars"),
        ]);

        if (!summariesRes.ok || !calendarsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const [summariesData, calendarsData] = await Promise.all([
          summariesRes.json(),
          calendarsRes.json(),
        ]);

        setSummaries(summariesData);
        setCalendars(calendarsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [days]);

  // Fetch events for a date range
  async function fetchEvents(start: string, end: string, title: string) {
    setEventsLoading(true);
    setEventListTitle(title);
    setShowEventList(true);

    try {
      const res = await fetch(`/api/events?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events);
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  // Fetch events for a specific date
  async function fetchEventsForDate(date: string) {
    await fetchEvents(date, date, `Events on ${new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`);
  }

  // Fetch events for a color category
  async function fetchEventsForCategory(colorId: string, colorName: string) {
    if (!summaries) return;

    setEventsLoading(true);
    setEventListTitle(`${colorName} Events`);
    setShowEventList(true);

    try {
      const res = await fetch(
        `/api/events?start=${summaries.dateRange.start}&end=${summaries.dateRange.end}`
      );
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      // Filter events by color
      const filtered = data.events.filter(
        (e: Event) => e.color_id === colorId
      );
      setEvents(filtered);
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  // Update event attendance
  async function handleAttendanceChange(eventId: string, attended: string) {
    try {
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, attended }),
      });
      if (!res.ok) throw new Error("Failed to update attendance");

      // Update local state
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, attended } : e))
      );
    } catch (err) {
      console.error("Error updating attendance:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!summaries) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  // Prepare pie chart data
  const pieData = summaries.aggregatedCategories
    .filter((c) => c.colorMeaning) // Only show categories with meaning
    .map((c) => ({
      name: c.colorMeaning || c.colorName,
      value: c.totalMinutes,
      hours: c.totalHours,
      percentage: c.percentage,
      color: COLOR_MAP[c.colorId] || COLOR_MAP.default,
      colorId: c.colorId,
    }));

  // Prepare daily bar chart data (reversed to show oldest first)
  const dailyData = [...summaries.summaries]
    .reverse()
    .map((s) => {
      const dayOfWeek = new Date(s.date + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "short" }
      );
      const dateLabel = new Date(s.date + "T12:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" }
      );

      return {
        date: s.date,
        label: `${dayOfWeek}\n${dateLabel}`,
        hours: Math.round((s.totalScheduledMinutes / 60) * 10) / 10,
        gaps: Math.round((s.totalGapMinutes / 60) * 10) / 10,
        isWeekend: !s.isWorkDay,
      };
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Calendar Dashboard
          </h1>
          <div className="flex gap-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  days === d
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Scheduled
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatHours(summaries.totals.scheduledMinutes)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summaries.count} days
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Daily Average
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatHours(
                Math.round(summaries.totals.scheduledMinutes / summaries.count)
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              per day
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Gap Time
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatHours(summaries.totals.gapMinutes)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              unscheduled
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Accounts
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {calendars?.accounts.length || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {calendars?.calendars.length || 0} calendars
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Time by Category
            </h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, payload }) =>
                      `${name} (${payload?.percentage || 0}%)`
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        onClick={() =>
                          fetchEventsForCategory(entry.colorId, entry.name)
                        }
                        style={{ cursor: "pointer" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      formatHours(Number(value)),
                      "Time",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No categorized events
              </div>
            )}
          </div>

          {/* Daily Trends Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Daily Scheduled Hours
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* Shade weekend days */}
                {dailyData.map(
                  (d, i) =>
                    d.isWeekend && (
                      <ReferenceArea
                        key={`weekend-${i}`}
                        x1={d.label}
                        x2={d.label}
                        fill="#9ca3af"
                        fillOpacity={0.15}
                      />
                    )
                )}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  label={{
                    value: "Hours",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${value}h`, "Scheduled"]}
                />
                <Bar
                  dataKey="hours"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(data) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const payload = (data as any)?.payload;
                    if (payload?.date) {
                      fetchEventsForDate(payload.date);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Category Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                    Hours
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                    Events
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                    % of Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaries.aggregatedCategories.map((cat) => (
                  <tr
                    key={cat.colorId}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() =>
                      fetchEventsForCategory(
                        cat.colorId,
                        cat.colorMeaning || cat.colorName
                      )
                    }
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              COLOR_MAP[cat.colorId] || COLOR_MAP.default,
                          }}
                        />
                        <span className="text-gray-900 dark:text-white">
                          {cat.colorMeaning || cat.colorName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                      {cat.totalHours}h
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {cat.eventCount}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {cat.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Data from {summaries.dateRange.start} to {summaries.dateRange.end}
          <span className="mx-2">|</span>
          Last synced from Google Calendar
        </div>
      </div>

      {/* Event List Side Panel */}
      {showEventList && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 z-50">
          <div
            className="absolute inset-0 bg-black/20 sm:hidden"
            onClick={() => setShowEventList(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full sm:w-96 shadow-xl">
            <EventList
              events={events}
              onAttendanceChange={handleAttendanceChange}
              title={eventListTitle}
              onClose={() => setShowEventList(false)}
              loading={eventsLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
