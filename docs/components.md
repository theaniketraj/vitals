---
title: Vitals UI Components
description: Documentation for Vitals UI components - MetricChart, AlertPanel, LogViewer, and Dashboard architecture.
head:
  - - meta
    - name: keywords
      content: UI components, React components, MetricChart, AlertPanel, LogViewer, component documentation
---

# Components Reference

## Overview

Vitals UI is built with React components organized by functionality.

## Component Tree

```bash
App
└── Dashboard
    ├── KPI Cards (kpis)
    ├── MetricChart
    ├── LogViewer
    ├── AlertPanel
    ├── IncidentPanel
    ├── DeploymentTimeline
    └── FeatureFlagPanel
```

## Core Components

### App (`webview/src/App.tsx`)

Root React component.

**Props**:

- `vscode: any` - VS Code API object

**Responsibilities**:

- Mount Dashboard component
- Pass vscode context

### Dashboard (`webview/src/components/dashboard.tsx`)

Main layout component that orchestrates the dashboard UI.

**Props**:

- `vscode: any` - VS Code API object

**Features**:

- Header with "Live" status badge
- KPI cards (Request Rate, Error Rate, Latency, Active Alerts)
- System Metrics chart
- Live Logs viewer
- Active Alerts panel

**Data Sources**:

- `useVitalsData` hook for metrics and logs
- `useAlerts` hook for alerts
- Mock KPI data

**Layout**:

```bash
┌─────────────────────────────────────┐
│         Vitals     [●Live]          │
├─────────────────────────────────────┤
│   [KPI]   [KPI]   [KPI]   [KPI]     │
├──────────────────┬──────────────────┤
│  System Metrics  │  Active Alerts   │
│                  │                  │
├──────────────────┴──────────────────┤
│  Live Logs                          │
└─────────────────────────────────────┘
```

### MetricChart (`webview/src/components/MetricChart.tsx`)

Renders metrics visualization using Observable Plot.

**Props**:

```typescript
{
  metrics: any;
  loading: boolean;
  error: string | null;
}
```

**Features**:

- Time-series data visualization
- Loading and error states
- Responsive sizing

**Example Data**:

```javascript
{
  status: 'success',
  data: {
    resultType: 'vector',
    result: [{
      metric: { __name__: 'up', job: 'prometheus' },
      value: [1733280437, '1']
    }]
  }
}
```

### AlertPanel (`webview/src/components/AlertPanel.tsx`)

Displays active and resolved alerts.

**Props**:

```typescript
{
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}
```

**Features**:

- Alert status indicator (firing/resolved)
- Alert labels and annotations
- Loading and error states

**Alert Rendering**:

- **Firing Alerts**: Red/critical styling
- **Resolved Alerts**: Green/success styling
- Labels as tags
- Annotations as description text

### LogViewer (`webview/src/components/LogViewer.tsx`)

Renders stream of log entries.

**Props**:

```typescript
{
  logs: string[];
}
```

**Features**:

- Scrollable log container
- Syntax highlighting for log levels
- Fixed height with scroll

**Log Format**:

```bash
[LEVEL] Message text
[INFO] Application started
[WARN] High memory usage
[ERROR] Connection timeout
```

## Custom Hooks

Located in `webview/src/hooks/`

### useVitalsData

```typescript
function useVitalsData(vscode: any): {
  metrics: any;
  logs: string[];
  loading: boolean;
  error: string | null;
}
```

**Behavior**:

- Sends `fetchMetrics` message on mount
- Sends `fetchLogs` message on mount
- Listens for `updateMetrics` and `updateLogs` responses
- Manages loading and error states

**Usage**:

```typescript
const { metrics, logs, loading, error } = useVitalsData(vscode);
```

### useAlerts

```typescript
function useAlerts(vscode: any): {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}
```

**Behavior**:

- Sends `fetchAlerts` message on mount
- Listens for `updateAlerts` response
- Polls alerts periodically
- Manages loading and error states

**Usage**:

```typescript
const { alerts, loading, error } = useAlerts(vscode);
```

## Styling

### CSS Files

- `webview/src/App.css` - Main styles

**Key Classes**:

- `.dashboard-container` - Main wrapper
- `.dashboard-header` - Header section
- `.dashboard-grid` - Layout grid
- `.kpi-section` - KPI cards container
- `.card` - Card wrapper
- `.live-badge` - Live status indicator

**Responsive Design**:

- Grid layout adapts to viewport
- Cards stack on mobile
- Scrollable sections

## State Management

### Local Component State

Each component manages its own UI state:

- Loading indicators
- Error messages
- Expanded/collapsed sections

### Global State via IPC

Data flows through VS Code's IPC:

1. Component requests data via `vscode.postMessage()`
2. Extension processes request
3. Extension sends response via `webview.postMessage()`
4. Component updates on message event

## Data Flow Example

**Fetching Metrics**:

```bash
MetricChart component mounts
    ↓
useVitalsData hook sends: { command: 'fetchMetrics', query: 'up' }
    ↓
Extension receives message in vitalsView.ts
    ↓
PrometheusApi.query('up') called
    ↓
Response sent back: { command: 'updateMetrics', data: {...} }
    ↓
Hook state updated, component re-renders with new metrics
```

## Component API Summary

| Component | Props | State | Events |
|-----------|-------|-------|--------|
| Dashboard | vscode | - | - |
| MetricChart | metrics, loading, error | - | - |
| AlertPanel | alerts, loading, error | - | - |
| LogViewer | logs | - | - |

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast for alerts

## Performance Optimizations

- Lazy component rendering
- Memoized callbacks in hooks
- Virtual scrolling for large log lists
- Debounced metric updates
