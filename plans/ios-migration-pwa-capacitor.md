# iOS Migration Plan: PWA + Capacitor

## Executive Summary

This plan proposes wrapping the **existing Next.js webapp with Capacitor** for native iOS distribution through the App Store, while also enhancing it as a Progressive Web App (PWA). This approach offers the fastest path to iOS with minimal code changes, though it comes with trade-offs around native feel and certain iOS-specific features like widgets.

---

## Current Architecture

### Existing Webapp Structure

```
webapp/
├── app/
│   ├── page.tsx              # Dashboard entry point
│   ├── day/page.tsx          # Day view route
│   ├── layout.tsx            # Root layout with fonts
│   ├── globals.css           # Tailwind v4 styles
│   ├── components/           # 12 React components
│   │   ├── Dashboard.tsx     # Main dashboard (627 LOC)
│   │   ├── DayView.tsx       # Day view (592 LOC)
│   │   ├── WeeklyGoals.tsx   # Goals tracking (470 LOC)
│   │   └── ...
│   └── api/                  # 13 API routes
├── lib/
│   ├── db.ts                 # Turso database (880 LOC)
│   ├── format.ts             # Formatting utilities
│   └── google-calendar-client.ts
└── package.json              # Next.js 16.1.6, React 19
```

### Key Technical Characteristics

1. **Server-Side Rendering**: Uses Next.js App Router with RSC
2. **Client Components**: Dashboard, DayView, WeeklyGoals marked "use client"
3. **Database**: Turso (LibSQL) via environment variables
4. **External APIs**: Google Calendar OAuth
5. **Charts**: Recharts for visualizations
6. **Styling**: Tailwind CSS v4

---

## PWA + Capacitor Approach

### Why This Approach?

**Strengths:**
1. **Fastest path to App Store** - 1-2 weeks vs 6-8 weeks
2. **Single codebase** - 95%+ code sharing
3. **Existing React skills** - No new language to learn
4. **Web standards** - Portable to Android later
5. **Minimal changes** - Mostly configuration, not code

**Trade-offs:**
1. **Limited native feel** - WKWebView, not native UI
2. **No widgets** - Requires native Swift code
3. **No Watch app** - Cannot be done in JS
4. **Performance** - Good but not native-level
5. **App Store risk** - Must demonstrate native value

---

## Architecture After Migration

```
me-os/
├── webapp/                      # Existing Next.js (enhanced)
│   ├── app/
│   │   ├── layout.tsx          # + PWA meta tags
│   │   ├── page.tsx
│   │   ├── components/
│   │   └── api/                # Unchanged
│   ├── lib/
│   │   ├── db.ts               # Unchanged
│   │   ├── api-client.ts       # NEW: Capacitor-aware fetch
│   │   ├── notifications.ts    # NEW: Push notifications
│   │   └── haptics.ts          # NEW: Haptic feedback
│   ├── public/
│   │   ├── manifest.json       # NEW: PWA manifest
│   │   ├── sw.js               # NEW: Service worker
│   │   └── icons/              # NEW: App icons
│   ├── ios/                    # NEW: Capacitor iOS project
│   │   ├── App/
│   │   │   ├── App.xcodeproj
│   │   │   ├── App.xcworkspace
│   │   │   └── App/
│   │   │       ├── Info.plist
│   │   │       ├── AppDelegate.swift
│   │   │       └── Assets.xcassets/
│   │   └── Podfile
│   ├── capacitor.config.ts     # NEW: Capacitor config
│   ├── next.config.ts          # Updated for PWA
│   └── package.json            # + Capacitor deps
└── config/                      # Existing
```

---

## Migration Phases

### Phase 1: PWA Foundation (1-2 days)

**Goal:** Add PWA capabilities for installability and caching.

#### 1.1 Create PWA Manifest

Create `/webapp/public/manifest.json`:

```json
{
  "name": "MeOS Calendar",
  "short_name": "MeOS",
  "description": "Personal calendar and goal tracking dashboard",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities"]
}
```

#### 1.2 Configure Next.js for PWA

Update `/webapp/next.config.ts`:

```typescript
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor
  output: process.env.CAPACITOR_BUILD ? "export" : undefined,

  // Disable image optimization for static export
  images: {
    unoptimized: process.env.CAPACITOR_BUILD === "true",
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

#### 1.3 Add Meta Tags to Layout

Update `/webapp/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "MeOS Calendar",
  description: "Personal calendar and goal tracking dashboard",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MeOS",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};
