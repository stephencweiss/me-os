"use client";

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

interface EventListProps {
  events: Event[];
  onAttendanceChange: (eventId: string, attended: string) => void;
  title?: string;
  onClose?: () => void;
  loading?: boolean;
}

// Color mapping from colorId to hex color (matching Google Calendar colors)
const COLOR_MAP: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
  default: "#9e9e9e",
};

function formatTime(time: string): string {
  // time is in HH:MM:SS format
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

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function EventList({
  events,
  onAttendanceChange,
  title = "Events",
  onClose,
  loading = false,
}: EventListProps) {
  // Group events by date
  const eventsByDate = events.reduce(
    (acc, event) => {
      const date = event.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, Event[]>
  );

  // Sort dates (most recent first)
  const sortedDates = Object.keys(eventsByDate).sort().reverse();

  const attendanceOptions = [
    { value: "attended", label: "Attended", color: "bg-green-100 text-green-800" },
    { value: "skipped", label: "Skipped", color: "bg-red-100 text-red-800" },
    { value: "unknown", label: "Unknown", color: "bg-gray-100 text-gray-800" },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              Loading events...
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              No events found
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {formatDateLabel(date)}
                </h4>
                <div className="space-y-2">
                  {eventsByDate[date].map((event) => (
                    <div
                      key={event.id}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Color indicator */}
                        <div
                          className="w-1 h-12 rounded-full flex-shrink-0 mt-1"
                          style={{
                            backgroundColor:
                              COLOR_MAP[event.color_id] || COLOR_MAP.default,
                          }}
                        />

                        {/* Event details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-medium text-gray-900 dark:text-white truncate">
                              {event.summary}
                            </h5>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {formatDuration(event.duration_minutes)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
                            <span>
                              {formatTime(event.start_time)} -{" "}
                              {formatTime(event.end_time)}
                            </span>
                            <span className="text-gray-400">|</span>
                            <span className="truncate">{event.calendar_name}</span>
                          </div>

                          {/* Attendance toggle */}
                          <div className="flex gap-1 mt-2">
                            {attendanceOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() =>
                                  onAttendanceChange(event.id, option.value)
                                }
                                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                                  event.attended === option.value
                                    ? option.color
                                    : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
