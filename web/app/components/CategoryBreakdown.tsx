"use client";

interface Event {
  id: string;
  color_id: string;
  color_name: string;
  color_meaning: string;
  duration_minutes: number;
}

interface CategoryBreakdownProps {
  events: Event[];
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
  default: "#f59e0b", // Amber for uncategorized
};

interface CategoryTotal {
  colorId: string;
  colorName: string;
  colorMeaning: string;
  totalMinutes: number;
  eventCount: number;
}

export function aggregateByCategory(events: Event[]): CategoryTotal[] {
  const categoryMap = new Map<string, CategoryTotal>();

  for (const event of events) {
    const existing = categoryMap.get(event.color_id);
    if (existing) {
      existing.totalMinutes += event.duration_minutes;
      existing.eventCount += 1;
    } else {
      categoryMap.set(event.color_id, {
        colorId: event.color_id,
        colorName: event.color_name,
        colorMeaning: event.color_meaning,
        totalMinutes: event.duration_minutes,
        eventCount: 1,
      });
    }
  }

  // Sort by total time descending, but put uncategorized at the end
  return Array.from(categoryMap.values()).sort((a, b) => {
    // Uncategorized goes last
    if (a.colorId === "default" && b.colorId !== "default") return 1;
    if (b.colorId === "default" && a.colorId !== "default") return -1;
    // Otherwise sort by time descending
    return b.totalMinutes - a.totalMinutes;
  });
}

function isUncategorized(colorId: string): boolean {
  return colorId === "default" || colorId === "";
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function CategoryBreakdown({ events }: CategoryBreakdownProps) {
  const categories = aggregateByCategory(events);

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        Time by Category
      </h2>
      <div className="space-y-2">
        {categories.map((category) => {
          const uncategorized = isUncategorized(category.colorId);
          return (
            <div
              key={category.colorId}
              className={`flex items-center justify-between ${
                uncategorized
                  ? "bg-amber-50 dark:bg-amber-900/20 -mx-2 px-2 py-1 rounded"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    uncategorized ? "ring-2 ring-amber-400 ring-offset-1" : ""
                  }`}
                  style={{
                    backgroundColor:
                      COLOR_MAP[category.colorId] || COLOR_MAP.default,
                  }}
                />
                <span
                  className={`text-sm ${
                    uncategorized
                      ? "text-amber-700 dark:text-amber-400 font-medium"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {uncategorized
                    ? "Uncategorized"
                    : category.colorMeaning || category.colorName}
                </span>
                <span
                  className={`text-xs ${
                    uncategorized
                      ? "text-amber-600 dark:text-amber-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  ({category.eventCount} event{category.eventCount !== 1 ? "s" : ""})
                </span>
              </div>
              <span
                className={`text-sm font-medium ${
                  uncategorized
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {formatDuration(category.totalMinutes)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
