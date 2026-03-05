"use client";

import { useState, useEffect, useCallback } from "react";
import GoalForm from "./GoalForm";

// Color mapping from colorId to hex color (matching Google Calendar colors)
const COLOR_MAP: Record<string, string> = {
  "1": "#7986cb", // Lavender
  "2": "#33b679", // Sage
  "3": "#8e24aa", // Grape
  "4": "#e67c73", // Flamingo
  "5": "#f6bf26", // Banana
  "6": "#f4511e", // Tangerine
  "7": "#039be5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3f51b5", // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d50000", // Tomato
  default: "#9e9e9e", // Default gray
};

interface Goal {
  id: string;
  things3_id: string;
  week_id: string;
  title: string;
  notes: string | null;
  estimated_minutes: number | null;
  goal_type: "time" | "outcome" | "habit";
  color_id: string | null;
  status: "active" | "completed" | "cancelled";
  progress_percent: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  totalMinutesLogged: number;
}

interface NonGoal {
  id: string;
  week_id: string;
  title: string;
  pattern: string;
  color_id: string | null;
  reason: string | null;
  active: number;
  created_at: string;
}

interface Alert {
  id: number;
  non_goal_id: string;
  event_id: string;
  detected_at: string;
  acknowledged: number;
}

interface GoalsResponse {
  goals: Goal[];
  count: number;
  weekId: string;
}

interface NonGoalsResponse {
  nonGoals: NonGoal[];
  alerts: Alert[];
  count: number;
  alertCount: number;
  weekId: string;
}

function getCurrentWeekId(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekDateRange(weekId: string): { start: string; end: string; display: string } {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { start: "", end: "", display: weekId };

  const year = parseInt(match[1]);
  const week = parseInt(match[2]);

  // Calculate first day of the week (Monday)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const formatDisplay = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    start: formatDate(weekStart),
    end: formatDate(weekEnd),
    display: `${formatDisplay(weekStart)} - ${formatDisplay(weekEnd)}`,
  };
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function renderProgressBar(percent: number, colorId: string | null): React.ReactNode {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const color = colorId ? COLOR_MAP[colorId] || COLOR_MAP.default : COLOR_MAP.default;

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
      <div
        className="h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${clampedPercent}%`, backgroundColor: color }}
      />
    </div>
  );
}

function getStatusIcon(goal: Goal): string {
  if (goal.status === "completed") return "✅";
  if (goal.status === "cancelled") return "❌";
  if (goal.progress_percent >= 80) return "✅";
  if (goal.progress_percent >= 50) return "🔄";
  return "⚠️";
}

function getStatusText(goal: Goal): string {
  if (goal.status === "completed") return "Completed";
  if (goal.status === "cancelled") return "Cancelled";
  if (goal.progress_percent >= 80) return "On track";
  if (goal.progress_percent >= 50) return "In progress";
  return "At risk";
}

