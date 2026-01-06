# Changelog

## [0.3.0] - 06 Jan 2026

- **Custom Metrics Support**:
  - Define custom PromQL queries in settings (`vitals.customQueries`).
  - Monitor and visualize your specific application metrics directly in the dashboard.
- **Alertmanager Integration**:
  - Connect to your Alertmanager instance (`vitals.alertmanagerUrl`).
  - View active alerts and their severity.
  - Manage silences: view active silences and create new ones to suppress alerts.

## [0.2.1] - 08 Dec 2025

- **Authentication**:
  - Switched to VS Code's native GitHub authentication for a seamless sign-in experience.
  - Removed manual OAuth configuration requirement.
  - Improved authentication flow robustness and error handling.
- **Bug Fixes**:
  - Fixed an issue where the dashboard would not open immediately after signing in.
  - Fixed version references across documentation.

## [0.2.0] - 08 Dec 2025

- **Connectivity Diagnostics**: Built-in integration test suite to verify backend connectivity and extension health.
- **Enhanced Dashboard**:
  - New "System Metrics" chart with historical data (30m), dynamic scaling, and improved tooltips.
  - "Live" connection indicator with auto-recovery.
  - GitHub and Settings shortcuts directly in the dashboard.
- **Robustness**:
  - Auto-recovery for Metrics and Alerts tabs when connection is restored.
  - Improved error handling and user feedback.

## [0.1.0] - 04 Dec 2025

- Initial release with Prometheus integration.
- Real-time metrics and logs display.
- Alert system for critical issues.
