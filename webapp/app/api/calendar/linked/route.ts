import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getLinkedAccountsForUser } from "@/lib/linked-google-accounts";

/** GET /api/calendar/linked — metadata only (no tokens). */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }

  const rows = await getLinkedAccountsForUser(authResult.userId);
  return NextResponse.json({
    linked: rows.map((r) => ({
      id: r.id,
      google_email: r.google_email,
      account_label: r.account_label,
      updated_at: r.updated_at,
    })),
  });
}
