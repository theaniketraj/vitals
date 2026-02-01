/**
 * Example: Multi-Cloud Integration with Vitals
 * 
 * This example demonstrates how to use the multi-cloud integration
 * to query metrics from multiple providers, correlate data, and
 * optimize costs.
 */

import * as vscode from 'vscode';
import {
  CloudProviderManager,
  CloudCredentialManager,
  DatadogProvider,
  NewRelicProvider,
  AWSProvider,
  AzureProvider,
  UnifiedQueryTranslator,
  DataNormalizer,
  CostOptimizer,
  UnifiedQuery,
  AggregationType,
} from './api/multicloud';

/**
 * Initialize the multi-cloud system
 */
export async function initializeMultiCloud(context: vscode.ExtensionContext) {
  // Create manager instances
  const providerManager = new CloudProviderManager(context);
  const credentialManager = new CloudCredentialManager(context);
  const dataNormalizer = new DataNormalizer();
  const costOptimizer = new CostOptimizer();

  // Register providers
  const datadog = new DatadogProvider();
  const newrelic = new NewRelicProvider();
  const aws = new AWSProvider();
  const azure = new AzureProvider();

  providerManager.registerProvider(datadog);
  providerManager.registerProvider(newrelic);
  providerManager.registerProvider(aws);
  providerManager.registerProvider(azure);

  // Configure providers with stored credentials
  await configureProviders(providerManager, credentialManager);

  return { providerManager, credentialManager, dataNormalizer, costOptimizer };
}

/**
 * Configure all providers with stored credentials
 */
