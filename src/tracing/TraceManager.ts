import * as vscode from 'vscode';
import {
  ITraceProvider,
  Trace,
  TraceQuery,
  ServiceMap,
  ServiceMetrics,
  TimeRange,
  TraceComparison,
  SpanComparison,
  PerformanceRegression,
  Span,
} from './ITraceProvider';
import { JaegerProvider } from './JaegerProvider';
import { OpenTelemetryProvider } from './OpenTelemetryProvider';

/**
 * Manages trace providers and provides unified access to tracing data
 */
export class TraceManager {
  private providers = new Map<string, ITraceProvider>();
  private activeProvider?: ITraceProvider;
  private traceCache = new Map<string, Trace>();

  constructor(private context: vscode.ExtensionContext) {
    this.registerDefaultProviders();
  }

  private registerDefaultProviders(): void {
    this.registerProvider(new JaegerProvider());
    this.registerProvider(new OpenTelemetryProvider());
  }

  public registerProvider(provider: ITraceProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  public getProvider(providerId: string): ITraceProvider | undefined {
    return this.providers.get(providerId);
  }

  public getActiveProvider(): ITraceProvider | undefined {
    return this.activeProvider;
  }

  public setActiveProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    this.activeProvider = provider;
  }

  public listProviders(): ITraceProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Search for traces using the active provider
   */
  public async searchTraces(query: TraceQuery): Promise<Trace[]> {
    if (!this.activeProvider) {
      throw new Error('No active trace provider configured');
    }

    const traces = await this.activeProvider.searchTraces(query);

    // Cache traces
    for (const trace of traces) {
      this.traceCache.set(trace.traceId, trace);
    }

    return traces;
  }

  /**
   * Get a specific trace by ID
   */
  public async getTrace(traceId: string): Promise<Trace | undefined> {
    // Check cache first
    if (this.traceCache.has(traceId)) {
      return this.traceCache.get(traceId);
    }

    if (!this.activeProvider) {
      throw new Error('No active trace provider configured');
    }

    const trace = await this.activeProvider.getTrace(traceId);

    if (trace) {
      this.traceCache.set(traceId, trace);
    }

    return trace;
  }

  /**
   * Get service dependency map
   */
  public async getServiceMap(timeRange: TimeRange): Promise<ServiceMap> {
    if (!this.activeProvider) {
      throw new Error('No active trace provider configured');
    }

    return await this.activeProvider.getServiceMap(timeRange);
  }

  /**
   * Get service metrics
   */
  public async getServiceMetrics(serviceName: string, timeRange: TimeRange): Promise<ServiceMetrics> {
    if (!this.activeProvider) {
      throw new Error('No active trace provider configured');
    }

    return await this.activeProvider.getServiceMetrics(serviceName, timeRange);
  }

  /**
   * Compare two traces
   */
  public compareTraces(before: Trace, after: Trace): TraceComparison {
    const durationDelta = after.duration - before.duration;
    const durationPercentChange = (durationDelta / before.duration) * 100;

    // Find new and removed spans
    const beforeOps = new Set(before.spans.map(s => s.operationName));
    const afterOps = new Set(after.spans.map(s => s.operationName));

    const newSpans = after.spans.filter(s => !beforeOps.has(s.operationName));
    const removedSpans = before.spans.filter(s => !afterOps.has(s.operationName));

    // Compare matching spans
    const spanComparisons: SpanComparison[] = [];

    for (const beforeSpan of before.spans) {
      const afterSpan = after.spans.find(s => s.operationName === beforeSpan.operationName);
      if (afterSpan) {
        const delta = afterSpan.duration - beforeSpan.duration;
        const percentChange = (delta / beforeSpan.duration) * 100;

        spanComparisons.push({
          operationName: beforeSpan.operationName,
          beforeDuration: beforeSpan.duration,
          afterDuration: afterSpan.duration,
          delta,
          percentChange,
        });
      }
    }

    const slowedSpans = spanComparisons.filter(c => c.delta > 1000).sort((a, b) => b.delta - a.delta);
    const improvedSpans = spanComparisons.filter(c => c.delta < -1000).sort((a, b) => a.delta - b.delta);

    return {
      before,
      after,
      changes: {
        durationDelta,
        durationPercentChange,
        newSpans,
        removedSpans,
        slowedSpans,
        improvedSpans,
      },
    };
  }

