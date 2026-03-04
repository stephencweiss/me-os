"use client";

import { useState, useEffect, useCallback } from "react";
import AttendanceFilter, { type AttendanceStatus } from "./AttendanceFilter";
import CategoryBreakdown from "./CategoryBreakdown";

interface Event {
  id: string;
  date: string;
  summary: string;
  calendar_name: string;
  account: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  color_id: string;
  color_name: string;
  color_meaning: string;
  attended: string;
}

interface EventsResponse {
  events: Event[];
  count: number;
  dateRange: { start: string; end: string };
}

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
  default: "#9e9e9e",
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DayView() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceStatus[]>([]);

  const today = new Date();
  const todayStr = formatDate(today);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: todayStr,
        end: todayStr,
      });

      // Add attendance filter if any selected
      if (attendanceFilter.length > 0) {
        params.set("attended", attendanceFilter.join(","));
      }

      const response = await fetch(`/api/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data: EventsResponse = await response.json();

      // Sort events by start time
      const sortedEvents = data.events.sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );

      setEvents(sortedEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [todayStr, attendanceFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleAttendanceChange = async (eventId: string, attended: string) => {
    // Optimistic update
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, attended } : event
      )
    );

    try {
      const response = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, attended }),
      });

      if (!response.ok) {
        throw new Error("Failed to update attendance");
      }
    } catch (err) {
      // Revert on error
      fetchEvents();
      console.error("Failed to update attendance:", err);
    }
  };

  const attendanceOptions = [
    {
      value: "attended",
      label: "Attended",
      color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      value: "skipped",
      label: "Skipped",
      color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
    {
      value: "unknown",
      label: "Unknown",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    },
  ];

  // Calculate summary stats
  const totalMinutes = events.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Day View
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
            {formatDisplayDate(today)}
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Scheduled
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalHours}h {remainingMins}m
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Events</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {events.length}
              </p>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <CategoryBreakdown events={events} />

        {/* Attendance Filter */}
        <div className="mb-4">
          <AttendanceFilter
            selected={attendanceFilter}
            onChange={setAttendanceFilter}
          />
        </div>

        {/* Event List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Events
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  Loading events...
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-red-500 dark:text-red-400">{error}</div>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  No events scheduled for today
                </div>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start gap-4">
                    {/* Color indicator */}
                    <div
                      className="w-1.5 h-14 rounded-full flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor:
                          COLOR_MAP[event.color_id] || COLOR_MAP.default,
                      }}
                    />

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {event.summary}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span>
                              {formatTime(event.start_time)} -{" "}
                              {formatTime(event.end_time)}
                            </span>
                            <span className="text-gray-400 dark:text-gray-600">
                              |
                            </span>
                            <span>{formatDuration(event.duration_minutes)}</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 truncate">
                            {event.calendar_name}
                          </p>
                        </div>
                      </div>

                      {/* Attendance toggle */}
                      <div className="flex gap-2 mt-3">
                        {attendanceOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              handleAttendanceChange(event.id, option.value)
                            }
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              event.attended === option.value
                                ? option.color
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
