# VITALS Automation Modules (Phase 4)

This directory contains the Phase 4 "Intelligence Layer" implementation for VITALS, providing closed-loop automation and historical learning capabilities.

## Modules

### 1. Policy Engine (`policyEngine.ts`)

Core orchestrator for executing automation policies based on regression detection.

**Key Classes:**

- `AutomationPolicyEngine` - Main policy orchestrator
- `ConditionEvaluator` - Evaluates conditions against regression results
- `ThrottleManager` - Prevents action spam

**Features:**

- YAML-based policy definitions
- 4 trigger types: regression_detected, warning_detected, all_passed, error_occurred
- 6 condition operators: equals, not_equals, greater_than, less_than, contains, matches
- Priority-based execution
- Throttling mechanism
- Action chaining

**Usage:**

```typescript
import { AutomationPolicyEngine } from './policyEngine';

const engine = new AutomationPolicyEngine({
  policies: [
    {
      name: "Critical Alert",
      trigger: { type: "regression_detected" },
      conditions: [
        { field: "verdict", operator: "equals", value: "FAIL" }
      ],
      actions: [
        { type: "slack", config: { webhook_url: "..." } }
      ]
    }
  ]
});

await engine.executePolicies(regressionResults);
```

### 2. Action Executors (`executors.ts`)

Implements various notification channels and automation actions.

**Executors:**

- `SlackExecutor` - Rich Slack notifications
- `PagerDutyExecutor` - PagerDuty incident creation
- `WebhookExecutor` - Generic HTTP webhooks
- `EmailExecutor` - Email notifications (placeholder)
- `RollbackExecutor` - Deployment rollback triggers
- `ScriptExecutor` - Custom script execution (disabled)

**Features:**

- Auto-format messages for single/batch results
- Template variable substitution
- Environment variable injection
- Detailed error handling

**Usage:**

```typescript
import { SlackExecutor, registerDefaultExecutors } from './executors';

// Register all executors
registerDefaultExecutors();

// Or use individually
const executor = new SlackExecutor();
await executor.execute(
  { webhook_url: process.env.SLACK_WEBHOOK_URL },
  regressionResult,
  policy
);
```

### 3. Historical Storage (`historicalStorage.ts`)

Persistent storage for regression results, deployments, and incidents using JSONL format.

**Key Features:**

- JSONL-based storage (human-readable)
- Store regressions, deployments, incidents
- Query with filters (date range, verdict, service)
- Time-series data extraction
- Statistical analysis (failure rates, avg changes)
- Retention policy with auto-cleanup
- In-memory caching

**Storage Structure:**

```
~/.vitals/history/
├── regressions/
│   └── <service>/
│       └── <metric>.jsonl
├── deployments/
│   └── <service>.jsonl
└── incidents/
    └── <service>.jsonl
```

**Usage:**

```typescript
import { HistoricalStorage } from './historicalStorage';

const storage = new HistoricalStorage('~/.vitals/history');

// Store regression
await storage.storeRegression({
  service: 'api',
  metric: 'latency_p99',
  verdict: 'FAIL',
  change_percent: 45.2
});

// Query regressions
const failures = await storage.queryRegressions('api', {
  start_date: new Date('2024-01-01'),
  verdict: 'FAIL'
});

// Get time series
const timeSeries = await storage.getTimeSeries(
  'api',
  'latency_p99',
  'change_percent'
);
```

### 4. Pattern Detection (`patternDetection.ts`)

Analyze historical data to detect patterns and trends using statistical methods.

**Pattern Types:**

- **Time-Based**: Day-of-week and hour-of-day patterns
- **Trend**: Linear regression for increasing/decreasing trends
- **Correlation**: Service correlation analysis (placeholder)
- **Team Performance**: Team-based metrics (placeholder)

**Features:**

- Statistical confidence scoring (0-1)
- Evidence tracking
- Actionable recommendations
- R² calculation for trends
- Formatted pattern reports

**Usage:**

```typescript
import { PatternDetectionEngine } from './patternDetection';

const engine = new PatternDetectionEngine(storage, {
  min_samples: 10,
  confidence_threshold: 0.7
});

// Detect patterns
const patterns = await engine.detectPatterns('api-service');

// Generate report
const report = engine.generatePatternReport(patterns);
console.log(report);
```

### 5. Predictive Analytics (`predictiveAnalytics.ts`)

Forecast future trends and assess deployment risks using historical data.

**Key Features:**

- **Deployment Risk Assessment**: Multi-factor scoring (0-100)
- **Deployment Windows**: Optimal deployment time recommendations
- **Metric Forecasting**: Linear regression with confidence intervals
- **Resource Forecasting**: Predict resource usage trends

**Risk Factors:**

- Recent regressions (30% weight)
- Deployment timing (20% weight)
- Deployment frequency (15% weight)
- Recent incidents (35% weight)

**Usage:**

