import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal, isLocalMode } from "@/lib/auth-helpers";
import { applyWeeklyAuditAction } from "@/lib/db-unified";
import type { WeeklyAuditAction } from "@/lib/db-supabase";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

const WEEK_RE = /^\d{4}-W\d{2}$/;
const ACTIONS: WeeklyAuditAction[] = ["dismiss", "snooze", "seen"];

/**
 * POST /api/week-alignment/audit
 *
 * Body: { week: "YYYY-Www", action: "dismiss" | "snooze" | "seen", snoozedUntil?: ISO string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthUnlessLocal();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!isLocalMode() && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const { week, action, snoozedUntil } = body as Record<string, unknown>;

  if (typeof week !== "string" || !WEEK_RE.test(week)) {
    return NextResponse.json(
      { error: "week must be a string in YYYY-Www format" },
      { status: 400 }
    );
  }

  if (typeof action !== "string" || !ACTIONS.includes(action as WeeklyAuditAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (action === "snooze") {
    if (typeof snoozedUntil !== "string" || Number.isNaN(Date.parse(snoozedUntil))) {
      return NextResponse.json(
        { error: "snooze requires snoozedUntil as a valid ISO-8601 date-time string" },
        { status: 400 }
      );
    }
  }

  try {
    const state = await applyWeeklyAuditAction(userId, week, action as WeeklyAuditAction, {
      snoozedUntil: typeof snoozedUntil === "string" ? snoozedUntil : undefined,
    });
    return NextResponse.json({ ok: true, audit: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("snooze requires")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("week-alignment audit POST:", error);
    return NextResponse.json({ error: "Failed to update audit state" }, { status: 500 });
  }
  });
}
