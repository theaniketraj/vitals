# Phase 4: Intelligence Layer - Automation Guide

## Overview

Phase 4 introduces intelligent automation capabilities to VITALS, enabling closed-loop automation and historical learning. This guide covers:

1. **Closed-Loop Automation**: Auto-trigger actions based on regression detection
2. **Historical Learning**: Pattern recognition and predictive insights
3. **Deployment Risk Assessment**: Assess deployment safety
4. **Predictive Analytics**: Forecast metrics and resource usage

## Architecture

### Components

```bash
cli/src/automation/
├── policyEngine.ts          # Core automation policy orchestrator
├── executors.ts             # Action executors (Slack, PagerDuty, webhooks, etc.)
├── historicalStorage.ts     # Historical data storage (JSONL format)
├── patternDetection.ts      # Pattern detection and analysis
└── predictiveAnalytics.ts   # Predictive forecasting and risk assessment
```

### Data Flow

```bash
Regression Detection → Historical Storage → Pattern Detection → Predictive Analytics
                    ↓
              Policy Engine → Action Executors → Notifications/Actions
```

## Automation Policies

### Policy Structure

Policies are defined in YAML format with the following structure:

```yaml
automation:
  policies:
    - name: "Critical Regression Alert"
      description: "Alert on critical performance regressions"
      enabled: true
      priority: 1 # Lower numbers = higher priority

      # Trigger: when to evaluate this policy
      trigger:
        type: regression_detected # Options: regression_detected, warning_detected, all_passed, error_occurred

      # Conditions: must ALL be true for actions to execute
      conditions:
        - field: verdict
          operator: equals # Options: equals, not_equals, greater_than, less_than, contains, matches
          value: FAIL
        - field: change_percent
          operator: greater_than
          value: 20

      # Actions: executed in sequence if conditions match
      actions:
        - type: slack
          config:
            webhook_url: "${SLACK_WEBHOOK_URL}"
            channel: "#alerts"
        - type: pagerduty
          config:
            routing_key: "${PAGERDUTY_KEY}"
            severity: critical
        - type: rollback
          config:
            webhook_url: "${ROLLBACK_WEBHOOK_URL}"

      # Throttling: prevent action spam
      throttle:
        duration_seconds: 3600 # Don't re-execute for 1 hour

      # Failure handling
      on_failure: continue # Options: continue, abort
```

### Supported Triggers

- `regression_detected`: Fires when a regression is detected (FAIL or WARN verdict)
- `warning_detected`: Fires when a warning is detected (WARN verdict only)
- `all_passed`: Fires when all checks pass (PASS verdict)
- `error_occurred`: Fires when an error occurs during analysis

### Condition Operators

| Operator       | Description        | Example                          |
| -------------- | ------------------ | -------------------------------- |
| `equals`       | Exact match        | `verdict equals FAIL`            |
| `not_equals`   | Not equal          | `verdict not_equals PASS`        |
| `greater_than` | Numeric comparison | `change_percent greater_than 20` |
| `less_than`    | Numeric comparison | `change_percent less_than -10`   |
| `contains`     | String contains    | `metric contains "latency"`      |
| `matches`      | Regex match        | `service matches "^prod-"`       |

### Supported Actions

#### Slack Notification

```yaml
- type: slack
  config:
    webhook_url: "${SLACK_WEBHOOK_URL}"
    channel: "#alerts" # Optional
    username: "VITALS Bot" # Optional
    icon_emoji: ":warning:" # Optional
```

#### PagerDuty Incident

```yaml
- type: pagerduty
  config:
    routing_key: "${PAGERDUTY_ROUTING_KEY}"
    severity: critical # Options: critical, error, warning, info
    dedup_key: "${service}-${metric}" # Optional, for correlation
```

#### Generic Webhook

```yaml
- type: webhook
  config:
    url: "https://api.example.com/hook"
    method: POST
    headers:
      Authorization: "Bearer ${API_TOKEN}"
    body:
      event: "regression_detected"
      service: "{{result.service}}"
      metric: "{{result.metric}}"
```

#### Email Notification

