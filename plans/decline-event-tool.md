# Plan: Add `decline_event` Tool to Google Calendar MCP

**Status: ✅ IMPLEMENTED** (2026-02-23)

## Overview

Add a new tool to the Google Calendar MCP server that provides "smart decline" functionality - declining events with automatic cleanup when appropriate.

**Behavior:**
- If you're an **attendee**: Decline the invitation (set RSVP to "declined")
- If you're the **organizer with active attendees** (accepted/tentative/needsAction): Decline your own attendance (event continues for others)
- If you're the **organizer with no attendees OR all declined**: Delete the event

## Background

The MCP server (`mcp/google-calendar/index.ts`) previously had **9 tools**:
- `list_calendars`, `get_events`, `get_week_view`, `get_today`, `search_events`
- `update_event_color`, `get_color_definitions`
- **`create_event`** - Creates new calendar events (added recently)
- **`update_event_status`** - Updates RSVP status (accept/decline/tentative) (added recently)

The existing `update_event_status` tool provides basic RSVP functionality but doesn't include the "smart delete" logic for organizers with no active attendees. The new `decline_event` tool will add this intelligence.

## Implementation

### Step 1: Add Tool Definition

**File:** `mcp/google-calendar/index.ts`

Add to the `ListToolsRequestSchema` handler (after line 348, after `update_event_status`, before the closing `]`):

```typescript
{
  name: "decline_event",
  description: "Decline or delete a calendar event. If you're an attendee, declines the invitation. If you're the organizer, deletes the event. Optionally sends notifications.",
  inputSchema: {
    type: "object",
    properties: {
      eventId: {
        type: "string",
        description: "The event ID to decline",
      },
      calendarId: {
        type: "string",
        description: "Calendar ID (default: primary)",
        default: "primary",
      },
      sendUpdates: {
        type: "string",
        description: "Whether to send notifications: 'all' (notify organizer), 'none' (silent). Default: 'all'",
        enum: ["all", "none"],
        default: "all",
      },
      account: {
        type: "string",
        description: "Which account to use (personal/work). Auto-detected if not specified.",
      },
    },
    required: ["eventId"],
  },
}
```

### Step 2: Add Tool Implementation

**File:** `mcp/google-calendar/index.ts`

Add to the `CallToolRequestSchema` handler (after line 781, after `update_event_status` case, before `default:`):

