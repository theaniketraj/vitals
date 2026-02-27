import { Command } from 'commander';
import { runRegression } from '../core/regression';
import { fetchMetric } from '../services/prometheus';
import { formatResult } from '../utils/formatter';
import { loadPolicy, findPolicyConfig, getMetricPolicy, evaluateRegression, getDefaultOptions } from '../services/policyLoader';

export function registerRegressCommand(program: Command) {
  program
    .command('regress')
    .description('Detect performance regression between deployments')
    .requiredOption('--baseline <deployment>', 'Baseline deployment identifier')
    .requiredOption('--candidate <deployment>', 'Candidate deployment identifier')
    .option('--metric <metric>', 'Metric to analyze', 'latency_p95')
    .option('--config <path>', 'Path to vitals.yaml config file')
    .option('--prometheus-url <url>', 'Prometheus server URL', process.env.PROMETHEUS_URL)
    .option('--threshold <percent>', 'Regression threshold percentage')
    .option('--pvalue <value>', 'Statistical significance threshold (p-value)')
    .option('--effect-size <value>', 'Minimum effect size threshold')
    .option('--min-samples <count>', 'Minimum sample size required', '30')
    .option('--time-range <range>', 'Time range for metrics (e.g., 10m, 1h)', '10m')
    .option('--format <format>', 'Output format: json or pretty', 'pretty')
    .option('--no-color', 'Disable colored output')
    .action(async (options) => {
      try {
        // Load policy config
        const configPath = options.config || findPolicyConfig();
        const policy = configPath ? loadPolicy(configPath) : null;

        if (configPath && policy) {
          console.error(`✓ Loaded policy from: ${configPath}\n`);
        }

        // Get metric-specific policy
        const metricPolicy = policy ? getMetricPolicy(policy, options.metric) : null;
        
        // Get defaults from policy or use command defaults
        const defaults = getDefaultOptions(policy);
        const prometheusUrl = options.prometheusUrl || defaults.prometheusUrl;
        const threshold = options.threshold 
          ? parseFloat(options.threshold) 
          : (metricPolicy?.regression?.max_increase_percent || 10);
        const pValue = options.pvalue 
          ? parseFloat(options.pvalue) 
          : (metricPolicy?.regression?.p_value || 0.05);
        const effectSize = options.effectSize 
          ? parseFloat(options.effectSize) 
          : (metricPolicy?.regression?.effect_size || 0.5);

        const prometheusConfig = {
          url: prometheusUrl
        };

        // Fetch baseline data
        console.error(`Fetching baseline data for ${options.baseline}...`);
        const baselineData = await fetchMetric(prometheusConfig, {
          metric: options.metric,
          label: options.baseline,
          timeRange: options.timeRange
        });

        // Fetch candidate data
        console.error(`Fetching candidate data for ${options.candidate}...`);
        const candidateData = await fetchMetric(prometheusConfig, {
          metric: options.metric,
          label: options.candidate,
          timeRange: options.timeRange
        });

        // Run regression analysis
        console.error('Running regression analysis...\n');
        const result = await runRegression(
          {
            baseline: options.baseline,
            candidate: options.candidate,
            metric: options.metric,
            threshold,
            pValue,
            effectSizeThreshold: effectSize,
            minSamples: parseInt(options.minSamples)
          },
          baselineData,
          candidateData
        );

        // Evaluate against policy
        const evaluation = evaluateRegression(
          options.metric,
          result.change_percent,
          result.p_value,
          result.effect_size,
          result.significant,
          metricPolicy
        );

        // Determine final verdict based on policy
        let finalVerdict = result.verdict;
        if (evaluation.action === 'fail' && result.verdict !== 'INSUFFICIENT_DATA') {
          finalVerdict = 'FAIL';
        } else if (evaluation.action === 'warn' && result.verdict === 'PASS') {
          finalVerdict = 'WARN';
        }

        // Add policy information to result
        const enrichedResult = {
          ...result,
          verdict: finalVerdict,
          policy: {
            action: evaluation.action,
            reason: evaluation.reason,
            should_rollback: evaluation.shouldRollback
          }
        };

        // Format and output result
        const output = formatResult(enrichedResult, {
          format: options.format,
          color: options.color
        });

        console.log(output);

        // Exit with appropriate code
        const exitCode = getExitCode(finalVerdict);
        process.exit(exitCode);
      } catch (error) {
        console.error('\n' + '✗ Error:'.padEnd(20), (error as Error).message);
        process.exit(2);
      }
    });
}

/**
 * Map verdict to exit code
 */
function getExitCode(verdict: string): number {
  switch (verdict) {
    case 'PASS':
      return 0;
    case 'WARN':
      return 0; // Don't fail CI on warnings
    case 'FAIL':
      return 1;
    case 'INSUFFICIENT_DATA':
      return 2;
    default:
      return 2;
  }
}
