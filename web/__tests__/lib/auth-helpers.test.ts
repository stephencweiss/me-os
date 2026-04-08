import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/auth-helpers";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.mocked(clerkAuth).mockReset();
    vi.mocked(currentUser).mockReset();
  });

  it("uses Clerk publicMetadata.app_user_id when Clerk session is present", async () => {
    vi.mocked(clerkAuth).mockResolvedValue({ userId: "user_abc" } as never);
    vi.mocked(currentUser).mockResolvedValue({
      primaryEmailAddress: { emailAddress: "a@b.com" },
      publicMetadata: { app_user_id: "uuid-tenant-1" },
    } as never);

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

  it("returns 401 when there is no Clerk session", async () => {
    vi.mocked(clerkAuth).mockResolvedValue({ userId: null } as never);

    const r = await requireAuth();
    expect(r.authorized).toBe(false);
  });
});
