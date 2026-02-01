import * as vscode from 'vscode';
import {
  TraceManager,
  PerformanceProfiler,
  VisualizationGenerator,
  TraceQuery,
} from '../tracing';

/**
 * Comprehensive examples demonstrating distributed tracing features
 */
export class TracingExamples {
  constructor(
    private context: vscode.ExtensionContext,
    private traceManager: TraceManager,
    private profiler: PerformanceProfiler,
    private visualizationGenerator: VisualizationGenerator
  ) {}

  /**
   * Example 1: Basic trace search and visualization
   */
  async example1_searchAndVisualize(): Promise<void> {
    console.log('Example 1: Searching traces and generating flame graph');

    try {
      // Search for traces from a specific service
      const now = Date.now();
      const query: TraceQuery = {
        serviceName: 'user-service',
        timeRange: {
          start: now - 3600000, // Last hour
          end: now,
        },
        limit: 10,
      };

      const traces = await this.traceManager.searchTraces(query);
      console.log(`Found ${traces.length} traces`);

      if (traces.length > 0) {
        const trace = traces[0];
        console.log(`Analyzing trace: ${trace.traceId}`);
        console.log(`  Duration: ${(trace.duration / 1000).toFixed(2)}ms`);
        console.log(`  Services: ${trace.services.join(', ')}`);
        console.log(`  Spans: ${trace.spans.length}`);

        // Generate flame graph
        const flameGraph = this.profiler.generateCPUFlameGraph(trace);
        console.log(`Flame graph generated with ${flameGraph.children.length} root nodes`);

        // Generate HTML visualization
        const html = this.visualizationGenerator.generateFlameGraphHTML(
          flameGraph,
          'User Service Trace'
        );

        // Display in webview
        const panel = vscode.window.createWebviewPanel(
          'traceFlameGraph',
          'Trace Flame Graph',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = html;
      }
    } catch (error: any) {
      console.error('Error in example 1:', error.message);
    }
  }

  /**
   * Example 2: Service dependency mapping
   */
  async example2_serviceDependencyMap(): Promise<void> {
    console.log('Example 2: Generating service dependency map');

    try {
      const now = Date.now();
      const serviceMap = await this.traceManager.getServiceMap({
        start: now - 3600000, // Last hour
        end: now,
      });

      console.log(`Service Map:`);
      console.log(`  Services: ${serviceMap.services.length}`);
      console.log(`  Dependencies: ${serviceMap.dependencies.length}`);

      // Print service health
      for (const service of serviceMap.services) {
        console.log(`\n  ${service.name}:`);
        console.log(`    Health: ${service.health}`);
        console.log(`    Requests: ${service.requestCount}`);
        console.log(`    Error Rate: ${((service.errorCount / service.requestCount) * 100).toFixed(2)}%`);
        console.log(`    Avg Duration: ${service.avgDuration.toFixed(2)}ms`);
        console.log(`    P95 Duration: ${service.p95Duration.toFixed(2)}ms`);
      }

      // Print dependencies
      console.log('\n  Dependencies:');
      for (const dep of serviceMap.dependencies) {
        console.log(`    ${dep.caller} → ${dep.callee}`);
        console.log(`      Requests: ${dep.requestCount}`);
        console.log(`      Error Rate: ${(dep.errorRate * 100).toFixed(2)}%`);
        console.log(`      Avg Duration: ${dep.avgDuration.toFixed(2)}ms`);
      }

      // Visualize service map
      const html = this.visualizationGenerator.generateServiceMapHTML(serviceMap);

      const panel = vscode.window.createWebviewPanel(
        'serviceMap',
        'Service Dependency Map',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = html;
    } catch (error: any) {
      console.error('Error in example 2:', error.message);
    }
  }

  /**
   * Example 3: Hot function detection
   */
  async example3_hotFunctionAnalysis(): Promise<void> {
    console.log('Example 3: Detecting hot functions');

    try {
      const now = Date.now();
      const traces = await this.traceManager.searchTraces({
        serviceName: 'payment-service',
        timeRange: {
          start: now - 3600000,
          end: now,
        },
        limit: 50,
      });

      console.log(`Analyzing ${traces.length} traces`);

      if (traces.length > 0) {
        // Analyze first trace
        const trace = traces[0];
        const hotFunctions = this.profiler.extractHotFunctions(trace, 'payment-service', 3);

        console.log('\nHot Functions (>3% of execution time):');
        for (const func of hotFunctions) {
          console.log(`\n  ${func.name}:`);
          console.log(`    Percentage: ${func.percentage.toFixed(2)}%`);
          console.log(`    Self Time: ${(func.selfTime / 1000).toFixed(2)}ms`);
          console.log(`    Total Time: ${(func.totalTime / 1000).toFixed(2)}ms`);
          console.log(`    Call Count: ${func.callCount}`);

          if (func.file && func.line) {
            console.log(`    Location: ${func.file}:${func.line}`);
          }
        }

        // Generate optimization suggestions
        console.log('\nOptimization Suggestions:');
        for (const func of hotFunctions.slice(0, 3)) {
          if (func.percentage > 20) {
            console.log(`  - ${func.name}: Consider caching or optimizing algorithm (${func.percentage.toFixed(1)}% of time)`);
          } else if (func.percentage > 10) {
            console.log(`  - ${func.name}: Profile further to identify bottlenecks (${func.percentage.toFixed(1)}% of time)`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error in example 3:', error.message);
    }
  }

  /**
   * Example 4: Database query analysis
   */
  async example4_databaseAnalysis(): Promise<void> {
    console.log('Example 4: Analyzing database queries');

    try {
      const now = Date.now();
      const traces = await this.traceManager.searchTraces({
        serviceName: 'order-service',
        timeRange: {
          start: now - 3600000,
          end: now,
        },
        limit: 20,
      });

      console.log(`Analyzing database queries in ${traces.length} traces`);

      if (traces.length > 0) {
        const trace = traces[0];
        const dbAnalysis = this.profiler.analyzeDatabaseQueries(trace);

        console.log(`\nDatabase Query Analysis:`);
        console.log(`  Total Queries: ${dbAnalysis.queryCount}`);
        console.log(`  Total Query Time: ${(dbAnalysis.totalQueryTime / 1000).toFixed(2)}ms`);
        console.log(`  Slow Queries (>1s): ${dbAnalysis.slowQueries.length}`);
        console.log(`  N+1 Patterns: ${dbAnalysis.nPlusOneDetections.length}`);

        // Show slow queries
        if (dbAnalysis.slowQueries.length > 0) {
          console.log('\nSlow Queries:');
          for (const query of dbAnalysis.slowQueries.slice(0, 5)) {
            console.log(`\n  Duration: ${(query.duration / 1000).toFixed(2)}ms`);
            console.log(`  Database: ${query.database}`);
            console.log(`  Operation: ${query.operation}`);
            console.log(`  Query: ${query.query.substring(0, 100)}${query.query.length > 100 ? '...' : ''}`);
          }
        }

        // Show N+1 patterns
        if (dbAnalysis.nPlusOneDetections.length > 0) {
          console.log('\nN+1 Query Patterns:');
          for (const nPlusOne of dbAnalysis.nPlusOneDetections) {
            console.log(`\n  Query: ${nPlusOne.query.substring(0, 100)}...`);
            console.log(`  Occurrences: ${nPlusOne.occurrences}`);
            console.log(`  Total Duration: ${(nPlusOne.totalDuration / 1000).toFixed(2)}ms`);
            console.log(`  Suggestion: ${nPlusOne.suggestion}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error in example 4:', error.message);
    }
  }

  /**
   * Example 5: Critical path analysis
   */
  async example5_criticalPathAnalysis(): Promise<void> {
    console.log('Example 5: Finding critical path');

    try {
      const now = Date.now();
      const traces = await this.traceManager.searchTraces({
        minDuration: 1000, // Slow traces (>1s)
        timeRange: {
          start: now - 3600000,
          end: now,
        },
        limit: 10,
      });

      console.log(`Analyzing ${traces.length} slow traces`);

      if (traces.length > 0) {
        const trace = traces[0];
        const criticalPath = this.traceManager.getCriticalPath(trace);

        console.log(`\nCritical Path (${criticalPath.spans.length} spans):`);
        console.log(`  Total Duration: ${(criticalPath.totalDuration / 1000).toFixed(2)}ms`);
        console.log(`  Percentage of Trace: ${((criticalPath.totalDuration / trace.duration) * 100).toFixed(1)}%`);

        console.log('\n  Span Chain:');
        for (const span of criticalPath.spans) {
          console.log(`    ${span.serviceName}.${span.operationName}`);
          console.log(`      Duration: ${(span.duration / 1000).toFixed(2)}ms`);

          if (span.tags['http.method']) {
            console.log(`      HTTP: ${span.tags['http.method']} ${span.tags['http.url']}`);
          }

          if (span.tags['db.statement']) {
            console.log(`      DB: ${span.tags['db.statement'].substring(0, 60)}...`);
          }
        }

        // Identify the slowest span in the critical path
        const slowestSpan = criticalPath.spans.reduce((max, span) =>
          span.duration > max.duration ? span : max
        );

        console.log(`\n  Slowest Span in Critical Path:`);
        console.log(`    ${slowestSpan.serviceName}.${slowestSpan.operationName}`);
        console.log(`    Duration: ${(slowestSpan.duration / 1000).toFixed(2)}ms`);
        console.log(`    Percentage: ${((slowestSpan.duration / criticalPath.totalDuration) * 100).toFixed(1)}% of critical path`);
      }
    } catch (error: any) {
      console.error('Error in example 5:', error.message);
    }
  }

  /**
   * Example 6: Performance regression detection
   */
  async example6_regressionDetection(): Promise<void> {
    console.log('Example 6: Detecting performance regressions');

    try {
      const now = Date.now();

      // Compare last hour vs previous hour
      const regressions = await this.traceManager.detectRegressions(
        'checkout-service',
        { start: now - 7200000, end: now - 3600000 }, // 2 hours ago to 1 hour ago (baseline)
        { start: now - 3600000, end: now } // Last hour (current)
      );

      console.log(`\nRegression Analysis for checkout-service:`);

      if (regressions.length === 0) {
        console.log('  No regressions detected');
      } else {
        console.log(`  Found ${regressions.length} regression(s):`);

        for (const regression of regressions) {
          const icon = regression.severity === 'critical' ? '🔴' : '⚠️';
          console.log(`\n  ${icon} ${regression.type.toUpperCase()} Regression:`);
          console.log(`    Severity: ${regression.severity}`);
          console.log(`    Baseline: ${regression.baseline.toFixed(2)}`);
          console.log(`    Current: ${regression.current.toFixed(2)}`);
          console.log(`    Change: ${regression.percentChange > 0 ? '+' : ''}${regression.percentChange.toFixed(1)}%`);
          console.log(`    Root Cause: ${regression.rootCause}`);

          if (regression.affectedTraces.length > 0) {
            console.log(`    Affected Traces: ${regression.affectedTraces.slice(0, 3).join(', ')}`);
          }
        }

        // Suggest actions
        console.log('\n  Recommended Actions:');
        for (const regression of regressions) {
          if (regression.severity === 'critical') {
            console.log(`    - Investigate ${regression.type} immediately`);
            console.log(`    - Review recent deployments or configuration changes`);
          } else {
            console.log(`    - Monitor ${regression.type} trends`);
            console.log(`    - Consider rolling back if issue persists`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error in example 6:', error.message);
    }
  }

  /**
   * Run all examples
   */
  async runAllExamples(): Promise<void> {
    console.log('='.repeat(80));
    console.log('Running All Distributed Tracing Examples');
    console.log('='.repeat(80));

    const examples = [
      { name: 'Search and Visualize', fn: () => this.example1_searchAndVisualize() },
      { name: 'Service Dependency Map', fn: () => this.example2_serviceDependencyMap() },
      { name: 'Hot Function Analysis', fn: () => this.example3_hotFunctionAnalysis() },
      { name: 'Database Analysis', fn: () => this.example4_databaseAnalysis() },
      { name: 'Critical Path Analysis', fn: () => this.example5_criticalPathAnalysis() },
      { name: 'Regression Detection', fn: () => this.example6_regressionDetection() },
    ];

    for (const example of examples) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Running: ${example.name}`);
      console.log('='.repeat(80));

      try {
        await example.fn();
      } catch (error: any) {
        console.error(`Failed to run ${example.name}:`, error.message);
      }

      // Wait a bit between examples
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('All Examples Completed');
    console.log('='.repeat(80));
  }
}
