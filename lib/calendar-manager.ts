/**
 * Calendar Manager Library
 *
 * Active calendar management: conflict detection, event categorization, and gap filling.
 */

import type { CalendarEvent } from "./time-analysis.js";

// ============================================================================
// Types
// ============================================================================

export interface OverlapGroup {
  id: string;
  timeSlot: { start: Date; end: Date };
  events: CalendarEvent[];
  suggestedAttendance: string[];
}

// ============================================================================
// Union-Find data structure for grouping connected components
// ============================================================================

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: string): string {
    if (this.parent.get(id) !== id) {
      // Path compression
      this.parent.set(id, this.find(this.parent.get(id)!));
    }
    return this.parent.get(id)!;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return;

    // Union by rank
    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(id);
    }
    return groups;
  }
}

// ============================================================================
// Overlap Detection
// ============================================================================

/**
 * Check if two events overlap (excluding back-to-back: end == start is not overlap)
 */
function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Build groups of overlapping events using sweep-line + union-find
 *
 * Returns only groups with more than 1 event (actual conflicts).
 */
export function buildOverlapGroups(events: CalendarEvent[]): OverlapGroup[] {
  // Filter out all-day events
  const timedEvents = events.filter((e) => !e.isAllDay);

  if (timedEvents.length === 0) {
    return [];
  }

  // Sort by start time
  const sorted = [...timedEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  // Initialize union-find
  const uf = new UnionFind();
  for (const event of sorted) {
    uf.makeSet(event.id);
  }

  // Create id -> event map for later lookup
  const eventMap = new Map<string, CalendarEvent>();
  for (const event of sorted) {
    eventMap.set(event.id, event);
  }

  // Find all overlapping pairs using sweep-line
  // For each event, check against all events that started before it ends
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      // Since sorted by start, if j.start >= i.end, no more overlaps with i
      if (sorted[j].start >= sorted[i].end) {
        break;
      }
      // Check if they actually overlap
      if (eventsOverlap(sorted[i], sorted[j])) {
        uf.union(sorted[i].id, sorted[j].id);
      }
    }
  }

  // Build groups from union-find
  const groupsMap = uf.getGroups();
  const overlapGroups: OverlapGroup[] = [];

  let groupIndex = 0;
  for (const [, memberIds] of groupsMap) {
    // Only include groups with more than 1 event (actual conflicts)
    if (memberIds.length > 1) {
      const groupEvents = memberIds.map((id) => eventMap.get(id)!);

      // Calculate time span of the group
      const starts = groupEvents.map((e) => e.start.getTime());
      const ends = groupEvents.map((e) => e.end.getTime());
      const minStart = new Date(Math.min(...starts));
      const maxEnd = new Date(Math.max(...ends));

      overlapGroups.push({
        id: `overlap-${groupIndex++}`,
        timeSlot: { start: minStart, end: maxEnd },
        events: groupEvents,
        suggestedAttendance: [], // Will be populated by suggestion logic later
      });
    }
  }

  // Sort groups by start time
  overlapGroups.sort(
    (a, b) => a.timeSlot.start.getTime() - b.timeSlot.start.getTime()
  );

  return overlapGroups;
}

/**
 * Calculate overlap minutes between two events
 */
export function calculateOverlapMinutes(
  a: CalendarEvent,
  b: CalendarEvent
): number {
  const overlapStart = Math.max(a.start.getTime(), b.start.getTime());
  const overlapEnd = Math.min(a.end.getTime(), b.end.getTime());

  if (overlapStart >= overlapEnd) {
    return 0;
  }

  return (overlapEnd - overlapStart) / 60000;
}

/**
 * Calculate how to split time when attending overlapping events.
 * Returns a map of event ID -> allocated minutes.
 */
export function calculateSplitTime(
  attending: CalendarEvent[]
): Map<string, number> {
  const result = new Map<string, number>();

  if (attending.length === 0) return result;
  if (attending.length === 1) {
    result.set(attending[0].id, attending[0].durationMinutes);
    return result;
  }

  // For each event, calculate its effective time (duration minus overlaps shared with others)
  for (const event of attending) {
    let effectiveMinutes = event.durationMinutes;

    // Subtract half of each overlap with other attending events
    for (const other of attending) {
      if (event.id !== other.id) {
        const overlapMinutes = calculateOverlapMinutes(event, other);
        // Split overlap evenly between the two events
        effectiveMinutes -= overlapMinutes / 2;
      }
    }

    result.set(event.id, Math.max(0, effectiveMinutes));
  }

  return result;
}

// ============================================================================
// Categorization
// ============================================================================

