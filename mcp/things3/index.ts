#!/usr/bin/env node
/**
 * Things 3 MCP Server
 *
 * Provides read access to Things 3 database for fetching weekly goals.
 * Things 3 is a macOS task management app that stores data in a SQLite database.
 *
 * Database location:
 * ~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/Things Database.thingsdatabase/main.sqlite
 *
 * Week tags format: wN-YYYY (e.g., w10-2026 for week 10 of 2026)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Types
// ============================================================================

interface Things3Todo {
  uuid: string;
  title: string;
  notes: string | null;
  status: "open" | "completed" | "cancelled";
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  createdDate: string;
  modifiedDate: string;
  tags: string[];
  project: string | null;
  area: string | null;
  checklistItems?: { title: string; completed: boolean }[];
}

interface Things3Area {
  uuid: string;
  title: string;
}

interface Things3Project {
  uuid: string;
  title: string;
  areaTitle: string | null;
  status: "open" | "completed" | "cancelled";
}

// ============================================================================
// Database Path Detection
// ============================================================================

const THINGS3_DB_PATH = path.join(
  os.homedir(),
  "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/Things Database.thingsdatabase/main.sqlite"
);

function getDatabase(): Database.Database | null {
  if (!fs.existsSync(THINGS3_DB_PATH)) {
    console.error(`Things 3 database not found at: ${THINGS3_DB_PATH}`);
    return null;
  }

  try {
    // Open read-only to avoid any issues with Things 3
    return new Database(THINGS3_DB_PATH, { readonly: true });
  } catch (err) {
    console.error("Failed to open Things 3 database:", err);
    return null;
  }
}

// ============================================================================
// Date Conversion Helpers
// ============================================================================

/**
 * Things 3 stores dates as Julian Day numbers with fractional time.
 * Convert to ISO date string.
 */
function julianToISODate(julian: number | null): string | null {
  if (julian === null || julian === 0) return null;

  // Julian day epoch is November 24, 4714 BC
  // Unix epoch (Jan 1, 1970) is Julian day 2440587.5
  const unixEpochJulian = 2440587.5;
  const unixTimestamp = (julian - unixEpochJulian) * 86400 * 1000;

  return new Date(unixTimestamp).toISOString();
}

/**
 * Things 3 also uses Core Data-style timestamps (seconds since Jan 1, 2001)
 */
function coreDataToISODate(timestamp: number | null): string | null {
  if (timestamp === null || timestamp === 0) return null;

  // Core Data epoch is Jan 1, 2001 00:00:00 UTC
  // That's 978307200 seconds after Unix epoch
  const coreDataEpochOffset = 978307200;
  const unixTimestamp = (timestamp + coreDataEpochOffset) * 1000;

  return new Date(unixTimestamp).toISOString();
}

// ============================================================================
// Status Conversion
// ============================================================================

function statusFromInt(status: number): "open" | "completed" | "cancelled" {
  switch (status) {
    case 3:
      return "completed";
    case 2:
      return "cancelled";
    default:
      return "open";
  }
}

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Get todos by week tag (e.g., "w10-2026")
 */
function getTodosByWeekTag(db: Database.Database, weekTag: string): Things3Todo[] {
  const query = `
    SELECT
      t.uuid,
      t.title,
      t.notes,
      t.status,
      t.startDate,
      t.deadline,
      t.stopDate,
      t.creationDate,
      t.userModificationDate,
      GROUP_CONCAT(tag.title) as tags,
      p.title as projectTitle,
      a.title as areaTitle
    FROM TMTask t
    LEFT JOIN TMTaskTag tt ON t.uuid = tt.tasks
    LEFT JOIN TMTag tag ON tt.tags = tag.uuid
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    WHERE t.trashed = 0
      AND t.type = 0
      AND EXISTS (
        SELECT 1 FROM TMTaskTag tt2
        JOIN TMTag tag2 ON tt2.tags = tag2.uuid
        WHERE tt2.tasks = t.uuid
          AND LOWER(tag2.title) = LOWER(?)
      )
    GROUP BY t.uuid
    ORDER BY t.creationDate DESC
  `;

  const rows = db.prepare(query).all(weekTag) as any[];

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    notes: row.notes,
    status: statusFromInt(row.status),
    startDate: julianToISODate(row.startDate),
    dueDate: julianToISODate(row.deadline),
    completedDate: coreDataToISODate(row.stopDate),
    createdDate: coreDataToISODate(row.creationDate) || new Date().toISOString(),
    modifiedDate:
      coreDataToISODate(row.userModificationDate) || new Date().toISOString(),
    tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
    project: row.projectTitle || null,
    area: row.areaTitle || null,
  }));
}

