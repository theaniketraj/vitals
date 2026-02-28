---
title: CLI Regression Testing
description: Detect performance regressions between deployments using statistical analysis, historical baseline comparison, and advanced statistical tests.
head:
  - - meta
    - name: keywords
      content: regression testing, performance testing, statistical analysis, Welch t-test, Mann-Whitney U, A/B testing, deployment comparison
---

# CLI Regression Testing

## Overview

VITALS CLI provides comprehensive regression testing capabilities to detect performance degradations between software deployments. The regression engine uses statistical analysis to determine whether observed performance changes are significant and actionable.

## Basic Regression Testing

### Single Baseline Comparison

Compare a candidate deployment against a single baseline:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --metric latency_p95
```

**Output**:

```bash
Fetching baseline data for v1.0...
Fetching candidate data for v1.1...
Running regression analysis (test: welch)...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VITALS Regression Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Metric:           latency_p95
  Baseline:         v1.0 (150 samples, mean: 145.2ms)
  Candidate:        v1.1 (150 samples, mean: 159.8ms)

  Change:           +10.0%
  p-value:          0.023
  Effect Size:      0.62
  Significant:      Yes

  Verdict:          FAIL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Policy Evaluation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Action:           fail
  Reason:           Regression exceeds threshold (10.0% > 10.0%)
  Should Rollback:  Yes

Regression detected - deployment should be blocked
```

### Command Options

```bash
vitals regress \
  --baseline <deployment>       # Required: Baseline deployment ID
  --candidate <deployment>      # Required: Candidate deployment ID
  --metric <metric>             # Optional: Metric name (default: latency_p95)
  --service <service>           # Optional: Service name for service-specific policies
  --config <path>               # Optional: Policy configuration file
  --prometheus-url <url>        # Optional: Prometheus server URL
  --threshold <percent>         # Optional: Override policy threshold
  --pvalue <value>              # Optional: Override policy p-value
  --effect-size <value>         # Optional: Override policy effect size
  --min-samples <count>         # Optional: Minimum sample size (default: 30)
  --time-range <range>          # Optional: Time range for metrics (default: 10m)
  --test <test>                 # Optional: Statistical test (welch, mann-whitney, permutation, auto)
  --format <format>             # Optional: Output format (json, pretty)
  --no-color                    # Optional: Disable colored output
```

## Statistical Analysis

### Analysis Pipeline

The regression analysis follows a multi-step pipeline:

1. **Data Collection**: Fetch metrics from Prometheus
2. **Validation**: Ensure sufficient sample size
3. **Outlier Removal**: Remove statistical outliers using IQR method
4. **Normalization**: Normalize series to fixed sample size
5. **Smoothing**: Apply moving average smoothing
6. **Statistical Test**: Run selected statistical test
7. **Effect Size**: Calculate Cohen's d
8. **Verdict**: Determine final verdict based on policy

### Statistical Tests

#### Welch's t-test (Default)

Parametric test for comparing means of two samples.

**When to use**:

- Large sample sizes (n > 30)
- Approximately normal distributions
- Unequal variances between samples

**Command**:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test welch
```

**Assumptions**:

- Samples are independent
- Approximately normal distribution
- Does not assume equal variances

#### Mann-Whitney U Test

Non-parametric test comparing distributions.

**When to use**:

- Non-normal distributions
- Presence of outliers
- Ordinal data
- Robust alternative to t-test

**Command**:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test mann-whitney
```

**Advantages**:

- No assumptions about distribution
- Robust to outliers
- Works with small samples

#### Permutation Test

Exact test using resampling.

**When to use**:

- Small sample sizes (n < 20)
- Need exact p-values
- No distributional assumptions
- High-stakes decisions

**Command**:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test permutation
```

**Characteristics**:

- Computationally intensive
- Exact p-values
- No assumptions
- Default: 1000 permutations

#### Automatic Test Selection

Let VITALS choose the best test based on data characteristics.

**Command**:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test auto
```

**Selection Logic**:

```bash
if sample_size < 20:
    use permutation_test    # Most accurate for small n
elif data_is_normal:
    use welch_test          # Efficient for normal data
else:
    use mann_whitney_test   # Robust for non-normal data
