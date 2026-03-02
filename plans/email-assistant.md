# Plan: Gmail Email Assistant for MeOS

## Overview

Build a personal email assistant that enables:
1. **Batch email review** - Quickly triage unread emails across accounts
2. **One-action archive** - Remove emails from inbox efficiently
3. **Newsletter management** - Track subscriptions with 90-day re-review cadence
4. **Smart unsubscribe** - One-click via List-Unsubscribe (RFC 2369), fallback list for manual action

## Key Decisions

- **Interface:** Claude Code skill (`/email` commands)
- **Unsubscribe:** One-click via List-Unsubscribe header; collect manual-action links separately
- **Accounts:** Multi-account support (personal + work)
- **Future:** Playwright/Stagehand automation documented in features.md

---

## Architecture

Following existing MeOS patterns:

```
.claude/skills/email/SKILL.md     # Skill instructions
mcp/gmail/index.ts                # Gmail MCP server (like calendar)
lib/gmail.ts                      # Email parsing utilities
lib/newsletter-tracker.ts         # 90-day cadence tracking
config/email.json                 # Configuration
data/newsletters/index.json       # Subscription decisions (runtime)
```

---

## Implementation Phases

### Phase 1: Foundation

**Goal:** Basic Gmail MCP server with list/read/archive

**Files to create/modify:**
- `lib/google-auth.ts` - Add Gmail scopes and `getGmailClient()`
- `mcp/gmail/index.ts` - New MCP server with core tools
- `lib/gmail.ts` - Header parsing utilities
- `package.json` - Add `npm run auth:gmail` script

**MCP Tools (Phase 1):**
| Tool | Description |
|------|-------------|
| `list_messages` | Query emails with Gmail search syntax |
| `get_message` | Get full message with headers |
| `archive_message` | Remove INBOX label |
| `list_labels` | List all Gmail labels |

**Gmail Scopes Needed:**
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

### Phase 2: Newsletter Tracking

**Goal:** Track newsletter decisions with 90-day re-review

**Files to create:**
- `lib/newsletter-tracker.ts` - Index management and date calculations
- `config/email.json` - Default configuration

**Data Schema (`data/newsletters/index.json`):**
```json
{
  "sources": {
    "morningbrew-com": {
      "senderEmail": "newsletter@morningbrew.com",
      "decision": "keep",
      "decisionDate": "2026-01-15",
      "reviewDueDate": "2026-04-15",
      "emailCount": 45
    }
  }
}
```

### Phase 3: Unsubscribe Support

**Goal:** Extract List-Unsubscribe headers, support one-click

**Add to MCP:**
| Tool | Description |
|------|-------------|
| `get_unsubscribe_info` | Extract RFC 2369 List-Unsubscribe header |

**Unsubscribe Info Response:**
```typescript
{
  hasUnsubscribe: boolean;
  mailto?: string;           // mailto:unsub@example.com
  httpUrl?: string;          // https://example.com/unsub
  oneClickSupported: boolean; // Has List-Unsubscribe-Post
}
```

**Workflow:**
1. If `oneClickSupported` + `mailto` → Send empty email to unsubscribe
2. If `httpUrl` only → Store link for manual action in `data/newsletters/pending-unsubscribes.md`
3. Archive email, update tracker

### Phase 4: Skill Implementation

**Goal:** Complete `/email` skill with batch review

**Files to create/modify:**
- `.claude/skills/email/SKILL.md` - Full skill documentation
- `.mcp.json` - Add gmail server entry
- `.claude/settings.local.json` - Add gmail permissions
- `CLAUDE.md` - Register email skill

**Additional MCP Tools:**
| Tool | Description |
|------|-------------|
| `batch_archive` | Archive multiple messages |
| `get_inbox_summary` | Stats by sender/category |

**Skill Commands:**
- `/email` - Inbox summary
- `/email review` - Batch review unread
- `/email review newsletters` - Review newsletters specifically
- `/email unsubscribe <id>` - Unsubscribe from sender
- `/email newsletters` - Show subscription status
- `/email newsletters review` - 90-day re-evaluation

### Phase 5: Documentation

**Files to create:**
- `plans/email-features.md` - Future features (Playwright automation)

---

## Critical Files to Reference

| File | Purpose |
|------|---------|
| `mcp/google-calendar/index.ts` | MCP server pattern to follow |
| `lib/google-auth.ts` | OAuth pattern to extend |
| `lib/one-on-one.ts` | Data storage pattern |
| `.claude/skills/one-on-one/SKILL.md` | Skill documentation template |

---

## Testing Plan

### Unit Tests

**`tests/gmail.test.ts`:**
- `parseListUnsubscribe()` - Parse various RFC 2369 formats
- `parseEmailAddress()` - Handle "Name <email>" and bare email
- `isLikelyNewsletter()` - Detect newsletters by headers/patterns

**`tests/newsletter-tracker.test.ts`:**
- `getDueForReview()` - Return sources past 90 days
- `setDecision()` - Calculate review due dates correctly
- `generateSourceId()` - Create consistent slugs from sender

### Manual Verification

1. **Auth Flow**
   - `npm run auth:gmail personal` prompts for Gmail permissions
   - Token saved with gmail scopes
   - Calendar auth still works

2. **MCP Server**
   - Server starts without errors
   - `list_messages` returns inbox emails
   - `archive_message` removes from inbox
   - `get_unsubscribe_info` extracts headers

3. **Skill Integration**
   - `/email` shows inbox summary
   - `/email review` presents batch interface
   - Archive action works immediately

### E2E Scenario

```
1. Send test newsletter with List-Unsubscribe header
2. /email review newsletters
3. Mark for unsubscribe
4. Verify: archived, tracked, URL captured
5. /email newsletters → shows pending unsubscribe
```

---

## Future Features (for features.md)

### Playwright/Stagehand Automation

For newsletters without one-click unsubscribe support:

**Proposed approach using [Stagehand.dev](https://stagehand.dev):**
- AI-powered browser automation
- Navigate to unsubscribe URL
- Intelligently find and click unsubscribe button
- Handle confirmation dialogs
- Report success/failure back to tracker

**When to implement:** After evaluating manual unsubscribe workflow - if volume of manual-action links becomes unwieldy.

---

## File Summary

### New Files
| File | Lines (est) |
|------|-------------|
| `mcp/gmail/index.ts` | ~800 |
| `lib/gmail.ts` | ~200 |
| `lib/newsletter-tracker.ts` | ~300 |
| `config/email.json` | ~30 |
| `.claude/skills/email/SKILL.md` | ~150 |
| `tests/gmail.test.ts` | ~150 |
| `tests/newsletter-tracker.test.ts` | ~150 |
| `plans/email-features.md` | ~50 |

### Modified Files
| File | Changes |
|------|---------|
| `lib/google-auth.ts` | Add Gmail scopes, `getGmailClient()` |
| `.mcp.json` | Add gmail server |
| `.claude/settings.local.json` | Add gmail permissions |
| `CLAUDE.md` | Register email skill |
| `package.json` | Add auth script |
