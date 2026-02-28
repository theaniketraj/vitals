# GitLab CI Integration Examples

Examples of integrating VITALS performance regression detection in GitLab CI/CD pipelines.

## Basic Setup

### Simple Regression Check

```yaml
# .gitlab-ci.yml
stages:
  - test
  - performance

vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --prometheus-url $PROMETHEUS_URL
      --post-mr-comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### With Configuration File

Create `vitals.yaml`:

```yaml
version: 2

prometheus:
  url: "${PROMETHEUS_URL}"
  cache:
    enabled: true
    ttl: 300

metrics:
  http_requests_total:
    query: 'rate(http_requests_total{deployment="{{label}}"}[5m])'
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
      test_type: auto

  http_request_duration_p95:
    query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{deployment="{{label}}"}[5m]))'
    regression:
      max_increase_percent: 15
      p_value: 0.05
      effect_size: 0.5

  error_rate:
    query: 'rate(http_requests_total{deployment="{{label}}", status=~"5.."}[5m]) / rate(http_requests_total{deployment="{{label}}"}[5m])'
    threshold:
      max: 0.02
```

Pipeline:

```yaml
vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --baseline-label "prod-${CI_MERGE_REQUEST_TARGET_BRANCH_SHA}"
      --candidate-label "prod-${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA}"
      --post-mr-comment
  artifacts:
    reports:
      junit: vitals-results/junit-report.xml
    paths:
      - vitals-results/
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Advanced Examples

### Multi-Service Pipeline

```yaml
stages:
  - test
  - performance
  - decision

variables:
  PROMETHEUS_URL: "https://prometheus.example.com"

# Service-specific checks
.vitals-template:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config configs/${SERVICE}-vitals.yaml
      --baseline-label "${SERVICE}-baseline"
      --candidate-label "${SERVICE}-candidate"
      --post-mr-comment
      --dashboard-url "https://grafana.example.com/d/${SERVICE}"
  artifacts:
    paths:
      - vitals-results/
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

vitals-api:
  extends: .vitals-template
  variables:
    SERVICE: "api"

vitals-frontend:
  extends: .vitals-template
  variables:
    SERVICE: "frontend"

vitals-worker:
  extends: .vitals-template
  variables:
    SERVICE: "worker"

# Decision job
vitals-gate:
  stage: decision
  image: alpine:latest
  script:
    - echo "Checking VITALS results..."
    - |
      if grep -q "FAIL" vitals-results/summary.txt; then
        echo "Performance regression detected!"
        exit 1
      fi
  needs:
    - vitals-api
    - vitals-frontend
    - vitals-worker
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### With Caching

```yaml
vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  cache:
    key: vitals-cache-${CI_PROJECT_ID}
    paths:
      - .vitals-cache/
  script:
    - vitals batch regression
      --config vitals.yaml
      --prometheus-url $PROMETHEUS_URL
      --cache-enabled
      --cache-ttl 600
      --post-mr-comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### With Auto-Rollback

```yaml
stages:
  - test
  - deploy
  - performance
  - rollback

deploy-staging:
  stage: deploy
  script:
    - ./deploy.sh staging
  environment:
    name: staging
    url: https://staging.example.com
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --baseline-label "prod-baseline"
      --candidate-label "staging-${CI_COMMIT_SHA}"
      --post-mr-comment
  artifacts:
    paths:
      - vitals-results/
    when: always
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

auto-rollback:
  stage: rollback
  script:
    - echo "Performance regression detected, rolling back..."
    - ./rollback.sh staging
  environment:
    name: staging
    action: rollback
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: on_failure
  needs:
    - vitals-check
```

### Conditional Deployment

```yaml
stages:
  - test
  - performance
  - deploy-prod

vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --baseline-label "prod-current"
      --candidate-label "staging-${CI_COMMIT_SHA}"
      --post-mr-comment
      --fail-on-regression false
  artifacts:
    paths:
      - vitals-results/
    reports:
      dotenv: vitals-results/verdict.env
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-production:
  stage: deploy-prod
  script:
    - ./deploy.sh production
  environment:
    name: production
    url: https://example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $VITALS_VERDICT == "PASS"
  needs:
    - vitals-check
```