async function configureProviders(
  providerManager: CloudProviderManager,
  credentialManager: CloudCredentialManager
) {
  const providers = providerManager.getAllProviders();

  for (const provider of providers) {
    const credentials = await credentialManager.getCredentials(provider.providerId);
    
    if (credentials) {
      try {
        await provider.configureAuth(credentials);
        const status = await provider.testConnection();
        
        if (status.connected) {
          await providerManager.enableProvider(provider.providerId);
          console.log(`✅ ${provider.providerName} configured and enabled`);
        } else {
          console.warn(`⚠️ ${provider.providerName} configured but not connected: ${status.error}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to configure ${provider.providerName}:`, error.message);
      }
    }
  }
}

/**
 * Example 1: Query metrics across all providers
 */
export async function queryAllProviders(providerManager: CloudProviderManager) {
  const unifiedQuery: UnifiedQuery = {
    metric: 'http_requests_total',
    aggregation: AggregationType.RATE,
    filters: [
      { field: 'status', operator: 'eq', value: '200' },
      { field: 'service', operator: 'eq', value: 'api' },
    ],
    groupBy: ['endpoint'],
    timeRange: {
      start: Date.now() - 3600000, // Last hour
      end: Date.now(),
    },
  };

  console.log('🔍 Querying all providers...');
  const results = await providerManager.queryAll(unifiedQuery);

  for (const [providerId, result] of results) {
    console.log(`\n📊 ${providerId}:`);
    console.log(`  - Data points: ${result.data.length}`);
    console.log(`  - Execution time: ${result.metadata.executionTime}ms`);
    console.log(`  - Sample data:`, result.data.slice(0, 3));
  }

  return results;
}

/**
 * Example 2: Correlate data across providers
 */
export async function correlateDataAcrossProviders(
  providerManager: CloudProviderManager,
  dataNormalizer: DataNormalizer
) {
  const unifiedQuery: UnifiedQuery = {
    metric: 'cpu_usage',
    aggregation: AggregationType.AVG,
    timeRange: {
      start: Date.now() - 1800000, // Last 30 minutes
      end: Date.now(),
    },
  };

  console.log('🔗 Correlating data across providers...');
  const results = await providerManager.queryAll(unifiedQuery);

  // Merge results
  const merged = dataNormalizer.mergeResults(results);
  console.log(`\n📊 Merged ${merged.data.length} data points`);

  // Correlate by timestamp
  const correlated = dataNormalizer.correlateByTimestamp(results, 60000); // 1 minute tolerance
  console.log(`\n🕒 Found ${correlated.length} correlated time windows`);

  // Detect anomalies
  const anomalies = dataNormalizer.detectAnomalies(results);
  
  if (anomalies.length > 0) {
    console.log(`\n⚠️ Detected ${anomalies.length} anomalies:`);
    for (const anomaly of anomalies) {
      console.log(`  - ${anomaly.description}`);
      console.log(`    Severity: ${anomaly.severity}`);
      console.log(`    Values:`, anomaly.values);
    }
  } else {
    console.log('\n✅ No anomalies detected');
  }

  return { merged, correlated, anomalies };
}

/**
 * Example 3: Analyze and optimize costs
 */
export async function analyzeCosts(
  providerManager: CloudProviderManager,
  costOptimizer: CostOptimizer
) {
  console.log('💰 Fetching cost metrics from all providers...');
  const costs = await providerManager.getAggregatedCosts();

  // Analyze costs
  const report = costOptimizer.analyzeCosts(costs);

  console.log(`\n💵 Total Monthly Cost: $${report.totalCost.toFixed(2)}`);
  console.log(`💡 Potential Savings: $${report.totalPotentialSavings.toFixed(2)}`);

  console.log('\n📊 Cost by Provider:');
  for (const provider of report.byProvider) {
    console.log(`  ${provider.providerId}: $${provider.cost.toFixed(2)}`);
  }

  console.log('\n💡 Top Recommendations:');
  for (const rec of report.recommendations.slice(0, 5)) {
    console.log(`  [${rec.severity.toUpperCase()}] ${rec.title}`);
    console.log(`    ${rec.description}`);
    if (rec.potentialSavings) {
      console.log(`    💰 Potential savings: $${rec.potentialSavings.toFixed(2)}/month`);
    }
  }

  console.log('\n🔍 Insights:');
  for (const insight of report.insights) {
    console.log(`  • ${insight}`);
  }

  // Compare provider costs
  const comparisons = costOptimizer.compareProviderCosts(costs);
  
  if (comparisons.length > 0) {
    console.log('\n📈 Provider Comparisons:');
    for (const comparison of comparisons) {
      console.log(`  ${comparison.category}:`);
      for (const provider of comparison.providers) {
        const badge = provider.isCheapest ? '✅' : '  ';
        console.log(`    ${badge} ${provider.providerId}: $${provider.cost.toFixed(2)} ($${provider.costPerUnit.toFixed(4)}/${provider.unit})`);
      }
      console.log(`    💡 ${comparison.recommendation}`);
    }
  }

  return report;
}

/**
 * Example 4: Find expensive queries
 */
export async function findExpensiveQueries(
  costOptimizer: CostOptimizer,
  queryLogs: any[] // In practice, this would come from query logging
) {
  console.log('🔍 Analyzing query costs...');
  
  const expensiveQueries = costOptimizer.identifyExpensiveQueries(queryLogs);

  console.log(`\n💸 Top 10 Most Expensive Queries:`);
  for (let i = 0; i < expensiveQueries.length; i++) {
    const query = expensiveQueries[i];
    console.log(`\n${i + 1}. ${query.providerId}`);
    console.log(`   Query: ${query.query.substring(0, 80)}...`);
    console.log(`   Cost: $${query.totalCost.toFixed(4)}/month (${query.frequency} executions)`);
    console.log(`   Execution time: ${query.executionTime}ms`);
    console.log(`   Results: ${query.resultCount} data points`);
    console.log(`   💡 ${query.recommendation}`);
  }

  return expensiveQueries;
}

/**
 * Example 5: Track cost trends over time
 */
export async function trackCostTrends(
  costOptimizer: CostOptimizer,
  queryLogs: any[]
) {
  console.log('📈 Tracking cost trends...');
  
  const trends = costOptimizer.trackQueryCosts(queryLogs, 30);

  console.log('\n📊 Cost Trends (Last 30 Days):');
  for (const trend of trends) {
    console.log(`\n${trend.providerId}:`);
    console.log(`  Total: $${trend.totalCost.toFixed(2)}`);
    console.log(`  Average daily: $${trend.avgDailyCost.toFixed(2)}`);
    console.log(`  Data points: ${trend.dataPoints.length} days`);
    
    // Show last 7 days
    const lastWeek = trend.dataPoints.slice(-7);
    console.log('\n  Last 7 days:');
    for (const dp of lastWeek) {
      console.log(`    ${dp.date}: $${dp.cost.toFixed(2)}`);
    }
  }

  return trends;
}

/**
 * Example 6: Real-time monitoring across providers
 */
export async function realTimeMonitoring(
  providerManager: CloudProviderManager,
  dataNormalizer: DataNormalizer,
  interval: number = 30000 // 30 seconds
) {
  console.log('🔄 Starting real-time monitoring...');

  const unifiedQuery: UnifiedQuery = {
    metric: 'error_rate',
    aggregation: AggregationType.RATE,
    filters: [
      { field: 'severity', operator: 'eq', value: 'error' },
    ],
  };

  const monitor = setInterval(async () => {
    try {
      const results = await providerManager.queryAll(unifiedQuery);
      const stats = dataNormalizer.aggregateAcrossProviders(results);

      console.log(`\n[${new Date().toISOString()}] Error Rate Across All Providers:`);
      console.log(`  Average: ${stats.avg.toFixed(2)}`);
      console.log(`  Max: ${stats.max.toFixed(2)}`);
      console.log(`  P95: ${stats.p95.toFixed(2)}`);

      // Alert on high error rate
      if (stats.avg > 0.05) { // 5% error rate
        vscode.window.showWarningMessage(
          `⚠️ High error rate detected: ${(stats.avg * 100).toFixed(2)}%`
        );
      }
    } catch (error: any) {
      console.error('Error in monitoring loop:', error.message);
    }
  }, interval);

  // Return function to stop monitoring
  return () => {
    clearInterval(monitor);
    console.log('🛑 Stopped real-time monitoring');
  };
}

/**
 * Main example orchestrator
 */
export async function runMultiCloudExamples(context: vscode.ExtensionContext) {
  try {
    // Initialize
    const { providerManager, credentialManager, dataNormalizer, costOptimizer } = 
      await initializeMultiCloud(context);

    // Example 1: Query all providers
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE 1: Query Metrics Across All Providers');
    console.log('='.repeat(60));
    await queryAllProviders(providerManager);

    // Example 2: Correlate data
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE 2: Correlate Data Across Providers');
    console.log('='.repeat(60));
    await correlateDataAcrossProviders(providerManager, dataNormalizer);

    // Example 3: Analyze costs
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE 3: Analyze and Optimize Costs');
    console.log('='.repeat(60));
    await analyzeCosts(providerManager, costOptimizer);

    // Example 6: Start real-time monitoring
    console.log('\n' + '='.repeat(60));
    console.log('EXAMPLE 6: Real-Time Monitoring');
    console.log('='.repeat(60));
    const stopMonitoring = await realTimeMonitoring(providerManager, dataNormalizer);

    // Stop monitoring after 5 minutes
    setTimeout(() => {
      stopMonitoring();
    }, 5 * 60 * 1000);

  } catch (error: any) {
    console.error('❌ Error running examples:', error.message);
    vscode.window.showErrorMessage(`Multi-cloud examples failed: ${error.message}`);
  }
}
