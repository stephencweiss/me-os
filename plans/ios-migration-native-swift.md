# iOS Migration Plan: Native Swift + Next.js Web

## Executive Summary

This plan proposes building a **native Swift iOS application** using SwiftUI alongside the existing Next.js web application. Both platforms share a common backend API layer and Turso database. The trade-off is code duplication at the UI layer in exchange for the best possible native iOS experience, including full WidgetKit support, Apple Watch integration, and premium native feel.

---

## Current State Analysis

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
│   │   ├── BulkActionBar.tsx # Bulk operations (434 LOC)
│   │   ├── FilterBar.tsx     # Filter controls (191 LOC)
│   │   └── ...
│   └── api/                  # 13 API routes
│       ├── events/           # Event CRUD
│       ├── goals/            # Goals management
│       ├── calendars/        # Calendar listing
│       └── ...
├── lib/
│   ├── db.ts                 # Turso database client (880 LOC)
│   ├── format.ts             # Formatting utilities
│   └── google-calendar-client.ts  # Google API client (241 LOC)
└── package.json              # Next.js 16.1.6, React 19.2.3
```

### Key Data Types (from lib/db.ts)

```typescript
// These will be mirrored in Swift
interface DbEvent {
  id: string;
  google_id: string;
  calendar_id: string;
  account_email: string;
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  color_id?: string;
  attended?: string;
  // ... more fields
}

interface DbWeeklyGoal {
  id: string;
  week_id: string;
  title: string;
  target_hours?: number;
  logged_hours: number;
  status: string;
  source?: string;
  // ... more fields
}
```

---

## Native Swift Approach

### Why Native Swift?

**Strengths:**
1. **Best iOS UX** - Native animations, haptics, system integration
2. **Performance** - Native code, optimized for iOS
3. **Full Apple Ecosystem** - WidgetKit, WatchOS, Shortcuts, CarPlay
4. **Future-proof** - SwiftUI is Apple's direction
5. **Web Independence** - Can enhance web without iOS constraints
6. **Premium Feel** - Users can tell the difference

**Trade-offs:**
1. **Code Duplication** - ~60-70% of UI logic duplicated
2. **Skill Requirements** - Need Swift/SwiftUI expertise
3. **Feature Drift Risk** - Platforms may get out of sync
4. **Testing Overhead** - Two test suites required
5. **Longer Initial Development** - 8-9 weeks vs 3-4 weeks for hybrid

---

## Proposed Architecture

### High-Level Structure

```
me-os/
├── webapp/                      # Existing Next.js (unchanged)
│   ├── app/
│   ├── lib/
│   └── ...
│
├── ios/                         # NEW: Native Swift app
│   ├── MeOS.xcodeproj
│   ├── MeOS/
│   │   ├── App/
│   │   │   ├── MeOSApp.swift
│   │   │   └── AppState.swift
│   │   ├── Models/
│   │   │   ├── Event.swift
│   │   │   ├── Goal.swift
│   │   │   ├── NonGoal.swift
│   │   │   ├── DailySummary.swift
│   │   │   └── ColorDefinition.swift
│   │   ├── Services/
│   │   │   ├── APIClient.swift
│   │   │   ├── EventService.swift
│   │   │   ├── GoalService.swift
│   │   │   ├── CalendarService.swift
│   │   │   └── SyncService.swift
│   │   ├── ViewModels/
│   │   │   ├── DashboardViewModel.swift
│   │   │   ├── DayViewModel.swift
│   │   │   ├── GoalsViewModel.swift
│   │   │   └── EventDetailViewModel.swift
│   │   ├── Views/
│   │   │   ├── Dashboard/
│   │   │   ├── DayView/
│   │   │   ├── Goals/
│   │   │   ├── Components/
│   │   │   └── TabBar/
│   │   ├── Utilities/
│   │   │   ├── DateFormatters.swift
│   │   │   ├── WeekIDCalculator.swift
│   │   │   └── ColorMapper.swift
│   │   └── Resources/
│   │       ├── Assets.xcassets
│   │       └── Info.plist
│   ├── MeOSWidget/              # iOS Widget Extension
│   │   ├── MeOSWidget.swift
│   │   ├── TodayProvider.swift
│   │   └── GoalsProvider.swift
│   ├── MeOSWatch/               # Apple Watch App (optional)
│   │   └── ...
│   ├── MeOSTests/
│   └── MeOSUITests/
│
├── shared/                      # NEW: Shared configuration
│   └── api-types/
│       ├── openapi.yaml         # API contract
│       └── types.ts             # TypeScript types (source of truth)
│
├── config/                      # Existing
│   ├── colors.json
│   └── ...
│
└── mcp/                         # Existing MCP servers
    └── google-calendar/
```

### iOS Project Structure Detail

```
ios/MeOS/
├── App/
│   ├── MeOSApp.swift           # @main entry point
│   └── AppState.swift          # Global app state (ObservableObject)
│
├── Models/
│   ├── Event.swift             # Codable struct matching DbEvent
│   ├── Goal.swift              # Codable struct matching DbWeeklyGoal
│   ├── NonGoal.swift           # Non-goal alerts
│   ├── DailySummary.swift      # Aggregated daily data
│   ├── Calendar.swift          # Calendar metadata
│   └── ColorDefinition.swift   # Google Calendar colors (1-11)
│
├── Services/
│   ├── APIClient.swift         # Generic HTTP client with async/await
│   ├── EventService.swift      # /api/events endpoints
│   ├── GoalService.swift       # /api/goals endpoints
│   ├── CalendarService.swift   # /api/calendars endpoints
│   ├── SummaryService.swift    # /api/summaries endpoints
│   └── AuthService.swift       # Token management (if needed)
│
├── ViewModels/
│   ├── DashboardViewModel.swift    # Dashboard state and logic
│   ├── DayViewModel.swift          # Day view state
│   ├── GoalsViewModel.swift        # Goals list state
│   ├── EventDetailViewModel.swift  # Single event editing
│   └── FilterViewModel.swift       # Account/calendar filtering
│
├── Views/
│   ├── Dashboard/
│   │   ├── DashboardView.swift         # Main dashboard container
│   │   ├── DashboardTabView.swift      # Calendar/Goals tab picker
│   │   ├── CategoryPieChart.swift      # Swift Charts pie chart
│   │   ├── DailyBarChart.swift         # Swift Charts bar chart
│   │   ├── SummaryCards.swift          # Quick stats cards
│   │   └── CategoryBreakdown.swift     # Time by category list
│   │
│   ├── DayView/
│   │   ├── DayView.swift               # Single day container
│   │   ├── EventRow.swift              # Event list item
│   │   ├── EventDetailSheet.swift      # Event editing sheet
│   │   ├── ColorPickerView.swift       # Color selection grid
│   │   ├── AttendanceToggle.swift      # Attended/Skipped/Unknown
│   │   └── BulkEditBar.swift           # Multi-select actions
│   │
│   ├── Goals/
│   │   ├── GoalsView.swift             # Goals list container
│   │   ├── GoalRow.swift               # Goal list item
│   │   ├── ProgressBar.swift           # Animated progress bar
│   │   ├── NonGoalAlert.swift          # Anti-pattern warning
│   │   └── GoalDetailSheet.swift       # Goal editing
│   │
│   ├── Components/
│   │   ├── DateNavigator.swift         # Week/day navigation
│   │   ├── AccountFilterView.swift     # Account multi-select
│   │   ├── CalendarFilterView.swift    # Calendar multi-select
│   │   ├── LoadingView.swift           # Loading spinner
│   │   ├── ErrorView.swift             # Error state
│   │   └── EmptyStateView.swift        # No data state
│   │
│   └── TabBar/
│       └── MainTabView.swift           # Root tab bar
│
├── Utilities/
│   ├── DateFormatters.swift    # Date formatting (matching lib/format.ts)
│   ├── WeekIDCalculator.swift  # Week ID logic (YYYY-WWW)
│   ├── ColorMapper.swift       # Google color ID to SwiftUI Color
│   └── HapticManager.swift     # Centralized haptic feedback
│
└── Resources/
    ├── Assets.xcassets/
    │   ├── AppIcon.appiconset/
    │   ├── Colors/             # Named colors matching web
    │   └── Images/
    ├── Info.plist
    └── Localizable.strings
