/**
 * Core interfaces for distributed tracing and performance profiling
 */

/**
 * Trace provider interface for different tracing backends
 */
export interface ITraceProvider {
  /**
   * Unique identifier for this provider
   */
  readonly providerId: string;

  /**
   * Human-readable name
   */
  readonly providerName: string;

  /**
   * Search for traces by criteria
   */
  searchTraces(query: TraceQuery): Promise<Trace[]>;

  /**
   * Get a specific trace by ID
   */
  getTrace(traceId: string): Promise<Trace | undefined>;

  /**
   * Get service dependency map
   */
  getServiceMap(timeRange: TimeRange): Promise<ServiceMap>;

  /**
   * Get performance metrics for a service
   */
  getServiceMetrics(serviceName: string, timeRange: TimeRange): Promise<ServiceMetrics>;

  /**
   * Test connection to tracing backend
   */
  testConnection(): Promise<boolean>;

  /**
   * Configure authentication
   */
  configureAuth(config: TraceProviderConfig): Promise<void>;
}

/**
 * Trace query parameters
 */
export interface TraceQuery {
  serviceName?: string;
  operationName?: string;
  tags?: Record<string, string>;
  minDuration?: number; // milliseconds
  maxDuration?: number;
  limit?: number;
  timeRange: TimeRange;
}

/**
 * Time range specification
 */
export interface TimeRange {
  start: number; // Unix timestamp in milliseconds
  end: number;
}

/**
 * Complete trace with all spans
 */
export interface Trace {
  traceId: string;
  spans: Span[];
  duration: number; // Total duration in microseconds
  services: string[]; // List of services involved
  startTime: number; // Unix timestamp in microseconds
  endTime: number;
  processes: Record<string, Process>;
  warnings?: string[];
}

/**
 * Individual span in a trace
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number; // Unix timestamp in microseconds
  duration: number; // Duration in microseconds
  tags: Record<string, any>;
  logs: SpanLog[];
  references?: SpanReference[];
  process: string; // Reference to process in Trace.processes
  warnings?: string[];
}

/**
 * Span log entry
 */
export interface SpanLog {
  timestamp: number; // Unix timestamp in microseconds
  fields: Record<string, any>;
}

/**
 * Span reference (for distributed traces)
 */
export interface SpanReference {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  traceId: string;
  spanId: string;
}

/**
 * Process information
 */
export interface Process {
  serviceName: string;
  tags: Record<string, any>;
}

/**
 * Service dependency map
 */
export interface ServiceMap {
  services: ServiceNode[];
  dependencies: ServiceDependency[];
  timeRange: TimeRange;
}

/**
 * Service node in dependency map
 */
export interface ServiceNode {
  name: string;
  requestCount: number;
  errorCount: number;
  avgDuration: number; // milliseconds
  p95Duration: number;
  p99Duration: number;
  health: 'healthy' | 'degraded' | 'critical';
}

/**
 * Service-to-service dependency
 */
export interface ServiceDependency {
  caller: string; // Service name
  callee: string; // Service name
  requestCount: number;
  errorRate: number; // 0-1
  avgDuration: number; // milliseconds
}

/**
 * Service performance metrics
 */
export interface ServiceMetrics {
  serviceName: string;
  timeRange: TimeRange;
  requestRate: number; // requests per second
  errorRate: number; // 0-1
  latency: {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  topOperations: OperationStats[];
  slowTraces: Trace[];
  errorTraces: Trace[];
}

/**
 * Operation statistics
 */
export interface OperationStats {
  operationName: string;
  requestCount: number;
  errorCount: number;
  avgDuration: number;
  p95Duration: number;
}

/**
 * Flame graph node
 */
export interface FlameGraphNode {
  name: string;
  value: number; // Duration or sample count
  children: FlameGraphNode[];
  file?: string;
  line?: number;
  percentage: number;
}

/**
 * CPU profiling data
 */
export interface CPUProfile {
  serviceName: string;
  timestamp: number;
  duration: number; // Profiling duration in ms
  sampleCount: number;
  flameGraph: FlameGraphNode;
  hotFunctions: HotFunction[];
}

/**
 * Hot function in CPU profile
 */
export interface HotFunction {
  name: string;
  file?: string;
  line?: number;
  selfTime: number; // microseconds
  totalTime: number;
  callCount: number;
  percentage: number;
}

/**
 * Memory profiling data
 */
export interface MemoryProfile {
  serviceName: string;
  timestamp: number;
  totalAllocated: number; // bytes
  totalFreed: number;
  liveObjects: number;
  flameGraph: FlameGraphNode;
  topAllocators: MemoryAllocator[];
}

/**
 * Top memory allocator
 */
export interface MemoryAllocator {
  name: string;
  file?: string;
  line?: number;
  allocated: number; // bytes
  allocations: number; // count
  percentage: number;
}

/**
 * Database query analysis
 */
export interface DatabaseQueryAnalysis {
  queries: DatabaseQuery[];
  slowQueries: DatabaseQuery[];
  nPlusOneDetections: NPlusOnePattern[];
  totalQueryTime: number;
  queryCount: number;
}

/**
 * Database query details
 */
export interface DatabaseQuery {
  query: string;
  duration: number; // microseconds
  timestamp: number;
  database: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  rowsAffected?: number;
  spanId?: string;
  stackTrace?: string[];
}

/**
 * N+1 query pattern detection
 */
export interface NPlusOnePattern {
  query: string;
  occurrences: number;
  totalDuration: number;
  spanIds: string[];
  suggestion: string;
}

/**
 * Code-level performance annotation
 */
export interface PerformanceAnnotation {
  file: string;
  line: number;
  type: 'hot-path' | 'slow-function' | 'n-plus-one' | 'memory-leak' | 'optimization';
  severity: 'info' | 'warning' | 'error';
  message: string;
  metric: {
    value: number;
    unit: string;
  };
  suggestion?: string;
  traceIds?: string[];
}

/**
 * Trace comparison result
 */
export interface TraceComparison {
  before: Trace;
  after: Trace;
  changes: {
    durationDelta: number; // microseconds
    durationPercentChange: number;
    newSpans: Span[];
    removedSpans: Span[];
    slowedSpans: SpanComparison[];
    improvedSpans: SpanComparison[];
  };
}

/**
 * Span comparison
 */
export interface SpanComparison {
  operationName: string;
  beforeDuration: number;
  afterDuration: number;
  delta: number;
  percentChange: number;
}

/**
 * Trace provider configuration
 */
export interface TraceProviderConfig {
  endpoint: string;
  apiKey?: string;
  username?: string;
  password?: string;
  serviceName?: string;
  additionalConfig?: Record<string, any>;
}

/**
 * Performance regression detection
 */
export interface PerformanceRegression {
  type: 'latency' | 'throughput' | 'error-rate';
  service: string;
  operation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  baseline: number;
  current: number;
  delta: number;
  percentChange: number;
  detectedAt: number;
  affectedTraces: string[];
  rootCause?: string;
}
