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
