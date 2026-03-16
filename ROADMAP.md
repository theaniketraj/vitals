# VITALS Roadmap: From Extension to Infrastructure

This document outlines the strategic features needed to evolve VITALS from a VS Code extension into critical infrastructure for performance and reliability enforcement.

## Current State

VITALS currently provides:

- ✅ Detection (metrics, tracing, regression analysis)
- ✅ Visualization (charts, logs, flame graphs)
- ✅ Suggestions (rollback recommendations)

## Strategic Gaps

To become mission-critical infrastructure, VITALS needs:

- ❌ **Enforcement** - ability to block deployments
- ❌ **System-wide impact** - works beyond the IDE
- ❌ **Non-IDE dependency** - functions independently of VS Code

---

## Phase 5: Source of Truth

### 5.1 VITALS-Owned Data

**Unique Capabilities:**

- Regression analysis engine (statistical validation)
- Cross-source correlation (metrics + traces + logs + incidents)
- Incident knowledge graph
- Deployment impact database

**Storage:**

- Time-series DB for regression history
- Graph DB for service dependencies
- Document store for incident context

---

## Architectural Principles

### Data Flow (Target Architecture)

```
Prometheus / OpenTelemetry / Loki
            ↓
    VITALS Core Engine (CLI)
            ↓
    CI/CD Pipeline Gate
            ↓
    PR / Deployment Decision
            ↓
    VS Code (premium interface)
```

**Key Insight:** VS Code becomes a client, not the product core.

---

## Positioning Shift

### Before
>
> "Observability inside VS Code"

### After
>
> "VITALS is a pre-CI and in-CI decision engine that detects, validates, and enforces performance and reliability regressions before they hit production."

---

## Implementation Status

### ✅ Phase 1: CLI Foundation - COMPLETED

1. ✅ Build `vitals regress` CLI with exit codes
2. ✅ Implement YAML config loader
3. ✅ Add statistical rigor (outlier removal, effect size)
4. ✅ Enhanced preprocessing module with multiple algorithms
5. ✅ Performance caching layer
6. ✅ Batch processing engine

### ✅ Phase 2: Policy Engine - COMPLETED

1. ✅ Multi-metric batch analysis (via CLI)
2. ✅ Policy evaluation engine
3. ✅ Statistical validation framework
4. ✅ Usage statistics tracking

### ✅ Phase 3: CI/CD Integration - COMPLETED

1. ✅ GitHub Action wrapper
2. ✅ GitLab CI support
3. ✅ PR comment integration
4. ✅ Deployment gate functionality

### ✅ Phase 4: Intelligence Layer - COMPLETED

1. ✅ Closed-loop automation framework
   - Policy engine with condition evaluation
   - Action executors (Slack, PagerDuty, webhooks, rollback)
   - Throttling and priority management
   
2. ✅ Historical learning
   - JSONL-based storage system
   - Pattern detection (time-based, trends)
   - Predictive analytics (risk assessment, forecasting)
   - Deployment window recommendations

### 🔄 Phase 5: VITALS-Owned Data - IN PROGRESS

1. ✅ Regression database (structured storage)
2. ✅ Incident knowledge graph
3. ✅ Service dependency mapping
4. ✅ Cross-source correlation (core module + CLI correlation commands)
5. 🟡 Time-series DB integration
   - ✅ File-based adapter
   - ⏳ InfluxDB / TimescaleDB / Prometheus production adapters
6. ⏳ Advanced ML models (ARIMA, Random Forest)
7. 🟡 CLI integration
   - ✅ `vitals data regressions ...`
   - ✅ `vitals data incidents ...`
   - ✅ `vitals data dependencies ...`
   - ✅ `vitals data correlate ...`
   - ⏳ deeper integration into existing regress/historical workflows

### 🔮 Future Enhancements

1. VS Code extension enhancements
2. Advanced policy rules (composition, inheritance)
3. Root cause analysis automation
4. Feature flag correlation
5. Cost impact analysis
6. Cost tracking integration
7. Multi-cloud support

---

## Success Metrics

### Adoption Metrics

- CLI downloads per month
- Active CI integrations
- Policy files in production

### Impact Metrics

- Regressions caught before production
- False positive rate < 5%
- MTTR reduction for teams using VITALS

### Developer Experience

- Time saved per week (context switching)
- Build failure clarity (understandable verdicts)
- Rollback decision confidence

---

## Technical Debt to Address

### Remove or De-emphasize

- ❌ Heavy focus on "theme-aware UI"
- ❌ "Keyboard navigation" as a selling point
- ❌ VS Code notifications as core feature

These signal "polished extension" rather than "critical infrastructure."

### Emphasize Instead

- ✅ Statistical validity
- ✅ CI enforcement
- ✅ Policy-driven decisions
- ✅ Reproducible outcomes

---

## Open Questions

1. **Multi-tenancy:** How to support org-wide policies vs team-specific overrides?
2. **Data retention:** How long to store regression history?
3. **Pricing model:** Free CLI + paid cloud features?
4. **Certification:** SOC2, HIPAA compliance for enterprise?

---

## References

- Statistical Methods: Welch's t-test, Cohen's d, IQR outlier detection
- Integration Standards: GitHub Actions, GitLab CI, Jenkins pipelines
- Policy Languages: YAML schema v1, future: OPA/Rego support
- Data Sources: Prometheus, OpenTelemetry, Loki, Jaeger

---

## Conclusion

The path from "nice extension" to "critical infrastructure":

1. **Build CLI** (editor independence)
2. **Add enforcement** (CI integration)
3. **Policy engine** (team adoption)
4. **PR integration** (visibility)
5. **Intelligence layer** (predictive value)

This transforms VITALS from a dashboard into a **decision engine**.
