import { describe, expect, it } from "vitest";
import { formatWeeklyReportMarkdown, type WeeklySummary } from "../lib/time-analysis.js";

function createBaseReport(): WeeklySummary {
  const weekStart = new Date("2026-02-22T00:00:00");
  const weekEnd = new Date("2026-03-01T00:00:00");
  const day = new Date("2026-02-23T00:00:00");

  return {
    weekStart,
    weekEnd,
    totalScheduledMinutes: 120,
    totalGapMinutes: 60,
    byColor: [],
    accounts: ["personal"],
    days: [
      {
        date: day,
        dateString: "Monday, February 23, 2026",
        totalScheduledMinutes: 120,
        totalGapMinutes: 60,
        events: [],
        allDayEvents: [],
        availabilityEvents: [],
        referenceEvents: [],
        gaps: [],
        byColor: [],
        isWorkDay: true,
        analysisHours: { start: 9, end: 17 },
        coverageGaps: [],
        coverageOptOuts: [],
        coverageLifecycleProposals: [],
      },
    ],
    coverageGaps: [],
    coverageOptOuts: [],
    coverageLifecycleProposals: [],
  };
}

describe("formatWeeklyReportMarkdown coverage sections", () => {
  it("includes missing coverage, opted-out, and orphaned sections when present", () => {
    const report = createBaseReport();
    report.coverageGaps = [
      {
        ruleId: "babysitter-date",
        ruleName: "Date requires babysitter",
        sourceEventId: "source-1",
        sourceSummary: "Date night",
        sourceStart: new Date("2026-02-27T19:00:00"),
        sourceEnd: new Date("2026-02-27T21:00:00"),
        requiredStart: new Date("2026-02-27T19:00:00"),
        requiredEnd: new Date("2026-02-27T21:00:00"),
        requiredDurationMinutes: 120,
        coveredDurationMinutes: 0,
        actualCoveragePercent: 0,
        requiredCoveragePercent: 100,
        missingMinutes: 120,
        actionMode: "propose",
        createTarget: { account: "personal", calendar: "Family" },
        coverageColorId: "5",
        sourceCalendarName: "Social",
      },
    ];
    report.coverageOptOuts = [
      {
        ruleId: "dog-care-trip",
        sourceEventId: "source-2",
        sourceSummary: "Trip",
        matchedIn: "description",
        token: "no coverage needed",
      },
    ];
    report.coverageLifecycleProposals = [
      {
        ruleId: "babysitter-date",
        coverageEventId: "coverage-1",
        coverageSummary: "Babysitter for Date night",
        action: "propose-delete",
      },
    ];

    const markdown = formatWeeklyReportMarkdown(report);

    expect(markdown).toContain("## Dependent Coverage Gaps");
    expect(markdown).toContain("Date requires babysitter");
    expect(markdown).toContain("## Coverage Opt-Outs");
    expect(markdown).toContain("no coverage needed");
    expect(markdown).toContain("## Orphaned Coverage Proposals");
    expect(markdown).toContain("propose-delete");
  });

  it("omits coverage sections when there are no coverage findings", () => {
    const report = createBaseReport();

    const markdown = formatWeeklyReportMarkdown(report);

    expect(markdown).not.toContain("## Dependent Coverage Gaps");
    expect(markdown).not.toContain("## Coverage Opt-Outs");
    expect(markdown).not.toContain("## Orphaned Coverage Proposals");
  });
});