```

---

## Swift Model Examples

### Event Model

```swift
// ios/MeOS/Models/Event.swift
import Foundation

struct Event: Codable, Identifiable, Hashable {
    let id: String
    let googleId: String
    let calendarId: String
    let accountEmail: String
    let summary: String
    let description: String?
    let startTime: Date
    let endTime: Date
    var colorId: String?
    var attended: AttendanceStatus?
    let isAllDay: Bool
    let isRecurring: Bool
    let htmlLink: String?

    enum CodingKeys: String, CodingKey {
        case id
        case googleId = "google_id"
        case calendarId = "calendar_id"
        case accountEmail = "account_email"
        case summary
        case description
        case startTime = "start_time"
        case endTime = "end_time"
        case colorId = "color_id"
        case attended
        case isAllDay = "is_all_day"
        case isRecurring = "is_recurring"
        case htmlLink = "html_link"
    }

    var duration: TimeInterval {
        endTime.timeIntervalSince(startTime)
    }

    var durationHours: Double {
        duration / 3600
    }
}

enum AttendanceStatus: String, Codable {
    case attended
    case skipped
    case unknown
}
```

### Goal Model

```swift
// ios/MeOS/Models/Goal.swift
import Foundation

struct Goal: Codable, Identifiable, Hashable {
    let id: String
    let weekId: String
    let title: String
    let targetHours: Double?
    var loggedHours: Double
    var status: GoalStatus
    let source: String?
    let thingsId: String?
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case weekId = "week_id"
        case title
        case targetHours = "target_hours"
        case loggedHours = "logged_hours"
        case status
        case source
        case thingsId = "things_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var progress: Double {
        guard let target = targetHours, target > 0 else { return 0 }
        return min(loggedHours / target, 1.0)
    }

    var isComplete: Bool {
        status == .completed
    }
}

enum GoalStatus: String, Codable {
    case active
    case completed
    case cancelled
}
```

---

## API Client Implementation

```swift
// ios/MeOS/Services/APIClient.swift
import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init() {
        // Configure base URL (could be from environment/config)
        self.baseURL = URL(string: "https://api.meos.app")!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601

        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = query?.map { URLQueryItem(name: $0.key, value: $0.value) }

        let (data, response) = try await session.data(from: components.url!)
        try validateResponse(response)
        return try decoder.decode(T.self, from: data)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decoder.decode(T.self, from: data)
    }

    func patch<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decoder.decode(T.self, from: data)
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
    }
}

enum APIError: Error, LocalizedError {
    case invalidResponse
    case httpError(statusCode: Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "Server error: \(code)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        }
    }
}
```

### Event Service

```swift
// ios/MeOS/Services/EventService.swift
import Foundation

struct EventService {
    private let client = APIClient.shared

    struct EventsResponse: Decodable {
        let events: [Event]
        let total: Int
    }

    func fetchEvents(
        start: Date,
        end: Date,
        accounts: [String]? = nil,
        attended: [String]? = nil
    ) async throws -> [Event] {
        var query: [String: String] = [
            "start": ISO8601DateFormatter().string(from: start),
            "end": ISO8601DateFormatter().string(from: end)
        ]

        if let accounts = accounts, !accounts.isEmpty {
            query["accounts"] = accounts.joined(separator: ",")
        }

        if let attended = attended, !attended.isEmpty {
            query["attended"] = attended.joined(separator: ",")
        }

        let response: EventsResponse = try await client.get("/api/events", query: query)
        return response.events
    }

    func updateEventColor(eventId: String, colorId: String) async throws -> Event {
        struct ColorUpdate: Encodable {
            let eventId: String
            let colorId: String
        }
        return try await client.patch("/api/events/color", body: ColorUpdate(eventId: eventId, colorId: colorId))
    }

    func updateAttendance(eventId: String, attended: AttendanceStatus) async throws -> Event {
        struct AttendanceUpdate: Encodable {
            let eventId: String
            let attended: String
        }
        return try await client.patch("/api/events", body: AttendanceUpdate(eventId: eventId, attended: attended.rawValue))
    }
}
```

---

## SwiftUI View Examples

### Dashboard View

```swift
// ios/MeOS/Views/Dashboard/DashboardView.swift
import SwiftUI
import Charts

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var activeTab: DashboardTab = .calendar
    @State private var selectedDays: Int = 7

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab Picker
                Picker("View", selection: $activeTab) {
                    Text("Calendar").tag(DashboardTab.calendar)
                    Text("Goals").tag(DashboardTab.goals)
                }
                .pickerStyle(.segmented)
                .padding()

                // Days selector (Calendar tab only)
                if activeTab == .calendar {
                    DaysSelector(selected: $selectedDays)
                        .padding(.horizontal)
                }

                // Content
                ScrollView {
                    switch activeTab {
                    case .calendar:
                        CalendarDashboardContent(
                            viewModel: viewModel,
                            days: selectedDays
                        )
                    case .goals:
                        GoalsDashboardContent(viewModel: viewModel)
                    }
                }
                .refreshable {
                    await viewModel.refresh()
                }
            }
            .navigationTitle("MeOS")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { viewModel.showFilters = true }) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showFilters) {
                FilterSheet(viewModel: viewModel)
            }
        }
        .task {
            await viewModel.loadInitialData()
        }
    }
}

