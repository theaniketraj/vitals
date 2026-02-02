/**
 * Types and interfaces for incident management system
 */

export enum IncidentSeverity {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low'
}

export enum IncidentStatus {
    Detected = 'detected',
    Investigating = 'investigating',
    Identified = 'identified',
    Monitoring = 'monitoring',
    Resolved = 'resolved'
}

export interface Incident {
    id: string;
    title: string;
    description: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    detectedAt: Date;
    resolvedAt?: Date;
    affectedServices: string[];
    assignedTo: string[];
    timeline: IncidentTimelineEntry[];
    annotations: IncidentAnnotation[];
    hypothesis: IncidentHypothesis[];
    relatedMetrics: MetricSnapshot[];
    relatedLogs: LogSnapshot[];
    relatedTraces: string[];
    runbooksExecuted: string[];
    tags: string[];
}

export interface IncidentTimelineEntry {
    timestamp: Date;
    type: 'detection' | 'status_change' | 'action' | 'annotation' | 'escalation' | 'resolution';
    actor: string;
    description: string;
    metadata?: Record<string, any>;
}

export interface IncidentAnnotation {
    id: string;
    timestamp: Date;
    author: string;
    content: string;
    metricReference?: {
        metric: string;
        timestamp: Date;
        value: number;
    };
    attachments?: string[];
}

export interface IncidentHypothesis {
    id: string;
    timestamp: Date;
    author: string;
    hypothesis: string;
    result: 'confirmed' | 'rejected' | 'pending';
    evidence?: string;
}

export interface MetricSnapshot {
    metric: string;
    timestamp: Date;
    value: number;
    query: string;
    datasource: string;
}

export interface LogSnapshot {
    timestamp: Date;
    level: string;
    message: string;
    service: string;
    source: string;
}

export interface Runbook {
    id: string;
    name: string;
    description: string;
    triggerConditions: RunbookTrigger[];
    steps: RunbookStep[];
    variables: Record<string, string>;
    tags: string[];
    lastUpdated: Date;
}

export interface RunbookTrigger {
    type: 'alert' | 'metric_threshold' | 'manual' | 'error_rate';
    condition: string;
    metadata?: Record<string, any>;
}

export interface RunbookStep {
    id: string;
    name: string;
    description: string;
    type: 'manual' | 'automated' | 'validation';
    action?: RunbookAction;
    expectedOutcome?: string;
    fallbackSteps?: string[];
}

export interface RunbookAction {
    type: 'kubectl' | 'aws_cli' | 'azure_cli' | 'http' | 'script' | 'notification';
    command: string;
    parameters: Record<string, any>;
    timeout: number;
}

export interface RunbookExecution {
    id: string;
    runbookId: string;
    incidentId?: string;
    startedAt: Date;
    completedAt?: Date;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    currentStep: number;
    stepResults: RunbookStepResult[];
    executor: string;
}

export interface RunbookStepResult {
    stepId: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    output?: string;
    error?: string;
}

export interface PostMortem {
    id: string;
    incidentId: string;
    title: string;
    summary: string;
    impact: {
        duration: number;
        affectedUsers?: number;
        affectedServices: string[];
        revenue?: number;
    };
    timeline: IncidentTimelineEntry[];
    rootCause: string;
    triggeringEvent: string;
    resolution: string;
    whatWentWell: string[];
    whatWentWrong: string[];
    actionItems: ActionItem[];
    lessons: string[];
    createdAt: Date;
    createdBy: string;
    reviewers: string[];
}

export interface ActionItem {
    id: string;
    description: string;
    assignee: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    dueDate?: Date;
    linkedIssue?: string;
}

export interface OnCallSchedule {
    id: string;
    name: string;
    team: string;
    timezone: string;
    rotations: OnCallRotation[];
    escalationPolicy: EscalationPolicy;
}

export interface OnCallRotation {
    id: string;
    type: 'daily' | 'weekly' | 'custom';
    schedule: OnCallShift[];
    participants: string[];
}

export interface OnCallShift {
    user: string;
    startTime: Date;
    endTime: Date;
    isBackup: boolean;
}

export interface EscalationPolicy {
    id: string;
    name: string;
    levels: EscalationLevel[];
    repeatInterval?: number;
}

export interface EscalationLevel {
    level: number;
    delay: number; // minutes before escalating
    notifyUsers: string[];
    notifyChannels: string[];
}

export interface IntegrationConfig {
    pagerduty?: {
        apiKey: string;
        serviceId: string;
        enabled: boolean;
    };
    opsgenie?: {
        apiKey: string;
        team: string;
        enabled: boolean;
    };
    slack?: {
        webhookUrl: string;
        channel: string;
        enabled: boolean;
    };
    teams?: {
        webhookUrl: string;
        enabled: boolean;
    };
}

export interface CollaborationSession {
    id: string;
    incidentId: string;
    participants: Participant[];
    sharedView: {
        dashboardId: string;
        timeRange: { start: Date; end: Date };
        focusedMetrics: string[];
    };
    chat: ChatMessage[];
    recordings: SessionRecording[];
}

export interface Participant {
    id: string;
    name: string;
    role: 'owner' | 'responder' | 'observer';
    joinedAt: Date;
    isOnline: boolean;
}

export interface ChatMessage {
    id: string;
    participantId: string;
    timestamp: Date;
    content: string;
    mentions?: string[];
}

export interface SessionRecording {
    id: string;
    startTime: Date;
    endTime: Date;
    url: string;
    thumbnailUrl?: string;
}
