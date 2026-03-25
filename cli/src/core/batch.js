"use strict";
/**
 * Batch Processing Module
 *
 * Implements efficient batch processing for multiple metrics:
 * - Parallel query execution
 * - Progress reporting
 * - Error handling and retry logic
 * - Result aggregation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchRegression = batchRegression;
exports.batchFetchMetrics = batchFetchMetrics;
exports.batchPreprocess = batchPreprocess;
exports.formatBatchResults = formatBatchResults;
exports.exportBatchResultsJSON = exportBatchResultsJSON;
const regression_1 = require("../core/regression");
const prometheus_1 = require("../services/prometheus");
const preprocessing_1 = require("../core/preprocessing");
/**
 * Process multiple metrics in batch
 */
async function batchRegression(metrics, prometheusConfig, baselineLabel, candidateLabel, regressionOptions, batchOptions = {}) {
    const { concurrency = 5, continueOnError = true, onProgress, retryCount = 2, retryDelay = 1000 } = batchOptions;
    const startTime = Date.now();
    const results = new Map();
    let completed = 0;
    const total = metrics.length;
    // Process metrics with concurrency control
    const queue = [...metrics];
    const executing = [];
    const processMetric = async (metric) => {
        try {
            const result = await processMetricWithRetry(metric, prometheusConfig, baselineLabel, candidateLabel, regressionOptions, retryCount, retryDelay);
            results.set(metric.name, result);
            completed++;
            if (onProgress) {
                onProgress(completed, total, metric.name);
            }
        }
        catch (error) {
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
            const metric = queue.shift();
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
        }
        else {
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
async function processMetricWithRetry(metric, prometheusConfig, baselineLabel, candidateLabel, regressionOptions, retryCount, retryDelay) {
    let lastError = null;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
            return await processSingleMetric(metric, prometheusConfig, baselineLabel, candidateLabel, regressionOptions);
        }
        catch (error) {
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
async function processSingleMetric(metric, prometheusConfig, baselineLabel, candidateLabel, regressionOptions) {
    const timeRange = metric.timeRange || '10m';
    // Fetch baseline data
    const baselineData = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
        metric: metric.name,
        label: baselineLabel,
        timeRange
    });
    // Fetch candidate data
    const candidateData = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
        metric: metric.name,
        label: candidateLabel,
        timeRange
    });
    // Run regression analysis
    const options = {
        baseline: baselineLabel,
        candidate: candidateLabel,
        metric: metric.name,
        threshold: metric.threshold || regressionOptions.threshold,
        pValue: regressionOptions.pValue,
        effectSizeThreshold: regressionOptions.effectSizeThreshold,
        minSamples: regressionOptions.minSamples,
        testType: regressionOptions.testType
    };
    return await (0, regression_1.runRegression)(options, baselineData, candidateData);
}
/**
 * Batch fetch metrics data
 */
async function batchFetchMetrics(metrics, prometheusConfig, label, batchOptions = {}) {
    const { concurrency = 5, continueOnError = true, onProgress } = batchOptions;
    const results = new Map();
    let completed = 0;
    const total = metrics.length;
    const queue = [...metrics];
    const executing = [];
    const fetchMetricData = async (metric) => {
        try {
            const data = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
                metric: metric.name,
                label,
                timeRange: metric.timeRange || '10m'
            });
            results.set(metric.name, data);
            completed++;
            if (onProgress) {
                onProgress(completed, total, metric.name);
            }
        }
        catch (error) {
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
            const metric = queue.shift();
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
async function batchPreprocess(metricsData, options = {}) {
    const results = new Map();
    for (const [metric, data] of metricsData) {
        const result = (0, preprocessing_1.preprocessData)(data, options);
        results.set(metric, result.data);
    }
    return results;
}
/**
 * Format batch results for display
 */
function formatBatchResults(batchResult) {
    const lines = [];
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
        }
        else {
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
function exportBatchResultsJSON(batchResult) {
    const output = {
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
        }
        else {
            output.results.push(result);
        }
    }
    return JSON.stringify(output, null, 2);
}
