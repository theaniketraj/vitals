import { CostMetrics, CostOptimizationTip } from './ICloudProvider';

/**
 * Cost optimization analyzer for multi-cloud observability
 */
export class CostOptimizer {
  /**
   * Analyze costs across all providers and generate recommendations
   */
  public analyzeCosts(costs: CostMetrics[]): CostAnalysisReport {
    const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);
    const allRecommendations: CostOptimizationTip[] = [];
    
    for (const cost of costs) {
      if (cost.recommendations) {
        allRecommendations.push(...cost.recommendations);
      }
    }

    // Sort by potential savings
    allRecommendations.sort((a, b) => {
      const savingsA = a.potentialSavings || 0;
      const savingsB = b.potentialSavings || 0;
      return savingsB - savingsA;
    });

    const totalPotentialSavings = allRecommendations.reduce(
      (sum, rec) => sum + (rec.potentialSavings || 0),
      0
    );

    return {
      totalCost,
      totalPotentialSavings,
      byProvider: costs.map(c => ({
        providerId: c.providerId,
        cost: c.totalCost,
        breakdown: c.breakdown,
        usage: c.usage,
      })),
      recommendations: allRecommendations,
      insights: this.generateInsights(costs),
    };
  }

  /**
   * Compare costs between providers for similar services
   */
  public compareProviderCosts(costs: CostMetrics[]): ProviderComparison[] {
    const comparisons: ProviderComparison[] = [];

    // Group providers
    const ingestionCosts = costs
      .filter(c => c.breakdown.ingestion !== undefined)
      .map(c => ({
        providerId: c.providerId,
        cost: c.breakdown.ingestion!,
        dataIngested: c.usage.dataIngested || 0,
      }));

    if (ingestionCosts.length > 1) {
      const avgCostPerGB = ingestionCosts.map(c => 
        c.dataIngested > 0 ? c.cost / c.dataIngested : 0
      );
      
      const cheapest = ingestionCosts.reduce((min, c, i) => 
        avgCostPerGB[i] < avgCostPerGB[min] ? i : min, 0
      );

      comparisons.push({
        category: 'Data Ingestion',
        providers: ingestionCosts.map((c, i) => ({
          providerId: c.providerId,
          cost: c.cost,
          costPerUnit: avgCostPerGB[i],
          unit: 'GB',
          isCheapest: i === cheapest,
        })),
        recommendation: `${ingestionCosts[cheapest].providerId} has the lowest cost per GB for data ingestion`,
      });
    }

    return comparisons;
  }

  /**
   * Identify expensive queries across providers
   */
  public identifyExpensiveQueries(queryLogs: QueryLog[]): ExpensiveQuery[] {
    // Sort by cost estimate
    const sorted = queryLogs
      .filter(q => q.costEstimate !== undefined)
      .sort((a, b) => (b.costEstimate || 0) - (a.costEstimate || 0));

    return sorted.slice(0, 10).map(q => ({
      providerId: q.providerId,
      query: q.query,
      costEstimate: q.costEstimate!,
      executionTime: q.executionTime,
      resultCount: q.resultCount,
      frequency: q.frequency || 1,
      totalCost: (q.costEstimate || 0) * (q.frequency || 1),
      recommendation: this.generateQueryRecommendation(q),
    }));
  }

  /**
   * Track query costs over time
   */
  public trackQueryCosts(queryLogs: QueryLog[], periodDays: number = 30): QueryCostTrend[] {
    const now = Date.now();
    const cutoff = now - periodDays * 24 * 60 * 60 * 1000;
    
    const recentQueries = queryLogs.filter(q => q.timestamp >= cutoff);
    
    // Group by provider and day
    const grouped = new Map<string, Map<string, number>>();

    for (const query of recentQueries) {
      if (!query.costEstimate) continue;

      const date = new Date(query.timestamp).toISOString().split('T')[0];
      
      if (!grouped.has(query.providerId)) {
        grouped.set(query.providerId, new Map());
      }
      
      const providerMap = grouped.get(query.providerId)!;
      const currentCost = providerMap.get(date) || 0;
      providerMap.set(date, currentCost + query.costEstimate);
    }

    const trends: QueryCostTrend[] = [];

    for (const [providerId, dateMap] of grouped) {
      const dataPoints = Array.from(dateMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, cost]) => ({
          date,
          cost,
        }));

      trends.push({
        providerId,
        period: {
          start: cutoff,
          end: now,
        },
        dataPoints,
        totalCost: dataPoints.reduce((sum, dp) => sum + dp.cost, 0),
        avgDailyCost: dataPoints.reduce((sum, dp) => sum + dp.cost, 0) / dataPoints.length,
      });
    }

    return trends;
  }

  /**
   * Generate cost insights
   */
  private generateInsights(costs: CostMetrics[]): string[] {
    const insights: string[] = [];

    // Check for high ingestion costs
    const highIngestion = costs.filter(c => 
      c.breakdown.ingestion && c.breakdown.ingestion > c.totalCost * 0.5
    );

    if (highIngestion.length > 0) {
      insights.push(
        `Data ingestion accounts for >50% of costs in ${highIngestion.length} provider(s). ` +
        `Consider sampling or filtering to reduce volume.`
      );
    }

    // Check for unused dashboards/queries
    const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);
    if (totalCost > 1000) {
      insights.push(
        `Monthly observability costs exceed $1,000. ` +
        `Review active monitors and dashboards for opportunities to consolidate.`
      );
    }

    // Check for multiple providers with similar capabilities
    if (costs.length > 2) {
      insights.push(
        `You're using ${costs.length} observability platforms. ` +
        `Consider consolidating to reduce overhead and costs.`
      );
    }

    return insights;
  }

  /**
   * Generate query optimization recommendation
   */
  private generateQueryRecommendation(query: QueryLog): string {
    const recommendations: string[] = [];

    if (query.executionTime > 5000) {
      recommendations.push('Query takes >5s to execute - consider adding time bounds or reducing scope');
    }

    if (query.resultCount > 10000) {
      recommendations.push('Query returns >10k results - add limits or aggregation');
    }

    if (query.frequency && query.frequency > 100) {
      recommendations.push('Query executed >100 times - consider caching results');
    }

    return recommendations.join('; ') || 'Optimize query performance to reduce costs';
  }
}