```typescript
case "decline_event": {
  const {
    eventId,
    calendarId = "primary",
    sendUpdates = "all",
    account,
  } = args as {
    eventId: string;
    calendarId?: string;
    sendUpdates?: "all" | "none";
    account?: string;
  };

  const clients = await getClients();
  let targetAccount = account;
  let targetCalendar: calendar_v3.Calendar | null = null;
  let event: calendar_v3.Schema$Event | null = null;

  // Find the event and determine which account owns it
  if (targetAccount) {
    targetCalendar = await getClientForAccount(targetAccount);
    const response = await targetCalendar.events.get({ calendarId, eventId });
    event = response.data;
  } else {
    for (const { account: acct, calendar } of clients) {
      try {
        const response = await calendar.events.get({ calendarId, eventId });
        event = response.data;
        targetAccount = acct;
        targetCalendar = calendar;
        break;
      } catch {
        // Event not found in this account, continue
      }
    }
  }

  if (!event || !targetCalendar || !targetAccount) {
    return {
      content: [
        {
          type: "text",
          text: "Event not found in any account. Please specify the account parameter.",
        },
      ],
      isError: true,
    };
  }

  // Get the authenticated user's email for this account
  const calendarList = await targetCalendar.calendarList.get({ calendarId: "primary" });
  const userEmail = calendarList.data.id || "";

  // Update the attendee status to declined
  const attendees = event.attendees || [];
  const selfAttendee = attendees.find(
    (a) => a.email?.toLowerCase() === userEmail.toLowerCase() || a.self === true
  );

  // Check if user is the organizer
  const isOrganizer = event.organizer?.self === true ||
                      event.organizer?.email?.toLowerCase() === userEmail.toLowerCase();

  // Check if there are other attendees (excluding self)
  const otherAttendees = attendees.filter(
    (a) => a.email?.toLowerCase() !== userEmail.toLowerCase() && a.self !== true
  );

  // Check if any other attendees are still "active" (not declined)
  const activeAttendees = otherAttendees.filter(
    (a) => a.responseStatus !== "declined"
  );
  const hasActiveAttendees = activeAttendees.length > 0;

  if (isOrganizer && !hasActiveAttendees) {
    // User is organizer with no other attendees OR all have declined - delete the event
    await targetCalendar.events.delete({
      calendarId,
      eventId,
      sendUpdates,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account: targetAccount,
            action: "deleted",
            message: `Deleted event: ${event.summary} (no active attendees remaining)`,
            sendUpdates,
          }, null, 2),
        },
      ],
    };
  }

  // If organizer with active attendees, we need to decline our own attendance
  // For this, we need to add ourselves to attendees if not already there, then decline
  if (isOrganizer && hasActiveAttendees) {
    // Find or create self attendee entry
    let organizerAttendee = attendees.find(
      (a) => a.email?.toLowerCase() === userEmail.toLowerCase() || a.self === true
    );

    if (!organizerAttendee) {
      // Add organizer as an attendee so we can decline
      organizerAttendee = { email: userEmail, responseStatus: "declined" };
      attendees.push(organizerAttendee);
    } else {
      organizerAttendee.responseStatus = "declined";
    }

    const response = await targetCalendar.events.patch({
      calendarId,
      eventId,
      sendUpdates,
      requestBody: { attendees },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account: targetAccount,
            action: "declined",
            message: `Declined event: ${event.summary} (you were the organizer, event continues for ${activeAttendees.length} active attendee(s))`,
            sendUpdates,
            event: formatEvent(response.data, targetAccount),
          }, null, 2),
        },
      ],
    };
  }

  if (!selfAttendee) {
    // User is not an attendee and not the organizer - edge case
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "You are not an attendee or organizer of this event.",
            event: formatEvent(event, targetAccount),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  // Update the response status to declined
  selfAttendee.responseStatus = "declined";

  // Patch the event with updated attendees
  const response = await targetCalendar.events.patch({
    calendarId,
    eventId,
    sendUpdates,
    requestBody: {
      attendees,
    },
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          account: targetAccount,
          action: "declined",
          message: `Declined event: ${event.summary}`,
          sendUpdates,
          event: formatEvent(response.data, targetAccount),
        }, null, 2),
      },
    ],
  };
}
```

### Step 3: No Additional Helper Needed

The existing `update_event_status` implementation (lines 742-745) already demonstrates the pattern for getting the user email:

```typescript
const calendarList = await targetCalendar.calendarList.get({ calendarId: "primary" });
const userEmail = calendarList.data.id;
```

This pattern will be used directly in the `decline_event` implementation above.

### Step 4: OAuth Scope

The existing OAuth scope `https://www.googleapis.com/auth/calendar` already includes both read/write permissions, so no changes needed to `lib/google-auth.ts`.

## Testing Plan

1. **Manual testing:**
   - Find an event you're invited to (not the organizer)
   - Run: Use the new `decline_event` tool via Claude Code
   - Verify: Check Google Calendar to confirm RSVP status changed to "Declined"
   - Verify: Check if organizer received notification (when `sendUpdates: "all"`)

2. **Edge cases to test:**
   - Event where user is organizer with active attendees (should decline, event continues)
   - Event where user is organizer with all attendees declined (should delete)
   - Event where user is organizer with no attendees (should delete)
   - Event where user is attendee (should decline the invitation)
   - Event that doesn't exist (should return "not found")
   - Recurring event instance (should work with instance ID)
   - Event on work vs personal calendar

3. **Integration test:**
   - Run `/time-report --tomorrow`
   - Identify work events
   - Use decline_event to decline them
   - Re-run report to confirm events still show (with declined status)

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `mcp/google-calendar/index.ts` | Add tool definition (lines 349-377) and implementation (lines 812-993) | ✅ Done |

## Future Enhancements (Out of Scope)

- `delete_event` tool for events you own
- `accept_event` tool for accepting invitations
- `tentative_event` tool for "maybe" responses
- Batch decline multiple events at once