export interface CategorySuggestion {
  colorId: string;
  colorName: string;
  meaning: string;
  confidence: number;
}

/**
 * Category patterns for event title matching.
 * Each category has keywords that trigger it, with the color ID and name.
 */
const CATEGORY_PATTERNS: Array<{
  colorId: string;
  colorName: string;
  meaning: string;
  patterns: RegExp[];
}> = [
  {
    colorId: "1",
    colorName: "Lavender",
    meaning: "1:1s / People",
    patterns: [
      /1:1/i,
      /one[\s-]?on[\s-]?one/i,
      /sync\s+with/i,
      /catch[\s-]?up\s+with/i,
      /skip[\s-]?level/i,
    ],
  },
  {
    colorId: "2",
    colorName: "Sage",
    meaning: "Deep Work / Focus / Learning",
    patterns: [
      /focus/i,
      /deep\s*work/i,
      /heads?\s*down/i,
      /no\s*meetings?/i,
      /learn/i,
      /training/i,
      /workshop/i,
      /course/i,
      /study/i,
    ],
  },
  {
    colorId: "3",
    colorName: "Grape",
    meaning: "Project Work",
    patterns: [
      /project/i,
      /sprint/i,
      /spec/i,
      /design/i,
      /roadmap/i,
      /kickoff/i,
      /review/i,
    ],
  },
  {
    colorId: "4",
    colorName: "Flamingo",
    meaning: "Meetings",
    patterns: [
      /standup/i,
      /stand[\s-]?up/i,
      /sync(?!\s+with)/i,
      /retro/i,
      /retrospective/i,
      /planning/i,
      /grooming/i,
      /refinement/i,
      /all[\s-]?hands/i,
      /team\s+meeting/i,
      /committee/i,
      /council/i,
      /forum/i,
    ],
  },
  {
    colorId: "5",
    colorName: "Banana",
    meaning: "Household / Pets",
    patterns: [
      /chores?/i,
      /cleaning/i,
      /cooking/i,
      /errands?/i,
      /grocery/i,
      /dog/i,
      /walk(?!\s+(to|from))/i,
      /vet/i,
      /pet/i,
    ],
  },
  {
    colorId: "6",
    colorName: "Tangerine",
    meaning: "Family Time",
    patterns: [
      /family/i,
      /henry/i,
      /son/i,
      /park/i,
      /school/i,
      /kid/i,
      /child/i,
    ],
  },
  {
    colorId: "7",
    colorName: "Peacock",
    meaning: "Personal Projects",
    patterns: [
      /writing/i,
      /podcast/i,
      /creative/i,
      /blog/i,
      /side\s*project/i,
      /personal\s*project/i,
      /working\s*zaddy/i,
    ],
  },
  {
    colorId: "8",
    colorName: "Graphite",
    meaning: "Travel / Commute",
    patterns: [
      /commute/i,
      /travel/i,
      /airport/i,
      /flight/i,
      /fly/i,
      /drive/i,
      /walk\s+(to|from)/i,
      /train/i,
    ],
  },
  {
    colorId: "9",
    colorName: "Blueberry",
    meaning: "Fitness",
    patterns: [
      /gym/i,
      /run\b/i,
      /running/i,
      /workout/i,
      /exercise/i,
      /yoga/i,
      /bike/i,
      /cycling/i,
      /row/i,
      /rowing/i,
      /swim/i,
      /fitness/i,
    ],
  },
  {
    colorId: "10",
    colorName: "Basil",
    meaning: "Social",
    patterns: [
      /friends/i,
      /dinner/i,
      /drinks/i,
      /party/i,
      /coffee/i,
      /lunch\s+with/i,
      /happy\s*hour/i,
      /social/i,
    ],
  },
  {
    colorId: "11",
    colorName: "Tomato",
    meaning: "Urgent / Blocked",
    patterns: [
      /urgent/i,
      /deadline/i,
      /asap/i,
      /critical/i,
      /emergency/i,
      /blocked/i,
      /waiting/i,
    ],
  },
];

/**
 * Suggest a category (color) for an event based on its title.
 * Returns the suggested color and a confidence score (0-1).
 */
export function suggestCategory(event: CalendarEvent): CategorySuggestion {
  const title = event.summary || "";

  for (const category of CATEGORY_PATTERNS) {
    for (const pattern of category.patterns) {
      if (pattern.test(title)) {
        return {
          colorId: category.colorId,
          colorName: category.colorName,
          meaning: category.meaning,
          confidence: 0.8, // High confidence for pattern match
        };
      }
    }
  }

  // No match found - return default with low confidence
  return {
    colorId: "4", // Default to Flamingo (Meetings) as fallback
    colorName: "Flamingo",
    meaning: "Meetings",
    confidence: 0.2, // Low confidence
  };
}

