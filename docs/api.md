---
title: Vitals API Reference
description: Complete API documentation for Vitals VS Code extension - commands, configuration options, and programmatic usage.
head:
  - - meta
    - name: keywords
      content: API reference, extension API, VS Code commands, configuration API, developer documentation
---

# API Reference

## Extension Commands

### Core Commands

#### `vitals.openDashboard`

Opens the Vitals dashboard in a new webview panel.

**Usage:**

```bash
Command Palette → "Open Vitals"
```

or programmatically:

```typescript
vscode.commands.executeCommand('vitals.openDashboard');
```

---

### Incident Management Commands

#### `vitals.createIncident`

Creates a new incident from an alert or manually.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.createIncident');
```

#### `vitals.viewIncidents`

Opens a quick pick view of active incidents.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewIncidents');
```

#### `vitals.executeRunbook`

Executes an automated runbook for incident remediation.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.executeRunbook');
```

#### `vitals.addHypothesis`

Adds a hypothesis to an active incident investigation.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.addHypothesis');
```

#### `vitals.generatePostMortem`

Generates an AI-powered post-mortem report for a resolved incident.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.generatePostMortem');
```

#### `vitals.configureIncidentIntegrations`

Opens the incident integration configuration wizard (PagerDuty, Opsgenie, Slack).

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.configureIncidentIntegrations');
```

#### `vitals.viewOnCallSchedule`

Displays the current on-call schedule from connected platforms.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewOnCallSchedule');
```

#### `vitals.viewIncidentMetrics`

Shows incident analytics (MTTD, MTTA, MTTI, MTTR).

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewIncidentMetrics');
```

---

### CI/CD Integration Commands

#### `vitals.trackDeployment`

Registers a new deployment with metadata (service, version, environment).

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.trackDeployment');
```

#### `vitals.viewDeployments`

Opens a quick pick list of recent deployments with impact summaries.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewDeployments');
```

#### `vitals.analyzeDeploymentImpact`

Runs statistical performance analysis (Welch's t-test) for a deployment.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.analyzeDeploymentImpact');
```

#### `vitals.rollbackDeployment`

Generates rollback recommendation and executes rollback with selected strategy.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.rollbackDeployment');
```

#### `vitals.viewBuildTrends`

Displays CI pipeline build trends and optimization insights.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewBuildTrends');
```

#### `vitals.viewFlakyTests`

Shows flaky test detection report with failure rates.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.viewFlakyTests');
```

#### `vitals.connectFeatureFlagProvider`

Connects to a feature flag provider (LaunchDarkly, Split.io, Unleash).

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.connectFeatureFlagProvider');
```

#### `vitals.analyzeFlagImpact`

Analyzes the impact of feature flags on metrics and user experience.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.analyzeFlagImpact');
```

#### `vitals.generateReleaseNotes`

Auto-generates release notes from Git commits and performance data.

**Usage:**

```typescript
vscode.commands.executeCommand('vitals.generateReleaseNotes');
```

---

## Configuration Settings

### Core Settings

#### `vitals.prometheusUrl`

- **Type**: `string`
- **Default**: `http://localhost:9090`
- **Description**: URL of the Prometheus server to connect to

**Example:**

```json
{
  "vitals.prometheusUrl": "http://prometheus.example.com:9090"
}
```

---

### Incident Management Settings

#### `vitals.enableIncidentManagement`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable incident management features

#### `vitals.incidentIntegrations`

- **Type**: `object`
- **Description**: Configuration for incident integrations (PagerDuty, Opsgenie, Slack, Teams)

**Example:**

```json
{
  "vitals.incidentIntegrations": {
    "pagerduty": {
      "enabled": true,
      "apiToken": "<stored-securely>",
      "serviceId": "P1234567"
    },
    "slack": {
      "enabled": true,
      "webhookUrl": "<stored-securely>",
      "channel": "#incidents"
    }
  }
}
```

#### `vitals.runbookDirectory`

- **Type**: `string`
- **Default**: `"${workspaceFolder}/.vitals/runbooks"`
- **Description**: Directory path for runbook YAML files

#### `vitals.onCallPlatform`

- **Type**: `enum`
- **Values**: `"pagerduty"`, `"opsgenie"`, `"none"`
- **Default**: `"none"`
- **Description**: On-call platform for schedule integration

---

### CI/CD Integration Settings

#### `vitals.enableCICDIntegration`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable CI/CD integration features

#### `vitals.cicdPlatform`

- **Type**: `enum`
- **Values**: `"github_actions"`, `"gitlab_ci"`, `"jenkins"`, `"circleci"`, `"azure_devops"`, `"travis_ci"`
- **Default**: `"github_actions"`
- **Description**: CI platform for build monitoring

