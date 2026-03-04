"use client";

interface AccountFilterProps {
  accounts: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function AccountFilter({
  accounts,
  selected,
  onChange,
}: AccountFilterProps) {
  const toggleAccount = (account: string) => {
    if (selected.includes(account)) {
      onChange(selected.filter((a) => a !== account));
    } else {
      onChange([...selected, account]);
    }
  };

  // "All" is active when no accounts are selected or all accounts are selected
  const allSelected = selected.length === 0 || selected.length === accounts.length;

  if (accounts.length <= 1) {
    // Don't show filter if only one account
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
        Account:
      </span>

      {/* All button */}
      <button
        onClick={() => onChange([])}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
          allSelected
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700"
            : "bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        All
      </button>

      {accounts.map((account) => {
        const isActive = selected.includes(account);
        // Extract account name from email for display (before @)
        const displayName = account.includes("@")
          ? account.split("@")[0]
          : account;

        return (
          <button
            key={account}
            onClick={() => toggleAccount(account)}
            title={account}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors truncate max-w-[150px] ${
              isActive
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700"
                : "bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {displayName}
          </button>
        );
      })}
    </div>
  );
}
