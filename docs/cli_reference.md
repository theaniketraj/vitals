---
title: CLI Reference
description: Complete command-line interface reference for VITALS CLI including all commands, options, and usage examples.
head:
  - - meta
    - name: keywords
      content: CLI reference, command line, vitals commands, CLI documentation, command reference
---

# CLI Reference

## Overview

VITALS CLI provides a comprehensive command-line interface for performance testing, regression detection, and policy management in CI/CD pipelines.

## Installation

### NPM (Recommended)

```bash
npm install -g @vitals/cli
```

### From Source

```bash
git clone https://github.com/theaniketraj/vitals.git
cd vitals/cli
npm install
npm run build
npm link
```

### Verification

```bash
vitals --version
# Output: 0.4.0
```

## Global Options

Available for all commands:

```bash
vitals <command> [options]

Options:
  -V, --version          Output version number
  -h, --help            Display help for command
```

## Commands

### regress

Detect performance regression between two deployments.

**Syntax**:

```bash
vitals regress [options]
```

**Required Options**:

```bash
--baseline <deployment>    Baseline deployment identifier
--candidate <deployment>   Candidate deployment identifier
```

**Optional Options**:

```bash
--metric <metric>          Metric to analyze (default: "latency_p95")
--service <service>        Service name for service-specific policies
--config <path>            Path to vitals.yaml config file
--prometheus-url <url>     Prometheus server URL (env: PROMETHEUS_URL)
--threshold <percent>      Regression threshold percentage
--pvalue <value>           Statistical significance threshold (0-1)
--effect-size <value>      Minimum effect size threshold
--min-samples <count>      Minimum sample size required (default: "30")
--time-range <range>       Time range for metrics (default: "10m")
--test <test>              Statistical test: welch, mann-whitney, permutation, auto (default: "welch")
--format <format>          Output format: json, pretty (default: "pretty")
--no-color                 Disable colored output
```

**Examples**:

```bash
# Basic regression test
vitals regress \
  --baseline v1.0 \
  --candidate v1.1

# With service-specific policy
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --service payment-api

# Custom thresholds
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --threshold 15 \
  --pvalue 0.01

# JSON output
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --format json

# Mann-Whitney U test
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --test mann-whitney
```

**Exit Codes**:

- `0`: No regression (PASS or WARN)
- `1`: Regression detected (FAIL)
- `2`: Insufficient data or error

### analyze

Analyze performance metrics for a single deployment.

**Syntax**:

```bash
vitals analyze [options]
```

**Required Options**:

```bash
--deployment <deployment>  Deployment identifier
```

**Optional Options**:

```bash
--metric <metric>          Metric to analyze (default: "latency_p95")
--config <path>            Path to vitals.yaml config file
--prometheus-url <url>     Prometheus server URL
--time-range <range>       Time range for metrics (default: "10m")
--format <format>          Output format: json, pretty (default: "pretty")
--no-color                 Disable colored output
```

**Examples**:

```bash
# Analyze single deployment
vitals analyze --deployment v1.0

# Analyze specific metric
vitals analyze \
  --deployment v1.0 \
  --metric error_rate

# JSON output
vitals analyze \
  --deployment v1.0 \
  --format json
```

### compare

Compare metrics across multiple deployments.

**Syntax**:

```bash
vitals compare [options]
```

**Required Options**:

```bash
--deployments <deployments>  Comma-separated deployment identifiers
```

**Optional Options**:

```bash
--metric <metric>            Metric to compare (default: "latency_p95")
--config <path>              Path to vitals.yaml config file
--prometheus-url <url>       Prometheus server URL
--time-range <range>         Time range for metrics (default: "10m")
--format <format>            Output format: json, pretty (default: "pretty")
--no-color                   Disable colored output
```

**Examples**:

```bash
# Compare deployments
vitals compare \
  --deployments v1.0,v1.1,v1.2

# Compare specific metric
vitals compare \
  --deployments v1.0,v1.1,v1.2 \
  --metric throughput

# JSON output
vitals compare \
  --deployments v1.0,v1.1,v1.2 \
  --format json
```

### batch

Run regression analysis on multiple metrics.

**Syntax**:

```bash
vitals batch [options]
```

**Required Options**:

```bash
--baseline <deployment>    Baseline deployment identifier
--candidate <deployment>   Candidate deployment identifier
```

**Optional Options**:

```bash
--metrics <metrics>        Comma-separated list of metrics to analyze
--service <service>        Service name for service-specific policies
--config <path>            Path to vitals.yaml config file
--prometheus-url <url>     Prometheus server URL
--time-range <range>       Time range for metrics (default: "10m")
--format <format>          Output format: json, pretty (default: "pretty")
--fail-fast                Exit on first failure (default: false)
--no-color                 Disable colored output
```

**Examples**:

```bash
# Batch test all metrics from policy
vitals batch \
  --baseline v1.0 \
  --candidate v1.1

# Specific metrics
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --metrics latency_p95,error_rate,throughput

# Service-specific batch
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --service production

# Fail-fast mode
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --fail-fast
```

**Exit Codes**:

- `0`: All tests passed
- `1`: One or more tests failed
- `2`: Insufficient data or error

### historical

Compare candidate against multiple historical baselines.

**Syntax**:

```bash
vitals historical [options]
```

**Required Options**:

```bash
--baselines <deployments>  Comma-separated list of baseline deployments (oldest to newest)
--candidate <deployment>   Candidate deployment identifier
```

**Optional Options**:

```bash
--metric <metric>          Metric to analyze (default: "latency_p95")
--service <service>        Service name for service-specific policies
--config <path>            Path to vitals.yaml config file
--prometheus-url <url>     Prometheus server URL
--time-range <range>       Time range for metrics (default: "10m")
--format <format>          Output format: json, pretty (default: "pretty")
--aggregate <method>       Aggregation method: mean, median, last (default: "last")
--min-baselines <count>    Minimum number of baselines required (default: "3")
--no-color                 Disable colored output
```

**Examples**:

```bash
# Historical comparison
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5

# Mean aggregation
vitals historical \
  --baselines v1.0,v1.1,v1.2,v1.3,v1.4 \
  --candidate v1.5 \
  --aggregate mean

# Service-specific
vitals historical \
  --baselines v1.0,v1.1,v1.2 \
  --candidate v1.3 \
  --service payment-api

# Require minimum baselines
vitals historical \
  --baselines v1.0,v1.1,v1.2 \
  --candidate v1.3 \
  --min-baselines 5
```

**Exit Codes**:

- `0`: No regression detected
- `1`: Regression detected
- `2`: Insufficient baselines or data

### validate

Validate vitals.yaml policy configuration.

**Syntax**:

```bash
vitals validate [options]
```

**Optional Options**:

```bash
--config <path>            Path to vitals.yaml config file
--strict                   Treat warnings as errors (default: false)
--format <format>          Output format: json, pretty (default: "pretty")
```

**Examples**:

```bash
# Validate default policy
vitals validate

# Validate specific file
vitals validate --config ./custom-policy.yaml

# Strict mode
vitals validate --strict

# JSON output
vitals validate --format json
```

**Exit Codes**:

- `0`: Policy is valid
- `1`: Policy has errors (or warnings in strict mode)
- `2`: Unable to load policy file

### incident

Analyze incidents and generate reports.

**Syntax**:

```bash
vitals incident [options]
```

**Required Options**:

```bash
--deployment <deployment>  Deployment identifier
```

**Optional Options**:

```bash
--config <path>            Path to vitals.yaml config file
--prometheus-url <url>     Prometheus server URL
--time-range <range>       Time range for analysis (default: "1h")
--format <format>          Output format: json, pretty (default: "pretty")
--no-color                 Disable colored output
```

**Examples**:

```bash
# Incident analysis
vitals incident --deployment v1.0

# Extended time range
vitals incident \
  --deployment v1.0 \
  --time-range 24h

# JSON output
vitals incident \
  --deployment v1.0 \
  --format json
```

## Configuration Files

### Policy File Location

VITALS searches for policy files in order:

1. `--config` command line option
2. `vitals.yaml` in current directory
3. `vitals.yml` in current directory
4. `.vitals/config.yaml` in current directory

### Policy File Format

**Version 1.0** (Legacy):

```yaml
version: 1.0

prometheus:
  url: https://prometheus.example.com

metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
```

**Version 2.0** (Current):

```yaml
version: 2.0

base:
  prometheus:
    url: https://prometheus.example.com

  metrics:
    latency_p95:
      regression:
        max_increase_percent: 10
        p_value: 0.05
        effect_size: 0.5

services:
  payment-api:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
```

## Environment Variables

### PROMETHEUS_URL

Default Prometheus server URL.

```bash
export PROMETHEUS_URL=https://prometheus.example.com
vitals regress --baseline v1.0 --candidate v1.1
```

Can be overridden with `--prometheus-url` option.

## Output Formats

