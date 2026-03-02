# Configuration Examples

Copy these example files to `../config/` and customize them for your setup.

```bash
# Copy non-sensitive config files
cp config.example/colors.json config/
cp config.example/calendar-manager.json config/
cp config.example/optimization-goals.json config/
cp config.example/schedule.json config/
cp config.example/calendars.json config/

# Create sensitive directory for credentials
mkdir -p config/sensitive
```

## Sensitive Files (config/sensitive/)

These files are gitignored and must be set up manually.

### `credentials-personal.json` / `credentials-work.json`
Google OAuth2 credentials. Download from Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Google Calendar API
3. Create OAuth2 credentials (Desktop app)
4. Download and save to `config/sensitive/credentials-{account}.json`

### `tokens-personal.json` / `tokens-work.json`
OAuth tokens - generated automatically when you first authenticate.
Stored in `config/sensitive/`. Do not commit these files.

## Configuration Files (config/)

These files are version-controlled (except `calendars.json` which contains personal info).

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
