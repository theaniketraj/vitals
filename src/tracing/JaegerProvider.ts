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
} from './ITraceProvider';

/**
 * Jaeger tracing provider
 */
export class JaegerProvider implements ITraceProvider {
  public readonly providerId = 'jaeger';
  public readonly providerName = 'Jaeger';

  private client?: AxiosInstance;
  private endpoint: string = 'http://localhost:16686';

  public async configureAuth(config: TraceProviderConfig): Promise<void> {
    this.endpoint = config.endpoint;

    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add basic auth if provided
    if (config.username && config.password) {
      this.client.defaults.auth = {
        username: config.username,
        password: config.password,
      };
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const response = await this.client.get('/api/services');
      return response.status === 200;
    } catch (error) {
      console.error('Jaeger connection test failed:', error);
      return false;
    }
  }

  public async searchTraces(query: TraceQuery): Promise<Trace[]> {
    if (!this.client) {
      throw new Error('Jaeger provider not configured');
    }

    try {
      const params: any = {
        start: query.timeRange.start * 1000, // Convert to microseconds
        end: query.timeRange.end * 1000,
        limit: query.limit || 20,
      };

      if (query.serviceName) {
        params.service = query.serviceName;
      }

      if (query.operationName) {
        params.operation = query.operationName;
      }

      if (query.minDuration) {
        params.minDuration = `${query.minDuration}ms`;
      }

      if (query.maxDuration) {
        params.maxDuration = `${query.maxDuration}ms`;
      }

      if (query.tags) {
        params.tags = JSON.stringify(query.tags);
      }

      const response = await this.client.get('/api/traces', { params });

      return this.normalizeJaegerTraces(response.data.data || []);
    } catch (error: any) {
      throw new Error(`Failed to search traces: ${error.message}`);
    }
  }

  public async getTrace(traceId: string): Promise<Trace | undefined> {
    if (!this.client) {
      throw new Error('Jaeger provider not configured');
    }

    try {
      const response = await this.client.get(`/api/traces/${traceId}`);
      const traces = this.normalizeJaegerTraces(response.data.data || []);
      return traces[0];
    } catch (error: any) {
      console.error(`Failed to get trace ${traceId}:`, error);
      return undefined;
    }
  }

  public async getServiceMap(timeRange: TimeRange): Promise<ServiceMap> {
    if (!this.client) {
      throw new Error('Jaeger provider not configured');
    }

    try {
      // Get dependencies
      const endTs = timeRange.end;
      const lookback = timeRange.end - timeRange.start;

      const response = await this.client.get('/api/dependencies', {
        params: {
          endTs,
          lookback,
        },
      });

      const dependencies = response.data.data || [];

      // Build service map
      const serviceMap = new Map<string, ServiceNode>();
      const serviceDeps: ServiceDependency[] = [];

      for (const dep of dependencies) {
        const parent = dep.parent;
        const child = dep.child;
        const callCount = dep.callCount || 0;

        // Initialize parent service
        if (!serviceMap.has(parent)) {
          serviceMap.set(parent, {
            name: parent,
            requestCount: 0,
            errorCount: 0,
            avgDuration: 0,
            p95Duration: 0,
            p99Duration: 0,
            health: 'healthy',
          });
        }

        // Initialize child service
        if (!serviceMap.has(child)) {
          serviceMap.set(child, {
            name: child,
            requestCount: 0,
            errorCount: 0,
            avgDuration: 0,
            p95Duration: 0,
            p99Duration: 0,
            health: 'healthy',
          });
        }

        // Add dependency
        serviceDeps.push({
          caller: parent,
          callee: child,
          requestCount: callCount,
          errorRate: 0,
          avgDuration: 0,
        });

        // Update request counts
        const parentNode = serviceMap.get(parent)!;
        parentNode.requestCount += callCount;
      }

      // Enrich with metrics
      for (const [serviceName, node] of serviceMap) {
        const metrics = await this.getServiceMetrics(serviceName, timeRange);
        node.requestCount = metrics.requestRate * (timeRange.end - timeRange.start) / 1000;
        node.errorCount = node.requestCount * metrics.errorRate;
        node.avgDuration = metrics.latency.p50;
        node.p95Duration = metrics.latency.p95;
        node.p99Duration = metrics.latency.p99;

        // Determine health
        if (metrics.errorRate > 0.1 || metrics.latency.p95 > 5000) {
          node.health = 'critical';
        } else if (metrics.errorRate > 0.05 || metrics.latency.p95 > 3000) {
          node.health = 'degraded';
        }
      }

      return {
        services: Array.from(serviceMap.values()),
        dependencies: serviceDeps,
        timeRange,
      };
    } catch (error: any) {
      throw new Error(`Failed to get service map: ${error.message}`);
    }
  }

