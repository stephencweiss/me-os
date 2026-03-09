"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface LinkedAccount {
  id: string;
  googleEmail: string;
  displayName: string | null;
  accountLabel: string;
  hasRefreshToken: boolean;
  tokenExpiry: string | null;
  scopes: string;
  createdAt: string;
  updatedAt: string;
}

function AccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkingLabel, setLinkingLabel] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const successMsg = searchParams.get("success");
    const errorMsg = searchParams.get("error");

    if (successMsg) {
      setSuccess(successMsg);
      // Clear the URL params
      window.history.replaceState({}, "", "/settings/accounts");
    }
    if (errorMsg) {
      setError(errorMsg);
      window.history.replaceState({}, "", "/settings/accounts");
    }
  }, [searchParams]);

  // Fetch linked accounts
  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const response = await fetch("/api/google/accounts");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!linkingLabel.trim()) {
      setError("Please enter an account label");
      return;
    }

    setIsLinking(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/google/link?label=${encodeURIComponent(linkingLabel.trim())}`
      );
      if (!response.ok) {
        throw new Error("Failed to start linking process");
      }
      const data = await response.json();

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link account");
      setIsLinking(false);
    }
  }

  async function handleUnlinkAccount(accountId: string) {
    if (!confirm("Are you sure you want to unlink this account?")) {
      return;
    }

    try {
      const response = await fetch("/api/google/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error("Failed to unlink account");
      }

      setSuccess("Account unlinked successfully");
      fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink account");
    }
  }

  return (
    <>
      {/* Success/Error messages */}
      {success && (
        <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded mb-6">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="float-right text-green-400 hover:text-green-300"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-400 hover:text-red-300"
          >
            &times;
          </button>
        </div>
      )}

      {/* Link new account form */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Link New Account</h2>
        <form onSubmit={handleLinkAccount} className="flex gap-4">
          <input
            type="text"
            value={linkingLabel}
            onChange={(e) => setLinkingLabel(e.target.value)}
            placeholder="Account label (e.g., personal, work)"
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLinking}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded transition-colors"
          >
            {isLinking ? "Linking..." : "Link Account"}
          </button>
        </form>
        <p className="text-gray-400 text-sm mt-2">
          This will redirect you to Google to authorize calendar access.
        </p>
      </div>

      {/* Linked accounts list */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Your Accounts ({accounts.length})
        </h2>

        {loading ? (
          <div className="text-gray-400">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="text-gray-400">
            No Google accounts linked yet. Link an account above to get
            started.
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-lg">
                      {account.googleEmail}
                    </span>
                    <span className="bg-blue-600/30 text-blue-300 text-xs px-2 py-1 rounded">
                      {account.accountLabel}
                    </span>
                  </div>
                  {account.displayName && (
                    <div className="text-gray-400 text-sm mt-1">
                      {account.displayName}
                    </div>
                  )}
                  <div className="text-gray-500 text-xs mt-2">
                    Linked {new Date(account.createdAt).toLocaleDateString()}
                    {!account.hasRefreshToken && (
                      <span className="text-yellow-500 ml-2">
                        (May need re-authorization)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleUnlinkAccount(account.id)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium"
                >
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="mt-8 text-gray-500 text-sm">
        <h3 className="font-medium text-gray-400 mb-2">About Account Linking</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Link multiple Google accounts to sync calendars from different
            sources
          </li>
          <li>
            Use descriptive labels (e.g., &quot;personal&quot;, &quot;work&quot;) to identify accounts
          </li>
          <li>
            Calendar events will be synced from all linked accounts
          </li>
          <li>
            Color changes made in the app will sync back to Google Calendar
          </li>
        </ul>
      </div>
    </>
  );
}

export default function AccountsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8">Linked Google Accounts</h1>

        <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
          <AccountsContent />
        </Suspense>
      </div>
    </div>
  );
}
