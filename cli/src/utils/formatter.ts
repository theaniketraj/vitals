import chalk from 'chalk';
import { RegressionResult } from '../core/regression';

export interface OutputOptions {
  format: 'json' | 'pretty';
  color?: boolean;
}

/**
 * Format regression result for output
 */
export function formatResult(result: RegressionResult, options: OutputOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  return formatPretty(result, options.color !== false);
}

/**
 * Format result in human-readable format
 */
function formatPretty(result: RegressionResult, useColor: boolean): string {
  const c = useColor ? chalk : noColor;

  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(c.bold('═══════════════════════════════════════════════════'));
  lines.push(c.bold(`  VITALS Regression Analysis: ${result.metric}`));
  lines.push(c.bold('═══════════════════════════════════════════════════'));
  lines.push('');

  // Verdict
  const verdictIcon = getVerdictIcon(result.verdict);
  const verdictColor = getVerdictColor(result.verdict, c);
  lines.push(verdictColor(`${verdictIcon} Verdict: ${result.verdict}`));
  lines.push('');

  // Insufficient data case
  if (result.verdict === 'INSUFFICIENT_DATA') {
    lines.push(c.yellow(`⚠ ${result.details}`));
    lines.push('');
    return lines.join('\n');
  }

  // Metrics
  lines.push(c.bold('Metrics:'));
  lines.push(`  Baseline Mean:      ${formatNumber(result.baseline.mean)} (n=${result.baseline.samples})`);
  lines.push(`  Candidate Mean:     ${formatNumber(result.candidate.mean)} (n=${result.candidate.samples})`);
  lines.push('');

  // Change
  const changeColor = result.change_percent > 0 ? c.red : c.green;
  const changeSign = result.change_percent > 0 ? '+' : '';
  lines.push(c.bold('Change:'));
  lines.push(`  ${changeColor(changeSign + result.change_percent.toFixed(2) + '%')}`);
  lines.push('');

  // Statistical Tests
  lines.push(c.bold('Statistical Analysis:'));
  lines.push(`  p-value:            ${formatPValue(result.p_value, c)}`);
  lines.push(`  Effect Size (d):    ${formatEffectSize(result.effect_size, c)}`);
  lines.push(`  Significant:        ${result.significant ? c.green('Yes') : c.gray('No')}`);
  lines.push('');

  // Interpretation
  lines.push(c.bold('Interpretation:'));
  lines.push(`  ${getInterpretation(result, c)}`);
  lines.push('');

  lines.push(c.bold('═══════════════════════════════════════════════════'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Get verdict icon
 */
function getVerdictIcon(verdict: string): string {
  switch (verdict) {
    case 'PASS':
      return '✓';
    case 'FAIL':
      return '✗';
    case 'WARN':
      return '⚠';
    case 'INSUFFICIENT_DATA':
      return '⚠';
    default:
      return '?';
  }
}

/**
 * Get verdict color function
 */
function getVerdictColor(verdict: string, c: typeof chalk) {
  switch (verdict) {
    case 'PASS':
      return c.green.bold;
    case 'FAIL':
      return c.red.bold;
    case 'WARN':
      return c.yellow.bold;
    default:
      return c.gray.bold;
  }
}

/**
 * Format number with appropriate precision
 */
function formatNumber(num: number): string {
  if (num < 0.01) {
    return num.toExponential(2);
  }
  return num.toFixed(2);
}

/**
 * Format p-value with interpretation
 */
function formatPValue(pValue: number, c: typeof chalk): string {
  const formatted = pValue < 0.001 ? '< 0.001' : pValue.toFixed(3);
  const color = pValue < 0.05 ? c.green : c.gray;
  const significance = pValue < 0.05 ? ' (significant)' : ' (not significant)';
  return color(formatted + significance);
}

/**
 * Format effect size with interpretation
 */
function formatEffectSize(effectSize: number, c: typeof chalk): string {
  const formatted = effectSize.toFixed(2);
  let interpretation = '';
  let color = c.gray;

  if (effectSize < 0.2) {
    interpretation = ' (negligible)';
    color = c.gray;
  } else if (effectSize < 0.5) {
    interpretation = ' (small)';
    color = c.yellow;
  } else if (effectSize < 0.8) {
    interpretation = ' (medium)';
    color = c.cyan;
  } else {
    interpretation = ' (large)';
    color = c.red;
  }

  return color(formatted + interpretation);
}

/**
 * Get human-readable interpretation
 */
function getInterpretation(result: RegressionResult, c: typeof chalk): string {
  if (result.verdict === 'PASS') {
    return c.green('No significant regression detected. Safe to proceed.');
  }

  if (result.verdict === 'FAIL') {
    return c.red(
      `Significant regression detected. The candidate deployment shows a ` +
      `${Math.abs(result.change_percent).toFixed(1)}% increase in ${result.metric} ` +
      `with high statistical confidence (p=${result.p_value.toFixed(3)}).`
    );
  }

  if (result.verdict === 'WARN') {
    return c.yellow(
      `Warning: Potential regression detected, but effect size is below threshold. ` +
      `Review carefully before proceeding.`
    );
  }

  return c.gray('Unable to determine regression status.');
}

/**
 * No-color fallback for chalk
 */
const noColor = {
  bold: (s: string) => s,
  green: { bold: (s: string) => s },
  red: { bold: (s: string) => s },
  yellow: { bold: (s: string) => s },
  gray: { bold: (s: string) => s },
  cyan: (s: string) => s
} as any;
