"use client";

import { useAuth, useSession, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { withBasePath } from "@/lib/base-path";

const META_KEY = "app_user_id";

/**
 * After Clerk sign-in, ensure `public.users` + `publicMetadata.app_user_id`, then reload the session JWT.
 */
export function ClerkBootstrapSession() {
  const { isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const { user, isLoaded: userLoaded } = useUser();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !userId || !session || !userLoaded || !user) return;

    const hasMeta =
      typeof user.publicMetadata?.[META_KEY] === "string" &&
      (user.publicMetadata[META_KEY] as string).length > 0;
    if (hasMeta) return;

    if (inFlight.current) return;
    inFlight.current = true;

    void (async () => {
      try {
        const res = await fetch(withBasePath("/api/meos/ensure-user"), {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        await session.reload();
      } finally {
        inFlight.current = false;
      }
    })();
  }, [isSignedIn, userId, session, user, userLoaded]);

  return null;
}
