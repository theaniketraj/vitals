/**
 * VITALS Phase 4 Integration Example
 * 
 * This file demonstrates how to integrate Phase 4 automation capabilities
 * into your existing VITALS batch processing workflow.
 */

import { BatchProcessor } from './batch/batchProcessor';
import { AutomationPolicyEngine } from './automation/policyEngine';
import { registerDefaultExecutors } from './automation/executors';
import { HistoricalStorage } from './automation/historicalStorage';
import { PatternDetectionEngine } from './automation/patternDetection';
import { PredictiveAnalytics } from './automation/predictiveAnalytics';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Example 1: Basic Automation Integration
 */
async function basicAutomationExample() {
  console.log('=== Example 1: Basic Automation ===\n');

  // Load configuration
  const configPath = path.join(__dirname, '../../vitals.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;

  // Initialize batch processor
  const batchProcessor = new BatchProcessor(config);

  // Initialize automation components
  const storage = new HistoricalStorage(
    config.historical_storage?.base_path || '~/.vitals/history'
  );

  // Register action executors
  registerDefaultExecutors();

  // Initialize policy engine
  const policyEngine = new AutomationPolicyEngine(config.automation);

  // Run batch analysis
  console.log('Running regression analysis...');
  const results = await batchProcessor.runBatch(config);
  console.log(`Analysis complete: ${results.length} results\n`);

  // Store results in historical database
  console.log('Storing results in historical database...');
  await storage.storeBatchResults(results);
  console.log('Storage complete\n');

  // Execute automation policies
  console.log('Executing automation policies...');
  await policyEngine.executePolicies(results);
  console.log('Automation complete\n');
}

/**
 * Example 2: Pattern Detection
 */
async function patternDetectionExample() {
  console.log('=== Example 2: Pattern Detection ===\n');

  // Initialize storage
  const storage = new HistoricalStorage('~/.vitals/history');

  // Initialize pattern detection engine
  const patternEngine = new PatternDetectionEngine(storage, {
    min_samples: 10,
    confidence_threshold: 0.7
  });

  // Detect patterns for a service
  const service = 'api-service';
  console.log(`Detecting patterns for ${service}...`);
  const patterns = await patternEngine.detectPatterns(service);

  if (patterns.length === 0) {
    console.log('No significant patterns detected\n');
    return;
  }

  // Generate and display report
  const report = patternEngine.generatePatternReport(patterns);
  console.log(report);
  console.log();

  // Act on high-confidence patterns
  for (const pattern of patterns) {
    if (pattern.confidence > 0.8) {
      console.log(`🚨 High-confidence pattern detected: ${pattern.description}`);
      console.log(`   Action: ${pattern.recommendation}\n`);
      
      // Could trigger alerts or automated actions here
    }
  }
}

/**
 * Example 3: Deployment Risk Assessment
 */
async function riskAssessmentExample() {
  console.log('=== Example 3: Deployment Risk Assessment ===\n');

  // Initialize components
  const storage = new HistoricalStorage('~/.vitals/history');
  const patternEngine = new PatternDetectionEngine(storage);
  const analytics = new PredictiveAnalytics(storage, patternEngine);

  // Assess risk for upcoming deployment
  const service = 'api-service';
  const deploymentTime = new Date(); // Current time

  console.log(`Assessing deployment risk for ${service}...`);
  const risk = await analytics.assessDeploymentRisk(service, deploymentTime);

  // Display risk assessment
  console.log(`\nRisk Level: ${risk.risk_level.toUpperCase()} (${risk.risk_score}/100)\n`);
  console.log('Risk Factors:');
  for (const factor of risk.factors) {
    console.log(`  • ${factor.description}: ${factor.score}/100 (weight: ${(factor.weight * 100).toFixed(0)}%)`);
  }
  
  console.log('\nRecommendations:');
  for (const rec of risk.recommendations) {
    console.log(`  • ${rec}`);
  }
  console.log();

  // Block deployment if risk is too high
  if (risk.risk_level === 'critical' || risk.risk_level === 'high') {
    console.log('❌ Deployment blocked due to high risk');
    console.log('   Consider:');
    console.log('   - Delaying deployment');
    console.log('   - Using canary rollout');
    console.log('   - Increasing monitoring\n');
    return false; // Block deployment
  }

  console.log('✅ Deployment approved - risk acceptable\n');
  return true; // Allow deployment
}

/**
 * Example 4: Optimal Deployment Window Recommendation
 */
async function deploymentWindowExample() {
  console.log('=== Example 4: Deployment Window Recommendation ===\n');

  // Initialize components
  const storage = new HistoricalStorage('~/.vitals/history');
  const patternEngine = new PatternDetectionEngine(storage);
  const analytics = new PredictiveAnalytics(storage, patternEngine);

  // Get recommendations for next 7 days
  const service = 'api-service';
  console.log(`Finding optimal deployment windows for ${service}...\n`);
  const windows = await analytics.recommendDeploymentWindows(service, 7);

  if (windows.length === 0) {
    console.log('No recommended windows found (weekends excluded)\n');
    return;
  }

  console.log('Recommended Deployment Windows:\n');
  for (const window of windows.slice(0, 3)) {
    const riskIcon = window.risk_level === 'low' ? '✅' :
                     window.risk_level === 'medium' ? '⚠️' : '❌';
    
    const dateStr = window.start_time.toLocaleDateString();
    const startTime = window.start_time.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit' 
    });
    const endTime = window.end_time.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit' 
    });
    
    console.log(`${riskIcon} ${dateStr} ${startTime} - ${endTime} [${window.risk_level}]`);
    console.log(`   Confidence: ${(window.confidence * 100).toFixed(0)}%`);
    for (const reason of window.reasons) {
      console.log(`   • ${reason}`);
    }
    console.log();
  }
}