/**
 * Search todos by text query
 */
function searchTodos(
  db: Database.Database,
  query: string,
  options: { includeCompleted?: boolean; limit?: number } = {}
): Things3Todo[] {
  const { includeCompleted = false, limit = 50 } = options;

  const statusFilter = includeCompleted
    ? ""
    : "AND t.status = 0"; // 0 = open

  const sql = `
    SELECT
      t.uuid,
      t.title,
      t.notes,
      t.status,
      t.startDate,
      t.deadline,
      t.stopDate,
      t.creationDate,
      t.userModificationDate,
      GROUP_CONCAT(tag.title) as tags,
      p.title as projectTitle,
      a.title as areaTitle
    FROM TMTask t
    LEFT JOIN TMTaskTag tt ON t.uuid = tt.tasks
    LEFT JOIN TMTag tag ON tt.tags = tag.uuid
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    WHERE t.trashed = 0
      AND t.type = 0
      ${statusFilter}
      AND (t.title LIKE ? OR t.notes LIKE ?)
    GROUP BY t.uuid
    ORDER BY t.creationDate DESC
    LIMIT ?
  `;

  const searchPattern = `%${query}%`;
  const rows = db.prepare(sql).all(searchPattern, searchPattern, limit) as any[];

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    notes: row.notes,
    status: statusFromInt(row.status),
    startDate: julianToISODate(row.startDate),
    dueDate: julianToISODate(row.deadline),
    completedDate: coreDataToISODate(row.stopDate),
    createdDate: coreDataToISODate(row.creationDate) || new Date().toISOString(),
    modifiedDate:
      coreDataToISODate(row.userModificationDate) || new Date().toISOString(),
    tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
    project: row.projectTitle || null,
    area: row.areaTitle || null,
  }));
}

/**
 * Get todos from a specific project
 */
function getTodosByProject(
  db: Database.Database,
  projectName: string,
  options: { includeCompleted?: boolean } = {}
): Things3Todo[] {
  const { includeCompleted = false } = options;

  const statusFilter = includeCompleted
    ? ""
    : "AND t.status = 0";

  const sql = `
    SELECT
      t.uuid,
      t.title,
      t.notes,
      t.status,
      t.startDate,
      t.deadline,
      t.stopDate,
      t.creationDate,
      t.userModificationDate,
      GROUP_CONCAT(tag.title) as tags,
      p.title as projectTitle,
      a.title as areaTitle
    FROM TMTask t
    LEFT JOIN TMTaskTag tt ON t.uuid = tt.tasks
    LEFT JOIN TMTag tag ON tt.tags = tag.uuid
    JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    WHERE t.trashed = 0
      AND t.type = 0
      AND LOWER(p.title) = LOWER(?)
      ${statusFilter}
    GROUP BY t.uuid
    ORDER BY t.index_ ASC
  `;

  const rows = db.prepare(sql).all(projectName) as any[];

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    notes: row.notes,
    status: statusFromInt(row.status),
    startDate: julianToISODate(row.startDate),
    dueDate: julianToISODate(row.deadline),
    completedDate: coreDataToISODate(row.stopDate),
    createdDate: coreDataToISODate(row.creationDate) || new Date().toISOString(),
    modifiedDate:
      coreDataToISODate(row.userModificationDate) || new Date().toISOString(),
    tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
    project: row.projectTitle || null,
    area: row.areaTitle || null,
  }));
}

