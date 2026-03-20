/**
 * Title-based category suggestions (aligned with lib/calendar-manager.ts suggestCategory).
 */

export interface CategorySuggestion {
  colorId: string;
  colorName: string;
  meaning: string;
  confidence: number;
}

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
    patterns: [/1:1/i, /one[\s-]?on[\s-]?one/i, /sync\s+with/i, /catch[\s-]?up\s+with/i, /skip[\s-]?level/i],
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
    patterns: [/project/i, /sprint/i, /spec/i, /design/i, /roadmap/i, /kickoff/i, /review/i],
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
    patterns: [/family/i, /henry/i, /son/i, /park/i, /school/i, /kid/i, /child/i],
  },
  {
    colorId: "7",
    colorName: "Peacock",
    meaning: "Personal Projects",
    patterns: [/writing/i, /podcast/i, /creative/i, /blog/i, /side\s*project/i, /personal\s*project/i],
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
    patterns: [/urgent/i, /deadline/i, /asap/i, /critical/i, /emergency/i, /blocked/i, /waiting/i],
  },
];

export function suggestCategoryFromTitle(title: string): CategorySuggestion {
  const t = title || "";
  for (const category of CATEGORY_PATTERNS) {
    for (const pattern of category.patterns) {
      if (pattern.test(t)) {
        return {
          colorId: category.colorId,
          colorName: category.colorName,
          meaning: category.meaning,
          confidence: 0.8,
        };
      }
    }
  }
  return {
    colorId: "4",
    colorName: "Flamingo",
    meaning: "Meetings",
    confidence: 0.2,
  };
}