  /**
   * Detect performance regressions
   */
  public async detectRegressions(
    serviceName: string,
    baselineRange: TimeRange,
    currentRange: TimeRange
  ): Promise<PerformanceRegression[]> {
    if (!this.activeProvider) {
      throw new Error('No active trace provider configured');
    }

    const baseline = await this.activeProvider.getServiceMetrics(serviceName, baselineRange);
    const current = await this.activeProvider.getServiceMetrics(serviceName, currentRange);

    const regressions: PerformanceRegression[] = [];

    // Latency regression
    if (current.latency.p95 > baseline.latency.p95 * 1.2) {
      const delta = current.latency.p95 - baseline.latency.p95;
      const percentChange = (delta / baseline.latency.p95) * 100;

      regressions.push({
        type: 'latency',
        service: serviceName,
        severity: percentChange > 100 ? 'critical' : percentChange > 50 ? 'high' : 'medium',
        baseline: baseline.latency.p95,
        current: current.latency.p95,
        delta,
        percentChange,
        detectedAt: Date.now(),
        affectedTraces: current.slowTraces.map(t => t.traceId),
        rootCause: `P95 latency increased by ${percentChange.toFixed(1)}%`,
      });
    }

    // Error rate regression
    if (current.errorRate > baseline.errorRate * 1.5) {
      const delta = current.errorRate - baseline.errorRate;
      const percentChange = (delta / baseline.errorRate) * 100;

      regressions.push({
        type: 'error-rate',
        service: serviceName,
        severity: current.errorRate > 0.1 ? 'critical' : current.errorRate > 0.05 ? 'high' : 'medium',
        baseline: baseline.errorRate,
        current: current.errorRate,
        delta,
        percentChange,
        detectedAt: Date.now(),
        affectedTraces: current.errorTraces.map(t => t.traceId),
        rootCause: `Error rate increased by ${percentChange.toFixed(1)}%`,
      });
    }

    // Throughput regression
    if (current.requestRate < baseline.requestRate * 0.8) {
      const delta = current.requestRate - baseline.requestRate;
      const percentChange = (delta / baseline.requestRate) * 100;

      regressions.push({
        type: 'throughput',
        service: serviceName,
        severity: Math.abs(percentChange) > 50 ? 'high' : 'medium',
        baseline: baseline.requestRate,
        current: current.requestRate,
        delta,
        percentChange,
        detectedAt: Date.now(),
        affectedTraces: [],
        rootCause: `Request rate decreased by ${Math.abs(percentChange).toFixed(1)}%`,
      });
    }

    return regressions;
  }

  /**
   * Get critical path (longest span chain) from a trace
   */
  public getCriticalPath(trace: Trace): { spans: Span[]; totalDuration: number } {
    const spanMap = new Map(trace.spans.map(s => [s.spanId, s]));
    const rootSpans = trace.spans.filter(s => !s.parentSpanId);

    let longestPath: Span[] = [];
    let maxDuration = 0;

    for (const root of rootSpans) {
      const path = this.findLongestPath(root, spanMap);
      const duration = path.reduce((sum: number, s: Span) => sum + s.duration, 0);

      if (duration > maxDuration) {
        maxDuration = duration;
        longestPath = path;
      }
    }

    return {
      spans: longestPath,
      totalDuration: maxDuration,
    };
  }

  private findLongestPath(
    span: Span,
    spanMap: Map<string, Span>
  ): Span[] {
    const children = Array.from(spanMap.values()).filter(s => s.parentSpanId === span.spanId);

    if (children.length === 0) {
      return [span];
    }

    let longestChildPath: Span[] = [];
    let maxDuration = 0;

    for (const child of children) {
      const childPath = this.findLongestPath(child, spanMap);
      const duration = childPath.reduce((sum: number, s: Span) => sum + s.duration, 0);

      if (duration > maxDuration) {
        maxDuration = duration;
        longestChildPath = childPath;
      }
    }

    return [span, ...longestChildPath];
  }

  /**
   * Clear trace cache
   */
  public clearCache(): void {
    this.traceCache.clear();
  }
}
