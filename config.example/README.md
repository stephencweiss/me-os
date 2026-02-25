# Configuration Examples

Copy these example files to `../config/` and customize them for your setup.

```bash
cp config.example/*.json config/
```

## Required Files

### `credentials-personal.json` / `credentials-work.json`
Google OAuth2 credentials. Download from Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Google Calendar API
3. Create OAuth2 credentials (Desktop app)
4. Download and rename to `credentials-{account}.json`

### `tokens-personal.json` / `tokens-work.json`
OAuth tokens - generated automatically when you first authenticate.
Do not commit these files.

## Optional Files

### `colors.json`
Semantic meanings for Google Calendar colors. Customize based on your categories.

### `calendar-manager.json`
Settings for the calendar manager (account priority, flex event defaults, etc.)

### `optimization-goals.json`
Recurring goals for the calendar optimizer.

### `schedule.json`
Your weekly schedule template (waking hours, work hours by day of week).

### `calendars.json`
Calendar type configuration for filtering and time tracking behavior.

### `dependencies.json`
Rules for dependent coverage requirements (for example, date nights that require babysitter coverage, trips that require dog care).

Controls:
- Trigger matching (`sourceCalendars`, `summaryPatterns`)
- Coverage lookup calendars (`coverageSearchCalendars`)
- Creation target (`createTarget.account`, `createTarget.calendar`)
- Window buffers and minimum overlap threshold
- Opt-out markers in event description/title

**Calendar Types:**
- `active`: Events count toward time tracking, fill gaps, block scheduling (default for owned calendars)
- `availability`: Context only (e.g., on-call schedules) - doesn't count as time spent
- `reference`: FYI only - hidden from time reports or shown in separate section
- `blocking`: Blocks time without details (e.g., personal holds) - fills gaps but no time tracking

**Structure:**
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

Run `/calendar-setup` to interactively configure your calendars.