enum DashboardTab {
    case calendar
    case goals
}

struct DaysSelector: View {
    @Binding var selected: Int
    let options = [7, 14, 30]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { days in
                Button {
                    withAnimation { selected = days }
                } label: {
                    Text("\(days)d")
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(selected == days ? Color.accentColor : Color.secondary.opacity(0.1))
                        .foregroundColor(selected == days ? .white : .primary)
                        .clipShape(Capsule())
                }
            }
            Spacer()
        }
    }
}
```

### Category Pie Chart (Swift Charts)

```swift
// ios/MeOS/Views/Dashboard/CategoryPieChart.swift
import SwiftUI
import Charts

struct CategoryPieChart: View {
    let data: [CategoryData]

    var body: some View {
        Chart(data) { category in
            SectorMark(
                angle: .value("Hours", category.hours),
                innerRadius: .ratio(0.5),
                angularInset: 1.5
            )
            .foregroundStyle(category.color)
            .cornerRadius(4)
        }
        .chartLegend(position: .bottom, spacing: 16) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                ForEach(data) { category in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(category.color)
                            .frame(width: 8, height: 8)
                        Text(category.name)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
        }
        .frame(height: 250)
    }
}

struct CategoryData: Identifiable {
    let id = UUID()
    let name: String
    let hours: Double
    let color: Color
}
```

### Event Row

```swift
// ios/MeOS/Views/DayView/EventRow.swift
import SwiftUI

struct EventRow: View {
    let event: Event
    let onColorTap: () -> Void
    let onAttendanceTap: () -> Void
    @State private var isPressed = false

    var body: some View {
        HStack(spacing: 12) {
            // Color indicator (tappable)
            Button(action: onColorTap) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(ColorMapper.color(for: event.colorId))
                    .frame(width: 6, height: 50)
            }
            .buttonStyle(.plain)

            // Event info
            VStack(alignment: .leading, spacing: 4) {
                Text(event.summary)
                    .font(.body.weight(.medium))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Label(formatTimeRange(event.startTime, event.endTime), systemImage: "clock")
                    Label(formatDuration(event.duration), systemImage: "hourglass")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            // Attendance toggle
            AttendanceButton(
                status: event.attended ?? .unknown,
                action: onAttendanceTap
            )
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .sensoryFeedback(.selection, trigger: isPressed)
    }

    private func formatTimeRange(_ start: Date, _ end: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: start)) - \(formatter.string(from: end))"
    }

    private func formatDuration(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }
}

struct AttendanceButton: View {
    let status: AttendanceStatus
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: iconName)
                .foregroundStyle(iconColor)
                .font(.title3)
        }
        .buttonStyle(.plain)
    }

    private var iconName: String {
        switch status {
        case .attended: return "checkmark.circle.fill"
        case .skipped: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle"
        }
    }

    private var iconColor: Color {
        switch status {
        case .attended: return .green
        case .skipped: return .red
        case .unknown: return .secondary
        }
    }
}
```

---

## Widget Extension (Detailed Specifications)

Widgets are a key differentiator for the native iOS approach. This section provides comprehensive specifications for all planned widgets.

### Widget Overview

| Widget | Purpose | Sizes | Interactive |
|--------|---------|-------|-------------|
| **Next Up** | Show next upcoming event | Small, Medium | Tap to open |
| **Today's Schedule** | Full day agenda | Medium, Large | Tap events |
| **Weekly Goals** | Goal progress tracking | Small, Medium, Large | Toggle complete |
| **Category Breakdown** | Time by category | Small, Medium | Tap to filter |
| **Quick Categorize** | Categorize uncategorized events | Medium, Large | Color buttons |
| **Focus Timer** | Active event countdown | Small, Accessory | Tap to skip |

### Widget Architecture

```
ios/
├── MeOS/                           # Main app
│   ├── Shared/                     # Code shared with widgets
│   │   ├── Models/                 # Event, Goal, etc.
│   │   ├── Services/               # API client
│   │   └── Utilities/              # Formatters, colors
│   └── ...
│
├── MeOSWidgetExtension/            # Widget extension target
│   ├── MeOSWidgets.swift           # @main WidgetBundle
│   ├── Providers/
│   │   ├── NextUpProvider.swift
│   │   ├── TodayScheduleProvider.swift
│   │   ├── WeeklyGoalsProvider.swift
│   │   ├── CategoryProvider.swift
│   │   ├── QuickCategorizeProvider.swift
│   │   └── FocusTimerProvider.swift
│   ├── Views/
│   │   ├── NextUp/
│   │   │   ├── NextUpSmall.swift
│   │   │   └── NextUpMedium.swift
│   │   ├── TodaySchedule/
│   │   │   ├── TodayMedium.swift
│   │   │   └── TodayLarge.swift
│   │   ├── Goals/
│   │   │   ├── GoalsSmall.swift
│   │   │   ├── GoalsMedium.swift
│   │   │   └── GoalsLarge.swift
│   │   ├── Category/
│   │   │   ├── CategorySmall.swift
│   │   │   └── CategoryMedium.swift
│   │   ├── QuickCategorize/
│   │   │   ├── QuickCategorizeMedium.swift
│   │   │   └── QuickCategorizeLarge.swift
│   │   └── FocusTimer/
│   │       ├── FocusSmall.swift
│   │       └── FocusAccessory.swift
│   ├── Intents/
│   │   ├── SetColorIntent.swift    # Interactive: set event color
│   │   ├── ToggleGoalIntent.swift  # Interactive: mark goal complete
│   │   └── SkipEventIntent.swift   # Interactive: mark as skipped
│   └── Assets.xcassets/
│
└── Shared/                         # App Group shared container
    └── AppGroup.swift              # Shared data access
```

### Data Sharing Strategy

Widgets run in a separate process and cannot directly access the main app's data. Use **App Groups** for shared data.

#### App Group Setup

1. Enable App Groups capability in both main app and widget extension
2. Use shared container: `group.com.meos.calendar`

```swift
// Shared/AppGroup.swift
import Foundation

struct AppGroup {
    static let identifier = "group.com.meos.calendar"

    static var containerURL: URL {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: identifier
        )!
    }

    static var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: identifier)!
    }
}
```

#### Shared Data Store

```swift
// Shared/WidgetDataStore.swift
import Foundation