```

#### 1.4 Generate App Icons

Required icons:
- 192x192 PNG (PWA)
- 512x512 PNG (PWA splash)
- 180x180 PNG (Apple touch icon)
- 1024x1024 PNG (App Store)

---

### Phase 2: Capacitor Integration (2-3 days)

**Goal:** Wrap PWA with Capacitor for native iOS distribution.

#### 2.1 Install Dependencies

```bash
cd webapp
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/splash-screen @capacitor/status-bar
npm install @capacitor/haptics @capacitor/push-notifications
npm install @capacitor/local-notifications
```

#### 2.2 Create Capacitor Config

Create `/webapp/capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meos.calendar",
  appName: "MeOS",
  webDir: "out",
  server: {
    // For production: use bundled static files
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#0a0a0a",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
```

#### 2.3 Add Build Scripts

Update `/webapp/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:ios": "CAPACITOR_BUILD=true next build && npx cap sync ios",
    "ios:dev": "npx cap open ios",
    "ios:run": "npx cap run ios",
    "ios:build": "npm run build:ios && npx cap copy ios"
  }
}
```

#### 2.4 Initialize iOS Platform

```bash
npx cap add ios
npx cap sync
```

#### 2.5 Create Capacitor-Aware API Client

Create `/webapp/lib/api-client.ts`:

```typescript
import { Capacitor } from "@capacitor/core";

