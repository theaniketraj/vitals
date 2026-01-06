# Usage Statistics Collection

This document explains how Vitals collects anonymous usage statistics to improve the extension.

## Overview

Vitals includes an opt-in usage statistics collection system that helps us understand how users interact with the extension. This data is **anonymized** and used solely to improve features and user experience.

## What Gets Tracked

### 1. Session Information

```typescript
{
  sessionId: string,           // Random ID, changes each session
  sessionStartTime: string,    // ISO timestamp
  sessionDuration: number,     // Milliseconds
}
```

### 2. Command Execution

```typescript
{
  commandsExecuted: {          // Anonymized counts
    "vitals.openDashboard": 5,
    "vitals.showStatus": 2,
    // ... more commands
  }
}
```

### 3. Feature Usage

```typescript
{
  dashboardOpens: number,       // How many times dashboard opened
  dashboardViewDuration: number, // Total time viewing dashboard (ms)
  metricsViewed: number,        // Metrics fetch count
  logsViewed: number,           // Logs fetch count
  alertsViewed: number          // Alerts fetch count
}
```

### 4. System Information

```typescript
{
  platform: string,             // e.g., "win32-x64"
  vscodeVersion: string,        // e.g., "1.94.0"
  extensionVersion: string      // e.g., "0.3.0"
}
```

### 5. Error Tracking

```typescript
{
  errors: [
    { type: "prometheus_metrics_fetch_failed", count: 3 },
    { type: "prometheus_alerts_fetch_failed", count: 1 },
  ];
}
```

## What Is NOT Tracked

❌ **Your Code**: No source code or file contents  
❌ **File Paths**: No project names or directory structures  
❌ **Metric Values**: No actual Prometheus data or query results  
❌ **Log Contents**: No log messages or sensitive data  
❌ **Personal Info**: Beyond GitHub username (from OAuth)  
❌ **Keystroke Data**: No typing patterns or editor activity

## Data Flow

```bash
1. Extension tracks actions locally
   ↓
2. Every 5 minutes (configurable), stats are aggregated
   ↓
3. If telemetry enabled, send anonymized data to backend
   ↓
4. Stored in DynamoDB with user's GitHub ID
   ↓
5. Used for analytics and improvement
```

## Configuration

### Enable/Disable Telemetry

**Via Settings UI:**

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Vitals: Enable Telemetry"
3. Toggle the checkbox

**Via settings.json:**

```json
{
  "vitals.enableTelemetry": false // Disable telemetry
}
```

### Change Save Interval

**Via Settings UI:**

1. Open VS Code Settings
2. Search for "Vitals: Telemetry Save Interval"
3. Set interval in minutes (1-60)

**Via settings.json:**

```json
{
  "vitals.telemetrySaveInterval": 10 // Save every 10 minutes
}
```

## Events Tracked

### 1. `extension_activated`

Logged when extension loads (only for authenticated users)

```typescript
{
  timestamp: "2025-12-05T10:30:00Z",
  extensionVersion: "0.3.0"
}
```

### 2. `dashboard_opened`

Logged when user opens Vitals dashboard

```typescript
{
  timestamp: "2025-12-05T10:31:00Z";
}
```

### 3. `usage_statistics`

Saved periodically (default: every 5 minutes)

```typescript
{
  sessionId: "1733398200000-abc123",
  sessionDuration: 300000,
  commandsExecuted: { "vitals.openDashboard": 2 },
  dashboardOpens: 2,
  metricsViewed: 8,
  platform: "win32-x64",
  errors: []
}
```

### 4. `daily_summary`

Generated at extension deactivation

```typescript
{
  date: "2025-12-05",
  totalSessions: 1,
  totalCommands: 5,
  topCommands: { "vitals.openDashboard": 2, ... },
  featureUsage: { metrics: 8, logs: 3, alerts: 1 },
  errorStats: [...]
}
```

### 5. `user_signed_in`

Logged after successful GitHub authentication

```typescript
{
  username: "theaniketraj",
  timestamp: "2025-12-05T10:00:00Z"
}
```

## Anonymization

All personally identifiable patterns are removed:

**Before Anonymization:**