```typescript
import { PredictiveAnalytics } from './predictiveAnalytics';

const analytics = new PredictiveAnalytics(storage, patternEngine);

// Assess deployment risk
const risk = await analytics.assessDeploymentRisk('api-service');
console.log(`Risk: ${risk.risk_level} (${risk.risk_score}/100)`);

// Recommend deployment windows
const windows = await analytics.recommendDeploymentWindows('api-service', 7);

// Forecast metric
const forecast = await analytics.forecastMetric('latency_p99', 'change_percent');

// Generate insights report
const report = await analytics.generateInsightsReport(['api-service']);
```

## Configuration

Add to `vitals.yaml`:

```yaml
# Automation policies
automation:
  enabled: true
  policies:
    - name: "Critical Regression Alert"
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

# Historical storage
historical_storage:
  enabled: true
  base_path: "~/.vitals/history"
  retention_days: 90
  max_records_per_file: 10000
  auto_cleanup: true

# Pattern detection
pattern_detection:
  enabled: true
  min_samples: 10
  confidence_threshold: 0.7

# Predictive analytics
predictive_analytics:
  enabled: true
  forecast_horizon_days: 7
  confidence_level: 0.95
  min_historical_days: 30
```

## Integration Example

```typescript
import { BatchProcessor } from '../batch/batchProcessor';
import { AutomationPolicyEngine } from './policyEngine';
import { registerDefaultExecutors } from './executors';
import { HistoricalStorage } from './historicalStorage';

// Initialize components
const storage = new HistoricalStorage('~/.vitals/history');
registerDefaultExecutors();
const policyEngine = new AutomationPolicyEngine(config.automation);
const batchProcessor = new BatchProcessor(config);

// Run analysis
const results = await batchProcessor.runBatch(config);

// Store in historical database
await storage.storeBatchResults(results);

// Execute automation policies
await policyEngine.executePolicies(results);
```

## Examples

See [`cli/examples/phase4-integration-example.ts`](../examples/phase4-integration-example.ts) for complete usage examples:

1. Basic automation integration
2. Pattern detection
3. Deployment risk assessment
4. Deployment window recommendations
5. Metric forecasting
6. Complete insights report
7. CI/CD gate integration

Run examples:

```bash
# Run all examples
ts-node cli/examples/phase4-integration-example.ts

# Run specific example
ts-node cli/examples/phase4-integration-example.ts risk
```

## Documentation

- **[Phase 4 Summary](../../PHASE_4_SUMMARY.md)** - Complete implementation details
- **[Automation Guide](../../docs/phase4_automation.md)** - Comprehensive user guide
- **[ROADMAP](../../ROADMAP.md)** - Project roadmap with Phase 4 status
- **[Example Config](../../vitals.automation.example.yaml)** - Complete configuration example

## Testing

### Unit Tests (To Be Added)

```typescript
// Test policy engine
describe('AutomationPolicyEngine', () => {
  it('should evaluate conditions correctly', async () => {
    // Test condition evaluation
  });
  
  it('should throttle repeated executions', async () => {
    // Test throttling
  });
});

// Test executors
describe('SlackExecutor', () => {
  it('should format messages correctly', async () => {
    // Test message formatting
  });
  
  it('should substitute template variables', async () => {
    // Test variable substitution
  });
});

// Test historical storage
describe('HistoricalStorage', () => {
  it('should store and query regressions', async () => {
    // Test storage operations
  });
  
  it('should extract time series data', async () => {
    // Test time series
  });
});
```

## Performance

- **Policy Execution**: < 1 second from detection to action
- **Historical Queries**: In-memory caching for frequently accessed data
- **Pattern Detection**: Lazy evaluation, computed on-demand
- **Storage**: Append-only JSONL writes for speed

## Security

- ✅ HTTPS required for all webhooks
- ✅ Environment variable injection for secrets
- ✅ No credentials in configuration files
- ⚠️ Script execution disabled by default (security risk)
- ⚠️ Use webhooks instead of local scripts

## Limitations

1. **Storage**: File-based only (no database support yet)
2. **Pattern Detection**: Basic statistical methods only
3. **Predictive Analytics**: Simple linear regression only
4. **Executors**: Email requires manual SMTP setup, script executor disabled

## Future Enhancements (Phase 5+)

1. Advanced ML models (ARIMA, Random Forest)
2. Database integration (PostgreSQL, InfluxDB)
3. Webhook signature validation
4. Encryption at rest
5. Correlation analysis between services
6. Root cause analysis automation

## Statistics

- **Total Lines of Code**: ~2,510
- **Modules**: 5
- **Action Types**: 6 (Slack, PagerDuty, webhook, email, rollback, script)
- **Pattern Types**: 4 (time-based, trend, correlation, team)
- **Risk Factors**: 4 (regressions, timing, frequency, incidents)

## Contributing

When adding new features to the automation system:

1. Follow existing patterns for executors and detectors
2. Add comprehensive error handling
3. Include confidence scoring where applicable
4. Provide actionable recommendations
5. Update documentation and examples
6. Add unit tests

## License

See [LICENSE](../../LICENSE) for details.
