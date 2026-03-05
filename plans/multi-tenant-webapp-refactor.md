# MeOS Multi-Tenant Web Application Refactoring Plan

## Overview

Transform MeOS from a local-first CLI tool to a multi-tenant web application with:
- User authentication via NextAuth.js
- Multi-Google account linking per user
- Server-side LLM integration via Anthropic API
- Goals as first-class feature (no Things 3 dependency)
- Deployment on Vercel

### Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Database** | Turso (keep current) | Already in use, distributed SQLite, Vercel-compatible, minimal migration |
| **Auth** | NextAuth.js | Native Next.js integration, easy Google OAuth |
| **LLM** | Anthropic API (Next.js routes) | Simple server-side integration, no separate service |
| **Goals** | Simple CRUD in webapp | No Things 3 dependency, users create goals directly |
| **Deployment** | Vercel | Native Next.js hosting, easy environment config |

---

## Security: Manual Data Isolation (CRITICAL)

> **Without Postgres RLS, data isolation is 100% the application's responsibility.**
> A single missed `user_id` filter = potential data leak between users.

### The Risk

Turso/SQLite has no Row Level Security. Every query that touches user data **must** include a `WHERE user_id = ?` clause. If any query omits this filter, it may return or modify another user's data.

### Mandatory Query Patterns

**READ operations - ALWAYS filter by user_id:**
```typescript
// CORRECT
const events = await db.execute({
  sql: "SELECT * FROM events WHERE user_id = ? AND date >= ?",
  args: [userId, startDate],
});

// WRONG - will return ALL users' events
const events = await db.execute({
  sql: "SELECT * FROM events WHERE date >= ?",
  args: [startDate],
});
```

**WRITE operations - ALWAYS include user_id:**
```typescript
// CORRECT
await db.execute({
  sql: "INSERT INTO events (id, user_id, ...) VALUES (?, ?, ...)",
  args: [eventId, userId, ...],
});

// CORRECT - update with ownership check
await db.execute({
  sql: "UPDATE events SET status = ? WHERE id = ? AND user_id = ?",
  args: [newStatus, eventId, userId],
});

// WRONG - could update another user's event
await db.execute({
  sql: "UPDATE events SET status = ? WHERE id = ?",
  args: [newStatus, eventId],
});
```

**DELETE operations - ALWAYS verify ownership:**
```typescript
// CORRECT
await db.execute({
  sql: "DELETE FROM events WHERE id = ? AND user_id = ?",
  args: [eventId, userId],
});

// WRONG - could delete another user's event
await db.execute({
  sql: "DELETE FROM events WHERE id = ?",
  args: [eventId],
});
```

### Implementation Safeguards

1. **Centralized query functions** - All database access goes through `webapp/lib/db.ts`, never raw queries in routes
2. **userId as first parameter** - Every function signature starts with `userId: string`
3. **Code review checklist** - Every PR must verify user_id filtering on all queries
4. **Integration tests** - Test that User A cannot access User B's data

### Tables Requiring user_id Filtering

| Table | Risk if unfiltered |
|-------|-------------------|
| `events` | Expose calendar data |
| `daily_summaries` | Expose time tracking |
| `weekly_goals` / `goals` | Expose personal goals |
| `goal_progress` | Expose goal tracking |
| `non_goals` | Expose anti-patterns |
| `non_goal_alerts` | Expose alerts |
| `user_preferences` | Expose settings |
| `google_accounts` | Expose OAuth tokens (!!) |

### Future Consideration

If MeOS grows to handle sensitive data or many users, consider migrating to Postgres/Supabase for RLS. The schema is SQLite-compatible, so migration would primarily involve:
1. Schema recreation in Postgres
2. Data export/import
3. Query syntax adjustments (minor)
4. RLS policy creation

---

## Phase 1: User Authentication Foundation

**Goal:** Establish NextAuth.js authentication before any data changes.

### Database Schema - New Tables

```sql
-- Users (NextAuth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  email_verified TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Accounts (NextAuth - OAuth providers)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  UNIQUE(provider, provider_account_id)
);

-- Sessions (NextAuth)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);
```

### Files to Create

| File | Purpose |
|------|---------|
| `webapp/lib/auth.ts` | NextAuth config with Turso adapter |
| `webapp/app/api/auth/[...nextauth]/route.ts` | NextAuth API handler |
| `webapp/middleware.ts` | Route protection |
| `webapp/app/login/page.tsx` | Login page with Google OAuth |

### Files to Modify

| File | Changes |
|------|---------|
| `webapp/app/layout.tsx` | Wrap with SessionProvider |
| `webapp/package.json` | Add `next-auth` dependency |

---

## Phase 2: Multi-Tenancy Data Isolation

**Goal:** Add `user_id` to all user-specific tables.

### Schema Migrations

```sql
ALTER TABLE events ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE daily_summaries ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE weekly_goals ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE non_goals ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE goal_progress ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE non_goal_alerts ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE user_preferences ADD COLUMN user_id TEXT REFERENCES users(id);

-- Add indexes
CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_summaries_user ON daily_summaries(user_id);
CREATE INDEX idx_goals_user ON weekly_goals(user_id);
```

### Database Function Pattern

```typescript
// webapp/lib/db.ts - ALL functions must follow this pattern
export async function getEvents(
  userId: string,  // NEW: required parameter
  startDate: string,
  endDate: string
): Promise<DbEvent[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?",
    args: [userId, startDate, endDate],  // Filter by user_id
  });
  return result.rows as unknown as DbEvent[];
}
```

### API Route Pattern

```typescript
// webapp/app/api/events/route.ts - ALL routes must follow this pattern
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const events = await getEvents(userId, startDate, endDate);
  // ...
}
```

### Files to Modify

