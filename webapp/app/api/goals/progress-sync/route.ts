import { NextRequest, NextResponse } from "next/server";
import {
  getGoalsForWeek,
  getEvents,
  getWeekDateRange,
  recordGoalProgress,
  recalculateGoalProgress,
  getProgressRecordsForGoal,
  getGoalById,
  type DbWeeklyGoal,
  type DbEvent,
  type DbGoalProgress,
} from "@/lib/db";

// ============================================================================
// Matching Constants (duplicated from match/route.ts for independence)
// ============================================================================

const MATCH_THRESHOLDS = {
  AUTO_MATCH: 0.5, // Above this: auto-match without prompting
  PROMPT_USER: 0.3, // Between this and AUTO_MATCH: ask user
  NO_MATCH: 0.3, // Below this: don't suggest
} as const;

const MATCH_WEIGHTS = {
  COLOR: 0.4, // Color match is strong signal
  TITLE_KEYWORDS: 0.35, // Title keyword overlap
  NOTES_MATCH: 0.25, // Goal notes match event description
} as const;

// ============================================================================
// Types
// ============================================================================

interface MatchResult {
  goalId: string;
  goalTitle: string;
  eventId: string;
  eventSummary: string;
  confidence: number;
  matchReasons: string[];
  minutesContributed: number;
}

interface SyncResult {
  weekId: string;
  goalsProcessed: number;
  eventsProcessed: number;
  autoMatched: number;
  needsReview: number;
  alreadyMatched: number;
  progressRecords: Array<{
    goalId: string;
    goalTitle: string;
    eventId: string;
    eventSummary: string;
    minutes: number;
    confidence: number;
  }>;
  affectedGoals: Array<{
    goalId: string;
    title: string;
    previousProgress: number;
    newProgress: number;
  }>;
}

// ============================================================================
// Keyword Extraction
// ============================================================================

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "this", "that", "these",
  "those", "i", "me", "my", "we", "our", "you", "your", "he", "she",
  "it", "they", "them", "their",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function keywordOverlapRatio(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = keywords1.filter((k) => set2.has(k));

  const minSize = Math.min(set1.size, set2.size);
  return intersection.length / minSize;
}

// ============================================================================
// Matching Logic
// ============================================================================

function calculateMatch(event: DbEvent, goal: DbWeeklyGoal): MatchResult {
  const reasons: string[] = [];
  let confidence = 0;

  // 1. Color match (strong signal)
  if (goal.color_id && event.color_id === goal.color_id) {
    confidence += MATCH_WEIGHTS.COLOR;
    reasons.push(`Color matches goal category (${event.color_name})`);
  }

  // 2. Title keyword match
  const goalKeywords = extractKeywords(goal.title);
  const eventKeywords = extractKeywords(event.summary);
  const titleOverlap = keywordOverlapRatio(goalKeywords, eventKeywords);

  if (titleOverlap > 0) {
    const titleScore = titleOverlap * MATCH_WEIGHTS.TITLE_KEYWORDS;
    confidence += titleScore;

    const matchingKeywords = goalKeywords.filter((k) => eventKeywords.includes(k));
    if (matchingKeywords.length > 0) {
      reasons.push(`Title contains: ${matchingKeywords.join(", ")}`);
    }
  }

  // 3. Notes/description match
  if (goal.notes && event.description) {
    const notesKeywords = extractKeywords(goal.notes);
    const descKeywords = extractKeywords(event.description);
    const notesOverlap = keywordOverlapRatio(notesKeywords, descKeywords);

    if (notesOverlap > 0) {
      const notesScore = notesOverlap * MATCH_WEIGHTS.NOTES_MATCH;
      confidence += notesScore;
      reasons.push("Description matches goal notes");
    }
  }

  return {
    goalId: goal.id,
    goalTitle: goal.title,
    eventId: event.id,
    eventSummary: event.summary,
    confidence: Math.min(confidence, 1),
    matchReasons: reasons,
    minutesContributed: event.duration_minutes,
  };
}

// ============================================================================
// Progress Sync Logic
// ============================================================================

/**
 * Get all event IDs that already have progress recorded for any goal
 */
async function getMatchedEventIds(goals: DbWeeklyGoal[]): Promise<Set<string>> {
  const matchedEventIds = new Set<string>();

  for (const goal of goals) {
    const progressRecords = await getProgressRecordsForGoal(goal.id);
    for (const record of progressRecords) {
      matchedEventIds.add(record.event_id);
    }
  }

  return matchedEventIds;
}

/**
 * Run the full sync process for a week
 */
