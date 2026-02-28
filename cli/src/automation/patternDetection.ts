/**
 * VITALS Pattern Detection Engine
 * 
 * Analyzes historical data to detect patterns, anomalies, and trends in
 * performance regressions and deployments.
 */

import { HistoricalStorage, HistoricalRecord, DeploymentMetadata, IncidentRecord } from './historicalStorage';

/**
 * Detected pattern
 */
export interface DetectedPattern {
  pattern_type: string;
  confidence: number;  // 0-1
  description: string;
  evidence: any[];
  recommendations?: string[];
  metadata?: Record<string, any>;
}

/**
 * Time-based pattern (e.g., "regressions every Friday")
 */
export interface TimePattern extends DetectedPattern {
  pattern_type: 'time_based';
  day_of_week?: number;  // 0-6 (Sunday-Saturday)
  hour_of_day?: number;  // 0-23
  frequency: string;  // daily, weekly, monthly
}

/**
 * Service correlation pattern (e.g., "Service A affects Service B")
 */
export interface CorrelationPattern extends DetectedPattern {
  pattern_type: 'correlation';
  service_a: string;
  service_b: string;
  correlation_coefficient: number;
  lag_minutes?: number;
}

/**
 * Trend pattern (e.g., "latency increasing over time")
 */
export interface TrendPattern extends DetectedPattern {
  pattern_type: 'trend';
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  r_squared: number;
}

/**
 * Team performance pattern (e.g., "Team X has highest MTTR")
 */
export interface TeamPattern extends DetectedPattern {
  pattern_type: 'team_performance';
  team: string;
  metric_type: 'mttr' | 'failure_rate' | 'regression_count';
  value: number;
  comparison: 'highest' | 'lowest' | 'average';
}

/**
 * Pattern detection configuration
 */
export interface PatternDetectionConfig {
  min_confidence?: number;
  lookback_days?: number;
  min_samples?: number;
}

/**
 * Pattern detection engine
 */
export class PatternDetectionEngine {
  private storage: HistoricalStorage;
  private config: PatternDetectionConfig;

  constructor(storage: HistoricalStorage, config?: PatternDetectionConfig) {
    this.storage = storage;
    this.config = {
      min_confidence: 0.7,
      lookback_days: 90,
      min_samples: 10,
      ...config
    };
  }

