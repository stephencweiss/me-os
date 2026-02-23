/**
 * Calendar Optimizer Library
 *
 * Goal-based calendar optimization to help achieve weekly objectives.
 * Parses goals from natural language, loads/saves recurring goals,
 * and provides slot allocation and optimization algorithms.
 */

import * as fs from "fs";

// ============================================
// Types
// ============================================

export interface TimePreference {
  dayPart?: "morning" | "afternoon" | "evening";
  preferredDays?: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface TimeGoal {
  type: "time";
  id: string;
  name: string;
  totalMinutes: number;
  minSessionMinutes?: number;
  maxSessionMinutes?: number;
  sessionsPerWeek?: number;
  preferredTimes?: TimePreference;
  colorId: string;
  priority: number;
  recurring: boolean;
}

export interface OutcomeGoal {
  type: "outcome";
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  deadline?: Date;
  colorId: string;
  priority: number;
}

export type Goal = TimeGoal | OutcomeGoal;

export interface OptimizationConfig {
  recurringGoals: TimeGoal[];
  constraints?: {
    noMeetingsBefore?: number;
    maxMeetingsPerDay?: number;
    preferContiguousFocus?: boolean;
    minFocusBlockMinutes?: number;
  };
  movableEventPatterns?: string[];
}

// ============================================
// Goal Parsing
// ============================================

/**
 * Parse natural language text into structured goals.
 *
 * Examples:
 * - "4 hours of writing time" → TimeGoal with totalMinutes=240
 * - "workout 3x this week, 45 min each" → TimeGoal with sessionsPerWeek=3
 * - "Focus on Project X to achieve milestone Y" → OutcomeGoal
 */
export function parseGoalsFromText(text: string): Goal[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const goals: Goal[] = [];

  // Split on newlines first to get individual goal lines
  // Each line starting with - or • is a separate goal
  // Also split on newlines that aren't continuation of previous line
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const goal = parseSingleGoal(line);
    if (goal) {
      goals.push(goal);
    }
  }

  return goals;
}

function parseSingleGoal(text: string): Goal | null {
  // Remove bullet points and clean up
  const cleanedOriginal = text.replace(/^[-•*]\s*/, "").trim();
  const cleaned = cleanedOriginal.toLowerCase();

  // Check for outcome goals first (more specific pattern)
  // Use the original text for case-preserved matching
  const outcomeMatch = cleanedOriginal.match(
    /(?:focus on|work on|complete)\s+(.+?)\s+(?:to\s+)?(?:achieve|finish|complete)\s+(.+?)(?:,\s*(?:about\s+)?(\d+)\s*(?:hours?|h))?$/i
  );
  if (outcomeMatch) {
    const [, projectName, milestone, hours] = outcomeMatch;
    return {
      type: "outcome",
      id: generateId(projectName),
      name: projectName.trim(),
      description: milestone.trim(),
      estimatedMinutes: hours ? parseInt(hours) * 60 : 0,
      colorId: "2", // Default to Sage (Deep Work)
      priority: 1,
    };
  }

  // Try to parse time-based goals
  const timeGoal = parseTimeGoal(cleaned, text);
  if (timeGoal) {
    return timeGoal;
  }

  return null;
}

