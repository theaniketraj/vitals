/**
 * Performance Impact Analyzer - A/B comparison and statistical testing
 */

import * as vscode from 'vscode';
import {
    Deployment,
    DeploymentMetrics,
    MetricSnapshot,
    PerformanceImpact,
    RegressionSeverity,
    SLOCompliance
} from './types';

export class PerformanceImpactAnalyzer {
    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Analyze performance impact of deployment
     */
    async analyzeDeployment(
        deployment: Deployment,
        preDeploymentMetrics: MetricSnapshot[],
        postDeploymentMetrics: MetricSnapshot[]
    ): Promise<PerformanceImpact[]> {
        const impacts: PerformanceImpact[] = [];

        // Group metrics by name
        const metricGroups = this.groupMetricsByName(preDeploymentMetrics, postDeploymentMetrics);

        for (const [metricName, { pre, post }] of metricGroups) {
            if (pre.length === 0 || post.length === 0) continue;

            const baseline = this.calculateMean(pre.map(m => m.value));
            const current = this.calculateMean(post.map(m => m.value));
            const percentChange = ((current - baseline) / baseline) * 100;

            // Statistical significance test (Welch's t-test)
            const pValue = this.welchTTest(
                pre.map(m => m.value),
                post.map(m => m.value)
            );

            // Determine if regression (depends on metric type)
            const isRegression = this.isRegression(metricName, baseline, current, percentChange);
            const severity = this.classifyRegressionSeverity(metricName, percentChange, pValue);

            const impact: PerformanceImpact = {
                deploymentId: deployment.id,
                metricName,
                baseline,
                current,
                percentChange,
                isRegression,
                severity,
                statisticalSignificance: pValue,
                confidenceInterval: this.calculateConfidenceInterval(post.map(m => m.value)),
                details: this.generateImpactDetails(metricName, baseline, current, percentChange, pValue)
            };

            impacts.push(impact);

            if (isRegression && severity !== RegressionSeverity.None) {
                this.outputChannel.appendLine(
                    `  Regression detected: ${metricName} changed by ${percentChange.toFixed(2)}% (p=${pValue.toFixed(4)})`
                );
            }
        }

        return impacts;
    }

    /**
     * Check SLO compliance after deployment
     */
    async checkSLOCompliance(
        deployment: Deployment,
        slos: Array<{ name: string; target: number; metric: string; timeWindow: string }>
    ): Promise<SLOCompliance[]> {
        const results: SLOCompliance[] = [];

        for (const slo of slos) {
            // In real implementation, fetch actual metrics from Prometheus
            // For now, generate mock compliance data
            const actual = 99.5 + Math.random() * 0.5; // 99.5-100%
            const compliant = actual >= slo.target;
            const budget = Math.max(0, (actual - slo.target) * 100);

            const compliance: SLOCompliance = {
                deploymentId: deployment.id,
                sloName: slo.name,
                target: slo.target,
                actual,
                compliant,
                budget,
                timeWindow: slo.timeWindow
            };

            results.push(compliance);

            const icon = compliant ? '✅' : '❌';
            this.outputChannel.appendLine(
                `${icon} SLO "${slo.name}": ${actual.toFixed(3)}% (target: ${slo.target}%)`
            );
        }

        return results;
    }

    /**
     * Perform A/B comparison between two deployments
     */
    async compareDeployments(
        deploymentA: Deployment,
        deploymentB: Deployment,
        metrics: string[]
    ): Promise<Map<string, PerformanceImpact>> {
        // In real implementation, fetch metrics for both deployments
        // For now, return empty map
        this.outputChannel.appendLine(
            `Comparing deployments: ${deploymentA.version} vs ${deploymentB.version}`
        );
        
        return new Map();
    }

