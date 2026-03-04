"use client";

import { useState, useEffect, useCallback } from "react";
import AttendanceFilter, { type AttendanceStatus } from "./AttendanceFilter";
import CategoryBreakdown from "./CategoryBreakdown";
import ColorPicker from "./ColorPicker";
import AccountFilter from "./AccountFilter";

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
  // Handle both ISO timestamps (2026-02-20T13:00:00.000Z) and plain time strings (13:00:00)
  let date: Date;
  if (time.includes("T")) {
    // ISO timestamp - parse and convert to local time
    date = new Date(time);
  } else {
    // Plain time string - create a date with today's date
    const [hours, minutes, seconds] = time.split(":");
    date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || "0"), 0);
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  const [accounts, setAccounts] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);

  const today = new Date();
  const todayStr = formatDate(today);

  // Fetch available accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch("/api/calendars");
        if (response.ok) {
          const data = await response.json();
          setAccounts(data.accounts || []);
        }
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      }
    }
    fetchAccounts();
  }, []);

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

      // Add accounts filter if any selected
      if (accountFilter.length > 0) {
        params.set("accounts", accountFilter.join(","));
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
  }, [todayStr, attendanceFilter, accountFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleAttendanceChange = async (eventId: string, attended: string) => {
    // Check if we have an active filter (not empty and not all three selected)
    const hasActiveFilter =
      attendanceFilter.length > 0 && attendanceFilter.length < 3;
    const matchesFilter = attendanceFilter.includes(attended as AttendanceStatus);

    // Optimistic update - remove from list if it no longer matches filter
    setEvents((prev) => {
      if (hasActiveFilter && !matchesFilter) {
        // Remove the event since it no longer matches the filter
        return prev.filter((event) => event.id !== eventId);
      }
      // Otherwise just update the attendance value
      return prev.map((event) =>
        event.id === eventId ? { ...event, attended } : event
      );
    });

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

  const handleColorChange = async (eventId: string, colorId: string) => {
    // Find current event for optimistic update
    const currentEvent = events.find((e) => e.id === eventId);
    if (!currentEvent) return;

    // Color definitions for optimistic update
    const colorDefs: Record<string, { name: string; meaning: string }> = {
      "1": { name: "Lavender", meaning: "1:1s / People" },
      "2": { name: "Sage", meaning: "Studying / Learning" },
      "3": { name: "Grape", meaning: "Project Work" },
      "4": { name: "Flamingo", meaning: "Meetings" },
      "5": { name: "Banana", meaning: "Household / Pets" },
      "6": { name: "Tangerine", meaning: "Family Time" },
      "7": { name: "Peacock", meaning: "Personal Projects" },
      "8": { name: "Graphite", meaning: "Routines / Logistics" },
      "9": { name: "Blueberry", meaning: "Fitness" },
      "10": { name: "Basil", meaning: "Social" },
      "11": { name: "Tomato", meaning: "Urgent / Blocked" },
    };

    const colorDef = colorDefs[colorId];
    if (!colorDef) return;

    // Optimistic update
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              color_id: colorId,
              color_name: colorDef.name,
              color_meaning: colorDef.meaning,
            }
          : event
      )
    );

    try {
      const response = await fetch("/api/events/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, colorId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update color");
      }
    } catch (err) {
      // Revert on error
      fetchEvents();
      console.error("Failed to update color:", err);
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

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <AttendanceFilter
            selected={attendanceFilter}
            onChange={setAttendanceFilter}
          />
          <AccountFilter
            accounts={accounts}
            selected={accountFilter}
            onChange={setAccountFilter}
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
                    {/* Color picker */}
                    <ColorPicker
                      currentColorId={event.color_id}
                      onSelect={(colorId) => handleColorChange(event.id, colorId)}
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
