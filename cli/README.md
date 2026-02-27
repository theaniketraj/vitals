# VITALS CLI

Command-line interface for VITALS - Performance decision engine for CI/CD pipelines.

## Installation

### From Source

```bash
cd cli
npm install
npm run build
npm link
```

### From npm (coming soon)

```bash
npm install -g vitals-cli
```

## Quick Start

```bash
# Check version
vitals --version

# Get help
vitals --help

# Detect regression between deployments
vitals regress \
  --baseline=v1.0.0 \
  --candidate=v1.1.0 \
  --metric=latency_p95

# Compare two time windows
vitals compare \
  --service=api \
  --before-start=-1h \
  --before-end=-30m \
  --after-start=-30m \
  --after-end=now

# Analyze current state
vitals analyze --service=api --metric=latency_p95
```

## Commands

### `vitals regress`

Detect performance regressions between two deployments using statistical analysis.

**Options:**

- `--baseline <deployment>` - Baseline deployment label (required)
- `--candidate <deployment>` - Candidate deployment label (required)
- `--metric <metric>` - Metric to analyze (default: `latency_p95`)
- `--prometheus-url <url>` - Prometheus server URL (default: `http://localhost:9090`)
- `--threshold <percent>` - Regression threshold percentage (default: `10`)
- `--pvalue <value>` - Statistical significance (default: `0.05`)
- `--effect-size <value>` - Minimum effect size (Cohen's d) (default: `0.5`)
- `--min-samples <count>` - Minimum sample size (default: `30`)
- `--time-range <range>` - Time window for metrics (default: `10m`)
- `--format <format>` - Output format: `json` or `pretty` (default: `pretty`)

**Exit Codes:**

- `0` - No regression detected (PASS)
- `1` - Regression detected (FAIL)
- `2` - Error (e.g., insufficient data, connection failure)

**Example:**

```bash
vitals regress \
  --baseline=production-v1 \
  --candidate=production-v2 \
  --metric=latency_p95 \
  --threshold=15 \
  --pvalue=0.05 \
  --format=json
```

**Output (JSON):**

```json
{
  "verdict": "FAIL",
  "metric": "latency_p95",
  "baseline": {
    "mean": 180.5,
    "stddev": 25.3,
    "samples": 45
  },
  "candidate": {
    "mean": 225.8,
    "stddev": 32.1,
    "samples": 47
  },
  "analysis": {
    "change_percent": 25.1,
    "p_value": 0.03,
    "effect_size": 0.72,
    "significant": true
  }
}
```

---

### `vitals analyze`

Analyze current system state from real-time metrics.

**Options:**

- `--service <service>` - Service name to analyze
- `--metric <metric>` - Metric to query (default: `latency_p95`)
- `--prometheus-url <url>` - Prometheus server URL
- `--window <range>` - Time window (default: `5m`)
- `--format <format>` - Output format: `json` or `pretty`

**Example:**

```bash
vitals analyze --service=checkout --metric=error_rate --window=10m
```

---

### `vitals compare`

Compare two time windows for metric differences (useful for before/after analysis).

**Options:**

- `--service <service>` - Service name
- `--metric <metric>` - Metric to compare (default: `latency_p95`)
- `--before-start <time>` - Baseline window start (relative or RFC3339)
- `--before-end <time>` - Baseline window end
- `--after-start <time>` - Comparison window start
- `--after-end <time>` - Comparison window end
- `--prometheus-url <url>` - Prometheus server URL
- `--format <format>` - Output format

**Example:**

```bash
vitals compare \
  --service=api \
  --metric=cpu_usage \
  --before-start='2024-02-01T10:00:00Z' \
  --before-end='2024-02-01T10:30:00Z' \
  --after-start='2024-02-01T11:00:00Z' \
  --after-end='2024-02-01T11:30:00Z'
```

---

### `vitals incident`

Analyze incident impact and generate reports.

**Options:**

- `--service <service>` - Service name
- `--start <time>` - Incident start time
- `--end <time>` - Incident end time (default: now)
- `--prometheus-url <url>` - Prometheus server URL
- `--format <format>` - Output format

**Example:**

```bash
vitals incident \
  --service=database \
  --start='2024-02-01T12:30:00Z' \
  --format=json
```

---

## Configuration File

Create a `vitals.yaml` file to define policies and defaults:

```yaml
version: 1

prometheus:
  url: http://localhost:9090
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

deployment:
  rollback:
    enabled: true
    strategy: canary
```

Use the config file:

```bash
vitals regress --config=vitals.yaml --baseline=v1 --candidate=v2
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: VITALS Regression Check

on:
  pull_request:
    branches: [main]

jobs:
  vitals:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install VITALS CLI
        run: npm install -g vitals-cli
      
      - name: Run Regression Analysis
        env:
          PROMETHEUS_URL: ${{ secrets.PROMETHEUS_URL }}
        run: |
          vitals regress \
            --baseline=${{ github.event.pull_request.base.sha }} \
            --candidate=${{ github.event.pull_request.head.sha }} \
            --format=json > vitals-report.json
      
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: vitals-report
          path: vitals-report.json
```

### GitLab CI

```yaml
vitals-check:
  stage: test
  image: node:20
  script:
    - npm install -g vitals-cli
    - vitals regress --baseline=$CI_COMMIT_BEFORE_SHA --candidate=$CI_COMMIT_SHA
  only:
    - merge_requests
```

### Jenkins

```groovy
pipeline {
    agent any
    
    stages {
        stage('VITALS Check') {
            steps {
                sh 'npm install -g vitals-cli'
                sh '''
                    vitals regress \
                        --baseline=${GIT_PREVIOUS_COMMIT} \
                        --candidate=${GIT_COMMIT} \
                        --format=json > vitals-report.json
                '''
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'vitals-report.json'
        }
    }
}
```

---

## Statistical Methods

VITALS uses rigorous statistical analysis to detect regressions:

### Welch's t-test

Used to determine if two samples have significantly different means.

- Null hypothesis: No difference between baseline and candidate
- Rejects null if p-value < threshold (default: 0.05)

### Cohen's d (Effect Size)

Measures the practical significance of a difference.

- Small effect: d = 0.2
- Medium effect: d = 0.5
- Large effect: d = 0.8

### Decision Logic

A regression is considered significant when:

1. Change exceeds threshold (e.g., +10%)
2. p-value < 0.05 (statistically significant)
3. Effect size > 0.5 (practically meaningful)

All three conditions must be met to fail the build.

---

## Advanced Usage

### Batch Analysis

Analyze multiple metrics at once:

```bash
for metric in latency_p95 error_rate cpu_usage; do
  vitals regress \
    --baseline=v1 \
    --candidate=v2 \
    --metric=$metric \
    --format=json | jq -r '.verdict'
done
```

### Custom Thresholds per Metric

```bash
# Strict threshold for latency
vitals regress --metric=latency_p95 --threshold=5

# Relaxed threshold for CPU
vitals regress --metric=cpu_usage --threshold=20
```

### Integration with Slack

```bash
RESULT=$(vitals regress --baseline=v1 --candidate=v2 --format=json)
if [ $? -eq 1 ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"Regression detected: $RESULT\"}"
fi
```

---

## Troubleshooting

### Insufficient Data

**Error:** `Insufficient data: baseline=12 samples (min: 30)`

**Solution:** Increase `--time-range` or wait for more data:

```bash
vitals regress --baseline=v1 --candidate=v2 --time-range=30m
```

### Connection Timeout

**Error:** `Failed to fetch metrics: timeout of 10000ms exceeded`

**Solution:** Increase timeout or check Prometheus connectivity:

```bash
vitals regress --prometheus-url=http://prometheus:9090
```

### No Data Found

**Error:** `No data found for deployment label: v1.0.0`

**Solution:** Verify the label exists in Prometheus:

```bash
# Check available labels
curl 'http://localhost:9090/api/v1/label/deployment/values'
```

---

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

---

## Architecture

```bash
CLI Interface (Commander.js)
        ↓
Command Handlers
        ↓
Core Engine
    ├── Regression Analysis
    ├── Statistical Tests ('Welch', 'Cohens d')
    ├── Data Normalization
    └── Outlier Removal
        ↓
Services Layer
    ├── Prometheus Client
    ├── Config Loader
    └── Cache Manager
```

---

## Roadmap

- [ ] Policy engine with `vitals.yaml`
- [ ] Auto-remediation hooks
- [ ] Historical learning
- [ ] PR comment integration
- [ ] Multi-source support (Grafana, Datadog)
- [ ] Cost analysis tracking

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the main project.

## License

MIT - See [LICENSE](../LICENSE)
