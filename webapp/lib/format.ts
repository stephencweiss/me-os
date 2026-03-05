/**
 * Format a time string for display.
 * Handles both ISO timestamps (2026-02-20T13:00:00.000Z) and plain time strings (13:00:00)
 */
export function formatTime(time: string): string {
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

/**
 * Format a duration in minutes for display.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format a Date object to YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format a Date object for user-friendly display.
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