/**
 * Extract the parent (recurring series) ID from an instance ID.
 *
 * Recurring event instances have IDs like: "baseId_20260222T130000Z"
 * where the suffix is a date/time pattern.
 *
 * Returns null if not a recurring instance.
 */
export function extractRecurringParentId(eventId: string): string | null {
  // Pattern: ends with _YYYYMMDDTHHMMSSZ
  const recurringPattern = /_(\d{8}T\d{6}Z)$/;
  const match = eventId.match(recurringPattern);

  if (match) {
    // Return everything before the last underscore + date pattern
    return eventId.slice(0, -match[0].length);
  }

  return null;
}

/**
 * Find events that have no color assigned (unlabeled).
 * These are events with colorId of "", "default", or undefined.
 */
export function findUnlabeledEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(
    (event) => !event.colorId || event.colorId === "" || event.colorId === "default"
  );
}

// ============================================================================
// Flex Slot Calculation
// ============================================================================

export interface FlexSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface FlexSlotConfig {
  wakingHours: { start: number; end: number };
  minGapMinutes: number;
  skipWeekends: boolean;
}

/**
 * Check if a date is a weekend (Saturday = 6, Sunday = 0)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Merge overlapping intervals for gap calculation.
 * Takes sorted events and returns merged intervals.
 */
function mergeIntervals(
  events: CalendarEvent[]
): Array<{ start: Date; end: Date }> {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const merged: Array<{ start: Date; end: Date }> = [];
  let current = { start: sorted[0].start, end: sorted[0].end };

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    if (event.start <= current.end) {
      // Overlapping or adjacent - extend current interval
      current.end = new Date(
        Math.max(current.end.getTime(), event.end.getTime())
      );
    } else {
      // Non-overlapping - save current and start new
      merged.push(current);
      current = { start: event.start, end: event.end };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculate flex slots (available time blocks) for given events.
 *
 * Finds gaps in the schedule during waking hours, filtering by minimum
 * gap duration and optionally skipping weekends.
 */
export function calculateFlexSlots(
  events: CalendarEvent[],
  config: FlexSlotConfig
): FlexSlot[] {
  const { wakingHours, minGapMinutes, skipWeekends } = config;
  const flexSlots: FlexSlot[] = [];

  // Filter out all-day events
  const timedEvents = events.filter((e) => !e.isAllDay);

  if (timedEvents.length === 0) {
    return [];
  }

  // Group events by local date (using local year/month/day)
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of timedEvents) {
    const d = event.start;
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // Process each date
  for (const [dateKey, dayEvents] of eventsByDate) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    // Skip weekends if configured
    if (skipWeekends && isWeekend(date)) {
      continue;
    }

    // Create waking hours boundaries for this date
    const wakingStart = new Date(date);
    wakingStart.setHours(wakingHours.start, 0, 0, 0);
    const wakingEnd = new Date(date);
    wakingEnd.setHours(wakingHours.end, 0, 0, 0);

    // Filter events to only those within waking hours
    const wakingEvents = dayEvents.filter(
      (e) => e.end > wakingStart && e.start < wakingEnd
    );

    // Merge overlapping intervals
    const merged = mergeIntervals(wakingEvents);

    // Clip merged intervals to waking hours
    const clipped = merged.map((interval) => ({
      start: new Date(
        Math.max(interval.start.getTime(), wakingStart.getTime())
      ),
      end: new Date(Math.min(interval.end.getTime(), wakingEnd.getTime())),
    }));

    // Find gaps
    let currentTime = wakingStart;

    for (const interval of clipped) {
      if (interval.start > currentTime) {
        const gapDuration =
          (interval.start.getTime() - currentTime.getTime()) / 60000;
        if (gapDuration >= minGapMinutes) {
          flexSlots.push({
            start: new Date(currentTime),
            end: new Date(interval.start),
            durationMinutes: gapDuration,
          });
        }
      }
      currentTime = new Date(
        Math.max(currentTime.getTime(), interval.end.getTime())
      );
    }

    // Check for gap after last event
    if (currentTime < wakingEnd) {
      const gapDuration =
        (wakingEnd.getTime() - currentTime.getTime()) / 60000;
      if (gapDuration >= minGapMinutes) {
        flexSlots.push({
          start: new Date(currentTime),
          end: new Date(wakingEnd),
          durationMinutes: gapDuration,
        });
      }
    }
  }

  // Sort by start time
  flexSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

  return flexSlots;
}