function parseTimeGoal(cleaned: string, original: string): TimeGoal | null {
  // Pattern for hours: "4 hours", "4h", "4 hrs"
  const hoursMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);

  // Pattern for minutes: "45 min", "45m", "45 minutes"
  const minutesMatch = cleaned.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);

  // Pattern for sessions: "3x", "3 times"
  const sessionsMatch = cleaned.match(/(\d+)\s*(?:x|times?)\s*(?:this\s+)?(?:week)?/);

  // Pattern for session duration constraints: "1-2 hour sessions", "1 to 2 hours each"
  const sessionConstraintMatch = cleaned.match(
    /(\d+)(?:\s*-\s*|\s+to\s+)(\d+)\s*(?:hours?|hrs?|h)\s*(?:sessions?|each|blocks?)?/
  );

  // Pattern for single session duration: "45 min each", "1 hour sessions", "45m each"
  const singleSessionMatch = cleaned.match(
    /(\d+)\s*(?:hours?|hrs?|h|minutes?|mins?|m)\s*(?:each|sessions?|blocks?)/
  );

  // Pattern for time preference: "in the morning/afternoon/evening"
  const timePreferenceMatch = cleaned.match(
    /(?:in\s+the\s+)?(morning|afternoon|evening)/
  );

  let totalMinutes = 0;
  let minSessionMinutes: number | undefined;
  let maxSessionMinutes: number | undefined;
  let sessionsPerWeek: number | undefined;
  let preferredTimes: TimePreference | undefined;

  // Calculate total minutes
  if (hoursMatch) {
    totalMinutes = parseFloat(hoursMatch[1]) * 60;
  } else if (minutesMatch) {
    totalMinutes = parseInt(minutesMatch[1]);
  }

  // Parse session constraints
  if (sessionConstraintMatch) {
    minSessionMinutes = parseInt(sessionConstraintMatch[1]) * 60;
    maxSessionMinutes = parseInt(sessionConstraintMatch[2]) * 60;
  } else if (singleSessionMatch) {
    const value = parseInt(singleSessionMatch[1]);
    // Check if the unit is hours (not minutes)
    const isHours = /\d+\s*(?:hours?|hrs?|h)\s*(?:each|sessions?|blocks?)/.test(singleSessionMatch[0]);
    const sessionDuration = isHours ? value * 60 : value;
    minSessionMinutes = sessionDuration;
    maxSessionMinutes = sessionDuration;
  }

  // Parse sessions per week
  if (sessionsMatch) {
    sessionsPerWeek = parseInt(sessionsMatch[1]);
    // If we have sessions and per-session duration, calculate total
    if (minSessionMinutes) {
      totalMinutes = sessionsPerWeek * minSessionMinutes;
    } else if (totalMinutes > 0) {
      // If we have sessions and a time that looks like per-session duration
      // (no explicit "each" or "sessions"), use it as session duration
      minSessionMinutes = totalMinutes;
      maxSessionMinutes = totalMinutes;
      totalMinutes = sessionsPerWeek * minSessionMinutes;
    }
  }

  // Parse time preference
  if (timePreferenceMatch) {
    preferredTimes = {
      dayPart: timePreferenceMatch[1] as "morning" | "afternoon" | "evening",
    };
  }

  // Must have some time component to be a valid time goal
  if (totalMinutes === 0) {
    return null;
  }

  // Extract the activity name
  const name = extractActivityName(original);
  if (!name) {
    return null;
  }

  return {
    type: "time",
    id: generateId(name),
    name,
    totalMinutes,
    minSessionMinutes,
    maxSessionMinutes,
    sessionsPerWeek,
    preferredTimes,
    colorId: "2", // Default to Sage (Deep Work)
    priority: 1,
    recurring: false,
  };
}

function extractActivityName(text: string): string {
  // Remove time-related words to get the activity name
  let name = text
    .replace(/^[-•*]\s*/, "") // Remove bullets
    .replace(/\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/gi, "")
    .replace(/\d+\s*(?:x|times?)\s*(?:this\s+)?week/gi, "")
    .replace(/\d+\s*-\s*\d+\s*(?:hours?|hrs?|h)\s*(?:sessions?|each|blocks?)/gi, "")
    .replace(/(?:in\s+the\s+)?(morning|afternoon|evening)/gi, "")
    .replace(/\b(?:of|the|this|week|each|sessions?|blocks?)\b/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
}

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================
// Goal Config Management
// ============================================

/**
 * Load recurring goals from a JSON config file.
 */
export function loadRecurringGoals(configPath: string): TimeGoal[] {
  try {
    if (!fs.existsSync(configPath)) {
      return [];
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const config: OptimizationConfig = JSON.parse(content);

    if (!config.recurringGoals || !Array.isArray(config.recurringGoals)) {
      return [];
    }

    return config.recurringGoals.map((g) => ({
      ...g,
      type: "time" as const,
      recurring: true,
    }));
  } catch {
    return [];
  }
}

/**
 * Save or update a recurring goal in the config file.
 * If a goal with the same ID exists, it will be updated.
 */
export function saveRecurringGoal(goal: TimeGoal, configPath: string): void {
  let config: OptimizationConfig = { recurringGoals: [] };

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
      if (!config.recurringGoals) {
        config.recurringGoals = [];
      }
    }
  } catch {
    config = { recurringGoals: [] };
  }

  // Remove type field for storage (it's implied by being in recurringGoals)
  const { type, ...goalWithoutType } = goal;

  // Check if goal with same ID exists
  const existingIndex = config.recurringGoals.findIndex((g) => g.id === goal.id);

  if (existingIndex >= 0) {
    // Update existing
    config.recurringGoals[existingIndex] = goalWithoutType as TimeGoal;
  } else {
    // Add new
    config.recurringGoals.push(goalWithoutType as TimeGoal);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Remove a recurring goal from the config file by ID.
 */
export function removeRecurringGoal(goalId: string, configPath: string): void {
  try {
    if (!fs.existsSync(configPath)) {
      return;
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const config: OptimizationConfig = JSON.parse(content);

    if (!config.recurringGoals) {
      return;
    }

    config.recurringGoals = config.recurringGoals.filter((g) => g.id !== goalId);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch {
    // Silently fail if file doesn't exist or is invalid
  }
}
