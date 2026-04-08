"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/app/components/Button";
import { withBasePath } from "@/lib/base-path";

const LINKED_ACCOUNT_LIMIT = 5;
const NEED_MORE_ACCOUNTS_URL =
  "https://github.com/stephencweiss/me-os/issues/new?title=MeOS%3A%20more%20than%205%20Google%20accounts&body=Describe%20why%20you%20need%20more%20linked%20Google%20accounts.";

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

function googleLinkStartUrl(label?: string): string {
  const base = withBasePath("/api/google/link/start");
  if (label?.trim()) {
    return `${base}?label=${encodeURIComponent(label.trim())}`;
  }
  return base;
}

function formatSyncResponse(data: Record<string, unknown>): {
  message: string;
  detail: string | null;
} {
  if (data.skipped === true) {
    return {
      message:
        (data.message as string) ||
        "Skipped — synced less than a minute ago.",
      detail: null,
    };
  }

  const stats = data.stats as
    | {
        fetched?: number;
        upserted?: number;
        markedRemoved?: number;
      }
    | undefined;
  const errors = data.errors as
    | { calendarSummary: string; message: string }[]
    | undefined;
  const accounts = data.accounts as
    | {
        linkedAccountId: string;
        googleEmail?: string;
        skipped?: boolean;
        message?: string;
        fatalError?: string;
        stats?: { fetched?: number; upserted?: number };
        errors?: { calendarSummary: string; message: string }[];
      }[]
    | undefined;

  if (accounts && accounts.length > 0) {
    let skippedN = 0;
    const summaries: string[] = [];
    for (const a of accounts) {
      if (a.skipped) {
        skippedN += 1;
      } else if (a.fatalError) {
        summaries.push(`${a.googleEmail || a.linkedAccountId}: ${a.fatalError}`);
      } else if (a.stats) {
        summaries.push(
          `${a.googleEmail || "Account"}: fetched ${a.stats.fetched ?? 0}, upserted ${a.stats.upserted ?? 0}.`
        );
      }
    }
    const mergedDetail =
      errors && errors.length > 0
        ? errors.map((e) => `${e.calendarSummary}: ${e.message}`).join("\n")
        : accounts
            .flatMap((a) => a.errors || [])
            .map((e) => `${e.calendarSummary}: ${e.message}`)
            .join("\n") || null;
    const tail =
      skippedN > 0
        ? `${skippedN} account(s) skipped (synced less than a minute ago).`
        : "";
    return {
      message:
        [summaries.join(" "), tail].filter(Boolean).join(" ").trim() ||
        "Sync finished.",
      detail: mergedDetail || null,
    };
  }

  const parts = [
    `Fetched ${stats?.fetched ?? 0} events, upserted ${stats?.upserted ?? 0}, removed ${stats?.markedRemoved ?? 0}.`,
  ];
  if (errors?.length) {
    parts.push(`${errors.length} calendar(s) had errors.`);
  }
  return {
    message: parts.join(" "),
    detail:
      errors && errors.length > 0
        ? errors
            .map((e) => `${e.calendarSummary}: ${e.message}`)
            .join("\n")
        : null,
  };
}