    /**
     * Group metrics by name for comparison
     */
    private groupMetricsByName(
        pre: MetricSnapshot[],
        post: MetricSnapshot[]
    ): Map<string, { pre: MetricSnapshot[]; post: MetricSnapshot[] }> {
        const groups = new Map<string, { pre: MetricSnapshot[]; post: MetricSnapshot[] }>();

        // Add pre-deployment metrics
        for (const metric of pre) {
            if (!groups.has(metric.metricName)) {
                groups.set(metric.metricName, { pre: [], post: [] });
            }
            groups.get(metric.metricName)!.pre.push(metric);
        }

        // Add post-deployment metrics
        for (const metric of post) {
            if (!groups.has(metric.metricName)) {
                groups.set(metric.metricName, { pre: [], post: [] });
            }
            groups.get(metric.metricName)!.post.push(metric);
        }

        return groups;
    }

    /**
     * Calculate mean of values
     */
    private calculateMean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    /**
     * Calculate standard deviation
     */
    private calculateStdDev(values: number[]): number {
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Welch's t-test for statistical significance
     */
    private welchTTest(sample1: number[], sample2: number[]): number {
        const mean1 = this.calculateMean(sample1);
        const mean2 = this.calculateMean(sample2);
        const std1 = this.calculateStdDev(sample1);
        const std2 = this.calculateStdDev(sample2);
        const n1 = sample1.length;
        const n2 = sample2.length;

        const variance1 = std1 * std1 / n1;
        const variance2 = std2 * std2 / n2;
        const pooledVariance = variance1 + variance2;

        if (pooledVariance === 0) return 1.0; // No difference

        const tStat = Math.abs(mean1 - mean2) / Math.sqrt(pooledVariance);

        // Simplified p-value approximation (proper implementation would use t-distribution)
        // For large samples, t-distribution ≈ normal distribution
        const pValue = 2 * (1 - this.normalCDF(tStat));

        return Math.max(0, Math.min(1, pValue));
    }

    /**
     * Normal CDF approximation
     */
    private normalCDF(x: number): number {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    }

    /**
     * Calculate 95% confidence interval
     */
    private calculateConfidenceInterval(values: number[]): [number, number] {
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values);
        const marginOfError = 1.96 * (stdDev / Math.sqrt(values.length)); // 95% CI

        return [mean - marginOfError, mean + marginOfError];
    }

    /**
     * Determine if change is a regression
     */
    private isRegression(metricName: string, baseline: number, current: number, percentChange: number): boolean {
        // Metrics where increase is bad
        const increaseIsBad = ['latency', 'error_rate', 'cpu_usage', 'memory_usage', 'response_time'];
        
        // Metrics where decrease is bad
        const decreaseIsBad = ['throughput', 'success_rate', 'availability', 'uptime'];

        const lowerName = metricName.toLowerCase();

        if (increaseIsBad.some(pattern => lowerName.includes(pattern))) {
            return percentChange > 10; // >10% increase is regression
        }

        if (decreaseIsBad.some(pattern => lowerName.includes(pattern))) {
            return percentChange < -10; // >10% decrease is regression
        }

        // For unknown metrics, consider significant changes as potential regressions
        return Math.abs(percentChange) > 20;
    }

    /**
     * Classify regression severity
     */
    private classifyRegressionSeverity(
        metricName: string,
        percentChange: number,
        pValue: number
    ): RegressionSeverity {
        // Not statistically significant
        if (pValue > 0.05) return RegressionSeverity.None;

        const absChange = Math.abs(percentChange);

        if (absChange > 50) return RegressionSeverity.Critical;
        if (absChange > 30) return RegressionSeverity.High;
        if (absChange > 15) return RegressionSeverity.Medium;
        if (absChange > 5) return RegressionSeverity.Low;

        return RegressionSeverity.None;
    }

    /**
     * Generate human-readable impact details
     */
    private generateImpactDetails(
        metricName: string,
        baseline: number,
        current: number,
        percentChange: number,
        pValue: number
    ): string {
        const direction = percentChange > 0 ? 'increased' : 'decreased';
        const significance = pValue < 0.01 ? 'highly significant' : 
                           pValue < 0.05 ? 'significant' : 'not significant';

        return `${metricName} ${direction} by ${Math.abs(percentChange).toFixed(2)}% ` +
               `(${baseline.toFixed(2)} → ${current.toFixed(2)}). ` +
               `Change is statistically ${significance} (p=${pValue.toFixed(4)}).`;
    }
}