- `webapp/lib/db.ts` - Add userId to all 20+ functions
- `webapp/app/api/events/route.ts` - Add auth check
- `webapp/app/api/summaries/route.ts` - Add auth check
- `webapp/app/api/goals/route.ts` - Add auth check
- `webapp/app/api/non-goals/route.ts` - Add auth check
- `webapp/app/api/calendars/route.ts` - Add auth check
- `webapp/app/api/preferences/route.ts` - Add auth check

---

## Phase 3: Google Account Linking

**Goal:** Users link multiple Google Calendar accounts to their MeOS account.

### New Table

```sql
CREATE TABLE google_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TEXT,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, google_user_id)
);
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/google/link/start` | POST | Generate OAuth URL |
| `/api/google/link/callback` | GET | Handle OAuth callback |
| `/api/google/accounts` | GET | List linked accounts |
| `/api/google/accounts/[id]` | DELETE | Unlink account |

### New Files

| File | Purpose |
|------|---------|
| `webapp/lib/google-calendar-server.ts` | Server-side calendar client |
| `webapp/app/api/google/link/start/route.ts` | Start OAuth flow |
| `webapp/app/api/google/link/callback/route.ts` | OAuth callback |
| `webapp/app/api/google/accounts/route.ts` | Manage accounts |
| `webapp/app/settings/page.tsx` | Settings UI for account linking |

### Key Implementation

```typescript
// webapp/lib/google-calendar-server.ts
export async function getGoogleCalendarClient(userId: string, accountId: string) {
  // 1. Fetch tokens from google_accounts table
  // 2. Create OAuth2Client with credentials
  // 3. Set up token refresh handler to update DB
  // 4. Return calendar client
}

export async function getAllUserCalendarClients(userId: string) {
  // Fetch all linked accounts for user
  // Return array of calendar clients
}
```

---

## Phase 4: Goals as First-Class Feature (V1)

**Goal:** Remove Things 3 dependency, enable direct goal CRUD.

### Schema Changes

```sql
-- New goals table (replaces weekly_goals)
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('time', 'outcome', 'habit')),
  color_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  source TEXT DEFAULT 'manual',  -- 'manual', 'things3', 'import'
  external_id TEXT,              -- Optional external reference
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### New/Modified API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/goals` | POST | Create goal (NEW) |
| `/api/goals/[id]` | DELETE | Delete goal (NEW) |
| `/api/goals` | GET | List goals (MODIFY: add user_id) |
| `/api/goals` | PATCH | Update goal (MODIFY: add user_id) |

### UI Changes

- `webapp/app/components/WeeklyGoals.tsx` - Add "New Goal" button and form modal
- Goal form fields: title, type (time/outcome/habit), estimated minutes, notes, color

---

## Phase 5: Server-Side LLM Integration

**Goal:** Add AI features via Anthropic API.

### Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### New Files

| File | Purpose |
|------|---------|
| `webapp/lib/anthropic.ts` | Anthropic SDK wrapper |
| `webapp/app/api/ai/analyze-week/route.ts` | Weekly insights |
| `webapp/app/api/ai/suggest-goals/route.ts` | Goal suggestions |
| `webapp/app/api/ai/categorize-events/route.ts` | Event categorization |

### Implementation Pattern

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

- Store request counts per user in database
- Limit AI requests to N per day per user
- Return 429 when exceeded

---

## Phase 6: Migration & Compatibility

### Local Mode (CLI/MCP)

Keep CLI and MCP working in "local mode":

```typescript
// Pattern for backward compatibility
const isLocalMode = process.env.MEOS_LOCAL_MODE === "true";

function getUserIdOrNull(): string | null {
  if (isLocalMode) return null;
  // In web context, require session
}
```

### Data Migration Script

```typescript
// scripts/migrate-local-to-web.ts
// 1. Export local data to JSON
// 2. User creates web account
// 3. Import JSON with new user_id
```

---

## Phase 7: Deployment (Vercel)

### Environment Variables

```env
# Database
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# NextAuth
NEXTAUTH_URL=https://meos.vercel.app
NEXTAUTH_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Anthropic
ANTHROPIC_API_KEY=...
```

### vercel.json

```json
{
  "buildCommand": "cd webapp && npm run build",
  "outputDirectory": "webapp/.next"
}
```

---

## Implementation Order

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1. Auth Foundation | 2-3 days | None |
| 2. Multi-Tenancy | 2-3 days | Phase 1 |
| 3. Google Linking | 2-3 days | Phase 2 |
| 4. Goals CRUD | 1-2 days | Phase 2 |
| 5. LLM Integration | 1-2 days | Phase 2 |
| 6. Migration | 1 day | Phase 3-4 |
| 7. Deployment | 0.5 day | All phases |

**Total Estimated Effort:** 10-14 days

---

## Critical Files Summary

### Must Create
- `webapp/lib/auth.ts`
- `webapp/app/api/auth/[...nextauth]/route.ts`
- `webapp/middleware.ts`
- `webapp/lib/google-calendar-server.ts`
- `webapp/lib/anthropic.ts`
- `webapp/app/settings/page.tsx`
- `webapp/app/login/page.tsx`

### Must Modify Heavily
- `webapp/lib/db.ts` (add user_id to all functions)
- `webapp/app/api/*/route.ts` (add auth to all routes)
- `webapp/app/components/WeeklyGoals.tsx` (add goal creation)
- `webapp/app/layout.tsx` (add SessionProvider)

### Keep for Local Mode
- `lib/google-auth.ts`
- `lib/things3-sync.ts`
- `lib/calendar-db.ts`
- `mcp/google-calendar/index.ts`

---

## V2 Considerations (Future)

- Things 3 optional sync (for users who have it)
- Import goals from CSV/text
- Mobile app / PWA
- Team/shared calendars
- Webhook integrations
