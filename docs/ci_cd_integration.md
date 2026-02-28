# CI/CD Integration Guide

Complete guide for integrating VITALS performance regression detection into your CI/CD pipelines.

## Overview

VITALS provides two main integration methods:

1. **GitHub Actions** - Pre-built action for zero-config setup
2. **CLI Tool** - Flexible integration for any CI/CD platform

## GitHub Actions

### Quick Start

```yaml
name: Performance Check
on: [pull_request]

jobs:
  vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: VITALS Regression Check
        uses: vitals-dev/vitals-action@v1
        with:
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          baseline-label: 'prod-baseline'
          candidate-label: 'prod-candidate'
          metrics: 'latency_p95,error_rate,throughput'
```

### Features

- **Automatic PR comments** with formatted results
- **GitHub Checks integration** with annotations
- **Zero configuration** required
- **Built-in caching** for faster runs
- **Configurable thresholds** via inputs or config file

### Full Configuration

```yaml
- name: VITALS Regression Check
  uses: vitals-dev/vitals-action@v1
  with:
    # Required
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    
    # Configuration
    config-file: 'vitals.yaml'           # Default: vitals.yaml
    metrics: 'latency,error_rate'         # Or use config-file
    
    # Thresholds
    threshold: 10                         # Default: 10%
    p-value: 0.05                         # Default: 0.05
    effect-size: 0.5                      # Default: 0.5
    test-type: 'auto'                     # auto, welch, mann-whitney, permutation
    
    # Features
    post-comment: true                    # Default: true
    fail-on-regression: true              # Default: true
    dashboard-url: 'https://grafana.example.com/d/vitals'
    
    # Performance
    cache-enabled: true                   # Default: true
    cache-ttl: 300                        # Default: 300s
```

### Outputs

Use action outputs in subsequent steps:

```yaml
- name: VITALS Check
  id: vitals
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'

- name: Handle Results
  run: |
    echo "Verdict: ${{ steps.vitals.outputs.verdict }}"
    echo "Failed: ${{ steps.vitals.outputs.failed-count }}"
    echo "Warned: ${{ steps.vitals.outputs.warned-count }}"
    echo "Passed: ${{ steps.vitals.outputs.passed-count }}"
```

### Advanced Examples

#### Matrix Strategy

```yaml
jobs:
  vitals:
    strategy:
      matrix:
        service: [api, frontend, worker]
    runs-on: ubuntu-latest
    steps:
      - uses: vitals-dev/vitals-action@v1
        with:
          prometheus-url: ${{ secrets.PROMETHEUS_URL }}
          baseline-label: '${{ matrix.service }}-baseline'
          candidate-label: '${{ matrix.service }}-candidate'
          config-file: 'configs/${{ matrix.service }}.yaml'
```

#### Conditional Rollback

```yaml
- name: VITALS Check
  id: vitals
  uses: vitals-dev/vitals-action@v1
  with:
    prometheus-url: ${{ secrets.PROMETHEUS_URL }}
    baseline-label: 'prod-baseline'
    candidate-label: 'prod-candidate'
    fail-on-regression: false

- name: Rollback on Failure
  if: steps.vitals.outputs.verdict == 'FAIL'
  run: |
    echo "Rolling back deployment..."
    ./rollback.sh
```

## GitLab CI

### Quick Start

```yaml
vitals-check:
  stage: test
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
        --config vitals.yaml
        --post-mr-comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Full Configuration

```yaml
vitals-check:
  stage: test
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  cache:
    key: vitals-cache
    paths:
      - .vitals-cache/
  script:
    - |
      vitals batch regression \
        --config vitals.yaml \
        --prometheus-url $PROMETHEUS_URL \
        --baseline-label "prod-${CI_MERGE_REQUEST_TARGET_BRANCH_SHA}" \
        --candidate-label "prod-${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA}" \
        --post-mr-comment \
        --dashboard-url "https://grafana.example.com/d/vitals" \
        --cache-enabled \
        --cache-ttl 600
  artifacts:
    paths:
      - vitals-results/
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

See [GitLab CI Integration](gitlab_ci_integration.md) for more examples.

## Jenkins

