"use client";

import { useState, useEffect, useRef } from "react";
import { COLOR_OPTIONS } from "./ColorPicker";

interface Goal {
  id: string;
  title: string;
  notes: string | null;
  estimated_minutes: number | null;
  goal_type: "time" | "outcome" | "habit";
  color_id: string | null;
}

interface GoalFormProps {
  weekId: string;
  editingGoal?: Goal | null;
  onSave: (data: {
    title: string;
    notes: string | null;
    estimatedMinutes: number | null;
    goalType: "time" | "outcome" | "habit";
    colorId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function GoalForm({
  weekId,
  editingGoal,
  onSave,
  onCancel,
  isSubmitting,
}: GoalFormProps) {
  const [title, setTitle] = useState(editingGoal?.title || "");
  const [notes, setNotes] = useState(editingGoal?.notes || "");
  const [hours, setHours] = useState(
    editingGoal?.estimated_minutes ? Math.floor(editingGoal.estimated_minutes / 60) : 0
  );
  const [minutes, setMinutes] = useState(
    editingGoal?.estimated_minutes ? editingGoal.estimated_minutes % 60 : 0
  );
  const [goalType, setGoalType] = useState<"time" | "outcome" | "habit">(
    editingGoal?.goal_type || "outcome"
  );
  const [colorId, setColorId] = useState<string | null>(editingGoal?.color_id || null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Focus title input on mount
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColorPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const estimatedMinutes = hours * 60 + minutes;

    await onSave({
      title: title.trim(),
      notes: notes.trim() || null,
      estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : null,
      goalType,
      colorId,
    });
  };

  const selectedColor = colorId ? COLOR_OPTIONS.find((c) => c.id === colorId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingGoal ? "Edit Goal" : "Create Weekly Goal"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {editingGoal ? (
              weekId
            ) : (
              <>
                <span className="font-medium">{weekId}</span>
                <span className="mx-1">·</span>
                <span>Set a goal to accomplish by the end of this week</span>
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Goal Type - First field */}
            <div className={goalType === "time" ? "grid grid-cols-2 gap-4" : ""}>
              <div>
                <label
                  htmlFor="goalType"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Goal Type
                </label>
                <select
                  id="goalType"
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as "time" | "outcome" | "habit")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="outcome">Outcome</option>
                  <option value="time">Time-based</option>
                  <option value="habit">Habit</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {goalType === "outcome" && "e.g., \"Finish the API spec\", \"Ship feature X\""}
                  {goalType === "time" && "e.g., \"4 hours of deep work\", \"2h reading\""}
                  {goalType === "habit" && "e.g., \"Write 4x this week\", \"Exercise daily\""}
                </p>
              </div>

              {/* Time Goal - only shown for time-based goals */}
              {goalType === "time" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Goal
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        value={hours}
                        onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                        h
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) =>
                          setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))
                        }
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                        m
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  goalType === "outcome"
                    ? "What do you want to accomplish?"
                    : goalType === "time"
                      ? "What will you spend time on?"
                      : "What habit will you build?"
                }
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Additional details..."
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-full flex items-center gap-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {selectedColor ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedColor.hex }}
                      />
                      <span className="text-gray-900 dark:text-white">{selectedColor.meaning}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-300 dark:bg-gray-500" />
                      <span className="text-gray-500 dark:text-gray-400">Select a color...</span>
                    </>
                  )}
                </button>

                {showColorPicker && (
                  <div className="absolute left-0 top-full mt-1 z-10 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-60 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setColorId(null);
                        setShowColorPicker(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-500" />
                      <span className="text-gray-500 dark:text-gray-400">No color</span>
                    </button>
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => {
                          setColorId(color.id);
                          setShowColorPicker(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          color.id === colorId ? "bg-gray-100 dark:bg-gray-700" : ""
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex-1">
                          <span className="text-gray-900 dark:text-white">{color.meaning}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            ({color.name})
                          </span>
                        </div>
                        {color.id === colorId && (
                          <span className="text-blue-600 dark:text-blue-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
              disabled={isSubmitting || !title.trim()}
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
                  Saving...
                </>
              ) : editingGoal ? (
                "Save Changes"
              ) : (
                "Create Goal"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
