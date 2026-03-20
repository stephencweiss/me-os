/**
 * Stable primary key for public.events rows written by Google Calendar sync.
 * Segments are URL-encoded and joined with ":" so Google ids stay unambiguous.
 */
export function buildSupabaseEventId(parts: {
  userId: string;
  calendarId: string;
  googleEventId: string;
  startTimeUtcIso: string;
}): string {
  return [parts.userId, parts.calendarId, parts.googleEventId, parts.startTimeUtcIso]
    .map((p) => encodeURIComponent(p))
    .join(":");
}
