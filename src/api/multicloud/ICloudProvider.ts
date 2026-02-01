/**
 * Enhanced interface for multi-cloud data sources with advanced capabilities
 */
export interface ICloudProvider {
  /**
   * Unique identifier for this provider (e.g., 'datadog', 'newrelic', 'aws')
   */
  readonly providerId: string;

  /**
   * Human-readable name of the provider
   */
  readonly providerName: string;

  /**
   * Query data using platform-specific query language
   * @param query The query string in platform-native format
   * @param options Additional query options (time range, filters, etc.)
   */
  query(query: string, options?: QueryOptions): Promise<QueryResult>;

  /**
   * Query data over a time range
   * @param query The query string
   * @param start Start timestamp in milliseconds
   * @param end End timestamp in milliseconds
   * @param step Query resolution step in seconds
   */
  queryRange(query: string, start: number, end: number, step: number): Promise<QueryResult>;

  /**
   * Execute a unified query (will be translated to native format)
   * @param unifiedQuery Query in unified query language
   * @param options Query options
   */
  executeUnifiedQuery(unifiedQuery: UnifiedQuery, options?: QueryOptions): Promise<QueryResult>;

  /**
   * Get available metrics/logs from this provider
   */
  getAvailableMetrics(): Promise<MetricMetadata[]>;

  /**
   * Get cost information for queries and usage
   */
  getCostMetrics(): Promise<CostMetrics>;

  /**
   * Test connection to the data source
   */
  testConnection(): Promise<ConnectionStatus>;

  /**
   * Get authentication status
   */
  getAuthStatus(): Promise<AuthStatus>;

  /**
   * Configure authentication credentials
   * @param credentials Authentication credentials (API keys, OAuth tokens, etc.)
   */
  configureAuth(credentials: CloudCredentials): Promise<void>;
}

/**
 * Query options for data source queries
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  aggregation?: AggregationType;
  metadata?: boolean;
}

/**
 * Standardized query result format
 */
export interface QueryResult {
  providerId: string;
  timestamp: number;
  data: DataPoint[];
  metadata: QueryMetadata;
  rawResponse?: any; // Original response for debugging
}

/**
 * Normalized data point
 */
export interface DataPoint {
  timestamp: number; // Unix timestamp in milliseconds
  value: number | string | boolean | null;
  metric: string;
  labels: Record<string, string>;
  unit?: string;
}

/**
 * Query metadata
 */
export interface QueryMetadata {
  executionTime: number; // Milliseconds
  resultCount: number;
  costEstimate?: number; // Estimated cost in USD
  warnings?: string[];
}

/**
 * Metric metadata
 */
export interface MetricMetadata {
  name: string;
  type: MetricType;
  description?: string;
  unit?: string;
  labels?: string[];
}

/**
 * Cost metrics for observability platform
 */
export interface CostMetrics {
  providerId: string;
  period: {
    start: number;
    end: number;
  };
  totalCost: number; // USD
  breakdown: {
    ingestion?: number;
    storage?: number;
    queries?: number;
    retention?: number;
    custom?: Record<string, number>;
  };
  usage: {
    dataIngested?: number; // GB
    dataStored?: number; // GB
    queriesExecuted?: number;
    activeMetrics?: number;
  };
  recommendations?: CostOptimizationTip[];
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimizationTip {
  category: 'ingestion' | 'storage' | 'queries' | 'retention' | 'other';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings?: number; // USD per month
  actionable: boolean;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  latency?: number; // Milliseconds
  error?: string;
  lastChecked: number;
}

/**
 * Authentication status
 */
export interface AuthStatus {
  authenticated: boolean;
  expiresAt?: number;
  permissions?: string[];
  error?: string;
}

/**
 * Cloud provider credentials
 */
export interface CloudCredentials {
  type: 'apiKey' | 'oauth' | 'serviceAccount' | 'iamRole';
  apiKey?: string;
  apiSecret?: string;
  token?: string;
  region?: string;
  accountId?: string;
  projectId?: string;
  additionalConfig?: Record<string, any>;
}

/**
 * Unified query language representation
 */
export interface UnifiedQuery {
  metric: string;
  aggregation?: AggregationType;
  filters?: QueryFilter[];
  groupBy?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * Query filter
 */
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'regex';
  value: any;
}

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
  LOG = 'log',
  TRACE = 'trace',
}

/**
 * Aggregation types
 */
export enum AggregationType {
  AVG = 'avg',
  SUM = 'sum',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count',
  RATE = 'rate',
  PERCENTILE = 'percentile',
}
