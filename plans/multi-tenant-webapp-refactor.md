# MeOS Multi-Tenant Web Application Migration Plan

**Branch**: `sw-multi-tenant-webapp-plan` (PR #80)
**Plan File**: `plans/multi-tenant-webapp-refactor.md`

## Overview

Transform MeOS from a local-first CLI tool to a multi-tenant web application with:
- User authentication via NextAuth.js
- Multi-Google account linking per user
- Server-side LLM integration via Anthropic API
- Goals as first-class feature (native CRUD)
- Deployment on Vercel

### Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Database** | Postgres (Supabase) | Row Level Security for automatic data isolation, official NextAuth adapter, better multi-tenant support |
| **Auth** | NextAuth.js | Native Next.js integration, Google OAuth built-in, official Supabase adapter |
| **LLM** | Anthropic API | Simple server-side integration via API routes |
| **Goals** | Native CRUD | Goals already native, simple webapp CRUD |
| **Deployment** | Vercel | Native Next.js hosting |

### Why Postgres over Turso

| Concern | Turso | Postgres/Supabase |
|---------|-------|-------------------|
| **Data isolation** | Manual `WHERE user_id = ?` on every query | RLS policies enforce automatically |
| **Security risk** | One missed filter = data leak | Database prevents cross-user access |
| **NextAuth adapter** | Custom adapter needed | Official `@auth/supabase-adapter` |
| **Migration effort** | Schema already exists | One-time migration, but cleaner long-term |
| **Cost** | Free tier available | Supabase free tier: 500MB, 2 projects |

---

## Security: Row Level Security (RLS)

> **With Postgres RLS, data isolation is enforced at the database level.**
> Even if application code forgets a filter, the database blocks cross-user access.

### How RLS Works

1. Each table has a `user_id` column
2. RLS policies restrict access based on `auth.uid()` (current user)
3. Database automatically filters queries - no manual `WHERE user_id = ?` needed
4. Even raw SQL can't bypass RLS when enabled

### RLS Policy Pattern

```sql
-- Enable RLS on table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own events
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can only insert their own events
CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only update their own events
CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Users can only delete their own events
CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  USING (user_id = auth.uid());
```

### Tables Requiring RLS

| Table | Policy |
|-------|--------|
| `events` | user_id = auth.uid() |
| `daily_summaries` | user_id = auth.uid() |
| `weekly_goals` | user_id = auth.uid() |
| `goal_progress` | user_id = auth.uid() |
| `non_goals` | user_id = auth.uid() |
| `non_goal_alerts` | user_id = auth.uid() |
| `user_preferences` | user_id = auth.uid() |
| `linked_google_accounts` | user_id = auth.uid() |

### Defense in Depth

Even with RLS, maintain good practices:
1. **Centralized query functions** - `webapp/lib/db.ts`
2. **Type safety** - TypeScript interfaces for all tables
3. **Integration tests** - Verify cross-user access is blocked

---

## Phase 1: Supabase Setup & Authentication

### 1.1 Create Supabase Project

1. Create project at [supabase.com](https://supabase.com)
2. Note: Project URL and anon/service role keys
3. Enable Google OAuth in Authentication > Providers

### 1.2 Auth Tables (Supabase built-in)

Supabase Auth handles these automatically:
- `auth.users` - User accounts
- `auth.sessions` - Active sessions
- `auth.identities` - OAuth provider links

### 1.3 NextAuth + Supabase Adapter

```typescript
// webapp/lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      session.user.id = user.id;
      return session;
    },
  },
});
```

### Files to Create

| File | Purpose |
|------|---------|
| `webapp/lib/auth.ts` | NextAuth config with Supabase adapter |
| `webapp/lib/supabase.ts` | Supabase client (server & client) |
| `webapp/app/api/auth/[...nextauth]/route.ts` | NextAuth API handler |
| `webapp/middleware.ts` | Route protection |
| `webapp/app/login/page.tsx` | Login page with Google OAuth |
| `webapp/lib/auth-helpers.ts` | `requireAuth()` helper |

### Files to Modify

| File | Changes |
|------|---------|
| `webapp/app/layout.tsx` | Wrap with SessionProvider |
| `webapp/package.json` | Add `next-auth`, `@auth/supabase-adapter`, `@supabase/supabase-js` |

### Supabase Client Setup

```typescript
// webapp/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Server-side client (with service role for admin operations)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Client-side client (with anon key, respects RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Auth Helper

```typescript
// webapp/lib/auth-helpers.ts
import { auth } from "./auth";
import { NextResponse } from "next/server";

export type AuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { authorized: true, userId: session.user.id };
}
```

---

## Phase 2: Database Schema Migration (Turso -> Postgres)

### 2.1 Create Postgres Schema

```sql
-- Events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  date DATE NOT NULL,
  account TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  color_id TEXT NOT NULL,
  color_name TEXT NOT NULL,
  color_meaning TEXT NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_event_id TEXT,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  attended TEXT NOT NULL DEFAULT 'unknown',
  auto_categorized BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_google_id ON events(google_event_id);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "events_update" ON events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "events_delete" ON events FOR DELETE USING (user_id = auth.uid());

-- Daily summaries
CREATE TABLE daily_summaries (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_scheduled_minutes INTEGER NOT NULL,
  total_gap_minutes INTEGER NOT NULL,
  categories_json JSONB NOT NULL,
  is_work_day BOOLEAN NOT NULL DEFAULT TRUE,
  analysis_hours_start INTEGER NOT NULL,
  analysis_hours_end INTEGER NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, date)
);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "summaries_all" ON daily_summaries FOR ALL USING (user_id = auth.uid());

