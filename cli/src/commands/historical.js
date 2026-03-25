"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHistoricalCommand = registerHistoricalCommand;
const regression_1 = require("../core/regression");
const prometheus_1 = require("../services/prometheus");
const policyLoaderV2_1 = require("../services/policyLoaderV2");
const welch_1 = require("../core/stats/welch");
const persistence_1 = require("../services/persistence");
function calculateStdDev(values) {
    if (values.length < 2) {
        return 0;
    }
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}
function registerHistoricalCommand(program) {
    program
        .command('historical')
        .description('Compare candidate against multiple historical baselines')
        .requiredOption('--baselines <deployments>', 'Comma-separated list of baseline deployments (oldest to newest)')
        .requiredOption('--candidate <deployment>', 'Candidate deployment identifier')
        .option('--metric <metric>', 'Metric to analyze', 'latency_p95')
        .option('--service <service>', 'Service name for service-specific policies')
        .option('--config <path>', 'Path to vitals.yaml config file')
        .option('--prometheus-url <url>', 'Prometheus server URL')
        .option('--time-range <range>', 'Time range for metrics', '10m')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .option('--aggregate <method>', 'Aggregation method for baselines: mean, median, last', 'last')
        .option('--min-baselines <count>', 'Minimum number of baselines required', '3')
        .option('--no-phase5-persist', 'Disable persisting results into the Phase 5 regression database')
        .option('--data-root <path>', 'Phase 5 data root', '~/.vitals')
        .option('--no-color', 'Disable colored output')
        .action(async (options) => {
        try {
            // Suppress progress when outputting JSON
            const isJsonFormat = options.format === 'json';
            const logProgress = (msg) => {
                if (!isJsonFormat) {
                    console.error(msg);
                }
            };
            // Load policy config
            const configPath = options.config || (0, policyLoaderV2_1.findPolicyConfig)();
            const policy = configPath ? (0, policyLoaderV2_1.loadPolicy)(configPath) : null;
            if (configPath && policy && !isJsonFormat) {
                console.error(`✓ Loaded policy from: ${configPath}\n`);
            }
            // Get metric-specific policy
            const metricPolicy = policy
                ? (0, policyLoaderV2_1.getServiceMetricPolicy)(policy, options.service || null, options.metric)
                : null;
            // Get defaults from policy
            const defaults = (0, policyLoaderV2_1.getDefaultOptions)(policy, options.service);
            const prometheusUrl = options.prometheusUrl || defaults.prometheusUrl;
            const threshold = metricPolicy?.regression?.max_increase_percent || 10;
            const pValue = metricPolicy?.regression?.p_value || 0.05;
            const effectSize = metricPolicy?.regression?.effect_size || 0.5;
            const prometheusConfig = { url: prometheusUrl };
            // Parse baseline deployments
            const baselineDeployments = options.baselines.split(',').map((d) => d.trim());
            const minBaselines = parseInt(options.minBaselines);
            if (baselineDeployments.length < minBaselines) {
                console.error(`Error: At least ${minBaselines} baseline deployments required`);
                process.exit(2);
            }
            logProgress(`Analyzing against ${baselineDeployments.length} historical baselines...\n`);
            // Fetch baseline data for all deployments
            logProgress('Fetching historical baseline data...');
            const baselineDataSets = [];
            for (const deployment of baselineDeployments) {
                try {
                    const data = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
                        metric: options.metric,
                        label: deployment,
                        timeRange: options.timeRange
                    });
                    if (data.length > 0) {
                        baselineDataSets.push({ deployment, data });
                        logProgress(`  ✓ ${deployment}: ${data.length} samples`);
                    }
                    else {
                        logProgress(`  ⚠ ${deployment}: No data`);
                    }
                }
                catch (error) {
                    logProgress(`  ✗ ${deployment}: ${error.message}`);
                }
            }
            if (baselineDataSets.length < minBaselines) {
                console.error(`\nError: Only ${baselineDataSets.length} baselines with valid data (minimum: ${minBaselines})`);
                process.exit(2);
            }
            // Aggregate baseline data
            const aggregatedBaseline = aggregateBaselines(baselineDataSets, options.aggregate);
            logProgress(`\nAggregated baseline (${options.aggregate}): ${aggregatedBaseline.length} samples\n`);
            // Fetch candidate data
            logProgress(`Fetching candidate data for ${options.candidate}...`);
            const candidateData = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
                metric: options.metric,
                label: options.candidate,
                timeRange: options.timeRange
            });
            logProgress(`  ✓ ${candidateData.length} samples\n`);
            // Run regression analysis
            logProgress('Running regression analysis...\n');
            const result = await (0, regression_1.runRegression)({
                baseline: `historical-${options.aggregate}`,
                candidate: options.candidate,
                metric: options.metric,
                threshold,
                pValue,
                effectSizeThreshold: effectSize,
                minSamples: 30
            }, aggregatedBaseline, candidateData);
            // Evaluate against policy
            const evaluation = (0, policyLoaderV2_1.evaluateRegression)(options.metric, result.change_percent, result.p_value, result.effect_size, result.significant, metricPolicy);
            // Determine final verdict
            let finalVerdict = result.verdict;
            if (evaluation.action === 'fail' && result.verdict !== 'INSUFFICIENT_DATA') {
                finalVerdict = 'FAIL';
            }
            else if (evaluation.action === 'warn' && result.verdict === 'PASS') {
                finalVerdict = 'WARN';
            }
            if (options.phase5Persist) {
                try {
                    await (0, persistence_1.persistRegressionToPhase5)({
                        dataRoot: options.dataRoot,
                        service: options.service,
                        metric: options.metric,
                        baselineLabel: `historical-${options.aggregate}`,
                        candidateLabel: options.candidate,
                        verdict: finalVerdict,
                        baselineMean: result.baseline.mean,
                        baselineSamples: result.baseline.samples,
                        baselineStdDev: calculateStdDev(aggregatedBaseline),
                        candidateMean: result.candidate.mean,
                        candidateSamples: result.candidate.samples,
                        candidateStdDev: calculateStdDev(candidateData),
                        changePercent: result.change_percent,
                        pValue: result.p_value,
                        effectSize: result.effect_size,
                        threshold,
                        metadata: {
                            policy_action: evaluation.action,
                            policy_reason: evaluation.reason,
                            historical_baselines: baselineDeployments,
                            aggregation: options.aggregate
                        }
                    });
                    logProgress('✓ Persisted historical analysis result into Phase 5 database');
                }
                catch (persistError) {
                    logProgress(`⚠ Failed to persist Phase 5 regression record: ${persistError.message}`);
                }
            }
            // Output results
            if (options.format === 'json') {
                console.log(JSON.stringify({
                    metric: options.metric,
                    candidate: options.candidate,
                    baselines: baselineDeployments,
                    aggregation: options.aggregate,
                    baseline_samples: aggregatedBaseline.length,
                    candidate_samples: candidateData.length,
                    result: {
                        verdict: finalVerdict,
                        change_percent: result.change_percent,
                        p_value: result.p_value,
                        effect_size: result.effect_size,
                        significant: result.significant
                    },
                    policy: {
                        action: evaluation.action,
                        reason: evaluation.reason,
                        should_rollback: evaluation.shouldRollback
                    },
                    historical_data: baselineDataSets.map(b => ({
                        deployment: b.deployment,
                        mean: (0, welch_1.mean)(b.data),
                        samples: b.data.length
                    }))
                }, null, 2));
            }
            else {
                printPrettyHistoricalResult(options.metric, options.candidate, baselineDeployments, baselineDataSets, result, evaluation, finalVerdict, options.aggregate);
            }
            // Exit with appropriate code
            const exitCode = getExitCode(finalVerdict);
            process.exit(exitCode);
        }
        catch (error) {
            console.error(`\nError: ${error.message}`);
            process.exit(2);
        }
    });
}
function aggregateBaselines(dataSetss, method) {
    if (dataSetss.length === 0) {
        return [];
    }
    switch (method) {
        case 'mean':
            // Average values across all baselines
            return aggregateMean(dataSetss);
        case 'median':
            // Median values across all baselines
            return aggregateMedian(dataSetss);
        case 'last':
        default:
            // Use the most recent baseline
            return dataSetss[dataSetss.length - 1].data;
    }
}
function aggregateMean(dataSets) {
    const maxLength = Math.max(...dataSets.map(ds => ds.data.length));
    const result = [];
    for (let i = 0; i < maxLength; i++) {
        const values = [];
        for (const ds of dataSets) {
            if (i < ds.data.length) {
                values.push(ds.data[i]);
            }
        }
        if (values.length > 0) {
            result.push((0, welch_1.mean)(values));
        }
    }
    return result;
}
function aggregateMedian(dataSets) {
    const maxLength = Math.max(...dataSets.map(ds => ds.data.length));
    const result = [];
    for (let i = 0; i < maxLength; i++) {
        const values = [];
        for (const ds of dataSets) {
            if (i < ds.data.length) {
                values.push(ds.data[i]);
            }
        }
        if (values.length > 0) {
            values.sort((a, b) => a - b);
            const mid = Math.floor(values.length / 2);
            result.push(values.length % 2 === 0
                ? (values[mid - 1] + values[mid]) / 2
                : values[mid]);
        }
    }
    return result;
}
function printPrettyHistoricalResult(metric, candidate, baselines, baselineData, result, evaluation, verdict, aggregation) {
    console.log('━'.repeat(80));
    console.log('  VITALS Historical Baseline Analysis');
    console.log('━'.repeat(80));
    console.log('');
    console.log(`  Metric:           ${metric}`);
    console.log(`  Candidate:        ${candidate}`);
    console.log(`  Baselines:        ${baselines.length} deployments`);
    console.log(`  Aggregation:      ${aggregation}`);
    console.log(`  Verdict:          ${formatVerdict(verdict)}`);
    console.log('');
    console.log('━'.repeat(80));
    console.log('  Historical Baselines');
    console.log('━'.repeat(80));
    console.log('');
    for (const baseline of baselineData) {
        const baselineMean = (0, welch_1.mean)(baseline.data);
        console.log(`  ${baseline.deployment.padEnd(30)} ${baselineMean.toFixed(2).padStart(10)} ms  (${baseline.data.length} samples)`);
    }
    console.log('');
    console.log('━'.repeat(80));
    console.log('  Regression Analysis');
    console.log('━'.repeat(80));
    console.log('');
    console.log(`  Baseline Mean:    ${result.baseline.mean.toFixed(2)} ms`);
    console.log(`  Candidate Mean:   ${result.candidate.mean.toFixed(2)} ms`);
    console.log(`  Change:           ${result.change_percent >= 0 ? '+' : ''}${result.change_percent.toFixed(1)}%`);
    console.log(`  p-value:          ${result.p_value.toFixed(3)}`);
    console.log(`  Effect Size:      ${result.effect_size.toFixed(2)}`);
    console.log(`  Significant:      ${result.significant ? 'Yes' : 'No'}`);
    console.log('');
    console.log('━'.repeat(80));
    console.log('  Policy Evaluation');
    console.log('━'.repeat(80));
    console.log('');
    console.log(`  Action:           ${evaluation.action}`);
    console.log(`  Reason:           ${evaluation.reason}`);
    console.log(`  Should Rollback:  ${evaluation.shouldRollback ? 'Yes' : 'No'}`);
    console.log('');
    console.log('━'.repeat(80));
    console.log('');
    if (verdict === 'FAIL') {
        console.log('Regression detected - deployment should be blocked\n');
    }
    else if (verdict === 'WARN') {
        console.log('Warning - possible performance degradation\n');
    }
    else {
        console.log('No significant regression detected\n');
    }
}
function formatVerdict(verdict) {
    switch (verdict) {
        case 'PASS': return '✓ PASS';
        case 'FAIL': return '✗ FAIL';
        case 'WARN': return '⚠️ WARN';
        case 'INSUFFICIENT_DATA': return '⊘ INSUFFICIENT_DATA';
        default: return verdict;
    }
}
function getExitCode(verdict) {
    switch (verdict) {
        case 'PASS': return 0;
        case 'WARN': return 0;
        case 'FAIL': return 1;
        case 'INSUFFICIENT_DATA': return 2;
        default: return 2;
    }
}
