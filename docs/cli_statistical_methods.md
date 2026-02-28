---
title: Statistical Methods
description: Statistical analysis methods used in VITALS regression testing including Welch's t-test, Mann-Whitney U, permutation tests, and effect size calculations.
head:
  - - meta
    - name: keywords
      content: statistical methods, Welch t-test, Mann-Whitney U test, permutation test, Cohen's d, effect size, hypothesis testing
---

# Statistical Methods

## Overview

VITALS uses rigorous statistical methods to detect performance regressions. This document explains the mathematical foundations, assumptions, and appropriate usage of each statistical test.

## Core Concepts

### Hypothesis Testing

Performance regression testing uses hypothesis testing:

**Null Hypothesis (H₀)**: No performance difference between baseline and candidate
**Alternative Hypothesis (H₁)**: Candidate has different performance than baseline

**Type I Error (α)**: False positive - detecting regression when none exists
**Type II Error (β)**: False negative - missing actual regression

**Significance Level (α)**: Typically 0.05 (5% false positive rate)

### p-value

Probability of observing the data (or more extreme) if null hypothesis is true.

**Interpretation**:

- p < 0.05: Reject null hypothesis, significant difference detected
- p >= 0.05: Fail to reject null hypothesis, no significant difference

**Example**:

```bash
p-value = 0.023
```

Interpretation: 2.3% probability this difference occurred by chance. Significant at α = 0.05 level.

### Effect Size

Measures practical significance (magnitude of difference).

**Why needed**: Statistical significance ≠ practical significance

- Large samples can detect tiny, meaningless differences
- Effect size quantifies practical importance

**Cohen's d**: Standardized mean difference

```bash
d = (mean₁ - mean₂) / pooled_standard_deviation
```

**Interpretation**:

| Cohen's d | Effect     | Practical Meaning               |
| --------- | ---------- | ------------------------------- |
| 0.0 - 0.2 | Negligible | Not practically significant     |
| 0.2 - 0.5 | Small      | Noticeable to careful observers |
| 0.5 - 0.8 | Medium     | Noticeable to most users        |
| 0.8+      | Large      | Obvious to everyone             |

## Parametric Tests

### Welch's t-test

Default test for comparing two independent samples.

#### Mathematical Foundation

**Test Statistic**:

```bash
t = (x̄₁ - x̄₂) / √(s₁²/n₁ + s₂²/n₂)
```

Where:

- x̄₁, x̄₂: Sample means
- s₁², s₂²: Sample variances
- n₁, n₂: Sample sizes

**Degrees of Freedom** (Welch-Satterthwaite):

```bash
df = (s₁²/n₁ + s₂²/n₂)² / ((s₁²/n₁)²/(n₁-1) + (s₂²/n₂)²/(n₂-1))
```

#### Assumptions

