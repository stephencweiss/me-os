import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const createSupabaseForClerkUserMock = vi.fn();
vi.mock("@/lib/supabase-clerk", () => ({
  createSupabaseForClerkUser: () => createSupabaseForClerkUserMock(),
}));

import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";
import { tryGetTenantSupabase } from "@/lib/supabase-tenant-context";
import type { TypedSupabaseClient } from "@/lib/supabase-server";

describe("withTenantSupabaseForApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth failure response when unauthorized", async () => {
    const res = await withTenantSupabaseForApi(
      { authorized: false, response: NextResponse.json({ err: "no" }, { status: 401 }) },
      async () => ({ ok: true })
    );
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
  });

  it("runs callback without tenant when userId is null (local mode)", async () => {
    const fn = vi.fn().mockResolvedValue("done");
    const out = await withTenantSupabaseForApi(
      { authorized: true, userId: null, email: null },
      fn
    );
    expect(out).toBe("done");
    expect(fn).toHaveBeenCalledWith({ userId: null, email: null });
    expect(createSupabaseForClerkUserMock).not.toHaveBeenCalled();
  });

  it("returns 401 when Clerk session exists but Supabase JWT is missing", async () => {
    authMock.mockResolvedValue({ userId: "clerk_1" });
    createSupabaseForClerkUserMock.mockResolvedValue({ ok: false, reason: "no_jwt" });
    const res = await withTenantSupabaseForApi(
      { authorized: true, userId: "app-uuid", email: "a@b.com" },
      async () => "should-not-run"
    );
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
    const body = await (res as NextResponse).json();
    expect(body.code).toBe("supabase_no_jwt");
  });

  it("sets ALS tenant client when Clerk session + JWT client are ok", async () => {
    const fakeClient = { __tag: "tenant" } as unknown as TypedSupabaseClient;
    authMock.mockResolvedValue({ userId: "clerk_1" });
    createSupabaseForClerkUserMock.mockResolvedValue({ ok: true, client: fakeClient });

    let tenantInside: ReturnType<typeof tryGetTenantSupabase>;
    const out = await withTenantSupabaseForApi(
      { authorized: true, userId: "app-uuid", email: null },
      async () => {
        tenantInside = tryGetTenantSupabase();
        return "ok";
      }
    );

    expect(out).toBe("ok");
    expect(tenantInside).toBe(fakeClient);
    expect(tryGetTenantSupabase()).toBeUndefined();
  });

  it("skips tenant JWT when Clerk auth has no userId (service-role data path)", async () => {
    authMock.mockResolvedValue({ userId: null });
    const fn = vi.fn().mockResolvedValue("legacy");
    const out = await withTenantSupabaseForApi(
      { authorized: true, userId: "app-user-from-session", email: "x@y.com" },
      fn
    );
    expect(out).toBe("legacy");
    expect(createSupabaseForClerkUserMock).not.toHaveBeenCalled();
  });
});
