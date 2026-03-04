import { NextRequest, NextResponse } from "next/server";
import { updateEventColor, COLOR_DEFINITIONS } from "@/lib/db";

/**
 * PATCH /api/events/color
 *
 * Body:
 *   - eventId: Event ID to update
 *   - colorId: Color ID (1-11)
 */
export async function PATCH(request: NextRequest) {
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

    const updatedEvent = await updateEventColor(eventId, colorId);

    if (!updatedEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating event color:", error);
    return NextResponse.json(
      { error: "Failed to update event color" },
      { status: 500 }
    );
  }
}
