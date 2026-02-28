/**
 * Batch Processing Module
 * 
 * Implements efficient batch processing for multiple metrics:
 * - Parallel query execution
 * - Progress reporting
 * - Error handling and retry logic
 * - Result aggregation
 */

import { RegressionOptions, RegressionResult, runRegression } from '../core/regression';
import { fetchMetric, fetchRangeMetrics, PrometheusConfig } from '../services/prometheus';
import { PreprocessingOptions, preprocessData } from '../core/preprocessing';

export interface BatchMetric {
  /** Metric name */
  name: string;
  /** Optional label filter */
  label?: string;
  /** Specific threshold for this metric */
  threshold?: number;
  /** Time range for query */
  timeRange?: string;
}

export interface BatchOptions {
  /** Parallel execution limit (default: 5) */
  concurrency?: number;
  /** Continue on error (default: true) */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (completed: number, total: number, metric: string) => void;
  /** Retry failed queries */
  retryCount?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

export interface BatchResult {
  /** Per-metric results */
  results: Map<string, RegressionResult | Error>;
  /** Overall summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    errored: number;
  };
  /** Execution time in ms */
  executionTime: number;
}

/**
 * Process multiple metrics in batch
 */
export async function batchRegression(
  metrics: BatchMetric[],
  prometheusConfig: PrometheusConfig,
  baselineLabel: string,
  candidateLabel: string,
  regressionOptions: Partial<RegressionOptions>,
  batchOptions: BatchOptions = {}
): Promise<BatchResult> {
  const {
    concurrency = 5,
    continueOnError = true,
    onProgress,
    retryCount = 2,
    retryDelay = 1000
  } = batchOptions;

  const startTime = Date.now();
  const results = new Map<string, RegressionResult | Error>();
  
  let completed = 0;
  const total = metrics.length;

  // Process metrics with concurrency control
  const queue = [...metrics];
  const executing: Promise<void>[] = [];

  const processMetric = async (metric: BatchMetric): Promise<void> => {
    try {
      const result = await processMetricWithRetry(
        metric,
        prometheusConfig,
        baselineLabel,
        candidateLabel,
        regressionOptions,
        retryCount,
        retryDelay
      );
      
      results.set(metric.name, result);
      completed++;
      
      if (onProgress) {
        onProgress(completed, total, metric.name);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.set(metric.name, err);
      completed++;
      
      if (onProgress) {
        onProgress(completed, total, metric.name);
      }
      
      if (!continueOnError) {
        throw err;
      }
    }
  };

  // Execute with concurrency limit
  while (queue.length > 0 || executing.length > 0) {
    // Start new tasks up to concurrency limit
    while (queue.length > 0 && executing.length < concurrency) {
      const metric = queue.shift()!;
      const promise = processMetric(metric).then(() => {
        executing.splice(executing.indexOf(promise), 1);
      });
      executing.push(promise);
    }

    // Wait for at least one task to complete
    if (executing.length > 0) {
      await Promise.race(executing);
    }
  }

  // Calculate summary
  const summary = {
    total,
    passed: 0,
    failed: 0,
    warned: 0,
    errored: 0
  };

  for (const [, result] of results) {
    if (result instanceof Error) {
      summary.errored++;
    } else {
      switch (result.verdict) {
        case 'PASS':
          summary.passed++;
          break;
        case 'FAIL':
          summary.failed++;
          break;
        case 'WARN':
          summary.warned++;
          break;
        case 'INSUFFICIENT_DATA':
          summary.errored++;
          break;
      }
    }
  }

  const executionTime = Date.now() - startTime;

  return { results, summary, executionTime };
}

/**
 * Process single metric with retry logic
 */
async function processMetricWithRetry(
  metric: BatchMetric,
  prometheusConfig: PrometheusConfig,
  baselineLabel: string,
  candidateLabel: string,
  regressionOptions: Partial<RegressionOptions>,
  retryCount: number,
  retryDelay: number
): Promise<RegressionResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await processSingleMetric(
        metric,
        prometheusConfig,
        baselineLabel,
        candidateLabel,
        regressionOptions
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retryCount) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Unknown error during metric processing');
}

/**
 * Process single metric
 */
async function processSingleMetric(
  metric: BatchMetric,
  prometheusConfig: PrometheusConfig,
  baselineLabel: string,
  candidateLabel: string,
  regressionOptions: Partial<RegressionOptions>
): Promise<RegressionResult> {
  const timeRange = metric.timeRange || '10m';

  // Fetch baseline data
  const baselineData = await fetchMetric(prometheusConfig, {
    metric: metric.name,
    label: baselineLabel,
    timeRange
  });

  // Fetch candidate data
  const candidateData = await fetchMetric(prometheusConfig, {
    metric: metric.name,
    label: candidateLabel,
    timeRange
  });

  // Run regression analysis
  const options: RegressionOptions = {
    baseline: baselineLabel,
    candidate: candidateLabel,
    metric: metric.name,
    threshold: metric.threshold || regressionOptions.threshold,
    pValue: regressionOptions.pValue,
    effectSizeThreshold: regressionOptions.effectSizeThreshold,
    minSamples: regressionOptions.minSamples,
    testType: regressionOptions.testType
  };

  return await runRegression(options, baselineData, candidateData);
}

/**
 * Batch fetch metrics data
 */
export async function batchFetchMetrics(
  metrics: BatchMetric[],
  prometheusConfig: PrometheusConfig,
  label: string,
  batchOptions: BatchOptions = {}
): Promise<Map<string, number[]>> {
  const {
    concurrency = 5,
    continueOnError = true,
    onProgress
  } = batchOptions;

  const results = new Map<string, number[]>();
  let completed = 0;
  const total = metrics.length;

  const queue = [...metrics];
  const executing: Promise<void>[] = [];

  const fetchMetricData = async (metric: BatchMetric): Promise<void> => {
    try {
      const data = await fetchMetric(prometheusConfig, {
        metric: metric.name,
        label,
        timeRange: metric.timeRange || '10m'
      });
      
      results.set(metric.name, data);
      completed++;
      
      if (onProgress) {
        onProgress(completed, total, metric.name);
      }
    } catch (error) {
      completed++;
      
      if (onProgress) {
        onProgress(completed, total, metric.name);
      }
      
      if (!continueOnError) {
        throw error;
      }
    }
  };

  // Execute with concurrency limit
  while (queue.length > 0 || executing.length > 0) {
    while (queue.length > 0 && executing.length < concurrency) {
      const metric = queue.shift()!;
      const promise = fetchMetricData(metric).then(() => {
        executing.splice(executing.indexOf(promise), 1);
      });
      executing.push(promise);
    }

    if (executing.length > 0) {
      await Promise.race(executing);
    }
  }

  return results;
}

/**
 * Batch preprocess metrics
 */
export async function batchPreprocess(
  metricsData: Map<string, number[]>,
  options: PreprocessingOptions = {}
): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();

