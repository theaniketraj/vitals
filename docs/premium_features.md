# Premium Features

Vitals includes a set of advanced features designed for power users who need deeper observability and control over their monitoring stack.

## Incident Management & On-Call Workflows

Comprehensive collaborative incident management directly in VS Code. Detect, track, and resolve production incidents with AI-powered assistance.

### Key Capabilities

- **Automatic Incident Detection** - Alert thresholds trigger incident creation
- **Runbook Automation** - One-click execution of remediation playbooks
- **Hypothesis Tracking** - Document investigation timeline with evidence
- **Post-Mortem Generation** - AI-assisted root cause analysis and reports
- **PagerDuty/Opsgenie Integration** - Bi-directional sync with on-call platforms
- **Team Collaboration** - Multi-user incident coordination
- **Metrics & Analytics** - MTTD, MTTA, MTTI, MTTR tracking

[Complete Incident Management Guide](incident_management.md)

## CI/CD Integration & Deployment Intelligence

Track deployment impact with statistical performance analysis, intelligent rollback recommendations, and feature flag correlation.

### Key Capabilities

- **Deployment Tracking** - Auto-detect from Git tags or manual registration
- **Performance Impact Analysis** - Welch's t-test for regression detection
- **Intelligent Rollbacks** - Confidence-scored recommendations with 4 strategies
- **Pipeline Insights** - Flaky test detection, build trends, cost analysis
- **Feature Flag Integration** - LaunchDarkly, Split.io, Unleash support
- **Release Notes Generation** - Auto-generate markdown from commits
- **SLO Compliance Tracking** - Pre/post deployment SLI monitoring

[Complete CI/CD Integration Guide](cicd_integration.md)

## Custom Metrics Dashboard

Beyond the standard system metrics (CPU, Memory, Latency), Vitals allows you to define and visualize your own custom PromQL queries. This is perfect for monitoring business-specific metrics or application-level performance indicators.

### Configuration

You can define custom queries in your VS Code `settings.json` file under `vitals.customQueries`.

**Example:**

```json
{
  "vitals.customQueries": [
    {
      "name": "Go Routines",
      "query": "go_goroutines"
    },
    {
      "name": "Active Database Connections",
      "query": "pg_stat_activity_count"
    },
    {
      "name": "Cache Hit Rate",
      "query": "sum(rate(cache_hits_total[5m])) / sum(rate(cache_requests_total[5m]))"
    }
  ]
}
```

### Usage

1. Add your queries to `settings.json`.
2. Open the Vitals Dashboard.
3. A new **Custom Metrics** section will automatically appear, displaying a real-time chart for each defined query.
4. Charts auto-refresh every 5 seconds.

## Alertmanager Integration

Vitals provides deep integration with **Prometheus Alertmanager**, allowing you not just to view alerts, but to manage and silence them directly from VS Code.

### Configuration

Set the URL for your Alertmanager instance in `settings.json`. The default is `http://localhost:9093`.

```json
{
  "vitals.alertmanagerUrl": "http://localhost:9093"
}
```

### Features

#### 1. Real-time Alert Monitoring

View all active alerts with their severity, status (Firing, Pending, Suppressed), and labels.

- **Firing**: Critical issues (Red).
- **Pending**: Warnings approaching threshold (Yellow).
- **Suppressed**: Silenced alerts (Grey).

#### 2. Interactive Management

The dashboard allows you to switch between a simple view and an interactive **Manage Alerts** panel.

- **View Details**: Expand to see annotations and labels.
- **Silence Alerts**: Click the **Silence** button on any firing alert to open the silence modal.

#### 3. Creating Silences

When creating a silence, Vitals automatically pre-fills the matchers based on the alert you selected.

- **Author**: Your identifier (default: `vitals-user`).
- **Comment**: Reason for silencing.
- **Duration**: How long the silence should last (in hours).

### How to Silence an Alert

1. In the dashboard, navigate to the **Active Alerts** card.
2. Click **Manage Alerts**.
3. Find the alert you want to hush.
4. Click the **Silence** button.
5. Fill in the duration and comment in the modal.
6. Click **Create Silence**.
7. The alert status will update to **Suppressed**.
