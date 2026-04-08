import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  deleteLinkedGoogleAccountForUser,
  getLinkedAccountsForUser,
} from "@/lib/linked-google-accounts";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

/**
 * GET /api/calendar/linked — metadata only (no tokens).
 * Rows are sorted by `google_email` ascending (stable).
 */
export async function GET() {
  const authResult = await requireAuth();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getLinkedAccountsForUser(userId);
  return NextResponse.json({
    linked: rows.map((r) => ({
      id: r.id,
      google_email: r.google_email,
      account_label: r.account_label,
      updated_at: r.updated_at,
    })),
  });
  });
}

/** DELETE /api/calendar/linked?id= — remove one linked Google account (encrypted tokens). */
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
  }

  await deleteLinkedGoogleAccountForUser(userId, id);
  return NextResponse.json({ ok: true });
  });
}