async function syncProgressForWeek(
  weekId: string,
  options: { dryRun?: boolean; forceRematch?: boolean } = {}
): Promise<SyncResult> {
  const { dryRun = false, forceRematch = false } = options;

  // Get date range for the week
  const { startDate, endDate } = getWeekDateRange(weekId);

  // 1. Load goals for the week (only active ones)
  const allGoals = await getGoalsForWeek(weekId);
  const activeGoals = allGoals.filter((g) => g.status === "active");

  if (activeGoals.length === 0) {
    return {
      weekId,
      goalsProcessed: 0,
      eventsProcessed: 0,
      autoMatched: 0,
      needsReview: 0,
      alreadyMatched: 0,
      progressRecords: [],
      affectedGoals: [],
    };
  }

  // 2. Load events for the week
  const allEvents = await getEvents(startDate, endDate);

  // Filter out all-day events (they don't contribute meaningful time)
  const timedEvents = allEvents.filter((e) => !e.is_all_day);

  // 3. Get already matched events (unless forceRematch)
  const matchedEventIds = forceRematch
    ? new Set<string>()
    : await getMatchedEventIds(activeGoals);

  const unmatchedEvents = timedEvents.filter((e) => !matchedEventIds.has(e.id));
  const alreadyMatched = timedEvents.length - unmatchedEvents.length;

  if (unmatchedEvents.length === 0) {
    return {
      weekId,
      goalsProcessed: activeGoals.length,
      eventsProcessed: timedEvents.length,
      autoMatched: 0,
      needsReview: 0,
      alreadyMatched,
      progressRecords: [],
      affectedGoals: [],
    };
  }

  // 4. Calculate all potential matches
  const allMatches: MatchResult[] = [];
  for (const event of unmatchedEvents) {
    for (const goal of activeGoals) {
      const match = calculateMatch(event, goal);
      if (match.confidence >= MATCH_THRESHOLDS.NO_MATCH) {
        allMatches.push(match);
      }
    }
  }

  // Sort by confidence descending
  allMatches.sort((a, b) => b.confidence - a.confidence);

  // Deduplicate: each event only matches its best goal
  const usedEvents = new Set<string>();
  const results: MatchResult[] = [];
  for (const match of allMatches) {
    if (!usedEvents.has(match.eventId)) {
      results.push(match);
      usedEvents.add(match.eventId);
    }
  }

  const autoMatches = results.filter((m) => m.confidence >= MATCH_THRESHOLDS.AUTO_MATCH);
  const needsConfirmation = results.filter(
    (m) => m.confidence >= MATCH_THRESHOLDS.PROMPT_USER && m.confidence < MATCH_THRESHOLDS.AUTO_MATCH
  );

  // 5. Track affected goals and record progress
  const affectedGoalIds = new Set<string>();
  const progressRecords: SyncResult["progressRecords"] = [];

  for (const match of autoMatches) {
    affectedGoalIds.add(match.goalId);

    if (!dryRun) {
      await recordGoalProgress({
        goalId: match.goalId,
        eventId: match.eventId,
        matchType: "auto",
        matchConfidence: match.confidence,
        minutesContributed: match.minutesContributed,
      });
    }

    progressRecords.push({
      goalId: match.goalId,
      goalTitle: match.goalTitle,
      eventId: match.eventId,
      eventSummary: match.eventSummary,
      minutes: match.minutesContributed,
      confidence: match.confidence,
    });
  }

  // 6. Recalculate progress for affected goals
  const affectedGoals: SyncResult["affectedGoals"] = [];

  for (const goalId of affectedGoalIds) {
    const goal = await getGoalById(goalId);
    if (!goal) continue;

    const previousProgress = goal.progress_percent;

    if (!dryRun) {
      const newProgress = await recalculateGoalProgress(goalId);
      affectedGoals.push({
        goalId,
        title: goal.title,
        previousProgress,
        newProgress,
      });
    } else {
      // For dry run, calculate what the progress would be without saving
      const currentProgress = goal.progress_percent;
      const addedMinutes = progressRecords
        .filter((p) => p.goalId === goalId)
        .reduce((sum, p) => sum + p.minutes, 0);

      let newProgress = currentProgress;
      if (goal.estimated_minutes && goal.estimated_minutes > 0) {
        // Estimate new progress based on added minutes
        // This is approximate since we'd need current total minutes
        const currentMinutes = (currentProgress / 100) * goal.estimated_minutes;
        newProgress = Math.min(
          100,
          Math.round(((currentMinutes + addedMinutes) / goal.estimated_minutes) * 100)
        );
      } else if (addedMinutes > 0) {
        newProgress = 100;
      }

      affectedGoals.push({
        goalId,
        title: goal.title,
        previousProgress,
        newProgress,
      });
    }
  }

  return {
    weekId,
    goalsProcessed: activeGoals.length,
    eventsProcessed: timedEvents.length,
    autoMatched: autoMatches.length,
    needsReview: needsConfirmation.length,
    alreadyMatched,
    progressRecords,
    affectedGoals,
  };
}

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * POST /api/goals/progress-sync
 *
 * Sync calendar events to goal progress for a given week.
 * Automatically matches events to goals and records progress.
 *
 * Body:
 *   - weekId: string - Week to sync (e.g., "2026-W10")
 *   - dryRun?: boolean - If true, don't record progress, just return what would be matched
 *   - forceRematch?: boolean - If true, re-match even events that already have progress
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekId, dryRun = false, forceRematch = false } = body;

    // Validate weekId
    if (!weekId) {
      return NextResponse.json(
        { error: "weekId is required" },
        { status: 400 }
      );
    }

    const weekPattern = /^\d{4}-W\d{2}$/;
    if (!weekPattern.test(weekId)) {
      return NextResponse.json(
        { error: "Invalid weekId format. Expected YYYY-WWW (e.g., 2026-W10)" },
        { status: 400 }
      );
    }

    // Run the sync process
    const result = await syncProgressForWeek(weekId, { dryRun, forceRematch });

    // Get date range for response
    const { startDate, endDate } = getWeekDateRange(weekId);

    return NextResponse.json({
      success: true,
      dryRun,
      dateRange: { start: startDate, end: endDate },
      ...result,
    });
  } catch (error) {
    console.error("Error syncing progress:", error);
    return NextResponse.json(
      { error: "Failed to sync progress" },
      { status: 500 }
    );
  }
}
