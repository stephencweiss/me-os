/**
 * Calendar Filter Library
 *
 * Provides a calendar type system that determines how different calendars
 * affect time tracking, gap analysis, and scheduling.
 *
 * Calendar Types:
 * - active: Events count toward time tracking, fill gaps, block scheduling
 * - availability: Shows context only (e.g., on-call), doesn't count as time spent
 * - reference: FYI only, hidden from reports or shown separately
 * - blocking: Blocks time but no details needed (e.g., personal holds)
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export type CalendarType = "active" | "availability" | "reference" | "blocking";

export interface CalendarFilterConfig {
  calendarTypes: Record<string, CalendarType>; // name/id → type
  defaultType: {
    primary: CalendarType;
    owner: CalendarType;
    shared: CalendarType;
  };
  filtering: {
    denyList: string[];
    allowList: string[];
  };
}

export interface CalendarTypeBehavior {
  countsForTimeTracking: boolean;
  fillsGaps: boolean;
  blocksScheduling: boolean;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  primary?: boolean | null;
  accessRole: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_DIR = path.join(process.cwd(), "config");
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, "calendars.json");

const TYPE_BEHAVIORS: Record<CalendarType, CalendarTypeBehavior> = {
  active: {
    countsForTimeTracking: true,
    fillsGaps: true,
    blocksScheduling: true,
  },
  availability: {
    countsForTimeTracking: false,
    fillsGaps: false,
    blocksScheduling: false, // context only
  },
  reference: {
    countsForTimeTracking: false,
    fillsGaps: false,
    blocksScheduling: false,
  },
  blocking: {
    countsForTimeTracking: false,
    fillsGaps: true,
    blocksScheduling: true,
  },
};

// ============================================================================
// Default Config
// ============================================================================

export function getDefaultCalendarFilterConfig(): CalendarFilterConfig {
  return {
    calendarTypes: {},
    defaultType: {
      primary: "active",
      owner: "active",
      shared: "active",
    },
    filtering: {
      denyList: [],
      allowList: [],
    },
  };
}

// ============================================================================
// Config Loading
// ============================================================================

export function loadCalendarFilterConfig(
  configPath: string = DEFAULT_CONFIG_PATH
): CalendarFilterConfig {
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultCalendarFilterConfig();
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);

    // Merge with defaults
    const config: CalendarFilterConfig = {
      calendarTypes: parsed.calendarTypes || {},
      defaultType: {
        primary: parsed.defaultType?.primary || "active",
        owner: parsed.defaultType?.owner || "active",
        shared: parsed.defaultType?.shared || "active",
      },
      filtering: {
        denyList: parsed.filtering?.denyList || [],
        allowList: parsed.filtering?.allowList || [],
      },
    };

    return config;
  } catch {
    return getDefaultCalendarFilterConfig();
  }
}

export function saveCalendarFilterConfig(
  config: CalendarFilterConfig,
  configPath: string = DEFAULT_CONFIG_PATH
): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ============================================================================
// Calendar Type Resolution
// ============================================================================

/**
 * Check if a string matches a calendar (by name or ID).
 * Case-insensitive for names.
 */