actor WidgetDataStore {
    static let shared = WidgetDataStore()

    private let fileURL = AppGroup.containerURL.appendingPathComponent("widget-data.json")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    struct WidgetData: Codable {
        var todayEvents: [Event]
        var weeklyGoals: [Goal]
        var uncategorizedEvents: [Event]
        var categorySummary: [CategorySummary]
        var lastUpdated: Date
    }

    struct CategorySummary: Codable, Identifiable {
        let id: String  // color ID
        let name: String
        let hours: Double
        let color: String  // hex color
    }

    func save(_ data: WidgetData) throws {
        let encoded = try encoder.encode(data)
        try encoded.write(to: fileURL)

        // Store last updated in UserDefaults for quick access
        AppGroup.sharedDefaults.set(Date(), forKey: "lastWidgetUpdate")
    }

    func load() throws -> WidgetData {
        let data = try Data(contentsOf: fileURL)
        return try decoder.decode(WidgetData.self, from: data)
    }

    func loadOrDefault() -> WidgetData {
        (try? load()) ?? WidgetData(
            todayEvents: [],
            weeklyGoals: [],
            uncategorizedEvents: [],
            categorySummary: [],
            lastUpdated: .distantPast
        )
    }
}
```

#### Main App Updates Widget Data

```swift
// In main app, after any data change:
func updateWidgetData() async {
    let todayStart = Calendar.current.startOfDay(for: Date())
    let todayEnd = Calendar.current.date(byAdding: .day, value: 1, to: todayStart)!

    async let eventsTask = EventService().fetchEvents(start: todayStart, end: todayEnd)
    async let goalsTask = GoalService().fetchGoals(weekId: currentWeekId)
    async let summaryTask = SummaryService().fetchCategorySummary(days: 7)

    let (events, goals, summary) = try await (eventsTask, goalsTask, summaryTask)

    let uncategorized = events.filter { $0.colorId == nil || $0.colorId == "0" }

    let widgetData = WidgetDataStore.WidgetData(
        todayEvents: events,
        weeklyGoals: goals,
        uncategorizedEvents: Array(uncategorized.prefix(10)),
        categorySummary: summary,
        lastUpdated: Date()
    )

    try await WidgetDataStore.shared.save(widgetData)

    // Tell WidgetKit to refresh
    WidgetCenter.shared.reloadAllTimelines()
}
```

---

### Widget 1: Next Up (Primary Widget)

Shows the next upcoming event with countdown.

#### Sizes and Layouts

**Small (2x2)**
```
┌─────────────────────┐
│ NEXT UP             │
│                     │
│ Team Standup        │
│ in 23 min           │
│                     │
│ 🔵 9:00 AM          │
└─────────────────────┘
```

**Medium (4x2)**
```
┌───────────────────────────────────────────┐
│ NEXT UP                          in 23 min│
│                                           │
│ 🔵 Team Standup                           │
│    9:00 - 9:30 AM · 30 min · Zoom         │
│                                           │
│ After: Design Review (10:00 AM)           │
└───────────────────────────────────────────┘
```

#### Implementation

```swift
// MeOSWidgetExtension/Providers/NextUpProvider.swift
import WidgetKit
import SwiftUI

struct NextUpEntry: TimelineEntry {
    let date: Date
    let nextEvent: Event?
    let followingEvent: Event?
    let totalEventsToday: Int
}

struct NextUpProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextUpEntry {
        NextUpEntry(
            date: Date(),
            nextEvent: Event.placeholder,
            followingEvent: nil,
            totalEventsToday: 5
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NextUpEntry) -> Void) {
        let data = WidgetDataStore.shared.loadOrDefault()
        let entry = makeEntry(from: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextUpEntry>) -> Void) {
        Task {
            // Fetch fresh data if stale (> 5 min old)
            var data = WidgetDataStore.shared.loadOrDefault()

            if data.lastUpdated.timeIntervalSinceNow < -300 {
                // Refresh from API
                if let fresh = try? await fetchFreshData() {
                    data = fresh
                    try? await WidgetDataStore.shared.save(data)
                }
            }

            // Create timeline entries for upcoming events
            var entries: [NextUpEntry] = []
            let now = Date()

            // Entry for right now
            entries.append(makeEntry(from: data, at: now))

            // Entry for when current event ends (if in a meeting)
            if let current = data.todayEvents.first(where: { $0.startTime <= now && $0.endTime > now }) {
                entries.append(makeEntry(from: data, at: current.endTime))
            }

            // Entry for when next event starts
            if let next = data.todayEvents.first(where: { $0.startTime > now }) {
                entries.append(makeEntry(from: data, at: next.startTime))
            }

            // Refresh policy: when next event starts or in 15 min
            let nextRefresh = entries.dropFirst().first?.date
                ?? Calendar.current.date(byAdding: .minute, value: 15, to: now)!

            let timeline = Timeline(entries: entries, policy: .after(nextRefresh))
            completion(timeline)
        }
    }

    private func makeEntry(from data: WidgetDataStore.WidgetData, at date: Date = Date()) -> NextUpEntry {
        let upcomingEvents = data.todayEvents
            .filter { $0.startTime > date }
            .sorted { $0.startTime < $1.startTime }

        return NextUpEntry(
            date: date,
            nextEvent: upcomingEvents.first,
            followingEvent: upcomingEvents.dropFirst().first,
            totalEventsToday: data.todayEvents.count
        )
    }
}
```

```swift
// MeOSWidgetExtension/Views/NextUp/NextUpSmall.swift
import SwiftUI
import WidgetKit

struct NextUpSmallView: View {
    let entry: NextUpEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header
            Text("NEXT UP")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)

            if let event = entry.nextEvent {
                Spacer()

                // Event title
                Text(event.summary)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)

                // Countdown
                Text(event.startTime, style: .relative)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)

                Spacer()

                // Time with color indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(ColorMapper.color(for: event.colorId))
                        .frame(width: 8, height: 8)
                    Text(event.startTime, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Spacer()

                Image(systemName: "checkmark.circle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.green)

                Text("All done!")
                    .font(.headline)

                Spacer()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(URL(string: "meos://day/\(entry.date.ISO8601Format())"))
    }
}

struct NextUpMediumView: View {
    let entry: NextUpEntry

    var body: some View {
        HStack(spacing: 16) {
            // Left: Current/Next event
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("NEXT UP")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Spacer()

                    if let event = entry.nextEvent {
                        Text(event.startTime, style: .relative)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.orange)
                    }
                }

                if let event = entry.nextEvent {
                    Spacer()

                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(ColorMapper.color(for: event.colorId))
                            .frame(width: 4)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.summary)
                                .font(.headline)
                                .lineLimit(1)