/**
 * Cost analysis report
 */
export interface CostAnalysisReport {
  totalCost: number;
  totalPotentialSavings: number;
  byProvider: ProviderCostSummary[];
  recommendations: CostOptimizationTip[];
  insights: string[];
}

/**
 * Provider cost summary
 */
export interface ProviderCostSummary {
  providerId: string;
  cost: number;
  breakdown: Record<string, any>;
  usage: Record<string, any>;
}

/**
 * Provider cost comparison
 */
export interface ProviderComparison {
  category: string;
  providers: {
    providerId: string;
    cost: number;
    costPerUnit: number;
    unit: string;
    isCheapest: boolean;
  }[];
  recommendation: string;
}

/**
 * Query execution log
 */
export interface QueryLog {
  providerId: string;
  query: string;
  timestamp: number;
  executionTime: number;
  resultCount: number;
  costEstimate?: number;
  frequency?: number;
}

/**
 * Expensive query analysis
 */
export interface ExpensiveQuery {
  providerId: string;
  query: string;
  costEstimate: number;
  executionTime: number;
  resultCount: number;
  frequency: number;
  totalCost: number;
  recommendation: string;
}

/**
 * Query cost trend over time
 */
export interface QueryCostTrend {
  providerId: string;
  period: {
    start: number;
    end: number;
  };
  dataPoints: {
    date: string;
    cost: number;
  }[];
  totalCost: number;
  avgDailyCost: number;
}
