#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getAllAuthenticatedClients,
  getAuthenticatedClient,
  getCalendarClient,
  AuthenticatedAccount
} from "../../lib/google-auth.js";
import {
  CalendarType,
  loadCalendarFilterConfig,
  getCalendarType,
  shouldIncludeEvent,
  CalendarFilterConfig,
} from "../../lib/calendar-filter.js";
import { calendar_v3 } from "googleapis";
import * as fs from "fs";
import * as path from "path";

// Load color definitions
const colorsPath = path.join(process.cwd(), "config", "colors.json");
const colorDefinitions = fs.existsSync(colorsPath)
  ? JSON.parse(fs.readFileSync(colorsPath, "utf-8"))
  : {};

// Google Calendar color IDs mapping
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

// Output size limits to prevent token overflow
const MAX_RESULTS_PER_CALENDAR = 100; // Google API limit per calendar
const DEFAULT_EVENT_LIMIT = 200; // Default max events returned
const ABSOLUTE_MAX_EVENTS = 500; // Hard ceiling

// Cache for authenticated clients
let cachedClients: AuthenticatedAccount[] | null = null;

async function getClients(): Promise<AuthenticatedAccount[]> {
  if (!cachedClients) {
    cachedClients = await getAllAuthenticatedClients();
  }
  return cachedClients;
}

// Get a specific account's calendar client
async function getClientForAccount(account: string): Promise<calendar_v3.Calendar> {
  const clients = await getClients();
  const found = clients.find(c => c.account === account);
  if (!found) {
    throw new Error(`Account not found: ${account}. Available: ${clients.map(c => c.account).join(", ")}`);
  }
  return found.calendar;
}

function formatEvent(
  event: calendar_v3.Schema$Event,
  account: string,
  calendarName?: string,
  calendarType?: CalendarType,
  calendarId?: string
): object {
  const colorId = event.colorId || "default";
  const colorName = colorId === "default" ? "Default" : GOOGLE_CALENDAR_COLORS[colorId] || colorId;
  const colorMeaning = colorDefinitions[colorId]?.meaning || "";

  return {
    id: event.id,
    account,
    calendarId: calendarId || "primary",
    calendarName: calendarName || "Primary",
    calendarType: calendarType || "active",
    summary: event.summary || "(No title)",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    colorId,
    colorName,
    colorMeaning,
    location: event.location,
    description: event.description,
    status: event.status,
    htmlLink: event.htmlLink,
  };
}

/**
 * Format event in compact mode - minimal fields for reduced output size.
 * Expects a formatted event (from formatEvent) with account and calendarId.
 * Use compact: false to get full details including description, location, htmlLink.
 */
function formatEventCompact(event: any): object {
  return {
    id: event.id,
    account: event.account,
    calendarId: event.calendarId || "primary",
    summary: event.summary || "(No title)",
    start: event.start,
    end: event.end,
    colorName: event.colorName || "Default",
  };
}

/**
 * Deduplicate events by ID. When same event appears from multiple calendars,
 * prefer the one from Primary calendar or the first occurrence.
 */
function deduplicateEvents(events: any[]): any[] {
  const seen = new Map<string, any>();
  for (const event of events) {
    const existing = seen.get(event.id);
    if (!existing || event.calendarName === "Primary") {
      seen.set(event.id, event);
    }
  }
  return Array.from(seen.values());
}

/**
 * Generate summary statistics for a list of events.
 * Used when summary mode is enabled to return aggregated data instead of full events.
 */
function generateEventSummary(events: any[]): object {
  const byColor: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byAccount: Record<string, number> = {};

  for (const event of events) {
    // Count by color
    const colorName = event.colorName || "Default";
    byColor[colorName] = (byColor[colorName] || 0) + 1;

    // Count by day
    const eventDate = new Date(event.start);
    const dayKey = eventDate.toISOString().split("T")[0];
    byDay[dayKey] = (byDay[dayKey] || 0) + 1;

    // Count by account
    const account = event.account || "unknown";
    byAccount[account] = (byAccount[account] || 0) + 1;
  }

  return {
    totalEvents: events.length,
    byColor,
    byDay,
    byAccount,
  };
}

/**
 * Apply event limit and return result with truncation metadata.
 */
function applyEventLimit(
  events: any[],
  requestedLimit?: number,
  defaultLimit: number = DEFAULT_EVENT_LIMIT
): { events: any[]; truncated: number; effectiveLimit: number } {
  const effectiveLimit = Math.min(
    requestedLimit || defaultLimit,
    ABSOLUTE_MAX_EVENTS
  );
  const truncated = Math.max(0, events.length - effectiveLimit);
  const limitedEvents = events.slice(0, effectiveLimit);

  return { events: limitedEvents, truncated, effectiveLimit };
}