  public async getServiceMetrics(serviceName: string, timeRange: TimeRange): Promise<ServiceMetrics> {
    if (!this.client) {
      throw new Error('Jaeger provider not configured');
    }

    try {
      // Search for traces
      const traces = await this.searchTraces({
        serviceName,
        timeRange,
        limit: 100,
      });

      // Calculate metrics
      const durations: number[] = [];
      const operations = new Map<string, OperationStats>();
      let errorCount = 0;

      for (const trace of traces) {
        durations.push(trace.duration / 1000); // Convert to ms

        // Check for errors
        const hasError = trace.spans.some(s =>
          s.tags['error'] === true || s.tags['http.status_code'] >= 400
        );
        if (hasError) {
          errorCount++;
        }

        // Track operations
        for (const span of trace.spans) {
          if (span.serviceName === serviceName) {
            const opName = span.operationName;
            const existing = operations.get(opName) || {
              operationName: opName,
              requestCount: 0,
              errorCount: 0,
              avgDuration: 0,
              p95Duration: 0,
            };

            existing.requestCount++;
            existing.avgDuration = (existing.avgDuration * (existing.requestCount - 1) +
              span.duration / 1000) / existing.requestCount;

            if (span.tags['error']) {
              existing.errorCount++;
            }

            operations.set(opName, existing);
          }
        }
      }

      durations.sort((a, b) => a - b);

      const p50 = this.percentile(durations, 0.5);
      const p75 = this.percentile(durations, 0.75);
      const p95 = this.percentile(durations, 0.95);
      const p99 = this.percentile(durations, 0.99);

      const timespanSeconds = (timeRange.end - timeRange.start) / 1000;
      const requestRate = traces.length / timespanSeconds;
      const errorRate = errorCount / traces.length;

      // Get slow and error traces
      const slowThreshold = p95 * 1.5;
      const slowTraces = traces.filter(t => t.duration / 1000 > slowThreshold).slice(0, 10);
      const errorTraces = traces.filter(t =>
        t.spans.some(s => s.tags['error'] === true)
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

  private normalizeJaegerTraces(jaegerTraces: any[]): Trace[] {
    return jaegerTraces.map(jt => {
      const spans: Span[] = jt.spans.map((js: any) => ({
        spanId: js.spanID,
        traceId: js.traceID,
        parentSpanId: js.references?.find((r: any) => r.refType === 'CHILD_OF')?.spanID,
        operationName: js.operationName,
        serviceName: jt.processes[js.processID]?.serviceName || 'unknown',
        startTime: js.startTime,
        duration: js.duration,
        tags: this.tagsArrayToObject(js.tags || []),
        logs: js.logs || [],
        references: js.references,
        process: js.processID,
        warnings: js.warnings,
      }));

      const services = new Set<string>();
      for (const span of spans) {
        services.add(span.serviceName);
      }

      return {
        traceId: jt.traceID,
        spans,
        duration: Math.max(...spans.map(s => s.startTime + s.duration)) - Math.min(...spans.map(s => s.startTime)),
        services: Array.from(services),
        startTime: Math.min(...spans.map(s => s.startTime)),
        endTime: Math.max(...spans.map(s => s.startTime + s.duration)),
        processes: jt.processes,
        warnings: jt.warnings,
      };
    });
  }

  private tagsArrayToObject(tags: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const tag of tags) {
      obj[tag.key] = tag.value;
    }
    return obj;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