```

### Effect Size

VITALS calculates Cohen's d to measure practical significance:

**Interpretation**:

| Cohen's d | Effect Size | Interpretation                  |
| --------- | ----------- | ------------------------------- |
| 0.0 - 0.2 | Negligible  | Practically insignificant       |
| 0.2 - 0.5 | Small       | Noticeable but minor            |
| 0.5 - 0.8 | Medium      | Moderate practical significance |
| 0.8+      | Large       | Substantial practical impact    |

**Example Policy**:

```yaml
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5 # Require medium effect
```

## Historical Baseline Comparison

### Multi-Baseline Analysis

Compare against multiple historical deployments to detect trends:

```bash
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --metric latency_p95
```

**Output**:

```bash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VITALS Historical Baseline Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Metric:           latency_p95
  Candidate:        v1.5
  Baselines:        5 deployments
  Aggregation:      last
  Verdict:          PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Historical Baselines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  v1.0                          145.23 ms  (150 samples)
  v1.1                          143.89 ms  (150 samples)
  v1.2                          148.12 ms  (150 samples)
  v1.3                          144.56 ms  (150 samples)
  v1.4                          146.78 ms  (150 samples)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Regression Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Baseline Mean:    146.78 ms
  Candidate Mean:   149.12 ms
  Change:           +1.6%
  p-value:          0.234
  Effect Size:      0.12
  Significant:      No

No significant regression detected
```

### Aggregation Methods

#### Last Baseline (Default)

Use the most recent baseline:

```bash
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --aggregate last
```

**When to use**: Recent performance most relevant.

#### Mean Aggregation

Average across all baselines:

```bash
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --aggregate mean
```

**When to use**: Smooth out variance, detect systematic changes.

#### Median Aggregation

Median across all baselines:

```bash
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --aggregate median
```

**When to use**: Robust to outliers, stable baseline.

### Command Options

```bash
vitals historical \
  --baselines <deployments>     # Required: Comma-separated baseline IDs
  --candidate <deployment>      # Required: Candidate deployment ID
  --metric <metric>             # Optional: Metric name
  --service <service>           # Optional: Service name
  --config <path>               # Optional: Policy configuration
  --prometheus-url <url>        # Optional: Prometheus URL
  --time-range <range>          # Optional: Time range (default: 10m)
  --aggregate <method>          # Optional: Aggregation (last, mean, median)
  --min-baselines <count>       # Optional: Minimum baselines (default: 3)
  --format <format>             # Optional: Output format (json, pretty)
  --no-color                    # Optional: Disable colors
```

## Batch Regression Testing

### Multi-Metric Analysis

Test multiple metrics simultaneously:

```bash
vitals batch \
  --baseline v1.0 \
  --candidate v1.1
```

**Behavior**:

- Analyzes all metrics defined in policy
- Runs tests in sequence
- Aggregates results
- Fails if any metric fails

### Explicit Metric List

Specify metrics to test:

```bash
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --metrics latency_p95,error_rate,throughput
```

### Fail-Fast Mode

Stop on first failure:

```bash
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --fail-fast
```

### Example Output

```bash
Loaded policy from: vitals.yaml
Analyzing 3 metric(s): latency_p95, error_rate, throughput

[latency_p95] Fetching data...
[latency_p95] Running analysis...
[latency_p95] PASS (+2.1%, p=0.234)

[error_rate] Fetching data...
[error_rate] Running analysis...
[error_rate] FAIL (+8.5%, p=0.012)

[throughput] Fetching data...
[throughput] Running analysis...
[throughput] PASS (-1.2%, p=0.456)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Batch Results Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Total Metrics:    3
  Passed:           2
  Failed:           1
  Warnings:         0
  Insufficient Data: 0

  Overall Verdict:  FAIL

Deployment should be blocked due to regression in: error_rate
```

## Service-Specific Testing

### Per-Service Policies

Test with service-specific policies:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --service payment-api
```

**Policy Example**:

```yaml
version: 2.0

base:
  metrics:
    latency_p95:
      regression:
        max_increase_percent: 10

services:
  payment-api:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
```

Result: Uses 5% threshold instead of base 10%.

### Batch with Service

```bash
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --service production
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Regression Check

on:
  pull_request:
    branches: [main]

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install VITALS CLI
        run: npm install -g @vitals/cli

      - name: Run Regression Test
        run: |
          vitals regress \
            --baseline ${{ github.event.pull_request.base.sha }} \
            --candidate ${{ github.sha }} \
            --metric latency_p95 \
            --service production
```

### GitLab CI

