import { Command } from 'commander';
import { loadPolicy, validatePolicy } from '../services/policyLoaderV2';
import * as fs from 'fs';

export function registerValidateCommand(program: Command) {
  program
    .command('validate')
    .description('Validate vitals.yaml policy configuration')
    .argument('[config]', 'Path to vitals.yaml file', 'vitals.yaml')
    .option('--strict', 'Treat warnings as errors', false)
    .option('--format <format>', 'Output format: json or pretty', 'pretty')
    .action(async (configPath: string, options) => {
      try {
        // Check if file exists
        if (!fs.existsSync(configPath)) {
          console.error(`Error: Config file not found: ${configPath}`);
          process.exit(2);
        }

        console.error(`Validating: ${configPath}\n`);

        // Load policy
        const policy = loadPolicy(configPath);
        if (!policy) {
          console.error('Failed to load policy file');
          process.exit(2);
        }

        // Validate policy
        const errors = validatePolicy(policy);

        if (options.format === 'json') {
          console.log(JSON.stringify({
            file: configPath,
            valid: errors.length === 0,
            errors: errors.map(e => ({
              path: e.path,
              message: e.message,
              severity: e.severity
            }))
          }, null, 2));
        } else {
          printPrettyValidation(configPath, policy, errors, options.strict);
        }

        // Exit with appropriate code
        const hasErrors = errors.some(e => e.severity === 'error');
        const hasWarnings = errors.some(e => e.severity === 'warning');

        if (hasErrors) {
          process.exit(1);
        } else if (hasWarnings && options.strict) {
          process.exit(1);
        } else {
          process.exit(0);
        }

      } catch (error) {
        console.error(`\nValidation failed: ${(error as Error).message}`);
        process.exit(2);
      }
    });
}

function printPrettyValidation(
  configPath: string,
  policy: any,
  errors: Array<{ path: string; message: string; severity: string }>,
  strict: boolean
) {
  console.log('━'.repeat(80));
  console.log('  VITALS Policy Validation');
  console.log('━'.repeat(80));
  console.log(`  File: ${configPath}`);
  console.log(`  Version: ${policy.version}`);
  console.log('━'.repeat(80));
  console.log('');

  if (errors.length === 0) {
    console.log('Policy is valid!\n');
    
    // Print summary
    printPolicySummary(policy);
  } else {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    console.log(`Found ${errorCount} error(s) and ${warningCount} warning(s):\n`);

    for (const error of errors) {
      const icon = error.severity === 'error' ? '❌' : '⚠️';
      console.log(`  ${icon} [${error.severity.toUpperCase()}] ${error.path}`);
      console.log(`     ${error.message}\n`);
    }

    if (strict && warningCount > 0) {
      console.log('Running in strict mode - warnings treated as errors\n');
    }
  }

  console.log('━'.repeat(80));
}

function printPolicySummary(policy: any) {
  console.log('Policy Summary:\n');

  // Base metrics
  if (policy.base?.metrics) {
    const metricCount = Object.keys(policy.base.metrics).length;
    console.log(`  Base Metrics: ${metricCount}`);
    for (const [name, config] of Object.entries(policy.base.metrics) as any) {
      const actions = [];
      if (config.regression) actions.push('regression');
      if (config.threshold) actions.push('threshold');
      console.log(`    - ${name} (${actions.join(', ')})`);
    }
    console.log('');
  }

  // Legacy metrics
  if (policy.metrics && !policy.base) {
    const metricCount = Object.keys(policy.metrics).length;
    console.log(`  Metrics: ${metricCount}`);
    for (const [name, config] of Object.entries(policy.metrics) as any) {
      const actions = [];
      if (config.regression) actions.push('regression');
      if (config.threshold) actions.push('threshold');
      console.log(`    - ${name} (${actions.join(', ')})`);
    }
    console.log('');
  }

  // Services
  if (policy.services) {
    const serviceCount = Object.keys(policy.services).length;
    console.log(`  Services: ${serviceCount}`);
    for (const [name, config] of Object.entries(policy.services) as any) {
      const metricCount = config.metrics ? Object.keys(config.metrics).length : 0;
      const inherits = config.inherits ? ` (inherits: ${config.inherits})` : '';
      console.log(`    - ${name}: ${metricCount} metric(s)${inherits}`);
    }
    console.log('');
  }

  // Prometheus
  if (policy.prometheus?.url || policy.base?.prometheus?.url) {
    const url = policy.base?.prometheus?.url || policy.prometheus?.url;
    console.log(`  Prometheus: ${url}`);
    console.log('');
  }

  // Deployment
  if (policy.deployment || policy.base?.deployment) {
    const deployment = policy.base?.deployment || policy.deployment;
    if (deployment.rollback) {
      console.log(`  Rollback: ${deployment.rollback.enabled ? 'Enabled' : 'Disabled'}`);
      if (deployment.rollback.strategy) {
        console.log(`  Strategy: ${deployment.rollback.strategy}`);
      }
      console.log('');
    }
  }
}
