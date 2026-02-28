---
title: Policy-as-Code Engine
description: Configure and enforce performance policies for CI/CD pipelines using YAML-based policy definitions with service-specific overrides.
head:
  - - meta
    - name: keywords
      content: policy engine, policy-as-code, performance policies, CI/CD enforcement, service-specific policies, policy inheritance
---

# Policy-as-Code Engine

## Overview

The VITALS Policy-as-Code Engine enables teams to define, enforce, and manage performance policies using declarative YAML configuration files. Policies control regression detection thresholds, deployment strategies, and automated rollback decisions across your entire infrastructure.

## Philosophy

Policy-as-Code brings the same benefits to performance management that Infrastructure-as-Code brings to infrastructure:

- **Version Control**: Track policy changes over time
- **Code Review**: Review and approve policy changes before deployment
- **Reusability**: Define policies once, apply everywhere
- **Testability**: Validate policies before they reach production

## Policy Structure

### Version 1.0 (Legacy)

The original policy format supports global metric definitions:

```yaml
version: 1.0

prometheus:
  url: https://prometheus.example.com

deployment:
  auto_rollback: true

metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
```

### Version 2.0 (Current)

Version 2.0 introduces service-specific policies and inheritance:

```yaml
version: 2.0

base:
  prometheus:
    url: https://prometheus.example.com

  deployment:
    auto_rollback: true

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

## Configuration Sections

### Prometheus Configuration

Configure the Prometheus server connection:

```yaml
prometheus:
  url: https://prometheus.example.com
  timeout: 30s
```

**Options**:

- `url` (string, required): Prometheus server URL
- `timeout` (string, optional): Query timeout duration

### Deployment Configuration

Control deployment and rollback behavior:

```yaml
deployment:
  auto_rollback: true
  notification_channels:
    - slack
    - email
    - pagerduty
```

**Options**:

- `auto_rollback` (boolean): Enable automatic rollback on regression detection
- `notification_channels` (array): Notification channels for deployment events

### Metric Policies

Define performance policies for individual metrics:

```yaml
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
      p_value: 0.05
      effect_size: 0.5
    threshold:
      max_allowed: 500
      warn_threshold: 400
      critical: true
    actions:
      on_regression: fail
      on_threshold: warn
```

#### Regression Policy

Controls regression detection behavior:

- `max_increase_percent` (number): Maximum allowed percentage increase
- `p_value` (number, 0-1): Statistical significance threshold
- `effect_size` (number): Minimum effect size (Cohen's d)

#### Threshold Policy

Defines absolute value thresholds:

- `max_allowed` (number): Maximum absolute value
- `warn_threshold` (number): Warning threshold
- `critical` (boolean): Mark metric as critical

#### Action Policy

Specifies actions to take on policy violations:

- `on_regression` (string): Action on regression detection (fail, warn, continue)
- `on_threshold` (string): Action on threshold breach (fail, warn, continue)

## Service-Specific Policies

### Basic Service Override

Override base policies for specific services:

```yaml
version: 2.0

base:
  metrics:
    latency_p95:
      regression:
        max_increase_percent: 10

services:
  payment-service:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5

  experimental-api:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 20
```

### Policy Inheritance

Reuse common policy definitions using inheritance:

```yaml
version: 2.0

base:
  metrics:
    latency_p95:
      regression:
        max_increase_percent: 10

services:
  critical-profile:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
          p_value: 0.01
      error_rate:
        threshold:
          max_allowed: 0.01

  payment-api:
    inherits: critical-profile

  auth-api:
    inherits: critical-profile

  order-api:
    inherits: critical-profile
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 8
```

**Inheritance Rules**:

1. Child policies override parent settings
2. Multiple levels of inheritance supported
3. Circular dependencies are detected and rejected
4. Metrics are merged (child completely overrides parent metric)

### Multiple Inheritance Levels

```yaml
services:
  base-profile:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 10

  critical-profile:
    inherits: base-profile
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5

  payment-api:
    inherits: critical-profile
    prometheus:
      url: https://payment-prometheus.example.com
```

Resolution order: `payment-api -> critical-profile -> base-profile -> base`

## Policy Validation

### Command Line Validation

Validate policy files before deployment:

```bash
# Validate default policy file
vitals validate

# Validate specific file
vitals validate --config ./custom-policy.yaml

# Strict mode (warnings as errors)
vitals validate --strict

# JSON output for CI integration
vitals validate --format json
```

### Validation Checks

The validator performs comprehensive checks:

**Syntax Validation**:

- Valid YAML structure
- Required fields present
- Correct data types

**Semantic Validation**:

- Version compatibility
- p-value in range [0, 1]
- Positive threshold percentages
- Valid Prometheus URLs
- No circular inheritance
- Valid action types
- Consistent metric definitions

### Validation Output

**Pretty Format**:

```bash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Validation Result: VALID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Policy Version:      2.0
  Validation Status:   PASSED
  Errors:              0
  Warnings:            1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Warnings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Service 'experimental-api' has lenient p_value (0.10)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Policy Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Base Metrics:           3 (latency_p95, error_rate, throughput)
  Services:               2 (payment-api, experimental-api)
  Inheritance Chains:     1

  payment-api -> critical-profile -> base
```

**JSON Format**:

```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "message": "Service 'experimental-api' has lenient p_value (0.10)",
      "severity": "warning"
    }
  ],
  "summary": {
    "version": "2.0",
    "baseMetrics": 3,
    "services": 2,
    "inheritanceChains": 1
  }
}
```

### Exit Codes

- `0`: Policy is valid
- `1`: Policy has errors (or warnings in strict mode)
- `2`: Unable to load policy file

## Policy Discovery

The CLI automatically discovers policy files in the following order:

1. `--config` command line option
2. `vitals.yaml` in current directory
3. `vitals.yml` in current directory
4. `.vitals/config.yaml` in current directory
5. Default configuration (if none found)

## Common Patterns

### Multi-Tenant SaaS

Different policies for different customer tiers:

```yaml
version: 2.0

