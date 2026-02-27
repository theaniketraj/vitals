import { Command } from 'commander';
import { fetchRangeMetrics } from '../services/prometheus';

export function registerCompareCommand(program: Command) {
  program
    .command('compare')
    .description('Compare two time windows for metric differences')
    .option('--service <service>', 'Service name to compare')
    .option('--metric <metric>', 'Metric to compare', 'latency_p95')
    .option('--before-start <time>', 'Start time for baseline window (relative or RFC3339)')
    .option('--before-end <time>', 'End time for baseline window (relative or RFC3339)')
    .option('--after-start <time>', 'Start time for comparison window (relative or RFC3339)')
    .option('--after-end <time>', 'End time for comparison window (relative or RFC3339)')
    .option('--prometheus-url <url>', 'Prometheus server URL', process.env.PROMETHEUS_URL || 'http://localhost:9090')
    .option('--format <format>', 'Output format: json or pretty', 'pretty')
    .action(async (options) => {
      try {
        if (!options.beforeStart || !options.beforeEnd || !options.afterStart || !options.afterEnd) {
          throw new Error('All four time windows must be specified (--before-start, --before-end, --after-start, --after-end)');
        }

        console.error('Fetching baseline period...');
        const baselineData = await fetchRangeMetrics({
          url: options.prometheusUrl
        }, {
          metric: options.metric,
          label: options.service,
          start: options.beforeStart,
          end: options.beforeEnd
        });

        console.error('Fetching comparison period...');
        const comparisonData = await fetchRangeMetrics({
          url: options.prometheusUrl
        }, {
          metric: options.metric,
          label: options.service,
          start: options.afterStart,
          end: options.afterEnd
        });

        const baselineMean = baselineData.reduce((sum: number, v: number) => sum + v, 0) / baselineData.length;
        const comparisonMean = comparisonData.reduce((sum: number, v: number) => sum + v, 0) / comparisonData.length;
        const percentChange = ((comparisonMean - baselineMean) / baselineMean) * 100;

        const result = {
          metric: options.metric,
          service: options.service,
          baseline: {
            samples: baselineData.length,
            mean: baselineMean,
            window: `${options.beforeStart} → ${options.beforeEnd}`
          },
          comparison: {
            samples: comparisonData.length,
            mean: comparisonMean,
            window: `${options.afterStart} → ${options.afterEnd}`
          },
          difference: {
            absolute: comparisonMean - baselineMean,
            percent: percentChange
          }
        };

        if (options.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log('═══════════════════════════════════════');
          console.log('  Time Window Comparison');
          console.log('═══════════════════════════════════════');
          console.log('');
          console.log(`  Metric: ${result.metric}`);
          console.log(`  Service: ${result.service || 'default'}`);
          console.log('');
          console.log('  Baseline:');
          console.log(`    Mean: ${result.baseline.mean.toFixed(2)}`);
          console.log(`    Samples: ${result.baseline.samples}`);
          console.log('');
          console.log('  Comparison:');
          console.log(`    Mean: ${result.comparison.mean.toFixed(2)}`);
          console.log(`    Samples: ${result.comparison.samples}`);
          console.log('');
          console.log('  Difference:');
          console.log(`    Absolute: ${result.difference.absolute > 0 ? '+' : ''}${result.difference.absolute.toFixed(2)}`);
          console.log(`    Percent: ${result.difference.percent > 0 ? '+' : ''}${result.difference.percent.toFixed(1)}%`);
          console.log('');
        }

        process.exit(0);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(2);
      }
    });
}
