---
title: Getting Started with Vitals
description: Complete guide to installing and configuring Vitals VS Code extension for real-time application monitoring with Prometheus.
head:
  - - meta
    - name: keywords
      content: Vitals installation, VS Code extension setup, Prometheus configuration, monitoring setup, getting started guide
---

# Getting Started with Vitals

Welcome to Vitals! This guide will take you from installation to monitoring your first application in minutes.

## Prerequisites

Before you begin, ensure you have:

1. **Visual Studio Code** (v1.94.0 or higher)
2. **Prometheus** (running locally or accessible via network)

   - _Don't have Prometheus?_ Run it quickly with Docker:

     ```bash
     docker run -p 9090:9090 prom/prometheus
     ```

## Installation

### Option A: Install from Marketplace

1. Open VS Code.
2. Go to the **Extensions** view (`Ctrl+Shift+X`).
3. Search for `Vitals`.
4. Click **Install**.

### Option B: Build from Source

1. Clone the repository:

   ```bash
   git clone https://github.com/theaniketraj/vitals.git
   cd vitals
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Press `F5` to launch the extension in debug mode.

## Configuration

By default, Vitals tries to connect to `http://localhost:9090`. If your Prometheus server is elsewhere:

1. Open **Settings** (`Ctrl+,`).
2. Search for `Vitals`.
3. Edit **Vitals: Prometheus Url** to match your server (e.g., `http://my-server:9090`).

## Your First Dashboard

1. **Open the Dashboard**:

   - Press `Ctrl+Shift+P` to open the Command Palette.
   - Type `Vitals: Open Vitals` and press Enter.

2. **Explore the UI**:

   - **Top Bar**: Shows the "Live" status indicator.
   - **KPI Cards**: Quick stats on Request Rate, Error Rate, and Latency.
   - **Main Chart**: A real-time area chart visualizing your metrics.
   - **Log Stream**: A terminal-like view of your application logs.
   - **Alerts Panel**: A list of active firing or pending alerts.

3. **Interact**:
   - Hover over the chart to see precise values.
   - Resize the VS Code panel to see the responsive layout adapt.

## Troubleshooting Common Issues

- **"Connection Refused"**: Ensure your Prometheus server is running and the URL in settings is correct.
- **Empty Charts**: Check if your Prometheus instance is actually scraping data. You can verify this by visiting `http://localhost:9090/targets`.

## Next Steps

### Basic Monitoring

- Customize your metrics in `src/data/fetchMetrics.ts`.
- Set up custom alert rules in your Prometheus configuration.
- Read the [Architecture Guide](system_architecture.md) to understand how it works under the hood.

### Advanced Features

#### Incident Management

- **[Incident Management Guide](incident_management.md)** - Set up collaborative debugging workflows
  - Create incidents from alerts
  - Execute automated runbooks
  - Generate AI-powered post-mortems
  - Configure PagerDuty/Slack integrations

#### CI/CD Integration

- **[CI/CD Integration Guide](cicd_integration.md)** - Track deployment impact
  - Detect deployments from Git tags
  - Analyze performance regressions with statistical testing
  - Enable intelligent rollback recommendations
  - Connect feature flag providers (LaunchDarkly, Split.io)
  - Auto-generate release notes

#### Distributed Tracing

- **[Distributed Tracing Guide](distributed_tracing.md)** - Debug microservices
  - Search traces in Jaeger
  - Visualize service dependency maps
  - Detect performance regressions
  - Profile critical paths

### Configuration Examples

#### Complete Setup with All Features

```json
{
  // Core observability
  "vitals.prometheusUrl": "http://localhost:9090",
  "vitals.lokiUrl": "http://localhost:3100",
  "vitals.traceProvider": "jaeger",
  "vitals.traceEndpoint": "http://localhost:16686",
  
  // Incident management
  "vitals.enableIncidentManagement": true,
  "vitals.incidentIntegrations": {
    "pagerduty": {
      "enabled": true,
      "serviceId": "P1234567"
    },
    "slack": {
      "enabled": true,
      "channel": "#incidents"
    }
  },
  
  // CI/CD integration
  "vitals.enableCICDIntegration": true,
  "vitals.deploymentDetection": {
    "useGitTags": true,
    "tagPattern": "^v\\d+\\.\\d+\\.\\d+$"
  },
  "vitals.regressionThreshold": 10,
  "vitals.featureFlagProvider": "launchdarkly"
}
```