/**
 * Get todos from a specific area
 */
function getTodosByArea(
  db: Database.Database,
  areaName: string,
  options: { includeCompleted?: boolean } = {}
): Things3Todo[] {
  const { includeCompleted = false } = options;

  const statusFilter = includeCompleted
    ? ""
    : "AND t.status = 0";

  const sql = `
    SELECT
      t.uuid,
      t.title,
      t.notes,
      t.status,
      t.startDate,
      t.deadline,
      t.stopDate,
      t.creationDate,
      t.userModificationDate,
      GROUP_CONCAT(tag.title) as tags,
      p.title as projectTitle,
      a.title as areaTitle
    FROM TMTask t
    LEFT JOIN TMTaskTag tt ON t.uuid = tt.tasks
    LEFT JOIN TMTag tag ON tt.tags = tag.uuid
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    WHERE t.trashed = 0
      AND t.type = 0
      AND LOWER(a.title) = LOWER(?)
      ${statusFilter}
    GROUP BY t.uuid
    ORDER BY t.creationDate DESC
  `;

  const rows = db.prepare(sql).all(areaName) as any[];

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    notes: row.notes,
    status: statusFromInt(row.status),
    startDate: julianToISODate(row.startDate),
    dueDate: julianToISODate(row.deadline),
    completedDate: coreDataToISODate(row.stopDate),
    createdDate: coreDataToISODate(row.creationDate) || new Date().toISOString(),
    modifiedDate:
      coreDataToISODate(row.userModificationDate) || new Date().toISOString(),
    tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
    project: row.projectTitle || null,
    area: row.areaTitle || null,
  }));
}

/**
 * List all areas
 */
function listAreas(db: Database.Database): Things3Area[] {
  const sql = `
    SELECT uuid, title
    FROM TMArea
    WHERE visible = 1
    ORDER BY index_ ASC
  `;

  const rows = db.prepare(sql).all() as any[];
  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
  }));
}

/**
 * List all projects
 */
function listProjects(
  db: Database.Database,
  options: { includeCompleted?: boolean } = {}
): Things3Project[] {
  const { includeCompleted = false } = options;

  const statusFilter = includeCompleted
    ? ""
    : "AND p.status = 0";

  const sql = `
    SELECT
      p.uuid,
      p.title,
      p.status,
      a.title as areaTitle
    FROM TMTask p
    LEFT JOIN TMArea a ON p.area = a.uuid
    WHERE p.type = 1
      AND p.trashed = 0
      ${statusFilter}
    ORDER BY p.index_ ASC
  `;

  const rows = db.prepare(sql).all() as any[];
  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    areaTitle: row.areaTitle || null,
    status: statusFromInt(row.status),
  }));
}

/**
 * List all tags
 */
function listTags(db: Database.Database): string[] {
  const sql = `
    SELECT DISTINCT title
    FROM TMTag
    WHERE title IS NOT NULL AND title != ''
    ORDER BY title
  `;

  const rows = db.prepare(sql).all() as any[];
  return rows.map((row) => row.title);
}

/**
 * Get todos by tag
 */
