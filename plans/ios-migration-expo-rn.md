# iOS Migration Plan: Expo/React Native with Web Support

## Executive Summary

This plan proposes migrating MeOS from a Next.js webapp to **Expo/React Native** with **expo-web** support, enabling native iOS and web as first-class citizens from a single codebase. This approach leverages React Native's mature ecosystem, Expo's simplified tooling, and the ability to share 70-85% of code between platforms.

---

## Current State Analysis

### Existing Webapp Structure

The current Next.js 16 webapp includes:

**Pages/Routes:**
- `/` (Dashboard with Calendar and Goals tabs)
- `/day` (DayView for single-day event management)

**Components (16 total):**
- `Dashboard.tsx` - Main dashboard with pie/bar charts (recharts)
- `WeeklyGoals.tsx` - Goal tracking with progress bars
- `DayView.tsx` - Day-by-day event view with categorization
- `EventList.tsx` - Event listing with attendance toggles
- `FilterBar.tsx` - Multi-select dropdowns for accounts/calendars
- `CategoryBreakdown.tsx` - Aggregated time by color category
- `ColorPicker.tsx` - Dropdown color selector
- `DateNavigation.tsx` - Date picker with prev/next buttons
- `AccountFilter.tsx` - Account filtering component
- `AttendanceFilter.tsx` - Attendance status filter
- `BulkActionBar.tsx` - Bulk operations floating bar

**API Routes (11 total):**
- `/api/calendars` - List calendars and accounts
- `/api/events` - CRUD for events with filtering
- `/api/events/color` - Single event color update
- `/api/events/bulk-color` - Bulk color updates
- `/api/events/suggest` - AI category suggestions
- `/api/goals` - Weekly goals CRUD
- `/api/goals/sync` - Sync goals from Things3
- `/api/goals/progress-sync` - Sync goal progress
- `/api/goals/match` - Match events to goals
- `/api/non-goals` - Anti-pattern tracking
- `/api/summaries` - Aggregated time summaries
- `/api/preferences` - User preferences
- `/api/health` - Health check

**Shared Libraries:**
- `lib/db.ts` - Turso database client (880 lines)
- `lib/format.ts` - Time/date formatting utilities
- `lib/google-calendar-client.ts` - Google Calendar API client

**Tech Stack:**
- React 19, Next.js 16, TypeScript
- Turso (libSQL) for database
- recharts for data visualization
- Tailwind CSS 4 for styling
- Google Calendar API integration

---

## Expo/React Native Approach

### Why Expo/React Native?

**Strengths:**
1. **True native iOS experience** - Native UI components, gestures, animations
2. **Unified codebase** - Single codebase for iOS and web
3. **Code sharing** - 70-85% code reuse between platforms
4. **Expo ecosystem** - Simplified build/deploy, OTA updates, EAS Build
5. **React familiarity** - Existing React knowledge transfers directly
6. **Web support** - expo-web provides solid browser experience
7. **Mature ecosystem** - Large community, extensive libraries

**Trade-offs:**
1. **Learning curve** - React Native has different primitives (View vs div, Text vs span)
2. **Styling differences** - No CSS, uses StyleSheet (similar but not identical)
3. **recharts incompatibility** - Must switch to react-native-svg-charts or Victory Native
4. **Platform-specific code** - Some features require platform branching
5. **Bundle size** - Larger web bundle than pure web frameworks

---

## Proposed Architecture

### Monorepo Structure (Recommended)

