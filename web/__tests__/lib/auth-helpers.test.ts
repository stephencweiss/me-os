import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { auth as nextAuth } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-helpers";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.mocked(clerkAuth).mockReset();
    vi.mocked(currentUser).mockReset();
    vi.mocked(nextAuth).mockReset();
  });

  it("uses Clerk publicMetadata.app_user_id when Clerk session is present", async () => {
    vi.mocked(clerkAuth).mockResolvedValue({ userId: "user_abc" } as never);
    vi.mocked(currentUser).mockResolvedValue({
      primaryEmailAddress: { emailAddress: "a@b.com" },
      publicMetadata: { app_user_id: "uuid-tenant-1" },
    } as never);
    vi.mocked(nextAuth).mockResolvedValue(null as never);

    const r = await requireAuth();
    expect(r.authorized).toBe(true);
    if (r.authorized) {
      expect(r.userId).toBe("uuid-tenant-1");
      expect(r.email).toBe("a@b.com");
    }
  });

  it("returns 401 when Clerk user lacks app_user_id", async () => {
    vi.mocked(clerkAuth).mockResolvedValue({ userId: "user_abc" } as never);
    vi.mocked(currentUser).mockResolvedValue({
      primaryEmailAddress: { emailAddress: "a@b.com" },
      publicMetadata: {},
    } as never);

    const r = await requireAuth();
    expect(r.authorized).toBe(false);
  });

  it("falls back to NextAuth when Clerk has no userId", async () => {
    vi.mocked(clerkAuth).mockResolvedValue({ userId: null } as never);
    vi.mocked(nextAuth).mockResolvedValue({
      user: { id: "legacy-id", email: "legacy@b.com" },
    } as never);

    const r = await requireAuth();
    expect(r.authorized).toBe(true);
    if (r.authorized) {
      expect(r.userId).toBe("legacy-id");
      expect(r.email).toBe("legacy@b.com");
    }
  });
});
