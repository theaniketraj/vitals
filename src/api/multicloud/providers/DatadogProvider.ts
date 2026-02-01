import axios, { AxiosInstance } from 'axios';
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
 * Datadog APM & Metrics integration
 */
export class DatadogProvider implements ICloudProvider {
  public readonly providerId = 'datadog';
  public readonly providerName = 'Datadog';

  private apiKey?: string;
  private appKey?: string;
  private site: string = 'datadoghq.com'; // Default to US1
  private client?: AxiosInstance;
  private readonly translator: UnifiedQueryTranslator;

  constructor() {
    this.translator = new UnifiedQueryTranslator();
  }

  public async configureAuth(credentials: CloudCredentials): Promise<void> {
    this.apiKey = credentials.apiKey;
    this.appKey = credentials.apiSecret;
    this.site = credentials.additionalConfig?.site || 'datadoghq.com';

    this.client = axios.create({
      baseURL: `https://api.${this.site}`,
      headers: {
        'DD-API-KEY': this.apiKey,
        'DD-APPLICATION-KEY': this.appKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  public async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Datadog provider not configured. Call configureAuth first.');
    }

    const startTime = Date.now();
    
    try {
      const response = await this.client.post('/api/v1/query', {
        query,
      });

      const dataPoints = this.normalizeDatadogResponse(response.data);

      return {
        providerId: this.providerId,
        timestamp: Date.now(),
        data: dataPoints,
        metadata: {
          executionTime: Date.now() - startTime,
          resultCount: dataPoints.length,
        },
        rawResponse: response.data,
      };
    } catch (error: any) {
      throw new Error(`Datadog query failed: ${error.message}`);
    }
  }

  public async queryRange(query: string, start: number, end: number, step: number): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Datadog provider not configured');
    }

    const startTime = Date.now();

    try {
      const response = await this.client.get('/api/v1/query', {
        params: {
          query,
          from: Math.floor(start / 1000),
          to: Math.floor(end / 1000),
        },
      });

      const dataPoints = this.normalizeDatadogResponse(response.data);

      return {
        providerId: this.providerId,
        timestamp: Date.now(),
        data: dataPoints,
        metadata: {
          executionTime: Date.now() - startTime,
          resultCount: dataPoints.length,
        },
        rawResponse: response.data,
      };
    } catch (error: any) {
      throw new Error(`Datadog queryRange failed: ${error.message}`);
    }
  }

  public async executeUnifiedQuery(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<QueryResult> {
    const datadogQuery = this.translator.toDatadog(unifiedQuery);
    
    if (unifiedQuery.timeRange) {
      return this.queryRange(
        datadogQuery,
        unifiedQuery.timeRange.start,
        unifiedQuery.timeRange.end,
        60 // Default step
      );
    }
    
    return this.query(datadogQuery, options);
  }

  public async getAvailableMetrics(): Promise<MetricMetadata[]> {
    if (!this.client) {
      throw new Error('Datadog provider not configured');
    }

    try {
      const response = await this.client.get('/api/v1/metrics');
      const metrics = response.data.metrics || [];

      return metrics.map((metric: string) => ({
        name: metric,
        type: MetricType.GAUGE,
        description: `Datadog metric: ${metric}`,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  public async getCostMetrics(): Promise<CostMetrics> {
    if (!this.client) {
      throw new Error('Datadog provider not configured');
    }

    try {
      // Get usage metrics from Datadog Usage API
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const response = await this.client.get('/api/v1/usage/summary', {
        params: {
          start_month: startOfMonth.toISOString().split('T')[0],
          end_month: now.toISOString().split('T')[0],
        },
      });

      const usage = response.data.usage || [];
      const totalHosts = usage[0]?.infra_host_top99p || 0;
      const customMetrics = usage[0]?.custom_timeseries_avg || 0;

      // Rough cost estimation (actual costs vary by contract)
      const hostCost = totalHosts * 15; // $15 per host/month
      const metricCost = customMetrics * 0.05; // $0.05 per metric/month
      const totalCost = hostCost + metricCost;

      return {
        providerId: this.providerId,
        period: {
          start: startOfMonth.getTime(),
          end: now.getTime(),
        },
        totalCost,
        breakdown: {
          ingestion: metricCost,
          storage: hostCost,
        },
        usage: {
          activeMetrics: customMetrics,
        },
        recommendations: this.generateCostRecommendations(totalHosts, customMetrics),
      };
    } catch (error: any) {
      console.error('Failed to fetch cost metrics:', error);
      return this.getEmptyCostMetrics();
    }
  }

  public async testConnection(): Promise<ConnectionStatus> {
    if (!this.client) {
      return {
        connected: false,
        error: 'Provider not configured',
        lastChecked: Date.now(),
      };
    }

    const start = Date.now();
    
    try {
      await this.client.get('/api/v1/validate');
      
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
    if (!this.apiKey || !this.appKey) {
      return {
        authenticated: false,
        error: 'API keys not configured',
      };
    }

    const connection = await this.testConnection();
    
    return {
      authenticated: connection.connected,
      error: connection.error,
    };
  }

  private normalizeDatadogResponse(response: any): DataPoint[] {
    const dataPoints: DataPoint[] = [];
    
    if (response.series) {
      for (const series of response.series) {
        const metric = series.metric || 'unknown';
        const labels: Record<string, string> = {};
        
        if (series.tag_set) {
          for (const tag of series.tag_set) {
            const [key, value] = tag.split(':');
            if (key && value) {
              labels[key] = value;
            }
          }
        }

        if (series.pointlist) {
          for (const [timestamp, value] of series.pointlist) {
            dataPoints.push({
              timestamp: timestamp,
              value,
              metric,
              labels,
              unit: series.unit,
            });
          }
        }
      }
    }

    return dataPoints;
  }

  private generateCostRecommendations(hosts: number, metrics: number): any[] {
    const recommendations = [];

    if (metrics > 1000) {
      recommendations.push({
        category: 'ingestion',
        severity: 'medium',
        title: 'High custom metric usage',
        description: `You have ${metrics} custom metrics. Consider consolidating similar metrics or reducing cardinality.`,
        potentialSavings: metrics * 0.02,
        actionable: true,
      });
    }

    return recommendations;
  }

  private getEmptyCostMetrics(): CostMetrics {
    const now = Date.now();
    return {
      providerId: this.providerId,
      period: { start: now, end: now },
      totalCost: 0,
      breakdown: {},
      usage: {},
      recommendations: [],
    };
  }
}
