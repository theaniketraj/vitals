"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerValidateCommand = registerValidateCommand;
const policyLoaderV2_1 = require("../services/policyLoaderV2");
const fs = __importStar(require("fs"));
function registerValidateCommand(program) {
    program
        .command('validate')
        .description('Validate vitals.yaml policy configuration')
        .argument('[config]', 'Path to vitals.yaml file', 'vitals.yaml')
        .option('--strict', 'Treat warnings as errors', false)
        .option('--format <format>', 'Output format: json or pretty', 'pretty')
        .action(async (configPath, options) => {
        try {
            // Check if file exists
            if (!fs.existsSync(configPath)) {
                console.error(`Error: Config file not found: ${configPath}`);
                process.exit(2);
            }
            console.error(`Validating: ${configPath}\n`);
            // Load policy
            const policy = (0, policyLoaderV2_1.loadPolicy)(configPath);
            if (!policy) {
                console.error('Failed to load policy file');
                process.exit(2);
            }
            // Validate policy
            const errors = (0, policyLoaderV2_1.validatePolicy)(policy);
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
            }
            else {
                printPrettyValidation(configPath, policy, errors, options.strict);
            }
            // Exit with appropriate code
            const hasErrors = errors.some(e => e.severity === 'error');
            const hasWarnings = errors.some(e => e.severity === 'warning');
            if (hasErrors) {
                process.exit(1);
            }
            else if (hasWarnings && options.strict) {
                process.exit(1);
            }
            else {
                process.exit(0);
            }
        }
        catch (error) {
            console.error(`\nValidation failed: ${error.message}`);
            process.exit(2);
        }
    });
}
function printPrettyValidation(configPath, policy, errors, strict) {
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
    }
    else {
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
function printPolicySummary(policy) {
    console.log('Policy Summary:\n');
    // Base metrics
    if (policy.base?.metrics) {
        const metricCount = Object.keys(policy.base.metrics).length;
        console.log(`  Base Metrics: ${metricCount}`);
        for (const [name, config] of Object.entries(policy.base.metrics)) {
            const actions = [];
            if (config.regression)
                actions.push('regression');
            if (config.threshold)
                actions.push('threshold');
            console.log(`    - ${name} (${actions.join(', ')})`);
        }
        console.log('');
    }
    // Legacy metrics
    if (policy.metrics && !policy.base) {
        const metricCount = Object.keys(policy.metrics).length;
        console.log(`  Metrics: ${metricCount}`);
        for (const [name, config] of Object.entries(policy.metrics)) {
            const actions = [];
            if (config.regression)
                actions.push('regression');
            if (config.threshold)
                actions.push('threshold');
            console.log(`    - ${name} (${actions.join(', ')})`);
        }
        console.log('');
    }
    // Services
    if (policy.services) {
        const serviceCount = Object.keys(policy.services).length;
        console.log(`  Services: ${serviceCount}`);
        for (const [name, config] of Object.entries(policy.services)) {
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
