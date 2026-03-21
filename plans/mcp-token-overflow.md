# Plan: Fix MCP Response Token Overflow

## Problem Statement

The Google Calendar MCP server returns responses that exceed Claude's 25,000 token read limit. Example error:
```
Error: File content (56443 tokens) exceeds maximum allowed tokens (25000)
```

This happens with `get_week_view` and potentially other calls when calendars have many events.

## Pre-Implementation Setup

1. **Save this plan** to `plans/mcp-token-overflow.md` (committed copy for tracking)
2. **Create worktree**: `git worktree add ../me-os-mcp-fix sw-mcp-token-overflow`
3. **Each phase = 1 commit** (stacked diffs for review)

## Root Cause Analysis

Two distinct code paths return data differently:

| Path | Compact Mode | Limits | Deduplication | Location |
|------|-------------|--------|---------------|----------|
| **Tool calls** (`get_week_view`, `get_events`) | Yes (default) | Yes (200) | Yes | Lines 896-951 |
| **Resource handlers** (`calendar://week`) | No | No | No | Lines 1742-1790 |

**Token math for 200 events:**
- Full format: 10 fields × ~200 chars × 200 events = ~400K chars → ~100K tokens
- Compact format: 7 fields × ~100 chars × 200 events = ~140K chars → ~35K tokens

Even compact mode can exceed limits with busy calendars.

## Description Field Analysis

**Question:** When do we need the `description` field in MeOS?

**Current usage in codebase:**
1. `lib/calendar-manager.ts:1090` - `detectOptOut()` checks description for opt-out tokens in dependency rules
2. `lib/calendar-db.ts` - Stores/retrieves description for persistence
3. `lib/time-analysis.ts:226` - Passes description to event structures

**Conclusion:** The `description` field is only needed for:
- **Opt-out token detection** in coverage/dependency rules (checking if description contains `#no-cover` etc.)
- **Database persistence** for historical queries

For **real-time calendar views** (week view, today view, time reports), description is **not needed**. We should:
- Omit description from compact/ultraCompact modes (default)
- Keep it available via `compact: false` for specific queries that need it
- Consider a targeted `fetchDescriptions: true` flag if we need opt-out detection without full data

## Proposed Solution

### Phase 1: Fix Resource Handlers (Commit 1)

**File:** `mcp/google-calendar/index.ts`

1. **Apply compact formatting to resources** (lines 1764-1783)
   - Use `formatEventCompact()` instead of raw events
   - Skip `description`, `location`, `htmlLink`, `status` fields

2. **Apply event limits to resources**
   - Use existing `applyEventLimit()` function
   - Default to 200 events

3. **Deduplicate events in resources**
   - Use existing `deduplicateEvents()` function

### Phase 2: Ultra-Compact Mode (Commit 2)

Add a new `ultraCompact` format that strips to absolute minimum:

```typescript
function formatEventUltraCompact(event: any): object {
  return {
    id: event.id,
    summary: event.summary || "(No title)",
    start: event.start,
    end: event.end,
    color: event.colorName || "Default",
  };
}
```

This reduces to **5 fields** and uses short key names.

### Phase 3: Smart Truncation (Commit 3)

Add response size estimation and automatic truncation:

```typescript
const MAX_RESPONSE_TOKENS = 20000; // Leave buffer below 25K limit
const ESTIMATED_CHARS_PER_TOKEN = 4;

function estimateTokens(obj: object): number {
  return Math.ceil(JSON.stringify(obj).length / ESTIMATED_CHARS_PER_TOKEN);
}
```

If response would exceed limit:
1. Try ultraCompact format
2. If still too large, reduce event limit
3. Include `truncated: true` and `nextCursor` in response

### Phase 4: Pagination Support (Commit 4)

Add cursor-based pagination to `get_events` and `get_week_view`:
- `offset` parameter to skip N events
- Return `hasMore` and `nextOffset` in response
- Allow fetching additional pages on demand

## Implementation Steps

### Commit 1: Fix resource handlers
- [ ] Modify `calendar://week` resource to use compact format
- [ ] Modify `calendar://today` resource to use compact format
- [ ] Add limit and deduplication to both

### Commit 2: Add ultraCompact format
- [ ] Add `formatEventUltraCompact()` function
- [ ] Add `ultraCompact` parameter to `get_week_view` (default: false)
- [ ] Add `ultraCompact` parameter to `get_events` (default: false)

### Commit 3: Add token estimation
- [ ] Add `estimateTokens()` utility function
- [ ] Auto-downgrade from compact to ultraCompact if response would exceed limit
- [ ] Auto-reduce event limit if still too large

### Commit 4: Update tool definitions
- [ ] Update tool schemas to document new parameters
- [ ] Add `ultraCompact` option to tool definitions

## Files to Modify

1. `mcp/google-calendar/index.ts` - Main implementation (lines 1742-1790 for resources, 108-180 for utilities)

## Key Code Locations

- **Resource handlers to fix:** lines 1742-1783 (`calendar://today` and `calendar://week`)
- **Existing utilities to reuse:**
  - `formatEventCompact()` - line 108
  - `deduplicateEvents()` - line 124
  - `generateEventSummary()` - line 139
  - `applyEventLimit()` - line 170

## Testing Plan

1. **Manual testing per commit:**
   - Call `get_week_view` with a busy week (100+ events)
   - Verify response is under 25K tokens
   - Verify all essential fields are present

2. **Edge cases:**
   - Week with 500+ events (should truncate gracefully)
   - Week with 0 events (should return empty array)
   - Single day with many events

3. **Verification command:**
   ```bash
   # Count tokens in response (approximate)
   echo '{"events": [...]}' | wc -c | awk '{print $1/4 " estimated tokens"}'
   ```

4. **Regression test:**
   - Verify calendar-manager opt-out detection still works with `compact: false`
   - Run existing tests: `pnpm test`

## Rollback Plan

If issues arise, revert individual commits:
1. `git revert <commit-hash>` for the problematic change
2. Each phase is independent and can be reverted separately

## Success Criteria

- [ ] `get_week_view` responses stay under 20K tokens by default
- [ ] Resource handlers use compact format
- [ ] No loss of essential event data (id, summary, start, end, color)
- [ ] Graceful handling of very busy calendars
- [ ] Opt-out detection still works (via compact: false when needed)
