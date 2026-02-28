"use client";

import { useState, useRef, useEffect } from "react";

interface FilterBarProps {
  accounts: string[];
  calendars: { calendar_name: string; account: string }[];
  selectedAccounts: string[];
  selectedCalendars: string[];
  onAccountsChange: (accounts: string[]) => void;
  onCalendarsChange: (calendars: string[]) => void;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  groupBy,
}: {
  label: string;
  options: { value: string; label: string; group?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  groupBy?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // Group options if needed
  const groupedOptions = groupBy
    ? options.reduce(
        (acc, opt) => {
          const group = opt.group || "Other";
          if (!acc[group]) acc[group] = [];
          acc[group].push(opt);
          return acc;
        },
        {} as Record<string, typeof options>
      )
    : { "": options };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        {selected.length > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
            {selected.length}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {/* Select All / Clear */}
          <div className="flex justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={() => onChange(options.map((o) => o.value))}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Select all
            </button>
            <button
              onClick={() => onChange([])}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="py-1">
            {Object.entries(groupedOptions).map(([group, opts]) => (
              <div key={group}>
                {group && groupBy && (
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {group}
                  </div>
                )}
                {opts.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => toggleOption(opt.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  accounts,
  calendars,
  selectedAccounts,
  selectedCalendars,
  onAccountsChange,
  onCalendarsChange,
}: FilterBarProps) {
  const accountOptions = accounts.map((a) => ({ value: a, label: a }));

  const calendarOptions = calendars.map((c) => ({
    value: c.calendar_name,
    label: c.calendar_name,
    group: c.account,
  }));

  const hasFilters = selectedAccounts.length > 0 || selectedCalendars.length > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm text-gray-500 dark:text-gray-400">Filter by:</span>

      <MultiSelect
        label="Accounts"
        options={accountOptions}
        selected={selectedAccounts}
        onChange={onAccountsChange}
      />

      <MultiSelect
        label="Calendars"
        options={calendarOptions}
        selected={selectedCalendars}
        onChange={onCalendarsChange}
        groupBy
      />

      {hasFilters && (
        <button
          onClick={() => {
            onAccountsChange([]);
            onCalendarsChange([]);
          }}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
