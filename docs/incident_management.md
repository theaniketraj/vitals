# Incident Management

Vitals provides comprehensive incident management capabilities to help teams detect, investigate, resolve, and learn from production incidents—all within VS Code.

## Overview

The Incident Management system enables collaborative debugging workflows, automated remediation, and post-incident analysis without leaving your development environment.

## Key Features

### 1. Incident Detection & Declaration

Create incidents manually or automatically when anomalies are detected:

```typescript
// Incidents can be created from:
// - Manual declaration (Command Palette)
// - Automated detection from metric thresholds
// - CI/CD deployment failures
// - Integration webhooks (PagerDuty, Opsgenie)
```

**Commands:**

- `Vitals: Create Incident` - Manually declare a new incident
- `Vitals: Show Incident Details` - View incident timeline and details

### 2. Incident Lifecycle Management

Track incidents through their complete lifecycle:

- **Detected** - Incident identified
- **Investigating** - Team actively debugging
- **Identified** - Root cause found
- **Monitoring** - Fix deployed, monitoring for recurrence
- **Resolved** - Incident fully resolved

### 3. Collaborative Debugging

#### Annotations

Add observations and notes during investigation:

```bash
# Command: Vitals: Add Incident Annotation
- Timestamp-based observations
- Link to specific metrics or logs
- Attach screenshots or diagnostic data
```

#### Hypothesis Tracking

Document and test theories systematically:

```bash
# Command: Vitals: Add Incident Hypothesis
- State: pending, confirmed, rejected
- Link to evidence (metrics, logs, traces)
- Track validation steps
```

### 4. Context Capture

Automatically capture diagnostic context:

- **Metric Snapshots** - Performance data at incident time
- **Log Snapshots** - Relevant log entries
- **Trace IDs** - Distributed traces for debugging
- **Git Context** - Recent commits and deployments

### 5. Runbook Automation

Execute predefined remediation steps automatically:

**Pre-configured Runbooks:**

#### Kubernetes Pod Restart

```yaml
Steps:
  1. Verify pod status (automated)
  2. Delete failing pod (automated)
  3. Verify new pod startup (automated)
```

#### High CPU Mitigation

```yaml
Steps:
  1. Identify high CPU processes (automated)
  2. Scale deployment (automated/manual)
  3. Verify CPU normalization (automated)
```

**Command:** `Vitals: Execute Runbook`

**Supported Actions:**

- `kubectl` commands (Kubernetes operations)
- `aws_cli` commands (AWS operations)
- `azure_cli` commands (Azure operations)
- `http` requests (API calls)
- `script` execution (Custom scripts)
- `notification` (Alert team members)

### 6. Integration with External Services

#### PagerDuty

- Create incidents automatically
- Sync incident status
- Trigger escalations

#### Opsgenie

- Create alerts with priorities (P1-P4)
- Assign to on-call team
- Update alert status

#### Slack

- Send incident notifications
- Color-coded by severity
- Interactive incident updates

#### Microsoft Teams

- MessageCard format notifications
- Incident summary with actions
- Status updates

**Command:** `Vitals: Configure Incident Integration`

### 7. On-Call Management

#### Status Bar Integration

When you're on-call, see a badge in VS Code's status bar:

```etext
🚨 On-Call
```

#### Escalation Policies

Define multi-level escalation:

```typescript
Primary → Backup → Manager
15 min → 15 min → 30 min delays
```

**Command:** `Vitals: Show On-Call Schedule`

### 8. Post-Mortem Generation

Generate comprehensive post-incident reports:

**Includes:**

- Executive summary
- Complete timeline with annotations
- Root cause analysis (AI-assisted)
- Impact assessment (duration, users affected, revenue loss)
- What went well / What went wrong
- Action items for prevention
- Lessons learned

**Output:** Markdown file exported to `post-mortems/` directory

**Command:** `Vitals: Generate Post-Mortem`

## Configuration

Add to your VS Code settings:

```json
{
  "vitals.enableIncidentManagement": true,
  "vitals.incidentIntegrations": {
    "pagerduty": {
      "enabled": true,
      "serviceId": "P1234567"
    },
    "slack": {
      "enabled": true,
      "channel": "#incidents"
    }
  },
  "vitals.runbookAutoExecute": false,
  "vitals.postMortemTemplate": "standard",
  "vitals.onCallNotifications": true
}
```

## Workflow Example

### Typical Incident Flow

1. **Detection**

   ```bash
   Alert: API latency > 2s threshold
   → Automatic incident creation
   → Notification sent to on-call engineer
   ```

2. **Investigation**

   ```bash
   Engineer opens incident in VS Code
   → Reviews metric snapshots
   → Adds annotations: "High CPU on api-pod-1234"
   → Adds hypothesis: "Memory leak in user service"
   ```

3. **Remediation**

   ```bash
   Execute runbook: "k8s-pod-restart"
   → Pod deleted automatically
   → New pod starts with fresh memory
   → Metrics normalize
   ```