```
me-os/
├── apps/
│   ├── mobile/                    # Expo/React Native app
│   │   ├── app/                   # Expo Router pages
│   │   │   ├── (tabs)/           # Tab-based navigation
│   │   │   │   ├── _layout.tsx   # Tab bar layout
│   │   │   │   ├── index.tsx     # Dashboard (Calendar tab)
│   │   │   │   ├── goals.tsx     # Goals tab
│   │   │   │   └── day.tsx       # Day view tab
│   │   │   └── _layout.tsx       # Root layout
│   │   ├── components/            # Mobile-specific components
│   │   │   ├── platform/          # Platform abstractions
│   │   │   │   ├── Chart.tsx     # Victory Native charts
│   │   │   │   └── DatePicker.tsx # Native date picker
│   │   │   └── navigation/        # Navigation components
│   │   ├── app.json               # Expo config
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                       # Backend API server
│       ├── routes/                # API route handlers
│       │   ├── calendars.ts
│       │   ├── events.ts
│       │   ├── goals.ts
│       │   └── ...
│       ├── index.ts               # Express/Fastify server
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                    # Shared business logic
│   │   ├── api/                   # API client (fetch wrapper)
│   │   │   ├── client.ts
│   │   │   ├── calendars.ts
│   │   │   ├── events.ts
│   │   │   └── goals.ts
│   │   ├── types/                 # Shared TypeScript types
│   │   │   ├── event.ts
│   │   │   ├── goal.ts
│   │   │   ├── calendar.ts
│   │   │   └── index.ts
│   │   ├── hooks/                 # Shared React hooks
│   │   │   ├── useEvents.ts
│   │   │   ├── useGoals.ts
│   │   │   ├── useCalendars.ts
│   │   │   └── useWeekNavigation.ts
│   │   ├── utils/                 # Pure utility functions
│   │   │   ├── format.ts         # Date/time formatting
│   │   │   ├── colors.ts         # Color definitions
│   │   │   └── week.ts           # Week calculations
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                        # Shared UI components
│       ├── primitives/            # Cross-platform primitives
│       │   ├── Box.tsx           # View/div abstraction
│       │   ├── Text.tsx          # Text component
│       │   ├── Pressable.tsx     # Touch/click handler
│       │   └── Input.tsx         # TextInput abstraction
│       ├── components/            # Platform-agnostic components
│       │   ├── EventCard.tsx
│       │   ├── GoalCard.tsx
│       │   ├── ProgressBar.tsx
│       │   ├── CategoryBadge.tsx
│       │   ├── FilterChip.tsx
│       │   └── ColorDot.tsx
│       ├── package.json
│       └── tsconfig.json
│
├── config/                        # Configuration (existing)
│   ├── colors.json
│   ├── turso.json
│   └── sensitive/
│
├── mcp/                          # MCP servers (existing)
│   └── google-calendar/
│
├── .claude/                      # Claude skills (existing)
│   └── skills/
│
├── turbo.json                    # Turborepo config
├── package.json                  # Root package.json
└── pnpm-workspace.yaml          # PNPM workspace config
```

### Package Dependencies

```json
// apps/mobile/package.json
{
  "name": "@me-os/mobile",
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react": "18.3.1",
    "react-native": "0.76.x",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "victory-native": "~41.0.0",
    "@shopify/react-native-skia": "~1.4.0",
    "nativewind": "~4.1.0",
    "@me-os/shared": "workspace:*",
    "@me-os/ui": "workspace:*"
  }
}
```

---

## Code Sharing Strategy

### What Can Be Shared (70-85%)

| Category | Shareable? | Notes |
|----------|-----------|-------|
| TypeScript types | 100% | All interfaces shared |
| API client | 100% | fetch works everywhere |
| Business logic | 100% | Pure functions, hooks |
| State management | 100% | React hooks, Zustand |
| Formatting utils | 100% | Date/time formatting |
| Color definitions | 100% | COLOR_MAP, meanings |
| Validation logic | 100% | Zod schemas |
| Custom hooks | 90% | Most hooks are portable |
| UI components | 60-70% | Need platform abstraction |
| Charts | 0% | Must use Victory Native |
| Navigation | 20% | Platform-specific |
| Styling | 50% | NativeWind vs Tailwind |

### Platform Abstraction Layer

```typescript
// packages/ui/primitives/Box.tsx
import { Platform } from 'react-native';

export const Box = Platform.select({
  native: () => require('react-native').View,
  web: () => require('react-native').View, // expo-web handles this
})();

// packages/ui/primitives/Pressable.tsx
import { Pressable as RNPressable, Platform } from 'react-native';
import { ComponentProps } from 'react';

interface PressableProps extends ComponentProps<typeof RNPressable> {
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

export function Pressable({ onHoverIn, onHoverOut, ...props }: PressableProps) {
  // Web supports hover, native doesn't
  const webProps = Platform.OS === 'web' ? { onHoverIn, onHoverOut } : {};
  return <RNPressable {...props} {...webProps} />;
}
```

### Shared Hook Example

