import { NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import { getCalendars, getAccounts } from "@/lib/db-unified";

/**
 * GET /api/calendars
 *
 * Returns all distinct calendars and accounts from the database.
 */
export async function GET() {
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const [calendars, accounts] = await Promise.all([
      getCalendars(userId),
      getAccounts(userId),
    ]);

    // Group calendars by account
    const byAccount = new Map<string, string[]>();
    for (const cal of calendars) {
      const existing = byAccount.get(cal.account) || [];
      existing.push(cal.calendar_name);
      byAccount.set(cal.account, existing);
    }

    const groupedCalendars = Array.from(byAccount.entries()).map(
      ([account, calendarNames]) => ({
        account,
        calendars: calendarNames.sort(),
      })
    );

    return NextResponse.json({
      calendars,
      accounts,
      byAccount: groupedCalendars,
    });
  } catch (error) {
    console.error("Error fetching calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}
