import {
  FlameGraphNode,
  CPUProfile,
  MemoryProfile,
  HotFunction,
  MemoryAllocator,
  DatabaseQueryAnalysis,
  DatabaseQuery,
  NPlusOnePattern,
  Trace,
  Span,
} from './ITraceProvider';

/**
 * Performance profiler for CPU, memory, and database analysis
 */
export class PerformanceProfiler {
  /**
   * Generate CPU flame graph from trace spans
   */
  public generateCPUFlameGraph(trace: Trace, serviceName?: string): FlameGraphNode {
    const relevantSpans = serviceName
      ? trace.spans.filter(s => s.serviceName === serviceName)
      : trace.spans;

    const rootSpans = relevantSpans.filter(s => !s.parentSpanId);

    if (rootSpans.length === 0) {
      return {
        name: 'root',
        value: 0,
        children: [],
        percentage: 0,
      };
    }

    // Build tree from root
    const root: FlameGraphNode = {
      name: 'root',
      value: 0,
      children: [],
      percentage: 100,
    };

    for (const rootSpan of rootSpans) {
      const child = this.buildFlameGraphNode(rootSpan, relevantSpans);
      root.value += child.value;
      root.children.push(child);
    }

    // Calculate percentages
    this.calculatePercentages(root, root.value);

    return root;
  }

  private buildFlameGraphNode(span: Span, allSpans: Span[]): FlameGraphNode {
    const node: FlameGraphNode = {
      name: `${span.serviceName}.${span.operationName}`,
      value: span.duration,
      children: [],
      file: span.tags['code.filepath'] as string,
      line: span.tags['code.lineno'] as number,
      percentage: 0,
    };

    // Find children
    const children = allSpans.filter(s => s.parentSpanId === span.spanId);

    for (const child of children) {
      node.children.push(this.buildFlameGraphNode(child, allSpans));
    }

    return node;
  }

  private calculatePercentages(node: FlameGraphNode, total: number): void {
    node.percentage = (node.value / total) * 100;

    for (const child of node.children) {
      this.calculatePercentages(child, total);
    }
  }

  /**
   * Extract hot functions from trace
   */
  public extractHotFunctions(trace: Trace, serviceName?: string, threshold: number = 5): HotFunction[] {
    const relevantSpans = serviceName
      ? trace.spans.filter(s => s.serviceName === serviceName)
      : trace.spans;

    const functionMap = new Map<string, {
      selfTime: number;
      totalTime: number;
      callCount: number;
      file?: string;
      line?: number;
    }>();

    for (const span of relevantSpans) {
      const funcName = span.operationName;
      const file = span.tags['code.filepath'] as string;
      const line = span.tags['code.lineno'] as number;

      // Calculate self time (time spent in this span excluding children)
      const children = relevantSpans.filter(s => s.parentSpanId === span.spanId);
      const childrenTime = children.reduce((sum, c) => sum + c.duration, 0);
      const selfTime = span.duration - childrenTime;

      const existing = functionMap.get(funcName) || {
        selfTime: 0,
        totalTime: 0,
        callCount: 0,
        file,
        line,
      };

      existing.selfTime += selfTime;
      existing.totalTime += span.duration;
      existing.callCount++;

      functionMap.set(funcName, existing);
    }

    const totalTime = trace.duration;
    const hotFunctions: HotFunction[] = [];

    for (const [name, data] of functionMap) {
      const percentage = (data.selfTime / totalTime) * 100;

      if (percentage >= threshold) {
        hotFunctions.push({
          name,
          file: data.file,
          line: data.line,
          selfTime: data.selfTime,
          totalTime: data.totalTime,
          callCount: data.callCount,
          percentage,
        });
      }
    }

    // Sort by self time descending
    hotFunctions.sort((a, b) => b.selfTime - a.selfTime);

    return hotFunctions;
  }

  /**
   * Analyze database queries from trace
   */
  public analyzeDatabaseQueries(trace: Trace): DatabaseQueryAnalysis {
    const queries: DatabaseQuery[] = [];
    const queryPatterns = new Map<string, {
      count: number;
      totalDuration: number;
      spanIds: string[];
    }>();

    for (const span of trace.spans) {
      // Look for database spans
      const dbSystem = span.tags['db.system'] as string;
      const dbStatement = span.tags['db.statement'] as string;

      if (dbSystem && dbStatement) {
        const query: DatabaseQuery = {
          query: dbStatement,
          duration: span.duration,
          timestamp: span.startTime,
          database: span.tags['db.name'] as string || 'unknown',
          operation: this.detectQueryOperation(dbStatement),
          rowsAffected: span.tags['db.rows_affected'] as number,
          spanId: span.spanId,
        };

        queries.push(query);

        // Normalize query for pattern detection (remove values)
        const normalizedQuery = this.normalizeQuery(dbStatement);

        const existing = queryPatterns.get(normalizedQuery) || {
          count: 0,
          totalDuration: 0,
          spanIds: [],
        };

        existing.count++;
        existing.totalDuration += span.duration;
        existing.spanIds.push(span.spanId);

        queryPatterns.set(normalizedQuery, existing);
      }
    }

    // Sort queries by duration
    const sortedQueries = [...queries].sort((a, b) => b.duration - a.duration);

    // Detect slow queries (>1 second)
    const slowQueries = sortedQueries.filter(q => q.duration > 1000000);

    // Detect N+1 patterns (same query executed multiple times)
    const nPlusOneDetections: NPlusOnePattern[] = [];

    for (const [query, data] of queryPatterns) {
      if (data.count >= 10) {
        nPlusOneDetections.push({
          query,
          occurrences: data.count,
          totalDuration: data.totalDuration,
          spanIds: data.spanIds,
          suggestion: `Consider using batch loading or eager loading to reduce ${data.count} queries to 1`,
        });
      }
    }

    const totalQueryTime = queries.reduce((sum, q) => sum + q.duration, 0);

    return {
      queries,
      slowQueries,
      nPlusOneDetections,
      totalQueryTime,
      queryCount: queries.length,
    };
  }