/**
 * Example 5: Metric Forecasting
 */
async function metricForecastingExample() {
  console.log('=== Example 5: Metric Forecasting ===\n');

  // Initialize components
  const storage = new HistoricalStorage('~/.vitals/history');
  const patternEngine = new PatternDetectionEngine(storage);
  const analytics = new PredictiveAnalytics(storage, patternEngine, {
    forecast_horizon_days: 7,
    min_historical_days: 30
  });

  // Forecast a metric
  const metric = 'latency_p99';
  try {
    console.log(`Forecasting ${metric} for next 7 days...\n`);
    const forecast = await analytics.forecastMetric(metric, 'change_percent');

    console.log('Forecast Results:');
    console.log(`  Type: ${forecast.forecast_type}`);
    console.log(`  Accuracy: R² = ${forecast.accuracy_score?.toFixed(3)}`);
    console.log(`  Slope: ${forecast.metadata?.slope.toFixed(2)}% per day\n`);

    console.log('Predictions:');
    for (let i = 0; i < Math.min(5, forecast.predictions.length); i++) {
      const pred = forecast.predictions[i];
      const lower = forecast.confidence_interval.lower[i];
      const upper = forecast.confidence_interval.upper[i];
      
      const dayStr = pred.timestamp.toLocaleDateString();
      console.log(`  Day ${i + 1} (${dayStr}): ${pred.value.toFixed(2)}% (${lower.toFixed(2)}% - ${upper.toFixed(2)}%)`);
    }
    console.log();

    // Check for concerning trends
    const slope = forecast.metadata?.slope || 0;
    if (slope > 5) {
      console.log('⚠️  Warning: Metric trending upward significantly');
      console.log('   Consider investigating gradual performance degradation\n');
    } else if (slope < -5) {
      console.log('✅ Metric trending downward (improving)\n');
    }
  } catch (error) {
    console.log(`Cannot forecast: ${error.message}\n`);
  }
}

/**
 * Example 6: Complete Insights Report
 */
async function completeInsightsExample() {
  console.log('=== Example 6: Complete Insights Report ===\n');

  // Initialize components
  const storage = new HistoricalStorage('~/.vitals/history');
  const patternEngine = new PatternDetectionEngine(storage);
  const analytics = new PredictiveAnalytics(storage, patternEngine);

  // Generate comprehensive report for multiple services
  const services = ['api-service', 'database-service', 'cache-service'];
  
  console.log('Generating predictive insights report...\n');
  const report = await analytics.generateInsightsReport(services);
  
  console.log(report);
}

/**
 * Example 7: CI/CD Gate Integration
 */
