# Changelog

## [0.4.0] - 16 Mar 2026

- **Regression Storage**:
  - Added structured regression storage via a dedicated regression database.
  - Added incident knowledge graph primitives for incident creation, linking, and root-cause analysis.
  - Added service dependency mapping from imported trace exports.
  - Added cross-source correlation for incidents and regressions.
  - Added new CLI surface for Phase 5 workflows:
    - `vitals data regressions list|stats|import-historical`
    - `vitals data incidents create|analyze`
    - `vitals data dependencies import-traces|map|health`
    - `vitals data correlate incident|regression`
  - Completed migration path from Phase 4 historical JSONL storage into the structured regression database.
  - Shipped file-backed time-series storage as the initial Phase 5 persistence backend.

- **Intelligence Layer**:
  - **Closed-Loop Automation**:
    - Policy engine with YAML-based automation policies supporting multiple triggers (regression_detected, warning_detected, all_passed, error_occurred).
    - Condition evaluation with 6 operators (equals, not_equals, greater_than, less_than, contains, matches).
    - Action executors: Slack, PagerDuty, generic webhooks, email, rollback automation, custom scripts.
    - Throttling mechanism to prevent alert spam with configurable duration windows.
    - Priority-based policy execution with failure handling (continue/abort modes).
    - Template variable substitution for dynamic action configuration.
  - **Historical Learning**:
    - JSONL-based historical storage for regression results, deployments, and incidents.
    - Pattern detection engine identifying time-based patterns ("every Friday") and trend patterns (increasing/decreasing).
    - Statistical confidence scoring (0-1 scale) for detected patterns.
    - Query interface with filtering by date range, verdict, service, environment.
    - Time-series data extraction for trending and forecasting.
    - Retention policy with automatic cleanup.
  - **Predictive Analytics**:
    - Multi-factor deployment risk assessment (0-100 scoring) considering recent regressions, deployment timing, frequency, and incidents.
    - Deployment window recommendations with optimal deployment times based on historical patterns.
    - Metric forecasting using linear regression with confidence intervals.
    - Resource usage predictions with threshold breach detection.
    - Comprehensive insights reporting across multiple services.
  - **Integration**:
    - Seamless integration with existing batch processing workflow.
    - CI/CD pipeline examples for GitHub Actions and GitLab CI.
    - Example configuration file (`vitals.automation.example.yaml`) with comprehensive policy examples.
    - Integration examples demonstrating all Phase 4 capabilities.
  - **Documentation**:
    - Complete automation guide ([docs/phase4_automation.md](docs/automation.md)) covering policies, executors, storage, patterns, and predictive analytics.
    - Module-specific README ([cli/src/automation/README.md](cli/src/automation/README.md)) for developers.
- **CI/CD Enforcement Layer**:
  - **Policy-as-Code Engine**: Define performance policies in `vitals.yaml` with metric-specific thresholds, actions, and rollback strategies.
  - **Multi-Metric Batch Analysis**: Analyze multiple metrics simultaneously with a single CLI command (`vitals batch`).
  - **Enhanced Statistical Rigor**: Outlier removal (IQR method), data normalization, smoothing, and robust sample validation.
  - **GitHub Action**: Ready-to-use GitHub Action for automatic PR checks with comments, multi-metric support, and policy evaluation.
  - **Policy Evaluation**: Automatic evaluation of regression results against configurable policies with fail/warn/ignore actions.
  - **CLI Enhancements**: Added `--config` option to all commands for policy file support, auto-discovery of `vitals.yaml` in project directories.
  - **Workflow Examples**: Added comprehensive GitHub Action workflow examples for PR checks, batch analysis, and production validation.
  - **Documentation**: Updated CLI README with policy-based usage, batch analysis examples, and CI/CD integration guides.

## [0.3.1] - 21 Feb 2026

- **Incident Management**:
  - Collaborative debugging workflows with shared incident context.
  - Runbook automation for common remediation tasks.
  - Hypothesis tracking to document investigation steps.
  - AI-powered post-mortem generation from incident timelines.
  - Integration with PagerDuty for real-time alert synchronization.
- **CI/CD Integration**:
  - Automated deployment tracking and performance regression detection.
  - Statistical analysis (Welch's t-test) for intelligent rollback recommendations.
  - Metric correlation to link performance changes with specific Git commits.
  - Feature flag synchronization with LaunchDarkly, Split.io, and Unleash.
  - Cost analysis tracking for cloud spend changes per deployment.

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