                            HStack(spacing: 8) {
                                Text("\(event.startTime, style: .time) - \(event.endTime, style: .time)")
                                Text("·")
                                Text(formatDuration(event.duration))
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()

                    // Following event
                    if let following = entry.followingEvent {
                        HStack(spacing: 4) {
                            Text("After:")
                                .foregroundStyle(.tertiary)
                            Text(following.summary)
                                .lineLimit(1)
                            Text("(\(following.startTime, style: .time))")
                                .foregroundStyle(.tertiary)
                        }
                        .font(.caption)
                    }
                } else {
                    Spacer()

                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("No more events today")
                    }
                    .font(.subheadline)

                    Spacer()
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }

    private func formatDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        if minutes >= 60 {
            let hours = minutes / 60
            let mins = minutes % 60
            return mins > 0 ? "\(hours)h \(mins)m" : "\(hours)h"
        }
        return "\(minutes)m"
    }
}
```

---

### Widget 2: Today's Schedule

Full agenda view for the day.

#### Sizes and Layouts

**Medium (4x2)** - Compact list
```
┌───────────────────────────────────────────┐
│ TODAY · March 8                  5 events │
├───────────────────────────────────────────┤
│ 🔵 9:00  Team Standup            30m      │
│ 🟢 10:00 Design Review           1h       │
│ 🟡 12:00 Lunch with Sarah        1h       │
│ +2 more                                   │
└───────────────────────────────────────────┘
```

**Large (4x4)** - Full timeline
```
┌───────────────────────────────────────────┐
│ TODAY · Saturday, March 8        5 events │
├───────────────────────────────────────────┤
│                                           │
│  9:00 ──🔵── Team Standup                 │
│              30 min · Zoom                │
│                                           │
│ 10:00 ──🟢── Design Review                │
│              1 hour · Conference Room     │
│                                           │
│ 12:00 ──🟡── Lunch with Sarah             │
│              1 hour · Cafe Milano         │
│                                           │
│  2:00 ──🔴── Project Planning             │
│              2 hours                      │
│                                           │
│  4:00 ──⚪── Uncategorized Meeting        │
│              1 hour                       │
│                                           │
└───────────────────────────────────────────┘
```

#### Implementation

```swift
// MeOSWidgetExtension/Views/TodaySchedule/TodayLarge.swift
import SwiftUI
import WidgetKit

struct TodayLargeView: View {
    let entry: TodayScheduleEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("TODAY")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(entry.date, format: .dateTime.weekday(.wide).month().day())
                        .font(.headline)
                }

                Spacer()

                Text("\(entry.events.count) events")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            // Timeline
            if entry.events.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.checkmark")
                        .font(.largeTitle)
                        .foregroundStyle(.green)
                    Text("No events scheduled")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(entry.events.prefix(6)) { event in
                            TimelineEventRow(event: event, isNow: event.isHappeningNow)
                        }

                        if entry.events.count > 6 {
                            Text("+\(entry.events.count - 6) more")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.leading, 44)
                        }
                    }
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct TimelineEventRow: View {
    let event: Event
    let isNow: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Time column
            Text(event.startTime, format: .dateTime.hour().minute())
                .font(.caption.monospacedDigit())
                .foregroundStyle(isNow ? .primary : .secondary)
                .frame(width: 40, alignment: .trailing)

            // Color line
            VStack(spacing: 0) {
                Circle()
                    .fill(ColorMapper.color(for: event.colorId))
                    .frame(width: 10, height: 10)
                Rectangle()
                    .fill(ColorMapper.color(for: event.colorId).opacity(0.3))
                    .frame(width: 2)
            }

            // Event details
            VStack(alignment: .leading, spacing: 2) {
                Text(event.summary)
                    .font(.subheadline.weight(isNow ? .semibold : .regular))
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Text(formatDuration(event.duration))
                    if let location = event.location, !location.isEmpty {
                        Text("·")
                        Text(location)
                            .lineLimit(1)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .opacity(event.endTime < Date() ? 0.5 : 1.0)
    }
}
```

---

### Widget 3: Weekly Goals

Shows goal progress for the current week.

#### Sizes and Layouts

**Small (2x2)** - Single goal focus
```
┌─────────────────────┐
│ WEEKLY GOALS        │
│                     │
│ Deep Work           │
│ ████████░░ 8/10h    │
│                     │
│ 3 of 5 complete     │
└─────────────────────┘
```

**Medium (4x2)** - Multiple goals
```
┌───────────────────────────────────────────┐
│ WEEKLY GOALS · Week 10           3/5 done │
├───────────────────────────────────────────┤
│ ✓ Ship widget feature      10/10h   100%  │
│ ● Deep work sessions        8/10h    80%  │
│ ● Exercise 3x               1/3      33%  │
│ ○ Read chapter 5            0/2h      0%  │
└───────────────────────────────────────────┘
```

**Large (4x4)** - Full detail with non-goals
```
┌───────────────────────────────────────────┐
│ WEEKLY GOALS                     Week 10  │
│ 3 of 5 complete · 24h logged              │
├───────────────────────────────────────────┤
│                                           │
│ ✓ Ship widget feature                     │
│   ████████████████████  10/10h     Done   │
│                                           │
│ ● Deep work sessions                      │
│   ████████████████░░░░   8/10h      80%   │
│                                           │
│ ● Exercise 3x this week                   │
│   █████░░░░░░░░░░░░░░░   1/3        33%   │
│                                           │
│ ○ Read chapter 5                          │
│   ░░░░░░░░░░░░░░░░░░░░   0/2h        0%   │
│                                           │
├───────────────────────────────────────────┤
│ ⚠️ Non-goal alert: 6h in meetings (>5h)   │
└───────────────────────────────────────────┘
```

#### Interactive Widget (iOS 17+)

Users can tap to mark goals complete directly from the widget.

```swift
// MeOSWidgetExtension/Intents/ToggleGoalIntent.swift
import AppIntents
import WidgetKit

struct ToggleGoalIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Goal"
    static var description = IntentDescription("Mark a goal as complete or incomplete")

    @Parameter(title: "Goal ID")
    var goalId: String

    init() {}

    init(goalId: String) {
        self.goalId = goalId
    }

    func perform() async throws -> some IntentResult {
        // Update goal status via API
        let service = GoalService()
        let goal = try await service.fetchGoal(id: goalId)

        let newStatus: GoalStatus = goal.status == .completed ? .active : .completed
        try await service.updateGoalStatus(goalId: goalId, status: newStatus)

        // Refresh widget
        WidgetCenter.shared.reloadTimelines(ofKind: "WeeklyGoalsWidget")

        return .result()
    }
}
```

```swift
// Interactive goal row
struct InteractiveGoalRow: View {
    let goal: Goal

