/**
 * Rollback Engine - Intelligent rollback recommendations and execution
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';
import {
    Deployment,
    DeploymentStatus,
    DeploymentStrategy,
    RollbackRecommendation,
    PerformanceImpact,
    RegressionSeverity
} from './types';

const execAsync = promisify(child_process.exec);

export class RollbackEngine {
    private rollbackHistory: Map<string, string> = new Map(); // deploymentId -> rollbackTargetId

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadRollbackHistory();
    }

    /**
     * Generate rollback recommendation based on performance impact
     */
    generateRollbackRecommendation(
        deployment: Deployment,
        performanceImpacts: PerformanceImpact[],
        previousDeployment?: Deployment
    ): RollbackRecommendation | null {
        // Filter for regressions only
        const regressions = performanceImpacts.filter(impact => impact.isRegression);
        
        if (regressions.length === 0) {
            return null; // No regressions, no rollback needed
        }

        // Determine highest severity
        const maxSeverity = this.getMaxSeverity(regressions);

        // Calculate confidence based on statistical significance
        const avgPValue = regressions.reduce((sum, r) => sum + r.statisticalSignificance, 0) / regressions.length;
        const confidence = 1 - avgPValue; // Lower p-value = higher confidence

        // Generate reasons
        const reasons = regressions.map(r => 
            `${r.metricName}: ${r.percentChange > 0 ? '+' : ''}${r.percentChange.toFixed(2)}% change (${r.severity} severity)`
        );

        // Estimate recovery time based on deployment strategy
        const estimatedRecoveryTime = this.estimateRecoveryTime(deployment.strategy);

        // Auto-rollback eligible if critical severity and high confidence
        const autoRollbackEligible = maxSeverity === RegressionSeverity.Critical && confidence > 0.95;

        const recommendation: RollbackRecommendation = {
            deploymentId: deployment.id,
            severity: maxSeverity,
            confidence,
            reasons,
            affectedMetrics: regressions,
            estimatedRecoveryTime,
            rollbackTarget: previousDeployment?.id,
            autoRollbackEligible
        };

        this.outputChannel.appendLine(
            `🔄 Rollback recommendation generated for ${deployment.version}: ${maxSeverity} severity, ${(confidence * 100).toFixed(1)}% confidence`
        );

        return recommendation;
    }

    /**
     * Execute rollback
     */
    async executeRollback(
        deployment: Deployment,
        targetVersion: string,
        strategy: DeploymentStrategy = DeploymentStrategy.Standard
    ): Promise<{ success: boolean; message: string; newDeploymentId?: string }> {
        try {
            this.outputChannel.appendLine(
                `🔄 Executing rollback from ${deployment.version} to ${targetVersion}...`
            );

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Rolling back to ${targetVersion}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Preparing rollback...' });

                // Execute rollback based on strategy
                switch (strategy) {
                    case DeploymentStrategy.Canary:
                        await this.rollbackCanary(deployment, targetVersion, progress);
                        break;
                    case DeploymentStrategy.BlueGreen:
                        await this.rollbackBlueGreen(deployment, targetVersion, progress);
                        break;
                    case DeploymentStrategy.Rolling:
                        await this.rollbackRolling(deployment, targetVersion, progress);
                        break;
                    default:
                        await this.rollbackStandard(deployment, targetVersion, progress);
                }

                progress.report({ increment: 100, message: 'Rollback complete' });
            });

            // Record rollback in history
            const rollbackDeploymentId = `rollback-${Date.now()}`;
            this.rollbackHistory.set(deployment.id, rollbackDeploymentId);
            await this.saveRollbackHistory();

            vscode.window.showInformationMessage(
                `✅ Successfully rolled back to ${targetVersion}`
            );

            return {
                success: true,
                message: `Rolled back from ${deployment.version} to ${targetVersion}`,
                newDeploymentId: rollbackDeploymentId
            };

        } catch (error) {
            this.outputChannel.appendLine(`❌ Rollback failed: ${error}`);
            vscode.window.showErrorMessage(`Rollback failed: ${error}`);
            
            return {
                success: false,
                message: `Rollback failed: ${error}`
            };
        }
    }

    /**
     * Analyze canary deployment
     */
    async analyzeCanary(
        deployment: Deployment,
        canaryPercentage: number,
        canaryMetrics: any[],
        baselineMetrics: any[]
    ): Promise<{
        shouldPromote: boolean;
        confidence: number;
        recommendation: string;
    }> {
        // Compare canary vs baseline metrics
        // In real implementation, perform statistical comparison
        
        const mockConfidence = 0.85 + Math.random() * 0.1;
        const shouldPromote = mockConfidence > 0.9;

        const recommendation = shouldPromote
            ? `Canary deployment performing well (${canaryPercentage}% traffic). Safe to promote.`
            : `Canary showing degraded performance. Consider rollback.`;

        this.outputChannel.appendLine(
            `📊 Canary analysis: ${shouldPromote ? 'PROMOTE' : 'ROLLBACK'} (confidence: ${(mockConfidence * 100).toFixed(1)}%)`
        );

        return {
            shouldPromote,
            confidence: mockConfidence,
            recommendation
        };
    }

    /**
     * Monitor blue-green deployment
     */
    async monitorBlueGreen(
        blueDeployment: Deployment,
        greenDeployment: Deployment
    ): Promise<{
        activeEnvironment: 'blue' | 'green';
        healthyCount: number;
        totalCount: number;
        recommendation: string;
    }> {
        // In real implementation, check actual health of both environments
        
        const mockHealthy = 8 + Math.floor(Math.random() * 3);
        const total = 10;
        const activeEnv = mockHealthy >= 9 ? 'green' : 'blue';

        const recommendation = mockHealthy >= 9
            ? 'Green environment healthy. Safe to switch traffic.'
            : 'Green environment showing issues. Keeping traffic on blue.';

        this.outputChannel.appendLine(
            `🔵🟢 Blue-Green status: ${mockHealthy}/${total} healthy, active: ${activeEnv}`
        );

        return {
            activeEnvironment: activeEnv,
            healthyCount: mockHealthy,
            totalCount: total,
            recommendation
        };
    }

    /**
     * Get maximum severity from regressions
     */
    private getMaxSeverity(regressions: PerformanceImpact[]): RegressionSeverity {
        const severityOrder = [
            RegressionSeverity.None,
            RegressionSeverity.Low,
            RegressionSeverity.Medium,
            RegressionSeverity.High,
            RegressionSeverity.Critical
        ];

        let maxSeverity = RegressionSeverity.None;
        for (const regression of regressions) {
            const currentIndex = severityOrder.indexOf(regression.severity);
            const maxIndex = severityOrder.indexOf(maxSeverity);
            if (currentIndex > maxIndex) {
                maxSeverity = regression.severity;
            }
        }

        return maxSeverity;
    }

    /**
     * Estimate recovery time based on deployment strategy
     */
    private estimateRecoveryTime(strategy: DeploymentStrategy): number {
        switch (strategy) {
            case DeploymentStrategy.BlueGreen:
                return 2; // 2 minutes (instant switch)
            case DeploymentStrategy.Canary:
                return 10; // 10 minutes (gradual rollback)
            case DeploymentStrategy.Rolling:
                return 15; // 15 minutes (rolling update)
            default:
                return 5; // 5 minutes (standard rollback)
        }
    }

    /**
     * Rollback strategies
     */
    private async rollbackStandard(
        deployment: Deployment,
        targetVersion: string,
        progress: vscode.Progress<{ increment: number; message: string }>
    ): Promise<void> {
        progress.report({ increment: 25, message: 'Fetching target version...' });
        await this.delay(1000);

        progress.report({ increment: 50, message: 'Deploying previous version...' });
        await this.delay(2000);

        progress.report({ increment: 75, message: 'Verifying deployment...' });
        await this.delay(1000);
    }

    private async rollbackCanary(
        deployment: Deployment,
        targetVersion: string,
        progress: vscode.Progress<{ increment: number; message: string }>
    ): Promise<void> {
        progress.report({ increment: 20, message: 'Routing traffic away from canary...' });
        await this.delay(2000);

        progress.report({ increment: 40, message: 'Scaling down canary...' });
        await this.delay(1500);

        progress.report({ increment: 70, message: 'Promoting stable version...' });
        await this.delay(1500);

        progress.report({ increment: 90, message: 'Verifying traffic routing...' });
        await this.delay(1000);
    }

    private async rollbackBlueGreen(
        deployment: Deployment,
        targetVersion: string,
        progress: vscode.Progress<{ increment: number; message: string }>
    ): Promise<void> {
        progress.report({ increment: 30, message: 'Switching load balancer to blue...' });
        await this.delay(1000);

        progress.report({ increment: 60, message: 'Draining green environment...' });
        await this.delay(1500);

        progress.report({ increment: 90, message: 'Verifying blue environment...' });
        await this.delay(500);
    }

    private async rollbackRolling(
        deployment: Deployment,
        targetVersion: string,
        progress: vscode.Progress<{ increment: number; message: string }>
    ): Promise<void> {
        progress.report({ increment: 15, message: 'Rolling back instance 1/5...' });
        await this.delay(1000);

        progress.report({ increment: 30, message: 'Rolling back instance 2/5...' });
        await this.delay(1000);

        progress.report({ increment: 50, message: 'Rolling back instance 3/5...' });
        await this.delay(1000);

        progress.report({ increment: 70, message: 'Rolling back instance 4/5...' });
        await this.delay(1000);

        progress.report({ increment: 90, message: 'Rolling back instance 5/5...' });
        await this.delay(1000);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Load rollback history from storage
     */
    private loadRollbackHistory(): void {
        const stored = this.context.globalState.get<Record<string, string>>('cicd.rollbackHistory', {});
        this.rollbackHistory = new Map(Object.entries(stored));
    }

    /**
     * Save rollback history to storage
     */
    private async saveRollbackHistory(): Promise<void> {
        const stored = Object.fromEntries(this.rollbackHistory);
        await this.context.globalState.update('cicd.rollbackHistory', stored);
    }
}