services:
  enterprise-tenant:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
          p_value: 0.01
      error_rate:
        threshold:
          max_allowed: 0.01

  standard-tenant:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 10
          p_value: 0.05

  free-tenant:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 20
          p_value: 0.10
```

### Microservices Architecture

Reusable profiles for service categories:

```yaml
version: 2.0

services:
  critical-services:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
      error_rate:
        threshold:
          max_allowed: 0.01
          critical: true

  payment-api:
    inherits: critical-services

  auth-api:
    inherits: critical-services

  analytics-worker:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 20
```

### Environment-Based Policies

Different policies per environment:

```yaml
version: 2.0

services:
  production:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 3
          p_value: 0.01
    deployment:
      auto_rollback: true

  staging:
    inherits: production
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 10

  development:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 50
          p_value: 0.10
    deployment:
      auto_rollback: false
```

## Policy Evaluation

### Regression Evaluation

When running regression analysis, the policy engine evaluates results:

```bash
vitals regress \
  --baseline v1.0 \
  --candidate v1.1 \
  --metric latency_p95 \
  --service payment-api
```

**Evaluation Logic**:

1. Load policy configuration
2. Resolve service-specific policy (with inheritance)
3. Run statistical analysis
4. Compare results against policy thresholds
5. Determine action (fail, warn, pass)
6. Return verdict with policy context

### Batch Evaluation

Evaluate multiple metrics simultaneously:

```bash
vitals batch \
  --baseline v1.0 \
  --candidate v1.1 \
  --service production
```

**Behavior**:

- Evaluates all metrics defined in policy
- Aggregates results across metrics
- Fails if any metric fails policy
- Supports `--fail-fast` to stop on first failure

## Best Practices

### Policy Organization

**Do**: Create reusable profiles

```yaml
services:
  critical-profile:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5

  payment-api:
    inherits: critical-profile
```

**Don't**: Duplicate policy definitions

```yaml
services:
  payment-api:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5

  auth-api:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 5
```

### Version Control

Store policies in version control:

```bash
.
├── vitals.yaml              # Production policy
├── vitals-staging.yaml      # Staging policy
└── .vitals/
    ├── critical.yaml        # Critical service profile
    └── experimental.yaml    # Experimental service profile
```

### Testing Policies

Test policy changes before production:

```bash
# Validate syntax
vitals validate --config vitals-staging.yaml --strict

# Test against staging data
vitals regress \
  --baseline staging-v1 \
  --candidate staging-v2 \
  --config vitals-staging.yaml

# Promote to production after validation
cp vitals-staging.yaml vitals.yaml
```

### Gradual Rollout

Implement policies gradually:

**Phase 1**: Start with warnings

```yaml
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
    actions:
      on_regression: warn
```

**Phase 2**: Enable blocking after baseline established

```yaml
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
    actions:
      on_regression: fail
```

## Troubleshooting

### Circular Inheritance Detected

**Error**:

```bash
Circular inheritance detected: service-a -> service-b -> service-a
```

**Solution**: Remove circular dependency in inheritance chain.

### Invalid p-value Range

**Error**:

```bash
p_value must be between 0 and 1, got: 1.5
```

**Solution**: Use valid p-value in range [0, 1]:

```yaml
metrics:
  latency_p95:
    regression:
      p_value: 0.05
```

### Service Not Found

**Error**:

```bash
Service 'payment-api' not found in policy configuration
```

**Solution**: Either:

1. Add service to policy configuration, or
2. Remove `--service` flag to use base policy

### Missing Metrics

**Warning**:

```bash
No metrics defined for service 'analytics-worker'
```

**Solution**: Define metrics in service or base policy:

```yaml
services:
  analytics-worker:
    metrics:
      latency_p95:
        regression:
          max_increase_percent: 20
```

## Migration Guide

### From Version 1.0 to 2.0

**Before (v1.0)**:

```yaml
version: 1.0
prometheus:
  url: https://prometheus.example.com
metrics:
  latency_p95:
    regression:
      max_increase_percent: 10
```

**After (v2.0)**:

```yaml
version: 2.0

base:
  prometheus:
    url: https://prometheus.example.com
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

**Note**: Version 1.0 configs continue to work without changes. Version 2.0 is optional for users who need service-specific policies.

## Reference

### Policy Schema

Complete policy schema reference:

```yaml
version: string # 1.0 or 2.0

# Version 1.0 structure
prometheus: # Optional
  url: string
  timeout: string

deployment: # Optional
  auto_rollback: boolean
  notification_channels: string[]

metrics: # Optional
  [metric_name]:
    regression:
      max_increase_percent: number
      p_value: number # 0-1
      effect_size: number
    threshold:
      max_allowed: number
      warn_threshold: number
      critical: boolean
    actions:
      on_regression: string # fail|warn|continue
      on_threshold: string # fail|warn|continue

# Version 2.0 structure
base: # Optional
  prometheus: ... # Same as v1.0
  deployment: ... # Same as v1.0
  metrics: ... # Same as v1.0

services: # Optional
  [service_name]:
    inherits: string # Optional parent service
    prometheus: ... # Override base
    deployment: ... # Override base
    metrics: ... # Override/extend base
```

## See Also

- [CLI Regression Testing](./cli_regression_testing.md)
- [CI/CD Integration](./cicd_integration.md)
- [CLI Reference](./cli_reference.md)