-- Weekly goals
CREATE TABLE weekly_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('time', 'outcome', 'habit')),
  color_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user ON weekly_goals(user_id);
CREATE INDEX idx_goals_week ON weekly_goals(week_id);

ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_all" ON weekly_goals FOR ALL USING (user_id = auth.uid());

-- Non-goals (anti-patterns)
CREATE TABLE non_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,
  color_id TEXT,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE non_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "non_goals_all" ON non_goals FOR ALL USING (user_id = auth.uid());

-- Goal progress (links events to goals)
CREATE TABLE goal_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES weekly_goals(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  match_type TEXT NOT NULL CHECK(match_type IN ('auto', 'manual')),
  match_confidence REAL,
  minutes_contributed INTEGER NOT NULL,
  UNIQUE(goal_id, event_id)
);

ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_all" ON goal_progress FOR ALL USING (user_id = auth.uid());

-- Non-goal alerts
CREATE TABLE non_goal_alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  non_goal_id TEXT NOT NULL REFERENCES non_goals(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(non_goal_id, event_id)
);

ALTER TABLE non_goal_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_all" ON non_goal_alerts FOR ALL USING (user_id = auth.uid());

-- User preferences
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(user_id, key)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preferences_all" ON user_preferences FOR ALL USING (user_id = auth.uid());

-- Linked Google accounts (for calendar access)
CREATE TABLE linked_google_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,
  display_name TEXT,
  account_label TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, google_email)
);

ALTER TABLE linked_google_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "google_accounts_all" ON linked_google_accounts FOR ALL USING (user_id = auth.uid());
```

### 2.2 Data Migration Script

Create `scripts/migrate-turso-to-supabase.ts`:
```typescript
// 1. Export data from Turso to JSON
// 2. Create user account in Supabase
// 3. Import JSON with user_id = new Supabase user ID
// 4. Verify row counts match
```

---

## Phase 3: Database Function Updates (Supabase Client)

### Pattern for All Functions

With RLS, queries are simpler - no manual user_id filtering needed:

```typescript
// webapp/lib/db.ts
import { supabase } from "./supabase";

// BEFORE (Turso - manual filtering)
export async function getEvents(userId: string, startDate: string, endDate: string) {
  const result = await db.execute({
    sql: "SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?",
    args: [userId, startDate, endDate],
  });
}

// AFTER (Supabase - RLS handles filtering)
export async function getEvents(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("start_time");

  if (error) throw error;
  return data;
}
```

### Key Differences

| Turso | Supabase |
|-------|----------|
| Raw SQL with `?` placeholders | Fluent query builder |
| Manual `user_id` filtering | RLS automatic filtering |
| `db.execute()` | `supabase.from().select()` |
| Custom types | Generated types via `supabase gen types` |

### Functions to Rewrite in `webapp/lib/db.ts`

**Events:**
- `getEvents(startDate, endDate, options?)` - Use Supabase query builder
- `getEventById(eventId)` - `.eq("id", eventId).single()`
- `updateEventColor(eventId, colorId)` - `.update().eq("id", eventId)`
- `updateAttendance(eventId, attended)` - `.update().eq("id", eventId)`

**Summaries:**
- `getDailySummaries(startDate, endDate)` - Range query
- `computeSummariesFromEvents(...)` - May use Supabase functions

**Goals:**
- `getGoalsForWeek(weekId)` - `.eq("week_id", weekId)`
- `getGoalById(goalId)` - `.eq("id", goalId).single()`
- `createGoal(params)` - `.insert(params)`
- `updateGoalProgress(goalId, progressPercent)` - `.update()`
- `updateGoalStatus(goalId, status)` - `.update()`

**Non-goals:**
- `getNonGoalsForWeek(weekId)` - `.eq("week_id", weekId)`
- `createNonGoal(params)` - `.insert(params)`
- `getUnacknowledgedAlerts(weekId)` - Join with non_goals
- `acknowledgeAlert(alertId)` - `.update()`

**Preferences:**
- `getPreference(key)` - `.eq("key", key).single()`
- `setPreference(key, value)` - `.upsert()`
- `getAllPreferences()` - `.select("*")`

### Generate TypeScript Types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > webapp/lib/database.types.ts
```

