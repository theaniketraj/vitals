import { DataPoint, QueryResult } from './ICloudProvider';

/**
 * Normalizes data from different providers into a standard format
 */
export class DataNormalizer {
  /**
   * Merge results from multiple providers
   */
  public mergeResults(results: Map<string, QueryResult>): QueryResult {
    const allDataPoints: DataPoint[] = [];
    let totalExecutionTime = 0;
    let totalResultCount = 0;
    const warnings: string[] = [];

    for (const [providerId, result] of results) {
      // Tag each data point with provider ID
      const taggedPoints = result.data.map(dp => ({
        ...dp,
        labels: {
          ...dp.labels,
          provider: providerId,
        },
      }));

      allDataPoints.push(...taggedPoints);
      totalExecutionTime += result.metadata.executionTime;
      totalResultCount += result.metadata.resultCount;

      if (result.metadata.warnings) {
        warnings.push(...result.metadata.warnings);
      }
    }

    // Sort by timestamp
    allDataPoints.sort((a, b) => a.timestamp - b.timestamp);

    return {
      providerId: 'unified',
      timestamp: Date.now(),
      data: allDataPoints,
      metadata: {
        executionTime: totalExecutionTime,
        resultCount: totalResultCount,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  /**
   * Correlate metrics from different providers by timestamp
   */
  public correlateByTimestamp(
    results: Map<string, QueryResult>,
    tolerance: number = 60000 // 1 minute tolerance
  ): CorrelatedDataPoint[] {
    const allPoints = this.extractAllPoints(results);
    const correlated: CorrelatedDataPoint[] = [];

    // Group by approximate timestamp
    const timeGroups = new Map<number, DataPoint[]>();

    for (const point of allPoints) {
      const roundedTime = Math.floor(point.timestamp / tolerance) * tolerance;
      
      if (!timeGroups.has(roundedTime)) {
        timeGroups.set(roundedTime, []);
      }
      
      timeGroups.get(roundedTime)!.push(point);
    }

    // Create correlated points
    for (const [time, points] of timeGroups) {
      const byProvider = new Map<string, DataPoint[]>();
      
      for (const point of points) {
        const provider = point.labels.provider || 'unknown';
        if (!byProvider.has(provider)) {
          byProvider.set(provider, []);
        }
        byProvider.get(provider)!.push(point);
      }

      correlated.push({
        timestamp: time,
        providers: Object.fromEntries(byProvider),
      });
    }

    return correlated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate aggregated statistics across providers
   */
  public aggregateAcrossProviders(results: Map<string, QueryResult>): AggregatedStats {
    const allPoints = this.extractAllPoints(results);
    
    if (allPoints.length === 0) {
      return this.emptyStats();
    }

    const values = allPoints
      .map(p => p.value)
      .filter(v => typeof v === 'number') as number[];

    if (values.length === 0) {
      return this.emptyStats();
    }

    values.sort((a, b) => a - b);

    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  /**
   * Detect anomalies by comparing data across providers
   */
  public detectAnomalies(results: Map<string, QueryResult>): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const correlated = this.correlateByTimestamp(results);

    for (const point of correlated) {
      const providers = Object.keys(point.providers);
      
      if (providers.length < 2) continue;

      // Get numeric values from each provider
      const values = providers.map(p => {
        const dataPoints = point.providers[p];
        const numericValues = dataPoints
          .map(dp => dp.value)
          .filter(v => typeof v === 'number') as number[];
        
        return numericValues.length > 0 
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : null;
      }).filter((v): v is number => v !== null);

      if (values.length < 2) continue;

      // Calculate variance
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Flag if standard deviation is high relative to mean
      if (stdDev > avg * 0.3) {
        anomalies.push({
          timestamp: point.timestamp,
          providers,
          values: Object.fromEntries(
            providers.map((p, i) => [p, values[i]])
          ),
          deviation: stdDev,
          severity: stdDev > avg * 0.5 ? 'high' : 'medium',
          description: `High variance detected across providers at ${new Date(point.timestamp).toISOString()}`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Normalize units across different providers
   */
  public normalizeUnits(dataPoints: DataPoint[]): DataPoint[] {
    return dataPoints.map(dp => {
      if (typeof dp.value !== 'number') return dp;

      const normalized = { ...dp };

      // Convert common units to standard formats
      switch (dp.unit?.toLowerCase()) {
        case 'ms':
        case 'milliseconds':
          normalized.value = dp.value / 1000;
          normalized.unit = 'seconds';
          break;
        case 'kb':
        case 'kilobytes':
          normalized.value = dp.value / 1024;
          normalized.unit = 'MB';
          break;
        case 'gb':
        case 'gigabytes':
          normalized.value = dp.value * 1024;
          normalized.unit = 'MB';
          break;
      }

      return normalized;
    });
  }

  /**
   * Extract all data points from results
   */
  private extractAllPoints(results: Map<string, QueryResult>): DataPoint[] {
    const allPoints: DataPoint[] = [];
    
    for (const result of results.values()) {
      allPoints.push(...result.data);
    }
    
    return allPoints;
  }

  /**
   * Empty statistics object
   */
  private emptyStats(): AggregatedStats {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }
}

/**
 * Correlated data point with data from multiple providers
 */
export interface CorrelatedDataPoint {
  timestamp: number;
  providers: Record<string, DataPoint[]>;
}

/**
 * Aggregated statistics
 */
export interface AggregatedStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Detected anomaly
 */
export interface Anomaly {
  timestamp: number;
  providers: string[];
  values: Record<string, number>;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}
