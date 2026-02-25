---
name: calendar-setup
description: Interactive setup for configuring how different calendars affect time tracking and scheduling. Use when adding new accounts or updating calendar type settings.
user-invocable: true
---

# /calendar-setup - Configure Calendar Types

Interactive setup for configuring how different calendars affect time tracking, gap analysis, and scheduling.

## Usage

- `/calendar-setup` - Configure all calendars interactively
- `/calendar-setup list` - Show current configuration

## Calendar Types

| Type | Time Tracking | Gap Analysis | Scheduling | Use For |
|------|--------------|--------------|------------|---------|
| **active** | Counts | Fills gaps | Blocks | Normal work calendars |
| **availability** | No | No | Context only | On-call schedules |
| **reference** | No | No | No | Team vacation, company events |
| **blocking** | No | Fills gaps | Blocks | Personal holds, focus time |

## Instructions

When the user invokes this skill:

### For `/calendar-setup` (no args)

1. **List all calendars**:
   - Use the `list_calendars` MCP tool to get all calendars from all authenticated accounts
   - Group them by account

2. **Load existing config**:
   - Read `config/calendars.json` if it exists
   - Identify which calendars are already configured

3. **Show current state**:
   ```
   Found 12 calendars across 2 accounts:

   ## Personal Account (user@gmail.com)
   1. Primary (user@gmail.com) - type: active (default)
   2. Henry's Calendar - type: active (default)
   3. Family - type: active (default)

   ## Work Account (user@company.com)
   4. Primary (user@company.com) - type: active (default)
   5. On Call Schedule - type: availability (configured)
   6. Company Calendar - type: (not configured)
   ```

4. **Ask what to configure**:
   - "Would you like to configure calendar types?"
   - Options: [Configure all] [Configure unconfigured only] [Skip]

5. **For each calendar to configure**:
   - Show the calendar name
   - Suggest a type based on name patterns:
     - "On Call" → suggest `availability`
     - "Vacation", "Time Off", "PTO", "Out of Office" → suggest `reference`
     - "Company Calendar", "Social Events" → suggest `reference`
   - Ask user to confirm or choose different type:
     ```
     Configuring: "On Call Schedule"
     Suggested type: availability (on-call calendars show context only)

     What type should this calendar be?
     - [active] Events count toward time tracking
     - [availability] Shows context only (recommended)
     - [reference] FYI only, hidden from reports
     - [blocking] Blocks time but no details
     - [excluded] Hide completely
     ```

6. **Save configuration**:
   - Update `config/calendars.json` with the new settings
   - Show confirmation: "Configuration saved!"

### For `/calendar-setup list`

1. Read `config/calendars.json`
2. Use `list_calendars` to get all calendars
3. Show each calendar with its resolved type:
   ```
   ## Current Calendar Configuration

   ### Personal (user@gmail.com)
   | Calendar | Type | Source |
   |----------|------|--------|
   | Primary | active | default (primary) |
   | Henry's Calendar | active | default (owner) |

   ### Work (user@company.com)
   | Calendar | Type | Source |
   |----------|------|--------|
   | Primary | active | default (primary) |
   | On Call Schedule | availability | configured |
   | Company Calendar | reference | configured |
   | Team Calendar | active | default (shared) |

   ### Deny List
   - Holidays in United States
   ```

## Smart Suggestions

Use these patterns to suggest calendar types:

| Pattern | Suggested Type |
|---------|---------------|
| "on call", "oncall", "on-call" | availability |
| "vacation", "time off", "pto", "ooo" | reference |
| "company calendar", "social events" | reference |
| "team calendar" (shared, not owned) | active (but mention attendee filtering) |

## Config File Location

Configuration is stored in `config/calendars.json`:

```json
{
  "calendarTypes": {
    "On Call Schedule": "availability",
    "Company Calendar": "reference"
  },
  "defaultType": {
    "primary": "active",
    "owner": "active",
    "shared": "active"
  },
  "filtering": {
    "denyList": ["Holidays in United States"],
    "allowList": []
  }
}
```

## Prerequisites

- Google Calendar MCP server must be configured and authenticated
- At least one Google account must be authenticated
