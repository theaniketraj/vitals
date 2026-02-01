import { CloudWatch, XRay } from '@aws-sdk/client-cloudwatch';
import {
  ICloudProvider,
  QueryResult,
  QueryOptions,
  MetricMetadata,
  CostMetrics,
  ConnectionStatus,
  AuthStatus,
  CloudCredentials,
  UnifiedQuery,
  DataPoint,
  MetricType,
} from '../ICloudProvider';
import { UnifiedQueryTranslator } from '../UnifiedQueryTranslator';

/**
 * AWS CloudWatch & X-Ray integration
 */
export class AWSProvider implements ICloudProvider {
  public readonly providerId = 'aws';
  public readonly providerName = 'AWS CloudWatch';

  private cloudwatch?: CloudWatch;
  private xray?: XRay;
  private region: string = 'us-east-1';
  private readonly translator: UnifiedQueryTranslator;

  constructor() {
    this.translator = new UnifiedQueryTranslator();
  }

  public async configureAuth(credentials: CloudCredentials): Promise<void> {
    this.region = credentials.region || 'us-east-1';

    const awsConfig = {
      region: this.region,
      credentials: {
        accessKeyId: credentials.apiKey!,
        secretAccessKey: credentials.apiSecret!,
      },
    };

    // Note: In production, use AWS SDK v3 with proper imports
    // This is a simplified version
    this.cloudwatch = new CloudWatch(awsConfig as any);
    this.xray = new XRay(awsConfig as any);
  }

  public async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.cloudwatch) {
      throw new Error('AWS provider not configured');
    }

    const startTime = Date.now();

    try {
      // Parse CloudWatch Insights query
      const params = this.parseCloudWatchQuery(query);
      
      const response = await this.cloudwatch.getMetricStatistics(params as any);

      const dataPoints = this.normalizeCloudWatchResponse(response, query);

      return {
        providerId: this.providerId,
        timestamp: Date.now(),
        data: dataPoints,
        metadata: {
          executionTime: Date.now() - startTime,
          resultCount: dataPoints.length,
        },
        rawResponse: response,
      };
    } catch (error: any) {
      throw new Error(`AWS CloudWatch query failed: ${error.message}`);
    }
  }

  public async queryRange(query: string, start: number, end: number, step: number): Promise<QueryResult> {
    if (!this.cloudwatch) {
      throw new Error('AWS provider not configured');
    }

    const startTime = Date.now();

    try {
      const params = this.parseCloudWatchQuery(query);
      params.StartTime = new Date(start);
      params.EndTime = new Date(end);
      params.Period = step;

      const response = await this.cloudwatch.getMetricStatistics(params as any);
      const dataPoints = this.normalizeCloudWatchResponse(response, query);

      return {
        providerId: this.providerId,
        timestamp: Date.now(),
        data: dataPoints,
        metadata: {
          executionTime: Date.now() - startTime,
          resultCount: dataPoints.length,
        },
        rawResponse: response,
      };
    } catch (error: any) {
      throw new Error(`AWS CloudWatch queryRange failed: ${error.message}`);
    }
  }

  public async executeUnifiedQuery(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<QueryResult> {
    const cloudwatchQuery = this.translator.toCloudWatch(unifiedQuery);

    if (unifiedQuery.timeRange) {
      return this.queryRange(
        cloudwatchQuery,
        unifiedQuery.timeRange.start,
        unifiedQuery.timeRange.end,
        60
      );
    }

    return this.query(cloudwatchQuery, options);
  }

  public async getAvailableMetrics(): Promise<MetricMetadata[]> {
    if (!this.cloudwatch) {
      throw new Error('AWS provider not configured');
    }

    try {
      const response = await this.cloudwatch.listMetrics({});
      const metrics = response.Metrics || [];

      return metrics.map((metric: any) => ({
        name: `${metric.Namespace}:${metric.MetricName}`,
        type: MetricType.GAUGE,
        description: `AWS CloudWatch metric: ${metric.MetricName}`,
        labels: metric.Dimensions?.map((d: any) => d.Name) || [],
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  public async getCostMetrics(): Promise<CostMetrics> {
    // AWS CloudWatch pricing is complex and requires Cost Explorer API
    // This is a simplified placeholder
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      providerId: this.providerId,
      period: {
        start: monthAgo,
        end: now,
      },
      totalCost: 0,
      breakdown: {
        custom: {
          metrics: 0,
          apiCalls: 0,
          logs: 0,
        },
      },
      usage: {},
      recommendations: [
        {
          category: 'queries',
          severity: 'low',
          title: 'CloudWatch cost tracking',
          description: 'Enable AWS Cost Explorer for detailed CloudWatch cost analysis',
          actionable: true,
        },
      ],
    };
  }

  public async testConnection(): Promise<ConnectionStatus> {
    if (!this.cloudwatch) {
      return {
        connected: false,
        error: 'Provider not configured',
        lastChecked: Date.now(),
      };
    }

    const start = Date.now();

    try {
      await this.cloudwatch.listMetrics({ Limit: 1 });

      return {
        connected: true,
        latency: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
        lastChecked: Date.now(),
      };
    }
  }

  public async getAuthStatus(): Promise<AuthStatus> {
    const connection = await this.testConnection();

    return {
      authenticated: connection.connected,
      error: connection.error,
      permissions: connection.connected ? ['cloudwatch:GetMetricStatistics', 'cloudwatch:ListMetrics'] : [],
    };
  }

  private parseCloudWatchQuery(query: string): any {
    // Simple parser for CloudWatch metrics
    // Format: Namespace:MetricName{Dimension1=Value1,Dimension2=Value2}
    const match = query.match(/^([\w/]+):([\w]+)(?:\{([^}]+)\})?$/);
    
    if (!match) {
      throw new Error('Invalid CloudWatch query format');
    }

    const [, namespace, metricName, dimensionsStr] = match;
    const dimensions = [];

    if (dimensionsStr) {
      const dimPairs = dimensionsStr.split(',');
      for (const pair of dimPairs) {
        const [name, value] = pair.split('=');
        dimensions.push({ Name: name.trim(), Value: value.trim() });
      }
    }

    return {
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      Statistics: ['Average', 'Sum', 'Maximum', 'Minimum'],
      Period: 300, // 5 minutes
    };
  }

  private normalizeCloudWatchResponse(response: any, query: string): DataPoint[] {
    const dataPoints: DataPoint[] = [];
    const datapoints = response.Datapoints || [];

    for (const dp of datapoints) {
      if (dp.Average !== undefined) {
        dataPoints.push({
          timestamp: new Date(dp.Timestamp).getTime(),
          value: dp.Average,
          metric: query,
          labels: { stat: 'Average' },
          unit: dp.Unit,
        });
      }
    }

    return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
  }
}