1. **Independence**: Samples are independent
2. **Normality**: Approximately normal distribution (robust with n > 30)
3. **No assumption of equal variances** (advantage over Student's t-test)

#### When to Use

**Recommended**:

- Sample sizes n₁, n₂ >= 30
- Approximately normal distributions
- Different variances between groups

**Avoid**:

- Small samples (n < 20) with non-normal data
- Severe outliers
- Highly skewed distributions

#### Example

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test welch
```

**Output**:

```bash
Test: Welch's t-test
t-statistic: 2.156
df: 295.3
p-value: 0.032
```

#### Implementation Details

VITALS applies preprocessing before Welch's test:

1. **Outlier Removal**: IQR method (Q1 - 1.5×IQR, Q3 + 1.5×IQR)
2. **Normalization**: Downsample/upsample to n = 50
3. **Smoothing**: Moving average (window = 3)
4. **Test**: Welch's t-test on processed data

## Non-Parametric Tests

### Mann-Whitney U Test

Rank-based non-parametric test.

#### Mathematical Foundation

**Algorithm**:

1. Combine and rank all observations
2. Calculate rank sums for each sample: R₁, R₂
3. Calculate U statistics:

```bash
U₁ = n₁×n₂ + n₁×(n₁+1)/2 - R₁
U₂ = n₁×n₂ + n₂×(n₂+1)/2 - R₂
U = min(U₁, U₂)
```

1. For large samples, approximate with normal distribution:

```bash
z = (U - μᵤ) / σᵤ

where:
μᵤ = n₁×n₂/2
σᵤ = √(n₁×n₂×(n₁+n₂+1)/12)
```

#### Assumptions

1. **Independence**: Samples are independent
2. **Ordinal data**: Can be ranked
3. **No distributional assumptions**

#### When to Use

**Recommended**:

- Non-normal distributions
- Presence of outliers
- Small to medium sample sizes
- Skewed distributions
- Ordinal data

**Avoid**:

- When parametric assumptions hold (less power than t-test)
- Extremely small samples (n < 10)

#### Example

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test mann-whitney
```

**Output**:

```bash
Test: Mann-Whitney U
U-statistic: 3421
z-score: -2.156
p-value: 0.031
```

#### Power Comparison

Mann-Whitney has 95.5% power efficiency compared to t-test when normality holds.

**Trade-off**: Slightly less powerful when assumptions hold, but robust when they don't.

### Permutation Test

Exact test using resampling.

#### Mathematical Foundation

**Algorithm**:

1. Calculate observed mean difference: d_obs = |mean₁ - mean₂|
2. Combine all observations into single pool
3. Randomly split into two groups of size n₁ and n₂
4. Calculate mean difference for permuted data: d_perm
5. Repeat K times (default: 1000)
6. Calculate p-value:

```bash
p-value = (number of d_perm >= d_obs) / K
```

#### Assumptions

1. **Exchangeability**: Under null hypothesis, observations are exchangeable
2. **Independence**: Samples are independent

No distributional assumptions required.

#### When to Use

**Recommended**:

- Small sample sizes (n < 20)
- Need exact p-values
- No distributional assumptions can be made
- High-stakes decisions
- Publication-quality analysis

**Avoid**:

- Large samples (computationally expensive)
- Real-time analysis (slow)

#### Example

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test permutation
```

**Output**:

```bash
Test: Permutation test
Observed difference: 14.6
Iterations: 1000
Extreme count: 23
p-value: 0.023
```

#### Computational Cost

**Time Complexity**: O(K × n), where K = iterations, n = sample size

**Default**: K = 1000 iterations
**Typical runtime**: 100-200ms for n = 50

## Automatic Test Selection

### Selection Algorithm

VITALS can automatically choose the most appropriate test:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test auto
```

**Decision Tree**:

```bash
if n₁ < 20 or n₂ < 20:
    return permutation_test    # Most accurate for small n

elif is_normal(sample₁) and is_normal(sample₂):
    return welch_test          # Efficient for normal data

else:
    return mann_whitney_test   # Robust for non-normal data
```

### Normality Check

Simple normality check using skewness and kurtosis:

**Skewness**:

```bash
skewness = E[(X - μ)³] / σ³
```

**Kurtosis**:

```bash
kurtosis = E[(X - μ)⁴] / σ⁴
```

**Criteria**:

- Normal: |skewness| < 1.0 and |kurtosis - 3| < 1.0
- Non-normal: Otherwise

## Effect Size Calculations

### Cohen's d

Standardized mean difference:

```bash
d = (x̄₁ - x̄₂) / s_pooled

where:
s_pooled = √((s₁² + s₂²) / 2)
```

**Implementation**:

```typescript
function cohensD(sample1: number[], sample2: number[]): number {
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = variance(sample1, mean1);
  const var2 = variance(sample2, mean2);

  const pooledStd = Math.sqrt((var1 + var2) / 2);

  return (mean2 - mean1) / pooledStd;
}
```

### Alternative Effect Sizes

#### Hedges' g

Corrects for small sample bias:

```bash
g = d × (1 - 3/(4df - 1))

where df = n₁ + n₂ - 2
```

**Use when**: n < 20

#### Glass's Δ

Uses only baseline standard deviation:

```bash
Δ = (x̄₂ - x̄₁) / s₁
```

**Use when**: Baseline is gold standard

## Bootstrap Methods

### Bootstrap Confidence Intervals

Resampling-based robust confidence intervals.

#### Algorithm

1. For each iteration (default: 1000):
   - Resample sample₁ with replacement → resample₁
   - Resample sample₂ with replacement → resample₂
   - Calculate mean difference: d_i = mean(resample₂) - mean(resample₁)
2. Sort all differences: d₁, d₂, ..., d₁₀₀₀
3. Calculate percentiles for 95% CI:
   - Lower: 2.5th percentile
   - Upper: 97.5th percentile

#### Example

```typescript
const ci = bootstrapConfidenceInterval(
  baseline,
  candidate,
  1000, // iterations
  0.95, // confidence level
);

console.log(`95% CI: [${ci.lower}, ${ci.upper}]`);
```

**Output**:

```bash
95% CI: [2.3, 18.7]
```

**Interpretation**: 95% confident true mean difference is between 2.3ms and 18.7ms.

#### Advantages

- No distributional assumptions
- Works with small samples
- Handles skewed distributions
- Provides intuitive intervals

## Data Preprocessing Pipeline

VITALS implements a comprehensive preprocessing pipeline to ensure reliable statistical analysis. Phase 2.1 enhancements provide multiple methods for each preprocessing step.

### Preprocessing Overview

```bash
Raw Data → Validate → Fill Missing → Remove Outliers →
Normalize → Smooth → Validate Size → Statistical Test
```

### Missing Value Handling

**Problem**: NaN, Infinity, or missing data points compromise analysis.

**Solutions** (Phase 2.1):

1. **Interpolation** (Default): Linear interpolation between nearest valid values
   - Best for: Continuous metrics with occasional gaps
   - Example: `[1, NaN, 3] → [1, 2, 3]`

2. **Forward Fill**: Use previous valid value
   - Best for: Step-function metrics
   - Example: `[1, NaN, 3] → [1, 1, 3]`

3. **Backward Fill**: Use next valid value
   - Best for: Predefined states
   - Example: `[1, NaN, 3] → [1, 3, 3]`

4. **Mean Imputation**: Replace with mean of valid values
   - Best for: Random missing values
   - Example: `[1, NaN, 3] → [1, 2, 3]`

**Configuration**:

```typescript
preprocessData(data, {
  fillStrategy: "interpolate", // or 'forward', 'backward', 'mean', 'none'
});
```

### Outlier Detection Methods

#### IQR Method (Default)

**Algorithm**: Interquartile Range method

```bash
IQR = Q3 - Q1
lower_bound = Q1 - 1.5 × IQR
upper_bound = Q3 + 1.5 × IQR
```

**Advantages**:

- Robust to extreme values
- Non-parametric (no distribution assumptions)

**When to use**: General purpose, balanced datasets

**Configuration**:

```typescript
preprocessData(data, {
  outlierMethod: "iqr",
  iqrMultiplier: 1.5, // Adjust sensitivity (higher = less sensitive)
});
```

#### Z-Score Method

**Algorithm**: Standard score outlier detection

```bash
z = (x - μ) / σ
outlier if |z| > threshold (typically 3)
```

**Advantages**:

- Clear statistical interpretation
- Adjustable threshold

**When to use**: Normally distributed data

**Disadvantages**:

- Assumes normal distribution
- Sensitive to extreme outliers

**Configuration**:

```typescript
preprocessData(data, {
  outlierMethod: "zscore",
  zscoreThreshold: 3, // Typically 2.5-3.5
});
```

#### MAD Method (Robust)

**Algorithm**: Median Absolute Deviation

```bash
MAD = median(|x - median(x)|)
modified_z = 0.6745 × |x - median(x)| / MAD
outlier if modified_z > 3.5
```

**Advantages**:

- Most robust to extreme outliers
- Works with non-normal distributions
- Not affected by small numbers of outliers

**When to use**: Data with extreme outliers or unknown distribution

**Configuration**:

```typescript
preprocessData(data, {
  outlierMethod: "mad", // No additional parameters needed
});
```

**Comparison**:

| Method  | Robustness | Speed | Best For                 |
| ------- | ---------- | ----- | ------------------------ |
| IQR     | Medium     | Fast  | General purpose          |
| Z-Score | Low        | Fast  | Normal distributions     |
| MAD     | High       | Fast  | Extreme outliers, skewed |

### Data Normalization

**Problem**: Different sample sizes complicate comparison.

**Solution**: Normalize to fixed target size (default: 50 points)

**Algorithm**: Chunk averaging

```bash
chunk_size = len(data) / target_size
For each chunk: avg(chunk) → normalized_point
```

**Why 50 points**:

- Sufficient for statistical power
- Reduces noise without losing signal
- Fast computation

**Configuration**:

```typescript
preprocessData(data, {
  targetSampleSize: 50, // or 100 for more detail
});
```

### Smoothing Techniques

#### Moving Average (Default)

**Algorithm**: Simple rolling window average

```bash
smoothed[i] = mean(data[i-w:i+w])
```

**Advantages**:

- Simple, interpretable
- Equal weights to all points in window

**When to use**: General noise reduction

**Configuration**:

```typescript
preprocessData(data, {
  smoothingMethod: "moving-average",
  smoothingWindow: 3, // Typically 3-7
});
```

#### Exponential Smoothing (EWMA)

**Algorithm**: Exponentially Weighted Moving Average

```bash
smoothed[0] = data[0]
smoothed[i] = α × data[i] + (1-α) × smoothed[i-1]
```

**Advantages**:

- Responds quickly to recent changes
- Less lag than moving average
- Customizable responsiveness (α)

**When to use**: Trending data, recent values more important

**Configuration**:

```typescript
preprocessData(data, {
  smoothingMethod: "exponential",
  exponentialAlpha: 0.3, // 0.1 = heavy smoothing, 0.5 = light smoothing
});
```

#### Gaussian Smoothing

**Algorithm**: Weighted average using Gaussian kernel

```bash
weight[i] = exp(-i² / (2σ²))
smoothed[i] = Σ(data × normalized_weights)
```

**Advantages**:

- Smooth, natural-looking curves
- Preserves shape better than moving average
- Reduces high-frequency noise

**When to use**: Visual presentations, smooth curves needed

**Configuration**:

```typescript
preprocessData(data, {
  smoothingMethod: "gaussian",
  smoothingWindow: 5, // Kernel size
});
```

**Comparison**:

| Method         | Lag  | Edge Effects | Best For             |
| -------------- | ---- | ------------ | -------------------- |
| Moving Average | High | Moderate     | General smoothing    |
| Exponential    | Low  | Low          | Trending data        |
| Gaussian       | Med  | Moderate     | Presentation quality |

### Time Series Alignment

**Problem**: Baseline and candidate data may have different timestamps.

**Solution**: Align to common time grid with interpolation.

**Algorithm**:

```bash
1. Find common time range: [max(start1, start2), min(end1, end2)]
2. Generate aligned timestamps at fixed intervals
3. Interpolate values for each timestamp
```

**Use Case**:

```typescript
import { alignTimeWindows } from './core/preprocessing';

const baseline: [number, number][] = [...]; // [timestamp, value]
const candidate: [number, number][] = [...];

const { aligned1, aligned2, timestamps } = alignTimeWindows(
  baseline,
  candidate,
  15 // 15-second intervals
);
```

### Sample Size Validation

**Minimum Requirement**: 30 samples (Central Limit Theorem threshold)

**Why 30**:

- Ensures normal distribution approximation
- Adequate statistical power
- Standard in statistical practice

**Behavior**:

```bash
if samples < 30:
  return verdict: "INSUFFICIENT_DATA"
```

**Configuration**:

```typescript
preprocessData(data, {
  minSampleSize: 30, // or higher for stricter requirements
});
```

### Data Quality Metrics

**Calculate Quality Indicators**:

```typescript
import { calculateDataQuality } from "./core/preprocessing";

const quality = calculateDataQuality(data);

console.log(quality);
// {
//   completeness: 0.95,  // 95% valid values
//   variance: 12.5,       // Data spread
//   stability: 0.85,      // Low coefficient of variation
//   outlierRatio: 0.02    // 2% outliers detected
// }
```

**Interpretation**:

- **Completeness**: Ratio of valid values (>0.9 recommended)
- **Variance**: Spread of data (context-dependent)
- **Stability**: 1 - CV (>0.8 is stable)
- **Outlier Ratio**: Proportion of outliers (<0.05 typical)

### Complete Preprocessing Example

```typescript
import { preprocessData, PreprocessingOptions } from "./core/preprocessing";

// High-quality preprocessing configuration
const options: PreprocessingOptions = {
  // Missing values
  fillStrategy: "interpolate",

  // Outliers
  outlierMethod: "mad", // Robust method

  // Normalization
  targetSampleSize: 50,

  // Smoothing
  smoothingMethod: "exponential",
  exponentialAlpha: 0.3,

  // Validation
  minSampleSize: 30,
};

const result = preprocessData(rawData, options);

console.log(`Original: ${result.originalLength} points`);
console.log(`Outliers removed: ${result.outliersRemoved}`);
console.log(`Missing filled: ${result.missingValuesFilled}`);
console.log(`Steps: ${result.stepsApplied.join(" → ")}`);
console.log(`Final: ${result.data.length} points`);
console.log(`Warnings: ${result.warnings.join(", ")}`);
```

## Data Preprocessing Pipeline

### Outlier Detection

VITALS uses IQR (Interquartile Range) method:

**Algorithm**:

1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
2. Calculate IQR = Q3 - Q1
3. Define bounds:
   - Lower: Q1 - 1.5 × IQR
   - Upper: Q3 + 1.5 × IQR
4. Remove values outside bounds

**Example**:

```bash
Data: [100, 102, 105, 108, 200, 103, 104]
Q1 = 102.5, Q3 = 106.5
IQR = 4.0
Lower = 96.5, Upper = 112.5
Outliers: [200]
Cleaned: [100, 102, 105, 108, 103, 104]
```

### Normalization

Standardize sample sizes for consistent comparison:

**Methods**:

1. **Downsampling**: Randomly select n values
2. **Upsampling**: Bootstrap resample to n values

**Default**: n = 50

**Purpose**: Eliminate sample size imbalance effects

### Smoothing

Moving average smoothing reduces noise:

```bash
smoothed[i] = (data[i-1] + data[i] + data[i+1]) / 3
```

**Window size**: 3 (default)

**Purpose**: Reduce high-frequency noise while preserving trends

## Power Analysis

### Sample Size Requirements

Required sample size for desired power:

**Formula**:

```bash
n = 2 × (z_α/2 + z_β)² × σ² / δ²

where:
z_α/2: Critical value for significance level
z_β: Critical value for power
σ²: Variance
δ: Minimum detectable difference
```

**Example**: Detect 10% change with 80% power, α = 0.05

```bash
σ = 15 (ms)
δ = 10% of 100ms = 10ms
n = 2 × (1.96 + 0.84)² × 15² / 10²
n ≈ 71 per group
```

### Power Curves

Power depends on:

- Sample size (n)
- Effect size (d)
- Significance level (α)

**Typical Values**:

| n per group | d = 0.3 | d = 0.5 | d = 0.8 |
| ----------- | ------- | ------- | ------- |
| 20          | 0.15    | 0.33    | 0.64    |
| 50          | 0.30    | 0.70    | 0.96    |
| 100         | 0.52    | 0.94    | 0.99+   |

Power = P(Reject H₀ | H₁ is true)

## Common Issues

### Multiple Testing

**Problem**: Testing multiple metrics increases false positive rate.

**Family-Wise Error Rate (FWER)**:

```bash
P(at least one false positive) = 1 - (1 - α)^k
```

Where k = number of tests.

**Example**: Testing 5 metrics at α = 0.05

```bash
FWER = 1 - (1 - 0.05)^5 = 0.226 (22.6%)
```

**Solution**: Bonferroni correction

```bash
α_adjusted = α / k = 0.05 / 5 = 0.01
```

**VITALS Approach**: Policy-based thresholds per metric (no adjustment needed)

### Sequential Testing

**Problem**: Repeatedly testing during rollout inflates error rate.

**Solution**: Use historical baseline with predefined stopping rules.

### Variance Heterogeneity

**Problem**: Unequal variances between samples.

**Solution**: Welch's t-test (doesn't assume equal variances) or Mann-Whitney U.

## Validation

### Test Correctness

VITALS statistical tests validated against:

- R statistical package
- SciPy (Python)
- Published test statistics

**Coverage**: Unit tests with known distributions and expected results.

### Robustness Testing

Tests validated with:

- Normal distributions
- Non-normal distributions (log-normal, exponential)
- Small samples (n = 10)
- Large samples (n = 1000)
- High variance
- Outliers

## References

### Academic Literature

1. Welch, B. L. (1947). "The generalization of 'Student's' problem when several different population variances are involved"
2. Mann, H. B., & Whitney, D. R. (1947). "On a test of whether one of two random variables is stochastically larger"
3. Cohen, J. (1988). "Statistical Power Analysis for the Behavioral Sciences"
4. Good, P. (2005). "Permutation, Parametric, and Bootstrap Tests of Hypotheses"

### Implementation References

- NumPy statistical functions
- SciPy hypothesis testing
- R statistical computing

## See Also

- [CLI Regression Testing](./cli_regression_testing.md)
- [Policy-as-Code Engine](./cli_policy_engine.md)
- [CI/CD Integration](./cicd_integration.md)
