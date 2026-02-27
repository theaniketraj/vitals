import { Command } from 'commander';
import { fetchInstantMetric } from '../services/prometheus';

export function registerAnalyzeCommand(program: Command) {
  program
    .command('analyze')
    .description('Analyze current system state from metrics')
    .option('--service <service>', 'Service name to analyze')
    .option('--window <duration>', 'Time window for analysis', '5m')
    .option('--prometheus-url <url>', 'Prometheus server URL', process.env.PROMETHEUS_URL || 'http://localhost:9090')
    .option('--format <format>', 'Output format: json or pretty', 'pretty')
    .action(async (options) => {
      try {
        const prometheusConfig = {
          url: options.prometheusUrl
        };

        // Fetch key metrics
        const metrics = [
          'latency_p95',
          'error_rate',
          'throughput'
        ];

        const results: Record<string, number> = {};

        console.error('Analyzing system state...\n');

        for (const metric of metrics) {
          try {
            const value = await fetchInstantMetric(prometheusConfig, {
              metric,
              label: options.service
            });
            results[metric] = value;
          } catch (error) {
            console.error(`Warning: Could not fetch ${metric}`);
          }
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log('═══════════════════════════════════════');
          console.log('  System Analysis');
          console.log('═══════════════════════════════════════');
          console.log('');
          for (const [metric, value] of Object.entries(results)) {
            console.log(`  ${metric.padEnd(20)} ${value.toFixed(2)}`);
          }
          console.log('');
        }

        process.exit(0);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(2);
      }
    });
}