export default function AccountsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linked, setLinked] = useState<LinkedMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncDetail, setSyncDetail] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

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

    if (!isLoaded) return;
    if (isSignedIn) {
      void load();
    } else {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, refreshData]);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const params = new URLSearchParams(window.location.search);
    const linkedOk = params.get("google_linked");
    const linkErr = params.get("google_link");
    if (linkedOk === "1") {
      setBanner("Google Calendar connected successfully.");
    } else if (linkErr) {
      const detail = params.get("detail");
      const labels: Record<string, string> = {
        auth: "Sign in to MeOS first, then try connecting again.",
        denied: "Google consent was denied or cancelled.",
        bad_request: "Missing OAuth parameters. Try Connect again.",
        state: "Security check failed (OAuth state). Try Connect again.",
        user_mismatch: "Signed-in user did not match the link session. Try again.",
        exchange: "Could not complete Google token exchange.",
      };
      setBanner(
        `${labels[linkErr] || "Could not complete Google link."}${detail ? ` (${detail})` : ""}`
      );
    }
    if (linkedOk || linkErr) {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.hash}`
      );
    }
  }, [loading]);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    if (window.location.hash === "#calendar-sync") {
      document
        .getElementById("calendar-sync")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  async function postSync(body: Record<string, unknown>) {
    const res = await fetch(withBasePath("/api/calendar/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      return {
        ok: false as const,
        message: (data.error as string) || `Sync failed (${res.status})`,
        detail: null as string | null,
      };
    }
    const { message, detail } = formatSyncResponse(data);
    return { ok: true as const, message, detail };
  }

  async function runSyncAll() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncDetail(null);
    setError(null);
    try {
      const body =
        linked.length > 1 ? { all: true } : { linkedAccountId: linked[0]?.id };
      const r = await postSync(body);
      if (!r.ok) {
        setSyncMessage(r.message);
        return;
      }
      setSyncMessage(r.message);
      setSyncDetail(r.detail);
      await refreshData();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function runSyncOne(linkedAccountId: string) {
    setSyncingId(linkedAccountId);
    setSyncMessage(null);
    setSyncDetail(null);
    setError(null);
    try {
      const r = await postSync({ linkedAccountId });
      if (!r.ok) {
        setSyncMessage(r.message);
        return;
      }
      setSyncMessage(r.message);
      setSyncDetail(r.detail);
      await refreshData();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Disconnect this Google account from MeOS?")) return;
    setDisconnectingId(id);
    setError(null);
    try {
      const res = await fetch(
        `${withBasePath("/api/calendar/linked")}?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Failed to disconnect");
        return;
      }
      await refreshData();
      setSyncMessage(null);
      setSyncDetail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnectingId(null);
    }
  }

  function confirmAddWithLabel() {
    setShowLabelModal(false);
    window.location.href = googleLinkStartUrl(labelDraft);
    setLabelDraft("");
  }

  const atLinkedLimit = linked.length >= LINKED_ACCOUNT_LIMIT;

  if (!isLoaded || loading) {
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

  if (!isSignedIn) {
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
            href={withBasePath("/login")}
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
            href={withBasePath("/today")}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Today
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Linked Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          You sign in to MeOS with <strong>email</strong> (Clerk). Google
          Calendar is connected separately — it is not your MeOS login.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Connect one or more Google accounts to sync calendar data into MeOS.
        </p>

        {banner && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">{banner}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            {linked.length === 0 ? (
              <a
                href={googleLinkStartUrl()}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Connect Google Calendar
              </a>
            ) : (
              <>
                <a
                  href={googleLinkStartUrl()}
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Connect Google Calendar
                </a>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={atLinkedLimit}
                  onClick={() => setShowLabelModal(true)}
                >
                  Add Google account (optional label)
                </Button>
              </>
            )}
          </div>
          {atLinkedLimit && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You have reached the usual limit of {LINKED_ACCOUNT_LIMIT} linked
              accounts.{" "}
              <a
                href={NEED_MORE_ACCOUNTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium text-amber-800 dark:text-amber-300"
              >
                Open a GitHub issue
              </a>{" "}
              if you need more — we want to understand your use case.
            </p>
          )}
        </div>

        {showLabelModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-modal-title"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-5 border border-gray-200 dark:border-gray-700">
              <h2
                id="label-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
              >
                Optional label
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Leave blank to use your Google email as the display name. Max 64
                characters.
              </p>
              <input
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm mb-4"
                placeholder="e.g. Work"
                maxLength={64}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowLabelModal(false);
                    setLabelDraft("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void confirmAddWithLabel()}
                >
                  Continue to Google
                </Button>
              </div>
            </div>
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
            Pull Google Calendar into MeOS (default: last 30 days through next 30
            days, UTC). Accounts skipped if synced less than a minute ago.
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            isLoading={syncing}
            disabled={linked.length === 0}
            onClick={() => void runSyncAll()}
          >
            {linked.length > 1 ? "Sync all Google accounts" : "Sync calendar now"}
          </Button>
          {linked.length === 0 && !syncMessage && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              Connect Google Calendar above first — sync needs OAuth tokens in{" "}
              <code className="text-xs">linked_google_accounts</code>.
            </p>
          )}
          {syncMessage && (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              {syncMessage}
            </p>
          )}
          {syncDetail && (
            <pre className="mt-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {syncDetail}
            </pre>
          )}
        </div>

        <div className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Linked Google accounts
          </h2>
          {linked.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No Google accounts linked yet. Use{" "}
              <strong>Connect Google Calendar</strong> to add one (requires{" "}
              <code className="text-xs">TOKEN_ENCRYPTION_KEY</code> on the
              server).
            </p>
          ) : (
            <ul className="space-y-3">
              {linked.map((l) => {
                const labelDiffers =
                  l.account_label.trim().toLowerCase() !==
                  l.google_email.trim().toLowerCase();
                return (
                  <li
                    key={l.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {l.google_email}
                        </p>
                        {labelDiffers && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Label: {l.account_label}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          isLoading={syncingId === l.id}
                          disabled={syncing || syncingId !== null || disconnectingId !== null}
                          onClick={() => void runSyncOne(l.id)}
                        >
                          Sync this account
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 dark:text-red-400"
                          isLoading={disconnectingId === l.id}
                          disabled={disconnectingId !== null}
                          onClick={() => void disconnect(l.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-medium text-gray-900 dark:text-white">
              Imported calendar data
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calendars and events already stored in MeOS (may combine several
              linked Google accounts).
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
                Run a sync above to import your calendar data.
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
                        {account.eventCount} calendar
                        {account.eventCount !== 1 ? "s" : ""} in MeOS
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded">
                    Imported
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
