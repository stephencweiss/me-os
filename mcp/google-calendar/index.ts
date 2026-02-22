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

function formatEvent(event: calendar_v3.Schema$Event, account: string): object {
  const colorId = event.colorId || "default";
  const colorName = colorId === "default" ? "Default" : GOOGLE_CALENDAR_COLORS[colorId] || colorId;
  const colorMeaning = colorDefinitions[colorId]?.meaning || "";

  return {
    id: event.id,
    account,
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

// Fetch events from all accounts and merge
async function fetchEventsFromAllAccounts(
  timeMin: string,
  timeMax: string,
  query?: string
): Promise<object[]> {
  const clients = await getClients();
  const allEvents: object[] = [];

  for (const { account, calendar } of clients) {
    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        q: query,
        singleEvents: true,
        orderBy: "startTime",
      });
      const events = response.data.items?.map(e => formatEvent(e, account)) || [];
      allEvents.push(...events);
    } catch (err) {
      console.error(`Failed to fetch events for ${account}:`, err);
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
        description: "Get calendar events for a date range",
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
          },
          required: ["query"],
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
        const { startDate, endDate } = args as {
          startDate: string;
          endDate: string;
        };
        const events = await fetchEventsFromAllAccounts(
          new Date(startDate).toISOString(),
          new Date(endDate).toISOString()
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(events, null, 2),
            },
          ],
        };
      }

      case "get_week_view": {
        const { start, end } = getWeekBounds();
        const events = await fetchEventsFromAllAccounts(
          start.toISOString(),
          end.toISOString()
        );

        // Group by day
        const byDay: Record<string, object[]> = {};
        for (const event of events) {
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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  weekOf: start.toLocaleDateString(),
                  accounts: clients.map(c => c.account),
                  eventsByDay: byDay,
                  totalEvents: events.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_today": {
        const { start, end } = getTodayBounds();
        const events = await fetchEventsFromAllAccounts(
          start.toISOString(),
          end.toISOString()
        );
        const clients = await getClients();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  date: start.toLocaleDateString(),
                  accounts: clients.map(c => c.account),
                  events,
                  totalEvents: events.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_event_color": {
        const { eventId, colorId, calendarId = "primary", account } = args as {
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

        // Get the appropriate account's calendar
        const clients = await getClients();
        let targetAccount = account;

        // If no account specified, try to find the event in any account
        if (!targetAccount) {
          for (const { account: acct, calendar } of clients) {
            try {
              await calendar.events.get({ calendarId, eventId });
              targetAccount = acct;
              break;
            } catch {
              // Event not found in this account, continue
            }
          }
        }

        if (!targetAccount) {
          return {
            content: [
              {
                type: "text",
                text: `Event not found in any account. Please specify the account parameter.`,
              },
            ],
            isError: true,
          };
        }

        const calendar = await getClientForAccount(targetAccount);
        const response = await calendar.events.patch({
          calendarId,
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
                  event: formatEvent(response.data, targetAccount),
                },
                null,
                2
              ),
            },
          ],
        };
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
        const { query, startDate, endDate } = args as {
          query: string;
          startDate?: string;
          endDate?: string;
        };

        // Default to searching current month if no dates provided
        const start = startDate ? new Date(startDate) : new Date();
        if (!startDate) {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
        }
        const end = endDate ? new Date(endDate) : new Date(start);
        if (!endDate) {
          end.setMonth(end.getMonth() + 1);
        }

        const events = await fetchEventsFromAllAccounts(
          start.toISOString(),
          end.toISOString(),
          query
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  results: events,
                  count: events.length,
                },
                null,
                2
              ),
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