---

## Phase 4: API Route Updates

### Pattern for All Routes

With RLS, API routes are simpler - just need auth check, not manual filtering:

```typescript
import { requireAuth } from "@/lib/auth-helpers";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  // Create authenticated Supabase client
  const supabase = createServerClient();

  // RLS automatically filters to current user
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .gte("date", start)
    .lte("date", end);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events });
}
```

### Server-Side Supabase Client

```typescript
// webapp/lib/supabase-server.ts
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function createServerClient() {
  return createServerComponentClient({ cookies });
}
```

### Routes to Update (13 total)

| Route | File |
|-------|------|
| `/api/events` | `webapp/app/api/events/route.ts` |
| `/api/events/color` | `webapp/app/api/events/color/route.ts` |
| `/api/events/bulk-color` | `webapp/app/api/events/bulk-color/route.ts` |
| `/api/events/suggest` | `webapp/app/api/events/suggest/route.ts` |
| `/api/summaries` | `webapp/app/api/summaries/route.ts` |
| `/api/calendars` | `webapp/app/api/calendars/route.ts` |
| `/api/preferences` | `webapp/app/api/preferences/route.ts` |
| `/api/goals` | `webapp/app/api/goals/route.ts` |
| `/api/non-goals` | `webapp/app/api/non-goals/route.ts` |
| `/api/health` | Skip auth (health check) |

---

## Phase 5: Google Account Linking

Separate from login - users link calendar accounts after signing in.

### New Table

```sql
CREATE TABLE linked_google_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,
  display_name TEXT,                  -- From Google profile
  account_label TEXT NOT NULL,        -- User-defined: "personal", "work"
  access_token TEXT NOT NULL,         -- Encrypted (AES-256-GCM)
  refresh_token TEXT,                 -- Encrypted
  token_expiry TEXT,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, google_email)
);

CREATE INDEX idx_linked_google_user ON linked_google_accounts(user_id);
```

### Files to Create

| File | Purpose |
|------|---------|
| `webapp/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for tokens |
| `webapp/app/api/google/link/route.ts` | Start OAuth flow for calendar linking |
| `webapp/app/api/google/callback/route.ts` | OAuth callback, store tokens |
| `webapp/app/api/google/accounts/route.ts` | List/unlink accounts |
| `webapp/app/settings/accounts/page.tsx` | UI for managing linked accounts |

### Token Encryption

```typescript
// webapp/lib/encryption.ts
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!; // 32-byte hex

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
```

### Modify

| File | Changes |
|------|---------|
| `webapp/lib/google-calendar-client.ts` | Load tokens from DB instead of filesystem |

---

## Phase 6: Server-Side LLM Integration

### Files to Create

| File | Purpose |
|------|---------|
| `webapp/lib/anthropic.ts` | Anthropic SDK wrapper |
| `webapp/app/api/ai/analyze-week/route.ts` | Weekly insights |
| `webapp/app/api/ai/suggest-goals/route.ts` | Goal suggestions |
| `webapp/app/api/ai/categorize-events/route.ts` | Event categorization |

### Implementation

```typescript
// webapp/lib/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeWeek(weekData: any) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: `Analyze: ${JSON.stringify(weekData)}` }],
  });
  return response.content[0].text;
}
```

### Rate Limiting

- Store request counts per user in `user_preferences` or dedicated table
- Limit AI requests to N per day per user
- Return 429 when exceeded

---

## Phase 7: CLI/Local Mode Compatibility

Keep CLI and MCP working without auth:

```typescript
function isLocalMode(): boolean {
  return process.env.MEOS_MODE === "local" || !process.env.NEXTAUTH_URL;
}

