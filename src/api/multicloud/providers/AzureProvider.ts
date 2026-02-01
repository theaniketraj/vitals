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
} from '../ICloudProvider';
import { UnifiedQueryTranslator } from '../UnifiedQueryTranslator';
import axios, { AxiosInstance } from 'axios';

/**
 * Azure Monitor & Application Insights integration
 */
export class AzureProvider implements ICloudProvider {
  public readonly providerId = 'azure';
  public readonly providerName = 'Azure Monitor';

  private tenantId?: string;
  private clientId?: string;
  private clientSecret?: string;
  private subscriptionId?: string;
  private accessToken?: string;
  private tokenExpiry?: number;
  private client?: AxiosInstance;
  private readonly translator: UnifiedQueryTranslator;

  constructor() {
    this.translator = new UnifiedQueryTranslator();
  }

  public async configureAuth(credentials: CloudCredentials): Promise<void> {
    this.tenantId = credentials.additionalConfig?.tenantId;
    this.clientId = credentials.additionalConfig?.clientId;
    this.clientSecret = credentials.apiSecret;
    this.subscriptionId = credentials.additionalConfig?.subscriptionId;

    // Get access token
    await this.refreshAccessToken();

    this.client = axios.create({
      baseURL: 'https://management.azure.com',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', this.clientId!);
      params.append('client_secret', this.clientSecret!);
      params.append('scope', 'https://management.azure.com/.default');
      params.append('grant_type', 'client_credentials');

      const response = await axios.post(tokenUrl, params);
      
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    } catch (error: any) {
      throw new Error(`Failed to authenticate with Azure: ${error.message}`);
    }
  }

  private async ensureToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 60000) {
      await this.refreshAccessToken();
      if (this.client) {
        this.client.defaults.headers.Authorization = `Bearer ${this.accessToken}`;
      }
    }
  }

  public async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Azure provider not configured');
    }

    await this.ensureToken();

    const startTime = Date.now();

    try {
      // Query Azure Monitor Logs using KQL
      const response = await this.client.post(
        `/subscriptions/${this.subscriptionId}/providers/Microsoft.OperationalInsights/query`,
        {
          query,
        },
        {
          params: {
            'api-version': '2021-05-01',
          },
        }
      );

      const dataPoints = this.normalizeAzureResponse(response.data);

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
      throw new Error(`Azure Monitor query failed: ${error.message}`);
    }
  }

  public async queryRange(query: string, start: number, end: number, step: number): Promise<QueryResult> {
    // Azure Monitor KQL uses timespan in the request
    const timespan = `${new Date(start).toISOString()}/${new Date(end).toISOString()}`;
    
    if (!this.client) {
      throw new Error('Azure provider not configured');
    }

    await this.ensureToken();

    const startTime = Date.now();

    try {
      const response = await this.client.post(
        `/subscriptions/${this.subscriptionId}/providers/Microsoft.OperationalInsights/query`,
        {
          query,
          timespan,
        },
        {
          params: {
            'api-version': '2021-05-01',
          },
        }
      );

      const dataPoints = this.normalizeAzureResponse(response.data);

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
      throw new Error(`Azure Monitor queryRange failed: ${error.message}`);
    }
  }

  public async executeUnifiedQuery(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<QueryResult> {
    const kql = this.translator.toAzureMonitor(unifiedQuery);

    if (unifiedQuery.timeRange) {
      return this.queryRange(
        kql,
        unifiedQuery.timeRange.start,
        unifiedQuery.timeRange.end,
        60
      );
    }

    return this.query(kql, options);
  }

  public async getAvailableMetrics(): Promise<MetricMetadata[]> {
    // Azure has many resource types; this would need to be scoped to specific resources
    return [];
  }

  public async getCostMetrics(): Promise<CostMetrics> {
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      providerId: this.providerId,
      period: {
        start: monthAgo,
        end: now,
      },
      totalCost: 0,
      breakdown: {},
      usage: {},
      recommendations: [
        {
          category: 'queries',
          severity: 'low',
          title: 'Azure cost tracking',
          description: 'Use Azure Cost Management for detailed cost analysis',
          actionable: true,
        },
      ],
    };
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
      await this.ensureToken();
      
      // Test with a simple query
      await this.client.get(`/subscriptions/${this.subscriptionId}`, {
        params: { 'api-version': '2020-01-01' },
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
    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      return {
        authenticated: false,
        error: 'Credentials not configured',
      };
    }

    const connection = await this.testConnection();

    return {
      authenticated: connection.connected,
      error: connection.error,
      expiresAt: this.tokenExpiry,
    };
  }

  private normalizeAzureResponse(response: any): DataPoint[] {
    const dataPoints: DataPoint[] = [];

    if (response.tables) {
      for (const table of response.tables) {
        const columns = table.columns || [];
        const rows = table.rows || [];

        for (const row of rows) {
          const dataPoint: Partial<DataPoint> = {
            labels: {},
            timestamp: Date.now(),
          };

          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const value = row[i];

            if (column.name === 'TimeGenerated' || column.name === 'timestamp') {
              dataPoint.timestamp = new Date(value).getTime();
            } else if (column.type === 'real' || column.type === 'long') {
              if (!dataPoint.value) {
                dataPoint.value = value;
                dataPoint.metric = column.name;
              }
            } else {
              dataPoint.labels![column.name] = String(value);
            }
          }

          if (dataPoint.value !== undefined && dataPoint.metric) {
            dataPoints.push(dataPoint as DataPoint);
          }
        }
      }
    }

    return dataPoints;
  }
}