async function cicdGateExample() {
  console.log('=== Example 7: CI/CD Gate Integration ===\n');

  // This is how you'd use VITALS as a deployment gate
  
  // Step 1: Run regression analysis
  console.log('Step 1: Running regression analysis...');
  const configPath = path.join(__dirname, '../../vitals.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
  const batchProcessor = new BatchProcessor(config);
  const results = await batchProcessor.runBatch(config);

  // Step 2: Assess deployment risk
  console.log('Step 2: Assessing deployment risk...');
  const storage = new HistoricalStorage('~/.vitals/history');
  const patternEngine = new PatternDetectionEngine(storage);
  const analytics = new PredictiveAnalytics(storage, patternEngine);
  const risk = await analytics.assessDeploymentRisk('api-service');

  // Step 3: Make gate decision
  console.log('Step 3: Making deployment decision...');
  
  // Check regression results
  const criticalFailures = results.filter(r => r.verdict === 'FAIL' && r.change_percent > 50);
  const hasRegressions = results.some(r => r.verdict === 'FAIL');
  
  // Decision logic
  let shouldDeploy = true;
  const reasons: string[] = [];

  if (criticalFailures.length > 0) {
    shouldDeploy = false;
    reasons.push(`${criticalFailures.length} critical regressions detected (>50% degradation)`);
  }

  if (risk.risk_level === 'critical') {
    shouldDeploy = false;
    reasons.push(`Deployment risk level: CRITICAL (${risk.risk_score}/100)`);
  }

  if (risk.risk_level === 'high') {
    shouldDeploy = false;
    reasons.push(`Deployment risk level: HIGH (${risk.risk_score}/100)`);
  }

  // Step 4: Execute actions
  if (!shouldDeploy) {
    console.log('\n❌ DEPLOYMENT BLOCKED\n');
    console.log('Reasons:');
    for (const reason of reasons) {
      console.log(`  • ${reason}`);
    }
    console.log('\nRecommendations:');
    for (const rec of risk.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log();

    // Exit with failure code for CI/CD
    process.exit(1);
  } else {
    console.log('\n✅ DEPLOYMENT APPROVED\n');
    if (hasRegressions) {
      console.log('⚠️  Non-critical regressions detected - proceed with caution\n');
    }
    
    // Store deployment record
    await storage.storeDeployment({
      service: 'api-service',
      deployment_id: process.env.DEPLOYMENT_ID || 'unknown',
      version: process.env.VERSION || 'unknown',
      environment: process.env.ENVIRONMENT || 'production',
      metadata: {
        risk_score: risk.risk_score,
        regression_count: results.filter(r => r.verdict !== 'PASS').length
      }
    });

    // Exit with success code
    process.exit(0);
  }
}

/**
 * Main function - run all examples
 */
async function main() {
  const args = process.argv.slice(2);
  const example = args[0];

  try {
    switch (example) {
      case '1':
      case 'basic':
        await basicAutomationExample();
        break;
      case '2':
      case 'patterns':
        await patternDetectionExample();
        break;
      case '3':
      case 'risk':
        await riskAssessmentExample();
        break;
      case '4':
      case 'windows':
        await deploymentWindowExample();
        break;
      case '5':
      case 'forecast':
        await metricForecastingExample();
        break;
      case '6':
      case 'insights':
        await completeInsightsExample();
        break;
      case '7':
      case 'gate':
        await cicdGateExample();
        break;
      case 'all':
      default:
        await basicAutomationExample();
        await patternDetectionExample();
        await riskAssessmentExample();
        await deploymentWindowExample();
        await metricForecastingExample();
        await completeInsightsExample();
        break;
    }
  } catch (error) {
    console.error('Error running example:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  console.log('VITALS Phase 4 Integration Examples\n');
  console.log('Usage: ts-node phase4-integration-example.ts [example]\n');
  console.log('Examples:');
  console.log('  1, basic    - Basic automation integration');
  console.log('  2, patterns - Pattern detection');
  console.log('  3, risk     - Deployment risk assessment');
  console.log('  4, windows  - Deployment window recommendations');
  console.log('  5, forecast - Metric forecasting');
  console.log('  6, insights - Complete insights report');
  console.log('  7, gate     - CI/CD gate integration');
  console.log('  all         - Run all examples (default)\n');
  
  main().catch(console.error);
}

export {
  basicAutomationExample,
  patternDetectionExample,
  riskAssessmentExample,
  deploymentWindowExample,
  metricForecastingExample,
  completeInsightsExample,
  cicdGateExample
};