// In API routes - skip auth in local mode
let userId: string | null = null;
if (!isLocalMode()) {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;
  userId = authResult.userId;
}
```

### Files to Keep for Local Mode
- `lib/google-auth.ts` - File-based tokens for CLI
- `lib/calendar-db.ts` - CLI database operations
- `mcp/google-calendar/index.ts` - MCP server
- `lib/calendar-sync.ts` - Sync logic

### Data Migration Script

Create `scripts/migrate-local-to-web.ts`:
```typescript
// 1. Export local data to JSON (events, goals, preferences)
// 2. User creates web account
// 3. Import JSON with new user_id attached to all records
```

---

## Phase 8: Frontend Updates

### Files to Modify

| File | Changes |
|------|---------|
| `webapp/app/layout.tsx` | Add SessionProvider wrapper |

### Files to Create

| File | Purpose |
|------|---------|
| `webapp/app/components/UserMenu.tsx` | User avatar, settings link, sign out |
| `webapp/app/settings/accounts/page.tsx` | Manage linked Google accounts |

---

## Phase 9: Deployment (Vercel)

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, never expose

# NextAuth
NEXTAUTH_URL=https://meos.example.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### vercel.json

```json
{
  "buildCommand": "cd webapp && npm run build",
  "outputDirectory": "webapp/.next"
}
```

### Supabase Setup Checklist

1. [ ] Create Supabase project
2. [ ] Run schema SQL in SQL Editor
3. [ ] Enable Google OAuth in Auth > Providers
4. [ ] Copy project URL and keys to Vercel env vars
5. [ ] Test RLS policies work correctly

---

## Testing Strategy

### Data Isolation Tests

```typescript
describe("Multi-tenant data isolation", () => {
  const userA = "user-a";
  const userB = "user-b";

  beforeAll(async () => {
    await createEvent(userA, { summary: "A's event" });
    await createEvent(userB, { summary: "B's event" });
  });

  it("user A cannot see user B events", async () => {
    const events = await getEvents(userA, "2026-01-01", "2026-12-31");
    expect(events.every(e => e.user_id === userA)).toBe(true);
    expect(events.some(e => e.summary === "B's event")).toBe(false);
  });

  it("user A cannot update user B events", async () => {
    const isOwner = await verifyOwnership(userA, "event", userBEventId);
    expect(isOwner).toBe(false);
  });

  it("user A cannot delete user B events", async () => {
    const result = await deleteEvent(userA, userBEventId);
    expect(result.rowsAffected).toBe(0);
  });
});
```

---

## Implementation Order

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | Auth Infrastructure | None |
| 2 | Schema Migration | Phase 1 |
| 3 | Database Function Updates | Phase 2 |
| 4 | API Route Updates | Phase 3 |
| 5 | Google Account Linking | Phase 4 |
| 6 | LLM Integration | Phase 4 |
| 7 | Local Mode Compatibility | Phase 4 |
| 8 | Frontend Updates | Phase 4 |
| 9 | Deployment | All phases |

---

## Critical Files Summary

### Must Create
- `webapp/lib/auth.ts` - NextAuth configuration with Supabase adapter
- `webapp/lib/supabase.ts` - Supabase client (server & browser)
- `webapp/lib/supabase-server.ts` - Server-side Supabase client
- `webapp/lib/database.types.ts` - Generated TypeScript types
- `webapp/app/api/auth/[...nextauth]/route.ts` - Auth API
- `webapp/middleware.ts` - Route protection
- `webapp/lib/auth-helpers.ts` - Auth utilities (`requireAuth`)
- `webapp/app/login/page.tsx` - Login page
- `webapp/app/settings/accounts/page.tsx` - Account management
- `webapp/lib/anthropic.ts` - LLM client
- `scripts/migrate-turso-to-supabase.ts` - Data migration

### Must Modify Heavily
- `webapp/lib/db.ts` - Rewrite with Supabase client (no manual user_id filtering)
- `webapp/app/api/*/route.ts` - Add auth to all 13 routes
- `webapp/lib/google-calendar-client.ts` - DB-based token loading
- `webapp/app/layout.tsx` - Add SessionProvider
- `webapp/package.json` - Add `@supabase/supabase-js`, `@auth/supabase-adapter`, `next-auth`

### Keep for Local Mode
- `lib/google-auth.ts` - File-based tokens for CLI
- `lib/calendar-db.ts` - CLI database operations (Turso)
- `mcp/google-calendar/index.ts` - MCP server
- `lib/calendar-sync.ts` - Sync logic

### Remove (Turso-specific)
- Remove `@libsql/client` dependency from webapp
- Remove Turso env vars from webapp deployment

---

## V2 Considerations (Future)

- Import goals from CSV/text
- Mobile app / PWA
- Team/shared calendars
- Webhook integrations for external calendar updates
- Postgres migration for RLS if user base grows
