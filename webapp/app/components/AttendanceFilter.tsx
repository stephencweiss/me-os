"use client";

export type AttendanceStatus = "attended" | "skipped" | "unknown";

interface AttendanceFilterProps {
  selected: AttendanceStatus[];
  onChange: (selected: AttendanceStatus[]) => void;
}

const FILTER_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  {
    value: "attended",
    label: "Attended",
    activeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700",
  },
  {
    value: "skipped",
    label: "Skipped",
    activeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700",
  },
  {
    value: "unknown",
    label: "Unknown",
    activeClass: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
  },
];

export default function AttendanceFilter({ selected, onChange }: AttendanceFilterProps) {
  const toggleFilter = (status: AttendanceStatus) => {
    if (selected.includes(status)) {
      // Remove if already selected (but keep at least one? or allow empty?)
      onChange(selected.filter((s) => s !== status));
    } else {
      // Add to selection
      onChange([...selected, status]);
    }
  };

  const allSelected = selected.length === 0 || selected.length === 3;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Filter:</span>

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

      {FILTER_OPTIONS.map((option) => {
        const isActive = selected.includes(option.value);
        return (
          <button
            key={option.value}
            onClick={() => toggleFilter(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              isActive
                ? option.activeClass
                : "bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