### Declarative Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('VITALS Check') {
            steps {
                script {
                    sh '''
                        npx @vitals/cli batch regression \
                            --config vitals.yaml \
                            --prometheus-url ${PROMETHEUS_URL} \
                            --baseline-label prod-baseline \
                            --candidate-label prod-candidate
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'vitals-results/**'
                    publishHTML([
                        reportDir: 'vitals-results',
                        reportFiles: 'report.html',
                        reportName: 'VITALS Report'
                    ])
                }
            }
        }
    }
}
```

### Scripted Pipeline

```groovy
node {
    stage('Checkout') {
        checkout scm
    }
    
    stage('VITALS Check') {
        try {
            sh '''
                npx @vitals/cli batch regression \
                    --config vitals.yaml \
                    --prometheus-url ${PROMETHEUS_URL} \
                    --baseline-label prod-baseline \
                    --candidate-label prod-candidate
            '''
        } catch (Exception e) {
            currentBuild.result = 'FAILURE'
            error("Performance regression detected")
        } finally {
            archiveArtifacts artifacts: 'vitals-results/**'
        }
    }
}
```

## CircleCI

```yaml
version: 2.1

jobs:
  vitals-check:
    docker:
      - image: node:20
    steps:
      - checkout
      
      - restore_cache:
          keys:
            - vitals-cache-v1-{{ .Branch }}
            - vitals-cache-v1-
      
      - run:
          name: Install VITALS CLI
          command: npm install -g @vitals/cli
      
      - run:
          name: Run Regression Check
          command: |
            vitals batch regression \
              --config vitals.yaml \
              --prometheus-url $PROMETHEUS_URL \
              --baseline-label prod-baseline \
              --candidate-label prod-candidate
      
      - save_cache:
          key: vitals-cache-v1-{{ .Branch }}
          paths:
            - .vitals-cache
      
      - store_artifacts:
          path: vitals-results
      
      - store_test_results:
          path: vitals-results

workflows:
  version: 2
  test:
    jobs:
      - vitals-check
```

## Azure Pipelines

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'
  
  - script: npm install -g @vitals/cli
    displayName: 'Install VITALS CLI'
  
  - script: |
      vitals batch regression \
        --config vitals.yaml \
        --prometheus-url $(PROMETHEUS_URL) \
        --baseline-label prod-baseline \
        --candidate-label prod-candidate
    displayName: 'Run Regression Check'
  
  - task: PublishTestResults@2
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: 'vitals-results/junit-report.xml'
    condition: always()
  
  - task: PublishBuildArtifacts@1
    inputs:
      pathToPublish: 'vitals-results'
      artifactName: 'vitals-results'
    condition: always()
```

## Configuration File

Create `vitals.yaml` for consistent configuration across CI/CD platforms:

```yaml
version: 2

prometheus:
  url: "${PROMETHEUS_URL}"
  cache:
    enabled: true
    ttl: 300

metrics:
  http_request_duration_p95:
    query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{deployment="{{label}}"}[5m]))'
    regression:
      max_increase_percent: 15
      p_value: 0.05
      effect_size: 0.5
      test_type: auto
    preprocessing:
      outlier_detection:
        method: iqr
        multiplier: 1.5
      smoothing:
        method: ewma
        window: 5

  error_rate:
    query: 'rate(http_requests_total{deployment="{{label}}", status=~"5.."}[5m])'
    threshold:
      max: 0.02
    preprocessing:
      outlier_detection:
        method: zscore
        threshold: 3.0

  throughput:
    query: 'rate(http_requests_total{deployment="{{label}}"}[5m])'
    regression:
      max_decrease_percent: 10
      p_value: 0.05
      effect_size: 0.5
```

## Environment Variables

### Required

- `PROMETHEUS_URL` - Prometheus server URL

### Optional (GitHub)

- `GITHUB_TOKEN` - GitHub token (auto-provided in Actions)
- `GITHUB_REPOSITORY` - Repository name (auto-provided)
- `GITHUB_PR_NUMBER` - PR number (auto-provided)

### Optional (GitLab)

- `GITLAB_TOKEN` - GitLab token
- `CI_PROJECT_ID` - Project ID (auto-provided)
- `CI_MERGE_REQUEST_IID` - MR number (auto-provided)

### Optional (General)

- `VITALS_DASHBOARD_URL` - Dashboard URL for comments
- `VITALS_CACHE_DIR` - Cache directory (default: `.vitals-cache`)

## PR/MR Comments

### GitHub

Automatic PR comments are posted when using the GitHub Action or CLI with `--post-pr-comment`:

```markdown
## ❌ VITALS Regressions Detected

### Summary
- ✅ Passed: 3
- ❌ Failed: 1
- ⚠️ Warned: 1

### ❌ Failed Metrics
| Metric | Change | p-value | Effect Size |
|--------|--------|---------|-------------|
| latency_p95 | +18.5% | 0.023 | 0.72 |
```

### GitLab

```markdown
## :x: VITALS Regressions Detected

### Summary
- :white_check_mark: Passed: 3
- :x: Failed: 1
- :warning: Warned: 1

### :x: Failed Metrics
| Metric | Change | p-value | Effect Size |
|--------|--------|---------|-------------|
| latency_p95 | +18.5% | 0.023 | 0.72 |
```

## Caching

Enable caching for faster runs:

### GitHub Actions

```yaml
- uses: actions/cache@v4
  with:
    path: .vitals-cache
    key: vitals-cache-${{ runner.os }}

- uses: vitals-dev/vitals-action@v1
  with:
    cache-enabled: true
    cache-ttl: 600
```

### GitLab CI

```yaml
cache:
  key: vitals-cache-${CI_PROJECT_ID}
  paths:
    - .vitals-cache/

script:
  - vitals batch regression --cache-enabled --cache-ttl 600
```

## Best Practices

1. **Use configuration files** for consistent settings across platforms
2. **Enable caching** to reduce Prometheus load and speed up checks
3. **Set appropriate thresholds** based on your service's characteristics
4. **Run in PR/MR pipelines** to catch regressions early
5. **Save artifacts** for debugging and historical analysis
6. **Use matrix strategies** for multi-service architectures
7. **Implement auto-rollback** for production deployments
8. **Monitor VITALS checks** alongside your regular tests

## Troubleshooting

### Comments Not Posted

- **GitHub**: Ensure workflow has `pull-requests: write` permission
- **GitLab**: Set `GITLAB_TOKEN` with `api` scope

### Metrics Not Found

- Verify Prometheus labels match your deployment labels
- Check Prometheus connectivity from CI runner
- Test queries manually in Prometheus UI

### False Positives

- Adjust `p-value` and `effect-size` thresholds
- Enable preprocessing (outlier detection, smoothing)
- Use longer time windows in queries
- Consider different statistical tests

### Cache Issues

- Check cache directory permissions
- Verify cache key uniqueness per branch/PR
- Monitor cache size and set appropriate TTL

## Support

- [Documentation](https://theaniketraj.github.io/vitals)
- [GitHub Issues](https://github.com/theaniketraj/vitals/issues)
- [Discussions](https://github.com/theaniketraj/vitals/discussions)
