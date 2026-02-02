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

**Vitals** brings enterprise-grade observability directly into Visual Studio Code. Monitor Prometheus, Jaeger, OpenTelemetry, Datadog, New Relic, AWS CloudWatch, Azure Monitor, and more - all from your editor.

---

## Key Features

### Incident Management & On-Call Workflows

- Automatic incident detection from alert thresholds
- One-click runbook automation (Kubernetes restarts, scaling, rollbacks)
- AI-powered post-mortem generation with root cause analysis
- PagerDuty/Opsgenie bi-directional sync for on-call coordination
- Hypothesis tracking with evidence collection timeline
- Team collaboration with MTTD, MTTA, MTTI, MTTR metrics

📖 [Incident Management Guide](https://theaniketraj.github.io/vitals/incident_management.html)

### CI/CD Integration & Deployment Intelligence

- Auto-detect deployments from Git tags or manual tracking
- Statistical performance analysis (Welch's t-test) for regression detection
- Intelligent rollback recommendations with 4 deployment strategies
- Flaky test detection and CI pipeline optimization insights
- Feature flag integration (LaunchDarkly, Split.io, Unleash)
- Auto-generate release notes from commits and metrics

📖 [CI/CD Integration Guide](https://theaniketraj.github.io/vitals/cicd_integration.html)

### Distributed Tracing & Performance Profiling

- Visual flame graphs and service dependency maps
- Database query analysis with N+1 detection
- Inline performance annotations via CodeLens
- Critical path analysis and regression detection
- Supports Jaeger, OpenTelemetry, Zipkin

📖 [Full Documentation](https://theaniketraj.github.io/vitals/distributed_tracing.html)

### Multi-Cloud Observability

- Unified queries across Datadog, New Relic, AWS, Azure, Prometheus, Grafana
- Automatic query translation (PromQL, NRQL, KQL, etc.)
- Cost tracking and optimization recommendations
- Cross-platform correlation and anomaly detection

📖 [Full Documentation](https://theaniketraj.github.io/vitals/multicloud-integration.html)

### Real-Time Metrics & Logs

- Live charts for CPU, memory, latency, and custom metrics
- Streaming logs with syntax highlighting and filtering
- Alert management with VS Code notifications
- Auto-discovery of local Prometheus instances

### Zero Configuration

- Works out-of-the-box with sensible defaults
- Theme-aware UI that adapts to VS Code
- Full keyboard navigation and accessibility

---

## Installation

**From VS Code Marketplace:**

1. Open Extensions view (`Ctrl+Shift+X`)
2. Search for **"Vitals"**
3. Click **Install**

**From CLI:** `code --install-extension theaniketraj.vitals`

---

## Quick Start

1. **Install Prometheus** (if needed): `docker run -p 9090:9090 prom/prometheus`
2. **Open Command Palette**: `Ctrl+Shift+P` → `Vitals: Open Dashboard`
3. **Configure** (optional): Set `vitals.prometheusUrl` in Settings

📖 [Getting Started Guide](https://theaniketraj.github.io/vitals/getting_started.html)

---

## Configuration

Key settings (access via `Ctrl+,` → search "vitals"):

- `vitals.prometheusUrl` - Prometheus endpoint (default: `http://localhost:9090`)
- `vitals.refreshInterval` - Update frequency in ms (default: `5000`)
- `vitals.traceProvider` - Tracing backend: `jaeger`, `opentelemetry`
- `vitals.cloudProviders` - Multi-cloud platform credentials

📖 [Full Configuration Guide](https://theaniketraj.github.io/vitals/getting_started.html)

---

## Commands

**Core Observability:**

- `Vitals: Open Dashboard` - Open metrics, logs, and alerts view
- `Vitals: Configure Trace Provider` - Set up Jaeger/OpenTelemetry
- `Vitals: Search Traces` - Query distributed traces
- `Vitals: View Service Map` - Visualize service dependencies
- `Vitals: Configure Cloud Provider` - Add multi-cloud platforms

**Incident Management:**

- `Vitals: Create Incident` - Create incident from alert or manually
- `Vitals: View Incidents` - Browse active incidents
- `Vitals: Execute Runbook` - Run automated remediation playbooks
- `Vitals: Generate Post-Mortem` - Create AI-powered incident reports
- `Vitals: Configure Incident Integrations` - Set up PagerDuty/Slack/Teams

**CI/CD Intelligence:**

- `Vitals: Track Deployment` - Register deployment with metadata
- `Vitals: Analyze Deployment Impact` - Statistical performance analysis
- `Vitals: Rollback Deployment` - Execute intelligent rollback
- `Vitals: View Build Trends` - CI pipeline optimization insights
- `Vitals: Connect Feature Flag Provider` - Integrate LaunchDarkly/Split.io
- `Vitals: Generate Release Notes` - Auto-generate from commits

📖 [Full API Reference](https://theaniketraj.github.io/vitals/api.html)

---

## Architecture

Vitals uses a modular architecture with TypeScript, React, and VS Code's Webview API.

📖 [System Architecture](https://theaniketraj.github.io/vitals/system_architecture.html) | [Project Structure](https://theaniketraj.github.io/vitals/project_structure.html)

---

## Development

```bash
git clone https://github.com/theaniketraj/vitals.git
cd vitals
npm install
npm run watch  # Start dev mode
# Press F5 in VS Code to launch Extension Development Host
```

📖 [Development Guide](https://theaniketraj.github.io/vitals/development.html) | [Contributing](https://theaniketraj.github.io/vitals/contributing.html)

---

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and open a PR.

📖 [Contributing Guide](https://theaniketraj.github.io/vitals/contributing.html)

---

## Roadmap

- ✅ Prometheus, Jaeger, OpenTelemetry integration
- ✅ Multi-cloud support (Datadog, New Relic, AWS, Azure)
- ✅ Distributed tracing and flame graphs
- 🔄 Historical data analysis
- 🔄 Custom dashboards and saved queries

📖 [Full Roadmap](https://theaniketraj.github.io/vitals/vision.html)

---

## Troubleshooting

**Can't connect to Prometheus?**

- Verify Prometheus is running: `curl http://localhost:9090/api/v1/status/config`
- Check `vitals.prometheusUrl` setting

**No metrics displayed?**

- Confirm Prometheus has active targets: `http://localhost:9090/targets`

📖 [Troubleshooting Guide](https://theaniketraj.github.io/vitals/troubleshooting.html) | [Open an Issue](https://github.com/theaniketraj/vitals/issues)

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

- 📖 [Documentation](https://theaniketraj.github.io/vitals/)
- 🐛 [Report Issues](https://github.com/theaniketraj/vitals/issues)
- 💬 [Discussions](https://github.com/theaniketraj/vitals/discussions)

If Vitals helps you, consider ⭐ starring the repo!

---

**Built with ❤️ by [Aniket Raj](https://theaniketraj.netlify.app)**

## _Vitals - Real-time Observability for Modern Developers_
