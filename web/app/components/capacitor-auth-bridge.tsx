"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getClientAppOrigin } from "@/lib/app-origin-client";
import { normalizeMobileOAuthScheme } from "@/lib/mobile-oauth-deep-link";

function clientScheme(): string {
  return normalizeMobileOAuthScheme(
    process.env.NEXT_PUBLIC_MOBILE_OAUTH_REDIRECT_SCHEME
  );
}

/**
 * Handles meos://auth/complete and meos://auth/error after system-browser Google OAuth.
 */
export function CapacitorAuthBridge() {
  const router = useRouter();

  useEffect(() => {
    let removed = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("appUrlOpen", async ({ url: href }) => {
          if (removed) return;
          const scheme = clientScheme();
          let u: URL;
          try {
            u = new URL(href);
          } catch {
            return;
          }
          if (u.protocol !== `${scheme}:`) return;
          if (u.hostname !== "auth") return;

          const path = u.pathname.replace(/^\/{2,}/, "/");
          if (path === "/error" || path.endsWith("/error")) {
            const reason = u.searchParams.get("reason") ?? "unknown";
            router.replace(
              `/login?error=mobile_oauth&reason=${encodeURIComponent(reason)}`
            );
            return;
          }

          if (path !== "/complete" && !path.endsWith("/complete")) return;

          const id = u.searchParams.get("id");
          if (!id) {
            router.replace("/login?error=mobile_oauth&reason=missing_id");
            return;
          }

          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close().catch(() => {});
          } catch {
            /* optional */
          }

          const origin = getClientAppOrigin();
          const res = await fetch(`${origin}/api/auth/mobile/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
            credentials: "include",
          });

          if (!res.ok) {
            router.replace(
              `/login?error=mobile_oauth&reason=${encodeURIComponent(
                res.status === 410 ? "handoff_expired" : "complete_failed"
              )}`
            );
            return;
          }

          const data = (await res.json()) as { callbackUrl?: string };
          const dest =
            typeof data.callbackUrl === "string" && data.callbackUrl.startsWith("/")
              ? data.callbackUrl
              : "/today";
          router.replace(dest);
          router.refresh();
        });

        removeListener = () => {
          void sub.remove();
        };
      } catch {
        /* web dev */
      }
    })();

    return () => {
      removed = true;
      removeListener?.();
    };
  }, [router]);

  return null;
}
