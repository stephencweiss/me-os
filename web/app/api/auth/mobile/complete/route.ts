import { NextResponse } from "next/server";
import { formatDatabaseSessionSetCookieHeader } from "@/lib/auth-session-cookie";
import { consumeMobileOauthPending } from "@/lib/mobile-oauth-store";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect-path";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let body: { id?: unknown } = {};
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = await consumeMobileOauthPending(id);
  if (!row) {
    return NextResponse.json(
      { error: "Handoff expired or already used" },
      { status: 410 }
    );
  }

  const expires = new Date(row.session_expires_at);
  const cookie = formatDatabaseSessionSetCookieHeader(
    row.session_token,
    expires
  );

  const callbackPath = safeRelativeRedirectPath(row.redirect_to, "/");

  return NextResponse.json(
    { ok: true, callbackUrl: callbackPath },
    {
      status: 200,
      headers: {
        "Set-Cookie": cookie,
      },
    }
  );
}
