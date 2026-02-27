import { NextRequest, NextResponse } from "next/server";
import { getEvents, updateAttendance } from "@/lib/db";

/**
 * GET /api/events
 *
 * Query params:
 *   - start: Start date (YYYY-MM-DD) - required
 *   - end: End date (YYYY-MM-DD) - required
 *   - calendars: Comma-separated calendar names (optional)
 *   - accounts: Comma-separated account names (optional)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const calendarsParam = searchParams.get("calendars");
  const accountsParam = searchParams.get("accounts");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query parameters are required" },
      { status: 400 }
    );
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start) || !dateRegex.test(end)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  try {
    const options: { calendars?: string[]; accounts?: string[] } = {};

    if (calendarsParam) {
      options.calendars = calendarsParam.split(",").map((c) => c.trim());
    }

    if (accountsParam) {
      options.accounts = accountsParam.split(",").map((a) => a.trim());
    }

    const events = await getEvents(start, end, options);

    return NextResponse.json({
      events,
      count: events.length,
      dateRange: { start, end },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/events
 *
 * Body:
 *   - eventId: Event ID to update
 *   - attended: "attended" | "skipped" | "unknown"
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, attended } = body;

    if (!eventId || !attended) {
      return NextResponse.json(
        { error: "eventId and attended are required" },
        { status: 400 }
      );
    }

    if (!["attended", "skipped", "unknown"].includes(attended)) {
      return NextResponse.json(
        { error: "attended must be 'attended', 'skipped', or 'unknown'" },
        { status: 400 }
      );
    }

    await updateAttendance(eventId, attended);

    return NextResponse.json({
      success: true,
      eventId,
      attended,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}
