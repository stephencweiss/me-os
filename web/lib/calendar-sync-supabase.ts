import "server-only";

/**
 * Google Calendar → Supabase sync (webapp). Server-only.
 *
 * Stable event id (primary key): URL-encoded segments joined by ":" —
 * userId, google calendar id, Google event id, start instant ISO (UTC).
 * @see buildSupabaseEventId
 */

import { google } from "googleapis";
import { OAuth2Client, type Credentials } from "google-auth-library";
import type { calendar_v3 } from "googleapis";
import { getTenantSupabaseOrServiceRole } from "./supabase-server";
import {
  COLOR_DEFINITIONS,
  reconcileDailySummariesForDateRange,
} from "./db-supabase";
import { suggestCategoryFromTitle } from "./calendar-suggest";
import {
  decryptLinkedAccountTokens,
  getLinkedAccountById,
  updateLinkedAccountTokens,
} from "./linked-google-accounts";
import { buildSupabaseEventId } from "./calendar-event-id";
import type { EventInsert } from "./database.types";

const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  "1": "Lavender",
  "2": "Sage",
  "3": "Grape",
  "4": "Flamingo",
  "5": "Banana",
  "6": "Tangerine",
  "7": "Peacock",
  "8": "Graphite",
  "9": "Blueberry",
  "10": "Basil",
  "11": "Tomato",
};

export interface CalendarSyncCalendarError {
  calendarId: string;
  calendarSummary: string;
  message: string;
}

export interface CalendarSyncStats {
  fetched: number;
  upserted: number;
  markedRemoved: number;
  calendarsProcessed: number;
  autoCategorized: number;
}

export interface CalendarSyncRunResult {
  stats: CalendarSyncStats;
  errors: CalendarSyncCalendarError[];
}

export { buildSupabaseEventId } from "./calendar-event-id";

function parseGoogleEventTimes(event: calendar_v3.Schema$Event): {
  start: Date;
  end: Date;
  dateKey: string;
  isAllDay: boolean;
} | null {
  const startRaw = event.start;
  const endRaw = event.end;
  if (!startRaw) return null;

  if (startRaw.dateTime) {
    const start = new Date(startRaw.dateTime);
    const end = endRaw?.dateTime
      ? new Date(endRaw.dateTime)
      : new Date(start.getTime() + 60 * 60 * 1000);
    return {
      start,
      end,
      dateKey: start.toISOString().slice(0, 10),
      isAllDay: false,
    };
  }

  if (startRaw.date) {
    const dateKey = startRaw.date;
    const start = new Date(`${dateKey}T12:00:00.000Z`);
    const endDate = endRaw?.date ?? dateKey;
    const end = new Date(`${endDate}T12:00:00.000Z`);
    return { start, end, dateKey, isAllDay: true };
  }

  return null;
}

function exclusiveTimeMaxUtc(endDateInclusive: string): string {
  const [y, m, d] = endDateInclusive.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d));
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

async function persistRefreshedTokens(
  userId: string,
  linkedId: string,
  creds: Credentials
): Promise<void> {
  if (!creds.access_token) return;
  await updateLinkedAccountTokens(userId, linkedId, {
    access_token: creds.access_token,
    refresh_token: creds.refresh_token ?? undefined,
    expires_at: creds.expiry_date != null ? Math.floor(creds.expiry_date / 1000) : null,
  });
}

async function ensureFreshAccessToken(
  oauth2: OAuth2Client,
  userId: string,
  linkedId: string
): Promise<void> {
  await oauth2.getAccessToken();
  const creds = oauth2.credentials;
  await persistRefreshedTokens(userId, linkedId, creds);
}

function googleEventToRow(params: {
  userId: string;
  account: string;
  calendarId: string;
  calendarName: string;
  event: calendar_v3.Schema$Event;
}): { row: EventInsert; stableId: string } | null {
  const { userId, account, calendarId, calendarName, event } = params;
  const gid = event.id;
  if (!gid) return null;

  const times = parseGoogleEventTimes(event);
  if (!times) return null;

  const startIso = times.start.toISOString();
  const stableId = buildSupabaseEventId({
    userId,
    calendarId,
    googleEventId: gid,
    startTimeUtcIso: startIso,
  });

  const durationMinutes = times.isAllDay
    ? 0
    : Math.max(0, Math.round((times.end.getTime() - times.start.getTime()) / 60_000));

  let colorId = event.colorId || "default";
  let autoCategorized = false;
  if (!event.colorId || event.colorId === "default") {
    const suggestion = suggestCategoryFromTitle(event.summary || "");
    if (suggestion.confidence >= 0.8) {
      colorId = suggestion.colorId;
      autoCategorized = true;
    }
  }

  const colorName =
    colorId === "default"
      ? "Default"
      : GOOGLE_CALENDAR_COLORS[colorId] || colorId;
  const colorMeaning = COLOR_DEFINITIONS[colorId]?.meaning ?? "";

  const recurringEventId = event.recurringEventId ?? null;
  const isRecurring = !!recurringEventId;

  const now = new Date().toISOString();
  const row: EventInsert = {
    id: stableId,
    user_id: userId,
    google_event_id: gid,
    date: times.dateKey,
    account,
    calendar_name: calendarName,
    calendar_type: "active",
    summary: event.summary || "(No title)",
    description: event.description ?? null,
    start_time: times.start.toISOString(),
    end_time: times.end.toISOString(),
    duration_minutes: durationMinutes,
    color_id: colorId,
    color_name: colorName,
    color_meaning: colorMeaning,
    is_all_day: times.isAllDay,
    is_recurring: isRecurring,
    recurring_event_id: recurringEventId,
    attended: "unknown",
    auto_categorized: autoCategorized,
    removed_at: null,
    last_seen: now,
  };

  return { row, stableId };
}

