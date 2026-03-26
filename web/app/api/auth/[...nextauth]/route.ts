import { handlers } from "@/lib/auth";
import { restoreAuthRequestUrlForAuthJs } from "@/lib/auth-request-url";
import type { NextRequest } from "next/server";

const { GET: authGET, POST: authPOST } = handlers;

export function GET(req: NextRequest) {
  return authGET(restoreAuthRequestUrlForAuthJs(req));
}

export function POST(req: NextRequest) {
  return authPOST(restoreAuthRequestUrlForAuthJs(req));
}
