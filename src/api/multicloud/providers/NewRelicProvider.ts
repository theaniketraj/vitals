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
 * New Relic Insights integration
 */
export class NewRelicProvider implements ICloudProvider {
  public readonly providerId = 'newrelic';
  public readonly providerName = 'New Relic';

  private apiKey?: string;
  private accountId?: string;
  private region: string = 'US'; // US or EU
  private client?: AxiosInstance;
  private readonly translator: UnifiedQueryTranslator;

  constructor() {
    this.translator = new UnifiedQueryTranslator();
  }

  public async configureAuth(credentials: CloudCredentials): Promise<void> {
    this.apiKey = credentials.apiKey;
    this.accountId = credentials.accountId;
    this.region = credentials.region || 'US';

    const baseURL = this.region === 'EU' 
      ? 'https://api.eu.newrelic.com'
      : 'https://api.newrelic.com';

    this.client = axios.create({
      baseURL,
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  public async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.client || !this.accountId) {
      throw new Error('New Relic provider not configured');
    }

    const startTime = Date.now();

    try {
      const response = await this.client.get(`/v2/accounts/${this.accountId}/query`, {
        params: { nrql: query },
      });

      const dataPoints = this.normalizeNewRelicResponse(response.data);

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
      throw new Error(`New Relic query failed: ${error.message}`);
    }
  }

  public async queryRange(query: string, start: number, end: number, step: number): Promise<QueryResult> {
    // New Relic uses SINCE and UNTIL in NRQL
    const timeClause = `SINCE ${Math.floor(start / 1000)} UNTIL ${Math.floor(end / 1000)}`;
    const queryWithTime = `${query} ${timeClause}`;
    
    return this.query(queryWithTime);
  }

  public async executeUnifiedQuery(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<QueryResult> {
    const nrql = this.translator.toNewRelic(unifiedQuery);
    
    if (unifiedQuery.timeRange) {
      return this.queryRange(
        nrql,
        unifiedQuery.timeRange.start,
        unifiedQuery.timeRange.end,
        60
      );
    }
    
    return this.query(nrql, options);
  }

  public async getAvailableMetrics(): Promise<MetricMetadata[]> {
    if (!this.client || !this.accountId) {
      throw new Error('New Relic provider not configured');
    }

    try {
      // Query for available event types
      const query = 'SHOW EVENT TYPES';
      const response = await this.client.get(`/v2/accounts/${this.accountId}/query`, {
        params: { nrql: query },
      });

      const eventTypes = response.data.results[0]?.eventTypes || [];

      return eventTypes.map((eventType: string) => ({
        name: eventType,
        type: MetricType.GAUGE,
        description: `New Relic event type: ${eventType}`,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  public async getCostMetrics(): Promise<CostMetrics> {
    if (!this.client || !this.accountId) {
      throw new Error('New Relic provider not configured');
    }

    try {
      // Query usage data
      const query = 'SELECT sum(GigabytesIngested) FROM NrConsumption FACET usageMetric SINCE 1 month ago';
      const response = await this.client.get(`/v2/accounts/${this.accountId}/query`, {
        params: { nrql: query },
      });

      const results = response.data.results || [];
      let totalIngested = 0;

      for (const result of results) {
        totalIngested += result['sum.GigabytesIngested'] || 0;
      }

      // Rough cost estimation (varies by contract)
      const costPerGB = 0.30; // $0.30 per GB ingested
      const totalCost = totalIngested * costPerGB;

      const now = Date.now();
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

      return {
        providerId: this.providerId,
        period: {
          start: monthAgo,
          end: now,
        },
        totalCost,
        breakdown: {
          ingestion: totalCost,
        },
        usage: {
          dataIngested: totalIngested,
        },
        recommendations: this.generateCostRecommendations(totalIngested),
      };
    } catch (error: any) {
      console.error('Failed to fetch cost metrics:', error);
      return this.getEmptyCostMetrics();
    }
  }

  public async testConnection(): Promise<ConnectionStatus> {
    if (!this.client || !this.accountId) {
      return {
        connected: false,
        error: 'Provider not configured',
        lastChecked: Date.now(),
      };
    }

    const start = Date.now();

    try {
      // Simple query to test connection
      await this.client.get(`/v2/accounts/${this.accountId}/query`, {
        params: { nrql: 'SELECT count(*) FROM Transaction SINCE 1 minute ago' },
      });

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
    if (!this.apiKey || !this.accountId) {
      return {
        authenticated: false,
        error: 'API key or account ID not configured',
      };
    }

    const connection = await this.testConnection();

    return {
      authenticated: connection.connected,
      error: connection.error,
    };
  }

  private normalizeNewRelicResponse(response: any): DataPoint[] {
    const dataPoints: DataPoint[] = [];

    if (response.results) {
      for (const result of response.results) {
        const timestamp = result.timestamp || Date.now();
        
        for (const [key, value] of Object.entries(result)) {
          if (key === 'timestamp' || key === 'facet') continue;
          
          dataPoints.push({
            timestamp,
            value: value as any,
            metric: key,
            labels: result.facet ? { facet: result.facet } : {},
          });
        }
      }
    }

    return dataPoints;
  }

  private generateCostRecommendations(ingested: number): any[] {
    const recommendations = [];

    if (ingested > 100) {
      recommendations.push({
        category: 'ingestion',
        severity: 'high',
        title: 'High data ingestion',
        description: `You've ingested ${ingested.toFixed(2)} GB this month. Consider reducing sampling rates or filtering noisy data.`,
        potentialSavings: (ingested - 100) * 0.30,
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