```typescript
// packages/shared/hooks/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import { eventApi } from '../api/events';
import type { DbEvent } from '../types';

export function useEvents(options: {
  startDate: string;
  endDate: string;
  accounts?: string[];
  attended?: string[];
}) {
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await eventApi.getEvents(options);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [options.startDate, options.endDate, options.accounts?.join(',')]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const updateAttendance = async (eventId: string, attended: string) => {
    // Optimistic update
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, attended } : e
    ));

    try {
      await eventApi.updateAttendance(eventId, attended);
    } catch {
      fetchEvents(); // Revert on error
    }
  };

  return { events, loading, error, refetch: fetchEvents, updateAttendance };
}
```

---

## Platform-Specific Features

### iOS-Specific Enhancements

| Feature | Implementation |
|---------|---------------|
| Native date picker | `@react-native-community/datetimepicker` |
| Haptic feedback | `expo-haptics` |
| Pull-to-refresh | `RefreshControl` built-in |
| Native share | `expo-sharing` |
| Face ID/Touch ID | `expo-local-authentication` |
| Push notifications | `expo-notifications` |
| Calendar integration | `expo-calendar` (read device calendar) |
| Widget support | `expo-widgets` (iOS 17+) |

### Web-Specific Enhancements

| Feature | Implementation |
|---------|---------------|
| Keyboard shortcuts | Custom hook with `useEffect` |
| URL-based routing | expo-router handles this |
| Desktop hover states | `onHoverIn`/`onHoverOut` |
| Larger click targets | Responsive styles |
| PWA support | `expo-pwa` config |

### Platform Branching Pattern

```typescript
// apps/mobile/components/platform/DatePicker.tsx
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, Text } from '@me-os/ui';
import { formatDisplayDate } from '@me-os/shared';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    // Web: Use native HTML date input
    return (
      <input
        type="date"
        value={value.toISOString().split('T')[0]}
        onChange={(e) => onChange(new Date(e.target.value))}
        className="..."
      />
    );
  }

  // iOS: Use native date picker modal
  return (
    <>
      <Pressable onPress={() => setShowPicker(true)}>
        <Text>{formatDisplayDate(value)}</Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="spinner"
          onChange={(_, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}
    </>
  );
}
```

---

## Chart Migration Strategy

The current app uses `recharts` which is web-only. For React Native, we need `victory-native` or `react-native-svg-charts`.

### Recommended: Victory Native

```typescript
// apps/mobile/components/platform/PieChart.tsx
import { VictoryPie, VictoryTheme } from 'victory-native';
import { View } from 'react-native';

interface PieData {
  name: string;
  value: number;
  color: string;
}

export function PieChart({ data }: { data: PieData[] }) {
  const chartData = data.map(d => ({
    x: d.name,
    y: d.value,
  }));
  const colors = data.map(d => d.color);

  return (
    <View style={{ height: 300 }}>
      <VictoryPie
        data={chartData}
        colorScale={colors}
        theme={VictoryTheme.material}
        labelRadius={({ innerRadius }) => (innerRadius as number) + 30}
        style={{
          labels: { fontSize: 12, fill: '#333' }
        }}
      />
    </View>
  );
}
```

### Chart Component Mapping

| Current (recharts) | Expo (Victory Native) |
|--------------------|----------------------|
| `<PieChart>` + `<Pie>` | `<VictoryPie>` |
| `<BarChart>` + `<Bar>` | `<VictoryBar>` |
| `<ResponsiveContainer>` | `<View style={{flex:1}}>` |
| `<Tooltip>` | `<VictoryTooltip>` |
| `<Legend>` | `<VictoryLegend>` |
| `<Cell>` colors | `colorScale` prop |

---

## Migration Phases

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Set up monorepo structure
- Create shared packages
- Extract types and utilities

**Tasks:**
1. Initialize Turborepo with PNPM workspaces
2. Create `packages/shared` with types from `lib/db.ts`
3. Extract `lib/format.ts` to `packages/shared/utils/format.ts`
4. Create `COLOR_DEFINITIONS` in `packages/shared/utils/colors.ts`
5. Set up `packages/ui` with primitive components
6. Configure TypeScript path aliases

**Deliverable:** Shared packages building and tested

### Phase 2: API Layer (Week 2-3)

