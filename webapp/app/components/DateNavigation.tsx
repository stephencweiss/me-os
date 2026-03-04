"use client";

import { useRef } from "react";
import { formatDisplayDate, formatDate } from "@/lib/format";

interface DateNavigationProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export default function DateNavigation({
  selectedDate,
  onChange,
}: DateNavigationProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    onChange(prev);
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    onChange(next);
  };

  const goToToday = () => {
    onChange(new Date());
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + "T12:00:00");
    if (!isNaN(newDate.getTime())) {
      onChange(newDate);
    }
  };

  const openDatePicker = () => {
    dateInputRef.current?.showPicker();
  };

  const isToday = formatDate(selectedDate) === formatDate(new Date());

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        {/* Previous Day Button */}
        <button
          onClick={goToPreviousDay}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Previous day"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Date Display (clickable to open picker) */}
        <button
          onClick={openDatePicker}
          className="px-4 py-2 text-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Select date"
        >
          {formatDisplayDate(selectedDate)}
        </button>

        {/* Hidden date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={formatDate(selectedDate)}
          onChange={handleDateInputChange}
          className="sr-only"
          aria-hidden="true"
        />

        {/* Next Day Button */}
        <button
          onClick={goToNextDay}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Next day"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Today Button (only show if not already on today) */}
      {!isToday && (
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}
