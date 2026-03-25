"use strict";
/**
 * VITALS Predictive Analytics
 *
 * Provides forecasting and predictive insights for performance metrics,
 * deployment risks, and resource utilization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveAnalytics = void 0;
exports.formatRiskAssessment = formatRiskAssessment;
exports.formatDeploymentWindow = formatDeploymentWindow;
/**
 * Predictive analytics engine
 */
class PredictiveAnalytics {
    constructor(storage, patternEngine, config) {
        this.storage = storage;
        this.patternEngine = patternEngine;
        this.config = {
            forecast_horizon_days: 7,
            confidence_level: 0.95,
            min_historical_days: 30,
            ...config
        };
    }
    /**
     * Forecast metric values
     */
    async forecastMetric(metric, field = 'change_percent') {
        // Get historical data
        const startDate = new Date(Date.now() - this.config.min_historical_days * 24 * 60 * 60 * 1000);
        const timeSeries = await this.storage.getTimeSeries(metric, field, { start_date: startDate });
        if (timeSeries.length < 10) {
            throw new Error(`Insufficient historical data for ${metric}. Need at least 10 data points.`);
        }
        // Use simple linear forecast for now
        const forecast = this.linearForecast(timeSeries.map(p => p.value), this.config.forecast_horizon_days);
        // Generate timestamps for predictions
        const lastTimestamp = timeSeries[timeSeries.length - 1].timestamp;
        const predictions = forecast.predictions.map((value, i) => ({
            timestamp: new Date(lastTimestamp.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
            value
        }));
        return {
            metric,
            forecast_type: 'linear',
            predictions,
            confidence_interval: forecast.confidence_interval,
            accuracy_score: forecast.r_squared,
            metadata: {
                historical_points: timeSeries.length,
                slope: forecast.slope,
                r_squared: forecast.r_squared
            }
        };
    }
    /**
     * Assess deployment risk
     */
    async assessDeploymentRisk(service, deployment_time) {
        const factors = [];
        let totalScore = 0;
        let totalWeight = 0;
        // Factor 1: Recent regression history
        const recentRegressions = await this.storage.queryRegressions(service, {
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            verdict: 'FAIL'
        });
        const regressionScore = Math.min(100, recentRegressions.length * 20);
        const regressionWeight = 0.3;
        factors.push({
            factor: 'recent_regressions',
            weight: regressionWeight,
            score: regressionScore,
            description: `${recentRegressions.length} regressions in last 7 days`
        });
        totalScore += regressionScore * regressionWeight;
        totalWeight += regressionWeight;
        // Factor 2: Time-based risk (if deployment time specified)
        if (deployment_time) {
            const dayOfWeek = deployment_time.getDay();
            const hourOfDay = deployment_time.getHours();
            // Fridays and weekends are higher risk
            let timeScore = 0;
            let timeDescription = '';
            if (dayOfWeek === 5) {
                timeScore = 60;
                timeDescription = 'Friday deployment - reduced coverage';
            }
            else if (dayOfWeek === 0 || dayOfWeek === 6) {
                timeScore = 80;
                timeDescription = 'Weekend deployment - minimal coverage';
            }
            else if (hourOfDay < 8 || hourOfDay > 18) {
                timeScore = 50;
                timeDescription = 'Off-hours deployment';
            }
            else {
                timeScore = 20;
                timeDescription = 'Business hours deployment';
            }
            const timeWeight = 0.2;
            factors.push({
                factor: 'deployment_timing',
                weight: timeWeight,
                score: timeScore,
                description: timeDescription
            });
            totalScore += timeScore * timeWeight;
            totalWeight += timeWeight;
        }
        // Factor 3: Deployment frequency (too frequent = risky)
        const recentDeployments = await this.storage.queryDeployments(service, {
            start_date: new Date(Date.now() - 24 * 60 * 60 * 1000)
        });
        let frequencyScore = 0;
        let frequencyDescription = '';
        if (recentDeployments.length > 5) {
            frequencyScore = 70;
            frequencyDescription = 'Very high deployment frequency (>5/day)';
        }
        else if (recentDeployments.length > 3) {
            frequencyScore = 50;
            frequencyDescription = 'High deployment frequency (3-5/day)';
        }
        else {
            frequencyScore = 20;
            frequencyDescription = 'Normal deployment frequency';
        }
        const frequencyWeight = 0.15;
        factors.push({
            factor: 'deployment_frequency',
            weight: frequencyWeight,
            score: frequencyScore,
            description: frequencyDescription
        });
        totalScore += frequencyScore * frequencyWeight;
        totalWeight += frequencyWeight;
        // Factor 4: Recent incident history
        const recentIncidents = await this.storage.queryIncidents(service, {
            start_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        });
        const incidentScore = Math.min(100, recentIncidents.length * 30);
        const incidentWeight = 0.35;
        factors.push({
            factor: 'recent_incidents',
            weight: incidentWeight,
            score: incidentScore,
            description: `${recentIncidents.length} incidents in last 14 days`
        });
        totalScore += incidentScore * incidentWeight;
        totalWeight += incidentWeight;
        // Calculate final risk score
        const riskScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        // Determine risk level
        let riskLevel;
        if (riskScore < 30) {
            riskLevel = 'low';
        }
        else if (riskScore < 50) {
            riskLevel = 'medium';
        }
        else if (riskScore < 70) {
            riskLevel = 'high';
        }
        else {
            riskLevel = 'critical';
        }
        // Generate recommendations
        const recommendations = [];
        if (riskScore >= 50) {
            recommendations.push('Consider delaying deployment or using canary rollout');
        }
        if (recentRegressions.length > 2) {
            recommendations.push('High regression rate - review recent changes');
        }
        if (recentIncidents.length > 1) {
            recommendations.push('Recent incidents detected - ensure issues are resolved');
        }
        if (deployment_time && (deployment_time.getDay() === 0 || deployment_time.getDay() === 6)) {
            recommendations.push('Avoid weekend deployments when possible');
        }
        if (recentDeployments.length > 5) {
            recommendations.push('High deployment frequency - ensure each change is necessary');
        }
        if (recommendations.length === 0) {
            recommendations.push('Risk level acceptable for deployment');
        }
        return {
            risk_level: riskLevel,
            risk_score: Math.round(riskScore),
            factors,
            recommendations
        };
    }
    /**
     * Recommend optimal deployment windows
     */
    async recommendDeploymentWindows(service, days_ahead = 7) {
        const windows = [];
        const now = new Date();
        // Detect time-based patterns first
        const patterns = await this.patternEngine.detectPatterns(service);
        const timePatterns = patterns.filter(p => p.pattern_type === 'time_based');
        // Generate windows for each day
        for (let day = 0; day < days_ahead; day++) {
            const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
            const dayOfWeek = date.getDay();
            // Skip weekends
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }
            // Business hours window: 10 AM - 4 PM
            const startTime = new Date(date);
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(date);
            endTime.setHours(16, 0, 0, 0);
            // Check if this day/time has known issues
            const hasTimePattern = timePatterns.some(p => 'day_of_week' in p && p.day_of_week === dayOfWeek);
            let riskLevel;
            let confidence;
            const reasons = [];
            if (dayOfWeek === 5) {
                riskLevel = 'medium';
                confidence = 0.7;
                reasons.push('Friday deployment - reduced on-call coverage');
            }
            else if (hasTimePattern) {
                riskLevel = 'high';
                confidence = 0.8;
                reasons.push('Historical pattern detected for this day');
            }
            else {
                riskLevel = 'low';
                confidence = 0.9;
                reasons.push('Normal business hours');
                reasons.push('No historical issues detected');
            }
            windows.push({
                start_time: startTime,
                end_time: endTime,
                risk_level: riskLevel,
                confidence,
                reasons
            });
        }
        // Sort by risk level (lowest first)
        return windows.sort((a, b) => {
            const riskOrder = { low: 0, medium: 1, high: 2 };
            return riskOrder[a.risk_level] - riskOrder[b.risk_level];
        });
    }
    /**
     * Forecast resource usage
     */
    async forecastResourceUsage(resource, threshold) {
        // This would typically integrate with metrics like CPU, memory, etc.
        // For now, return a placeholder implementation
        const predictions = [threshold * 0.7, threshold * 0.75, threshold * 0.8, threshold * 0.85, threshold * 0.9];
        const timestamps = predictions.map((_, i) => new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000));
        // Check if threshold will be breached
        const breachIndex = predictions.findIndex(p => p >= threshold);
        const thresholdBreachDate = breachIndex >= 0 ? timestamps[breachIndex] : undefined;
        const recommendations = [];
        if (thresholdBreachDate) {
            const daysUntilBreach = Math.ceil((thresholdBreachDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            recommendations.push(`Threshold will be breached in ~${daysUntilBreach} days`);
            recommendations.push('Consider scaling resources proactively');
        }
        else {
            recommendations.push('Resource usage trending safely below threshold');
        }
        return {
            resource,
            current_usage: threshold * 0.65,
            predicted_usage: predictions,
            timestamps,
            threshold_breach_date: thresholdBreachDate,
            recommendations
        };
    }
    /**
     * Generate predictive insights report
     */
    async generateInsightsReport(services) {
        const lines = [];
        lines.push('═══════════════════════════════════════════════════════');
        lines.push('VITALS Predictive Insights Report');
        lines.push('═══════════════════════════════════════════════════════');
        lines.push('');
        for (const service of services) {
            lines.push(`Service: ${service}`);
            lines.push('─────────────────────────────────────────────────────');
            // Risk assessment
            const risk = await this.assessDeploymentRisk(service);
            lines.push(`Current Risk Level: ${risk.risk_level.toUpperCase()} (${risk.risk_score}/100)`);
            lines.push('');
            lines.push('Risk Factors:');
            for (const factor of risk.factors) {
                lines.push(`  • ${factor.description}: ${factor.score}/100`);
            }
            lines.push('');
            lines.push('Recommendations:');
            for (const rec of risk.recommendations) {
                lines.push(`  • ${rec}`);
            }
            lines.push('');
            // Deployment windows
            const windows = await this.recommendDeploymentWindows(service, 3);
            if (windows.length > 0) {
                lines.push('Recommended Deployment Windows:');
                for (const window of windows.slice(0, 3)) {
                    const dateStr = window.start_time.toLocaleDateString();
                    const timeStr = `${window.start_time.toLocaleTimeString()} - ${window.end_time.toLocaleTimeString()}`;
                    lines.push(`  • ${dateStr} ${timeStr} [${window.risk_level}]`);
                    for (const reason of window.reasons) {
                        lines.push(`    - ${reason}`);
                    }
                }
            }
            lines.push('');
            lines.push('');
        }
        lines.push('═══════════════════════════════════════════════════════');
        return lines.join('\n');
    }
    // Helper methods
    linearForecast(values, horizonDays) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        // Calculate linear regression
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = values.reduce((sum, yi) => sum + yi * yi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        // Calculate R²
        const meanY = sumY / n;
        const ssTotal = values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
        const ssResidual = values.reduce((sum, yi, i) => {
            const predicted = slope * x[i] + intercept;
            return sum + Math.pow(yi - predicted, 2);
        }, 0);
        const r_squared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);
        // Generate predictions
        const predictions = [];
        const lower = [];
        const upper = [];
        // Calculate standard error
        const stdError = Math.sqrt(ssResidual / (n - 2));
        const margin = 1.96 * stdError; // 95% confidence interval
        for (let i = 0; i < horizonDays; i++) {
            const xi = n + i;
            const pred = slope * xi + intercept;
            predictions.push(pred);
            lower.push(pred - margin);
            upper.push(pred + margin);
        }
        return {
            predictions,
            confidence_interval: { lower, upper },
            slope,
            r_squared
        };
    }
}
exports.PredictiveAnalytics = PredictiveAnalytics;
/**
 * Format risk assessment for display
 */
