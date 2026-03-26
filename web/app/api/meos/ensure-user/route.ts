import { auth, currentUser } from "@clerk/nextjs/server";
import { bootstrapAppUserFromClerk } from "@/lib/app-user-bootstrap";

export const dynamic = "force-dynamic";

/**
 * Lazy bootstrap: call after Clerk sign-in if the webhook has not run yet (or JWT lacks `app_user_id`).
 * Client may POST once, then refresh the session so Supabase receives the updated claim.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || null;

  const { appUserId } = await bootstrapAppUserFromClerk({
    clerkUserId: userId,
    email,
    displayName: displayName || null,
  });

  return Response.json({ appUserId });
}