export function getApiBaseUrl(): string {
  // In Capacitor, use the hosted API
  if (Capacitor.isNativePlatform()) {
    return process.env.NEXT_PUBLIC_API_URL || "https://api.meos.app";
  }
  // In browser, use relative URLs
  return "";
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

#### 2.6 Add Safe Area CSS

Add to `/webapp/app/globals.css`:

```css
/* Safe areas for iOS notch and home indicator */
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-left {
  padding-left: env(safe-area-inset-left);
}

.safe-right {
  padding-right: env(safe-area-inset-right);
}

/* Disable text selection for native feel */
.native-feel {
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Smooth scrolling with momentum */
.scroll-native {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Full height on iOS */
html, body {
  height: 100%;
  height: -webkit-fill-available;
}
```

---

### Phase 3: Native Feature Integration (3-5 days)

**Goal:** Add native iOS capabilities via Capacitor plugins.

#### 3.1 Haptic Feedback

Create `/webapp/lib/haptics.ts`:

```typescript
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export async function lightHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function mediumHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function successHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Success });
}

export async function errorHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Error });
}

export async function selectionHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  await Haptics.selectionStart();
}
```

Usage in components:

```typescript
// In ColorPicker.tsx
const handleColorSelect = async (colorId: string) => {
  await mediumHaptic();
  onColorChange(colorId);
};
```

#### 3.2 Push Notifications

Create `/webapp/lib/notifications.ts`:

```typescript
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  // Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  // Register for push
  await PushNotifications.register();

  // Handle registration
  PushNotifications.addListener("registration", (token) => {
    console.log("Push token:", token.value);
    // Send token to backend
  });

  // Handle incoming notifications
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push received:", notification);
  });

  // Handle notification tap
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("Push action:", action);
    // Navigate to relevant screen
  });
}
```

#### 3.3 Local Notifications

Create `/webapp/lib/local-notifications.ts`:

```typescript
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

export async function scheduleGoalReminder(goal: {
  id: string;
  title: string;
  reminderTime: Date;
}) {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: hashStringToNumber(goal.id),
        title: "Goal Reminder",
        body: goal.title,
        schedule: { at: goal.reminderTime },
        extra: { goalId: goal.id },
      },
    ],
  });
}

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}
```

#### 3.4 Status Bar Configuration

Add to app initialization:

```typescript
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

export async function configureStatusBar() {
  if (!Capacitor.isNativePlatform()) return;

  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#0a0a0a" });
}
```

---

### Phase 4: App Store Preparation (1-2 days)

**Goal:** Prepare iOS app for App Store submission.

#### 4.1 Xcode Configuration

In Xcode (`ios/App/App.xcworkspace`):

- Bundle identifier: `com.meos.calendar`
- Version: `1.0.0`
- Build: `1`
- Deployment target: iOS 15.0+
- Device family: iPhone
- Capabilities:
  - Push Notifications
  - Background Modes (Remote notifications)

#### 4.2 App Icons

Generate all required sizes in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`:

| Size | Scale | Filename |
|------|-------|----------|
| 20pt | 2x | Icon-20@2x.png |
| 20pt | 3x | Icon-20@3x.png |
| 29pt | 2x | Icon-29@2x.png |
| 29pt | 3x | Icon-29@3x.png |
| 40pt | 2x | Icon-40@2x.png |
| 40pt | 3x | Icon-40@3x.png |
| 60pt | 2x | Icon-60@2x.png |
| 60pt | 3x | Icon-60@3x.png |
| 1024pt | 1x | Icon-1024.png |

#### 4.3 Privacy Descriptions

Add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Used to scan handwritten notes</string>
<key>NSMicrophoneUsageDescription</key>
<string>Used to record voice notes</string>
<key>NSCalendarsUsageDescription</key>
<string>MeOS syncs with your calendar</string>
```

#### 4.4 App Store Connect

1. Create app in App Store Connect
2. Upload screenshots for:
   - iPhone 15 Pro Max (6.7")
   - iPhone SE (4.7")
3. Write app description
4. Set pricing (Free)
5. Submit for review

---

## API Architecture

### Decision: Hosted API

For Capacitor to work, the iOS app needs to call APIs over HTTP. Options:

**Option A: Host Next.js API (Recommended)**

Deploy the Next.js app to Vercel/Railway and use its API routes:

```
iOS App (Capacitor)
    │
    ▼ HTTP
Next.js API (Vercel)
    │
    ▼
Turso Database
```

**Option B: Separate API Server**

Extract API routes to standalone server:

```
iOS App          Web App
    │               │
    └──────┬────────┘
           ▼
    Express/Fastify API
           │
           ▼
    Turso Database
```

### Environment Configuration

```typescript
// webapp/.env.local (web)
NEXT_PUBLIC_API_URL=""  // Empty for relative URLs

// webapp/.env.production (Capacitor)
NEXT_PUBLIC_API_URL="https://api.meos.app"
```

---

## Trade-offs and Limitations

### Advantages

| Advantage | Description |
|-----------|-------------|
| Speed | 1-2 weeks to App Store |
| Code sharing | 95%+ shared |
| Single codebase | One repo, one deploy |
| Existing skills | No Swift required |
| Web parity | Same features everywhere |

### Limitations

| Limitation | Severity | Workaround |
|------------|----------|------------|
| No widgets | **High** | Requires native Swift WidgetKit |
| No Watch app | High | Cannot be done with Capacitor |
| Not fully native feel | Medium | Haptics, animations help |
| Performance | Low | WKWebView is fast |
| App Store risk | Low | Apple approves hybrid apps |
| Offline limited | Medium | Service Worker + IndexedDB |

### Widget Limitation (Critical)

**Widgets require native Swift code.** If widgets are important:

1. **Hybrid approach**: Capacitor for main app + native widget extension
2. **Switch to native**: Use the Native Swift plan instead

To add widgets to a Capacitor app, you'd need to:
1. Create a WidgetKit extension in Xcode
2. Write Swift code for the widget
3. Share data via App Groups
4. This adds Swift maintenance burden

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest |
| `public/icons/*` | App icons |
| `capacitor.config.ts` | Capacitor configuration |
| `lib/api-client.ts` | Capacitor-aware fetch |
| `lib/haptics.ts` | Haptic feedback |
| `lib/notifications.ts` | Push notifications |
| `lib/local-notifications.ts` | Local reminders |
| `ios/` | Capacitor iOS project |

### Modified Files

| File | Changes |
|------|---------|
| `next.config.ts` | PWA + static export config |
| `app/layout.tsx` | PWA meta tags, safe areas |
| `app/globals.css` | Safe area CSS |
| `package.json` | Capacitor dependencies, scripts |
| `app/components/*.tsx` | Add haptic feedback calls |

---

## Development Workflow

### Local Development

```bash
# Standard web development
npm run dev

# Build for iOS
npm run build:ios

# Open in Xcode
npm run ios:dev

# Run in Simulator (from Xcode or CLI)
npm run ios:run
```

### Deployment

```bash
# Web: Deploy to Vercel
vercel deploy

# iOS: Build in Xcode
# 1. Open ios/App/App.xcworkspace
# 2. Select "Any iOS Device"
# 3. Product > Archive
# 4. Distribute App > App Store Connect
```

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: PWA | 1-2 days | Installable PWA |
| Phase 2: Capacitor | 2-3 days | iOS app running in Simulator |
| Phase 3: Native features | 3-5 days | Haptics, notifications |
| Phase 4: App Store | 1-2 days | App submitted |
| **Total** | **1-2 weeks** | **App on App Store** |

---

## When to Choose This Approach

**Choose PWA + Capacitor if:**
- Speed to market is priority
- Widgets are not critical
- Team has web expertise, not Swift
- Budget/time is limited
- You want to validate iOS demand first

**Don't choose if:**
- Widgets are essential (use Native Swift)
- Premium native feel is required
- Apple Watch support needed
- Performance is critical

---

## Critical Files for Implementation

1. **`webapp/next.config.ts`** - Add PWA and static export configuration
2. **`webapp/app/layout.tsx`** - Add PWA meta tags and viewport settings
3. **`webapp/capacitor.config.ts`** - New file: Capacitor configuration
4. **`webapp/lib/api-client.ts`** - New file: Capacitor-aware API client
5. **`webapp/app/globals.css`** - Add safe area and native-feel CSS

---

## Conclusion

The PWA + Capacitor approach offers the fastest path to the App Store with minimal code changes. It's ideal for validating iOS demand or when widgets aren't critical. However, for the best native experience including widgets, consider the Native Swift approach instead.