// Fetch events from all accounts and all calendars, then merge
async function fetchEventsFromAllAccounts(
  timeMin: string,
  timeMax: string,
  query?: string,
  maxResultsPerCalendar: number = MAX_RESULTS_PER_CALENDAR
): Promise<object[]> {
  const clients = await getClients();
  const allEvents: object[] = [];

  // Load calendar filter config
  const filterConfig = loadCalendarFilterConfig();

  for (const { account, calendar } of clients) {
    try {
      // Get user email for this account (for attendee checking)
      const primaryCalendar = await calendar.calendarList.get({ calendarId: "primary" });
      const userEmail = primaryCalendar.data.id || "";

      // Get all calendars for this account
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items || [];

      // Fetch events from each calendar
      for (const cal of calendars) {
        if (!cal.id) continue;

        // Skip holiday calendars (they add noise)
        if (cal.id.includes("#holiday@group")) continue;

        // Determine calendar type
        const calType = getCalendarType(
          {
            id: cal.id,
            summary: cal.summary || cal.id,
            primary: cal.primary,
            accessRole: cal.accessRole || "reader",
          },
          filterConfig
        );

        // Skip excluded calendars
        if (calType === "excluded") continue;

        // Check if this is a shared calendar without explicit type config
        const hasExplicitType = filterConfig.calendarTypes[cal.summary || ""] !== undefined ||
                                filterConfig.calendarTypes[cal.id] !== undefined;
        const isSharedWithoutExplicitType = !cal.primary &&
                                             cal.accessRole !== "owner" &&
                                             !hasExplicitType;

        try {
          const response = await calendar.events.list({
            calendarId: cal.id,
            timeMin,
            timeMax,
            q: query,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: maxResultsPerCalendar,
          });

          const calendarName = cal.primary ? "Primary" : (cal.summary || cal.id);

          for (const event of response.data.items || []) {
            // For shared calendars without explicit type, filter by attendee status
            if (isSharedWithoutExplicitType) {
              const include = shouldIncludeEvent(
                {
                  attendees: event.attendees,
                  organizer: event.organizer,
                },
                userEmail,
                calType,
                true // isSharedCalendarWithoutExplicitType
              );
              if (!include) continue;
            }

            allEvents.push(formatEvent(event, account, calendarName, calType, cal.id));
          }
        } catch (err) {
          // Silently skip calendars we can't read (e.g., some shared calendars)
          console.error(`Failed to fetch events from ${cal.summary || cal.id} for ${account}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch calendars for ${account}:`, err);
    }
  }

  // Sort by start time
  allEvents.sort((a: any, b: any) => {
    const aTime = new Date(a.start).getTime();
    const bTime = new Date(b.start).getTime();
    return aTime - bTime;
  });

  return allEvents;
}

/**
 * Find an event by ID across all calendars in all accounts.
 * Returns the account, calendarId, and event when found.
 * Prefers calendars where the user has write access (owner > writer > reader).
 * This allows update operations to target the correct calendar.
 */
async function findEventInAllCalendars(
  eventId: string,
  clients: AuthenticatedAccount[],
  preferredCalendarId?: string
): Promise<{
  account: string;
  calendarId: string;
  calendar: calendar_v3.Calendar;
  event: calendar_v3.Schema$Event;
} | null> {
  // Collect all matches with their access levels and ownership info
  const matches: Array<{
    account: string;
    calendarId: string;
    calendar: calendar_v3.Calendar;
    event: calendar_v3.Schema$Event;
    accessRole: string;
    isPrimary: boolean;
    isEventOrganizer: boolean;  // True if this calendar is the event's source
  }> = [];

  for (const { account, calendar } of clients) {
    // First try the preferred calendarId if provided
    if (preferredCalendarId) {
      try {
        const response = await calendar.events.get({
          calendarId: preferredCalendarId,
          eventId,
        });
        // If preferred calendar is specified and found, use it immediately
        return {
          account,
          calendarId: preferredCalendarId,
          calendar,
          event: response.data,
        };
      } catch {
        // Not found on preferred calendar, continue searching
      }
    }

    // Get all calendars for this account and search each one
    try {
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items || [];

      for (const cal of calendars) {
        if (!cal.id) continue;
        // Skip if this is the preferred calendar we already tried
        if (preferredCalendarId && cal.id === preferredCalendarId) continue;

        try {
          const response = await calendar.events.get({
            calendarId: cal.id,
            eventId,
          });
          matches.push({
            account,
            calendarId: cal.id,
            calendar,
            event: response.data,
            accessRole: cal.accessRole || "reader",
            isPrimary: cal.primary || false,
            isEventOrganizer: response.data.organizer?.self === true,
          });
        } catch {
          // Not found on this calendar, continue
        }
      }
    } catch {
      // Failed to list calendars for this account, continue to next
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort matches to find the best calendar for updating:
  // 1. Prefer calendars where we're the event organizer (source calendar)
  // 2. Then by access level: owner > writer > others
  // 3. Then prefer non-primary calendars
  const accessPriority: Record<string, number> = {
    owner: 3,
    writer: 2,
    reader: 1,
    freeBusyReader: 0,
  };

  matches.sort((a, b) => {
    // First priority: prefer calendar where we're the event organizer
    if (a.isEventOrganizer !== b.isEventOrganizer) {
      return a.isEventOrganizer ? -1 : 1; // Organizer first
    }
    // Second priority: access level
    const aPriority = accessPriority[a.accessRole] ?? 0;
    const bPriority = accessPriority[b.accessRole] ?? 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    // Third priority: prefer non-primary (shared calendar is likely the source)
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? 1 : -1; // Non-primary first
    }
    return 0;
  });

  const best = matches[0];
  return {
    account: best.account,
    calendarId: best.calendarId,
    calendar: best.calendar,
    event: best.event,
  };
}

/**
 * Normalizes date input for calendar queries.
 * - Date-only strings (YYYY-MM-DD) are converted to local timezone
 * - For end dates, date-only strings get +1 day to make the range inclusive
 */
function normalizeDateInput(dateStr: string, isEndDate: boolean = false): string {
  // Check if it's a date-only format (no time component)
  const isDateOnly = !dateStr.includes('T');

  if (isDateOnly) {
    // Parse as local date, not UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (isEndDate) {
      // For end date, set to start of NEXT day to make range inclusive
      date.setDate(date.getDate() + 1);
    }

    return date.toISOString();
  }

  // Already has time component, parse normally
  return new Date(dateStr).toISOString();
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function getTodayBounds(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

const server = new Server(
  {
    name: "google-calendar",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_calendars",
        description: "List all calendars the user has access to",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_events",
        description: "Get calendar events for a date range. Default limit is 200 events to prevent token overflow.",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date in ISO format (YYYY-MM-DD or full ISO)",
            },
            endDate: {
              type: "string",
              description: "End date in ISO format (YYYY-MM-DD or full ISO)",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            compact: {
              type: "boolean",
              description: "Return compact format with fewer fields (default: true). Set to false for full details including description, location, htmlLink.",
              default: true,
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return (default: 200, max: 500)",
            },
            summary: {
              type: "boolean",
              description: "Return summary statistics instead of full event list (useful for large date ranges)",
              default: false,
            },
          },
          required: ["startDate", "endDate"],
        },
      },
      {
        name: "get_week_view",
        description: "Get a week-at-a-glance view of calendar events with color information",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            compact: {
              type: "boolean",
              description: "Return compact format with fewer fields (default: true). Set to false for full details.",
              default: true,
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return",
            },
          },
          required: [],
        },
      },
      {
        name: "get_today",
        description: "Get today's calendar events",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            compact: {
              type: "boolean",
              description: "Return compact format with fewer fields (default: true). Set to false for full details.",
              default: true,
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return",
            },
          },
          required: [],
        },
      },
      {
        name: "update_event_color",
        description: "Change the color of a calendar event",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The event ID to update",
            },
            colorId: {
              type: "string",
              description: "Color ID (1-11) or color name (Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock, Graphite, Blueberry, Basil, Tomato)",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
          },
          required: ["eventId", "colorId"],
        },
      },
      {
        name: "get_color_definitions",
        description: "Get the semantic color definitions and available calendar colors",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "search_events",
        description: "Search for events by title/summary",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to match against event titles",
            },
            startDate: {
              type: "string",
              description: "Start date for search range (ISO format)",
            },
            endDate: {
              type: "string",
              description: "End date for search range (ISO format)",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            compact: {
              type: "boolean",
              description: "Return compact format with fewer fields (default: true). Set to false for full details.",
              default: true,
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "create_event",
        description: "Create a new calendar event (for flex time blocking or manual events)",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Event title/summary",
            },
            start: {
              type: "string",
              description: "Start time in ISO format (e.g., 2026-02-23T09:00:00)",
            },
            end: {
              type: "string",
              description: "End time in ISO format (e.g., 2026-02-23T10:00:00)",
            },
            colorId: {
              type: "string",
              description: "Color ID (1-11) or color name. Default is Blueberry (9) for flex events.",
              default: "9",
            },
            visibility: {
              type: "string",
              enum: ["default", "public", "private", "confidential"],
              description: "Event visibility. Use 'private' for flex events.",
              default: "private",
            },
            account: {
              type: "string",
              description: "Which account to create the event on (e.g., 'personal', 'work'). Required.",
            },
            description: {
              type: "string",
              description: "Event description (optional)",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
          },
          required: ["summary", "start", "end", "account"],
        },
      },
      {
        name: "update_event_status",
        description: "Update RSVP status for an event (accept, decline, or tentative)",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The event ID to update",
            },
            status: {
              type: "string",
              enum: ["accepted", "declined", "tentative", "needsAction"],
              description: "The RSVP status to set",
            },
            account: {
              type: "string",
              description: "Which account the event is on. If not provided, will search all accounts.",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
          },
          required: ["eventId", "status"],
        },
      },
      {
        name: "decline_event",
        description: "Smart decline: If you're an attendee, declines the invitation. If you're the organizer with active attendees, declines but keeps the event. If you're the organizer with no active attendees, deletes the event.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The event ID to decline",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            sendUpdates: {
              type: "string",
              description: "Whether to send notifications: 'all' (notify organizer), 'none' (silent). Default: 'all'",
              enum: ["all", "none"],
              default: "all",
            },
            account: {
              type: "string",
              description: "Which account to use (personal/work). Auto-detected if not specified.",
            },
          },
          required: ["eventId"],
        },
      },
      {
        name: "update_event_time",
        description: "Move/reschedule an event to a new time",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The event ID to update",
            },
            newStart: {
              type: "string",
              description: "New start time in ISO format (e.g., 2026-02-23T09:00:00)",
            },
            newEnd: {
              type: "string",
              description: "New end time in ISO format (e.g., 2026-02-23T10:00:00)",
            },
            account: {
              type: "string",
              description: "Which account the event is on. Auto-detected if not specified.",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            sendUpdates: {
              type: "string",
              description: "Whether to send notifications: 'all' (notify attendees), 'none' (silent). Default: 'all'",
              enum: ["all", "none"],
              default: "all",
            },
          },
          required: ["eventId", "newStart", "newEnd"],
        },
      },
      {
        name: "delete_event",
        description: "Delete a calendar event",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The event ID to delete",
            },
            account: {
              type: "string",
              description: "Which account the event is on. Auto-detected if not specified.",
            },
            calendarId: {
              type: "string",
              description: "Calendar ID (default: primary)",
              default: "primary",
            },
            sendUpdates: {
              type: "string",
              description: "Whether to send notifications: 'all' (notify attendees), 'none' (silent). Default: 'all'",
              enum: ["all", "none"],
              default: "all",
            },
          },
          required: ["eventId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_calendars": {
        // List calendars from all accounts
        const clients = await getClients();
        const allCalendars: object[] = [];

        for (const { account, calendar } of clients) {
          const response = await calendar.calendarList.list();
          const calendars = response.data.items?.map((cal) => ({
            account,
            id: cal.id,
            summary: cal.summary,
            primary: cal.primary,
            backgroundColor: cal.backgroundColor,
            accessRole: cal.accessRole,
          })) || [];
          allCalendars.push(...calendars);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(allCalendars, null, 2),
            },
          ],
        };
      }

      case "get_events": {
        const { startDate, endDate, compact = true, limit, summary = false } = args as {
          startDate: string;
          endDate: string;
          compact?: boolean;
          limit?: number;
          summary?: boolean;
        };
        let events = await fetchEventsFromAllAccounts(
          normalizeDateInput(startDate, false),
          normalizeDateInput(endDate, true)
        );

        // Deduplicate events
        events = deduplicateEvents(events);

        // If summary mode, return statistics instead of event list
        if (summary) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(generateEventSummary(events), null, 2),
              },
            ],
          };
        }

        // Apply limit with truncation tracking
        const { events: limitedEvents, truncated, effectiveLimit } = applyEventLimit(events, limit);

        // Format based on compact mode
        const formattedEvents = compact
          ? limitedEvents.map((e: any) => formatEventCompact(e))
          : limitedEvents;

        const result: any = {
          events: formattedEvents,
          count: formattedEvents.length,
        };

        // Add truncation warning if events were cut
        if (truncated > 0) {
          result.truncated = truncated;
          result.warning = `Results truncated. Showing ${effectiveLimit} of ${events.length} events. Use 'summary: true' for statistics of large ranges.`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_week_view": {
        const { compact = true, limit } = args as {
          compact?: boolean;
          limit?: number;
        };
        const { start, end } = getWeekBounds();
        let events = await fetchEventsFromAllAccounts(
          start.toISOString(),
          end.toISOString()
        );

        // Deduplicate events
        events = deduplicateEvents(events);

        // Apply limit with truncation tracking (default 200 for week view)
        const { events: limitedEvents, truncated, effectiveLimit } = applyEventLimit(events, limit);

        // Format based on compact mode
        const formattedEvents = compact
          ? limitedEvents.map((e: any) => formatEventCompact(e))
          : limitedEvents;

        // Group by day
        const byDay: Record<string, object[]> = {};
        for (const event of formattedEvents) {
          const eventDate = new Date((event as any).start);
          const dayKey = eventDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
          if (!byDay[dayKey]) byDay[dayKey] = [];
          byDay[dayKey].push(event);
        }

        const clients = await getClients();
        const result: any = {
          weekOf: start.toLocaleDateString(),
          accounts: clients.map(c => c.account),
          eventsByDay: byDay,
          totalEvents: formattedEvents.length,
        };

        if (truncated > 0) {
          result.truncated = truncated;
          result.warning = `Results truncated. Showing ${effectiveLimit} of ${events.length} events.`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_today": {
        const { compact = true, limit } = args as {
          compact?: boolean;
          limit?: number;
        };
        const { start, end } = getTodayBounds();
        let events = await fetchEventsFromAllAccounts(
          start.toISOString(),
          end.toISOString()
        );

        // Deduplicate events
        events = deduplicateEvents(events);

        // Apply limit with truncation tracking (default 200)
        const { events: limitedEvents, truncated, effectiveLimit } = applyEventLimit(events, limit);

        // Format based on compact mode
        const formattedEvents = compact
          ? limitedEvents.map((e: any) => formatEventCompact(e))
          : limitedEvents;

        const clients = await getClients();
        const result: any = {
          date: start.toLocaleDateString(),
          accounts: clients.map(c => c.account),
          events: formattedEvents,
          totalEvents: formattedEvents.length,
        };

        if (truncated > 0) {
          result.truncated = truncated;
          result.warning = `Results truncated. Showing ${effectiveLimit} of ${events.length} events.`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "update_event_color": {
        const { eventId, colorId, calendarId, account } = args as {
          eventId: string;
          colorId: string;
          calendarId?: string;
          account?: string;
        };

        // Resolve color name to ID if needed
        let resolvedColorId = colorId;
        if (isNaN(parseInt(colorId))) {
          const colorEntry = Object.entries(GOOGLE_CALENDAR_COLORS).find(
            ([_, name]) => name.toLowerCase() === colorId.toLowerCase()
          );
          if (colorEntry) {
            resolvedColorId = colorEntry[0];
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Invalid color: ${colorId}. Valid colors: ${Object.values(GOOGLE_CALENDAR_COLORS).join(", ")}`,
                },
              ],
              isError: true,
            };
          }
        }

        const clients = await getClients();

        // If account is specified, get that specific calendar client
        // Otherwise, search all calendars to find the event
        let targetAccount: string;
        let targetCalendarId: string;
        let targetCalendar: calendar_v3.Calendar;

        if (account) {
          targetAccount = account;
          targetCalendarId = calendarId || "primary";
          targetCalendar = await getClientForAccount(account);
        } else {
          // Search all calendars for the event
          const found = await findEventInAllCalendars(eventId, clients, calendarId);
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: `Event not found in any calendar. Please specify the account and calendarId parameters.`,
                },
              ],
              isError: true,
            };
          }
          targetAccount = found.account;
          targetCalendarId = found.calendarId;
          targetCalendar = found.calendar;
        }

        try {
          const response = await targetCalendar.events.patch({
            calendarId: targetCalendarId,
            eventId,
            requestBody: {
              colorId: resolvedColorId,
            },
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    account: targetAccount,
                    calendarId: targetCalendarId,
                    event: formatEvent(response.data, targetAccount, undefined, undefined, targetCalendarId),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err: any) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: err.message,
                  debug: {
                    attemptedAccount: targetAccount,
                    attemptedCalendarId: targetCalendarId,
                    eventId,
                  },
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      case "get_color_definitions": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  googleColors: GOOGLE_CALENDAR_COLORS,
                  semanticMeanings: colorDefinitions,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_events": {
        const { query, startDate, endDate, compact = true, limit } = args as {
          query: string;
          startDate?: string;
          endDate?: string;
          compact?: boolean;
          limit?: number;
        };

        // Default to searching current month if no dates provided
        let timeMin: string;
        let timeMax: string;

        if (startDate) {
          timeMin = normalizeDateInput(startDate, false);
        } else {
          const start = new Date();
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          timeMin = start.toISOString();
        }

        if (endDate) {
          timeMax = normalizeDateInput(endDate, true);
        } else {
          const end = new Date(timeMin);
          end.setMonth(end.getMonth() + 1);
          timeMax = end.toISOString();
        }

        let events = await fetchEventsFromAllAccounts(
          timeMin,
          timeMax,
          query
        );

        // Deduplicate events
        events = deduplicateEvents(events);

        // Apply limit with truncation tracking (default 200 for search)
        const { events: limitedEvents, truncated, effectiveLimit } = applyEventLimit(events, limit);

        // Format based on compact mode
        const formattedEvents = compact
          ? limitedEvents.map((e: any) => formatEventCompact(e))
          : limitedEvents;

        const result: any = {
          query,
          results: formattedEvents,
          count: formattedEvents.length,
        };

        if (truncated > 0) {
          result.truncated = truncated;
          result.warning = `Results truncated. Showing ${effectiveLimit} of ${events.length} events.`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "create_event": {
        const {
          summary,
          start,
          end,
          colorId = "9",
          visibility = "private",
          account,
          description,
          calendarId = "primary",
        } = args as {
          summary: string;
          start: string;
          end: string;
          colorId?: string;
          visibility?: string;
          account: string;
          description?: string;
          calendarId?: string;
        };

        // Resolve color name to ID if needed
        let resolvedColorId = colorId;
        if (isNaN(parseInt(colorId))) {
          const colorEntry = Object.entries(GOOGLE_CALENDAR_COLORS).find(
            ([_, name]) => name.toLowerCase() === colorId.toLowerCase()
          );
          if (colorEntry) {
            resolvedColorId = colorEntry[0];
          }
        }

        const calendar = await getClientForAccount(account);

        // Determine timezone from start date or use local
        const startDate = new Date(start);
        const endDate = new Date(end);

        const response = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary,
            description,
            start: {
              dateTime: startDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            colorId: resolvedColorId,
            visibility,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  account,
                  event: formatEvent(response.data, account),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_event_status": {
        const { eventId, status, account, calendarId } = args as {
          eventId: string;
          status: "accepted" | "declined" | "tentative" | "needsAction";
          account?: string;
          calendarId?: string;
        };

        const clients = await getClients();
        let targetAccount: string;
        let targetCalendarId: string;
        let targetCalendar: calendar_v3.Calendar;
        let existingEvent: calendar_v3.Schema$Event;

        // Find the event - search all calendars if account not specified
        if (account) {
          targetAccount = account;
          targetCalendarId = calendarId || "primary";
          targetCalendar = await getClientForAccount(account);
          const eventResponse = await targetCalendar.events.get({
            calendarId: targetCalendarId,
            eventId,
          });
          existingEvent = eventResponse.data;
        } else {
          const found = await findEventInAllCalendars(eventId, clients, calendarId);
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: `Event not found in any calendar. Please specify the account and calendarId parameters.`,
                },
              ],
              isError: true,
            };
          }
          targetAccount = found.account;
          targetCalendarId = found.calendarId;
          targetCalendar = found.calendar;
          existingEvent = found.event;
        }

        // Get the user's email for this account
        const calendarList = await targetCalendar.calendarList.get({
          calendarId: "primary",
        });
        const userEmail = calendarList.data.id;

        // Update the attendee status
        const updatedAttendees = existingEvent.attendees?.map((attendee) => {
          if (attendee.self || attendee.email === userEmail) {
            return { ...attendee, responseStatus: status };
          }
          return attendee;
        });

        // If no attendees list (user is organizer), just update the event
        const response = await targetCalendar.events.patch({
          calendarId: targetCalendarId,
          eventId,
          requestBody: {
            attendees: updatedAttendees || undefined,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  account: targetAccount,
                  calendarId: targetCalendarId,
                  newStatus: status,
                  event: formatEvent(response.data, targetAccount, undefined, undefined, targetCalendarId),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "decline_event": {
        const {
          eventId,
          calendarId,
          sendUpdates = "all",
          account,
        } = args as {
          eventId: string;
          calendarId?: string;
          sendUpdates?: "all" | "none";
          account?: string;
        };

        const clients = await getClients();
        let targetAccount: string;
        let targetCalendarId: string;
        let targetCalendar: calendar_v3.Calendar;
        let event: calendar_v3.Schema$Event;

        // Find the event and determine which account owns it
        if (account) {
          targetAccount = account;
          targetCalendarId = calendarId || "primary";
          targetCalendar = await getClientForAccount(account);
          const response = await targetCalendar.events.get({ calendarId: targetCalendarId, eventId });
          event = response.data;
        } else {
          const found = await findEventInAllCalendars(eventId, clients, calendarId);
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: "Event not found in any calendar. Please specify the account and calendarId parameters.",
                },
              ],
              isError: true,
            };
          }
          targetAccount = found.account;
          targetCalendarId = found.calendarId;
          targetCalendar = found.calendar;
          event = found.event;
        }

        // Get the authenticated user's email for this account
        const calendarListResponse = await targetCalendar.calendarList.get({ calendarId: "primary" });
        const userEmail = calendarListResponse.data.id || "";

        // Get attendees list
        const attendees = event.attendees || [];
        const selfAttendee = attendees.find(
          (a) => a.email?.toLowerCase() === userEmail.toLowerCase() || a.self === true
        );

        // Check if user is the organizer
        const isOrganizer = event.organizer?.self === true ||
                            event.organizer?.email?.toLowerCase() === userEmail.toLowerCase();

        // Check if there are other attendees (excluding self)
        const otherAttendees = attendees.filter(
          (a) => a.email?.toLowerCase() !== userEmail.toLowerCase() && a.self !== true
        );

        // Check if any other attendees are still "active" (not declined)
        const activeAttendees = otherAttendees.filter(
          (a) => a.responseStatus !== "declined"
        );
        const hasActiveAttendees = activeAttendees.length > 0;

        if (isOrganizer && !hasActiveAttendees) {
          // User is organizer with no other attendees OR all have declined - delete the event
          await targetCalendar.events.delete({
            calendarId: targetCalendarId,
            eventId,
            sendUpdates,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  account: targetAccount,
                  calendarId: targetCalendarId,
                  action: "deleted",
                  message: `Deleted event: ${event.summary} (no active attendees remaining)`,
                  sendUpdates,
                }, null, 2),
              },
            ],
          };
        }

        // If organizer with active attendees, decline our own attendance
        if (isOrganizer && hasActiveAttendees) {
          let organizerAttendee = attendees.find(
            (a) => a.email?.toLowerCase() === userEmail.toLowerCase() || a.self === true
          );

          if (!organizerAttendee) {
            // Add organizer as an attendee so we can decline
            organizerAttendee = { email: userEmail, responseStatus: "declined" };
            attendees.push(organizerAttendee);
          } else {
            organizerAttendee.responseStatus = "declined";
          }

          const response = await targetCalendar.events.patch({
            calendarId: targetCalendarId,
            eventId,
            sendUpdates,
            requestBody: { attendees },
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  account: targetAccount,
                  calendarId: targetCalendarId,
                  action: "declined",
                  message: `Declined event: ${event.summary} (you were the organizer, event continues for ${activeAttendees.length} active attendee(s))`,
                  sendUpdates,
                  event: formatEvent(response.data, targetAccount, undefined, undefined, targetCalendarId),
                }, null, 2),
              },
            ],
          };
        }

        if (!selfAttendee) {
          // User is not an attendee and not the organizer - edge case
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "You are not an attendee or organizer of this event.",
                  event: formatEvent(event, targetAccount, undefined, undefined, targetCalendarId),
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        // Update the response status to declined
        selfAttendee.responseStatus = "declined";

        // Patch the event with updated attendees
        const response = await targetCalendar.events.patch({
          calendarId: targetCalendarId,
          eventId,
          sendUpdates,
          requestBody: {
            attendees,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                account: targetAccount,
                calendarId: targetCalendarId,
                action: "declined",
                message: `Declined event: ${event.summary}`,
                sendUpdates,
                event: formatEvent(response.data, targetAccount, undefined, undefined, targetCalendarId),
              }, null, 2),
            },
          ],
        };
      }

      case "update_event_time": {
        const {
          eventId,
          newStart,
          newEnd,
          account,
          calendarId,
          sendUpdates = "all",
        } = args as {
          eventId: string;
          newStart: string;
          newEnd: string;
          account?: string;
          calendarId?: string;
          sendUpdates?: "all" | "none";
        };

        const clients = await getClients();
        let targetAccount: string;
        let targetCalendarId: string;
        let targetCalendar: calendar_v3.Calendar;
        let existingEvent: calendar_v3.Schema$Event;

        // Find the event - search all calendars if account not specified
        if (account) {
          targetAccount = account;
          targetCalendarId = calendarId || "primary";
          targetCalendar = await getClientForAccount(account);
          const response = await targetCalendar.events.get({ calendarId: targetCalendarId, eventId });
          existingEvent = response.data;
        } else {
          const found = await findEventInAllCalendars(eventId, clients, calendarId);
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: "Event not found in any calendar. Please specify the account and calendarId parameters.",
                },
              ],
              isError: true,
            };
          }
          targetAccount = found.account;
          targetCalendarId = found.calendarId;
          targetCalendar = found.calendar;
          existingEvent = found.event;
        }

        // Update the event with new times
        const startDate = new Date(newStart);
        const endDate = new Date(newEnd);

        const response = await targetCalendar.events.patch({
          calendarId: targetCalendarId,
          eventId,
          sendUpdates,
          requestBody: {
            start: {
              dateTime: startDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                account: targetAccount,
                calendarId: targetCalendarId,
                action: "rescheduled",
                oldStart: existingEvent.start?.dateTime || existingEvent.start?.date,
                oldEnd: existingEvent.end?.dateTime || existingEvent.end?.date,
                newStart: newStart,
                newEnd: newEnd,
                sendUpdates,
                event: formatEvent(response.data, targetAccount, undefined, undefined, targetCalendarId),
              }, null, 2),
            },
          ],
        };
      }

      case "delete_event": {
        const {
          eventId,
          account,
          calendarId,
          sendUpdates = "all",
        } = args as {
          eventId: string;
          account?: string;
          calendarId?: string;
          sendUpdates?: "all" | "none";
        };

        const clients = await getClients();
        let targetAccount: string;
        let targetCalendarId: string;
        let targetCalendar: calendar_v3.Calendar;
        let existingEvent: calendar_v3.Schema$Event;

        // Find the event - search all calendars if account not specified
        if (account) {
          targetAccount = account;
          targetCalendarId = calendarId || "primary";
          targetCalendar = await getClientForAccount(account);
          const response = await targetCalendar.events.get({ calendarId: targetCalendarId, eventId });
          existingEvent = response.data;
        } else {
          const found = await findEventInAllCalendars(eventId, clients, calendarId);
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: "Event not found in any calendar. Please specify the account and calendarId parameters.",
                },
              ],
              isError: true,
            };
          }
          targetAccount = found.account;
          targetCalendarId = found.calendarId;
          targetCalendar = found.calendar;
          existingEvent = found.event;
        }

        // Delete the event
        await targetCalendar.events.delete({
          calendarId: targetCalendarId,
          eventId,
          sendUpdates,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                account: targetAccount,
                calendarId: targetCalendarId,
                action: "deleted",
                message: `Deleted event: ${existingEvent.summary}`,
                sendUpdates,
                deletedEvent: {
                  id: existingEvent.id,
                  summary: existingEvent.summary,
                  start: existingEvent.start?.dateTime || existingEvent.start?.date,
                  end: existingEvent.end?.dateTime || existingEvent.end?.date,
                },
              }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "calendar://today",
        name: "Today's Events",
        description: "Calendar events for today",
        mimeType: "application/json",
      },
      {
        uri: "calendar://week",
        name: "This Week's Events",
        description: "Calendar events for the current week",
        mimeType: "application/json",
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri === "calendar://today") {
      const { start, end } = getTodayBounds();
      const events = await fetchEventsFromAllAccounts(
        start.toISOString(),
        end.toISOString()
      );
      const clients = await getClients();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              date: start.toLocaleDateString(),
              accounts: clients.map(c => c.account),
              events
            }, null, 2),
          },
        ],
      };
    }

    if (uri === "calendar://week") {
      const { start, end } = getWeekBounds();
      const events = await fetchEventsFromAllAccounts(
        start.toISOString(),
        end.toISOString()
      );
      const clients = await getClients();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              weekOf: start.toLocaleDateString(),
              accounts: clients.map(c => c.account),
              events
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error: any) {
    throw new Error(`Failed to read resource: ${error.message}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Calendar MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
