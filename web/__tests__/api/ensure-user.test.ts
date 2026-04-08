import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const currentUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

const bootstrapMock = vi.fn();
vi.mock("@/lib/app-user-bootstrap", () => ({
  bootstrapAppUserFromClerk: (...args: unknown[]) => bootstrapMock(...args),
}));

import { POST } from "@/app/api/meos/ensure-user/route";

describe("POST /api/meos/ensure-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no Clerk session", async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
    expect(bootstrapMock).not.toHaveBeenCalled();
  });

  it("bootstraps public.users via service role and returns appUserId", async () => {
    authMock.mockResolvedValue({ userId: "user_clerk_xyz" });
    currentUserMock.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "ada@example.com" },
      firstName: "Ada",
      lastName: "Lovelace",
      username: null,
    });
    bootstrapMock.mockResolvedValue({ appUserId: "uuid-app-user-1" });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(bootstrapMock).toHaveBeenCalledWith({
      clerkUserId: "user_clerk_xyz",
      email: "ada@example.com",
      displayName: "Ada Lovelace",
    });

    const body = await res.json();
    expect(body).toEqual({ appUserId: "uuid-app-user-1" });
  });

  it("uses username as displayName when names are empty", async () => {
    authMock.mockResolvedValue({ userId: "user_clerk_xyz" });
    currentUserMock.mockResolvedValue({
      primaryEmailAddress: { emailAddress: null },
      firstName: null,
      lastName: null,
      username: "ada42",
    });
    bootstrapMock.mockResolvedValue({ appUserId: "uuid-2" });

    await POST();

    expect(bootstrapMock).toHaveBeenCalledWith({
      clerkUserId: "user_clerk_xyz",
      email: null,
      displayName: "ada42",
    });
  });
});