    var body: some View {
        Button(intent: ToggleGoalIntent(goalId: goal.id)) {
            HStack {
                // Status icon
                Image(systemName: goal.status == .completed ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(goal.status == .completed ? .green : .secondary)

                // Goal title
                Text(goal.title)
                    .strikethrough(goal.status == .completed)
                    .lineLimit(1)

                Spacer()

                // Progress
                if let target = goal.targetHours {
                    Text("\(Int(goal.loggedHours))/\(Int(target))h")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Percentage
                Text("\(Int(goal.progress * 100))%")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(progressColor)
            }
        }
        .buttonStyle(.plain)
    }

    var progressColor: Color {
        switch goal.progress {
        case 0..<0.25: return .red
        case 0.25..<0.5: return .orange
        case 0.5..<0.75: return .yellow
        case 0.75..<1.0: return .blue
        default: return .green
        }
    }
}
```

---

### Widget 4: Quick Categorize

Allows categorizing uncategorized events directly from the widget.

#### Layout (Medium)
```
┌───────────────────────────────────────────┐
│ UNCATEGORIZED · 3 events                  │
├───────────────────────────────────────────┤
│ Team Sync (2:00 PM)                       │
│ [🔵][🟢][🟡][🔴][🟣][⚫] [Skip]           │
│                                           │
│ Project Review (4:00 PM)                  │
│ [🔵][🟢][🟡][🔴][🟣][⚫] [Skip]           │
└───────────────────────────────────────────┘
```

#### Implementation

```swift
// MeOSWidgetExtension/Intents/SetColorIntent.swift
import AppIntents
import WidgetKit

struct SetColorIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Event Color"
    static var description = IntentDescription("Categorize an event by setting its color")

    @Parameter(title: "Event ID")
    var eventId: String

    @Parameter(title: "Color ID")
    var colorId: String

    init() {}

    init(eventId: String, colorId: String) {
        self.eventId = eventId
        self.colorId = colorId
    }

    func perform() async throws -> some IntentResult {
        let service = EventService()
        try await service.updateEventColor(eventId: eventId, colorId: colorId)

        // Provide haptic feedback
        // Note: Haptics not available in widget, but app will handle

        // Refresh widgets
        WidgetCenter.shared.reloadTimelines(ofKind: "QuickCategorizeWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "CategoryWidget")

        return .result()
    }
}

struct SkipEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Skip Event"
    static var description = IntentDescription("Mark an event as skipped")

    @Parameter(title: "Event ID")
    var eventId: String

    init() {}

    init(eventId: String) {
        self.eventId = eventId
    }

    func perform() async throws -> some IntentResult {
        let service = EventService()
        try await service.updateAttendance(eventId: eventId, attended: .skipped)

        WidgetCenter.shared.reloadTimelines(ofKind: "QuickCategorizeWidget")

        return .result()
    }
}
```

```swift
// MeOSWidgetExtension/Views/QuickCategorize/QuickCategorizeMedium.swift
import SwiftUI
import WidgetKit

struct QuickCategorizeMediumView: View {
    let entry: QuickCategorizeEntry

    // Common colors for quick access (subset of all 11)
    let quickColors = ["1", "2", "5", "6", "9", "11"]  // Lavender, Sage, Banana, Tangerine, Blueberry, Tomato

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("UNCATEGORIZED")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()

