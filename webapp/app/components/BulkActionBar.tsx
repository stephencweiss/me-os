"use client";

import { useState } from "react";

interface CategorySuggestion {
  eventId: string;
  colorId: string;
  colorName: string;
  colorMeaning: string;
  confidence: number;
}

interface BulkActionBarProps {
  selectedCount: number;
  selectedEventIds: string[];
  events: Array<{ id: string; summary: string }>;
  onApplyColor: (colorId: string, syncToGoogle: boolean) => Promise<void>;
  onApplySuggestions?: (
    suggestions: Array<{ eventId: string; colorId: string }>,
    syncToGoogle: boolean
  ) => Promise<void>;
  onClearSelection: () => void;
}

const COLORS = [
  { id: "1", name: "Lavender", meaning: "1:1s / People", hex: "#7986cb" },
  { id: "2", name: "Sage", meaning: "Deep Work / Focus", hex: "#33b679" },
  { id: "3", name: "Grape", meaning: "Project Work", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", meaning: "Meetings", hex: "#e67c73" },
  { id: "5", name: "Banana", meaning: "Household / Pets", hex: "#f6bf26" },
  { id: "6", name: "Tangerine", meaning: "Family Time", hex: "#f4511e" },
  { id: "7", name: "Peacock", meaning: "Personal Projects", hex: "#039be5" },
  { id: "8", name: "Graphite", meaning: "Routines / Logistics", hex: "#616161" },
  { id: "9", name: "Blueberry", meaning: "Fitness", hex: "#3f51b5" },
  { id: "10", name: "Basil", meaning: "Social", hex: "#0b8043" },
  { id: "11", name: "Tomato", meaning: "Urgent / Blocked", hex: "#d50000" },
];

const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export default function BulkActionBar({
  selectedCount,
  selectedEventIds,
  events,
  onApplyColor,
  onApplySuggestions,
  onClearSelection,
}: BulkActionBarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [pendingColorId, setPendingColorId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applying, setApplying] = useState(false);

  if (selectedCount === 0) return null;

  const selectedEvents = events.filter((e) => selectedEventIds.includes(e.id));
  const pendingColor = pendingColorId
    ? COLORS.find((c) => c.id === pendingColorId)
    : null;

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch("/api/events/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: selectedEventIds }),
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions);
        // Auto-accept high confidence suggestions
        const autoAccepted = new Set(
          data.suggestions
            .filter((s: CategorySuggestion) => s.confidence >= 0.8)
            .map((s: CategorySuggestion) => s.eventId)
        );
        setAcceptedSuggestions(autoAccepted);
        setShowSuggestionsModal(true);
      }
    } catch (err) {
      console.error("Failed to get suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleColorSelect = (colorId: string) => {
    setPendingColorId(colorId);
    setShowColorPicker(false);
    setShowConfirmation(true);
  };

  const toggleSuggestionAccepted = (eventId: string) => {
    setAcceptedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleApplyAcceptedSuggestions = async (syncToGoogle: boolean) => {
    if (!onApplySuggestions) return;

    const toApply = suggestions
      .filter((s) => acceptedSuggestions.has(s.eventId))
      .map((s) => ({ eventId: s.eventId, colorId: s.colorId }));

    if (toApply.length === 0) return;

    setApplying(true);
    try {
      await onApplySuggestions(toApply, syncToGoogle);
      setShowSuggestionsModal(false);
      setSuggestions([]);
      setAcceptedSuggestions(new Set());
      onClearSelection();
    } catch (err) {
      console.error("Failed to apply suggestions:", err);
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmApply = async (syncToGoogle: boolean) => {
    if (!pendingColorId) return;
    setApplying(true);
    try {
      await onApplyColor(pendingColorId, syncToGoogle);
      setShowConfirmation(false);
      setPendingColorId(null);
      onClearSelection();
    } catch (err) {
      console.error("Failed to apply color:", err);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedCount} event{selectedCount !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={onClearSelection}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Get Suggestions Button */}
              <button
                onClick={handleGetSuggestions}
                disabled={loadingSuggestions}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {loadingSuggestions ? "Loading..." : "Get Suggestions"}
              </button>

              {/* Show Suggestions if available */}
              {suggestions.length > 0 && (
                <button
                  onClick={() => setShowSuggestionsModal(true)}
                  className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                >
                  Review {suggestions.length} Suggestions
                </button>
              )}

              {/* Apply Color Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  Apply Color
                  <svg
                    className={`w-4 h-4 transition-transform ${showColorPicker ? "rotate-180" : ""}`}
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

                {/* Color Picker Dropdown */}
                {showColorPicker && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 max-h-80 overflow-y-auto">
                    {COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => handleColorSelect(color.id)}
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {color.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {color.meaning}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingColor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Apply Color to {selectedCount} Event{selectedCount !== 1 ? "s" : ""}
              </h3>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: pendingColor.hex }}
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {pendingColor.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {pendingColor.meaning}
                  </div>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 mb-4">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="text-sm text-gray-700 dark:text-gray-300 py-1 truncate"
                  >
                    • {event.summary}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-2">
              <button
                onClick={() => handleConfirmApply(true)}
                disabled={applying}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {applying ? "Applying..." : "Apply to Local + Google Calendar"}
              </button>
              <button
                onClick={() => handleConfirmApply(false)}
                disabled={applying}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Apply to Local Only
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setPendingColorId(null);
                }}
                disabled={applying}
                className="w-full px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Review Modal */}
      {showSuggestionsModal && suggestions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Review Category Suggestions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {acceptedSuggestions.size} of {suggestions.length} suggestions selected
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {suggestions.map((suggestion) => {
                  const event = events.find((e) => e.id === suggestion.eventId);
                  const color = COLOR_MAP[suggestion.colorId];
                  const isAccepted = acceptedSuggestions.has(suggestion.eventId);
                  const confidencePercent = Math.round(suggestion.confidence * 100);

                  return (
                    <div
                      key={suggestion.eventId}
                      onClick={() => toggleSuggestionAccepted(suggestion.eventId)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isAccepted
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isAccepted}
                          onChange={() => toggleSuggestionAccepted(suggestion.eventId)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {event?.summary || "Unknown Event"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color?.hex || "#999" }}
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {suggestion.colorMeaning || suggestion.colorName}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              ({color?.name})
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              confidencePercent >= 80
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : confidencePercent >= 50
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {confidencePercent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setAcceptedSuggestions(new Set(suggestions.map((s) => s.eventId)))}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={() => setAcceptedSuggestions(new Set())}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleApplyAcceptedSuggestions(true)}
                  disabled={applying || acceptedSuggestions.size === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying
                    ? "Applying..."
                    : `Apply ${acceptedSuggestions.size} to Local + Google`}
                </button>
                <button
                  onClick={() => handleApplyAcceptedSuggestions(false)}
                  disabled={applying || acceptedSuggestions.size === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply {acceptedSuggestions.size} to Local Only
                </button>
                <button
                  onClick={() => {
                    setShowSuggestionsModal(false);
                  }}
                  disabled={applying}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from being hidden behind the action bar */}
      <div className="h-16" />
    </>
  );
}