```yaml
- type: email
  config:
    to: ["oncall@example.com"]
    subject: "VITALS Alert: {{result.metric}}"
    smtp_host: "smtp.example.com"
    smtp_port: 587
```

#### Rollback Action

```yaml
- type: rollback
  config:
    webhook_url: "${ROLLBACK_WEBHOOK_URL}"
    deployment_id: "{{deployment.id}}"
    confirmation_required: true
```

#### Custom Script

```yaml
- type: script
  config:
    command: "/path/to/script.sh"
    args: ["{{result.service}}", "{{result.metric}}"]
    timeout: 30
```

### Template Variables

Actions support template variable substitution using `{{...}}` syntax:

| Variable                     | Description                    |
| ---------------------------- | ------------------------------ |
| `{{policy.name}}`            | Policy name                    |
| `{{result.metric}}`          | Metric name                    |
| `{{result.service}}`         | Service name                   |
| `{{result.verdict}}`         | PASS/WARN/FAIL                 |
| `{{result.change_percent}}`  | Percentage change              |
| `{{result.baseline_mean}}`   | Baseline mean value            |
| `{{result.candidate_mean}}`  | Candidate mean value           |
| `{{deployment.id}}`          | Deployment ID (if available)   |
| `{{deployment.environment}}` | Environment (prod/staging/etc) |

### Environment Variables

Use `${VAR_NAME}` syntax to inject environment variables:

```yaml
config:
  webhook_url: "${SLACK_WEBHOOK_URL}"
  api_key: "${API_KEY}"
```

## Usage Examples

### Example 1: Critical Regression Alert

```yaml
automation:
  policies:
    - name: "Critical Latency Regression"
      trigger:
        type: regression_detected
      conditions:
        - field: metric
          operator: contains
          value: "latency"
        - field: change_percent
          operator: greater_than
          value: 50
      actions:
        - type: slack
          config:
            webhook_url: "${SLACK_WEBHOOK_URL}"
        - type: pagerduty
          config:
            routing_key: "${PAGERDUTY_KEY}"
            severity: critical
      throttle:
        duration_seconds: 1800
```

### Example 2: Auto-Rollback

```yaml
automation:
  policies:
    - name: "Auto-Rollback on Critical Failure"
      priority: 1
      trigger:
        type: regression_detected
      conditions:
        - field: verdict
          operator: equals
          value: FAIL
        - field: change_percent
          operator: greater_than
          value: 100
      actions:
        - type: slack
          config:
            webhook_url: "${SLACK_WEBHOOK_URL}"
            channel: "#incidents"
        - type: rollback
          config:
            webhook_url: "${ROLLBACK_API}/deployments/{{deployment.id}}/rollback"
            method: POST
      on_failure: abort
```

### Example 3: Success Notification

```yaml
automation:
  policies:
    - name: "Deployment Success"
      trigger:
        type: all_passed
      actions:
        - type: webhook
          config:
            url: "https://api.example.com/deployments/success"
            method: POST
            body:
              service: "{{result.service}}"
              timestamp: "{{result.timestamp}}"
```

## Historical Data Storage

### Storage Format

Historical data is stored in JSONL (JSON Lines) format:

```bash
~/.vitals/history/
├── regressions/
│   ├── service-a/
│   │   └── metric-1.jsonl
│   └── service-b/
│       └── metric-2.jsonl
├── deployments/
│   └── service-a.jsonl
└── incidents/
    └── service-a.jsonl
```

### Data Types

#### Regression Records

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "api-service",
  "metric": "latency_p99",
  "verdict": "FAIL",
  "change_percent": 45.2,
  "baseline_mean": 120,
  "candidate_mean": 174,
  "metadata": {
    "deployment_id": "deploy-123",
    "environment": "production"
  }
}
```

#### Deployment Records

```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "service": "api-service",
  "deployment_id": "deploy-123",
  "version": "v1.2.3",
  "environment": "production",
  "metadata": {
    "commit": "abc123",
    "author": "user@example.com"
  }
}
```

#### Incident Records

```json
{
  "timestamp": "2024-01-15T11:00:00Z",
  "service": "api-service",
  "incident_id": "INC-456",
  "severity": "high",
  "resolved": true,
  "resolution_time_minutes": 45,
  "metadata": {
    "root_cause": "Database connection pool exhaustion",
    "related_deployment": "deploy-123"
  }
}
```

### Retention Policy

Configure retention in `vitals.yaml`:

```yaml
historical_storage:
  retention_days: 90
  max_records_per_file: 10000
  auto_cleanup: true