```yaml
regression_test:
  stage: test
  image: node:18
  before_script:
    - npm install -g @vitals/cli
  script:
    - |
      vitals historical \
        --baselines $(get_last_5_deployments) \
        --candidate $CI_COMMIT_SHA \
        --metric latency_p95 \
        --aggregate mean
  only:
    - merge_requests
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    stages {
        stage('Regression Test') {
            steps {
                sh '''
                    npm install -g @vitals/cli

                    vitals batch \
                        --baseline ${BASELINE_VERSION} \
                        --candidate ${BUILD_NUMBER} \
                        --service ${ENVIRONMENT} \
                        --fail-fast
                '''
            }
        }
    }
}
```

## Advanced Usage

### Custom Thresholds

Override policy thresholds via command line:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --threshold 15 \
  --pvalue 0.01 \
  --effect-size 0.8
```

### JSON Output for Automation

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --format json > results.json
```

**Output**:

```json
{
  "metric": "latency_p95",
  "baseline": {
    "deployment": "v1.0",
    "mean": 145.2,
    "samples": 150
  },
  "candidate": {
    "deployment": "v1.1",
    "mean": 159.8,
    "samples": 150
  },
  "change_percent": 10.0,
  "p_value": 0.023,
  "effect_size": 0.62,
  "significant": true,
  "verdict": "FAIL",
  "policy": {
    "action": "fail",
    "reason": "Regression exceeds threshold",
    "should_rollback": true
  }
}
```

### Parse Results

```bash
#!/bin/bash

VERDICT=$(vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --format json | jq -r '.verdict')

if [ "$VERDICT" = "FAIL" ]; then
  echo "Regression detected - blocking deployment"
  exit 1
fi

echo "No regression - proceeding"
```

## Exit Codes

VITALS CLI uses standard exit codes:

| Code | Meaning | Description                           |
| ---- | ------- | ------------------------------------- |
| 0    | Success | No regression detected (PASS or WARN) |
| 1    | Failure | Regression detected (FAIL)            |
| 2    | Error   | Insufficient data or system error     |

## Best Practices

### Sample Size Requirements

Ensure adequate sample sizes for reliable results:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --min-samples 50
```

**Recommendations**:

- Minimum: 30 samples per deployment
- Recommended: 100+ samples
- For permutation test: 20+ samples acceptable

### Time Range Selection

Choose appropriate time ranges:

```bash
# Short deployments
vitals regress --time-range 5m

# Standard deployments
vitals regress --time-range 10m

# Long-running services
vitals regress --time-range 1h
```

### Multiple Metrics

Always test multiple metrics:

```yaml
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10

  error_rate:
    regression:
      max_increase_percent: 5

  throughput:
    regression:
      max_increase_percent: -5
```

### Gradual Rollout

Use historical comparison for gradual rollouts:

```bash
# Week 1: Compare against immediate predecessor
vitals regress --baseline v1.0 --candidate v1.1

# Week 2: Compare against trend
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --aggregate mean
```

## Troubleshooting

### Insufficient Data

**Error**:

```bash
Insufficient data: baseline=25, candidate=28, required=30
```

**Solutions**:

1. Reduce `--min-samples` requirement:

   ```bash
   vitals regress --min-samples 20
   ```

2. Increase `--time-range`:

   ```bash
   vitals regress --time-range 30m
   ```

3. Use permutation test for small samples:

   ```bash
   vitals regress --test permutation
   ```

### High Variance

**Symptom**: Inconsistent test results between runs.

**Solutions**:

1. Use historical baseline with mean aggregation:

   ```bash
   vitals historical --aggregate mean
   ```

2. Increase sample size:

   ```bash
   vitals regress --time-range 1h
   ```

3. Use Mann-Whitney U test (more robust):

   ```bash
   vitals regress --test mann-whitney
   ```

### False Positives

**Symptom**: Tests fail when performance seems acceptable.

**Solutions**:

1. Adjust policy thresholds:

   ```yaml
   metrics:
     latency_p95:
       regression:
         max_increase_percent: 15 # More lenient
         p_value: 0.01 # More stringent
   ```

2. Require larger effect size:

   ```yaml
   metrics:
     latency_p95:
       regression:
         effect_size: 0.8 # Require large effect
   ```

### False Negatives

**Symptom**: Tests pass when performance degraded.

**Solutions**:

1. Stricter thresholds:

   ```yaml
   metrics:
     latency_p95:
       regression:
         max_increase_percent: 5
         p_value: 0.05
         effect_size: 0.3
   ```

2. Use historical comparison to detect trends:

   ```bash
   vitals historical --aggregate mean
   ```

## See Also

- [Policy-as-Code Engine](./cli_policy_engine.md)
- [Statistical Methods](./cli_statistical_methods.md)
- [CI/CD Integration](./cicd_integration.md)
- [CLI Reference](./cli_reference.md)
