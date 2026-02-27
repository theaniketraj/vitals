/**
 * Policy loader and evaluator for vitals.yaml configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface MetricPolicy {
  regression?: {
    max_increase_percent?: number;
    p_value?: number;
    effect_size?: number;
    action?: 'fail' | 'warn' | 'ignore';
  };
  threshold?: {
    max?: number;
    min?: number;
    action?: 'fail' | 'warn' | 'ignore';
  };
}

export interface PrometheusConfig {
  url?: string;
  timeout?: number;
}

export interface DeploymentConfig {
  rollback?: {
    enabled?: boolean;
    strategy?: 'canary' | 'blue-green' | 'immediate';
  };
}

export interface PolicyConfig {
  version: number;
  prometheus?: PrometheusConfig;
  metrics?: {
    [metricName: string]: MetricPolicy;
  };
  deployment?: DeploymentConfig;
}

export interface PolicyEvaluation {
  action: 'fail' | 'warn' | 'pass';
  reason: string;
  shouldRollback: boolean;
}

/**
 * Load policy configuration from file
 */
export function loadPolicy(configPath: string): PolicyConfig | null {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as PolicyConfig;

    // Validate version
    if (!config.version || config.version !== 1) {
      throw new Error(`Unsupported policy version: ${config.version}`);
    }

    return config;
  } catch (error) {
    console.error(`Failed to load policy: ${error}`);
    return null;
  }
}

/**
 * Find policy config file in current directory or parent directories
 */
export function findPolicyConfig(startDir: string = process.cwd()): string | null {
  const fileName = 'vitals.yaml';
  let currentDir = startDir;

  // Search up to 5 levels
  for (let i = 0; i < 5; i++) {
    const configPath = path.join(currentDir, fileName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get metric policy from configuration
 */
export function getMetricPolicy(config: PolicyConfig, metricName: string): MetricPolicy | null {
  if (!config.metrics || !config.metrics[metricName]) {
    return null;
  }
  return config.metrics[metricName];
}

/**
 * Evaluate regression result against policy
 */
export function evaluateRegression(
  metricName: string,
  changePercent: number,
  pValue: number,
  effectSize: number,
  significant: boolean,
  policy: MetricPolicy | null
): PolicyEvaluation {
  // Default policy if none specified
  const defaultPolicy: MetricPolicy = {
    regression: {
      max_increase_percent: 10,
      p_value: 0.05,
      effect_size: 0.5,
      action: 'fail'
    }
  };

  const activePolicy = policy || defaultPolicy;
  const regressionPolicy = activePolicy.regression || defaultPolicy.regression!;

  const maxIncrease = regressionPolicy.max_increase_percent || 10;
  const action = regressionPolicy.action || 'fail';

  // Check if regression exceeds threshold
  const exceedsThreshold = Math.abs(changePercent) > maxIncrease;
  const isRegression = changePercent > 0; // Positive change is regression (latency increase)

  if (significant && exceedsThreshold && isRegression) {
    const reason = `Regression detected: ${changePercent.toFixed(1)}% increase (threshold: ${maxIncrease}%, p=${pValue.toFixed(3)}, effect=${effectSize.toFixed(2)})`;
    
    return {
      action: action === 'ignore' ? 'pass' : action,
      reason,
      shouldRollback: action === 'fail' && (activePolicy.regression?.action === 'fail')
    };
  } else if (exceedsThreshold && isRegression) {
    // Exceeds threshold but not statistically significant
    return {
      action: 'warn',
      reason: `Possible regression: ${changePercent.toFixed(1)}% increase, but not statistically significant (p=${pValue.toFixed(3)})`,
      shouldRollback: false
    };
  }

  return {
    action: 'pass',
    reason: `No significant regression detected (change: ${changePercent.toFixed(1)}%)`,
    shouldRollback: false
  };
}

/**
 * Evaluate threshold policy (for absolute metric values)
 */
export function evaluateThreshold(
  metricName: string,
  value: number,
  policy: MetricPolicy | null
): PolicyEvaluation {
  if (!policy || !policy.threshold) {
    return {
      action: 'pass',
      reason: 'No threshold policy defined',
      shouldRollback: false
    };
  }

  const { max, min, action = 'fail' } = policy.threshold;

  if (max !== undefined && value > max) {
    return {
      action: action === 'ignore' ? 'pass' : action,
      reason: `Value ${value.toFixed(2)} exceeds maximum threshold ${max}`,
      shouldRollback: action === 'fail'
    };
  }

  if (min !== undefined && value < min) {
    return {
      action: action === 'ignore' ? 'pass' : action,
      reason: `Value ${value.toFixed(2)} below minimum threshold ${min}`,
      shouldRollback: action === 'fail'
    };
  }

  return {
    action: 'pass',
    reason: 'Within threshold limits',
    shouldRollback: false
  };
}

/**
 * Get default options from policy config
 */
export function getDefaultOptions(config: PolicyConfig | null): {
  prometheusUrl: string;
  timeout: number;
} {
  return {
    prometheusUrl: config?.prometheus?.url || 'http://localhost:9090',
    timeout: config?.prometheus?.timeout || 10000
  };
}