```

## Pattern Detection

### Detected Patterns

#### Time-Based Patterns

Identify regressions that occur at specific times:

```
Pattern: High failure rate on Fridays
- Day of Week: Friday
- Failure Rate: 45% (baseline: 15%)
- Confidence: 0.85
- Recommendation: Avoid Friday deployments
```

#### Trend Patterns

Identify increasing or decreasing trends:

```
Pattern: Increasing latency trend
- Metric: latency_p99
- Trend: Increasing
- Slope: +5.2% per day
- R²: 0.78
- Recommendation: Investigate gradual performance degradation
```

#### Correlation Patterns

Identify services that fail together:

```
Pattern: Correlated failures
- Services: api-service, database-service
- Correlation: 0.82
- Recommendation: Check for shared dependencies
```

### Pattern Reports

Generate pattern reports:

```bash
# Detect patterns for a service
vitals patterns detect --service api-service

# Generate full report
vitals patterns report --days 30
```

## Predictive Analytics

### Deployment Risk Assessment

Assess deployment risk before deploying:

```typescript
// Risk factors considered:
// 1. Recent regression history (30%)
// 2. Deployment timing (20%)
// 3. Deployment frequency (15%)
// 4. Recent incident history (35%)

const risk = await predictive.assessDeploymentRisk("api-service");
```

Output:

```
✅ Risk Level: LOW (25/100)

Risk Factors:
  • 1 regressions in last 7 days: 20/100 (weight: 30%)
  • Business hours deployment: 20/100 (weight: 20%)
  • Normal deployment frequency: 20/100 (weight: 15%)
  • 0 incidents in last 14 days: 0/100 (weight: 35%)

Recommendations:
  • Risk level acceptable for deployment
```

### Deployment Window Recommendations

Find optimal deployment times:

```typescript
const windows = await predictive.recommendDeploymentWindows("api-service", 7);
```

Output:

```
Recommended Deployment Windows:

✅ 2024-01-16 10:00 AM - 4:00 PM [low]
Confidence: 90%
  • Normal business hours
  • No historical issues detected

⚠️ 2024-01-19 10:00 AM - 4:00 PM [medium]
Confidence: 70%
  • Friday deployment - reduced on-call coverage
```

### Metric Forecasting

Forecast future metric values:

```typescript
const forecast = await predictive.forecastMetric(
  "latency_p99",
  "change_percent",
);
```

Output:

```
Forecast for latency_p99 (7 days):
- Day 1: 125ms (115-135ms)
- Day 2: 128ms (118-138ms)
- Day 3: 131ms (121-141ms)
...

Accuracy: R² = 0.82
Trend: +2.5% per day
```

## Integration

### Batch Processing Integration

Integrate automation into batch processing:

```typescript
import { AutomationPolicyEngine } from "./automation/policyEngine";
import { HistoricalStorage } from "./automation/historicalStorage";

// Run batch analysis
const results = await batchProcessor.runBatch(config);

// Store results
await storage.storeBatchResults(results);

// Execute automation policies
await policyEngine.executePolicies(results);
```

### CI/CD Integration

#### GitHub Actions

```yaml
- name: Run VITALS Analysis
  run: |
    vitals batch run --config vitals.yaml

- name: Execute Automation
  if: failure()
  run: |
    vitals automation execute --trigger regression_detected
```

#### GitLab CI

```yaml
vitals_analysis:
  script:
    - vitals batch run --config vitals.yaml
    - vitals automation execute --trigger regression_detected
  artifacts:
    reports:
      junit: vitals-report.xml
