# Quick Start: Multi-Cloud Integration

Get started with multi-cloud observability in Vitals in just 5 minutes!

## Step 1: Install Dependencies

```bash
npm install @aws-sdk/client-cloudwatch @aws-sdk/client-xray
```

## Step 2: Build the Extension

```bash
npm run build
```

## Step 3: Configure Your First Provider

### Option A: Using the Command Palette

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: `Vitals: Configure Cloud Provider`
3. Select a provider (e.g., Datadog)
4. Enter your credentials

### Option B: Using Code

```typescript
import { CloudCredentialManager } from './api/multicloud';

const credentialManager = new CloudCredentialManager(context);

// Configure Datadog
await credentialManager.storeCredentials('datadog', {
  type: 'apiKey',
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_APP_KEY',
  additionalConfig: {
    site: 'datadoghq.com'
  }
});
```

## Step 4: Query Your Data

### Simple Query

```typescript
import { CloudProviderManager, UnifiedQuery, AggregationType } from './api/multicloud';

const providerManager = new CloudProviderManager(context);

// Initialize providers (done automatically in extension)
// ...

const query: UnifiedQuery = {
  metric: 'http_requests_total',
  aggregation: AggregationType.RATE,
  timeRange: {
    start: Date.now() - 3600000, // Last hour
    end: Date.now()
  }
};

const results = await providerManager.queryAll(query);
console.log(`Received data from ${results.size} providers`);
```

## Step 5: View Cost Metrics

```bash
# Open Command Palette
Vitals: View Cost Metrics
```

Or programmatically:

```typescript
import { CostOptimizer } from './api/multicloud';

const costs = await providerManager.getAggregatedCosts();
const costOptimizer = new CostOptimizer();
const report = costOptimizer.analyzeCosts(costs);

console.log(`Total monthly cost: $${report.totalCost.toFixed(2)}`);
console.log(`Potential savings: $${report.totalPotentialSavings.toFixed(2)}`);

// View recommendations
for (const rec of report.recommendations) {
  console.log(`[${rec.severity}] ${rec.title}`);
  console.log(`  ${rec.description}`);
}
```

## Common Scenarios

### Scenario 1: Compare Metrics Across Providers

```typescript
const query: UnifiedQuery = {
  metric: 'api_latency',
  aggregation: AggregationType.AVG,
  filters: [
    { field: 'service', operator: 'eq', value: 'api' }
  ]
};

const results = await providerManager.queryAll(query);

// Detect discrepancies
const normalizer = new DataNormalizer();
const anomalies = normalizer.detectAnomalies(results);

if (anomalies.length > 0) {
  console.log('⚠️ Found discrepancies between providers!');
  for (const anomaly of anomalies) {
    console.log(anomaly.description);
  }
}
```

### Scenario 2: Find Your Most Expensive Queries

```typescript
const expensiveQueries = costOptimizer.identifyExpensiveQueries(queryLogs);

for (const query of expensiveQueries.slice(0, 5)) {
  console.log(`${query.providerId}: $${query.totalCost}/month`);
  console.log(`Recommendation: ${query.recommendation}`);
}
```

### Scenario 3: Real-Time Monitoring

```typescript
setInterval(async () => {
  const results = await providerManager.queryAll({
    metric: 'error_rate',
    aggregation: AggregationType.RATE
  });
  
  const normalizer = new DataNormalizer();
  const stats = normalizer.aggregateAcrossProviders(results);
  
  if (stats.avg > 0.05) {
    vscode.window.showWarningMessage(
      `High error rate: ${(stats.avg * 100).toFixed(2)}%`
    );
  }
}, 30000); // Every 30 seconds
```

## Provider-Specific Setup

### Datadog

Required credentials:

- API Key: Get from [Datadog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
- Application Key: Get from [Datadog Application Keys](https://app.datadoghq.com/organization-settings/application-keys)
- Site: `datadoghq.com` (US1), `datadoghq.eu` (EU), etc.

### New Relic

Required credentials:

- API Key: Get from [New Relic API Keys](https://one.newrelic.com/launcher/api-keys-ui.api-keys-launcher)
- Account ID: Find in your New Relic account URL
- Region: `US` or `EU`

### AWS CloudWatch

Required credentials:

- Access Key ID: From AWS IAM
- Secret Access Key: From AWS IAM
- Region: e.g., `us-east-1`

Required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

### Azure Monitor

Required credentials:

- Tenant ID
- Client ID (Application ID)
- Client Secret
- Subscription ID

Setup Azure Service Principal:

```bash
az ad sp create-for-rbac --name vitals-monitor --role "Monitoring Reader" --scopes /subscriptions/{subscription-id}
```

## Troubleshooting

### "Provider not configured"

Make sure you've called `configureAuth()` and the connection test passed:

```typescript
await provider.configureAuth(credentials);
const status = await provider.testConnection();
console.log(status.connected); // Should be true
```

### "Query failed"

Check that your query syntax is correct for the unified query language:

```typescript
const query: UnifiedQuery = {
  metric: 'your_metric_name',  // Required
  aggregation: AggregationType.AVG,  // Optional
  filters: [],  // Optional
  groupBy: [],  // Optional
  timeRange: {  // Optional
    start: Date.now() - 3600000,
    end: Date.now()
  }
};
```

### High costs reported

This is normal! The cost metrics help you optimize. Check the recommendations:

```typescript
const report = costOptimizer.analyzeCosts(costs);
for (const rec of report.recommendations) {
  if (rec.actionable) {
    console.log(`Action: ${rec.description}`);
    console.log(`Savings: $${rec.potentialSavings}/month`);
  }
}
```

## Next Steps

- Read the [Full Documentation](multicloud-integration.md)
- Check out [Examples](../src/examples/multiCloudExample.ts)
- Add more providers
- Set up cost alerts
- Create custom dashboards

## Support

- [Report Issues](https://github.com/theaniketraj/vitals/issues)
- [Discussions](https://github.com/theaniketraj/vitals/discussions)
- [Full Documentation](multicloud-integration.md)