4. **Resolution**

   ```bash
   Update incident status to "Resolved"
   → Generate post-mortem
   → Create action items:
     - Add memory limit to pod spec
     - Implement memory profiling
   ```

5. **Learning**

   ```bash
   Post-mortem exported to team wiki
   → Runbook updated with new steps
   → Alert threshold adjusted
   ```

## API Reference

### IncidentManager

```typescript
class IncidentManager {
  // Create new incident
  createIncident(params: {
    title: string;
    description: string;
    severity?: IncidentSeverity;
    source: 'manual' | 'automated';
  }): Promise<Incident>;

  // Update incident status
  updateStatus(
    incidentId: string, 
    status: IncidentStatus
  ): Promise<void>;

  // Add annotation
  addAnnotation(
    incidentId: string,
    annotation: {
      text: string;
      metricReference?: string;
    }
  ): Promise<void>;

  // Add hypothesis
  addHypothesis(
    incidentId: string,
    hypothesis: {
      description: string;
      state: 'pending' | 'confirmed' | 'rejected';
    }
  ): Promise<void>;

  // Capture diagnostic context
  captureMetricSnapshot(
    incidentId: string,
    metricName: string
  ): Promise<void>;

  captureLogSnapshot(
    incidentId: string,
    query: string
  ): Promise<void>;
}
```

### RunbookEngine

```typescript
class RunbookEngine {
  // Execute runbook
  executeRunbook(
    runbookId: string,
    variables?: Record<string, string>
  ): Promise<{
    success: boolean;
    steps: StepResult[];
  }>;

  // Register custom runbook
  registerRunbook(runbook: {
    id: string;
    name: string;
    description: string;
    steps: RunbookStep[];
  }): void;
}
```

### PostMortemGenerator

```typescript
class PostMortemGenerator {
  // Generate post-mortem
  generatePostMortem(
    incidentId: string,
    options?: {
      includeAI?: boolean;
      template?: 'standard' | 'detailed' | 'minimal';
    }
  ): Promise<PostMortem>;

  // Save as markdown
  saveAsMarkdown(
    postMortem: PostMortem,
    filepath: string
  ): Promise<void>;
}
```

## Best Practices

### 1. Severity Classification

Use consistent severity levels:

- **Critical** - Complete service outage, data loss
- **High** - Major feature unavailable, severe degradation
- **Medium** - Minor feature impacted, workaround available
- **Low** - Cosmetic issue, minimal user impact

### 2. Annotation Guidelines

- Use timestamps for all observations
- Link to specific metrics/logs when possible
- Be objective and factual
- Include commands/queries executed

### 3. Hypothesis Testing

- State hypotheses clearly
- Document validation steps
- Update state based on evidence
- Don't delete rejected hypotheses (learning!)

### 4. Runbook Maintenance

- Update runbooks after each incident
- Add new edge cases discovered
- Include rollback steps
- Test runbooks regularly in staging

### 5. Post-Mortem Writing

- Focus on systems, not individuals (blameless)
- Include both positives and negatives
- Create actionable items with owners
- Set realistic timelines for improvements

## Metrics & Analytics

Track incident management effectiveness:

- **MTTD** (Mean Time To Detect) - Alert → Incident created
- **MTTA** (Mean Time To Acknowledge) - Incident created → Engineer assigned
- **MTTI** (Mean Time To Identify) - Investigation start → Root cause found
- **MTTR** (Mean Time To Resolve) - Incident created → Resolved
- **Incident Volume** - Trends over time
- **Recurrence Rate** - Same incident repeating
- **Runbook Success Rate** - Automated remediation effectiveness

## Security Considerations

- **Credentials Storage**: All integration credentials stored in VS Code Secrets API
- **Access Control**: Configure integration permissions per team
- **Audit Logging**: All incident actions logged with timestamps
- **Data Retention**: Configure retention policies for sensitive data

## Troubleshooting

### Integrations Not Working

```bash
# Check credential storage
Command Palette → "Vitals: Configure Incident Integration"
Re-enter API keys

# Verify network connectivity
curl -X POST https://api.pagerduty.com/incidents
```

### Runbooks Failing

```bash
# Check command availability
which kubectl  # Should return path
which aws      # Should return path

# Verify permissions
kubectl auth can-i delete pods  # Should return 'yes'
```

### Post-Mortems Not Generating

```bash
# Check workspace permissions
# Ensure write access to workspace folder
# post-mortems/ directory created automatically
```

## Related Documentation

- [CI/CD Integration](./cicd_integration.md) - Correlate deployments with incidents
- [Distributed Tracing](./distributed_tracing.md) - Debug with traces
- [Premium Features](./premium_features.md) - Enterprise features

## Support

- **GitHub Issues**: [Report bugs](https://github.com/theaniketraj/vitals/issues)
- **Discussions**: [Ask questions](https://github.com/theaniketraj/vitals/discussions)
