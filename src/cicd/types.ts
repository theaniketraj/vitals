/**
 * Types and interfaces for CI/CD Integration & Deployment Intelligence
 */

export enum DeploymentStatus {
    InProgress = 'in_progress',
    Success = 'success',
    Failed = 'failed',
    RolledBack = 'rolled_back'
}

export enum DeploymentStrategy {
    Standard = 'standard',
    Canary = 'canary',
    BlueGreen = 'blue_green',
    Rolling = 'rolling'
}

export enum RegressionSeverity {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low',
    None = 'none'
}

export enum CIPlatform {
    GitHubActions = 'github_actions',
    GitLabCI = 'gitlab_ci',
    Jenkins = 'jenkins',
    CircleCI = 'circleci',
    AzureDevOps = 'azure_devops',
    TravisCI = 'travis_ci'
}

export enum FeatureFlagProvider {
    LaunchDarkly = 'launchdarkly',
    SplitIO = 'splitio',
    Unleash = 'unleash',
    Custom = 'custom'
}

export interface Deployment {
    id: string;
    timestamp: Date;
    environment: string; // production, staging, dev
    version: string; // Git tag or version number
    commitSha: string;
    commitMessage: string;
    author: string;
    status: DeploymentStatus;
    strategy: DeploymentStrategy;
    duration?: number; // milliseconds
    services: string[]; // affected services
    rollbackDeploymentId?: string; // if this is a rollback, points to original deployment
    metadata?: Record<string, any>;
}

export interface DeploymentMetrics {
    deploymentId: string;
    preDeployment: MetricSnapshot[];
    postDeployment: MetricSnapshot[];
    comparisonWindow: number; // minutes
}

export interface MetricSnapshot {
    metricName: string;
    timestamp: Date;
    value: number;
    labels?: Record<string, string>;
}

export interface PerformanceImpact {
    deploymentId: string;
    metricName: string;
    baseline: number;
    current: number;
    percentChange: number;
    isRegression: boolean;
    severity: RegressionSeverity;
    statisticalSignificance: number; // p-value
    confidenceInterval: [number, number];
    details: string;
}

export interface SLOCompliance {
    deploymentId: string;
    sloName: string;
    target: number; // e.g., 99.9 for 99.9% uptime
    actual: number;
    compliant: boolean;
    budget: number; // error budget remaining
    timeWindow: string; // e.g., "30d", "7d"
}

export interface RollbackRecommendation {
    deploymentId: string;
    severity: RegressionSeverity;
    confidence: number; // 0-1
    reasons: string[];
    affectedMetrics: PerformanceImpact[];
    estimatedRecoveryTime: number; // minutes
    rollbackTarget?: string; // previous deployment ID or version
    autoRollbackEligible: boolean;
}

export interface CIPipelineBuild {
    id: string;
    buildNumber: number;
    platform: CIPlatform;
    repository: string;
    branch: string;
    commitSha: string;
    startTime: Date;
    endTime?: Date;
    duration?: number; // milliseconds
    status: 'running' | 'success' | 'failed' | 'cancelled';
    stages: BuildStage[];
    resourceUsage?: ResourceUsage;
    cost?: number; // USD
}

export interface BuildStage {
    name: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'running' | 'success' | 'failed' | 'skipped';
    logs?: string[];
    tests?: TestResult[];
}

export interface TestResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    errorMessage?: string;
    flaky?: boolean; // detected as flaky
}

export interface ResourceUsage {
    cpuSeconds: number;
    memoryMbMinutes: number;
    storageGb: number;
    networkGb: number;
}

export interface FlakyTestReport {
    testName: string;
    failureRate: number; // 0-1
    totalRuns: number;
    failures: number;
    lastFailureDate: Date;
    commonErrorPatterns: string[];
    recommendedAction: string;
}

export interface FeatureFlag {
    key: string;
    name: string;
    provider: FeatureFlagProvider;
    enabled: boolean;
    rolloutPercentage: number; // 0-100
    variations: FlagVariation[];
    targeting?: FlagTargeting;
    createdAt: Date;
    updatedAt: Date;
}

export interface FlagVariation {
    id: string;
    name: string;
    value: any;
    weight: number; // percentage of users
}

export interface FlagTargeting {
    rules: TargetingRule[];
    defaultVariation: string;
}

export interface TargetingRule {
    conditions: Condition[];
    variation: string;
}

export interface Condition {
    attribute: string; // user.email, user.role, etc.
    operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in';
    values: any[];
}

export interface FlagImpactAnalysis {
    flagKey: string;
    deploymentId?: string;
    enabledAt: Date;
    affectedMetrics: MetricSnapshot[];
    performanceImpact: PerformanceImpact[];
    userImpact: {
        totalUsers: number;
        affectedUsers: number;
        conversionRateDelta?: number;
    };
    recommendation: string;
}

export interface ReleaseNotes {
    version: string;
    deploymentId: string;
    timestamp: Date;
    environment: string;
    commits: CommitInfo[];
    performanceImprovements: PerformanceChange[];
    performanceRegressions: PerformanceChange[];
    sloCompliance: SLOCompliance[];
    featureFlags: FeatureFlagChange[];
    breakingChanges: string[];
    bugFixes: string[];
    newFeatures: string[];
    markdown: string; // generated markdown content
}

export interface CommitInfo {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
    prNumber?: number;
    prTitle?: string;
}

export interface PerformanceChange {
    metric: string;
    before: number;
    after: number;
    percentChange: number;
    improvement: boolean;
}

export interface FeatureFlagChange {
    flagKey: string;
    action: 'enabled' | 'disabled' | 'rollout_increased' | 'rollout_decreased';
    previousValue?: number;
    newValue?: number;
}

export interface CICDConfig {
    platform: CIPlatform;
    webhookUrl?: string;
    apiToken?: string;
    repository: string;
    defaultEnvironment: string;
    deploymentDetection: {
        useGitTags: boolean;
        tagPattern?: string; // regex pattern for version tags
        useCIWebhooks: boolean;
    };
    performanceAnalysis: {
        enabled: boolean;
        comparisonWindowMinutes: number;
        regressionThreshold: number; // percent change to trigger alert
        autoRollbackEnabled: boolean;
    };
    featureFlags?: {
        provider: FeatureFlagProvider;
        apiKey?: string;
        projectKey?: string;
    };
}

export interface DeploymentAnnotation {
    deploymentId: string;
    metricName?: string;
    timestamp: Date;
    label: string;
    description?: string;
}
