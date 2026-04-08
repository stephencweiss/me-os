import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal, isLocalMode } from "@/lib/auth-helpers";
import { loadWeekAlignmentMobileV1 } from "@/lib/week-alignment";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

const WEEK_RE = /^\d{4}-W\d{2}$/;

/**
 * GET /api/week-alignment?week=YYYY-Www
 *
 * Returns AlignmentMobileV1 JSON for the mobile alignment MVP (Phase 1).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuthUnlessLocal();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!isLocalMode() && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const week = request.nextUrl.searchParams.get("week");
  if (!week) {
    return NextResponse.json(
      { error: "week query parameter is required (format: YYYY-Www)" },
      { status: 400 }
    );
  }

  if (!WEEK_RE.test(week)) {
    return NextResponse.json(
      { error: "Week must be in YYYY-Www format (e.g., 2026-W10)" },
      { status: 400 }
    );
  }

  try {
    const payload = await loadWeekAlignmentMobileV1(userId, week);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("week-alignment GET:", error);
    return NextResponse.json({ error: "Failed to load week alignment" }, { status: 500 });
  }
  });
}
