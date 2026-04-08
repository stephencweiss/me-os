import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import type {
  CalendarSyncCalendarError,
  CalendarSyncStats,
} from "@/lib/calendar-sync-supabase";
import { runCalendarSync } from "@/lib/calendar-sync-supabase";
import {
  getLinkedAccountById,
  getLinkedAccountsForUser,
} from "@/lib/linked-google-accounts";
import { withCalendarSyncLock } from "@/lib/sync-lock";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

const SKIP_WINDOW_MS = 60_000;

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default sync window: UTC today −30 … today +30 (inclusive calendar days). */
function defaultSyncDateRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayUtc = new Date(Date.UTC(y, m, d));
  const start = new Date(todayUtc);
  start.setUTCDate(start.getUTCDate() - 30);
  const end = new Date(todayUtc);
  end.setUTCDate(end.getUTCDate() + 30);
  return { start: utcDateString(start), end: utcDateString(end) };
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function emptyStats(): CalendarSyncStats {
  return {
    fetched: 0,
    upserted: 0,
    markedRemoved: 0,
    calendarsProcessed: 0,
    autoCategorized: 0,
  };
}

function mergeStats(a: CalendarSyncStats, b: CalendarSyncStats): CalendarSyncStats {
  return {
    fetched: a.fetched + b.fetched,
    upserted: a.upserted + b.upserted,
    markedRemoved: a.markedRemoved + b.markedRemoved,
    calendarsProcessed: a.calendarsProcessed + b.calendarsProcessed,
    autoCategorized: a.autoCategorized + b.autoCategorized,
  };
}

function withinSkipWindow(lastSyncCompletedAt: string | null): boolean {
  if (!lastSyncCompletedAt) return false;
  const t = new Date(lastSyncCompletedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < SKIP_WINDOW_MS;
}

function prefixCalendarErrors(
  errors: CalendarSyncCalendarError[],
  prefix: string
): CalendarSyncCalendarError[] {
  return errors.map((e) => ({
    ...e,
    calendarSummary: `${prefix}: ${e.calendarSummary}`,
  }));
}

export type PerAccountSyncResult = {
  linkedAccountId: string;
  googleEmail?: string;
  skipped?: boolean;
  skipReason?: string;
  message?: string;
  lastSyncCompletedAt?: string | null;
  stats?: CalendarSyncStats;
  errors?: CalendarSyncCalendarError[];
  fatalError?: string;
};

/**
 * POST /api/calendar/sync
 *
 * Body (optional JSON):
 * - `{ start?, end?, linkedAccountId? }` — sync one account (defaults to first linked row, same order as GET /api/calendar/linked).
 * - `{ all: true, start?, end? }` — sync every linked account sequentially; per-account skip if last sync &lt; 1 minute ago.
 *
 * Skip (single account): 200 + `{ ok: true, skipped: true, skipReason: "recent", ... }`.
 * Multi-account: `{ accounts: PerAccountSyncResult[], stats: merged, errors: merged }`.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      start?: string;
      end?: string;
      linkedAccountId?: string;
      all?: boolean;
    } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const range = defaultSyncDateRange();
    const start = body.start ?? range.start;
    const end = body.end ?? range.end;

    if (!isIsoDate(start) || !isIsoDate(end)) {
      return NextResponse.json(
        { error: "start and end must be YYYY-MM-DD when provided" },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: "start must be on or before end" },
        { status: 400 }
      );
    }

    const linked = await getLinkedAccountsForUser(userId);
    if (linked.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No linked Google account with Calendar tokens. In Settings → Linked Accounts, use “Connect Google Calendar” and complete consent (offline access).",
        },
        { status: 400 }
      );
    }

    const syncAll = body.all === true;

    if (syncAll) {
      const locked = await withCalendarSyncLock(userId, async () => {
        const accounts: PerAccountSyncResult[] = [];
        let mergedStats = emptyStats();
        const mergedErrors: CalendarSyncCalendarError[] = [];

        for (const acc of linked) {
          const prefix = acc.google_email || acc.id;
          if (withinSkipWindow(acc.last_sync_completed_at ?? null)) {
            accounts.push({
              linkedAccountId: acc.id,
              googleEmail: acc.google_email,
              skipped: true,
              skipReason: "recent",
              message: "Skipped — synced less than a minute ago.",
              lastSyncCompletedAt: acc.last_sync_completed_at,
            });
            continue;
          }

          try {
            const { stats, errors } = await runCalendarSync({
              userId,
              linkedAccountId: acc.id,
              startDate: start,
              endDate: end,
            });
            mergedStats = mergeStats(mergedStats, stats);
            mergedErrors.push(...prefixCalendarErrors(errors, prefix));
            accounts.push({
              linkedAccountId: acc.id,
              googleEmail: acc.google_email,
              stats,
              errors,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            accounts.push({
              linkedAccountId: acc.id,
              googleEmail: acc.google_email,
              fatalError: msg,
            });
          }
        }

        const allSkipped =
          accounts.length > 0 && accounts.every((a) => a.skipped);
        const anySuccess =
          mergedStats.calendarsProcessed > 0 || mergedStats.upserted > 0;
        const anyFatal = accounts.some((a) => a.fatalError);
        const ok =
          allSkipped ||
          anySuccess ||
          (!anyFatal && mergedErrors.length === 0);

        return {
          accounts,
          mergedStats,
          mergedErrors,
          ok,
        };
      });

      if (!locked.ok) {
        return NextResponse.json(
          { ok: false, error: "Calendar sync already running for this user" },
          { status: 409 }
        );
      }

      const { accounts, mergedStats, mergedErrors, ok } = locked.value;
      return NextResponse.json(
        {
          ok,
          stats: mergedStats,
          errors: mergedErrors,
          dateRange: { start, end },
          accounts,
        },
        { status: 200 }
      );
    }

    const linkedAccountId = body.linkedAccountId ?? linked[0]!.id;
    if (!linked.some((l) => l.id === linkedAccountId)) {
      return NextResponse.json(
        { error: "linkedAccountId not found for user" },
        { status: 400 }
      );
    }

    const row = await getLinkedAccountById(userId, linkedAccountId);
    if (!row) {
      return NextResponse.json(
        { error: "linkedAccountId not found for user" },
        { status: 400 }
      );
    }

    if (withinSkipWindow(row.last_sync_completed_at ?? null)) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          skipReason: "recent",
          message: "Skipped — synced less than a minute ago.",
          lastSyncCompletedAt: row.last_sync_completed_at,
          stats: emptyStats(),
          errors: [],
          dateRange: { start, end },
        },
        { status: 200 }
      );
    }

    const locked = await withCalendarSyncLock(userId, async () => {
      return runCalendarSync({
        userId,
        linkedAccountId,
        startDate: start,
        endDate: end,
      });
    });

    if (!locked.ok) {
      return NextResponse.json(
        { ok: false, error: "Calendar sync already running for this user" },
        { status: 409 }
      );
    }

    const { stats, errors } = locked.value;
    const anySuccess = stats.calendarsProcessed > 0 || stats.upserted > 0;

    return NextResponse.json(
      {
        ok: anySuccess || errors.length === 0,
        stats,
        errors,
        dateRange: { start, end },
      },
      { status: 200 }
    );
  });
}
