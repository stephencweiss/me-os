import { redirect } from "next/navigation";
import WeekOverview from "@/app/components/WeekOverview";
import {
  parseWeekRangeDays,
  weekRangeSearchParamNeedsRedirect,
} from "@/lib/week-range";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const days = parseWeekRangeDays(sp.range);
  if (weekRangeSearchParamNeedsRedirect(sp.range, days)) {
    redirect(`/week?range=${days}`);
  }
  return <WeekOverview days={days} />;
}
