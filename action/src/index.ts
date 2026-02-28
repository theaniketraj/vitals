/**
 * GitHub Action Entrypoint
 * 
 * Runs VITALS regression analysis in GitHub Actions environment
 * and posts results as PR comments.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { batchRegression, formatBatchResults, exportBatchResultsJSON } from '../cli/src/core/batch';
import { PrometheusConfig } from '../cli/src/services/prometheus';
import { 
  formatBatchResultsForPR, 
  upsertGitHubPRComment, 
  getGitHubConfigFromEnv 
} from '../cli/src/integrations/github';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ActionConfig {
  prometheusUrl: string;
  baselineLabel: string;
  candidateLabel: string;
  configFile?: string;
  metrics?: string[];
  threshold: number;
  pValue: number;
  effectSize: number;
  testType: 'welch' | 'mann-whitney' | 'permutation' | 'auto';
  postComment: boolean;
  failOnRegression: boolean;
  dashboardUrl?: string;
  cacheEnabled: boolean;
  cacheTTL: number;
}

/**
 * Parse action inputs
 */
function getActionConfig(): ActionConfig {
  const metricsInput = core.getInput('metrics');
  const metrics = metricsInput ? metricsInput.split(',').map(m => m.trim()) : undefined;

  return {
    prometheusUrl: core.getInput('prometheus-url', { required: true }),
    baselineLabel: core.getInput('baseline-label', { required: true }),
    candidateLabel: core.getInput('candidate-label', { required: true }),
    configFile: core.getInput('config-file') || 'vitals.yaml',
    metrics,
    threshold: parseFloat(core.getInput('threshold') || '10'),
    pValue: parseFloat(core.getInput('p-value') || '0.05'),
    effectSize: parseFloat(core.getInput('effect-size') || '0.5'),
    testType: (core.getInput('test-type') || 'auto') as any,
    postComment: core.getBooleanInput('post-comment'),
    failOnRegression: core.getBooleanInput('fail-on-regression'),
    dashboardUrl: core.getInput('dashboard-url') || undefined,
    cacheEnabled: core.getBooleanInput('cache-enabled'),
    cacheTTL: parseInt(core.getInput('cache-ttl') || '300', 10)
  };
}

/**
 * Load metrics from config file
 */
function loadMetricsFromConfig(configPath: string): any[] {
  try {
    if (!fs.existsSync(configPath)) {
      core.warning(`Config file not found: ${configPath}`);
      return [];
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(configContent) as any;

    if (config.version === 2 && config.metrics) {
      // Version 2 config format
      return Object.entries(config.metrics).map(([name, settings]: [string, any]) => ({
        name,
        threshold: settings?.regression?.max_increase_percent || 10,
        timeRange: settings?.timeRange || '10m'
      }));
    } else if (config.batch?.metrics) {
      // Batch config format
      return config.batch.metrics;
    }

    return [];
  } catch (error) {
    core.warning(`Failed to load config file: ${error}`);
    return [];
  }
}

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    core.info('Starting VITALS Performance Regression Check');
    
    // Get configuration
    const config = getActionConfig();
    core.info(`Baseline: ${config.baselineLabel}`);
    core.info(`Candidate: ${config.candidateLabel}`);
    core.info(`Prometheus: ${config.prometheusUrl}`);

    // Determine metrics to check
    let metrics = config.metrics?.map(name => ({ name, threshold: config.threshold }));
    
    if (!metrics || metrics.length === 0) {
      core.info(`Loading metrics from config file: ${config.configFile}`);
      metrics = loadMetricsFromConfig(config.configFile);
    }

    if (metrics.length === 0) {
      core.setFailed('No metrics specified. Provide metrics via input or config file.');
      return;
    }

    core.info(`Analyzing ${metrics.length} metrics`);

    // Setup Prometheus config
    const prometheusConfig: PrometheusConfig = {
      url: config.prometheusUrl,
      cache: config.cacheEnabled,
      cacheTTL: config.cacheTTL
    };

    // Run batch regression analysis
    core.startGroup('Running regression analysis');
    
    const result = await batchRegression(
      metrics,
      prometheusConfig,
      config.baselineLabel,
      config.candidateLabel,
      {
        pValue: config.pValue,
        effectSizeThreshold: config.effectSize,
        testType: config.testType
      },
      {
        concurrency: 5,
        retryCount: 2,
        continueOnError: true,
        onProgress: (completed, total, metric) => {
          core.info(`[${completed}/${total}] Analyzing ${metric}...`);
        }
      }
    );
    
    core.endGroup();

    // Print results to console
    core.startGroup('Results');
    console.log(formatBatchResults(result));
    core.endGroup();

    // Export results to file
    const resultsDir = path.join(process.env.GITHUB_WORKSPACE || '.', 'vitals-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsPath = path.join(resultsDir, 'regression-results.json');
    fs.writeFileSync(resultsPath, exportBatchResultsJSON(result));
    core.info(`Results exported to ${resultsPath}`);

    // Set outputs
    const overallVerdict = result.summary.failed > 0 ? 'FAIL' : 
                          result.summary.warned > 0 ? 'WARN' : 'PASS';
    
    core.setOutput('verdict', overallVerdict);
    core.setOutput('failed-count', result.summary.failed);
    core.setOutput('warned-count', result.summary.warned);
    core.setOutput('passed-count', result.summary.passed);
    core.setOutput('results-json', exportBatchResultsJSON(result));

    // Post PR comment if enabled
    if (config.postComment && github.context.payload.pull_request) {
      core.startGroup('Posting PR comment');
      
      const githubConfig = getGitHubConfigFromEnv();
      
      if (githubConfig) {
        try {
          const comment = formatBatchResultsForPR(result, {
            includeDetails: true,
            dashboardUrl: config.dashboardUrl
          });
          
          await upsertGitHubPRComment(githubConfig, comment);
          core.info('PR comment posted successfully');
        } catch (error) {
          core.warning(`Failed to post PR comment: ${error}`);
        }
      } else {
        core.warning('GitHub config not available from environment');
      }
      
      core.endGroup();
    }

    // Check annotations
    const annotations: any[] = [];
    for (const [metric, res] of result.results) {
      if (!(res instanceof Error) && res.verdict !== 'PASS') {
        annotations.push({
          path: 'deployment',
          start_line: 1,
          end_line: 1,
          annotation_level: res.verdict === 'FAIL' ? 'failure' : 'warning',
          title: `Regression in ${metric}`,
          message: `${res.change_percent > 0 ? '+' : ''}${res.change_percent.toFixed(1)}% change detected (p=${res.p_value.toFixed(3)})`
        });
      }
    }

    if (annotations.length > 0) {
      core.info(`Found ${annotations.length} annotations`);
      // Annotations are displayed automatically via GitHub Actions UI
    }

    // Summary
    core.summary
      .addHeading('VITALS Performance Regression Check')
      .addTable([
        [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
        ['Verdict', overallVerdict],
        ['Passed', result.summary.passed.toString()],
        ['Failed', result.summary.failed.toString()],
        ['Warned', result.summary.warned.toString()],
        ['Duration', `${(result.executionTime / 1000).toFixed(2)}s`]
      ]);

    await core.summary.write();

    // Fail the action if regression detected and fail-on-regression is true
    if (config.failOnRegression && result.summary.failed > 0) {
      core.setFailed(`Performance regression detected in ${result.summary.failed} metric(s)`);
    } else {
      core.info(`Check complete: ${overallVerdict}`);
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

// Run the action
run();
