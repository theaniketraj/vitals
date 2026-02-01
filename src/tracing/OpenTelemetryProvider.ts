import axios, { AxiosInstance } from 'axios';
import {
  ITraceProvider,
  Trace,
  TraceQuery,
  ServiceMap,
  ServiceMetrics,
  TimeRange,
  TraceProviderConfig,
  Span,
  ServiceNode,
  ServiceDependency,
  OperationStats,
  Process,
} from './ITraceProvider';

/**
 * OpenTelemetry tracing provider (via OTLP/HTTP or compatible backends)
 */
export class OpenTelemetryProvider implements ITraceProvider {
  public readonly providerId = 'opentelemetry';
  public readonly providerName = 'OpenTelemetry';

  private client?: AxiosInstance;
  private endpoint: string = 'http://localhost:4318'; // Default OTLP HTTP endpoint
  private apiKey?: string;

  public async configureAuth(config: TraceProviderConfig): Promise<void> {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });
  }

  public async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Try to query a simple endpoint
      const response = await this.client.get('/v1/traces');
      return response.status === 200 || response.status === 404; // 404 is ok, means endpoint exists
    } catch (error: any) {
      // If we get a 404 or similar, connection is OK
      if (error.response?.status === 404) {
        return true;
      }
      console.error('OpenTelemetry connection test failed:', error);
      return false;
    }
  }

  public async searchTraces(query: TraceQuery): Promise<Trace[]> {
    if (!this.client) {
      throw new Error('OpenTelemetry provider not configured');
    }

    try {
      // OpenTelemetry query format (compatible with Tempo, Lightstep, etc.)
      const params: any = {
        start: query.timeRange.start,
        end: query.timeRange.end,
        limit: query.limit || 20,
      };

      if (query.serviceName) {
        params['service.name'] = query.serviceName;
      }

      if (query.operationName) {
        params['span.name'] = query.operationName;
      }

      if (query.minDuration) {
        params.minDuration = `${query.minDuration * 1000}us`; // Convert ms to us
      }

      if (query.maxDuration) {
        params.maxDuration = `${query.maxDuration * 1000}us`;
      }

      // Add custom tags as query parameters
      if (query.tags) {
        for (const [key, value] of Object.entries(query.tags)) {
          params[`span.${key}`] = value;
        }
      }

      const response = await this.client.get('/v1/traces', { params });

      return this.normalizeOTelTraces(response.data.traces || []);
    } catch (error: any) {
      throw new Error(`Failed to search traces: ${error.message}`);
    }
  }

  public async getTrace(traceId: string): Promise<Trace | undefined> {
    if (!this.client) {
      throw new Error('OpenTelemetry provider not configured');
    }

    try {
      const response = await this.client.get(`/v1/traces/${traceId}`);
      const traces = this.normalizeOTelTraces([response.data]);
      return traces[0];
    } catch (error: any) {
      console.error(`Failed to get trace ${traceId}:`, error);
      return undefined;
    }
  }

  public async getServiceMap(timeRange: TimeRange): Promise<ServiceMap> {
    if (!this.client) {
      throw new Error('OpenTelemetry provider not configured');
    }

    try {
      // Get all traces in the time range
      const traces = await this.searchTraces({
        timeRange,
        limit: 1000,
      });

      // Build service graph
      const serviceMap = new Map<string, ServiceNode>();
      const dependencyMap = new Map<string, ServiceDependency>();

      for (const trace of traces) {
        for (const span of trace.spans) {
          const serviceName = span.serviceName;

          // Initialize service node
          if (!serviceMap.has(serviceName)) {
            serviceMap.set(serviceName, {
              name: serviceName,
              requestCount: 0,
              errorCount: 0,
              avgDuration: 0,
              p95Duration: 0,
              p99Duration: 0,
              health: 'healthy',
            });
          }

          const node = serviceMap.get(serviceName)!;
          node.requestCount++;

          // Track duration
          const durationMs = span.duration / 1000;
          node.avgDuration = (node.avgDuration * (node.requestCount - 1) + durationMs) / node.requestCount;

          // Check for errors
          if (span.tags['error'] || span.tags['otel.status_code'] === 'ERROR') {
            node.errorCount++;
          }

          // Build dependencies (parent-child relationships)
          if (span.parentSpanId) {
            const parentSpan = trace.spans.find(s => s.spanId === span.parentSpanId);
            if (parentSpan && parentSpan.serviceName !== serviceName) {
              const depKey = `${parentSpan.serviceName}->${serviceName}`;

              if (!dependencyMap.has(depKey)) {
                dependencyMap.set(depKey, {
                  caller: parentSpan.serviceName,
                  callee: serviceName,
                  requestCount: 0,
                  errorRate: 0,
                  avgDuration: 0,
                });
              }

              const dep = dependencyMap.get(depKey)!;
              dep.requestCount++;
              dep.avgDuration = (dep.avgDuration * (dep.requestCount - 1) + durationMs) / dep.requestCount;

              if (span.tags['error']) {
                dep.errorRate = (dep.errorRate * (dep.requestCount - 1) + 1) / dep.requestCount;
              }
            }
          }
        }
      }

      // Calculate health status
      for (const node of serviceMap.values()) {
        const errorRate = node.errorCount / node.requestCount;

        if (errorRate > 0.1 || node.avgDuration > 5000) {
          node.health = 'critical';
        } else if (errorRate > 0.05 || node.avgDuration > 3000) {
          node.health = 'degraded';
        }
      }

      return {
        services: Array.from(serviceMap.values()),
        dependencies: Array.from(dependencyMap.values()),
        timeRange,
      };
    } catch (error: any) {
      throw new Error(`Failed to get service map: ${error.message}`);
    }
  }

  public async getServiceMetrics(serviceName: string, timeRange: TimeRange): Promise<ServiceMetrics> {
    if (!this.client) {
      throw new Error('OpenTelemetry provider not configured');
    }

    try {
      const traces = await this.searchTraces({
        serviceName,
        timeRange,
        limit: 200,
      });

      const durations: number[] = [];
      const operations = new Map<string, OperationStats>();
      let errorCount = 0;

      for (const trace of traces) {
        const serviceSpans = trace.spans.filter(s => s.serviceName === serviceName);

        for (const span of serviceSpans) {
          const durationMs = span.duration / 1000;
          durations.push(durationMs);

          // Track operations
          const opName = span.operationName;
          const existing = operations.get(opName) || {
            operationName: opName,
            requestCount: 0,
            errorCount: 0,
            avgDuration: 0,
            p95Duration: 0,
          };

          existing.requestCount++;
          existing.avgDuration = (existing.avgDuration * (existing.requestCount - 1) + durationMs) / existing.requestCount;

          if (span.tags['error'] || span.tags['otel.status_code'] === 'ERROR') {
            existing.errorCount++;
            errorCount++;
          }

          operations.set(opName, existing);
        }
      }

      durations.sort((a, b) => a - b);

      const p50 = this.percentile(durations, 0.5);
      const p75 = this.percentile(durations, 0.75);
      const p95 = this.percentile(durations, 0.95);
      const p99 = this.percentile(durations, 0.99);

      const timespanSeconds = (timeRange.end - timeRange.start) / 1000;
      const requestRate = durations.length / timespanSeconds;
      const errorRate = errorCount / durations.length || 0;

      // Calculate p95 for operations
      for (const op of operations.values()) {
        const opDurations = traces
          .flatMap(t => t.spans)
          .filter(s => s.serviceName === serviceName && s.operationName === op.operationName)
          .map(s => s.duration / 1000)
          .sort((a, b) => a - b);

        op.p95Duration = this.percentile(opDurations, 0.95);
      }

      const slowThreshold = p95 * 1.5;
      const slowTraces = traces.filter(t => {
        const maxDuration = Math.max(...t.spans
          .filter(s => s.serviceName === serviceName)
          .map(s => s.duration / 1000));
        return maxDuration > slowThreshold;
      }).slice(0, 10);

      const errorTraces = traces.filter(t =>
        t.spans.some(s => s.serviceName === serviceName && (s.tags['error'] || s.tags['otel.status_code'] === 'ERROR'))
      ).slice(0, 10);

      return {
        serviceName,
        timeRange,
        requestRate,
        errorRate,
        latency: { p50, p75, p95, p99 },
        topOperations: Array.from(operations.values())
          .sort((a, b) => b.requestCount - a.requestCount)
          .slice(0, 10),
        slowTraces,
        errorTraces,
      };
    } catch (error: any) {
      throw new Error(`Failed to get service metrics: ${error.message}`);
    }
  }

  private normalizeOTelTraces(otelTraces: any[]): Trace[] {
    return otelTraces.map(ot => {
      const resourceSpans = ot.resourceSpans || [];
      const spans: Span[] = [];
      const processes: Record<string, Process> = {};

      for (const rs of resourceSpans) {
        const resource = rs.resource || {};
        const serviceName = resource.attributes?.find((a: any) => a.key === 'service.name')?.value?.stringValue || 'unknown';

        const processId = `p${Object.keys(processes).length}`;
        processes[processId] = {
          serviceName,
          tags: this.attributesToTags(resource.attributes || []),
        };

        for (const scopeSpan of rs.scopeSpans || []) {
          for (const span of scopeSpan.spans || []) {
            const spanId = this.hexToString(span.spanId);
            const traceId = this.hexToString(span.traceId);
            const parentSpanId = span.parentSpanId ? this.hexToString(span.parentSpanId) : undefined;

            spans.push({
              spanId,
              traceId,
              parentSpanId,
              operationName: span.name,
              serviceName,
              startTime: Number(span.startTimeUnixNano) / 1000, // Convert to microseconds
              duration: Number(span.endTimeUnixNano - span.startTimeUnixNano) / 1000,
              tags: this.attributesToTags(span.attributes || []),
              logs: (span.events || []).map((e: any) => ({
                timestamp: Number(e.timeUnixNano) / 1000,
                fields: this.attributesToTags(e.attributes || []),
              })),
              process: processId,
            });
          }
        }
      }

      if (spans.length === 0) {
        return {
          traceId: 'unknown',
          spans: [],
          duration: 0,
          services: [],
          startTime: 0,
          endTime: 0,
          processes: {},
        };
      }

      const services = new Set<string>();
      for (const span of spans) {
        services.add(span.serviceName);
      }

      return {
        traceId: spans[0].traceId,
        spans,
        duration: Math.max(...spans.map(s => s.startTime + s.duration)) - Math.min(...spans.map(s => s.startTime)),
        services: Array.from(services),
        startTime: Math.min(...spans.map(s => s.startTime)),
        endTime: Math.max(...spans.map(s => s.startTime + s.duration)),
        processes,
      };
    });
  }

  private attributesToTags(attributes: any[]): Record<string, any> {
    const tags: Record<string, any> = {};

    for (const attr of attributes) {
      const value = attr.value?.stringValue
        || attr.value?.intValue
        || attr.value?.doubleValue
        || attr.value?.boolValue
        || attr.value?.arrayValue
        || attr.value?.kvlistValue;

      tags[attr.key] = value;
    }

    return tags;
  }

  private hexToString(hex: string | Uint8Array): string {
    if (typeof hex === 'string') {
      return hex;
    }
    return Array.from(hex)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
