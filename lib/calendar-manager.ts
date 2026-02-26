/**
 * Calendar Manager Library
 *
 * Active calendar management: conflict detection, event categorization, and gap filling.
 */

import type { CalendarEvent } from "./time-analysis.js";
import * as fs from "fs";
import * as path from "path";

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

// ============================================================================
// Dependent Coverage Rules
// ============================================================================

export type CoverageActionMode = "notify" | "propose" | "auto-create";
export type CoverageLifecycleAction = "propose-delete";
export type CoverageOrphanPolicy = "propose-delete";

export interface RuleTrigger {
  sourceCalendars: string[];
  summaryPatterns: string[];
  allDaySummaryPatterns?: string[];
  timedSummaryPatterns?: string[];
}

export interface CoverageCreateTarget {
  account: string;
  calendar: string;
}

export interface CoverageRequirement {
  coverageSummaryPatterns: string[];
  coverageSearchCalendars: string[];
  createTarget: CoverageCreateTarget;
  coverageColorId?: string;
  windowStartOffsetMinutes: number;
  windowEndOffsetMinutes: number;
  minCoveragePercent: number;
}

export interface DependencyRule {
  id: string;
  enabled?: boolean;
  name: string;
  actionMode?: CoverageActionMode;
  orphanPolicy?: CoverageOrphanPolicy;
  trigger: RuleTrigger;
  requirement: CoverageRequirement;
}

export interface CoverageOptOutConfig {
  enabled: boolean;
  precedence: Array<"description" | "title">;
  globalTokens: string[];
  ruleScopedTokenTemplate: string;
}

export interface DependencyConfig {
  enabled: boolean;
  defaultActionMode: CoverageActionMode;
  optOut: CoverageOptOutConfig;
  rules: DependencyRule[];
}

export interface DependencyValidationInventory {
  accounts: string[];
  allCalendars: string[];
  calendarsByAccount: Record<string, string[]>;
}

export interface DependencyValidationIssue {
  ruleId: string;
  field:
    | "trigger.sourceCalendars"
    | "requirement.coverageSearchCalendars"
    | "requirement.createTarget.account"
    | "requirement.createTarget.calendar";
  value: string;
  message: string;
}

export interface CoverageGap {
  ruleId: string;
  ruleName: string;
  sourceEventId: string;
  sourceSummary: string;
  sourceCalendarName: string;
  sourceStart: Date;
  sourceEnd: Date;
  requiredStart: Date;
  requiredEnd: Date;
  requiredDurationMinutes: number;
  coveredDurationMinutes: number;
  actualCoveragePercent: number;
  requiredCoveragePercent: number;
  missingMinutes: number;
  actionMode: CoverageActionMode;
  createTarget: CoverageCreateTarget;
  coverageColorId?: string;
}

export interface CoverageOptOutRecord {
  ruleId: string;
  sourceEventId: string;
  sourceSummary: string;
  matchedIn: "description" | "title";
  token: string;
}

export interface CoverageFulfillment {
  ruleId: string;
  sourceEventId: string;
  coveredDurationMinutes: number;
  coveragePercent: number;
}

export interface CoverageEvaluationResult {
  gaps: CoverageGap[];
  optedOut: CoverageOptOutRecord[];
  fulfilled: CoverageFulfillment[];
}

export interface CoverageLifecycleLink {
  ruleId: string;
  sourceEventId: string;
  coverageEventId: string;
}

export interface CoverageLifecycleProposal {
  ruleId: string;
  coverageEventId: string;
  coverageSummary: string;
  action: CoverageLifecycleAction;
}

export interface CoverageReconciliationResult {
  orphanedCoverage: CoverageLifecycleProposal[];
}

export interface CoverageEventDraft {
  account: string;
  calendar: string;
  summary: string;
  start: Date;
  end: Date;
  colorId?: string;
}

const DEFAULT_DEPENDENCY_CONFIG: DependencyConfig = {
  enabled: false,
  defaultActionMode: "propose",
  optOut: {
    enabled: true,
    precedence: ["description", "title"],
    globalTokens: ["no coverage needed", "#no-coverage"],
    ruleScopedTokenTemplate: "no {ruleId} coverage needed",
  },
  rules: [],
};

