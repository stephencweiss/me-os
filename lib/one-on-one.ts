/**
 * One-on-One Management Library
 *
 * Provides functions for managing 1:1 notes:
 * - Person management (add, list, get)
 * - Entry storage (raw notes, summaries)
 * - History retrieval
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface Person {
  id: string;            // lowercase slug (e.g., "alice")
  name: string;          // Display name (e.g., "Alice Smith")
  lastOneOnOne?: string; // ISO date (YYYY-MM-DD)
  frequency?: "weekly" | "biweekly" | "monthly";
}

export type EntrySource = "voice" | "handwritten" | "markdown" | "text";

export interface OneOnOneEntry {
  date: string;          // ISO date (YYYY-MM-DD)
  rawPath: string;       // Path to raw file
  summaryPath?: string;  // Path to summary (if generated)
  source: EntrySource;
}

export interface OneOnOneIndex {
  people: Record<string, Person>;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.cwd(), "data", "one-on-ones");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

// ============================================================================
// Index Management
// ============================================================================

/**
 * Load the one-on-one index. Creates default if doesn't exist.
 */
export function loadIndex(): OneOnOneIndex {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      return { people: {} };
    }
    const content = fs.readFileSync(INDEX_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { people: {} };
  }
}

/**
 * Save the one-on-one index.
 */
