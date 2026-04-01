import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import {
  getGoalsForWeek,
  getEvents,
  getWeekDateRange,
  recordGoalProgress,
  recalculateGoalProgress,
} from "@/lib/db-unified";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

// Minimal types for matching - compatible with both Turso and Supabase
interface MatchableEvent {
  id: string;
  summary: string;
  duration_minutes: number;
  color_id: string;
  color_name: string;
  description?: string | null;
}

interface MatchableGoal {
  id: string;
  title: string;
  color_id: string | null;
  estimated_minutes: number | null;
  goal_type: string;
  notes?: string | null;
  status: string;
}

// ============================================================================
// Matching Constants
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

interface BatchMatchResult {
  autoMatches: MatchResult[];
  needsConfirmation: MatchResult[];
  unmatchedEvents: Array<{ id: string; summary: string; durationMinutes: number }>;
  totalEventsProcessed: number;
  totalGoalsChecked: number;
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

function calculateMatch(event: MatchableEvent, goal: MatchableGoal): MatchResult {
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

function processBatchMatches(events: MatchableEvent[], goals: MatchableGoal[]): BatchMatchResult {
  const allMatches: MatchResult[] = [];

  // Calculate all potential matches
  for (const event of events) {
    for (const goal of goals) {
      // Skip completed/cancelled goals
      if (goal.status !== "active") continue;

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

  const matchedEventIds = new Set(results.map((m) => m.eventId));
  const unmatchedEvents = events
    .filter((e) => !matchedEventIds.has(e.id))
    .map((e) => ({
      id: e.id,
      summary: e.summary,
      durationMinutes: e.duration_minutes,
    }));

  return {
    autoMatches,
    needsConfirmation,
    unmatchedEvents,
    totalEventsProcessed: events.length,
    totalGoalsChecked: goals.length,
  };
}

/**
 * POST /api/goals/match
 *
 * Auto-match calendar events to goals for a given week.
 * Returns matches categorized by confidence level.
 *
 * Body:
 *   - weekId: string - Week to match (e.g., "2026-W10")
 *   - autoRecord?: boolean - If true, automatically record high-confidence matches (default: false)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthUnlessLocal();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  try {
    const body = await request.json();
    const { weekId, autoRecord = false } = body;

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

    // Get date range for the week
    const { startDate, endDate } = getWeekDateRange(weekId);

    // Fetch goals and events
    const goals = await getGoalsForWeek(userId, weekId);
    const events = await getEvents(userId, startDate, endDate);

    // Process matches
    const matchResult = processBatchMatches(events, goals);

    // If autoRecord is true, record the auto-matched progress
    const recordedMatches: string[] = [];
    if (autoRecord && matchResult.autoMatches.length > 0) {
      const affectedGoalIds = new Set<string>();

      for (const match of matchResult.autoMatches) {
        await recordGoalProgress(userId, {
          goalId: match.goalId,
          eventId: match.eventId,
          matchType: "auto",
          matchConfidence: match.confidence,
          minutesContributed: match.minutesContributed,
        });
        affectedGoalIds.add(match.goalId);
        recordedMatches.push(`${match.eventSummary} -> ${match.goalTitle}`);
      }

      // Recalculate progress for affected goals
      for (const goalId of affectedGoalIds) {
        await recalculateGoalProgress(userId, goalId);
      }
    }

    return NextResponse.json({
      success: true,
      weekId,
      dateRange: { start: startDate, end: endDate },
      ...matchResult,
      recorded: autoRecord ? recordedMatches : [],
    });
  } catch (error) {
    console.error("Error matching goals:", error);
    return NextResponse.json(
      { error: "Failed to match goals" },
      { status: 500 }
    );
  }
  });
}
