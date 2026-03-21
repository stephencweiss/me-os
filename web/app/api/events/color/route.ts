import { NextRequest, NextResponse } from "next/server";
import { requireAuthUnlessLocal } from "@/lib/auth-helpers";
import { updateEventColor, getEventById, COLOR_DEFINITIONS } from "@/lib/db-unified";
import { updateGoogleEventColor, isGoogleSyncConfigured } from "@/lib/google-calendar-client";

/**
 * PATCH /api/events/color
 *
 * Body:
 *   - eventId: Event ID to update
 *   - colorId: Color ID (1-11)
 *
 * Updates both the local database AND syncs to Google Calendar.
 * If Google sync fails, the local change is preserved and a warning is returned.
 */
export async function PATCH(request: NextRequest) {
  // Require authentication (skipped in local mode)
  const authResult = await requireAuthUnlessLocal();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { eventId, colorId } = body;

    if (!eventId || !colorId) {
      return NextResponse.json(
        { error: "eventId and colorId are required" },
        { status: 400 }
      );
    }

    // Validate colorId
    if (!COLOR_DEFINITIONS[colorId]) {
      return NextResponse.json(
        { error: "colorId must be between 1 and 11" },
        { status: 400 }
      );
    }

    // First, get the event to check it exists and get Google Calendar info
    const existingEvent = await getEventById(userId, eventId);
    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // 1. Update local database first
    const updatedEvent = await updateEventColor(userId, eventId, colorId);

    if (!updatedEvent) {
      return NextResponse.json(
        { error: "Failed to update event in database" },
        { status: 500 }
      );
    }

    // 2. Sync to Google Calendar (if configured)
    let googleSyncResult: {
      success: boolean;
      googleUpdated: boolean;
      warning?: string;
    } = {
      success: true,
      googleUpdated: false,
    };

    if (isGoogleSyncConfigured() && existingEvent.google_event_id) {
      googleSyncResult = await updateGoogleEventColor(
        existingEvent.google_event_id,
        existingEvent.account,
        colorId
      );
    } else if (!existingEvent.google_event_id) {
      googleSyncResult.warning = "Event has no Google Calendar ID - local only update";
    } else {
      googleSyncResult.warning = "Google Calendar sync not configured - local only update";
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      googleSync: {
        updated: googleSyncResult.googleUpdated,
        warning: googleSyncResult.warning,
      },
    });
  } catch (error) {
    console.error("Error updating event color:", error);
    return NextResponse.json(
      { error: "Failed to update event color" },
      { status: 500 }
    );
  }
}
