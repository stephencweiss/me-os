import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import { getEventById } from "@/lib/db-unified";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

// Minimal event type needed for category suggestion
interface EventForSuggestion {
  id: string;
  summary: string;
  color_id: string;
}

/**
 * Category patterns for event title matching.
 * Copied from lib/calendar-manager.ts for webapp use.
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
      /daughter/i,
      /kid/i,
      /parent/i,
      /mom/i,
      /dad/i,
    ],
  },
  {
    colorId: "7",
    colorName: "Peacock",
    meaning: "Personal Projects",
    patterns: [
      /personal/i,
      /hobby/i,
      /side\s*project/i,
      /creative/i,
      /writing/i,
      /blog/i,
    ],
  },
  {
    colorId: "8",
    colorName: "Graphite",
    meaning: "Routines / Logistics",
    patterns: [
      /routine/i,
      /commute/i,
      /travel/i,
      /flight/i,
      /airport/i,
      /logistics/i,
      /admin/i,
      /email/i,
      /inbox/i,
    ],
  },
  {
    colorId: "9",
    colorName: "Blueberry",
    meaning: "Fitness",
    patterns: [
      /gym/i,
      /workout/i,
      /exercise/i,
      /run(?:ning)?/i,
      /yoga/i,
      /pilates/i,
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

interface CategorySuggestion {
  eventId: string;
  colorId: string;
  colorName: string;
  colorMeaning: string;
  confidence: number;
}

/**
 * Suggest a category (color) for an event based on its title.
 */
function suggestCategory(event: EventForSuggestion): CategorySuggestion {
  const title = event.summary || "";

  for (const category of CATEGORY_PATTERNS) {
    for (const pattern of category.patterns) {
      if (pattern.test(title)) {
        return {
          eventId: event.id,
          colorId: category.colorId,
          colorName: category.colorName,
          colorMeaning: category.meaning,
          confidence: 0.8, // High confidence for pattern match
        };
      }
    }
  }

  // No match found - return default with low confidence
  return {
    eventId: event.id,
    colorId: "4", // Default to Flamingo (Meetings) as fallback
    colorName: "Flamingo",
    colorMeaning: "Meetings",
    confidence: 0.2, // Low confidence
  };
}

/**
 * POST /api/events/suggest
 *
 * Get category suggestions for multiple events based on their titles.
 *
 * Body:
 *   - eventIds: string[] - Array of event IDs to get suggestions for
 *
 * Response:
 *   - suggestions: Array<{ eventId, colorId, colorName, colorMeaning, confidence }>
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthUnlessLocal();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  try {
    const body = await request.json();
    const { eventIds } = body;

    if (!eventIds || !Array.isArray(eventIds)) {
      return NextResponse.json(
        { error: "eventIds array is required" },
        { status: 400 }
      );
    }

    if (eventIds.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Limit batch size to prevent abuse
    if (eventIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 events per request" },
        { status: 400 }
      );
    }

    // Fetch events and generate suggestions
    const suggestions: CategorySuggestion[] = [];

    for (const eventId of eventIds) {
      const event = await getEventById(userId, eventId);
      if (event) {
        const suggestion = suggestCategory(event);
        suggestions.push(suggestion);
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
  });
}
