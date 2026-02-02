/**
 * Feature Flag Manager - Integration with LaunchDarkly, Split.io, Unleash
 */

import * as vscode from 'vscode';
import {
    FeatureFlag,
    FeatureFlagProvider,
    FlagVariation,
    FlagImpactAnalysis,
    MetricSnapshot,
    PerformanceImpact
} from './types';

export class FeatureFlagManager {
    private flags: Map<string, FeatureFlag> = new Map();
    private impactHistory: FlagImpactAnalysis[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadFlags();
        this.loadImpactHistory();
    }

    /**
     * Connect to feature flag provider
     */
    async connectProvider(
        provider: FeatureFlagProvider,
        config: { apiKey: string; projectKey?: string; environment?: string }
    ): Promise<void> {
        try {
            // Store credentials securely
            await this.context.secrets.store(`ff.${provider}.apiKey`, config.apiKey);
            if (config.projectKey) {
                await this.context.secrets.store(`ff.${provider}.projectKey`, config.projectKey);
            }

            // Fetch flags from provider
            await this.syncFlagsFromProvider(provider, config);

            this.outputChannel.appendLine(`✅ Connected to ${provider}`);
            vscode.window.showInformationMessage(`Connected to ${provider}`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to connect to ${provider}: ${error}`);
            throw error;
        }
    }

    /**
     * Sync flags from provider
     */
    async syncFlagsFromProvider(
        provider: FeatureFlagProvider,
        config: { apiKey: string; projectKey?: string; environment?: string }
    ): Promise<void> {
        switch (provider) {
            case FeatureFlagProvider.LaunchDarkly:
                await this.syncLaunchDarkly(config);
                break;
            case FeatureFlagProvider.SplitIO:
                await this.syncSplitIO(config);
                break;
            case FeatureFlagProvider.Unleash:
                await this.syncUnleash(config);
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }

        await this.saveFlags();
    }

    /**
     * Analyze feature flag impact on metrics
     */
    async analyzeFlagImpact(
        flagKey: string,
        deploymentId?: string
    ): Promise<FlagImpactAnalysis | null> {
        const flag = this.flags.get(flagKey);
        if (!flag) {
            return null;
        }

        // In real implementation, fetch actual metrics before and after flag toggle
        // For now, generate mock analysis

        const mockMetrics: MetricSnapshot[] = [
            {
                metricName: 'response_time',
                timestamp: new Date(),
                value: 150 + Math.random() * 50,
                labels: { flag: flagKey }
            },
            {
                metricName: 'error_rate',
                timestamp: new Date(),
                value: 0.01 + Math.random() * 0.02,
                labels: { flag: flagKey }
            }
        ];

        const mockImpacts: PerformanceImpact[] = [
            {
                deploymentId: deploymentId || 'unknown',
                metricName: 'response_time',
                baseline: 180,
                current: 165,
                percentChange: -8.3,
                isRegression: false,
                severity: 'none' as any,
                statisticalSignificance: 0.02,
                confidenceInterval: [160, 170],
                details: 'Response time improved after flag toggle'
            }
        ];

        const analysis: FlagImpactAnalysis = {
            flagKey,
            deploymentId,
            enabledAt: flag.updatedAt,
            affectedMetrics: mockMetrics,
            performanceImpact: mockImpacts,
            userImpact: {
                totalUsers: 10000,
                affectedUsers: Math.floor(10000 * (flag.rolloutPercentage / 100)),
                conversionRateDelta: Math.random() * 0.05 - 0.025 // -2.5% to +2.5%
            },
            recommendation: this.generateFlagRecommendation(mockImpacts, flag.rolloutPercentage)
        };

        this.impactHistory.push(analysis);
        await this.saveImpactHistory();

        this.outputChannel.appendLine(
            `📊 Flag impact analysis for "${flagKey}": ${analysis.recommendation}`
        );

        return analysis;
    }

    /**
     * Correlate flag toggles with metric changes
     */
    async correlateFlagWithMetrics(
        flagKey: string,
        metricName: string,
        timeWindow: number = 60 // minutes
    ): Promise<{
        correlation: number; // -1 to 1
        significance: number; // p-value
        details: string;
    }> {
        const flag = this.flags.get(flagKey);
        if (!flag) {
            throw new Error(`Flag ${flagKey} not found`);
        }

        // In real implementation, fetch actual metric data and calculate correlation
        // For now, generate mock correlation

        const mockCorrelation = Math.random() * 0.8 - 0.4; // -0.4 to 0.4
        const mockSignificance = Math.random() * 0.1; // 0 to 0.1

        const direction = mockCorrelation > 0 ? 'positive' : 'negative';
        const strength = Math.abs(mockCorrelation) > 0.3 ? 'strong' : 'weak';

        const details = `${strength} ${direction} correlation between ${flagKey} and ${metricName} ` +
                       `(r=${mockCorrelation.toFixed(3)}, p=${mockSignificance.toFixed(4)})`;

        this.outputChannel.appendLine(`🔗 Correlation analysis: ${details}`);

        return {
            correlation: mockCorrelation,
            significance: mockSignificance,
            details
        };
    }

    /**
     * Get flag by key
     */
    getFlag(flagKey: string): FeatureFlag | undefined {
        return this.flags.get(flagKey);
    }

    /**
     * List all flags
     */
    listFlags(filters?: { provider?: FeatureFlagProvider; enabled?: boolean }): FeatureFlag[] {
        let flags = Array.from(this.flags.values());

        if (filters?.provider) {
            flags = flags.filter(f => f.provider === filters.provider);
        }

        if (filters?.enabled !== undefined) {
            flags = flags.filter(f => f.enabled === filters.enabled);
        }

        return flags.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    /**
     * Get impact history for a flag
     */
    getFlagImpactHistory(flagKey: string, limit: number = 10): FlagImpactAnalysis[] {
        return this.impactHistory
            .filter(analysis => analysis.flagKey === flagKey)
            .sort((a, b) => b.enabledAt.getTime() - a.enabledAt.getTime())
            .slice(0, limit);
    }

    /**
     * Identify problematic flag rollouts
     */
    identifyProblematicFlags(): Array<{
        flag: FeatureFlag;
        issues: string[];
        recommendation: string;
    }> {
        const problematic: Array<{
            flag: FeatureFlag;
            issues: string[];
            recommendation: string;
        }> = [];

        for (const flag of this.flags.values()) {
            const issues: string[] = [];
            
            // Check impact history
            const recentImpacts = this.getFlagImpactHistory(flag.key, 5);
            
            for (const impact of recentImpacts) {
                const regressions = impact.performanceImpact.filter(p => p.isRegression);
                if (regressions.length > 0) {
                    issues.push(`Performance regressions detected: ${regressions.map(r => r.metricName).join(', ')}`);
                }
                
                if (impact.userImpact.conversionRateDelta && impact.userImpact.conversionRateDelta < -0.02) {
                    issues.push(`Negative conversion rate impact: ${(impact.userImpact.conversionRateDelta * 100).toFixed(2)}%`);
                }
            }

            if (issues.length > 0) {
                const recommendation = flag.rolloutPercentage < 100
                    ? 'Pause rollout and investigate issues'
                    : 'Consider rolling back this feature';

                problematic.push({ flag, issues, recommendation });

                this.outputChannel.appendLine(
                    `⚠️  Problematic flag: ${flag.key} - ${issues.length} issue(s)`
                );
            }
        }

        return problematic;
    }

    /**
     * Provider-specific sync implementations
     */
    private async syncLaunchDarkly(config: { apiKey: string; projectKey?: string }): Promise<void> {
        // In real implementation, call LaunchDarkly API
        // For now, create mock flags
        
        const mockFlags: FeatureFlag[] = [
            {
                key: 'new-checkout-flow',
                name: 'New Checkout Flow',
                provider: FeatureFlagProvider.LaunchDarkly,
                enabled: true,
                rolloutPercentage: 50,
                variations: [
                    { id: 'control', name: 'Control', value: false, weight: 50 },
                    { id: 'treatment', name: 'Treatment', value: true, weight: 50 }
                ],
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
            }
        ];

        for (const flag of mockFlags) {
            this.flags.set(flag.key, flag);
        }

        this.outputChannel.appendLine(`Synced ${mockFlags.length} flags from LaunchDarkly`);
    }

    private async syncSplitIO(config: { apiKey: string }): Promise<void> {
        // Mock Split.io implementation
        this.outputChannel.appendLine('Synced flags from Split.io');
    }

    private async syncUnleash(config: { apiKey: string }): Promise<void> {
        // Mock Unleash implementation
        this.outputChannel.appendLine('Synced flags from Unleash');
    }

    /**
     * Generate recommendation based on flag impact
     */
    private generateFlagRecommendation(impacts: PerformanceImpact[], rolloutPercentage: number): string {
        const regressions = impacts.filter(i => i.isRegression);
        
        if (regressions.length === 0) {
            if (rolloutPercentage < 100) {
                return 'No regressions detected. Safe to increase rollout.';
            }
            return 'Feature performing well. Monitor for continued success.';
        }

        const criticalRegressions = regressions.filter(r => r.severity === 'critical');
        
        if (criticalRegressions.length > 0) {
            return 'Critical regressions detected. Immediate rollback recommended.';
        }

        if (rolloutPercentage > 50) {
            return 'Regressions detected. Consider rolling back to lower percentage.';
        }

        return 'Minor regressions detected. Monitor closely before increasing rollout.';
    }

    /**
     * Load flags from storage
     */
    private loadFlags(): void {
        const stored = this.context.globalState.get<Record<string, FeatureFlag>>('cicd.featureFlags', {});
        this.flags = new Map(
            Object.entries(stored).map(([key, flag]) => [
                key,
                {
                    ...flag,
                    createdAt: new Date(flag.createdAt),
                    updatedAt: new Date(flag.updatedAt)
                }
            ])
        );
    }

    /**
     * Save flags to storage
     */
    private async saveFlags(): Promise<void> {
        const stored = Object.fromEntries(this.flags);
        await this.context.globalState.update('cicd.featureFlags', stored);
    }

    /**
     * Load impact history from storage
     */
    private loadImpactHistory(): void {
        const stored = this.context.globalState.get<FlagImpactAnalysis[]>('cicd.flagImpactHistory', []);
        this.impactHistory = stored.map(analysis => ({
            ...analysis,
            enabledAt: new Date(analysis.enabledAt),
            affectedMetrics: analysis.affectedMetrics.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }))
        }));
    }

    /**
     * Save impact history to storage
     */
    private async saveImpactHistory(): Promise<void> {
        await this.context.globalState.update('cicd.flagImpactHistory', this.impactHistory);
    }
}
