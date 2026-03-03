/**
 * Goal Matcher Library
 *
 * Heuristics for matching calendar events to weekly goals.
 * Supports auto-detection and manual confirmation workflows.
 */

import type { StoredWeeklyGoal, StoredEvent } from "./calendar-db.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of matching an event to a goal
 */
export interface MatchResult {
  goalId: string;
  eventId: string;
  confidence: number; // 0-1
  matchReasons: string[];
}

/**
 * Confidence thresholds for matching decisions
 */
export const MATCH_THRESHOLDS = {
  AUTO_MATCH: 0.5, // Above this: auto-match without prompting
  PROMPT_USER: 0.3, // Between this and AUTO_MATCH: ask user
  NO_MATCH: 0.3, // Below this: don't suggest
} as const;

/**
 * Match weights for different heuristics
 */
export const MATCH_WEIGHTS = {
  COLOR: 0.4, // Color match is strong signal
  TITLE_KEYWORDS: 0.35, // Title keyword overlap
  NOTES_MATCH: 0.25, // Goal notes match event description
} as const;

// ============================================================================
// Keyword Extraction
// ============================================================================

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "them",
  "their",
]);

/**
 * Extract meaningful keywords from text
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Calculate keyword overlap ratio
 */
export function keywordOverlapRatio(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = keywords1.filter((k) => set2.has(k));

  // Use the smaller set as denominator for better signal
  const minSize = Math.min(set1.size, set2.size);
  return intersection.length / minSize;
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Calculate match confidence between an event and a goal
 */
export function calculateMatch(
  event: StoredEvent,
  goal: StoredWeeklyGoal
): MatchResult {
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

    const matchingKeywords = goalKeywords.filter((k) =>
      eventKeywords.includes(k)
    );
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
    eventId: event.id,
    confidence: Math.min(confidence, 1), // Cap at 1
    matchReasons: reasons,
  };
}

/**
 * Match multiple events against multiple goals
 * Returns best matches, ensuring each event only matches one goal
 */
export function matchEventsToGoals(
  events: StoredEvent[],
  goals: StoredWeeklyGoal[]
): MatchResult[] {
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

  return results;
}

/**
 * Get auto-matches (high confidence, no user input needed)
 */
export function getAutoMatches(matches: MatchResult[]): MatchResult[] {
  return matches.filter((m) => m.confidence >= MATCH_THRESHOLDS.AUTO_MATCH);
}

/**
 * Get matches that need user confirmation
 */
export function getMatchesNeedingConfirmation(matches: MatchResult[]): MatchResult[] {
  return matches.filter(
    (m) =>
      m.confidence >= MATCH_THRESHOLDS.PROMPT_USER &&
      m.confidence < MATCH_THRESHOLDS.AUTO_MATCH
  );
}

/**
 * Get unmatched events (below threshold)
 */
export function getUnmatchedEvents(
  events: StoredEvent[],
  matches: MatchResult[]
): StoredEvent[] {
  const matchedEventIds = new Set(matches.map((m) => m.eventId));
  return events.filter((e) => !matchedEventIds.has(e.id));
}

// ============================================================================
// Match Prompt Generation
// ============================================================================

/**
 * Generate a prompt for ambiguous matches
 */
export function generateMatchPrompt(
  event: StoredEvent,
  candidateGoals: StoredWeeklyGoal[]
): string {
  const eventTime = new Date(event.start_time).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  let prompt = `The event "${event.summary}" (${eventTime}, ${event.duration_minutes}min) could relate to:\n`;

  candidateGoals.forEach((goal, index) => {
    prompt += `  ${index + 1}. ${goal.title}\n`;
  });

  prompt += `  ${candidateGoals.length + 1}. None of the above\n\n`;
  prompt += `Which goal does this event contribute to? (Enter number)`;

  return prompt;
}

/**
 * Format match results for display
 */
export function formatMatchResultsForDisplay(
  matches: MatchResult[],
  events: StoredEvent[],
  goals: StoredWeeklyGoal[]
): string {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const lines: string[] = ["## Matched Events\n"];

  const autoMatches = getAutoMatches(matches);
  const needsConfirmation = getMatchesNeedingConfirmation(matches);

  if (autoMatches.length > 0) {
    lines.push("### Auto-matched (high confidence)\n");
    for (const match of autoMatches) {
      const event = eventMap.get(match.eventId);
      const goal = goalMap.get(match.goalId);
      if (event && goal) {
        lines.push(
          `- **${event.summary}** → ${goal.title} (${Math.round(match.confidence * 100)}%)`
        );
        lines.push(`  - ${match.matchReasons.join(", ")}`);
      }
    }
    lines.push("");
  }

  if (needsConfirmation.length > 0) {
    lines.push("### Needs confirmation\n");
    for (const match of needsConfirmation) {
      const event = eventMap.get(match.eventId);
      const goal = goalMap.get(match.goalId);
      if (event && goal) {
        lines.push(
          `- **${event.summary}** → ${goal.title}? (${Math.round(match.confidence * 100)}%)`
        );
        lines.push(`  - ${match.matchReasons.join(", ")}`);
      }
    }
    lines.push("");
  }

  const unmatchedEvents = getUnmatchedEvents(events, matches);
  if (unmatchedEvents.length > 0) {
    lines.push("### Unmatched events\n");
    for (const event of unmatchedEvents) {
      lines.push(`- ${event.summary} (${event.duration_minutes}min)`);
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a batch of events and return categorized matches
 */
export interface BatchMatchResult {
  autoMatches: MatchResult[];
  needsConfirmation: MatchResult[];
  unmatchedEvents: StoredEvent[];
  totalEventsProcessed: number;
  totalGoalsChecked: number;
}

export function processBatchMatches(
  events: StoredEvent[],
  goals: StoredWeeklyGoal[]
): BatchMatchResult {
  const matches = matchEventsToGoals(events, goals);

  return {
    autoMatches: getAutoMatches(matches),
    needsConfirmation: getMatchesNeedingConfirmation(matches),
    unmatchedEvents: getUnmatchedEvents(events, matches),
    totalEventsProcessed: events.length,
    totalGoalsChecked: goals.length,
  };
}