```typescript
commandsExecuted: [
  "vitals.openDashboard",
  "vitals.showStatus",
  "vitals.openDashboard",
  "vitals.openDashboard",
];
```

**After Anonymization:**

```typescript
commandsExecuted: {
  "vitals.openDashboard": 3,
  "vitals.showStatus": 1
}
```

This ensures:

- No timestamp sequences
- No behavioral patterns
- Only aggregate counts

## Backend Storage

### DynamoDB Schema

**User Profile:**

```bash
PK: USER#12345678
SK: PROFILE
{
  githubId: "12345678",
  username: "theaniketraj",
  email: "user@example.com",
  createdAt: "2025-12-05T10:00:00Z",
  lastLogin: "2025-12-05T10:00:00Z"
}
```

**Usage Event:**

```bash
PK: USER#12345678
SK: EVENT#1733398200000
{
  eventName: "usage_statistics",
  timestamp: "2025-12-05T10:30:00Z",
  properties: { ... }
}
```

### Data Retention

- Events are retained for **90 days**
- User profiles persist until account deletion requested

## Opting Out

**Complete Opt-Out:**

```json
{
  "vitals.enableTelemetry": false
}
```

When disabled:

- ✅ Stats are still tracked locally (for your own viewing)
- ❌ Nothing is sent to backend
- ❌ No network requests for telemetry
- ✅ All extension features work normally

## Privacy Compliance

Vitals follows privacy best practices:

- ✅ **GDPR Compliant**: Right to access, delete, export data
- ✅ **Transparent**: This documentation clearly states what we collect
- ✅ **Opt-Out Available**: Easy to disable via settings
- ✅ **Data Minimization**: Only collect what's needed
- ✅ **Secure Storage**: HTTPS + AWS encryption
- ✅ **No Third-Party Sharing**: Data never sold or shared

## Viewing Your Data

To see what data has been collected about you:

1. Contact us via GitHub Issues
2. Provide your GitHub username
3. We'll export your data within 7 days

## Requesting Deletion

To delete all your collected data:

1. Open issue: <https://github.com/theaniketraj/vitals/issues>
2. Request data deletion
3. We'll delete within 30 days and confirm

## Code Implementation

### UsageStatsCollector Class

Located in: `src/telemetry/usageStats.ts`

**Key Methods:**

- `trackCommand(commandName)` - Track command execution
- `trackFeature(feature)` - Track feature usage (metrics/logs/alerts)
- `trackError(errorType)` - Track error occurrence
- `trackDashboardClose()` - Track dashboard viewing time
- `saveStats()` - Send stats to backend (respects opt-out)
- `generateDailySummary()` - Create daily aggregate

**Singleton Pattern:**

```typescript
const usageStats = getUsageStats(context);
usageStats.trackCommand("vitals.openDashboard");
```

### Integration Points

**Extension Activation:**

```typescript
// src/extension.ts
const usageStats = getUsageStats(context);
```

**Command Tracking:**

```typescript
usageStats.trackCommand("vitals.openDashboard");
```

**Feature Tracking:**

```typescript
// src/vitalsView.ts
getUsageStats(context).trackFeature("metrics");
```

**Error Tracking:**

```typescript
getUsageStats(context).trackError("prometheus_metrics_fetch_failed");
```

## Testing

To verify telemetry is working:

1. Enable VS Code Developer Tools: `Help > Toggle Developer Tools`
2. Open Console tab
3. Perform actions (open dashboard, view metrics)
4. Look for logs: `"✅ Usage statistics saved"`

To test opt-out:

1. Set `"vitals.enableTelemetry": false`
2. Reload extension
3. Console should show: `"Telemetry disabled, skipping stats save"`

## Future Enhancements

Planned improvements:

- [ ] In-extension stats viewer
- [ ] Export stats as JSON
- [ ] More granular tracking (e.g., query types)
- [ ] Performance metrics (load times, response times)
- [ ] User survey prompts for qualitative feedback

## Questions?

See [Privacy Policy](./privacy) for our full privacy policy.

For questions or concerns, open an issue: https://github.com/theaniketraj/vitals/issues
