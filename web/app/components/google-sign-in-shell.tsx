"use client";

import { useEffect, useState, type ReactNode } from "react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function NativeGoogleSignIn({ callbackUrl }: { callbackUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${origin}/api/auth/mobile/google/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Sign-in failed (${res.status})`);
        return;
      }
      if (!data.url) {
        setErr("No authorization URL returned");
        return;
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClick()}
        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60"
      >
        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
          <GoogleIcon className="h-5 w-5" />
        </span>
        {busy ? "Opening browser…" : "Sign in with Google (system browser)"}
      </button>
      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{err}</p>
      ) : null}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Opens Safari for Google sign-in, then returns to MeOS.
      </p>
    </div>
  );
}

export function GoogleSignInShell({
  children,
  callbackUrl,
}: {
  children: ReactNode;
  callbackUrl: string;
}) {
  const [native, setNative] = useState<boolean | null>(null);

  useEffect(() => {
    void import("@capacitor/core").then(({ Capacitor }) => {
      setNative(Capacitor.isNativePlatform());
    });
  }, []);

  if (native === null) {
    return (
      <div
        className="min-h-[120px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
        aria-busy
      >
        Loading…
      </div>
    );
  }

  if (native) {
    return <NativeGoogleSignIn callbackUrl={callbackUrl} />;
  }

  return <>{children}</>;
}