function getTodosByTag(
  db: Database.Database,
  tagName: string,
  options: { includeCompleted?: boolean } = {}
): Things3Todo[] {
  const { includeCompleted = false } = options;

  const statusFilter = includeCompleted
    ? ""
    : "AND t.status = 0";

  const sql = `
    SELECT
      t.uuid,
      t.title,
      t.notes,
      t.status,
      t.startDate,
      t.deadline,
      t.stopDate,
      t.creationDate,
      t.userModificationDate,
      GROUP_CONCAT(tag.title) as tags,
      p.title as projectTitle,
      a.title as areaTitle
    FROM TMTask t
    LEFT JOIN TMTaskTag tt ON t.uuid = tt.tasks
    LEFT JOIN TMTag tag ON tt.tags = tag.uuid
    LEFT JOIN TMTask p ON t.project = p.uuid
    LEFT JOIN TMArea a ON COALESCE(t.area, p.area) = a.uuid
    WHERE t.trashed = 0
      AND t.type = 0
      ${statusFilter}
      AND EXISTS (
        SELECT 1 FROM TMTaskTag tt2
        JOIN TMTag tag2 ON tt2.tags = tag2.uuid
        WHERE tt2.tasks = t.uuid
          AND LOWER(tag2.title) = LOWER(?)
      )
    GROUP BY t.uuid
    ORDER BY t.creationDate DESC
  `;

  const rows = db.prepare(sql).all(tagName) as any[];

  return rows.map((row) => ({
    uuid: row.uuid,
    title: row.title,
    notes: row.notes,
    status: statusFromInt(row.status),
    startDate: julianToISODate(row.startDate),
    dueDate: julianToISODate(row.deadline),
    completedDate: coreDataToISODate(row.stopDate),
    createdDate: coreDataToISODate(row.creationDate) || new Date().toISOString(),
    modifiedDate:
      coreDataToISODate(row.userModificationDate) || new Date().toISOString(),
    tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()) : [],
    project: row.projectTitle || null,
    area: row.areaTitle || null,
  }));
}

/**
 * Convert week ID (YYYY-WWW) to Things 3 tag format (wN-YYYY)
 * @deprecated Use simple "week" tag with deadline-based inference instead
 */
function weekIdToThings3Tag(weekId: string): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week ID format: ${weekId}. Expected YYYY-WWW (e.g., 2026-W10)`);
  }
  const [, year, week] = match;
  // Things 3 uses wN-YYYY format (e.g., w10-2026)
  return `w${parseInt(week, 10)}-${year}`;
}

/**
 * Get the end date (Sunday) for a week ID
 */
function getWeekEndDate(weekId: string): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week ID format: ${weekId}. Expected YYYY-WWW (e.g., 2026-W10)`);
  }
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO week 1 contains January 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Make Sunday = 7

  // Start of week 1 (Monday)
  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Start of requested week (Monday)
  const weekStart = new Date(week1Start);
  weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);

  // End of week (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return weekEnd.toISOString().split("T")[0];
}

/**
 * Generate Things 3 URL to create a new goal with "week" tag
 */
