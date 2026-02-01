// Core interfaces and types
export * from './ICloudProvider';

// Provider management
export { CloudProviderManager } from './CloudProviderManager';
export { CloudCredentialManager } from './CloudCredentialManager';

// Query translation and data normalization
export { UnifiedQueryTranslator } from './UnifiedQueryTranslator';
export { DataNormalizer, type CorrelatedDataPoint, type AggregatedStats, type Anomaly } from './DataNormalizer';
export { CostOptimizer, type CostAnalysisReport, type QueryLog, type ExpensiveQuery } from './CostOptimizer';

// Cloud provider implementations
export { DatadogProvider } from './providers/DatadogProvider';
export { NewRelicProvider } from './providers/NewRelicProvider';
export { AzureProvider } from './providers/AzureProvider';

// AWS Provider requires @aws-sdk/client-cloudwatch and @aws-sdk/client-xray
// Install with: npm install @aws-sdk/client-cloudwatch @aws-sdk/client-xray
// Then uncomment the line below:
// export { AWSProvider } from './providers/AWSProvider';