                Text("\(entry.uncategorizedEvents.count) events")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if entry.uncategorizedEvents.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title)
                            .foregroundStyle(.green)
                        Text("All categorized!")
                            .font(.caption)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(entry.uncategorizedEvents.prefix(2)) { event in
                    VStack(alignment: .leading, spacing: 6) {
                        // Event name and time
                        HStack {
                            Text(event.summary)
                                .font(.subheadline)
                                .lineLimit(1)
                            Spacer()
                            Text(event.startTime, style: .time)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        // Color buttons
                        HStack(spacing: 6) {
                            ForEach(quickColors, id: \.self) { colorId in
                                Button(intent: SetColorIntent(eventId: event.id, colorId: colorId)) {
                                    Circle()
                                        .fill(ColorMapper.color(for: colorId))
                                        .frame(width: 24, height: 24)
                                }
                                .buttonStyle(.plain)
                            }

                            Spacer()

                            // Skip button
                            Button(intent: SkipEventIntent(eventId: event.id)) {
                                Text("Skip")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.secondary.opacity(0.2))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if event.id != entry.uncategorizedEvents.prefix(2).last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
}
```

---

### Widget 5: Category Breakdown

Shows time distribution by category.

#### Layout (Small)
```
┌─────────────────────┐
│ THIS WEEK           │
│     ┌───┐           │
│    ╱     ╲  24.5h   │
│   │  PIE  │ total   │
│    ╲     ╱          │
│     └───┘           │
│ 🔵 8h  🟢 6h  ...   │
└─────────────────────┘
```

```swift
// MeOSWidgetExtension/Views/Category/CategorySmall.swift
import SwiftUI
import Charts
import WidgetKit

struct CategorySmallView: View {
    let entry: CategoryEntry

    var body: some View {
        VStack(spacing: 4) {
            Text("THIS WEEK")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)

            // Mini pie chart
            Chart(entry.categories.prefix(5)) { category in
                SectorMark(
                    angle: .value("Hours", category.hours),
                    innerRadius: .ratio(0.5)
                )
                .foregroundStyle(Color(hex: category.color))
            }
            .chartLegend(.hidden)
            .frame(width: 80, height: 80)
            .overlay {
                VStack(spacing: 0) {
                    Text(String(format: "%.1f", entry.totalHours))
                        .font(.headline.monospacedDigit())
                    Text("hours")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // Top categories legend
            HStack(spacing: 8) {
                ForEach(entry.categories.prefix(3)) { category in
                    HStack(spacing: 2) {
                        Circle()
                            .fill(Color(hex: category.color))
                            .frame(width: 6, height: 6)
                        Text("\(Int(category.hours))h")
                            .font(.caption2)
                    }
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(URL(string: "meos://dashboard?tab=calendar"))
    }
}
```

---

### Widget 6: Lock Screen Widgets (Accessory)

iOS 16+ supports Lock Screen widgets.

#### Accessory Circular - Next Event Time
```
  ┌───┐
 │9:00│
 │ AM │
  └───┘
```

#### Accessory Rectangular - Next Event
```
┌─────────────┐
│Team Standup │
│9:00 AM · 30m│
└─────────────┘
```

#### Accessory Inline - Countdown
```
Next: Team Standup in 23 min
```

```swift
// MeOSWidgetExtension/Views/FocusTimer/FocusAccessory.swift
import SwiftUI
import WidgetKit

struct FocusAccessoryCircularView: View {
    let entry: FocusEntry

    var body: some View {
        if let event = entry.currentOrNextEvent {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(event.startTime, format: .dateTime.hour())
                        .font(.headline)
                    Text(event.startTime, format: .dateTime.minute())
                        .font(.caption2)
                }
            }
        } else {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "checkmark")
                    .font(.title2)
            }
        }
    }
}

struct FocusAccessoryRectangularView: View {
    let entry: FocusEntry

    var body: some View {
        if let event = entry.currentOrNextEvent {
            VStack(alignment: .leading, spacing: 2) {
                Text(event.summary)
                    .font(.headline)
                    .lineLimit(1)
                HStack {
                    Text(event.startTime, style: .time)
                    Text("·")
                    Text(formatDuration(event.duration))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        } else {
            HStack {
                Image(systemName: "calendar.badge.checkmark")
                Text("No upcoming events")
            }
            .font(.caption)
        }
    }
}

struct FocusAccessoryInlineView: View {
    let entry: FocusEntry

    var body: some View {
        if let event = entry.currentOrNextEvent {
            if event.isHappeningNow {
                Text("Now: \(event.summary)")
            } else {
                Text("Next: \(event.summary) \(event.startTime, style: .relative)")
            }
        } else {
            Text("No more events today")
        }
    }
}
```

---

### Widget Refresh Strategy

```swift
// Refresh triggers:
// 1. Time-based: Every 15 minutes via timeline policy
// 2. Event-based: When user makes changes in main app
// 3. Background: When app wakes for background refresh

// In main app's ScenePhase handler:
.onChange(of: scenePhase) { _, newPhase in
    if newPhase == .background {
        // Schedule background task to refresh widget data
        BGTaskScheduler.shared.submit(
            BGAppRefreshTaskRequest(identifier: "com.meos.widget-refresh")
        )
    }
}

// Background task handler:
func handleWidgetRefresh(task: BGAppRefreshTask) {
    Task {
        await updateWidgetData()
        task.setTaskCompleted(success: true)
    }
}
```

---

### Deep Linking from Widgets

```swift
// URL scheme: meos://
// Routes:
// - meos://day/{date}         → Open day view for date
// - meos://event/{eventId}    → Open event detail
// - meos://goals              → Open goals tab
// - meos://dashboard?tab=X    → Open dashboard with tab

// In main app:
@main
struct MeOSApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    func handleDeepLink(_ url: URL) {
        guard url.scheme == "meos" else { return }

        switch url.host {
        case "day":
            if let dateString = url.pathComponents.last,
               let date = ISO8601DateFormatter().date(from: dateString) {
                navigateToDay(date)
            }
        case "event":
            if let eventId = url.pathComponents.last {
                navigateToEvent(eventId)
            }
        case "goals":
            navigateToGoals()
        case "dashboard":
            if let tab = url.queryParameters["tab"] {
                navigateToDashboard(tab: tab)
            }
        default:
            break
        }
    }
}
```

---

### Widget Bundle Registration

```swift
// MeOSWidgetExtension/MeOSWidgets.swift
import WidgetKit
import SwiftUI

@main
struct MeOSWidgets: WidgetBundle {
    var body: some Widget {
        // Home Screen Widgets
        NextUpWidget()
        TodayScheduleWidget()
        WeeklyGoalsWidget()
        CategoryBreakdownWidget()
        QuickCategorizeWidget()

        // Lock Screen Widgets
        FocusTimerWidget()
    }
}

struct NextUpWidget: Widget {
    let kind = "NextUpWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextUpProvider()) { entry in
            NextUpWidgetView(entry: entry)
        }
        .configurationDisplayName("Next Up")
        .description("See your next upcoming event")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct TodayScheduleWidget: Widget {
    let kind = "TodayScheduleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayScheduleProvider()) { entry in
            TodayScheduleWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's Schedule")
        .description("View your full day at a glance")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct WeeklyGoalsWidget: Widget {
    let kind = "WeeklyGoalsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeeklyGoalsProvider()) { entry in
            WeeklyGoalsWidgetView(entry: entry)
        }
        .configurationDisplayName("Weekly Goals")
        .description("Track your weekly goal progress")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct CategoryBreakdownWidget: Widget {
    let kind = "CategoryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CategoryProvider()) { entry in
            CategoryWidgetView(entry: entry)
        }
        .configurationDisplayName("Time Breakdown")
        .description("See how you're spending your time")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct QuickCategorizeWidget: Widget {
    let kind = "QuickCategorizeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickCategorizeProvider()) { entry in
            QuickCategorizeWidgetView(entry: entry)
        }
        .configurationDisplayName("Quick Categorize")
        .description("Categorize events right from your home screen")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct FocusTimerWidget: Widget {
    let kind = "FocusTimerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusTimerProvider()) { entry in
            FocusTimerWidgetView(entry: entry)
        }
        .configurationDisplayName("Focus Timer")
        .description("Quick glance at current or next event")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .systemSmall
        ])
    }
}
```

---

### Widget Development Timeline

| Phase | Widget | Effort | Priority |
|-------|--------|--------|----------|
| Week 7 | Next Up (Small/Medium) | 2 days | P0 |
| Week 7 | Today's Schedule (Medium/Large) | 2 days | P0 |
| Week 7 | Weekly Goals (All sizes) | 2 days | P0 |
| Week 8 | Category Breakdown | 1 day | P1 |
| Week 8 | Quick Categorize (Interactive) | 2 days | P1 |
| Week 8 | Lock Screen Widgets | 1 day | P2 |

---

### Widget Testing Checklist

- [ ] Placeholder renders correctly for widget gallery
- [ ] Snapshot provides meaningful preview
- [ ] Timeline generates appropriate entries
- [ ] Refresh policy is reasonable (not too frequent)
- [ ] Deep links navigate correctly
- [ ] Interactive buttons trigger intents
- [ ] Dark mode supported
- [ ] Dynamic Type supported
- [ ] All widget sizes render without clipping
- [ ] Empty states handled gracefully
- [ ] Error states handled gracefully
- [ ] App Group data sharing works
- [ ] Background refresh updates data

---

## Migration Phases

### Phase 1: Shared Backend API Layer (Week 1-2)

**Goals:**
- Document and stabilize API contract
- Add simple auth layer if needed
- Create OpenAPI spec

**Tasks:**
1. Document all existing API endpoints in OpenAPI format
2. Ensure consistent response shapes
3. Add API versioning header
4. Create shared types export (TypeScript source of truth)
5. Set up API integration tests

**Deliverable:** Stable, documented API that both web and iOS can consume

### Phase 2: iOS Project Setup (Week 2-3)

**Goals:**
- Establish iOS project foundation
- Set up architecture and patterns
- Create basic navigation

**Tasks:**
1. Create Xcode project with SwiftUI App lifecycle
2. Set up folder structure (MVVM)
3. Implement `APIClient` with async/await
4. Create Swift models matching TypeScript types
5. Implement basic tab navigation
6. Configure for iOS 16+ deployment

**Deliverable:** iOS project compiling with basic navigation

### Phase 3: Core iOS Features (Week 3-6)

**Goals:**
- Implement all main screens
- Match feature parity with web

**Week 3-4: Dashboard**
1. Dashboard container with tab picker
2. Swift Charts pie chart for categories
3. Swift Charts bar chart for daily hours
4. Summary cards
5. Filter sheet

**Week 4-5: Day View**
1. Day view with date navigation
2. Event list with color indicators
3. Event row with attendance toggle
4. Color picker sheet
5. Bulk selection mode
6. Pull-to-refresh

**Week 5-6: Goals**
1. Goals list with week navigation
2. Goal row with progress bar
3. Non-goal alerts
4. Goal detail/edit sheet
5. Things 3 sync trigger

**Deliverable:** Feature-complete iOS app

### Phase 4: Data Synchronization (Week 5-7)

**Goals:**
- Ensure reliable data sync
- Handle errors gracefully

**Tasks:**
1. Implement optimistic updates
2. Add retry logic for failed requests
3. Implement pull-to-refresh everywhere
4. Add loading and error states
5. Consider background refresh

**Deliverable:** Reliable data sync with good error handling

### Phase 5: iOS-Specific Enhancements (Week 7-8)

**Goals:**
- Add native iOS features
- Polish the experience

**Tasks:**
1. **Widgets**: Today's schedule, goal progress
2. **Haptic feedback**: On interactions
3. **Shortcuts**: "What's on my calendar?"
4. **Face ID** (optional): Secure access
5. **Push notifications** (optional): Goal reminders
6. **Watch app** (optional): Glanceable stats

**Deliverable:** Polished iOS app with native features

### Phase 6: Testing & Release (Week 8-9)

**Goals:**
- Comprehensive testing
- App Store submission

**Tasks:**
1. Write unit tests for ViewModels
2. Write UI tests for critical flows
3. Manual testing on multiple devices
4. Create App Store assets
5. TestFlight beta
6. App Store submission

**Deliverable:** App live on App Store

---

## Keeping Platforms in Sync

### Feature Parity Matrix

Maintain a living document tracking feature parity:

```markdown
| Feature                  | Web | iOS | Notes                    |
|--------------------------|-----|-----|--------------------------|
| Dashboard pie chart      | Yes | Yes |                          |
| Dashboard bar chart      | Yes | Yes |                          |
| Day view                 | Yes | Yes |                          |
| Bulk color selection     | Yes | Yes |                          |
| Goals tracking           | Yes | Yes |                          |
| Non-goal alerts          | Yes | Yes |                          |
| iOS widgets              | N/A | Yes | iOS-only                 |
| Apple Watch              | N/A | Yes | iOS-only                 |
| Keyboard shortcuts       | Yes | N/A | Web-only                 |
```

### API Contract as Single Source of Truth

- All data operations go through the same REST API
- OpenAPI spec serves as the contract
- Breaking API changes require updates to both clients
- Use semantic versioning for API

### Parallel Development Workflow

When adding a new feature:
1. Design the API changes first (if any)
2. Update OpenAPI spec
3. Implement API changes
4. Implement in web (or iOS)
5. Implement in the other platform
6. Update feature matrix
7. Test both platforms

---

## Trade-offs and Risks

### Advantages

| Advantage | Impact |
|-----------|--------|
| Best iOS UX | Premium native feel, animations, haptics |
| Full Apple ecosystem | Widgets, Watch, Shortcuts, CarPlay |
| Performance | Native code, optimized for iOS |
| Future-proof | SwiftUI is Apple's direction |
| Web independence | Can enhance web without iOS constraints |

### Disadvantages

| Disadvantage | Mitigation |
|--------------|------------|
| Code duplication (~60-70% UI) | Strong API contract; shared config |
| Feature drift risk | Feature matrix; synchronized releases |
| Maintenance burden (1.8x) | Clear ownership; dedicated time |
| Testing overhead (2 suites) | CI/CD for both; shared API tests |
| Longer initial dev (8-9 weeks) | Worth it for native quality |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Feature drift | Medium | Maintain feature matrix; review regularly |
| API breaking changes | Medium | Version API; coordinate releases |
| Swift learning curve | Low | SwiftUI is approachable; good docs |
| App Store rejection | Low | Follow HIG; test thoroughly |
| Maintenance burden | Medium | Budget time; consider priorities |

---

## Long-term Maintenance

### Annual Maintenance Estimate

- **Web (Next.js)**: ~4-6 hours/month
- **iOS (Swift)**: ~4-6 hours/month
- **API Layer**: ~2-4 hours/month
- **Feature Development**: ~1.8x multiplier (not 2x due to shared API)

### iOS Version Support

- Target iOS 16+ (SwiftUI maturity, Swift Charts)
- Annual iOS beta testing (WWDC -> September release)
- Deprecate old iOS versions yearly

### Tooling

- **Xcode**: Latest stable
- **Swift**: Latest stable
- **Dependencies**: Swift Package Manager
- **CI/CD**: Xcode Cloud or Fastlane + GitHub Actions

---

## Critical Files for Implementation

1. **`webapp/lib/db.ts`** - Core data access layer (880 lines). Must understand all data shapes to mirror in Swift models.

2. **`webapp/app/components/Dashboard.tsx`** - Primary UI reference (627 lines). Contains the main React component structure to replicate in SwiftUI.

3. **`webapp/app/components/DayView.tsx`** - Complex interaction patterns (592 lines). Shows bulk selection, color picking, optimistic updates.

4. **`webapp/app/api/events/route.ts`** - API contract (120 lines). Defines the REST interface iOS will consume.

5. **`config/colors.json`** - Color definitions. Load in Swift for consistency.

---

## Conclusion

The Native Swift approach is recommended when:
- Premium iOS experience is a priority
- Widgets and Watch app are important features
- Long-term iOS investment is planned
- Team has or can acquire Swift expertise

The additional development time (8-9 weeks vs 3-4 weeks for hybrid) and ongoing maintenance burden (~1.8x) are justified by the superior user experience and full access to Apple's ecosystem.