**Goals:**
- Extract API routes to standalone server
- Create API client package
- Maintain Next.js app during transition

**Tasks:**
1. Create `apps/api` with Express/Fastify server
2. Port API routes from Next.js (11 routes)
3. Create `packages/shared/api/client.ts` with typed fetch wrapper
4. Create per-resource API clients (events.ts, goals.ts, etc.)
5. Update Next.js app to use new API client (verify parity)
6. Add API integration tests

**Deliverable:** Standalone API server + typed client

### Phase 3: Expo App Setup (Week 3-4)

**Goals:**
- Create Expo app with expo-router
- Implement navigation structure
- Basic screens without data

**Tasks:**
1. Create `apps/mobile` with `npx create-expo-app`
2. Configure expo-router with tab-based navigation
3. Set up NativeWind for Tailwind-like styling
4. Create screen stubs matching current routes
5. Add Victory Native for charts
6. Configure expo-web for browser support
7. Test on iOS Simulator and web browser

**Deliverable:** Expo app skeleton running on iOS + web

### Phase 4: Component Migration (Week 4-6)

**Goals:**
- Port all components to React Native
- Use shared hooks and types
- Platform-specific implementations where needed

**Migration Order:**
1. **Primitives first** - Box, Text, Pressable, Input
2. **Simple components** - ColorDot, ProgressBar, CategoryBadge
3. **Data display** - EventCard, GoalCard, EventList
4. **Interactive** - ColorPicker, FilterBar, DateNavigation
5. **Complex** - CategoryBreakdown, Dashboard, WeeklyGoals
6. **Charts** - PieChart, BarChart (Victory Native)
7. **Platform-specific** - BulkActionBar, modals

**Tasks per component:**
1. Copy component to `apps/mobile/components/`
2. Replace HTML elements with RN primitives
3. Convert Tailwind to NativeWind or StyleSheet
4. Update imports to use shared packages
5. Test on both iOS and web

**Deliverable:** All screens functional on iOS + web

### Phase 5: Polish & Native Features (Week 6-7)

**Goals:**
- Add iOS-specific enhancements
- Optimize performance
- Add missing native capabilities

**Tasks:**
1. Add pull-to-refresh on all list views
2. Implement haptic feedback on interactions
3. Add native date/time pickers
4. Implement native share functionality
5. Add keyboard shortcuts for web
6. Performance optimization (memoization, virtualization)
7. Add loading skeletons/states

**Deliverable:** Polished app with native feel

### Phase 6: Testing & Release (Week 7-8)

**Goals:**
- Comprehensive testing
- App Store preparation
- Web deployment

**Tasks:**
1. Write E2E tests with Detox (iOS) and Playwright (web)
2. Manual testing on multiple iOS devices
3. Configure EAS Build for iOS
4. Create App Store assets (screenshots, descriptions)
5. Deploy API to hosting provider
6. Deploy web app (Vercel/Netlify)
7. TestFlight beta release
8. App Store submission

**Deliverable:** App live on iOS App Store + web

---

## Styling Strategy

### NativeWind (Tailwind for React Native)

NativeWind allows using Tailwind CSS classes in React Native:

```typescript
// Works on both iOS and web
import { View, Text, Pressable } from 'react-native';

export function EventCard({ event }) {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">
        {event.summary}
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {formatTime(event.start_time)}
      </Text>
    </View>
  );
}
```

### CSS Tailwind to NativeWind Mapping

Most classes work identically. Key differences:

| Tailwind Web | NativeWind |
|-------------|------------|
| `hover:bg-gray-100` | `active:bg-gray-100` (or Platform check) |
| `focus:ring-2` | Not supported (use border instead) |
| `cursor-pointer` | Not applicable |
| `overflow-y-auto` | Use `<ScrollView>` |
| `grid` | Use `flex` with wrapping |
| `table` | Use `<FlatList>` |

---

## Backend Architecture

### API Server Options

**Recommended: Keep Next.js API Routes as Backend**

The simplest migration path is to keep the Next.js app running as a pure API server:

```
apps/
├── mobile/          # Expo app (frontend)
└── backend/         # Next.js in API-only mode
    └── webapp/      # Existing webapp, stripped of pages
```

**Alternative: Extract to Express/Fastify**

For a cleaner separation:

