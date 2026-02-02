/**
 * CI Pipeline Monitor - Build tracking, flaky test detection, cost analysis
 */

import * as vscode from 'vscode';
import {
    CIPipelineBuild,
    BuildStage,
    TestResult,
    FlakyTestReport,
    ResourceUsage,
    CIPlatform
} from './types';

export class CIPipelineMonitor {
    private builds: Map<string, CIPipelineBuild> = new Map();
    private flakyTests: Map<string, FlakyTestReport> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.loadBuilds();
        this.loadFlakyTests();
    }

    /**
     * Register new build
     */
    async registerBuild(build: CIPipelineBuild): Promise<void> {
        this.builds.set(build.id, build);
        await this.saveBuilds();

        this.outputChannel.appendLine(
            `🔨 Build #${build.buildNumber} started on ${build.platform} (${build.branch})`
        );

        // Detect flaky tests if build has test results
        if (build.stages.some(stage => stage.tests && stage.tests.length > 0)) {
            await this.detectFlakyTests(build);
        }
    }

    /**
     * Update build status
     */
    async updateBuild(buildId: string, updates: Partial<CIPipelineBuild>): Promise<void> {
        const build = this.builds.get(buildId);
        if (!build) {
            throw new Error(`Build ${buildId} not found`);
        }

        Object.assign(build, updates);

        if (updates.endTime && build.startTime) {
            build.duration = updates.endTime.getTime() - build.startTime.getTime();
        }

        await this.saveBuilds();

        const icon = build.status === 'success' ? '✅' : 
                     build.status === 'failed' ? '❌' : '🔄';
        
        this.outputChannel.appendLine(
            `${icon} Build #${build.buildNumber}: ${build.status} (${(build.duration! / 1000).toFixed(1)}s)`
        );
    }

    /**
     * Detect flaky tests across builds
     */
    async detectFlakyTests(build: CIPipelineBuild): Promise<void> {
        const allTests = build.stages.flatMap(stage => stage.tests || []);
        
        for (const test of allTests) {
            if (test.status === 'failed') {
                await this.recordTestFailure(test.name, build.id);
            } else if (test.status === 'passed') {
                await this.recordTestSuccess(test.name);
            }
        }

        // Identify flaky tests (tests that sometimes pass, sometimes fail)
        for (const [testName, report] of this.flakyTests) {
            if (report.failureRate > 0.1 && report.failureRate < 0.9 && report.totalRuns >= 10) {
                this.outputChannel.appendLine(
                    `⚠️  Flaky test detected: ${testName} (${(report.failureRate * 100).toFixed(1)}% failure rate over ${report.totalRuns} runs)`
                );
            }
        }

        await this.saveFlakyTests();
    }

    /**
     * Analyze build time trends
     */
    analyzeBuildTrends(repository: string, branch: string, limit: number = 20): {
        averageDuration: number;
        trendDirection: 'improving' | 'degrading' | 'stable';
        slowestStages: Array<{ name: string; averageDuration: number }>;
        recommendations: string[];
    } {
        // Get recent builds for this repo/branch
        const recentBuilds = Array.from(this.builds.values())
            .filter(b => b.repository === repository && b.branch === branch && b.duration)
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
            .slice(0, limit);

        if (recentBuilds.length < 5) {
            return {
                averageDuration: 0,
                trendDirection: 'stable',
                slowestStages: [],
                recommendations: ['Insufficient data for trend analysis. Need at least 5 builds.']
            };
        }

        // Calculate average duration
        const avgDuration = recentBuilds.reduce((sum, b) => sum + (b.duration || 0), 0) / recentBuilds.length;

        // Determine trend (compare first half vs second half)
        const midpoint = Math.floor(recentBuilds.length / 2);
        const recentAvg = recentBuilds.slice(0, midpoint).reduce((sum, b) => sum + (b.duration || 0), 0) / midpoint;
        const olderAvg = recentBuilds.slice(midpoint).reduce((sum, b) => sum + (b.duration || 0), 0) / (recentBuilds.length - midpoint);
        
        const trendDirection = recentAvg < olderAvg * 0.9 ? 'improving' :
                              recentAvg > olderAvg * 1.1 ? 'degrading' : 'stable';

        // Find slowest stages
        const stageStats = new Map<string, { totalDuration: number; count: number }>();
        
        for (const build of recentBuilds) {
            for (const stage of build.stages) {
                if (!stage.duration) continue;
                
                if (!stageStats.has(stage.name)) {
                    stageStats.set(stage.name, { totalDuration: 0, count: 0 });
                }
                
                const stats = stageStats.get(stage.name)!;
                stats.totalDuration += stage.duration;
                stats.count += 1;
            }
        }

        const slowestStages = Array.from(stageStats.entries())
            .map(([name, stats]) => ({
                name,
                averageDuration: stats.totalDuration / stats.count
            }))
            .sort((a, b) => b.averageDuration - a.averageDuration)
            .slice(0, 5);

        // Generate recommendations
        const recommendations: string[] = [];
        
        if (trendDirection === 'degrading') {
            recommendations.push('Build times are increasing. Consider optimizing dependencies or caching.');
        }
        
        if (slowestStages.length > 0 && slowestStages[0].averageDuration > 60000) {
            recommendations.push(`"${slowestStages[0].name}" stage takes ${(slowestStages[0].averageDuration / 1000).toFixed(1)}s on average. Consider parallelization.`);
        }

        if (recentBuilds.some(b => b.resourceUsage && b.resourceUsage.cpuSeconds > 3600)) {
            recommendations.push('High CPU usage detected. Consider using build caches or artifact repositories.');
        }

        this.outputChannel.appendLine(
            `📊 Build trends for ${repository}/${branch}: ${trendDirection} (avg ${(avgDuration / 1000).toFixed(1)}s)`
        );

        return {
            averageDuration: avgDuration,
            trendDirection,
            slowestStages,
            recommendations
        };
    }

    /**
     * Calculate CI/CD infrastructure cost
     */
    calculateCost(repository: string, timeWindow: number = 30): {
        totalCost: number;
        buildCount: number;
        costPerBuild: number;
        breakdown: {
            compute: number;
            storage: number;
            network: number;
        };
    } {
        const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000);
        
        const relevantBuilds = Array.from(this.builds.values())
            .filter(b => b.repository === repository && b.startTime >= cutoffDate);

        let totalComputeCost = 0;
        let totalStorageCost = 0;
        let totalNetworkCost = 0;

        for (const build of relevantBuilds) {
            if (build.resourceUsage) {
                // Mock cost calculation (replace with actual pricing)
                totalComputeCost += (build.resourceUsage.cpuSeconds / 3600) * 0.05; // $0.05 per CPU-hour
                totalStorageCost += build.resourceUsage.storageGb * 0.01; // $0.01 per GB
                totalNetworkCost += build.resourceUsage.networkGb * 0.05; // $0.05 per GB transfer
            }
        }

        const totalCost = totalComputeCost + totalStorageCost + totalNetworkCost;
        const costPerBuild = relevantBuilds.length > 0 ? totalCost / relevantBuilds.length : 0;

        this.outputChannel.appendLine(
            `💰 CI/CD cost for ${repository} (${timeWindow}d): $${totalCost.toFixed(2)} (${relevantBuilds.length} builds)`
        );

        return {
            totalCost,
            buildCount: relevantBuilds.length,
            costPerBuild,
            breakdown: {
                compute: totalComputeCost,
                storage: totalStorageCost,
                network: totalNetworkCost
            }
        };
    }

    /**
     * Get flaky test report
     */
    getFlakyTests(): FlakyTestReport[] {
        return Array.from(this.flakyTests.values())
            .filter(report => report.failureRate > 0.1 && report.totalRuns >= 10)
            .sort((a, b) => b.failureRate - a.failureRate);
    }

    /**
     * Record test failure
     */
    private async recordTestFailure(testName: string, buildId: string): Promise<void> {
        if (!this.flakyTests.has(testName)) {
            this.flakyTests.set(testName, {
                testName,
                failureRate: 0,
                totalRuns: 0,
                failures: 0,
                lastFailureDate: new Date(),
                commonErrorPatterns: [],
                recommendedAction: 'Investigate test stability'
            });
        }

        const report = this.flakyTests.get(testName)!;
        report.totalRuns += 1;
        report.failures += 1;
        report.failureRate = report.failures / report.totalRuns;
        report.lastFailureDate = new Date();
    }

    /**
     * Record test success
     */
    private async recordTestSuccess(testName: string): Promise<void> {
        if (!this.flakyTests.has(testName)) {
            this.flakyTests.set(testName, {
                testName,
                failureRate: 0,
                totalRuns: 0,
                failures: 0,
                lastFailureDate: new Date(),
                commonErrorPatterns: [],
                recommendedAction: 'No action needed'
            });
        }

        const report = this.flakyTests.get(testName)!;
        report.totalRuns += 1;
        report.failureRate = report.failures / report.totalRuns;
    }

    /**
     * Load builds from storage
     */
    private loadBuilds(): void {
        const stored = this.context.globalState.get<Record<string, CIPipelineBuild>>('cicd.builds', {});
        this.builds = new Map(
            Object.entries(stored).map(([id, b]) => [
                id,
                {
                    ...b,
                    startTime: new Date(b.startTime),
                    endTime: b.endTime ? new Date(b.endTime) : undefined,
                    stages: b.stages.map(stage => ({
                        ...stage,
                        startTime: new Date(stage.startTime),
                        endTime: stage.endTime ? new Date(stage.endTime) : undefined
                    }))
                }
            ])
        );
    }

    /**
     * Save builds to storage
     */
    private async saveBuilds(): Promise<void> {
        const stored = Object.fromEntries(this.builds);
        await this.context.globalState.update('cicd.builds', stored);
    }

    /**
     * Load flaky tests from storage
     */
    private loadFlakyTests(): void {
        const stored = this.context.globalState.get<Record<string, FlakyTestReport>>('cicd.flakyTests', {});
        this.flakyTests = new Map(
            Object.entries(stored).map(([name, report]) => [
                name,
                {
                    ...report,
                    lastFailureDate: new Date(report.lastFailureDate)
                }
            ])
        );
    }

    /**
     * Save flaky tests to storage
     */
    private async saveFlakyTests(): Promise<void> {
        const stored = Object.fromEntries(this.flakyTests);
        await this.context.globalState.update('cicd.flakyTests', stored);
    }
}