function matchesCalendar(pattern: string, calendar: CalendarInfo): boolean {
  // Exact ID match
  if (pattern === calendar.id) {
    return true;
  }
  // Case-insensitive name match
  if (pattern.toLowerCase() === calendar.summary.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Determine the calendar type for a given calendar.
 *
 * Priority:
 * 1. Check denyList → return 'excluded'
 * 2. Check explicit calendarTypes config → return that type
 * 3. Check allowList → return 'active' (or could use default)
 * 4. Use defaultType based on primary/owner/shared status
 */
export function getCalendarType(
  calendar: CalendarInfo,
  config: CalendarFilterConfig
): CalendarType | "excluded" {
  // 1. Check deny list
  for (const pattern of config.filtering.denyList) {
    if (matchesCalendar(pattern, calendar)) {
      return "excluded";
    }
  }

  // 2. Check explicit calendarTypes
  for (const [pattern, type] of Object.entries(config.calendarTypes)) {
    if (matchesCalendar(pattern, calendar)) {
      return type;
    }
  }

  // 3. Check allow list (treat as active if explicitly allowed)
  for (const pattern of config.filtering.allowList) {
    if (matchesCalendar(pattern, calendar)) {
      return "active";
    }
  }

  // 4. Use default based on ownership
  if (calendar.primary) {
    return config.defaultType.primary;
  }
  if (calendar.accessRole === "owner") {
    return config.defaultType.owner;
  }
  // writer, reader, freeBusyReader are all "shared"
  return config.defaultType.shared;
}

// ============================================================================
// Type Behavior
// ============================================================================

/**
 * Get the behavior flags for a calendar type.
 */
export function getCalendarTypeBehavior(type: CalendarType): CalendarTypeBehavior {
  return TYPE_BEHAVIORS[type];
}

// ============================================================================
// Event Filtering
// ============================================================================

export interface EventWithAttendees {
  attendees?: Array<{
    email?: string | null;
    self?: boolean | null;
    responseStatus?: string | null;
  }>;
  organizer?: {
    email?: string | null;
    self?: boolean | null;
  } | null;
}

/**
 * Determine if an event should be included based on calendar type and attendee status.
 *
 * For shared calendars without explicit type config, we use attendee checking:
 * - Include if user is an attendee (self=true or email matches)
 * - Include if user is the organizer
 * - Exclude otherwise (event on shared calendar but user not involved)
 */
export function shouldIncludeEvent(
  event: EventWithAttendees,
  userEmail: string,
  calendarType: CalendarType,
  isSharedCalendarWithoutExplicitType: boolean = false
): boolean {
  // For explicitly typed calendars, include all events of that type
  if (!isSharedCalendarWithoutExplicitType) {
    return true;
  }

  // For shared calendars without explicit type, check if user is involved
  return isUserInvolvedInEvent(event, userEmail);
}

/**
 * Check if the user is involved in an event (as attendee or organizer).
 */
export function isUserInvolvedInEvent(
  event: EventWithAttendees,
  userEmail: string
): boolean {
  const emailLower = userEmail.toLowerCase();

  // Check if user is organizer
  if (event.organizer?.self === true) {
    return true;
  }
  if (event.organizer?.email?.toLowerCase() === emailLower) {
    return true;
  }

  // Check if user is attendee
  if (event.attendees) {
    for (const attendee of event.attendees) {
      if (attendee.self === true) {
        return true;
      }
      if (attendee.email?.toLowerCase() === emailLower) {
        return true;
      }
    }
  }

  // Events without attendees list on shared calendars - exclude by default
  // (If it were important, user would be listed as attendee)
  return false;
}

// ============================================================================
// Smart Suggestions
// ============================================================================

/**
 * Suggest a calendar type based on the calendar name.
 * Used by the setup skill to provide recommendations.
 */
export function suggestCalendarType(calendarName: string): CalendarType | null {
  const nameLower = calendarName.toLowerCase();

  // On-call patterns
  if (
    nameLower.includes("on call") ||
    nameLower.includes("oncall") ||
    nameLower.includes("on-call")
  ) {
    return "availability";
  }

  // Vacation/time-off patterns
  if (
    nameLower.includes("vacation") ||
    nameLower.includes("time off") ||
    nameLower.includes("pto") ||
    nameLower.includes("out of office")
  ) {
    return "reference";
  }

  // Company/team calendars (usually reference)
  if (
    nameLower.includes("company calendar") ||
    nameLower.includes("social events") ||
    nameLower.includes("team calendar") && !nameLower.includes("my team")
  ) {
    return "reference";
  }

  // No suggestion
  return null;
}
