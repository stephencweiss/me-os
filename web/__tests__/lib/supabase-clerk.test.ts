import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({})),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

import { createSupabaseForClerkUser } from "@/lib/supabase-clerk";

describe("createSupabaseForClerkUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockReturnValue({});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("CLERK_SUPABASE_JWT_TEMPLATE", "");
    authMock.mockResolvedValue({
      userId: "user_2abc",
      getToken: vi.fn().mockResolvedValue("signed.jwt.token"),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates anon client with Authorization Bearer from default session token", async () => {
    await createSupabaseForClerkUser();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: {
          headers: { Authorization: "Bearer signed.jwt.token" },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
  });

  it("returns no_clerk_user when Clerk session is missing", async () => {
    authMock.mockResolvedValue({ userId: null, getToken: vi.fn() });
    const result = await createSupabaseForClerkUser();
    expect(result).toEqual({ ok: false, reason: "no_clerk_user" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns no_jwt when getToken resolves null", async () => {
    authMock.mockResolvedValue({
      userId: "x",
      getToken: vi.fn().mockResolvedValue(null),
    });
    const result = await createSupabaseForClerkUser();
    expect(result).toEqual({ ok: false, reason: "no_jwt" });
  });

  it("returns missing_supabase_env when URL or anon key unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const result = await createSupabaseForClerkUser();
    expect(result).toEqual({ ok: false, reason: "missing_supabase_env" });
  });

  it("uses CLERK_SUPABASE_JWT_TEMPLATE when set", async () => {
    vi.stubEnv("CLERK_SUPABASE_JWT_TEMPLATE", "supabase");
    const getToken = vi.fn().mockResolvedValue("template.jwt");
    authMock.mockResolvedValue({
      userId: "user_2abc",
      getToken,
    });

    await createSupabaseForClerkUser();

    expect(getToken).toHaveBeenCalledWith({ template: "supabase" });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer template.jwt" } },
      })
    );
  });
});
