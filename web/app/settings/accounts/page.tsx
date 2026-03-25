"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/app/components/Button";
import { withBasePath } from "@/lib/base-path";

interface Account {
  account: string;
  eventCount: number;
}

interface LinkedMeta {
  id: string;
  google_email: string;
  account_label: string;
  updated_at: string;
}

export default function AccountsPage() {
  const { status } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linked, setLinked] = useState<LinkedMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncDetail, setSyncDetail] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const [calRes, linkedRes] = await Promise.all([
      fetch(withBasePath("/api/calendars")),
      fetch(withBasePath("/api/calendar/linked")),
    ]);
    if (!calRes.ok) {
      throw new Error("Failed to fetch accounts");
    }
    const data = await calRes.json();

    const accountMap = new Map<string, number>();
    for (const cal of data.calendars || []) {
      const count = accountMap.get(cal.account) || 0;
      accountMap.set(cal.account, count + 1);
    }

    const accountList: Account[] = Array.from(accountMap.entries()).map(
      ([account, eventCount]) => ({ account, eventCount })
    );
    setAccounts(accountList);

    if (linkedRes.ok) {
      const lj = await linkedRes.json();
      setLinked(lj.linked || []);
    } else {
      setLinked([]);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await refreshData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      load();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, refreshData]);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    if (window.location.hash === "#calendar-sync") {
      document.getElementById("calendar-sync")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  async function runSync() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncDetail(null);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/calendar/sync"), {
        method: "POST",
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMessage(data.error || `Sync failed (${res.status})`);
        return;
      }
      const { stats, errors } = data;
      const parts = [
        `Fetched ${stats?.fetched ?? 0} events, upserted ${stats?.upserted ?? 0}, removed ${stats?.markedRemoved ?? 0}.`,
      ];
      if (errors?.length) {
        parts.push(`${errors.length} calendar(s) had errors.`);
        setSyncDetail(
          errors
            .map(
              (e: { calendarSummary: string; message: string }) =>
                `${e.calendarSummary}: ${e.message}`
            )
            .join("\n")
        );
      }
      setSyncMessage(parts.join(" "));
      await refreshData();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8" />
            <div className="space-y-3">
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Sign in required
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please sign in to manage your linked accounts.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/today"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Today
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Linked Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Manage your connected Google Calendar accounts.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div
          id="calendar-sync"
          className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-blue-200 dark:border-blue-900/50"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Sync calendar
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Pull Google Calendar into MeOS (default: last 30 days through next 30 days, UTC). If
            this fails, check the error — you may need Google sign-in, Calendar scope, or{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">TOKEN_ENCRYPTION_KEY</code>.
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            isLoading={syncing}
            onClick={() => void runSync()}
          >
            Sync calendar now
          </Button>
          {linked.length === 0 && !syncMessage && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              No linked row listed yet — you can still run sync; the server will try to mirror
              tokens from your Google sign-in.
            </p>
          )}
          {syncMessage && (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{syncMessage}</p>
          )}
          {syncDetail && (
            <pre className="mt-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {syncDetail}
            </pre>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-medium text-gray-900 dark:text-white">
              Synced Accounts
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              These accounts have calendar data synced to MeOS.
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg
                  className="w-12 h-12 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                No calendar accounts synced yet.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Run the calendar sync to import your calendar data.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((account) => (
                <li
                  key={account.account}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {account.account}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {account.eventCount} calendar{account.eventCount !== 1 ? "s" : ""} synced
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded">
                    Connected
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
          <div>
            <h2 className="font-medium text-gray-900 dark:text-white mb-2">
              Google link (NextAuth)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              OAuth tokens live in <code className="text-xs">next_auth.accounts</code>; MeOS mirrors
              them into encrypted <code className="text-xs">linked_google_accounts</code> when you open
              this page or run sync. Re-consent in Google if you added Calendar scope.
            </p>
            {linked.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No linked row yet — complete a Google sign-in after deploying migrations and{" "}
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">TOKEN_ENCRYPTION_KEY</code>.
              </p>
            ) : (
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {linked.map((l) => (
                  <li key={l.id}>
                    <span className="font-medium">{l.google_email}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {" "}
                      ({l.account_label})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h2 className="font-medium text-gray-900 dark:text-white mb-2">Add Account</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Additional Google accounts (separate OAuth) can be added later.
            </p>
            <button
              type="button"
              disabled
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
            >
              Link another Google account (coming soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
