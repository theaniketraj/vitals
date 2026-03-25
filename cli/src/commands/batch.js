"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBatchCommand = registerBatchCommand;
const regression_1 = require("../core/regression");
const prometheus_1 = require("../services/prometheus");
const policyLoaderV2_1 = require("../services/policyLoaderV2");
function registerBatchCommand(program) {
    program
        .command('batch')
        .description('Run regression analysis on multiple metrics')
        .requiredOption('--baseline <deployment>', 'Baseline deployment identifier')
        .requiredOption('--candidate <deployment>', 'Candidate deployment identifier')
        .option('--metrics <metrics>', 'Comma-separated list of metrics to analyze')
        .option('--service <service>', 'Service name for service-specific policies')
        .option('--config <path>', 'Path to vitals.yaml config file')
        .option('--prometheus-url <url>', 'Prometheus server URL')
        .option('--time-range <range>', 'Time range for metrics (e.g., 10m, 1h)', '10m')
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .option('--fail-fast', 'Exit on first failure', false)
        .option('--no-color', 'Disable colored output')
        .action(async (options) => {
        try {
            // Load policy config
            const configPath = options.config || (0, policyLoaderV2_1.findPolicyConfig)();
            const policy = configPath ? (0, policyLoaderV2_1.loadPolicy)(configPath) : null;
            if (configPath && policy) {
                console.error(`✓ Loaded policy from: ${configPath}\n`);
            }
            // Get default options from policy
            const defaults = (0, policyLoaderV2_1.getDefaultOptions)(policy, options.service);
            const prometheusUrl = options.prometheusUrl || defaults.prometheusUrl;
            // Determine metrics to analyze
            let metricsToAnalyze = [];
            if (options.metrics) {
                metricsToAnalyze = options.metrics.split(',').map((m) => m.trim());
            }
            else if (policy) {
                // Get metrics from base or service-specific policy
                if (options.service && policy.services?.[options.service]) {
                    const servicePolicyDefinition = policy.services[options.service];
                    metricsToAnalyze = servicePolicyDefinition.metrics ? Object.keys(servicePolicyDefinition.metrics) : [];
                }
                else if (policy.base?.metrics) {
                    metricsToAnalyze = Object.keys(policy.base.metrics);
                }
                else if (policy.metrics) {
                    // Backward compatibility: legacy global metrics
                    metricsToAnalyze = Object.keys(policy.metrics);
                }
            }
            else {
                console.error('Error: No metrics specified. Use --metrics or define metrics in vitals.yaml');
                process.exit(2);
            }
            console.error(`Analyzing ${metricsToAnalyze.length} metric(s): ${metricsToAnalyze.join(', ')}\n`);
            const prometheusConfig = { url: prometheusUrl };
            const results = [];
            let hasFailure = false;
            // Process each metric
            for (const metric of metricsToAnalyze) {
                console.error(`[${metric}] Fetching data...`);
                try {
                    // Fetch data
                    const baselineData = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
                        metric,
                        label: options.baseline,
                        timeRange: options.timeRange
                    });
                    const candidateData = await (0, prometheus_1.fetchMetric)(prometheusConfig, {
                        metric,
                        label: options.candidate,
                        timeRange: options.timeRange
                    });
                    // Get metric-specific policy (with service support)
                    const metricPolicy = policy
                        ? (0, policyLoaderV2_1.getServiceMetricPolicy)(policy, options.service || null, metric)
                        : null;
                    const threshold = metricPolicy?.regression?.max_increase_percent || 10;
                    const pValue = metricPolicy?.regression?.p_value || 0.05;
                    const effectSize = metricPolicy?.regression?.effect_size || 0.5;
                    // Run regression analysis
                    const result = await (0, regression_1.runRegression)({
                        baseline: options.baseline,
                        candidate: options.candidate,
                        metric,
                        threshold,
                        pValue,
                        effectSizeThreshold: effectSize,
                        minSamples: 30
                    }, baselineData, candidateData);
                    // Evaluate against policy
                    const evaluation = (0, policyLoaderV2_1.evaluateRegression)(metric, result.change_percent, result.p_value, result.effect_size, result.significant, metricPolicy);
                    // Determine final verdict based on policy
                    let finalVerdict = result.verdict;
                    if (evaluation.action === 'fail' && result.verdict !== 'INSUFFICIENT_DATA') {
                        finalVerdict = 'FAIL';
                        hasFailure = true;
                    }
                    else if (evaluation.action === 'warn') {
                        finalVerdict = 'WARN';
                    }
                    results.push({
                        metric,
                        verdict: finalVerdict,
                        change_percent: result.change_percent,
                        p_value: result.p_value,
                        effect_size: result.effect_size,
                        details: result.details,
                        policyAction: evaluation.action,
                        policyReason: evaluation.reason
                    });
                    console.error(`[${metric}] ${formatVerdict(finalVerdict)} ${evaluation.reason}\n`);
                    // Fail fast if enabled
                    if (options.failFast && hasFailure) {
                        console.error('❌ Stopping due to --fail-fast');
                        break;
                    }
                }
                catch (error) {
                    console.error(`[${metric}] ✗ Error: ${error.message}\n`);
                    results.push({
                        metric,
                        verdict: 'INSUFFICIENT_DATA',
                        change_percent: 0,
                        p_value: 1,
                        effect_size: 0,
                        details: error.message
                    });
                }
            }
            // Output results
            if (options.format === 'json') {
                console.log(JSON.stringify({
                    baseline: options.baseline,
                    candidate: options.candidate,
                    results,
                    summary: {
                        total: results.length,
                        passed: results.filter(r => r.verdict === 'PASS').length,
                        failed: results.filter(r => r.verdict === 'FAIL').length,
                        warnings: results.filter(r => r.verdict === 'WARN').length,
                        insufficient_data: results.filter(r => r.verdict === 'INSUFFICIENT_DATA').length
                    }
                }, null, 2));
            }
            else {
                printPrettySummary(results, options.baseline, options.candidate);
            }
            // Exit with appropriate code
            if (hasFailure || results.some(r => r.verdict === 'FAIL')) {
                process.exit(1);
            }
            else if (results.some(r => r.verdict === 'INSUFFICIENT_DATA')) {
                process.exit(2);
            }
            else {
                process.exit(0);
            }
        }
        catch (error) {
            console.error('\n✗ Fatal Error:', error.message);
            process.exit(2);
        }
    });
}
function formatVerdict(verdict) {
    switch (verdict) {
        case 'PASS':
            return '✓ PASS';
        case 'FAIL':
            return '✗ FAIL';
        case 'WARN':
            return '⚠ WARN';
        case 'INSUFFICIENT_DATA':
            return '⊘ INSUFFICIENT_DATA';
        default:
            return verdict;
    }
}
function printPrettySummary(results, baseline, candidate) {
    console.log('\n' + '='.repeat(80));
    console.log('  VITALS Batch Analysis Summary');
    console.log('='.repeat(80));
    console.log(`  Baseline:  ${baseline}`);
    console.log(`  Candidate: ${candidate}`);
    console.log('='.repeat(80));
    console.log('');
    const passed = results.filter(r => r.verdict === 'PASS');
    const failed = results.filter(r => r.verdict === 'FAIL');
    const warnings = results.filter(r => r.verdict === 'WARN');
    const insufficient = results.filter(r => r.verdict === 'INSUFFICIENT_DATA');
    for (const result of results) {
        const statusIcon = formatVerdict(result.verdict);
        const changeStr = result.change_percent >= 0
            ? `+${result.change_percent.toFixed(1)}%`
            : `${result.change_percent.toFixed(1)}%`;
        console.log(`  ${statusIcon.padEnd(25)} ${result.metric.padEnd(20)} ${changeStr.padStart(10)}`);
        if (result.policyReason && result.verdict !== 'PASS') {
            console.log(`  ${''.padEnd(25)} → ${result.policyReason}`);
        }
    }
    console.log('');
    console.log('='.repeat(80));
    console.log(`  Total: ${results.length}  |  ✓ ${passed.length}  |  ✗ ${failed.length}  |  ⚠ ${warnings.length}  |  ⊘ ${insufficient.length}`);
    console.log('='.repeat(80));
    console.log('');
    if (failed.length > 0) {
        console.log('Build FAILED - Performance regressions detected');
    }
    else if (warnings.length > 0) {
        console.log('Build PASSED with warnings');
    }
    else {
        console.log('Build PASSED - No regressions detected');
    }
}
