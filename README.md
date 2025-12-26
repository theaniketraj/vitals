<div align="center">

# Vitals

![https://theaniketraj.github.io/vitals](https://github.com/theaniketraj/vitals/blob/main/docs/icon_small.png?raw=true)

[![Deploy Documentation](https://github.com/theaniketraj/vitals/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/theaniketraj/vitals/actions/workflows/deploy-docs.yml)
[![Open VSX Registry](https://img.shields.io/open-vsx/dt/theaniketraj/vitals?label=Open%20VSX)](https://open-vsx.org/extension/theaniketraj/vitals)
[![Version](https://img.shields.io/visual-studio-marketplace/v/theaniketraj.vitals)](https://marketplace.visualstudio.com/items?itemName=theaniketraj.vitals)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/theaniketraj.vitals)](https://marketplace.visualstudio.com/items?itemName=theaniketraj.vitals)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/theaniketraj/vitals/blob/main/LICENSE)

> **Real-time Observability for VS Code** - Monitor application metrics, logs, and alerts without leaving your editor.

</div>

**Vitals** brings enterprise-grade observability directly into Visual Studio Code. Integrated seamlessly with Prometheus, it transforms your development environment into a powerful monitoring hub, enabling you to catch issues early and optimize performance in real-time.

<!-- ![Vitals Demo](https://raw.githubusercontent.com/theaniketraj/vitals/main/docs/images/demo.gif) -->

---

## Key Features

> **New in v0.3.0**: Check out our [Premium Features](./docs/premium_features.md) guide for Custom Metrics and Alertmanager integration!

### Real-Time Metrics

Visualize critical system and application metrics with beautiful, auto-updating charts:

- **CPU Usage**: Track processor utilization across cores
- **Memory Consumption**: Monitor RAM usage and trends
- **Request Latency**: Analyze API response times (p50, p95, p99)
- **Custom Metrics**: Support for any Prometheus metric

### Live Log Stream

Stream application logs directly in VS Code with a terminal-like interface:

- **Syntax Highlighting**: Color-coded log levels (INFO, WARN, ERROR)
- **Real-time Updates**: Watch logs as they happen
- **Filtering & Search**: Quickly find specific log entries
- **Scroll & History**: Navigate through log history effortlessly

### Instant Alerts

Stay informed with a dedicated alerts panel:

- **Firing Alerts**: See active alerts with severity indicators
- **Pending Alerts**: Monitor warnings before they trigger
- **Alert Details**: View labels, annotations, and timestamps
- **Smart Notifications**: Optional VS Code notifications for critical alerts

### Zero Configuration

Works out-of-the-box with minimal setup:

- **Auto-discovery**: Detects local Prometheus instances
- **Quick Start**: Just install and connect
- **Flexible**: Configure custom Prometheus endpoints
- **No External Tools**: Everything runs within VS Code

### Modern UI

Premium design that feels native to VS Code:

- **Theme-Aware**: Automatically adapts to light/dark mode
- **Responsive Layout**: Optimized for all screen sizes
- **Smooth Animations**: Polished interactions and transitions
- **Accessibility**: Full keyboard navigation and screen reader support

---

## Installation

### From VS Code Marketplace

1. Open **Visual Studio Code**
2. Open the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for **"Vitals"**
4. Click **Install**

### From VSIX (Manual)

```bash
# Download the latest .vsix from releases
code --install-extension vitals-0.2.1.vsix
```

### From Source

```bash
git clone https://github.com/theaniketraj/vitals.git
cd vitals
npm install
npm run build
code --install-extension .
```

---

## Quick Start

### 1. Install Prometheus (if not already running)

**macOS (Homebrew):**

```bash
brew install prometheus
prometheus --config.file=/opt/homebrew/etc/prometheus.yml
```

**Linux (Docker):**

```bash
docker run -d -p 9090:9090 prom/prometheus
```

**Windows:**
Download from [prometheus.io/download](https://prometheus.io/download/)

### 2. Configure Vitals

Open VS Code Settings (`Ctrl+,` or `Cmd+,`) and search for "vitals":

```json
{
  "vitals.prometheusUrl": "http://localhost:9090",
  "vitals.refreshInterval": 5000,
  "vitals.enableNotifications": true
}
```

### 3. Open Vitals

- **Command Palette**: `Ctrl+Shift+P` → `Vitals: Open Dashboard`
- **Keyboard Shortcut**: `Ctrl+Alt+P` (customize in Settings)
- **Activity Bar**: Click the Vitals icon in the sidebar

---

## Configuration

All settings are available in VS Code Settings (`Ctrl+,`):

| Setting                      | Default                 | Description                           |
| ---------------------------- | ----------------------- | ------------------------------------- |
| `vitals.prometheusUrl`       | `http://localhost:9090` | Prometheus server endpoint            |
| `vitals.refreshInterval`     | `5000`                  | Metrics refresh interval (ms)         |
| `vitals.enableNotifications` | `true`                  | Show VS Code notifications for alerts |
| `vitals.maxLogLines`         | `1000`                  | Maximum log lines to display          |
| `vitals.theme`               | `auto`                  | Color theme: `auto`, `light`, `dark`  |

### Example Configuration

```json
{
  "vitals.prometheusUrl": "https://prometheus.example.com",
  "vitals.refreshInterval": 3000,
  "vitals.enableNotifications": true,
  "vitals.maxLogLines": 5000,
  "vitals.metrics": [
    "node_cpu_seconds_total",
    "node_memory_MemAvailable_bytes",
    "http_request_duration_seconds"
  ]
}
```

---

## Usage

### Opening the Dashboard

1. **Command Palette** (`Ctrl+Shift+P`)
2. Type `Vitals: Open Dashboard`
3. Press `Enter`

The dashboard opens in a new webview panel showing:

- **Metrics Tab**: Real-time charts and graphs
- **Logs Tab**: Live log stream
- **Alerts Tab**: Active and pending alerts

### Viewing Metrics

Navigate to the **Metrics** tab to see:

- CPU usage across all cores
- Memory consumption trends
- Request latency percentiles
- Custom metrics (configure in settings)

**Interactions:**

- **Hover**: See exact values at specific timestamps
- **Zoom**: Click and drag to zoom into time ranges
- **Legend**: Click to toggle metric visibility

### Monitoring Logs

The **Logs** tab provides a real-time log viewer:

- Auto-scrolls to latest entries
- Color-coded by severity (INFO, WARN, ERROR)
- Search and filter capabilities
- Export logs to file

### Managing Alerts

The **Alerts** tab displays:

- **Firing Alerts** (red): Critical issues requiring attention
- **Pending Alerts** (yellow): Warnings approaching thresholds
- Click an alert to see full details

---

## Architecture

Vitals uses a clean, modular architecture:

```bash
┌─────────────────────────────────────────────┐
│         VS Code Extension Host              │
│  ┌─────────────┐      ┌──────────────┐      │
│  │  Extension  │ →    │ Prometheus   │      │
│  │  Commands   │      │  API Client  │      │
│  └─────────────┘      └──────────────┘      │
│         │                     │             │
│         ▼                     ▼             │
│  ┌──────────────────────────────────┐       │
│  │      Webview Bridge (IPC)        │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│            React Webview UI                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Metrics  │  │   Logs   │  │  Alerts  │   │
│  │ Charts   │  │  Viewer  │  │  Panel   │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────┘
```

**Key Components:**

- **Extension Host**: Node.js process handling configuration, commands, and API calls
- **Webview**: React-based UI rendering metrics, logs, and alerts
- **IPC Bridge**: Message passing between extension and webview
- **Data Layer**: Prometheus API client with polling and caching

For detailed architecture docs, see [SYSTEM_ARCHITECTURE](./docs/system_architecture.md).

---

## Development

### Prerequisites

- Node.js 18+ and npm
- Visual Studio Code 1.85.0+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/theaniketraj/vitals.git
cd vitals

# Install dependencies
npm install

# Build the extension
npm run build
```

### Running Locally

```bash
# Start development mode with hot reload
npm run watch

# In VS Code, press F5 to launch Extension Development Host
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test with local Prometheus
npm run test:e2e
```

### Project Structure

```bash
vitals/
├── src/
│   ├── extension.ts         # Extension entry point
│   ├── api.ts              # Prometheus API client
│   ├── vitalsView.ts        # Webview provider
│   ├── data/               # Data fetching & processing
│   └── utils/              # Utilities & helpers
├── webview/
│   ├── src/
│   │   ├── App.tsx         # Main React app
│   │   ├── components/     # UI components
│   │   └── hooks/          # Custom React hooks
│   └── public/             # Static assets
├── Docs/                   # Documentation
└── package.json
```

See [DEVELOPMENT](./docs/development.md) for comprehensive dev docs.

---

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please read [CONTRIBUTING](./docs/contributing.md) for:

- Code of Conduct
- Development guidelines
- PR process
- Coding standards

---

## Roadmap

### Current (v0.3.0)

- ✅ Real-time metrics visualization
- ✅ Live log streaming
- ✅ Alert management (Prometheus)
- ✅ **Custom Metric Queries**
- ✅ **Alertmanager Integration (Silence/Manage)**
- ✅ Prometheus integration

### Upcoming (v0.4.0)

- 🔄 Historical data analysis
- 🔄 Multi-datasource support (Loki, etc.)

See [VISION](./docs/vision.md) for the full roadmap.

---

## Troubleshooting

### Connection Issues

**Problem**: "Unable to connect to Prometheus"

**Solutions:**

1. Verify Prometheus is running: `curl http://localhost:9090/api/v1/status/config`
2. Check `vitals.prometheusUrl` setting matches your Prometheus endpoint
3. Ensure no firewall is blocking the connection
4. Try disabling SSL verification for self-signed certificates

### No Metrics Displayed

**Problem**: Dashboard is empty

**Solutions:**

1. Confirm Prometheus has scraped targets: Visit `http://localhost:9090/targets`
2. Check metrics exist: Query in Prometheus UI
3. Verify metric names in `vitals.metrics` setting
4. Increase `vitals.refreshInterval` for slow networks

### Logs Not Streaming

**Problem**: Log tab shows no entries

**Solutions:**

1. Ensure your application is exporting logs to Prometheus/Loki
2. Verify log exporter configuration
3. Check Vitals is configured to read from correct log source

For more help, see [TROUBLESHOOTING](./docs/troubleshooting.md) or [open an issue](https://github.com/theaniketraj/vitals/issues).

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Prometheus](https://prometheus.io/) - Monitoring system and time series database
- [Recharts](https://recharts.org/) - Charting library for React
- [VS Code Extension API](https://code.visualstudio.com/api) - Extensibility platform

---

## Support

- **Documentation**: [Vitals Docs](https://theaniketraj.github.io/vitals/)
- **Issues**: [GitHub Issues](https://github.com/theaniketraj/vitals/issues)
- **Discussions**: [GitHub Discussions](https://github.com/theaniketraj/vitals/discussions)

---

## Show Your Support

If you find Vitals helpful, please consider:

- Starring the repo on GitHub
- Sharing with your team
- Contributing to the project
- Writing a review on the VS Code Marketplace

---

**Built with ❤️ by [Aniket Raj](https://theaniketraj.netlify.app)**

## _Vitals - Real-time Observability for Modern Developers_
