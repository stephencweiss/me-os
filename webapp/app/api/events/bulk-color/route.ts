import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import { updateEventColor, getEventById, COLOR_DEFINITIONS } from "@/lib/db-unified";
import { updateGoogleEventColor, isGoogleSyncConfigured } from "@/lib/google-calendar-client";

interface ColorUpdate {
  eventId: string;
  colorId: string;
}

interface UpdateResult {
  eventId: string;
  success: boolean;
  googleSynced: boolean;
  error?: string;
  warning?: string;
}

/**
 * POST /api/events/bulk-color
 *
 * Apply color changes to multiple events in one request.
 *
 * Body:
 *   - updates: Array<{ eventId: string; colorId: string }>
 *   - syncToGoogle: boolean - Whether to sync changes to Google Calendar
 *
 * Response:
 *   - success: boolean
 *   - updated: number - Number of events successfully updated
 *   - googleSynced: number - Number of events synced to Google Calendar
 *   - results: Array of individual update results
 *   - errors: Array of errors (for partial failures)
 */
export async function POST(request: NextRequest) {
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { updates, syncToGoogle } = body as {
      updates: ColorUpdate[];
      syncToGoogle: boolean;
    };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        googleSynced: 0,
        results: [],
        errors: [],
      });
    }

    // Limit batch size
    if (updates.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 events per request" },
        { status: 400 }
      );
    }

    const results: UpdateResult[] = [];
    const errors: Array<{ eventId: string; error: string }> = [];
    let updatedCount = 0;
    let googleSyncedCount = 0;

    const googleSyncEnabled = isGoogleSyncConfigured();

    for (const update of updates) {
      const { eventId, colorId } = update;

      // Validate colorId
      if (!COLOR_DEFINITIONS[colorId]) {
        errors.push({ eventId, error: `Invalid colorId: ${colorId}` });
        results.push({
          eventId,
          success: false,
          googleSynced: false,
          error: `Invalid colorId: ${colorId}`,
        });
        continue;
      }

      try {
        // Get event to check it exists and get Google Calendar info
        const existingEvent = await getEventById(userId, eventId);
        if (!existingEvent) {
          errors.push({ eventId, error: "Event not found" });
          results.push({
            eventId,
            success: false,
            googleSynced: false,
            error: "Event not found",
          });
          continue;
        }

        // Update local database
        const updatedEvent = await updateEventColor(userId, eventId, colorId);
        if (!updatedEvent) {
          errors.push({ eventId, error: "Failed to update in database" });
          results.push({
            eventId,
            success: false,
            googleSynced: false,
            error: "Failed to update in database",
          });
          continue;
        }

        updatedCount++;
        let googleSynced = false;
        let warning: string | undefined;

        // Sync to Google Calendar if requested and configured
        if (syncToGoogle && googleSyncEnabled && existingEvent.google_event_id) {
          try {
            const googleResult = await updateGoogleEventColor(
              existingEvent.google_event_id,
              existingEvent.account,
              colorId
            );
            googleSynced = googleResult.googleUpdated;
            if (googleSynced) {
              googleSyncedCount++;
            }
            warning = googleResult.warning;
          } catch (googleErr: unknown) {
            const message = googleErr instanceof Error ? googleErr.message : String(googleErr);
            warning = `Google sync failed: ${message}`;
          }
        } else if (syncToGoogle && !googleSyncEnabled) {
          warning = "Google Calendar sync not configured";
        } else if (syncToGoogle && !existingEvent.google_event_id) {
          warning = "Event has no Google Calendar ID";
        }

        results.push({
          eventId,
          success: true,
          googleSynced,
          warning,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ eventId, error: message });
        results.push({
          eventId,
          success: false,
          googleSynced: false,
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: updatedCount,
      googleSynced: googleSyncedCount,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulk color update:", error);
    return NextResponse.json(
      { error: "Failed to process bulk update" },
      { status: 500 }
    );
  }
}
