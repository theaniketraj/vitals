import {
  welchTest,
  cohensD,
  removeOutliers,
  normalizeSeries,
  smooth,
  validateSampleSize,
  mean
} from './stats/welch';

export interface RegressionOptions {
  baseline: string;
  candidate: string;
  metric: string;
  threshold?: number;
  pValue?: number;
  effectSizeThreshold?: number;
  minSamples?: number;
}

export interface RegressionResult {
  metric: string;
  baseline: {
    mean: number;
    samples: number;
  };
  candidate: {
    mean: number;
    samples: number;
  };
  change_percent: number;
  p_value: number;
  effect_size: number;
  significant: boolean;
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'INSUFFICIENT_DATA';
  details?: string;
}

/**
 * Run regression analysis comparing baseline and candidate deployments
 */
export async function runRegression(
  options: RegressionOptions,
  baselineData: number[],
  candidateData: number[]
): Promise<RegressionResult> {
  const {
    metric,
    threshold = 10,
    pValue: pValueThreshold = 0.05,
    effectSizeThreshold = 0.5,
    minSamples = 30
  } = options;

  // Step 1: Validate sample sizes
  if (!validateSampleSize(baselineData, minSamples) || !validateSampleSize(candidateData, minSamples)) {
    return {
      metric,
      baseline: { mean: 0, samples: baselineData.length },
      candidate: { mean: 0, samples: candidateData.length },
      change_percent: 0,
      p_value: 1,
      effect_size: 0,
      significant: false,
      verdict: 'INSUFFICIENT_DATA',
      details: `Insufficient data: baseline=${baselineData.length}, candidate=${candidateData.length}, required=${minSamples}`
    };
  }

  // Step 2: Remove outliers
  const baselineCleaned = removeOutliers(baselineData);
  const candidateCleaned = removeOutliers(candidateData);

  // Step 3: Normalize to fixed sample size
  const baselineNormalized = normalizeSeries(baselineCleaned, 50);
  const candidateNormalized = normalizeSeries(candidateCleaned, 50);

  // Step 4: Apply smoothing
  const baselineSmoothed = smooth(baselineNormalized, 3);
  const candidateSmoothed = smooth(candidateNormalized, 3);

  // Step 5: Calculate statistics
  const baselineMean = mean(baselineSmoothed);
  const candidateMean = mean(candidateSmoothed);
  const changePercent = ((candidateMean - baselineMean) / baselineMean) * 100;

  // Step 6: Statistical tests
  const { pValue } = welchTest(baselineSmoothed, candidateSmoothed);
  const effectSize = Math.abs(cohensD(baselineSmoothed, candidateSmoothed));

  // Step 7: Determine significance
  const isStatisticallySignificant = pValue < pValueThreshold;
  const isPracticallySignificant = effectSize > effectSizeThreshold;
  const exceedsThreshold = Math.abs(changePercent) > threshold;

  const significant = isStatisticallySignificant && isPracticallySignificant;

  // Step 8: Make decision
  let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';

  if (significant && exceedsThreshold) {
    verdict = changePercent > 0 ? 'FAIL' : 'PASS'; // Regression is an increase
  } else if (isStatisticallySignificant && exceedsThreshold) {
    verdict = 'WARN';
  }

  return {
    metric,
    baseline: {
      mean: baselineMean,
      samples: baselineData.length
    },
    candidate: {
      mean: candidateMean,
      samples: candidateData.length
    },
    change_percent: changePercent,
    p_value: pValue,
    effect_size: effectSize,
    significant,
    verdict
  };
}