function formatRiskAssessment(risk) {
    const lines = [];
    const riskIcon = risk.risk_level === 'low' ? '✅' :
        risk.risk_level === 'medium' ? '⚠️' :
            risk.risk_level === 'high' ? '❌' : '🚨';
    lines.push(`${riskIcon} Risk Level: ${risk.risk_level.toUpperCase()} (${risk.risk_score}/100)`);
    lines.push('');
    lines.push('Risk Factors:');
    for (const factor of risk.factors) {
        lines.push(`  • ${factor.description}: ${factor.score}/100 (weight: ${(factor.weight * 100).toFixed(0)}%)`);
    }
    lines.push('');
    lines.push('Recommendations:');
    for (const rec of risk.recommendations) {
        lines.push(`  • ${rec}`);
    }
    return lines.join('\n');
}
/**
 * Format deployment window for display
 */
function formatDeploymentWindow(window) {
    const riskIcon = window.risk_level === 'low' ? '✅' :
        window.risk_level === 'medium' ? '⚠️' : '❌';
    const dateStr = window.start_time.toLocaleDateString();
    const startTime = window.start_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endTime = window.end_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const lines = [];
    lines.push(`${riskIcon} ${dateStr} ${startTime} - ${endTime} [${window.risk_level}]`);
    lines.push(`Confidence: ${(window.confidence * 100).toFixed(0)}%`);
    for (const reason of window.reasons) {
        lines.push(`  • ${reason}`);
    }
    return lines.join('\n');
}
