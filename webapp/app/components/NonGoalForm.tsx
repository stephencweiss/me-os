"use client";

import { useState, useEffect, useRef } from "react";

interface NonGoalFormProps {
  weekId: string;
  onSave: (data: {
    title: string;
    pattern: string | null;
    reason: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function NonGoalForm({
  weekId,
  onSave,
  onCancel,
  isSubmitting,
}: NonGoalFormProps) {
  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Focus title input on mount
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Validate regex pattern
  useEffect(() => {
    if (pattern.trim()) {
      try {
        new RegExp(pattern);
        setPatternError(null);
      } catch {
        setPatternError("Invalid regular expression");
      }
    } else {
      setPatternError(null);
    }
  }, [pattern]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || patternError) return;

    await onSave({
      title: title.trim(),
      pattern: pattern.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Anti-Pattern
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-medium">{weekId}</span>
            <span className="mx-1">·</span>
            <span>Define something you want to avoid this week</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="nongoal-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                id="nongoal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="What do you want to avoid?"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                e.g., &quot;Excessive meetings&quot;, &quot;Context switching&quot;, &quot;Working late&quot;
              </p>
            </div>

            {/* Pattern */}
            <div>
              <label
                htmlFor="nongoal-pattern"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Detection Pattern
              </label>
              <input
                type="text"
                id="nongoal-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                  patternError
                    ? "border-red-500 dark:border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="e.g., sync|standup|check-in"
              />
              {patternError ? (
                <p className="mt-1 text-xs text-red-500">{patternError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Regex pattern to match calendar events. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">|</code> for &quot;or&quot; (e.g., <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">sync|standup</code> matches both). Leave empty to skip auto-detection.
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label
                htmlFor="nongoal-reason"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Why avoid this?
              </label>
              <textarea
                id="nongoal-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="e.g., Leaves no time for deep work"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !!patternError}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Adding...
                </>
              ) : (
                "Add Anti-Pattern"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