function generateCreateGoalUrl(
  title: string,
  weekId: string,
  options?: { notes?: string; estimatedMinutes?: number }
): string {
  const params = new URLSearchParams();

  params.set("title", title);
  params.set("tags", "week");

  // Set deadline to end of week (Sunday)
  const deadline = getWeekEndDate(weekId);
  params.set("deadline", deadline);

  // Set "when" so it appears in This Week view
  params.set("when", "this week");

  if (options?.notes) {
    params.set("notes", options.notes);
  }

  return `things:///add?${params.toString()}`;
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "things3",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_weekly_todos",
        description:
          "Get Things 3 todos tagged with a specific week tag. Week tags follow the format wN-YYYY (e.g., w10-2026 for week 10 of 2026). Also accepts weekId in YYYY-WWW format.",
        inputSchema: {
          type: "object",
          properties: {
            weekId: {
              type: "string",
              description:
                "Week identifier in YYYY-WWW format (e.g., 2026-W10) or wN-YYYY format (e.g., w10-2026)",
            },
          },
          required: ["weekId"],
        },
      },
      {
        name: "search_todos",
        description: "Search Things 3 todos by text in title or notes",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search text to match against todo titles and notes",
            },
            includeCompleted: {
              type: "boolean",
              description: "Include completed todos in results (default: false)",
              default: false,
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 50)",
              default: 50,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_todos_by_tag",
        description: "Get Things 3 todos with a specific tag",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "Tag name to filter by",
            },
            includeCompleted: {
              type: "boolean",
              description: "Include completed todos in results (default: false)",
              default: false,
            },
          },
          required: ["tag"],
        },
      },
      {
        name: "get_todos_by_project",
        description: "Get Things 3 todos from a specific project",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              description: "Project name",
            },
            includeCompleted: {
              type: "boolean",
              description: "Include completed todos in results (default: false)",
              default: false,
            },
          },
          required: ["project"],
        },
      },
      {
        name: "get_todos_by_area",
        description: "Get Things 3 todos from a specific area",
        inputSchema: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description: "Area name",
            },
            includeCompleted: {
              type: "boolean",
              description: "Include completed todos in results (default: false)",
              default: false,
            },
          },
          required: ["area"],
        },
      },
      {
        name: "list_areas",
        description: "List all Things 3 areas",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "list_projects",
        description: "List all Things 3 projects",
        inputSchema: {
          type: "object",
          properties: {
            includeCompleted: {
              type: "boolean",
              description: "Include completed projects (default: false)",
              default: false,
            },
          },
          required: [],
        },
      },
      {
        name: "list_tags",
        description: "List all Things 3 tags",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_weekly_goal",
        description:
          "Generate a Things 3 URL to create a new weekly goal. Returns a URL that can be opened to create the todo in Things 3 with the 'week' tag and appropriate deadline.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Goal title",
            },
            weekId: {
              type: "string",
              description: "Week identifier in YYYY-WWW format (e.g., 2026-W10)",
            },
            notes: {
              type: "string",
              description: "Optional notes for the goal",
            },
            estimatedMinutes: {
              type: "number",
              description: "Optional estimated time in minutes",
            },
          },
          required: ["title", "weekId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Check if database is accessible
  const db = getDatabase();
  if (!db) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Things 3 database not found or inaccessible",
            expectedPath: THINGS3_DB_PATH,
            hint: "Make sure Things 3 is installed and has been run at least once",
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    switch (name) {
      case "get_weekly_todos": {
        const { weekId } = args as { weekId: string };

        // Convert weekId to Things 3 tag format if needed
        let weekTag = weekId;
        if (weekId.match(/^\d{4}-W\d{2}$/)) {
          weekTag = weekIdToThings3Tag(weekId);
        }

        const todos = getTodosByWeekTag(db, weekTag);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  weekId,
                  weekTag,
                  todos,
                  count: todos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_todos": {
        const { query, includeCompleted = false, limit = 50 } = args as {
          query: string;
          includeCompleted?: boolean;
          limit?: number;
        };

        const todos = searchTodos(db, query, { includeCompleted, limit });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  todos,
                  count: todos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_todos_by_tag": {
        const { tag, includeCompleted = false } = args as {
          tag: string;
          includeCompleted?: boolean;
        };

        const todos = getTodosByTag(db, tag, { includeCompleted });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tag,
                  todos,
                  count: todos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_todos_by_project": {
        const { project, includeCompleted = false } = args as {
          project: string;
          includeCompleted?: boolean;
        };

        const todos = getTodosByProject(db, project, { includeCompleted });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  project,
                  todos,
                  count: todos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_todos_by_area": {
        const { area, includeCompleted = false } = args as {
          area: string;
          includeCompleted?: boolean;
        };

        const todos = getTodosByArea(db, area, { includeCompleted });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  area,
                  todos,
                  count: todos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_areas": {
        const areas = listAreas(db);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  areas,
                  count: areas.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_projects": {
        const { includeCompleted = false } = args as { includeCompleted?: boolean };

        const projects = listProjects(db, { includeCompleted });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projects,
                  count: projects.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_tags": {
        const tags = listTags(db);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tags,
                  count: tags.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_weekly_goal": {
        const { title, weekId, notes, estimatedMinutes } = args as {
          title: string;
          weekId: string;
          notes?: string;
          estimatedMinutes?: number;
        };

        const url = generateCreateGoalUrl(title, weekId, { notes, estimatedMinutes });
        const deadline = getWeekEndDate(weekId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  title,
                  weekId,
                  deadline,
                  tag: "week",
                  url,
                  message: `Open this URL to create the goal in Things 3: ${url}`,
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
          text: JSON.stringify({
            error: error.message,
            tool: name,
          }),
        },
      ],
      isError: true,
    };
  } finally {
    db.close();
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Things 3 MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
