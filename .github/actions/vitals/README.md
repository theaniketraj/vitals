# VITALS GitHub Action

Automated performance regression detection for your CI/CD pipeline.

## Features

- **Statistical Analysis** - Welch's t-test + Cohen's d for rigorous detection
- **Multi-Metric Support** - Analyze multiple metrics in a single workflow
- **Policy-as-Code** - Define thresholds and actions in `vitals.yaml`
- **PR Comments** - Automatic analysis reports on pull requests
- **Fast** - Efficient data processing with caching

## Usage

### Basic Regression Check

```yaml
name: Performance Check
on: [pull_request]

jobs:
  vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: VITALS Regression Check
        uses: vitals-dev/vitals/.github/actions/vitals@v1
        with:
          mode: regress
          baseline: ${{ github.event.pull_request.base.sha }}
          candidate: ${{ github.event.pull_request.head.sha }}
          metric: latency_p95
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Batch Analysis (Multiple Metrics)

```yaml
- name: VITALS Batch Check
  uses: vitals-dev/vitals/.github/actions/vitals@v1
  with:
    mode: batch
    baseline: production-v1
    candidate: production-v2
    metrics: latency_p95,error_rate,cpu_usage
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    config: vitals.yaml
```

### With Custom Thresholds

```yaml
- name: VITALS Check
  uses: vitals-dev/vitals/.github/actions/vitals@v1
  with:
    mode: regress
    baseline: ${{ github.event.before }}
    candidate: ${{ github.event.after }}
    metric: latency_p99
    threshold: 15
    pvalue: 0.05
    effect-size: 0.5
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
```

### Policy-Based Analysis

Create a `vitals.yaml` in your repo:

```yaml
version: 1

prometheus:
  url: https://prometheus.example.com
  timeout: 10000

metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
      action: fail

  error_rate:
    threshold:
      max: 0.02
      action: fail

  cpu_usage:
    regression:
      max_increase_percent: 20
      action: warn
```

Then use the action:

```yaml
- name: VITALS Policy Check
  uses: vitals-dev/vitals/.github/actions/vitals@v1
  with:
    mode: batch
    baseline: ${{ github.event.pull_request.base.sha }}
    candidate: ${{ github.event.pull_request.head.sha }}
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    config: vitals.yaml
```

## Inputs

| Input            | Description                                     | Required                | Default               |
| ---------------- | ----------------------------------------------- | ----------------------- | --------------------- |
| `mode`           | Analysis mode: `regress`, `batch`, or `analyze` | No                      | `regress`             |
| `baseline`       | Baseline deployment identifier                  | Yes (for regress/batch) | -                     |
| `candidate`      | Candidate deployment identifier                 | Yes (for regress/batch) | -                     |
| `metric`         | Metric to analyze (regress mode)                | No                      | `latency_p95`         |
| `metrics`        | Comma-separated metrics (batch mode)            | No                      | -                     |
| `config`         | Path to vitals.yaml config                      | No                      | `vitals.yaml`         |
| `prometheus-url` | Prometheus server URL                           | Yes                     | -                     |
| `threshold`      | Regression threshold (%)                        | No                      | `10`                  |
| `pvalue`         | Statistical significance threshold              | No                      | `0.05`                |
| `effect-size`    | Minimum effect size                             | No                      | `0.5`                 |
| `time-range`     | Metrics time window                             | No                      | `10m`                 |
| `fail-fast`      | Exit on first failure (batch)                   | No                      | `false`               |
| `comment-pr`     | Post PR comment                                 | No                      | `true`                |
| `github-token`   | GitHub token for comments                       | No                      | `${{ github.token }}` |

## Outputs

| Output           | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `verdict`        | Analysis verdict: PASS, FAIL, WARN, INSUFFICIENT_DATA |
| `report`         | Full JSON report                                      |
| `change-percent` | Performance change percentage                         |
| `p-value`        | Statistical p-value                                   |

## Example Workflows

### PR Gating

Block PRs that introduce performance regressions:

```yaml
name: PR Performance Gate
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  performance-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run VITALS
        id: vitals
        uses: vitals-dev/vitals/.github/actions/vitals@v1
        with:
          mode: batch
          baseline: main
          candidate: ${{ github.head_ref }}
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          config: .github/vitals.yaml

      - name: Check Result
        if: steps.vitals.outputs.verdict == 'FAIL'
        run: |
          echo "Performance regression detected!"
          echo "${{ steps.vitals.outputs.report }}"
          exit 1
```

### Deployment Validation

Validate production deployments:

```yaml
name: Production Deployment Check
on:
  deployment_status:

jobs:
  validate:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: VITALS Check
        uses: vitals-dev/vitals/.github/actions/vitals@v1
        with:
          mode: regress
          baseline: prod-previous
          candidate: prod-current
          metric: latency_p95
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}

      - name: Rollback on Failure
        if: failure()
        run: |
          # Trigger rollback
          curl -X POST ${{ secrets.ROLLBACK_WEBHOOK }}
```

## PR Comment Examples

### Single Metric (Pass)

```
✅ VITALS Performance Check

Metric: latency_p95
Verdict: PASS
Change: +3.2%
p-value: 0.234
Effect Size: 0.18

Analysis: No significant regression detected (change: 3.2%)

🟢 No performance regressions detected
```

### Batch Analysis (Fail)

```
❌ VITALS Batch Performance Check

Summary: 2 passed, 1 failed, 0 warnings

| Metric      | Verdict | Change | p-value | Status                              |
| ----------- | ------- | ------ | ------- | ----------------------------------- |
| latency_p95 | ❌ FAIL  | +18.3% | 0.012   | Regression detected: 18.3% increase |
| error_rate  | ✅ PASS  | +0.3%  | 0.421   | Within threshold limits             |
| cpu_usage   | ✅ PASS  | +5.1%  | 0.089   | No significant regression           |

🔴 Build should be blocked due to performance regressions
```

## Best Practices

1. **Use Policy Files**: Define `vitals.yaml` for consistent thresholds across teams
2. **Batch Analysis**: Check multiple metrics together for comprehensive regression detection
3. **Appropriate Thresholds**: Set realistic thresholds based on your SLOs
4. **Sufficient Data**: Ensure at least 30 data points per deployment
5. **PR Comments**: Enable automatic PR comments for visibility

## Troubleshooting

### Action fails with "Insufficient data"

- Increase `time-range` (e.g., `30m` instead of `10m`)
- Verify deployment labels exist in Prometheus

### No PR comments posted

- Ensure `github-token` is provided
- Check repository settings allow workflow to create comments

### Connection timeouts

- Verify `prometheus-url` is accessible from GitHub Actions
- Check network/firewall settings

## License

MIT
