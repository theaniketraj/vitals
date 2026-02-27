import { Command } from 'commander';
import { runRegression } from '../core/regression';
import { fetchMetric } from '../services/prometheus';
import { loadPolicy, findPolicyConfig, getServiceMetricPolicy, evaluateRegression, getDefaultOptions } from '../services/policyLoaderV2';
import { mean } from '../core/stats/welch';

interface HistoricalResult {
  deployment: string;
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'INSUFFICIENT_DATA';
  change_percent: number;
  p_value: number;
  effect_size: number;
}

export function registerHistoricalCommand(program: Command) {
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
        const metricPolicy = policy 
          ? getServiceMetricPolicy(policy, options.service || null, options.metric)
          : null;
        
        // Get defaults from policy
        const defaults = getDefaultOptions(policy, options.service);
        const prometheusUrl = options.prometheusUrl || defaults.prometheusUrl;
        const threshold = metricPolicy?.regression?.max_increase_percent || 10;
        const pValue = metricPolicy?.regression?.p_value || 0.05;
        const effectSize = metricPolicy?.regression?.effect_size || 0.5;

        const prometheusConfig = { url: prometheusUrl };

        // Parse baseline deployments
        const baselineDeployments = options.baselines.split(',').map((d: string) => d.trim());
        const minBaselines = parseInt(options.minBaselines);

        if (baselineDeployments.length < minBaselines) {
          console.error(`Error: At least ${minBaselines} baseline deployments required`);
          process.exit(2);
        }

        console.error(`Analyzing against ${baselineDeployments.length} historical baselines...\n`);

        // Fetch baseline data for all deployments
        console.error('Fetching historical baseline data...');
        const baselineDataSets: { deployment: string; data: number[] }[] = [];

        for (const deployment of baselineDeployments) {
          try {
            const data = await fetchMetric(prometheusConfig, {
              metric: options.metric,
              label: deployment,
              timeRange: options.timeRange
            });

            if (data.length > 0) {
              baselineDataSets.push({ deployment, data });
              console.error(`  ✓ ${deployment}: ${data.length} samples`);
            } else {
              console.error(`  ⚠ ${deployment}: No data`);
            }
          } catch (error) {
            console.error(`  ✗ ${deployment}: ${(error as Error).message}`);
          }
        }

        if (baselineDataSets.length < minBaselines) {
          console.error(`\nError: Only ${baselineDataSets.length} baselines with valid data (minimum: ${minBaselines})`);
          process.exit(2);
        }

        // Aggregate baseline data
        const aggregatedBaseline = aggregateBaselines(baselineDataSets, options.aggregate);
        console.error(`\nAggregated baseline (${options.aggregate}): ${aggregatedBaseline.length} samples\n`);

        // Fetch candidate data
        console.error(`Fetching candidate data for ${options.candidate}...`);
        const candidateData = await fetchMetric(prometheusConfig, {
          metric: options.metric,
          label: options.candidate,
          timeRange: options.timeRange
        });
        console.error(`  ✓ ${candidateData.length} samples\n`);

        // Run regression analysis
        console.error('Running regression analysis...\n');
        const result = await runRegression(
          {
            baseline: `historical-${options.aggregate}`,
            candidate: options.candidate,
            metric: options.metric,
            threshold,
            pValue,
            effectSizeThreshold: effectSize,
            minSamples: 30
          },
          aggregatedBaseline,
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

        // Determine final verdict
        let finalVerdict = result.verdict;
        if (evaluation.action === 'fail' && result.verdict !== 'INSUFFICIENT_DATA') {
          finalVerdict = 'FAIL';
        } else if (evaluation.action === 'warn' && result.verdict === 'PASS') {
          finalVerdict = 'WARN';
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
              mean: mean(b.data),
              samples: b.data.length
            }))
          }, null, 2));
        } else {
          printPrettyHistoricalResult(
            options.metric,
            options.candidate,
            baselineDeployments,
            baselineDataSets,
            result,
            evaluation,
            finalVerdict,
            options.aggregate
          );
        }

        // Exit with appropriate code
        const exitCode = getExitCode(finalVerdict);
        process.exit(exitCode);

      } catch (error) {
        console.error(`\nError: ${(error as Error).message}`);
        process.exit(2);
      }
    });
}

function aggregateBaselines(
  dataSetss: { deployment: string; data: number[] }[],
  method: string
): number[] {
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

function aggregateMean(dataSets: { deployment: string; data: number[] }[]): number[] {
  const maxLength = Math.max(...dataSets.map(ds => ds.data.length));
  const result: number[] = [];

  for (let i = 0; i < maxLength; i++) {
    const values: number[] = [];
    for (const ds of dataSets) {
      if (i < ds.data.length) {
        values.push(ds.data[i]);
      }
    }
    if (values.length > 0) {
      result.push(mean(values));
    }
  }

  return result;
}

function aggregateMedian(dataSets: { deployment: string; data: number[] }[]): number[] {
  const maxLength = Math.max(...dataSets.map(ds => ds.data.length));
  const result: number[] = [];

  for (let i = 0; i < maxLength; i++) {
    const values: number[] = [];
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
        : values[mid]
      );
    }
  }

  return result;
}

function printPrettyHistoricalResult(
  metric: string,
  candidate: string,
  baselines: string[],
  baselineData: { deployment: string; data: number[] }[],
  result: any,
  evaluation: any,
  verdict: string,
  aggregation: string
) {
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
    const baselineMean = mean(baseline.data);
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
  } else if (verdict === 'WARN') {
    console.log('Warning - possible performance degradation\n');
  } else {
    console.log('No significant regression detected\n');
  }
}

function formatVerdict(verdict: string): string {
  switch (verdict) {
    case 'PASS': return '✓ PASS';
    case 'FAIL': return '✗ FAIL';
    case 'WARN': return '⚠️ WARN';
    case 'INSUFFICIENT_DATA': return '⊘ INSUFFICIENT_DATA';
    default: return verdict;
  }
}

function getExitCode(verdict: string): number {
  switch (verdict) {
    case 'PASS': return 0;
    case 'WARN': return 0;
    case 'FAIL': return 1;
    case 'INSUFFICIENT_DATA': return 2;
    default: return 2;
  }
}
