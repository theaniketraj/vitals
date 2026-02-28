# VITALS GitHub Action

Automatically detect performance regressions in your deployments with statistical analysis, right in your Pull Requests.

## Features

- Statistical regression detection (Welch's t-test, Mann-Whitney U, Permutation tests)
- Automatic PR comments with detailed results
- Multiple metrics support
- Configurable thresholds and policies
- GitHub Checks integration
- Caching for faster runs
- Zero-config setup

## Quick Start

### Basic Usage

```yaml
name: Performance Regression Check
on: [pull_request]

jobs:
  vitals-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: VITALS Regression Check
        uses: vitals-dev/vitals-action@v1
        with:
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          baseline-label: 'prod-v1.0'
          candidate-label: 'prod-v1.1'
          metrics: 'http_requests_total,http_request_duration_seconds_p95,error_rate'
```

### With Configuration File

Create `vitals.yaml` in your repository:

```yaml
version: 2

metrics:
  http_requests_total:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
  
  http_request_duration_seconds_p95:
    regression:
      max_increase_percent: 15
      p_value: 0.05
      effect_size: 0.5
  
  error_rate:
    threshold:
      max: 0.02
```

Then use the action:

```yaml
- name: VITALS Regression Check
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-${{ github.event.pull_request.base.sha }}'
    candidate-label: 'prod-${{ github.event.pull_request.head.sha }}'
    config-file: 'vitals.yaml'
```

## Inputs

| Input                | Description                                                      | Required | Default       |
| -------------------- | ---------------------------------------------------------------- | -------- | ------------- |
| `prometheus-url`     | Prometheus server URL                                            | Yes      | -             |
| `baseline-label`     | Baseline deployment label                                        | Yes      | -             |
| `candidate-label`    | Candidate deployment label                                       | Yes      | -             |
| `config-file`        | Path to vitals.yaml                                              | No       | `vitals.yaml` |
| `metrics`            | Comma-separated metrics list                                     | No       | -             |
| `threshold`          | Default regression threshold %                                   | No       | `10`          |
| `p-value`            | Statistical significance threshold                               | No       | `0.05`        |
| `effect-size`        | Effect size threshold (Cohen's d)                                | No       | `0.5`         |
| `test-type`          | Statistical test: `welch`, `mann-whitney`, `permutation`, `auto` | No       | `auto`        |
| `post-comment`       | Post results as PR comment                                       | No       | `true`        |
| `fail-on-regression` | Fail if regression detected                                      | No       | `true`        |
| `dashboard-url`      | Optional dashboard URL                                           | No       | -             |
| `cache-enabled`      | Enable caching                                                   | No       | `true`        |
| `cache-ttl`          | Cache TTL in seconds                                             | No       | `300`         |

## Outputs

| Output         | Description                                         |
| -------------- | --------------------------------------------------- |
| `verdict`      | Overall verdict: `PASS`, `FAIL`, `WARN`, or `ERROR` |
| `failed-count` | Number of metrics that failed                       |
| `warned-count` | Number of metrics with warnings                     |
| `passed-count` | Number of metrics that passed                       |
| `results-json` | Full results in JSON format                         |

## Examples

### With Dashboard Link

```yaml
- name: VITALS Regression Check
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95,error_rate'
    dashboard-url: 'https://grafana.example.com/d/vitals'
```

### Custom Thresholds

```yaml
- name: VITALS Regression Check
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95'
    threshold: 20  # Allow 20% regression
    p-value: 0.01  # Stricter significance
```

### Non-Blocking Check

```yaml
- name: VITALS Regression Check
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95,error_rate'
    fail-on-regression: false  # Don't block PR
```

### Use with Matrix Strategy

```yaml
jobs:
  vitals-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, frontend, worker]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: VITALS Check - ${{ matrix.service }}
        uses: vitals-dev/vitals-action@v1
        with:
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          baseline-label: '${{ matrix.service }}-baseline'
          candidate-label: '${{ matrix.service }}-candidate'
          config-file: 'configs/${{ matrix.service }}-vitals.yaml'
```

### Save Results as Artifact

```yaml
- name: VITALS Regression Check
  id: vitals
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95,error_rate'

- name: Upload Results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: vitals-results
    path: vitals-results/
```

### Conditional Steps Based on Results

```yaml
- name: VITALS Regression Check
  id: vitals
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95'
    fail-on-regression: false

- name: Auto-rollback
  if: steps.vitals.outputs.verdict == 'FAIL'
  run: |
    echo "Triggering rollback..."
    # Your rollback script here

- name: Notify Slack
  if: steps.vitals.outputs.verdict == 'FAIL'
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d '{"text":"Performance regression detected in PR #${{ github.event.pull_request.number }}"}'
```

## PR Comment Example

When a regression is detected, VITALS posts a comment like this:

```markdown
## VITALS Regressions Detected

### Summary

- Passed: 3
- Failed: 1
- Warned: 1
- ⏱ Duration: 2.34s

### Failed Metrics

| Metric                            | Change | p-value | Effect Size | Verdict |
| --------------------------------- | ------ | ------- | ----------- | ------- |
| http_request_duration_seconds_p95 | +18.5% | 0.023   | 0.72        | FAIL    |

### Warned Metrics

| Metric     | Change | p-value | Effect Size | Verdict |
| ---------- | ------ | ------- | ----------- | ------- |
| error_rate | +6.2%  | 0.041   | 0.45        | WARN    |

### Suggested Action

**Consider rolling back** this deployment. Multiple metrics show significant regression.

📊 View Detailed Dashboard

---
Generated by VITALS - Performance Regression Detection
```

## Permissions

The action requires these permissions:

```yaml
permissions:
  contents: read
  pull-requests: write  # For posting comments
  checks: write         # For check runs
```

## Secrets

Store your Prometheus URL as a secret:

1. Go to repository Settings → Secrets and variables → Actions
2. Add `PROMETHEUS_URL` with your Prometheus server URL
3. Reference it in workflow: `${{ secrets.PROMETHEUS_URL }}`

## Troubleshooting

### No Metrics Found

Ensure your deployment labels match Prometheus labels:

```yaml
# In Prometheus, metrics should have labels like:
http_requests_total{deployment="prod-v1.0"}

# Then use matching labels in action:
baseline-label: 'prod-v1.0'
```

### PR Comments Not Posted

Check workflow permissions:

```yaml
permissions:
  pull-requests: write
```

### Cache Not Working

Cache is stored in `.vitals-cache/` directory. Ensure it persists between runs:

```yaml
- uses: actions/cache@v4
  with:
    path: .vitals-cache
    key: vitals-cache-${{ runner.os }}
```

## Advanced Configuration

### Using Environment Variables

```yaml
- name: VITALS Check
  uses: vitals-dev/vitals-action@v1
  env:
    PROMETHEUS_URL: ${{ secrets.PROMETHEUS_URL }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    prometheus-url: ${{ env.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
```

### Custom Statistical Tests

```yaml
- name: VITALS Check - Non-parametric
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    metrics: 'latency_p95'
    test-type: 'mann-whitney'  # For non-normal distributions
```

## License

MIT

## Support

- [Documentation](https://theaniketraj.github.io/vitals)
- [GitHub Issues](https://github.com/theaniketraj/vitals/issues)
- [Discussions](https://github.com/theaniketraj/vitals/discussions)