#### `vitals.deploymentDetection`

- **Type**: `object`
- **Description**: Configuration for automatic deployment detection

**Example:**

```json
{
  "vitals.deploymentDetection": {
    "useGitTags": true,
    "tagPattern": "^v\\d+\\.\\d+\\.\\d+$",
    "useCIWebhooks": false
  }
}
```

#### `vitals.performanceAnalysisWindow`

- **Type**: `number`
- **Default**: `30`
- **Description**: Time window (in minutes) before/after deployment for performance analysis

#### `vitals.regressionThreshold`

- **Type**: `number`
- **Default**: `10`
- **Description**: Percentage threshold for detecting performance regressions

#### `vitals.autoRollbackEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic rollback for critical regressions (requires 95% confidence)

#### `vitals.featureFlagProvider`

- **Type**: `enum`
- **Values**: `"launchdarkly"`, `"splitio"`, `"unleash"`, `"none"`
- **Default**: `"none"`
- **Description**: Feature flag provider for integration

---

## Prometheus API Integration

### PrometheusApi Class

Located in `src/api.ts`

#### Methods

##### `getAlerts(): Promise<any>`

Fetches active alerts from Prometheus.

**Returns**: Alert data in Prometheus API response format

**Throws**: `Error` if network fails or Prometheus returns error status

**Example:**

```typescript
const api = new PrometheusApi('http://localhost:9090');
const alerts = await api.getAlerts();
```

##### `query(query: string): Promise<any>`

Executes a PromQL query against Prometheus.

**Parameters**:

- `query` (string): PromQL query string

**Returns**: Metrics data in Prometheus API response format

**Throws**: `Error` if query is empty, network fails, or Prometheus returns error status

**Example:**

```typescript
const api = new PrometheusApi('http://localhost:9090');
const data = await api.query('up{job="prometheus"}');
```

## IPC Message Protocol

Communication between extension and webview uses VS Code's IPC mechanism.

### Extension → Webview Messages

#### `updateMetrics`

Sends metric query results to webview.

```javascript
{
  command: 'updateMetrics',
  data: {
    status: 'success',
    data: {
      resultType: 'vector',
      result: [
        {
          metric: { __name__: 'up', job: 'prometheus' },
          value: [timestamp, '1']
        }
      ]
    }
  }
}
```

#### `updateAlerts`

Sends active alerts to webview.

```javascript
{
  command: 'updateAlerts',
  data: {
    status: 'success',
    data: {
      alerts: [
        {
          status: 'firing',
          labels: { alertname: 'HighErrorRate' },
          annotations: { description: 'High error rate detected' }
        }
      ]
    }
  }
}
```

#### `updateLogs`

Sends log entries to webview (currently mock data).

```javascript
{
  command: 'updateLogs',
  data: [
    '[INFO] Application started at 2025-12-03T22:27:17Z',
    '[INFO] Connected to database',
    '[WARN] High memory usage detected'
  ]
}
```

#### `error`

Sends error information to webview.

```javascript
{
  command: 'error',
  message: 'Network error: Connection refused'
}
```

### Webview → Extension Messages

#### `fetchMetrics`

Requests metric data for a specific query.

```javascript
{
  command: 'fetchMetrics',
  query: 'up{job="prometheus"}'
}
```

#### `fetchAlerts`

Requests list of active alerts.

```javascript
{
  command: 'fetchAlerts'
}
```

#### `fetchLogs`

Requests log entries.

```javascript
{
  command: 'fetchLogs'
}
```

## Data Models

### Alert

```typescript
interface Alert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
}
```

### Metric

Prometheus metric vector result:

```typescript
interface MetricResult {
  metric: Record<string, string>;
  value: [number, string]; // [timestamp, value]
}
```

### LogEntry

```typescript
type LogEntry = string;
```

## Error Handling

All API calls include error handling with user-facing messages via `vscode.window.showErrorMessage()`.

**Common Errors**:

- `Network error: ...` - HTTP/connection failure
- `Prometheus API error: ...` - Prometheus returned error status
- `Query cannot be empty` - Empty PromQL query provided

## React Hooks

### `useVitalsData(vscode)`

Custom hook for fetching metrics and logs.

**Returns**:

```typescript
{
  metrics: any,
  logs: string[],
  loading: boolean,
  error: string | null
}
```

### `useAlerts(vscode)`

Custom hook for fetching and monitoring alerts.

**Returns**:

```typescript
{
  alerts: Alert[],
  loading: boolean,
  error: string | null
}
```
