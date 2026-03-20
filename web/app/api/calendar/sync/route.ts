import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { runCalendarSync } from "@/lib/calendar-sync-supabase";
import { getLinkedAccountsForUser } from "@/lib/linked-google-accounts";
import { withCalendarSyncLock } from "@/lib/sync-lock";

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default sync window: UTC today −30 … today +30 (inclusive calendar days). */
function defaultSyncDateRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayUtc = new Date(Date.UTC(y, m, d));
  const start = new Date(todayUtc);
  start.setUTCDate(start.getUTCDate() - 30);
  const end = new Date(todayUtc);
  end.setUTCDate(end.getUTCDate() + 30);
  return { start: utcDateString(start), end: utcDateString(end) };
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * POST /api/calendar/sync
 *
 * Body (optional JSON): { start?: "YYYY-MM-DD", end?: "YYYY-MM-DD", linkedAccountId?: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  let body: {
    start?: string;
    end?: string;
    linkedAccountId?: string;
  } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const range = defaultSyncDateRange();
  const start = body.start ?? range.start;
  const end = body.end ?? range.end;

  if (!isIsoDate(start) || !isIsoDate(end)) {
    return NextResponse.json(
      { error: "start and end must be YYYY-MM-DD when provided" },
      { status: 400 }
    );
  }
  if (start > end) {
    return NextResponse.json({ error: "start must be on or before end" }, { status: 400 });
  }

  const linked = await getLinkedAccountsForUser(userId);
  if (linked.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No linked Google account with tokens. Sign out and sign in again with Google (consent includes Calendar).",
      },
      { status: 400 }
    );
  }

  let linkedAccountId = body.linkedAccountId;
  if (!linkedAccountId) {
    linkedAccountId = linked[0]!.id;
  }
  if (!linked.some((l) => l.id === linkedAccountId)) {
    return NextResponse.json({ error: "linkedAccountId not found for user" }, { status: 400 });
  }

  const locked = await withCalendarSyncLock(userId, async () => {
    return runCalendarSync({
      userId,
      linkedAccountId,
      startDate: start,
      endDate: end,
    });
  });

  if (!locked.ok) {
    return NextResponse.json(
      { ok: false, error: "Calendar sync already running for this user" },
      { status: 409 }
    );
  }

  const { stats, errors } = locked.value;
  const anySuccess = stats.calendarsProcessed > 0 || stats.upserted > 0;

  return NextResponse.json(
    {
      ok: anySuccess || errors.length === 0,
      stats,
      errors,
      dateRange: { start, end },
    },
    { status: 200 }
  );
}
