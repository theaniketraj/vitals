# Multi-Cloud & Multi-Datasource Integration

Vitals supports unified observability across multiple cloud monitoring platforms, allowing you to aggregate metrics, correlate data, and optimize costs - all from within VS Code.

## Features

### Supported Platforms

- **Datadog** - APM & Metrics
- **New Relic** - Insights & APM
- **AWS CloudWatch** - Metrics & X-Ray traces
- **Azure Monitor** - Application Insights
- **Google Cloud Operations** - Stackdriver (coming soon)
- **Grafana Cloud/Loki** - Already supported
- **Prometheus** - Already supported
- **Elasticsearch/ELK** - Coming soon
- **Splunk** - Coming soon
- **Honeycomb** - Coming soon

### Unified Dashboard

- **Aggregate metrics** from multiple sources in a single view
- **Cross-platform correlation** (e.g., AWS metrics + Datadog traces)
- **Normalized visualization** regardless of source
- **Real-time data** from all configured providers

### Cost Optimization

- **Track observability costs** across all platforms
- **Identify expensive queries** and unused dashboards
- **Cost comparison** between providers
- **Actionable recommendations** to reduce monitoring spend
- **Budget alerts** when costs exceed thresholds

### Smart Query Builder

- **Platform-agnostic** query language
- **Automatic translation** to native formats (PromQL, LogQL, NRQL, KQL, etc.)
- **Query templates** and saved searches
- **Query cost estimates**

## Getting Started

### 1. Configure a Cloud Provider

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:

```bash
Vitals: Configure Cloud Provider
```

Select your provider and enter the required credentials:

#### Datadog

- API Key
- Application Key
- Site (e.g., datadoghq.com)

#### New Relic

- API Key
- Account ID
- Region (US or EU)

#### AWS CloudWatch

- Access Key ID
- Secret Access Key
- Region (e.g., us-east-1)

#### Azure Monitor

- Tenant ID
- Client ID
- Client Secret
- Subscription ID

### 2. Query Across Providers

Use the unified query language to fetch data from all configured providers:

```typescript
{
  metric: "http_requests_total",
  aggregation: "rate",
  filters: [
    { field: "status", operator: "eq", value: "200" }
  ],
  groupBy: ["service"],
  timeRange: {
    start: Date.now() - 3600000,
    end: Date.now()
  }
}
```

This single query will be automatically translated to:

- **Prometheus**: `rate(http_requests_total{status="200"}[5m]) by (service)`
- **Datadog**: `rate:http_requests_total{status:200} by {service}`
- **New Relic**: `SELECT rate(http_requests_total) FROM Metric WHERE status = '200' FACET service`
- **Azure Monitor**: `http_requests_total | where status == "200" | summarize rate(value) by service`

### 3. View Cost Metrics

Run this command to see cost breakdowns:

```bash
Vitals: View Cost Metrics
```

You'll see:

- Total monthly cost across all providers
- Cost breakdown by category (ingestion, storage, queries)
- Data usage statistics
- Top 10 most expensive queries
- Cost optimization recommendations

## Example Use Cases

### Cross-Platform Correlation

Compare metrics from different providers to detect discrepancies:

```typescript
// Query both AWS and Datadog for the same metric
const results = await cloudProviderManager.queryProviders(
  ['aws', 'datadog'],
  {
    metric: 'api_latency',
    aggregation: 'avg',
    timeRange: { start: Date.now() - 3600000, end: Date.now() }
  }
);

// Detect anomalies
const anomalies = dataNormalizer.detectAnomalies(results);
```

### Cost Analysis

Track which provider is most cost-effective:

```typescript
const costs = await cloudProviderManager.getAggregatedCosts();
const report = costOptimizer.analyzeCosts(costs);

console.log(`Total monthly cost: $${report.totalCost}`);
console.log(`Potential savings: $${report.totalPotentialSavings}`);
```

### Query Optimization

Identify expensive queries:

```typescript
const expensiveQueries = costOptimizer.identifyExpensiveQueries(queryLogs);

for (const query of expensiveQueries) {
  console.log(`${query.providerId}: ${query.totalCost}/month`);
  console.log(`Recommendation: ${query.recommendation}`);
}
```

## Security

All credentials are stored securely using VS Code's Secrets API:

- Encrypted at rest
- Never logged or transmitted
- Isolated per workspace
- Can be deleted at any time

To remove credentials:

```typescript
await credentialManager.deleteCredentials('datadog');
```

## Configuration

Add to your VS Code `settings.json`:

```json
{
  "vitals.enableCostTracking": true,
  "vitals.costAlertThreshold": 1000,
  "vitals.cloudProviders": ["datadog", "newrelic", "aws"]
}
```

## Architecture

```bash
┌────────────────────────────────────────────────┐
│           VS Code Extension (Vitals)           │
├────────────────────────────────────────────────┤
│                                                │
│  ┌─────────────────────────────────────────┐   │
│  │   CloudProviderManager                  │   │
│  │   - Register/Enable providers           │   │
│  │   - Query orchestration                 │   │
│  └─────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │   UnifiedQueryTranslator                │   │
│  │   - PromQL, NRQL, KQL, etc.             │   │
│  └─────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │   Cloud Provider Implementations        │   │
│  │   - DatadogProvider                     │   │
│  │   - NewRelicProvider                    │   │
│  │   - AWSProvider                         │   │
│  │   - AzureProvider                       │   │
│  └─────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │   DataNormalizer                        │   │
│  │   - Merge & correlate results           │   │
│  │   - Detect anomalies                    │   │
│  └─────────────────────────────────────────┘   │
│                     ↓                          │
│  ┌─────────────────────────────────────────┐   │
│  │   CostOptimizer                         │   │
│  │   - Cost analysis & recommendations     │   │
│  └─────────────────────────────────────────┘   │
│                                                │
└────────────────────────────────────────────────┘
            ↓              ↓              ↓
      [Datadog]      [New Relic]    [AWS/Azure]
```

## Contributing

To add support for a new cloud provider:

1. Implement the `ICloudProvider` interface
2. Add query translation logic to `UnifiedQueryTranslator`
3. Register the provider in `CloudProviderManager`
4. Add configuration UI in `CloudCredentialManager`

See [CONTRIBUTING.md](contributing.md) for details.

## License

MIT License - see LICENSE file in project root for details.

## Known Limitations

- AWS SDK requires Node.js runtime (v14+)
- Azure Monitor requires service principal authentication
- Some providers have rate limits
- Cost estimates are approximations based on public pricing

## Additional Resources

- [Datadog API Documentation](https://docs.datadoghq.com/api/)
- [New Relic API Documentation](https://docs.newrelic.com/docs/apis/)
- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [Azure Monitor Documentation](https://docs.microsoft.com/azure/azure-monitor/)