export function loadDependencyConfig(configPath?: string): DependencyConfig {
  const resolvedPath = configPath || path.join(process.cwd(), "config", "dependencies.json");
  if (!fs.existsSync(resolvedPath)) {
    return { ...DEFAULT_DEPENDENCY_CONFIG };
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8")) as Partial<DependencyConfig>;
  const rules = (raw.rules || []).map((rule) => normalizeRule(rule));
  validateRuleRegexes(rules);

  return {
    enabled: raw.enabled ?? DEFAULT_DEPENDENCY_CONFIG.enabled,
    defaultActionMode: raw.defaultActionMode ?? DEFAULT_DEPENDENCY_CONFIG.defaultActionMode,
    optOut: {
      enabled: raw.optOut?.enabled ?? DEFAULT_DEPENDENCY_CONFIG.optOut.enabled,
      precedence: raw.optOut?.precedence ?? DEFAULT_DEPENDENCY_CONFIG.optOut.precedence,
      globalTokens: raw.optOut?.globalTokens ?? DEFAULT_DEPENDENCY_CONFIG.optOut.globalTokens,
      ruleScopedTokenTemplate:
        raw.optOut?.ruleScopedTokenTemplate ?? DEFAULT_DEPENDENCY_CONFIG.optOut.ruleScopedTokenTemplate,
    },
    rules,
  };
}

export function findCoverageGaps(
  events: CalendarEvent[],
  rules: DependencyRule[],
  config?: DependencyConfig
): CoverageEvaluationResult {
  const gaps: CoverageGap[] = [];
  const optedOut: CoverageOptOutRecord[] = [];
  const fulfilled: CoverageFulfillment[] = [];
  const effectiveConfig = config || DEFAULT_DEPENDENCY_CONFIG;

  for (const rule of rules) {
    if (rule.enabled === false) continue;

    const triggerRegexes = compileRegexes(rule.trigger.summaryPatterns, `${rule.id}.trigger.summaryPatterns`);
    const allDayTriggerRegexes = compileRegexes(
      rule.trigger.allDaySummaryPatterns || [],
      `${rule.id}.trigger.allDaySummaryPatterns`
    );
    const timedTriggerRegexes = compileRegexes(
      rule.trigger.timedSummaryPatterns || [],
      `${rule.id}.trigger.timedSummaryPatterns`
    );
    const coverageRegexes = compileRegexes(
      rule.requirement.coverageSummaryPatterns,
      `${rule.id}.requirement.coverageSummaryPatterns`
    );
    const sourceEvents = events.filter(
      (event) =>
        rule.trigger.sourceCalendars.includes(event.calendarName) &&
        eventMatchesTrigger(event, triggerRegexes, allDayTriggerRegexes, timedTriggerRegexes)
    );

    for (const sourceEvent of sourceEvents) {
      const optOut = detectOptOut(sourceEvent, rule, effectiveConfig.optOut);
      if (optOut) {
        optedOut.push({
          ruleId: rule.id,
          sourceEventId: sourceEvent.id,
          sourceSummary: sourceEvent.summary,
          matchedIn: optOut.matchedIn,
          token: optOut.token,
        });
        continue;
      }

      const requiredStart = new Date(
        sourceEvent.start.getTime() + rule.requirement.windowStartOffsetMinutes * 60000
      );
      const requiredEnd = new Date(
        sourceEvent.end.getTime() + rule.requirement.windowEndOffsetMinutes * 60000
      );
      const requiredDurationMinutes = Math.max(
        0,
        Math.round((requiredEnd.getTime() - requiredStart.getTime()) / 60000)
      );

      if (requiredDurationMinutes === 0) {
        fulfilled.push({
          ruleId: rule.id,
          sourceEventId: sourceEvent.id,
          coveredDurationMinutes: 0,
          coveragePercent: 100,
        });
        continue;
      }

      const coverageIntervals = events
        .filter(
          (event) =>
            !event.isAllDay &&
            rule.requirement.coverageSearchCalendars.includes(event.calendarName) &&
            coverageRegexes.some((pattern) => pattern.test(event.summary))
        )
        .map((event) => ({
          start: Math.max(requiredStart.getTime(), event.start.getTime()),
          end: Math.min(requiredEnd.getTime(), event.end.getTime()),
        }))
        .filter((interval) => interval.end > interval.start);

      const coveredDurationMinutes = sumMergedIntervalMinutes(coverageIntervals);
      const actualCoveragePercent = Math.min(
        100,
        (coveredDurationMinutes / requiredDurationMinutes) * 100
      );
      const requiredCoveragePercent = rule.requirement.minCoveragePercent;

      if (actualCoveragePercent + 1e-9 < requiredCoveragePercent) {
        gaps.push({
          ruleId: rule.id,
          ruleName: rule.name,
          sourceEventId: sourceEvent.id,
          sourceSummary: sourceEvent.summary,
          sourceCalendarName: sourceEvent.calendarName,
          sourceStart: sourceEvent.start,
          sourceEnd: sourceEvent.end,
          requiredStart,
          requiredEnd,
          requiredDurationMinutes,
          coveredDurationMinutes,
          actualCoveragePercent,
          requiredCoveragePercent,
          missingMinutes: Math.max(0, requiredDurationMinutes - coveredDurationMinutes),
          actionMode: rule.actionMode ?? effectiveConfig.defaultActionMode,
          createTarget: rule.requirement.createTarget,
          coverageColorId: rule.requirement.coverageColorId,
        });
      } else {
        fulfilled.push({
          ruleId: rule.id,
          sourceEventId: sourceEvent.id,
          coveredDurationMinutes,
          coveragePercent: actualCoveragePercent,
        });
      }
    }
  }

  return { gaps, optedOut, fulfilled };
}

export function validateDependencyConfigAgainstInventory(
  config: DependencyConfig,
  inventory: DependencyValidationInventory
): DependencyValidationIssue[] {
  const issues: DependencyValidationIssue[] = [];
  const allCalendars = new Set(inventory.allCalendars);
  const accounts = new Set(inventory.accounts);
  const calendarsByAccount = new Map<string, Set<string>>();
  for (const [account, calendars] of Object.entries(inventory.calendarsByAccount)) {
    calendarsByAccount.set(account, new Set(calendars));
  }

  for (const rule of config.rules) {
    for (const calendar of rule.trigger.sourceCalendars) {
      if (!allCalendars.has(calendar)) {
        issues.push({
          ruleId: rule.id,
          field: "trigger.sourceCalendars",
          value: calendar,
          message: `Rule "${rule.id}" references unknown source calendar "${calendar}".`,
        });
      }
    }

    for (const calendar of rule.requirement.coverageSearchCalendars) {
      if (!allCalendars.has(calendar)) {
        issues.push({
          ruleId: rule.id,
          field: "requirement.coverageSearchCalendars",
          value: calendar,
          message: `Rule "${rule.id}" references unknown coverage search calendar "${calendar}".`,
        });
      }
    }

    const targetAccount = rule.requirement.createTarget.account;
    const targetCalendar = rule.requirement.createTarget.calendar;
    if (!accounts.has(targetAccount)) {
      issues.push({
        ruleId: rule.id,
        field: "requirement.createTarget.account",
        value: targetAccount,
        message: `Rule "${rule.id}" targets unknown account "${targetAccount}".`,
      });
      continue;
    }

    const accountCalendars = calendarsByAccount.get(targetAccount) || new Set<string>();
    if (!accountCalendars.has(targetCalendar)) {
      issues.push({
        ruleId: rule.id,
        field: "requirement.createTarget.calendar",
        value: targetCalendar,
        message: `Rule "${rule.id}" targets unknown calendar "${targetCalendar}" for account "${targetAccount}".`,
      });
    }
  }

  return issues;
}

export function buildCoverageEventDraft(gap: CoverageGap): CoverageEventDraft {
  return {
    account: gap.createTarget.account,
    calendar: gap.createTarget.calendar,
    summary: `${gap.ruleName}: ${gap.sourceSummary}`,
    start: gap.requiredStart,
    end: gap.requiredEnd,
    colorId: gap.coverageColorId,
  };
}

export function reconcileCoverageLifecycle(
  events: CalendarEvent[],
  rules: DependencyRule[],
  historicalLinks: CoverageLifecycleLink[] = []
): CoverageReconciliationResult {
  const orphanedCoverage: CoverageLifecycleProposal[] = [];
  const eventById = new Map(events.map((event) => [event.id, event]));
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

  for (const link of historicalLinks) {
    const sourceExists = eventById.has(link.sourceEventId);
    const coverageEvent = eventById.get(link.coverageEventId);
    const rule = ruleById.get(link.ruleId);

    if (!sourceExists && coverageEvent && rule && (rule.orphanPolicy ?? "propose-delete") === "propose-delete") {
      orphanedCoverage.push({
        ruleId: link.ruleId,
        coverageEventId: link.coverageEventId,
        coverageSummary: coverageEvent.summary,
        action: "propose-delete",
      });
    }
  }

  return { orphanedCoverage };
}

function normalizeRule(rule: Partial<DependencyRule>): DependencyRule {
  if (!rule.id || !rule.name || !rule.trigger || !rule.requirement) {
    throw new Error("Invalid dependency rule: missing required fields");
  }

  return {
    id: rule.id,
    enabled: rule.enabled ?? true,
    name: rule.name,
    actionMode: rule.actionMode ?? "propose",
    orphanPolicy: rule.orphanPolicy ?? "propose-delete",
    trigger: {
      sourceCalendars: rule.trigger.sourceCalendars || [],
      summaryPatterns: rule.trigger.summaryPatterns || [],
      allDaySummaryPatterns: rule.trigger.allDaySummaryPatterns || [],
      timedSummaryPatterns: rule.trigger.timedSummaryPatterns || [],
    },
    requirement: {
      coverageSummaryPatterns: rule.requirement.coverageSummaryPatterns || [],
      coverageSearchCalendars: rule.requirement.coverageSearchCalendars || [],
      createTarget: rule.requirement.createTarget || { account: "personal", calendar: "Primary" },
      coverageColorId: rule.requirement.coverageColorId,
      windowStartOffsetMinutes: rule.requirement.windowStartOffsetMinutes ?? 0,
      windowEndOffsetMinutes: rule.requirement.windowEndOffsetMinutes ?? 0,
      minCoveragePercent: rule.requirement.minCoveragePercent ?? 100,
    },
  };
}

function validateRuleRegexes(rules: DependencyRule[]): void {
  for (const rule of rules) {
    compileRegexes(rule.trigger.summaryPatterns, `${rule.id}.trigger.summaryPatterns`);
    compileRegexes(rule.trigger.allDaySummaryPatterns || [], `${rule.id}.trigger.allDaySummaryPatterns`);
    compileRegexes(rule.trigger.timedSummaryPatterns || [], `${rule.id}.trigger.timedSummaryPatterns`);
    compileRegexes(
      rule.requirement.coverageSummaryPatterns,
      `${rule.id}.requirement.coverageSummaryPatterns`
    );
  }
}

function compileRegexes(patterns: string[], context: string): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch (error) {
      throw new Error(`Invalid regex in ${context}: "${pattern}"`);
    }
  });
}