  /**
   * Detect all patterns for a metric
   */
  async detectPatterns(metric: string): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];

    // Detect time-based patterns
    const timePatterns = await this.detectTimePatterns(metric);
    patterns.push(...timePatterns);

    // Detect trend patterns
    const trendPatterns = await this.detectTrendPatterns(metric);
    patterns.push(...trendPatterns);

    // Filter by minimum confidence
    return patterns.filter(p => p.confidence >= this.config.min_confidence!);
  }

  /**
   * Detect time-based patterns (e.g., regressions on specific days/hours)
   */
  async detectTimePatterns(metric: string): Promise<TimePattern[]> {
    const patterns: TimePattern[] = [];
    const startDate = new Date(Date.now() - this.config.lookback_days! * 24 * 60 * 60 * 1000);
    
    const records = await this.storage.queryRegressions(metric, { 
      start_date: startDate,
      verdict: 'FAIL'
    });

    if (records.length < this.config.min_samples!) {
      return patterns;
    }

    // Analyze day of week pattern
    const dayOfWeekCounts: number[] = new Array(7).fill(0);
    const totalByDay: number[] = new Array(7).fill(0);

    // Get all records for baseline
    const allRecords = await this.storage.queryRegressions(metric, { start_date: startDate });
    
    for (const record of allRecords) {
      const date = new Date(record.timestamp);
      const day = date.getDay();
      totalByDay[day]++;
    }

    for (const record of records) {
      const date = new Date(record.timestamp);
      const day = date.getDay();
      dayOfWeekCounts[day]++;
    }

    // Find days with disproportionate failures
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let day = 0; day < 7; day++) {
      if (totalByDay[day] === 0) continue;

      const failureRate = dayOfWeekCounts[day] / totalByDay[day];
      const overallFailureRate = records.length / allRecords.length;

      // If this day has significantly higher failure rate
      if (failureRate > overallFailureRate * 1.5 && dayOfWeekCounts[day] >= 3) {
        const confidence = Math.min(0.95, failureRate / (overallFailureRate * 2));
        
        patterns.push({
          pattern_type: 'time_based',
          confidence,
          description: `${metric} shows higher regression rate on ${dayNames[day]}s`,
          evidence: records.filter(r => new Date(r.timestamp).getDay() === day).slice(0, 5),
          day_of_week: day,
          frequency: 'weekly',
          recommendations: [
            `Consider avoiding deployments on ${dayNames[day]}s`,
            `Increase monitoring on ${dayNames[day]}s`,
            `Review deployment process for ${dayNames[day]} patterns`
          ],
          metadata: {
            failure_rate_this_day: failureRate,
            overall_failure_rate: overallFailureRate,
            failures_on_day: dayOfWeekCounts[day],
            total_on_day: totalByDay[day]
          }
        });
      }
    }

    // Analyze hour of day pattern
    const hourCounts: number[] = new Array(24).fill(0);
    const totalByHour: number[] = new Array(24).fill(0);

    for (const record of allRecords) {
      const date = new Date(record.timestamp);
      const hour = date.getHours();
      totalByHour[hour]++;
    }

    for (const record of records) {
      const date = new Date(record.timestamp);
      const hour = date.getHours();
      hourCounts[hour]++;
    }

    // Find hours with disproportionate failures
    for (let hour = 0; hour < 24; hour++) {
      if (totalByHour[hour] === 0) continue;

      const failureRate = hourCounts[hour] / totalByHour[hour];
      const overallFailureRate = records.length / allRecords.length;

      if (failureRate > overallFailureRate * 1.5 && hourCounts[hour] >= 3) {
        const confidence = Math.min(0.95, failureRate / (overallFailureRate * 2));
        
        patterns.push({
          pattern_type: 'time_based',
          confidence,
          description: `${metric} shows higher regression rate around ${hour}:00`,
          evidence: records.filter(r => new Date(r.timestamp).getHours() === hour).slice(0, 5),
          hour_of_day: hour,
          frequency: 'daily',
          recommendations: [
            `Consider avoiding deployments around ${hour}:00`,
            `Increase monitoring during ${hour}:00-${(hour+1)%24}:00`,
            `Review what typically happens at ${hour}:00`
          ],
          metadata: {
            failure_rate_this_hour: failureRate,
            overall_failure_rate: overallFailureRate,
            failures_at_hour: hourCounts[hour],
            total_at_hour: totalByHour[hour]
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Detect trend patterns (increasing/decreasing over time)
   */
  async detectTrendPatterns(metric: string): Promise<TrendPattern[]> {
    const patterns: TrendPattern[] = [];
    const startDate = new Date(Date.now() - this.config.lookback_days! * 24 * 60 * 60 * 1000);
    
    const timeSeries = await this.storage.getTimeSeries(metric, 'change_percent', { start_date: startDate });

    if (timeSeries.length < this.config.min_samples!) {
      return patterns;
    }

    // Simple linear regression
    const regression = this.linearRegression(
      timeSeries.map((p, i) => i),
      timeSeries.map(p => p.value)
    );

    // Determine trend direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(regression.slope) < 0.01) {
      direction = 'stable';
    } else if (regression.slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Only report if there's a significant trend
    if (regression.r_squared > 0.5 && Math.abs(regression.slope) >= 0.01) {
      const confidence = Math.min(0.95, regression.r_squared);
      
      patterns.push({
        pattern_type: 'trend',
        confidence,
        description: `${metric} change percentage is ${direction} over time`,
        evidence: timeSeries.slice(-10),
        metric,
        direction,
        slope: regression.slope,
        r_squared: regression.r_squared,
        recommendations: direction === 'increasing' 
          ? [
              `${metric} is degrading over time - investigate root cause`,
              `Consider baseline updates or infrastructure changes`,
              `Review recent code changes affecting ${metric}`
            ]
          : [
              `${metric} is improving over time`,
              `Continue monitoring to ensure improvements hold`,
              `Document what led to improvements`
            ]
      });
    }

    return patterns;
  }

  /**
   * Detect service correlation patterns
   */
  async detectServiceCorrelations(
    serviceA: string,
    serviceB: string
  ): Promise<CorrelationPattern[]> {
    const patterns: CorrelationPattern[] = [];
    
    // This would require deployment timing data for both services
    // For now, return placeholder
    
    return patterns;
  }

  /**
   * Detect team performance patterns
   */
  async detectTeamPatterns(teams: string[]): Promise<TeamPattern[]> {
    const patterns: TeamPattern[] = [];
    
    // This would require team metadata in deployments
    // For now, return placeholder
    
    return patterns;
  }

  /**
   * Generate a summary report of all patterns
   */
  async generatePatternReport(metrics: string[]): Promise<string> {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('VITALS Pattern Detection Report');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');

    let totalPatterns = 0;

    for (const metric of metrics) {
      const patterns = await this.detectPatterns(metric);
      
      if (patterns.length === 0) {
        continue;
      }

      lines.push(`Metric: ${metric}`);
      lines.push('─────────────────────────────────────────────────────');
      
      for (const pattern of patterns) {
        totalPatterns++;
        lines.push('');
        lines.push(`Pattern: ${pattern.description}`);
        lines.push(`Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
        
        if (pattern.recommendations && pattern.recommendations.length > 0) {
          lines.push('Recommendations:');
          for (const rec of pattern.recommendations) {
            lines.push(`  • ${rec}`);
          }
        }
      }
      
      lines.push('');
    }

    if (totalPatterns === 0) {
      lines.push('No significant patterns detected.');
      lines.push('This could mean:');
      lines.push('  • Not enough historical data');
      lines.push('  • Performance is stable');
      lines.push('  • Increase lookback_days for more analysis');
    } else {
      lines.push('');
      lines.push(`Total patterns detected: ${totalPatterns}`);
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  // Helper methods

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r_squared: number } {
    const n = x.length;
    if (n === 0) {
      return { slope: 0, intercept: 0, r_squared: 0 };
    }

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const meanY = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const r_squared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

    return { slope, intercept, r_squared };
  }
}

/**
 * Format pattern for display
 */
export function formatPattern(pattern: DetectedPattern): string {
  const lines: string[] = [];
  
  lines.push(`Pattern Type: ${pattern.pattern_type}`);
  lines.push(`Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
  lines.push(`Description: ${pattern.description}`);
  
  if (pattern.recommendations && pattern.recommendations.length > 0) {
    lines.push('Recommendations:');
    for (const rec of pattern.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  return lines.join('\n');
}
