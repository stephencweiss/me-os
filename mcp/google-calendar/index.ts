#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getAuthenticatedClient, getCalendarClient } from "../../lib/google-auth.js";
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

let calendarClient: calendar_v3.Calendar | null = null;

async function getClient(): Promise<calendar_v3.Calendar> {
  if (!calendarClient) {
    const auth = await getAuthenticatedClient();
    calendarClient = getCalendarClient(auth);
  }
  return calendarClient;
}

function formatEvent(event: calendar_v3.Schema$Event): object {
  const colorId = event.colorId || "default";
  const colorName = colorId === "default" ? "Default" : GOOGLE_CALENDAR_COLORS[colorId] || colorId;
  const colorMeaning = colorDefinitions[colorId]?.meaning || "";

  return {
    id: event.id,
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
  const calendar = await getClient();

  try {
    switch (name) {
      case "list_calendars": {
        const response = await calendar.calendarList.list();
        const calendars = response.data.items?.map((cal) => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary,
          backgroundColor: cal.backgroundColor,
          accessRole: cal.accessRole,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(calendars, null, 2),
            },
          ],
        };
      }

      case "get_events": {
        const { startDate, endDate, calendarId = "primary" } = args as {
          startDate: string;
          endDate: string;
          calendarId?: string;
        };
        const response = await calendar.events.list({
          calendarId,
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate).toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = response.data.items?.map(formatEvent) || [];
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
        const { calendarId = "primary" } = args as { calendarId?: string };
        const { start, end } = getWeekBounds();
        const response = await calendar.events.list({
          calendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items?.map(formatEvent) || [];

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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  weekOf: start.toLocaleDateString(),
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
        const { calendarId = "primary" } = args as { calendarId?: string };
        const { start, end } = getTodayBounds();
        const response = await calendar.events.list({
          calendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = response.data.items?.map(formatEvent) || [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  date: start.toLocaleDateString(),
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
        const { eventId, colorId, calendarId = "primary" } = args as {
          eventId: string;
          colorId: string;
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
                  event: formatEvent(response.data),
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
        const { query, startDate, endDate, calendarId = "primary" } = args as {
          query: string;
          startDate?: string;
          endDate?: string;
          calendarId?: string;
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

        const response = await calendar.events.list({
          calendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          q: query,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items?.map(formatEvent) || [];
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
  const calendar = await getClient();

  try {
    if (uri === "calendar://today") {
      const { start, end } = getTodayBounds();
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });
      const events = response.data.items?.map(formatEvent) || [];
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ date: start.toLocaleDateString(), events }, null, 2),
          },
        ],
      };
    }

    if (uri === "calendar://week") {
      const { start, end } = getWeekBounds();
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });
      const events = response.data.items?.map(formatEvent) || [];
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ weekOf: start.toLocaleDateString(), events }, null, 2),
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