```typescript
// apps/api/index.ts
import Fastify from 'fastify';
import { calendarRoutes } from './routes/calendars';
import { eventRoutes } from './routes/events';
import { goalRoutes } from './routes/goals';

const app = Fastify();

app.register(calendarRoutes, { prefix: '/api' });
app.register(eventRoutes, { prefix: '/api' });
app.register(goalRoutes, { prefix: '/api' });

app.listen({ port: 3000 });
```

### Database Access

The current Turso client works identically server-side. No changes needed to `lib/db.ts` functions.

---

## Risk Assessment

### High Risk

| Risk | Mitigation |
|------|-----------|
| recharts incompatibility | Start Victory Native integration early; design components chart-agnostic |
| Styling discrepancies | Use NativeWind from start; build design system with primitives |
| Expo SDK breaking changes | Pin versions; test upgrades in isolation |

### Medium Risk

| Risk | Mitigation |
|------|-----------|
| Performance on older iPhones | Profile early; use virtualized lists |
| Web bundle size | Tree-shaking; code splitting with expo-router |
| Google Calendar API on mobile | API server handles auth; mobile is pure frontend |

### Low Risk

| Risk | Mitigation |
|------|-----------|
| TypeScript compatibility | Strict mode shared across packages |
| Monorepo complexity | Turborepo handles caching and builds |
| Testing infrastructure | Detox for iOS, same Jest for unit tests |

---

## Maintenance Considerations

### Long-term Benefits

1. **Single codebase** - Bug fixes apply to both platforms
2. **Faster iteration** - Hot reload on iOS and web
3. **Expo EAS** - CI/CD for iOS builds without Mac
4. **OTA updates** - Push updates without App Store review
5. **Growing ecosystem** - React Native community support

### Ongoing Costs

1. **Expo SDK upgrades** - Quarterly major versions
2. **React Native upgrades** - Annual breaking changes
3. **Platform-specific testing** - Must test both regularly
4. **Apple Developer Program** - $99/year for App Store

### Recommended Testing Strategy

```
Unit Tests (Jest)
├── packages/shared/      # Pure function tests
├── packages/ui/          # Component snapshot tests
└── apps/mobile/          # Screen-level tests

Integration Tests
├── API tests (Supertest)  # Test all endpoints
└── Hook tests             # Test data fetching hooks

E2E Tests
├── Detox (iOS)            # Native app testing
└── Playwright (Web)       # Browser testing
```

---

## Decision Points

### 1. Monorepo Tool: Turborepo vs Nx

**Recommendation: Turborepo**
- Simpler setup
- Better caching
- Vercel integration
- Smaller learning curve

### 2. Package Manager: PNPM vs Yarn

**Recommendation: PNPM**
- Faster installs
- Strict dependency resolution
- Better monorepo support
- Smaller disk usage

### 3. State Management: Hooks vs Zustand vs TanStack Query

**Recommendation: TanStack Query + Hooks**
- Built-in caching
- Automatic refetching
- Devtools for debugging
- Works identically on all platforms

### 4. Routing: Expo Router vs React Navigation

**Recommendation: Expo Router**
- File-based routing (familiar from Next.js)
- Web URLs work automatically
- Better code splitting
- Type-safe routes

---

## Conclusion

The Expo/React Native approach provides the best balance of:

1. **Native iOS quality** - True native components and gestures
2. **Code sharing** - 70-85% shared between platforms
3. **Developer experience** - Hot reload, Expo tools, familiar React patterns
4. **Future flexibility** - Can add Android later if needed

The migration can be done incrementally over 6-8 weeks while maintaining the existing Next.js app. The main challenges are chart library migration and styling adaptation, both of which have well-established solutions.

---

## Critical Files for Implementation

1. **`webapp/lib/db.ts`** - Core database layer and types that must be extracted to shared package
2. **`webapp/app/components/Dashboard.tsx`** - Largest component with recharts integration; establishes patterns for chart migration
3. **`webapp/app/components/DayView.tsx`** - Most complex interactive component; demonstrates event handling patterns to port
4. **`webapp/lib/format.ts`** - Utility functions that can be directly copied to shared package
5. **`webapp/app/components/ColorPicker.tsx`** - Example of dropdown interaction needing platform-specific handling