export function saveIndex(index: OneOnOneIndex): void {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

// ============================================================================
// Person Management
// ============================================================================

/**
 * Convert a name to a URL-safe slug.
 * "Alice Smith" -> "alice-smith"
 * "Bob" -> "bob"
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get a person by name or slug (case-insensitive).
 * Returns null if not found.
 */
export function getPerson(nameOrSlug: string): Person | null {
  const index = loadIndex();
  const searchLower = nameOrSlug.toLowerCase().trim();
  const searchSlug = nameToSlug(nameOrSlug);

  // Try exact slug match first
  if (index.people[searchSlug]) {
    return index.people[searchSlug];
  }

  // Try to find by name (case-insensitive)
  for (const person of Object.values(index.people)) {
    if (person.name.toLowerCase() === searchLower) {
      return person;
    }
    if (person.id === searchSlug) {
      return person;
    }
  }

  return null;
}

/**
 * Add a new person to the index.
 * If person already exists (by slug), returns existing person.
 */
export function addPerson(name: string, frequency?: Person["frequency"]): Person {
  const index = loadIndex();
  const slug = nameToSlug(name);

  // Check if already exists
  if (index.people[slug]) {
    return index.people[slug];
  }

  const person: Person = {
    id: slug,
    name: name.trim(),
    frequency,
  };

  index.people[slug] = person;
  saveIndex(index);

  // Create person's directory
  const personDir = path.join(DATA_DIR, slug);
  if (!fs.existsSync(personDir)) {
    fs.mkdirSync(personDir, { recursive: true });
  }

  return person;
}

/**
 * List all people sorted by name.
 */
export function listPeople(): Person[] {
  const index = loadIndex();
  return Object.values(index.people).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Update a person's information.
 */
export function updatePerson(personId: string, updates: Partial<Omit<Person, "id">>): Person | null {
  const index = loadIndex();
  const person = index.people[personId];

  if (!person) {
    return null;
  }

  const updated: Person = {
    ...person,
    ...updates,
    id: personId, // Ensure ID doesn't change
  };

  index.people[personId] = updated;
  saveIndex(index);

  return updated;
}

// ============================================================================
// Entry Storage
// ============================================================================

/**
 * Get the path to a person's directory.
 */
export function getPersonDir(personId: string): string {
  return path.join(DATA_DIR, personId);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Format a date for display (e.g., "February 24, 2026").
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Save raw notes for a person.
 * If a raw file already exists for today, appends to it.
 * Returns the path to the raw file.
 */
export function saveRawNotes(
  personId: string,
  content: string,
  source: EntrySource,
  sourcePath?: string,
  date?: string
): string {
  const targetDate = date || getTodayDate();
  const personDir = getPersonDir(personId);
  const rawPath = path.join(personDir, `${targetDate}-raw.md`);

  // Ensure person directory exists
  if (!fs.existsSync(personDir)) {
    fs.mkdirSync(personDir, { recursive: true });
  }

  // Get person name for header
  const person = getPerson(personId);
  const personName = person?.name || personId;

  // Check if file exists (for appending)
  if (fs.existsSync(rawPath)) {
    // Append with separator
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const separator = `\n\n---\n\n**Added at ${timestamp}** (${source}${sourcePath ? `: ${path.basename(sourcePath)}` : ""})\n\n`;
    fs.appendFileSync(rawPath, separator + content);
  } else {
    // Create new file with header
    const header = `# 1:1 with ${personName} - ${formatDateForDisplay(targetDate)}\n\n`;
    const sourceInfo = `**Source:** ${source}${sourcePath ? ` (${path.basename(sourcePath)})` : ""}\n\n---\n\n`;
    fs.writeFileSync(rawPath, header + sourceInfo + content);
  }

  // Update person's lastOneOnOne
  updatePerson(personId, { lastOneOnOne: targetDate });

  return rawPath;
}

/**
 * Save a summary for a person.
 * Returns the path to the summary file.
 */
export function saveSummary(
  personId: string,
  content: string,
  date?: string
): string {
  const targetDate = date || getTodayDate();
  const personDir = getPersonDir(personId);
  const summaryPath = path.join(personDir, `${targetDate}-summary.md`);

  // Ensure person directory exists
  if (!fs.existsSync(personDir)) {
    fs.mkdirSync(personDir, { recursive: true });
  }

  fs.writeFileSync(summaryPath, content);

  return summaryPath;
}

/**
 * Load raw notes for a specific date.
 * Returns null if not found.
 */
export function loadRawNotes(personId: string, date?: string): string | null {
  const targetDate = date || getTodayDate();
  const rawPath = path.join(getPersonDir(personId), `${targetDate}-raw.md`);

  if (!fs.existsSync(rawPath)) {
    return null;
  }

  return fs.readFileSync(rawPath, "utf-8");
}

/**
 * Load summary for a specific date.
 * Returns null if not found.
 */
export function loadSummary(personId: string, date?: string): string | null {
  const targetDate = date || getTodayDate();
  const summaryPath = path.join(getPersonDir(personId), `${targetDate}-summary.md`);

  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  return fs.readFileSync(summaryPath, "utf-8");
}

// ============================================================================
// History Retrieval
// ============================================================================

/**
 * Get history of 1:1 entries for a person.
 * Returns entries sorted by date descending (most recent first).
 */
export function getHistory(personId: string, limit?: number): OneOnOneEntry[] {
  const personDir = getPersonDir(personId);

  if (!fs.existsSync(personDir)) {
    return [];
  }

  const files = fs.readdirSync(personDir);
  const entries: OneOnOneEntry[] = [];
  const processedDates = new Set<string>();

  // Find all raw files and match with summaries
  for (const file of files) {
    const rawMatch = file.match(/^(\d{4}-\d{2}-\d{2})-raw\.md$/);
    if (rawMatch) {
      const date = rawMatch[1];
      if (processedDates.has(date)) continue;
      processedDates.add(date);

      const rawPath = path.join(personDir, file);
      const summaryPath = path.join(personDir, `${date}-summary.md`);

      // Try to determine source from raw file content
      let source: EntrySource = "text";
      try {
        const content = fs.readFileSync(rawPath, "utf-8");
        if (content.includes("**Source:** voice")) source = "voice";
        else if (content.includes("**Source:** handwritten")) source = "handwritten";
        else if (content.includes("**Source:** markdown")) source = "markdown";
      } catch {
        // Default to text if can't read
      }

      entries.push({
        date,
        rawPath,
        summaryPath: fs.existsSync(summaryPath) ? summaryPath : undefined,
        source,
      });
    }
  }

  // Sort by date descending
  entries.sort((a, b) => b.date.localeCompare(a.date));

  // Apply limit if specified
  if (limit && limit > 0) {
    return entries.slice(0, limit);
  }

  return entries;
}

/**
 * Get the most recent 1:1 entry for a person.
 * Returns null if no entries exist.
 */
export function getLatestEntry(personId: string): OneOnOneEntry | null {
  const entries = getHistory(personId, 1);
  return entries.length > 0 ? entries[0] : null;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a single entry for display.
 */
export function formatEntryForDisplay(entry: OneOnOneEntry): string {
  const dateDisplay = formatDateForDisplay(entry.date);
  const hasSummary = entry.summaryPath ? "Summary" : "Raw notes only";
  return `**${dateDisplay}** (${entry.source}) - ${hasSummary}`;
}

/**
 * Format a list of entries for display.
 */
export function formatHistoryList(entries: OneOnOneEntry[]): string {
  if (entries.length === 0) {
    return "No 1:1 history found.";
  }

  const lines = entries.map((entry, i) => `${i + 1}. ${formatEntryForDisplay(entry)}`);
  return lines.join("\n");
}

/**
 * Format a person for display in a list.
 */
export function formatPersonForList(person: Person): string {
  const lastDate = person.lastOneOnOne
    ? formatDateForDisplay(person.lastOneOnOne)
    : "Never";
  const freq = person.frequency ? ` (${person.frequency})` : "";
  return `- **${person.name}**${freq} - Last 1:1: ${lastDate}`;
}

/**
 * Format the people list for display.
 */
export function formatPeopleList(people: Person[]): string {
  if (people.length === 0) {
    return "No direct reports configured yet.";
  }

  return people.map(formatPersonForList).join("\n");
}