  for (const [metric, data] of metricsData) {
    const result = preprocessData(data, options);
    results.set(metric, result.data);
  }

  return results;
}

/**
 * Format batch results for display
 */
export function formatBatchResults(batchResult: BatchResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('=== Batch Regression Analysis ===');
  lines.push('');
  
  // Summary
  lines.push('Summary:');
  lines.push(`  Total: ${batchResult.summary.total}`);
  lines.push(`  ✓ Passed: ${batchResult.summary.passed}`);
  lines.push(`  ✗ Failed: ${batchResult.summary.failed}`);
  lines.push(`  ⚠ Warned: ${batchResult.summary.warned}`);
  lines.push(`  ⚠ Errored: ${batchResult.summary.errored}`);
  lines.push(`  Duration: ${(batchResult.executionTime / 1000).toFixed(2)}s`);
  lines.push('');
  
  // Individual results
  lines.push('Results:');
  for (const [metric, result] of batchResult.results) {
    if (result instanceof Error) {
      lines.push(`  ✗ ${metric}: ERROR - ${result.message}`);
    } else {
      const icon = result.verdict === 'PASS' ? '✓' : result.verdict === 'FAIL' ? '✗' : '⚠';
      const change = result.change_percent > 0 ? '+' : '';
      lines.push(`  ${icon} ${metric}: ${result.verdict} (${change}${result.change_percent.toFixed(1)}%, p=${result.p_value.toFixed(3)})`);
    }
  }
  
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Export batch results to JSON
 */
export function exportBatchResultsJSON(batchResult: BatchResult): string {
  const output: any = {
    summary: batchResult.summary,
    execution_time_ms: batchResult.executionTime,
    results: []
  };

  for (const [metric, result] of batchResult.results) {
    if (result instanceof Error) {
      output.results.push({
        metric,
        error: result.message,
        verdict: 'ERROR'
      });
    } else {
      output.results.push(result);
    }
  }

  return JSON.stringify(output, null, 2);
}