### With Manual Approval

```yaml
vitals-check:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --post-mr-comment
  artifacts:
    paths:
      - vitals-results/
  allow_failure: true
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

approve-deployment:
  stage: performance
  script:
    - echo "Waiting for manual approval..."
  when: manual
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  needs:
    - vitals-check
```

### Parallel Checks with Different Configurations

```yaml
vitals-strict:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --threshold 5
      --p-value 0.01
      --effect-size 0.8
      --post-mr-comment
  allow_failure: true
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

vitals-normal:
  stage: performance
  image: node:20
  before_script:
    - npm install -g @vitals/cli
  script:
    - vitals batch regression
      --config vitals.yaml
      --threshold 10
      --p-value 0.05
      --effect-size 0.5
      --post-mr-comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Environment Variables

Required variables (set in GitLab CI/CD Settings → Variables):

```bash
PROMETHEUS_URL = https://prometheus.example.com
GITLAB_TOKEN = glpat-xxxxxxxxxxxxxxxxxxxx  # For posting MR notes
```

Optional variables:

```bash
VITALS_THRESHOLD = 10
VITALS_P_VALUE = 0.05
VITALS_EFFECT_SIZE = 0.5
VITALS_DASHBOARD_URL = https://grafana.example.com/d/vitals
```

## Auto-detected Variables

VITALS automatically detects these GitLab CI variables:

- `CI_PROJECT_ID` - Project ID
- `CI_MERGE_REQUEST_IID` - MR number
- `CI_MERGE_REQUEST_PROJECT_ID` - MR project ID
- `CI_PROJECT_URL` - Project URL
- `CI_COMMIT_SHA` - Commit SHA
- `GITLAB_TOKEN` or `CI_JOB_TOKEN` - Authentication token

## MR Comment Example

When regressions are detected, VITALS posts a note like this:

```markdown
## :x: VITALS Regressions Detected

### Summary

- :white_check_mark: Passed: 3
- :x: Failed: 1
- :warning: Warned: 1
- :hourglass: Duration: 2.34s

### :x: Failed Metrics

| Metric                    | Change | p-value | Effect Size | Verdict |
| ------------------------- | ------ | ------- | ----------- | ------- |
| http_request_duration_p95 | +18.5% | 0.023   | 0.72        | FAIL    |

### :warning: Warned Metrics

| Metric     | Change | p-value | Effect Size | Verdict |
| ---------- | ------ | ------- | ----------- | ------- |
| error_rate | +6.2%  | 0.041   | 0.45        | WARN    |

### :arrows_counterclockwise: Suggested Action

**Consider rolling back** this deployment.

[:bar_chart: View Dashboard](https://grafana.example.com/d/vitals)
```

## Troubleshooting

### MR Notes Not Posted

Ensure `GITLAB_TOKEN` is set with `api` scope:

```yaml
script:
  - export GITLAB_TOKEN=$GITLAB_ACCESS_TOKEN
  - vitals batch regression --post-mr-comment
```

### Cache Not Working

Check cache configuration:

```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - .vitals-cache/
```

### Pipeline Status Not Updated

Enable pipeline status updates:

```yaml
script:
  - vitals batch regression
    --post-mr-comment
    --update-pipeline-status
```

## Best Practices

1. **Use Protected Variables** for sensitive data like `PROMETHEUS_URL`
2. **Cache Prometheus data** for faster pipeline runs
3. **Run in MR pipelines only** to avoid unnecessary checks
4. **Save artifacts** for debugging and historical analysis
5. **Set appropriate thresholds** based on your service's characteristics
6. **Use manual approval** for production deployments with regressions

## Links

- [VITALS Documentation](https://theaniketraj.github.io/vitals)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [Prometheus Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
