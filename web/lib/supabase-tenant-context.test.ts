import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runWithTenantSupabase, tryGetTenantSupabase } from "./supabase-tenant-context";
import type { TypedSupabaseClient } from "./supabase-server";

describe("supabase-tenant-context", () => {
  it("exposes the tenant client only inside runWithTenantSupabase", async () => {
    const fake = { __tag: "tenant-mock" } as unknown as TypedSupabaseClient;

    expect(tryGetTenantSupabase()).toBeUndefined();

    await runWithTenantSupabase(fake, async () => {
      expect(tryGetTenantSupabase()).toBe(fake);
    });

    expect(tryGetTenantSupabase()).toBeUndefined();
  });
});

describe("getTenantSupabaseOrServiceRole", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ALS tenant client when runWithTenantSupabase is active", async () => {
    const { getTenantSupabaseOrServiceRole } = await import("./supabase-server");
    const fake = { __tag: "als-tenant" } as unknown as TypedSupabaseClient;

    await runWithTenantSupabase(fake, async () => {
      expect(getTenantSupabaseOrServiceRole()).toBe(fake);
    });
  });
});
