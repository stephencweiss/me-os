import WeeklyGoals from "../../components/WeeklyGoals";

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Goals
      </h1>
      <WeeklyGoals />
    </div>
  );
}
