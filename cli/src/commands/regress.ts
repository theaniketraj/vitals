import { Command } from 'commander';
import { runRegression } from '../core/regression';
import { fetchMetric } from '../services/prometheus';
import { formatResult } from '../utils/formatter';

export function registerRegressCommand(program: Command) {
  program
    .command('regress')
    .description('Detect performance regression between deployments')
    .requiredOption('--baseline <deployment>', 'Baseline deployment identifier')
    .requiredOption('--candidate <deployment>', 'Candidate deployment identifier')
    .option('--metric <metric>', 'Metric to analyze', 'latency_p95')
    .option('--prometheus-url <url>', 'Prometheus server URL', process.env.PROMETHEUS_URL || 'http://localhost:9090')
    .option('--threshold <percent>', 'Regression threshold percentage', '10')
    .option('--pvalue <value>', 'Statistical significance threshold (p-value)', '0.05')
    .option('--effect-size <value>', 'Minimum effect size threshold', '0.5')
    .option('--min-samples <count>', 'Minimum sample size required', '30')
    .option('--time-range <range>', 'Time range for metrics (e.g., 10m, 1h)', '10m')
    .option('--format <format>', 'Output format: json or pretty', 'pretty')
    .option('--no-color', 'Disable colored output')
    .action(async (options) => {
      try {
        const prometheusConfig = {
          url: options.prometheusUrl
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
            threshold: parseFloat(options.threshold),
            pValue: parseFloat(options.pvalue),
            effectSizeThreshold: parseFloat(options.effectSize),
            minSamples: parseInt(options.minSamples)
          },
          baselineData,
          candidateData
        );

        // Format and output result
        const output = formatResult(result, {
          format: options.format,
          color: options.color
        });

        console.log(output);

        // Exit with appropriate code
        const exitCode = getExitCode(result.verdict);
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