  private detectQueryOperation(query: string): DatabaseQuery['operation'] {
    const upperQuery = query.trim().toUpperCase();

    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';

    return 'OTHER';
  }

  private normalizeQuery(query: string): string {
    // Remove quoted strings
    let normalized = query.replaceAll(/'[^']*'/g, '?');

    // Remove numbers
    normalized = normalized.replaceAll(/\b\d+\b/g, '?');

    // Remove multiple spaces
    normalized = normalized.replaceAll(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Generate memory flame graph (placeholder for future memory profiling integration)
   */
  public generateMemoryFlameGraph(trace: Trace, serviceName?: string): FlameGraphNode {
    // This would integrate with Python memory_profiler, Node.js heap snapshots, etc.
    // For now, return a basic structure based on span allocations

    const relevantSpans = serviceName
      ? trace.spans.filter(s => s.serviceName === serviceName)
      : trace.spans;

    const root: FlameGraphNode = {
      name: 'root',
      value: 0,
      children: [],
      percentage: 100,
    };

    for (const span of relevantSpans) {
      // Check for memory allocation tags
      const allocBytes = span.tags['memory.allocated'] as number || 0;

      if (allocBytes > 0) {
        root.children.push({
          name: `${span.serviceName}.${span.operationName}`,
          value: allocBytes,
          children: [],
          file: span.tags['code.filepath'] as string,
          line: span.tags['code.lineno'] as number,
          percentage: 0,
        });

        root.value += allocBytes;
      }
    }

    this.calculatePercentages(root, root.value);

    return root;
  }

  /**
   * Extract top memory allocators
   */
  public extractMemoryAllocators(trace: Trace, serviceName?: string, limit: number = 10): MemoryAllocator[] {
    const relevantSpans = serviceName
      ? trace.spans.filter(s => s.serviceName === serviceName)
      : trace.spans;

    const allocators: MemoryAllocator[] = [];
    let totalAllocated = 0;

    for (const span of relevantSpans) {
      const allocBytes = span.tags['memory.allocated'] as number || 0;

      if (allocBytes > 0) {
        allocators.push({
          name: span.operationName,
          file: span.tags['code.filepath'] as string,
          line: span.tags['code.lineno'] as number,
          allocated: allocBytes,
          allocations: 1,
          percentage: 0,
        });

        totalAllocated += allocBytes;
      }
    }

    // Calculate percentages
    for (const allocator of allocators) {
      allocator.percentage = (allocator.allocated / totalAllocated) * 100;
    }

    // Sort and limit
    allocators.sort((a, b) => b.allocated - a.allocated);

    return allocators.slice(0, limit);
  }

  /**
   * Find the critical path (slowest chain) in a trace
   */
  public findCriticalPath(trace: Trace): Span[] {
    const spanMap = new Map(trace.spans.map(s => [s.spanId, s]));
    const rootSpans = trace.spans.filter(s => !s.parentSpanId);

    let longestPath: Span[] = [];
    let maxDuration = 0;

    for (const root of rootSpans) {
      const path = this.findLongestSpanPath(root, spanMap);
      const duration = path.reduce((sum, s) => sum + s.duration, 0);

      if (duration > maxDuration) {
        maxDuration = duration;
        longestPath = path;
      }
    }

    return longestPath;
  }

  private findLongestSpanPath(span: Span, spanMap: Map<string, Span>): Span[] {
    const children = Array.from(spanMap.values()).filter(s => s.parentSpanId === span.spanId);

    if (children.length === 0) {
      return [span];
    }

    let longestChildPath: Span[] = [];
    let maxDuration = 0;

    for (const child of children) {
      const childPath = this.findLongestSpanPath(child, spanMap);
      const duration = childPath.reduce((sum, s) => sum + s.duration, 0);

      if (duration > maxDuration) {
        maxDuration = duration;
        longestChildPath = childPath;
      }
    }

    return [span, ...longestChildPath];
  }
}