async function fetchAllCalendarEvents(
  calApi: calendar_v3.Calendar,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
  const out: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calApi.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });
    const items = res.data.items || [];
    out.push(...items);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

async function loadExistingIdsForCalendarWindow(
  userId: string,
  account: string,
  calendarName: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("events") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("account", account)
    .eq("calendar_name", calendarName)
    .gte("date", startDate)
    .lte("date", endDate)
    .is("removed_at", null);

  if (error) {
    throw new Error(`Failed to list existing events: ${error.message}`);
  }
  return ((data || []) as { id: string }[]).map((r) => r.id);
}

async function markEventsRemoved(ids: string[], userId: string): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = getTenantSupabaseOrServiceRole();
  const now = new Date().toISOString();
  let n = 0;
  const chunk = 80;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("events") as any)
      .update({ removed_at: now, last_seen: now })
      .eq("user_id", userId)
      .in("id", slice)
      .is("removed_at", null)
      .select("id");
    if (error) {
      throw new Error(`Failed to soft-remove events: ${error.message}`);
    }
    n += (data || []).length;
  }
  return n;
}

async function upsertEventRows(rows: EventInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = getTenantSupabaseOrServiceRole();
  let n = 0;
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("events") as any).upsert(slice, {
      onConflict: "id",
    });
    if (error) {
      throw new Error(`Failed to upsert events: ${error.message}`);
    }
    n += slice.length;
  }
  return n;
}

export async function runCalendarSync(params: {
  userId: string;
  linkedAccountId: string;
  startDate: string;
  endDate: string;
}): Promise<CalendarSyncRunResult> {
  const { userId, linkedAccountId, startDate, endDate } = params;

  const row = await getLinkedAccountById(userId, linkedAccountId);
  if (!row) {
    throw new Error("Linked Google account not found");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  const decrypted = decryptLinkedAccountTokens(row);
  const oauth2 = new OAuth2Client(clientId, clientSecret);
  oauth2.setCredentials({
    access_token: decrypted.accessTokenPlain,
    refresh_token: decrypted.refreshTokenPlain ?? undefined,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
  });

  await ensureFreshAccessToken(oauth2, userId, linkedAccountId);

  const calApi = google.calendar({ version: "v3", auth: oauth2 });
  const timeMin = `${startDate}T00:00:00.000Z`;
  const timeMax = exclusiveTimeMaxUtc(endDate);

  const stats: CalendarSyncStats = {
    fetched: 0,
    upserted: 0,
    markedRemoved: 0,
    calendarsProcessed: 0,
    autoCategorized: 0,
  };
  const errors: CalendarSyncCalendarError[] = [];

  const accountLabel = row.account_label;

  let calendarEntries: calendar_v3.Schema$CalendarListEntry[] = [];
  try {
    const listResp = await calApi.calendarList.list();
    calendarEntries = listResp.data.items || [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to list calendars: ${message}`);
  }

  for (const cal of calendarEntries) {
    const calId = cal.id;
    if (!calId) continue;
    if (calId.includes("#holiday@group")) continue;

    const calendarName = cal.summary || calId;
    let events: calendar_v3.Schema$Event[];
    try {
      events = await fetchAllCalendarEvents(calApi, calId, timeMin, timeMax);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({
        calendarId: calId,
        calendarSummary: calendarName,
        message,
      });
      continue;
    }

    stats.calendarsProcessed += 1;
    stats.fetched += events.length;

    const rows: EventInsert[] = [];
    const kept = new Set<string>();

    for (const ev of events) {
      const mapped = googleEventToRow({
        userId,
        account: accountLabel,
        calendarId: calId,
        calendarName,
        event: ev,
      });
      if (!mapped) continue;
      rows.push(mapped.row);
      kept.add(mapped.stableId);
      if (mapped.row.auto_categorized) stats.autoCategorized += 1;
    }

    const upserted = await upsertEventRows(rows);
    stats.upserted += upserted;

    const existing = await loadExistingIdsForCalendarWindow(
      userId,
      accountLabel,
      calendarName,
      startDate,
      endDate
    );
    const toRemove = existing.filter((id) => !kept.has(id));
    stats.markedRemoved += await markEventsRemoved(toRemove, userId);
  }

  await reconcileDailySummariesForDateRange(userId, startDate, endDate);

  return { stats, errors };
}
