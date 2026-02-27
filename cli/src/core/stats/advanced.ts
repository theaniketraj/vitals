/**
 * Advanced statistical tests for regression analysis
 */

import { mean, variance } from './welch';

/**
 * Mann-Whitney U test (non-parametric alternative to Welch's t-test)
 * Useful when data is not normally distributed
 */
export function mannWhitneyUTest(sample1: number[], sample2: number[]): {
  u: number;
  pValue: number;
  significant: boolean;
} {
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Combine and rank all values
  const combined = [
    ...sample1.map((val, idx) => ({ val, group: 1, idx })),
    ...sample2.map((val, idx) => ({ val, group: 2, idx }))
  ];

  // Sort by value
  combined.sort((a, b) => a.val - b.val);

  // Assign ranks (handling ties)
  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    
    // Find tied values
    while (j < combined.length && combined[j].val === combined[i].val) {
      j++;
    }

    // Average rank for tied values
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) {
      ranks[k] = avgRank;
    }

    i = j;
  }

  // Calculate rank sums
  let r1 = 0;
  let r2 = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].group === 1) {
      r1 += ranks[i];
    } else {
      r2 += ranks[i];
    }
  }

  // Calculate U statistics
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = r2 - (n2 * (n2 + 1)) / 2;
  const u = Math.min(u1, u2);

  // Calculate mean and standard deviation for U
  const meanU = (n1 * n2) / 2;
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);

  // Calculate z-score
  const z = (u - meanU) / stdU;

  // Approximate p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    u,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Kolmogorov-Smirnov test (tests if two samples come from the same distribution)
 */
export function kolmogorovSmirnovTest(sample1: number[], sample2: number[]): {
  d: number;
  pValue: number;
  significant: boolean;
} {
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Sort samples
  const sorted1 = [...sample1].sort((a, b) => a - b);
  const sorted2 = [...sample2].sort((a, b) => a - b);

  // Calculate empirical CDFs
  let i = 0;
  let j = 0;
  let maxD = 0;

  const allPoints = [...new Set([...sorted1, ...sorted2])].sort((a, b) => a - b);

  for (const point of allPoints) {
    // Count values <= point in each sample
    while (i < n1 && sorted1[i] <= point) i++;
    while (j < n2 && sorted2[j] <= point) j++;

    const cdf1 = i / n1;
    const cdf2 = j / n2;

    maxD = Math.max(maxD, Math.abs(cdf1 - cdf2));
  }

  // Calculate critical value (approximate)
  const n = Math.sqrt((n1 * n2) / (n1 + n2));
  const criticalValue = 1.36 / n; // For alpha = 0.05

  return {
    d: maxD,
    pValue: maxD > criticalValue ? 0.01 : 0.1, // Simplified approximation
    significant: maxD > criticalValue
  };
}

/**
 * Bootstrap confidence interval for mean difference
 * Useful for small sample sizes or non-normal distributions
 */
export function bootstrapConfidenceInterval(
  sample1: number[],
  sample2: number[],
  iterations = 1000,
  confidenceLevel = 0.95
): {
  lower: number;
  upper: number;
  meanDiff: number;
} {
  const diffs: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Resample with replacement
    const resample1 = resampleWithReplacement(sample1);
    const resample2 = resampleWithReplacement(sample2);

    const mean1 = mean(resample1);
    const mean2 = mean(resample2);

    diffs.push(mean2 - mean1);
  }

  // Sort differences
  diffs.sort((a, b) => a - b);

  // Calculate percentiles for confidence interval
  const alpha = 1 - confidenceLevel;
  const lowerIdx = Math.floor(diffs.length * (alpha / 2));
  const upperIdx = Math.floor(diffs.length * (1 - alpha / 2));

  return {
    lower: diffs[lowerIdx],
    upper: diffs[upperIdx],
    meanDiff: mean(diffs)
  };
}

/**
 * Permutation test (exact test for mean difference)
 * More accurate than parametric tests for small samples
 */
export function permutationTest(
  sample1: number[],
  sample2: number[],
  iterations = 1000
): {
  observedDiff: number;
  pValue: number;
  significant: boolean;
} {
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const observedDiff = Math.abs(mean2 - mean1);

  const combined = [...sample1, ...sample2];
  const n1 = sample1.length;

  let extremeCount = 0;

  for (let i = 0; i < iterations; i++) {
    // Shuffle combined array
    const shuffled = [...combined];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }

    // Split into two groups
    const perm1 = shuffled.slice(0, n1);
    const perm2 = shuffled.slice(n1);

    const permMean1 = mean(perm1);
    const permMean2 = mean(perm2);
    const permDiff = Math.abs(permMean2 - permMean1);

    if (permDiff >= observedDiff) {
      extremeCount++;
    }
  }

  const pValue = extremeCount / iterations;

  return {
    observedDiff,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Resample with replacement (for bootstrap)
 */
function resampleWithReplacement(sample: number[]): number[] {
  const resampled: number[] = [];
  for (let i = 0; i < sample.length; i++) {
    const idx = Math.floor(Math.random() * sample.length);
    resampled.push(sample[idx]);
  }
  return resampled;
}

/**
 * Normal cumulative distribution function
 */
function normalCDF(z: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;

  return z >= 0 ? cdf : 1 - cdf;
}

/**
 * Select appropriate statistical test based on data characteristics
 */
export function selectStatisticalTest(
  sample1: number[],
  sample2: number[]
): 'welch' | 'mann-whitney' | 'permutation' {
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Small sample size? Use permutation test
  if (n1 < 20 || n2 < 20) {
    return 'permutation';
  }

  // Check for normality (simple test: kurtosis and skewness)
  const isNormal1 = checkNormality(sample1);
  const isNormal2 = checkNormality(sample2);

  if (!isNormal1 || !isNormal2) {
    return 'mann-whitney'; // Non-parametric test
  }

  return 'welch'; // Parametric test
}

/**
 * Simple normality check using skewness and kurtosis
 */
function checkNormality(sample: number[]): boolean {
  const m = mean(sample);
  const v = variance(sample, m);
  const std = Math.sqrt(v);

  if (std === 0) return false;

  // Calculate skewness
  let skewness = 0;
  let kurtosis = 0;

  for (const val of sample) {
    const z = (val - m) / std;
    skewness += Math.pow(z, 3);
    kurtosis += Math.pow(z, 4);
  }

  skewness /= sample.length;
  kurtosis = kurtosis / sample.length - 3; // Excess kurtosis

  // Normal distribution has skewness ≈ 0 and excess kurtosis ≈ 0
  // Allow some deviation: |skewness| < 2 and |kurtosis| < 7
  return Math.abs(skewness) < 2 && Math.abs(kurtosis) < 7;
}
