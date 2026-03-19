/**
 * Anthropic SDK wrapper for server-side LLM integration
 *
 * Provides AI-powered features for calendar analysis, goal suggestions,
 * and event categorization.
 */

import Anthropic from "@anthropic-ai/sdk";

// Lazy initialization to avoid errors when API key not configured
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Model to use for AI features
 * Using Haiku for cost-effectiveness on routine tasks
 */
const MODEL = "claude-sonnet-4-20250514";

/**
 * Event data for AI analysis
 */
export interface EventForAnalysis {
  id: string;
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  colorId: string;
  colorName: string;
  colorMeaning: string;
  account: string;
  calendarName: string;
}

/**
 * Goal data for AI analysis
 */
export interface GoalForAnalysis {
  id: string;
  title: string;
  goalType: "time" | "outcome" | "habit";
  estimatedMinutes: number | null;
  progressPercent: number;
  status: string;
  colorId: string | null;
}

/**
 * Weekly analysis result
 */
export interface WeeklyAnalysis {
  summary: string;
  timeBreakdown: {
    category: string;
    minutes: number;
    percentage: number;
    insight: string;
  }[];
  highlights: string[];
  suggestions: string[];
  goalProgress: {
    goalTitle: string;
    assessment: string;
  }[];
}

/**
 * Goal suggestion
 */
export interface GoalSuggestion {
  title: string;
  goalType: "time" | "outcome" | "habit";
  estimatedMinutes: number | null;
  rationale: string;
  suggestedColorId: string | null;
}

/**
 * Event categorization suggestion
 */
export interface EventCategorization {
  eventId: string;
  eventSummary: string;
  suggestedColorId: string;
  suggestedColorName: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

/**
 * Color definitions for categorization context
 */
const COLOR_CONTEXT = `
Available calendar colors and their meanings:
- 1 (Lavender): 1:1s / People - one-on-one meetings, mentoring
- 2 (Sage): Studying / Learning - courses, reading, skill development
- 3 (Grape): Project Work - focused work on specific projects
- 4 (Flamingo): Meetings - group meetings, standups, all-hands
- 5 (Banana): Household / Pets - errands, pet care, home maintenance
- 6 (Tangerine): Family Time - family activities, kids, relatives
- 7 (Peacock): Personal Projects - hobbies, side projects
- 8 (Graphite): Routines / Logistics - commute, planning, admin
- 9 (Blueberry): Fitness - exercise, gym, sports
- 10 (Basil): Social - friends, social events, networking
- 11 (Tomato): Urgent / Blocked - blockers, urgent issues
`;

/**
 * Analyze a week's calendar data and goals
 */
export async function analyzeWeek(
  events: EventForAnalysis[],
  goals: GoalForAnalysis[],
  weekId: string
): Promise<WeeklyAnalysis> {
  const client = getClient();

  const prompt = `You are a productivity assistant analyzing a user's calendar week.

Week: ${weekId}

${COLOR_CONTEXT}

Events this week:
${JSON.stringify(events, null, 2)}

Goals for this week:
${JSON.stringify(goals, null, 2)}

Analyze this week and provide insights in the following JSON format:
{
  "summary": "2-3 sentence overview of how the week was spent",
  "timeBreakdown": [
    {
      "category": "category name",
      "minutes": total minutes,
      "percentage": percentage of total scheduled time,
      "insight": "brief insight about this category"
    }
  ],
  "highlights": ["3-5 notable observations about the week"],
  "suggestions": ["2-3 actionable suggestions for improvement"],
  "goalProgress": [
    {
      "goalTitle": "goal title",
      "assessment": "brief assessment of progress and recommendation"
    }
  ]
}

Return ONLY valid JSON, no other text.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  try {
    return JSON.parse(content.text) as WeeklyAnalysis;
  } catch {
    throw new Error(`Failed to parse AI response: ${content.text}`);
  }
}

/**
 * Suggest goals based on calendar patterns and existing goals
 */
export async function suggestGoals(
  recentEvents: EventForAnalysis[],
  existingGoals: GoalForAnalysis[],
  weekId: string
): Promise<GoalSuggestion[]> {
  const client = getClient();

  const prompt = `You are a productivity assistant helping set weekly goals.

${COLOR_CONTEXT}

Week to plan: ${weekId}

Recent calendar events (for context on user's activities):
${JSON.stringify(recentEvents, null, 2)}

Existing goals for this week:
${JSON.stringify(existingGoals, null, 2)}

Based on the user's calendar patterns and existing goals, suggest 2-4 additional goals.
Consider:
- Time blocks that appear regularly but don't have associated goals
- Balance between different life areas (work, personal, health, learning)
- Goals that complement rather than duplicate existing ones

Return suggestions in this JSON format:
[
  {
    "title": "concise goal title",
    "goalType": "time" | "outcome" | "habit",
    "estimatedMinutes": estimated minutes needed (or null for outcome goals),
    "rationale": "why this goal makes sense based on their patterns",
    "suggestedColorId": "color ID 1-11 that matches the goal type, or null"
  }
]

Return ONLY valid JSON array, no other text.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  try {
    return JSON.parse(content.text) as GoalSuggestion[];
  } catch {
    throw new Error(`Failed to parse AI response: ${content.text}`);
  }
}

/**
 * Suggest categories for uncategorized events
 */
export async function categorizeEvents(
  events: EventForAnalysis[]
): Promise<EventCategorization[]> {
  const client = getClient();

  // Filter to only uncategorized events (default or empty color)
  const uncategorized = events.filter(
    (e) => !e.colorId || e.colorId === "default" || e.colorId === ""
  );

  if (uncategorized.length === 0) {
    return [];
  }

  const prompt = `You are a productivity assistant helping categorize calendar events.

${COLOR_CONTEXT}

Uncategorized events to classify:
${JSON.stringify(uncategorized, null, 2)}

For each event, suggest the most appropriate color category based on its title and context.

Return suggestions in this JSON format:
[
  {
    "eventId": "event ID",
    "eventSummary": "event title",
    "suggestedColorId": "color ID 1-11",
    "suggestedColorName": "color name",
    "confidence": "high" | "medium" | "low",
    "rationale": "brief explanation of categorization"
  }
]

Return ONLY valid JSON array, no other text.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  try {
    return JSON.parse(content.text) as EventCategorization[];
  } catch {
    throw new Error(`Failed to parse AI response: ${content.text}`);
  }
}