```

## Configuration Schema

Complete `vitals.yaml` configuration:

```yaml
# Phase 4: Automation Configuration
automation:
  enabled: true

  # Policy definitions
  policies:
    - name: "Critical Regression Alert"
      description: "Alert on critical performance regressions"
      enabled: true
      priority: 1
      trigger:
        type: regression_detected
      conditions:
        - field: verdict
          operator: equals
          value: FAIL
      actions:
        - type: slack
          config:
            webhook_url: "${SLACK_WEBHOOK_URL}"
      throttle:
        duration_seconds: 3600
      on_failure: continue

# Historical storage configuration
historical_storage:
  enabled: true
  base_path: "~/.vitals/history"
  retention_days: 90
  max_records_per_file: 10000
  auto_cleanup: true

# Pattern detection configuration
pattern_detection:
  enabled: true
  min_samples: 10
  confidence_threshold: 0.7

# Predictive analytics configuration
predictive_analytics:
  enabled: true
  forecast_horizon_days: 7
  confidence_level: 0.95
  min_historical_days: 30
```

## Best Practices

### 1. Policy Design

- **Use throttling**: Prevent alert spam with appropriate throttle durations
- **Set priorities**: Lower numbers for critical policies that should execute first
- **Test conditions**: Use specific conditions to avoid false positives
- **Chain actions**: Combine notifications with automated remediation

### 2. Historical Data

- **Regular cleanup**: Enable auto-cleanup to manage storage
- **Metadata enrichment**: Add deployment IDs, commit hashes, etc.
- **Consistent timestamps**: Use UTC timestamps for all events

### 3. Pattern Detection

- **Sufficient samples**: Ensure at least 30 data points for reliable patterns
- **Review confidence**: Only act on high-confidence patterns (>0.7)
- **Validate patterns**: Manually review detected patterns before automation

### 4. Predictive Analytics

- **Risk thresholds**: Define clear thresholds for different risk levels
- **Window selection**: Choose deployment windows with low risk scores
- **Forecast validation**: Monitor forecast accuracy and adjust models

## Security Considerations

### Webhook Security

- Use HTTPS for all webhook URLs
- Rotate webhook tokens regularly
- Validate webhook signatures when possible

### Credential Management

- Store credentials in environment variables
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault)
- Never commit credentials to version control

### Script Execution

- Disable script execution by default (security risk)
- Use webhooks instead of local scripts
- If scripts are required:
  - Whitelist allowed scripts
  - Run in sandboxed environment
  - Audit all script executions

## Troubleshooting

### Policy Not Executing

1. Check policy is enabled: `enabled: true`
2. Verify trigger matches event type
3. Test conditions with sample data
4. Check throttle state (may be throttled)
5. Review logs for errors

### Action Failures

1. Verify webhook URLs are accessible
2. Check authentication tokens/keys
3. Test payload format with curl
4. Review HTTP status codes in logs
5. Increase timeout values if needed

### Storage Issues

1. Check disk space availability
2. Verify file permissions
3. Review retention policy settings
4. Check for corrupted JSONL files
5. Monitor file sizes and rotate manually if needed

### Pattern Detection Issues

1. Ensure sufficient historical data (30+ samples)
2. Check data quality (no gaps or outliers)
3. Adjust confidence threshold if too strict
4. Review statistical significance of patterns

## Monitoring

### Metrics to Track

- Policy execution count
- Action success/failure rate
- Throttle hit rate
- Average execution time
- Storage size growth

### Health Checks

```bash
# Check automation status
vitals automation status

# List active policies
vitals automation list

# Show recent executions
vitals automation history --limit 10

# Validate configuration
vitals automation validate
```

## Next Steps

1. **Define policies**: Create automation policies for your use cases
2. **Configure storage**: Set up historical data storage and retention
3. **Enable patterns**: Start detecting patterns in your data
4. **Review insights**: Regularly review predictive insights
5. **Iterate**: Refine policies based on feedback and results

## Related Documentation

- [ROADMAP.md](../ROADMAP.md) - Phase 4 requirements
- [API Documentation](api.md) - Integration APIs
- [Development Guide](development.md) - Contributing guidelines