function detectOptOut(
  event: CalendarEvent,
  rule: DependencyRule,
  config: CoverageOptOutConfig
): { matchedIn: "description" | "title"; token: string } | null {
  if (!config.enabled) return null;

  const scopedToken = config.ruleScopedTokenTemplate.replace("{ruleId}", rule.id);
  const tokens = [...config.globalTokens, scopedToken];
  const title = (event.summary || "").toLowerCase();
  const description = (event.description || "").toLowerCase();

  for (const source of config.precedence) {
    const haystack = source === "description" ? description : title;
    for (const token of tokens) {
      if (haystack.includes(token.toLowerCase())) {
        return { matchedIn: source, token };
      }
    }
  }

  return null;
}

function eventMatchesTrigger(
  event: CalendarEvent,
  summaryPatterns: RegExp[],
  allDaySummaryPatterns: RegExp[],
  timedSummaryPatterns: RegExp[]
): boolean {
  const summary = event.summary || "";
  if (event.isAllDay) {
    if (allDaySummaryPatterns.length > 0) {
      return allDaySummaryPatterns.some((pattern) => pattern.test(summary));
    }
    return summaryPatterns.some((pattern) => pattern.test(summary));
  }

  if (timedSummaryPatterns.length > 0) {
    return timedSummaryPatterns.some((pattern) => pattern.test(summary));
  }

  return summaryPatterns.some((pattern) => pattern.test(summary));
}

function sumMergedIntervalMinutes(intervals: Array<{ start: number; end: number }>): number {
  if (intervals.length === 0) return 0;

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged.reduce((sum, interval) => sum + (interval.end - interval.start) / 60000, 0);
}