export default function WeeklyGoals() {
  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [nonGoals, setNonGoals] = useState<NonGoal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weekRange = getWeekDateRange(weekId);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [goalsRes, nonGoalsRes] = await Promise.all([
        fetch(`/api/goals?week=${weekId}`),
        fetch(`/api/non-goals?week=${weekId}`),
      ]);

      if (!goalsRes.ok || !nonGoalsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [goalsData, nonGoalsData]: [GoalsResponse, NonGoalsResponse] =
        await Promise.all([goalsRes.json(), nonGoalsRes.json()]);

      setGoals(goalsData.goals);
      setNonGoals(nonGoalsData.nonGoals);
      setAlerts(nonGoalsData.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(goalId: string, status: "active" | "completed" | "cancelled") {
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, status }),
      });

      if (!res.ok) throw new Error("Failed to update goal");

      // Update local state
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, status, progress_percent: status === "completed" ? 100 : g.progress_percent }
            : g
        )
      );
    } catch (err) {
      console.error("Error updating goal:", err);
    }
  }

  async function handleAcknowledgeAlert(alertId: number) {
    try {
      const res = await fetch("/api/non-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });

      if (!res.ok) throw new Error("Failed to acknowledge alert");

      // Remove from local state
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    }
  }

  function handleOpenCreateForm() {
    setEditingGoal(null);
    setShowForm(true);
  }

  function handleOpenEditForm(goal: Goal) {
    setEditingGoal(goal);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingGoal(null);
  }

  async function handleSaveGoal(data: {
    title: string;
    notes: string | null;
    estimatedMinutes: number | null;
    goalType: "time" | "outcome" | "habit";
    colorId: string | null;
    syncToThings3: boolean;
  }) {
    setIsSubmitting(true);

    try {
      if (editingGoal) {
        // Update existing goal
        const res = await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalId: editingGoal.id,
            title: data.title,
            notes: data.notes,
            estimatedMinutes: data.estimatedMinutes,
            goalType: data.goalType,
            colorId: data.colorId,
          }),
        });

        if (!res.ok) throw new Error("Failed to update goal");

        const result = await res.json();

        // Update local state
        setGoals((prev) =>
          prev.map((g) =>
            g.id === editingGoal.id
              ? { ...g, ...result.goal, totalMinutesLogged: g.totalMinutesLogged }
              : g
          )
        );
      } else {
        // Create new goal
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekId,
            title: data.title,
            notes: data.notes,
            estimatedMinutes: data.estimatedMinutes,
            goalType: data.goalType,
            colorId: data.colorId,
            syncToThings3: data.syncToThings3,
          }),
        });

        if (!res.ok) throw new Error("Failed to create goal");

        const result = await res.json();

        // Open Things 3 if URL returned
        if (result.things3Url) {
          window.open(result.things3Url, "_blank");
        }

        // Add to local state
        setGoals((prev) => [...prev, { ...result.goal, totalMinutesLogged: 0 }]);
      }

      handleCloseForm();
    } catch (err) {
      console.error("Error saving goal:", err);
      alert(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setIsSubmitting(false);
    }
  }

  function navigateWeek(direction: number) {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return;

    let year = parseInt(match[1]);
    let week = parseInt(match[2]) + direction;

    // Handle year boundaries
    if (week < 1) {
      year--;
      week = 52; // Simplified; actual week count varies
    } else if (week > 52) {
      year++;
      week = 1;
    }

    setWeekId(`${year}-W${String(week).padStart(2, "0")}`);
  }

  // Summary stats
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress_percent, 0) / activeGoals.length)
    : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="text-red-500">Error loading goals: {error}</div>
        <button
          onClick={fetchData}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Weekly Goals
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center min-w-[180px]">
              <div className="font-medium text-gray-900 dark:text-white">{weekId}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{weekRange.display}</div>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next week"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {weekId !== getCurrentWeekId() && (
              <button
                onClick={() => setWeekId(getCurrentWeekId())}
                className="ml-2 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={handleOpenCreateForm}
              className="ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Goal
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeGoals.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Goals</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {completedGoals.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgProgress}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Progress</div>
          </div>
        </div>
      </div>

      {/* Non-Goal Alerts */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              {alerts.length} Non-Goal Alert{alerts.length !== 1 ? "s" : ""}
            </h3>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => {
              const nonGoal = nonGoals.find((ng) => ng.id === alert.non_goal_id);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {nonGoal?.title || "Unknown pattern"}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Event: {alert.event_id}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">Goals</h3>
        </div>

        {goals.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No goals for this week yet.
            </p>
            <button
              onClick={handleOpenCreateForm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first goal
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {goals.map((goal) => (
              <div key={goal.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {goal.color_id && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: COLOR_MAP[goal.color_id] || COLOR_MAP.default,
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{goal.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {goal.goal_type === "time" && goal.estimated_minutes
                          ? `${formatMinutes(goal.totalMinutesLogged)} / ${formatMinutes(goal.estimated_minutes)}`
                          : goal.goal_type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {getStatusIcon(goal)} {getStatusText(goal)}
                    </span>
                    <button
                      onClick={() => handleOpenEditForm(goal)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Edit goal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    {goal.status === "active" && (
                      <button
                        onClick={() => handleStatusChange(goal.id, "completed")}
                        className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">{renderProgressBar(goal.progress_percent, goal.color_id)}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                    {goal.progress_percent}%
                  </div>
                </div>
                {goal.notes && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{goal.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Non-Goals Section */}
      {nonGoals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Anti-Patterns to Avoid</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {nonGoals.map((ng) => (
              <div key={ng.id} className="p-4">
                <div className="font-medium text-gray-900 dark:text-white">{ng.title}</div>
                {ng.reason && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ng.reason}</div>
                )}
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                  Pattern: {ng.pattern}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Form Modal */}
      {showForm && (
        <GoalForm
          weekId={weekId}
          editingGoal={editingGoal}
          onSave={handleSaveGoal}
          onCancel={handleCloseForm}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
