# AWS Provider Installation Guide

The AWS CloudWatch provider requires additional dependencies and is **disabled by default** to keep the extension lightweight.

## Quick Start (Without AWS)

The extension builds and works perfectly with these providers out of the box:

- **Datadog** - APM & Metrics
- **New Relic** - Insights & APM  
- **Azure Monitor** - Application Insights
- **Prometheus** - Native support
- **Grafana/Loki** - Native support

## Enabling AWS CloudWatch Support

If you need AWS CloudWatch integration, follow these steps:

### 1. Install Dependencies

```bash
npm install @aws-sdk/client-cloudwatch @aws-sdk/client-xray
```

### 2. Enable the Provider

Rename the disabled provider file:

```bash
mv src/api/multicloud/providers/AWSProvider.ts.disabled src/api/multicloud/providers/AWSProvider.ts
```

### 3. Update Exports

Edit `src/api/multicloud/index.ts` and uncomment:

```typescript
export { AWSProvider } from './providers/AWSProvider';
```

### 4. Update Examples (Optional)

If using the examples, edit `src/examples/multiCloudExample.ts` and uncomment:

```typescript
import { AWSProvider } from '../api/multicloud';
// ...
const aws = new AWSProvider();
providerManager.registerProvider(aws);
```

### 5. Rebuild

```bash
npm run build
```

## Why is AWS Optional?

The AWS SDK packages add ~50MB to node_modules and increase build time. Since many users may only need Datadog, New Relic, or Azure, we made AWS opt-in to:

- Faster installation
- Smaller package size
- Quicker build times
- Better developer experience

## Configuration

Once enabled, configure AWS CloudWatch through VS Code:

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Run: `Vitals: Configure Cloud Provider`
3. Select: **AWS CloudWatch**
4. Enter:
   - Access Key ID
   - Secret Access Key
   - Region (e.g., `us-east-1`)

### IAM Permissions Required

Your AWS credentials need these permissions:

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

## Query Format

AWS CloudWatch uses this query format:

```text
Namespace:MetricName{Dimension1=Value1,Dimension2=Value2}
```

Example:

```text
AWS/EC2:CPUUtilization{InstanceId=i-1234567890abcdef0}
```

## Need Help?

- [Full Documentation](multicloud-integration.md)
- [Report Issues](https://github.com/theaniketraj/vitals/issues)
- [Discussions](https://github.com/theaniketraj/vitals/discussions)
