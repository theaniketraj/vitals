/**
 * GitHub Action entry point for VITALS
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

interface VitalsResult {
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'INSUFFICIENT_DATA';
  metric?: string;
  change_percent?: number;
  p_value?: number;
  effect_size?: number;
  policy?: {
    action: string;
    reason: string;
    should_rollback: boolean;
  };
  results?: Array<{
    metric: string;
    verdict: string;
    change_percent: number;
    p_value: number;
    policyReason?: string;
  }>;
}

async function run() {
  try {
    // Get inputs
    const mode = core.getInput('mode') || 'regress';
    const baseline = core.getInput('baseline');
    const candidate = core.getInput('candidate');
    const metric = core.getInput('metric') || 'latency_p95';
    const metrics = core.getInput('metrics');
    const config = core.getInput('config') || 'vitals.yaml';
    const prometheusUrl = core.getInput('prometheus-url', { required: true });
    const threshold = core.getInput('threshold');
    const pvalue = core.getInput('pvalue') || '0.05';
    const effectSize = core.getInput('effect-size') || '0.5';
    const timeRange = core.getInput('time-range') || '10m';
    const failFast = core.getInput('fail-fast') === 'true';
    const commentPr = core.getInput('comment-pr') === 'true';
    const githubToken = core.getInput('github-token');

    // Install vitals CLI
    core.info('Installing VITALS CLI...');
    await exec('npm', ['install', '-g', 'vitals-cli']);

    // Build command
    const args: string[] = [mode];
    
    if (mode === 'regress' || mode === 'batch') {
      if (!baseline || !candidate) {
        throw new Error('baseline and candidate are required for regress/batch mode');
      }
      args.push('--baseline', baseline);
      args.push('--candidate', candidate);
    }

    if (mode === 'regress') {
      args.push('--metric', metric);
    }

    if (mode === 'batch' && metrics) {
      args.push('--metrics', metrics);
    }

    // Add common options
    if (fs.existsSync(config)) {
      args.push('--config', config);
    }

    args.push('--prometheus-url', prometheusUrl);
    args.push('--time-range', timeRange);
    args.push('--pvalue', pvalue);
    args.push('--effect-size', effectSize);
    args.push('--format', 'json');

    if (threshold) {
      args.push('--threshold', threshold);
    }

    if (failFast && mode === 'batch') {
      args.push('--fail-fast');
    }

    // Run vitals CLI
    core.info(`Running: vitals ${args.join(' ')}`);
    
    let output = '';
    let exitCode = 0;

    try {
      await exec('vitals', args, {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
          stderr: (data: Buffer) => {
            core.info(data.toString());
          }
        },
        ignoreReturnCode: true
      }).then(code => {
        exitCode = code;
      });
    } catch (error) {
      core.warning(`Command execution error: ${error}`);
    }

    // Parse result
    let result: VitalsResult;
    try {
      result = JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to parse vitals output: ${output}`);
    }

    // Set outputs
    core.setOutput('verdict', result.verdict);
    core.setOutput('report', JSON.stringify(result));

    if (mode === 'regress') {
      core.setOutput('change-percent', result.change_percent?.toString() || '0');
      core.setOutput('p-value', result.p_value?.toString() || '1');
    }

    // Create PR comment if enabled
    if (commentPr && githubToken && github.context.payload.pull_request) {
      await postPrComment(githubToken, result, mode);
    }

    // Set check status
    if (result.verdict === 'FAIL') {
      core.setFailed(`Performance regression detected: ${result.policy?.reason || 'Threshold exceeded'}`);
    } else if (result.verdict === 'WARN') {
      core.warning(`Performance warning: ${result.policy?.reason || 'Possible regression'}`);
    } else if (result.verdict === 'INSUFFICIENT_DATA') {
      core.warning('Insufficient data for analysis');
    } else {
      core.info('✓ No performance regressions detected');
    }

  } catch (error) {
    core.setFailed(`Action failed: ${(error as Error).message}`);
  }
}

async function postPrComment(token: string, result: VitalsResult, mode: string) {
  try {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const prNumber = github.context.payload.pull_request?.number;

    if (!prNumber) {
      return;
    }

    let comment = '';

    if (mode === 'regress') {
      comment = formatRegressComment(result);
    } else if (mode === 'batch') {
      comment = formatBatchComment(result);
    }

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment
    });

    core.info('Posted PR comment');
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error}`);
  }
}

function formatRegressComment(result: VitalsResult): string {
  const icon = result.verdict === 'PASS' ? '✅' : result.verdict === 'FAIL' ? '❌' : '⚠️';
  const changeStr = result.change_percent 
    ? (result.change_percent >= 0 ? `+${result.change_percent.toFixed(1)}%` : `${result.change_percent.toFixed(1)}%`)
    : 'N/A';

  return `
## ${icon} VITALS Performance Check

**Metric:** \`${result.metric}\`  
**Verdict:** ${result.verdict}  
**Change:** ${changeStr}  
**p-value:** ${result.p_value?.toFixed(3) || 'N/A'}  
**Effect Size:** ${result.effect_size?.toFixed(2) || 'N/A'}

${result.policy?.reason ? `**Analysis:** ${result.policy.reason}` : ''}

${result.verdict === 'FAIL' ? '🔴 **Build should be blocked due to performance regression**' : ''}
${result.verdict === 'WARN' ? '🟡 **Warning: Possible performance degradation detected**' : ''}
${result.verdict === 'PASS' ? '🟢 **No performance regressions detected**' : ''}

---
*Powered by [VITALS](https://github.com/vitals-dev/vitals)*
`;
}

function formatBatchComment(result: VitalsResult): string {
  if (!result.results) {
    return formatRegressComment(result);
  }

  const passed = result.results.filter(r => r.verdict === 'PASS').length;
  const failed = result.results.filter(r => r.verdict === 'FAIL').length;
  const warnings = result.results.filter(r => r.verdict === 'WARN').length;

  const overallIcon = failed > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅';

  let table = '| Metric | Verdict | Change | p-value | Status |\n';
  table += '|--------|---------|--------|---------|--------|\n';

  for (const r of result.results) {
    const icon = r.verdict === 'PASS' ? '✅' : r.verdict === 'FAIL' ? '❌' : '⚠️';
    const change = r.change_percent >= 0 ? `+${r.change_percent.toFixed(1)}%` : `${r.change_percent.toFixed(1)}%`;
    table += `| ${r.metric} | ${icon} ${r.verdict} | ${change} | ${r.p_value.toFixed(3)} | ${r.policyReason || ''} |\n`;
  }

  return `
## ${overallIcon} VITALS Batch Performance Check

**Summary:** ${passed} passed, ${failed} failed, ${warnings} warnings

${table}

${failed > 0 ? '🔴 **Build should be blocked due to performance regressions**' : ''}
${warnings > 0 && failed === 0 ? '🟡 **Warning: Some metrics show possible degradation**' : ''}
${failed === 0 && warnings === 0 ? '🟢 **All metrics passed - no regressions detected**' : ''}

---
*Powered by [VITALS](https://github.com/vitals-dev/vitals)*
`;
}

run();