### Pretty Format (Default)

Human-readable formatted output with colors and tables.

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --format pretty
```

**Example Output**:

```bash
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
```

### JSON Format

Machine-readable JSON output for automation.

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --format json
```

**Example Output**:

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

### Color Output

Disable colored output with `--no-color`:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --no-color
```

## Shell Integration

### Bash Completion

Add to `.bashrc`:

```bash
eval "$(vitals --completion bash)"
```

### Zsh Completion

Add to `.zshrc`:

```bash
eval "$(vitals --completion zsh)"
```

### Command Aliases

Create convenient aliases:

```bash
# ~/.bashrc or ~/.zshrc
alias vr='vitals regress'
alias vb='vitals batch'
alias vv='vitals validate'
alias vh='vitals historical'
```

Usage:

```bash
vr --baseline v1.0 --candidate v1.1
vv --strict
```

## Exit Code Handling

### Bash

```bash
#!/bin/bash

vitals regress --baseline v1.0 --candidate v1.1

case $? in
  0)
    echo "No regression - deploying"
    ./deploy.sh
    ;;
  1)
    echo "Regression detected - blocking"
    exit 1
    ;;
  2)
    echo "Insufficient data - manual review required"
    exit 2
    ;;
esac
```

### Make

```makefile
.PHONY: test-regression
test-regression:
 vitals regress \
  --baseline $(BASELINE) \
  --candidate $(CANDIDATE) \
  --service $(SERVICE)

.PHONY: validate-policy
validate-policy:
 vitals validate --strict
```

## Common Workflows

### CI/CD Pipeline

```bash
#!/bin/bash
set -e

# 1. Validate policy
vitals validate --strict

# 2. Run batch tests
vitals batch \
  --baseline ${BASELINE_VERSION} \
  --candidate ${CANDIDATE_VERSION} \
  --service ${SERVICE_NAME} \
  --fail-fast

# 3. Deploy if passed
if [ $? -eq 0 ]; then
  echo "Tests passed - deploying"
  ./deploy.sh
else
  echo "Tests failed - blocking deployment"
  exit 1
fi
```

### Historical Trend Analysis

```bash
#!/bin/bash

# Get last 7 deployments
BASELINES=$(git tag --sort=-version:refname | head -n 7 | tail -n 6 | tr '\n' ',')
CANDIDATE=$(git tag --sort=-version:refname | head -n 1)

# Compare against historical trend
vitals historical \
  --baselines ${BASELINES%,} \
  --candidate $CANDIDATE \
  --aggregate mean \
  --format json > results.json

# Parse results
VERDICT=$(jq -r '.result.verdict' results.json)

if [ "$VERDICT" = "FAIL" ]; then
  echo "Historical regression detected"
  exit 1
fi
```

### Multi-Service Testing

```bash
#!/bin/bash

SERVICES=("payment-api" "auth-api" "order-api")

for service in "${SERVICES[@]}"; do
  echo "Testing $service..."

  vitals regress \
    --baseline v1.0 \
    --candidate v1.1 \
    --service $service \
    --format json > "${service}-results.json"

  if [ $? -ne 0 ]; then
    echo "$service failed regression test"
    exit 1
  fi
done

echo "All services passed"
```

## Troubleshooting

### Command Not Found

```bash
vitals: command not found
```

**Solution**: Ensure CLI is installed and in PATH:

```bash
npm install -g @vitals/cli
which vitals
```

### Connection Errors

```bash
Error: Unable to connect to Prometheus at http://localhost:9090
```

**Solutions**:

1. Check Prometheus is running:

   ```bash
   curl http://localhost:9090/-/healthy
   ```

2. Set correct URL:

   ```bash
   export PROMETHEUS_URL=http://your-server:9090
   ```

3. Use `--prometheus-url` option:

   ```bash
   vitals regress --prometheus-url http://your-server:9090 ...
   ```

### Insufficient Data

```bash
Insufficient data: baseline=25, candidate=28, required=30
```

**Solutions**:

1. Reduce minimum samples:

   ```bash
   vitals regress --min-samples 20 ...
   ```

2. Increase time range:

   ```bash
   vitals regress --time-range 30m ...
   ```

3. Use permutation test for small samples:

   ```bash
   vitals regress --test permutation ...
   ```

## See Also

- [Policy-as-Code Engine](./cli_policy_engine.md)
- [Regression Testing](./cli_regression_testing.md)
- [Statistical Methods](./cli_statistical_methods.md)
- [CI/CD Integration](./cicd_integration.md)
