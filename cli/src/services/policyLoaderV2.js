"use strict";
/**
 * Enhanced policy loader with service-specific policies and inheritance
 */
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
exports.loadPolicy = loadPolicy;
exports.validatePolicy = validatePolicy;
exports.findPolicyConfig = findPolicyConfig;
exports.getServiceMetricPolicy = getServiceMetricPolicy;
exports.getMetricPolicy = getMetricPolicy;
exports.evaluateRegression = evaluateRegression;
exports.evaluateThreshold = evaluateThreshold;
exports.getDefaultOptions = getDefaultOptions;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
/**
 * Load policy configuration from file
 */
function loadPolicy(configPath) {
    try {
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.load(content);
        // Validate version
        if (!config.version || config.version !== 1) {
            throw new Error(`Unsupported policy version: ${config.version}`);
        }
        return config;
    }
    catch (error) {
        console.error(`Failed to load policy: ${error}`);
        return null;
    }
}
/**
 * Validate policy configuration
 */
function validatePolicy(config) {
    const errors = [];
    // Check version
    if (!config.version) {
        errors.push({
            path: 'version',
            message: 'Missing required field: version',
            severity: 'error'
        });
    }
    else if (config.version !== 1) {
        errors.push({
            path: 'version',
            message: `Unsupported version: ${config.version}. Expected: 1`,
            severity: 'error'
        });
    }
    // Validate base policy metrics
    if (config.base?.metrics) {
        validateMetrics(config.base.metrics, 'base.metrics', errors);
    }
    // Validate legacy metrics (for backward compatibility)
    if (config.metrics) {
        validateMetrics(config.metrics, 'metrics', errors);
    }
    // Validate service-specific policies
    if (config.services) {
        for (const [serviceName, servicePolicy] of Object.entries(config.services)) {
            const servicePath = `services.${serviceName}`;
            // Check for inheritance cycles
            if (servicePolicy.inherits) {
                if (!config.services[servicePolicy.inherits]) {
                    errors.push({
                        path: `${servicePath}.inherits`,
                        message: `Inherited service '${servicePolicy.inherits}' not found`,
                        severity: 'error'
                    });
                }
            }
            // Validate service metrics
            if (servicePolicy.metrics) {
                validateMetrics(servicePolicy.metrics, `${servicePath}.metrics`, errors);
            }
        }
    }
    // Validate Prometheus config
    if (config.prometheus?.url) {
        try {
            new URL(config.prometheus.url);
        }
        catch {
            errors.push({
                path: 'prometheus.url',
                message: `Invalid URL: ${config.prometheus.url}`,
                severity: 'error'
            });
        }
    }
    if (config.base?.prometheus?.url) {
        try {
            new URL(config.base.prometheus.url);
        }
        catch {
            errors.push({
                path: 'base.prometheus.url',
                message: `Invalid URL: ${config.base.prometheus.url}`,
                severity: 'error'
            });
        }
    }
    return errors;
}
function validateMetrics(metrics, basePath, errors) {
    for (const [metricName, policy] of Object.entries(metrics)) {
        const metricPath = `${basePath}.${metricName}`;
        if (policy.regression) {
            const reg = policy.regression;
            if (reg.max_increase_percent !== undefined) {
                if (reg.max_increase_percent < 0) {
                    errors.push({
                        path: `${metricPath}.regression.max_increase_percent`,
                        message: 'Must be a positive number',
                        severity: 'error'
                    });
                }
            }
            if (reg.p_value !== undefined) {
                if (reg.p_value < 0 || reg.p_value > 1) {
                    errors.push({
                        path: `${metricPath}.regression.p_value`,
                        message: 'Must be between 0 and 1',
                        severity: 'error'
                    });
                }
            }
            if (reg.effect_size !== undefined) {
                if (reg.effect_size < 0) {
                    errors.push({
                        path: `${metricPath}.regression.effect_size`,
                        message: 'Must be a positive number',
                        severity: 'error'
                    });
                }
            }
            if (reg.action && !['fail', 'warn', 'ignore'].includes(reg.action)) {
                errors.push({
                    path: `${metricPath}.regression.action`,
                    message: `Invalid action: ${reg.action}. Must be 'fail', 'warn', or 'ignore'`,
                    severity: 'error'
                });
            }
        }
        if (policy.threshold) {
            const thresh = policy.threshold;
            if (thresh.max !== undefined && thresh.min !== undefined) {
                if (thresh.max < thresh.min) {
                    errors.push({
                        path: `${metricPath}.threshold`,
                        message: 'max must be greater than min',
                        severity: 'error'
                    });
                }
            }
            if (thresh.action && !['fail', 'warn', 'ignore'].includes(thresh.action)) {
                errors.push({
                    path: `${metricPath}.threshold.action`,
                    message: `Invalid action: ${thresh.action}. Must be 'fail', 'warn', or 'ignore'`,
                    severity: 'error'
                });
            }
        }
    }
}
/**
 * Find policy config file in current directory or parent directories
 */
function findPolicyConfig(startDir = process.cwd()) {
    const fileName = 'vitals.yaml';
    let currentDir = startDir;
    // Search up to 5 levels
    for (let i = 0; i < 5; i++) {
        const configPath = path.join(currentDir, fileName);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break; // Reached root
        }
        currentDir = parentDir;
    }
    return null;
}
/**
 * Get metric policy for a specific service (with inheritance)
 */
function getServiceMetricPolicy(config, serviceName, metricName) {
    // If service specified, look for service-specific policy
    if (serviceName && config.services && config.services[serviceName]) {
        const servicePolicy = config.services[serviceName];
        // Check service-specific metric policy first
        if (servicePolicy.metrics && servicePolicy.metrics[metricName]) {
            return mergeMetricPolicies(getBaseMetricPolicy(config, metricName), servicePolicy.metrics[metricName]);
        }
        // Check inherited service policy
        if (servicePolicy.inherits) {
            const inheritedPolicy = getServiceMetricPolicy(config, servicePolicy.inherits, metricName);
            if (inheritedPolicy) {
                return inheritedPolicy;
            }
        }
    }
    // Fall back to base or global policy
    return getBaseMetricPolicy(config, metricName);
}
/**
 * Get base metric policy (from base or global metrics)
 */
function getBaseMetricPolicy(config, metricName) {
    // Check base policy first
    if (config.base?.metrics && config.base.metrics[metricName]) {
        return config.base.metrics[metricName];
    }
    // Fall back to legacy global metrics
    if (config.metrics && config.metrics[metricName]) {
        return config.metrics[metricName];
    }
    return null;
}
/**
 * Merge two metric policies (child overrides parent)
 */
function mergeMetricPolicies(base, override) {
    if (!base) {
        return override;
    }
    return {
        regression: {
            ...base.regression,
            ...override.regression
        },
        threshold: {
            ...base.threshold,
            ...override.threshold
        }
    };
}
/**
 * Get metric policy from configuration (legacy function for backward compatibility)
 */
function getMetricPolicy(config, metricName) {
    return getServiceMetricPolicy(config, null, metricName);
}
/**
 * Evaluate regression result against policy
 */
function evaluateRegression(metricName, changePercent, pValue, effectSize, significant, policy) {
    // Default policy if none specified
    const defaultPolicy = {
        regression: {
            max_increase_percent: 10,
            p_value: 0.05,
            effect_size: 0.5,
            action: 'fail'
        }
    };
    const activePolicy = policy || defaultPolicy;
    const regressionPolicy = activePolicy.regression || defaultPolicy.regression;
    const maxIncrease = regressionPolicy.max_increase_percent || 10;
    const action = regressionPolicy.action || 'fail';
    // Check if regression exceeds threshold
    const exceedsThreshold = Math.abs(changePercent) > maxIncrease;
    const isRegression = changePercent > 0; // Positive change is regression (latency increase)
    if (significant && exceedsThreshold && isRegression) {
        const reason = `Regression detected: ${changePercent.toFixed(1)}% increase (threshold: ${maxIncrease}%, p=${pValue.toFixed(3)}, effect=${effectSize.toFixed(2)})`;
        return {
            action: action === 'ignore' ? 'pass' : action,
            reason,
            shouldRollback: action === 'fail' && (activePolicy.regression?.action === 'fail')
        };
    }
    else if (exceedsThreshold && isRegression) {
        // Exceeds threshold but not statistically significant
        return {
            action: 'warn',
            reason: `Possible regression: ${changePercent.toFixed(1)}% increase, but not statistically significant (p=${pValue.toFixed(3)})`,
            shouldRollback: false
        };
    }
    return {
        action: 'pass',
        reason: `No significant regression detected (change: ${changePercent.toFixed(1)}%)`,
        shouldRollback: false
    };
}
/**
 * Evaluate threshold policy (for absolute metric values)
 */
function evaluateThreshold(metricName, value, policy) {
    if (!policy || !policy.threshold) {
        return {
            action: 'pass',
            reason: 'No threshold policy defined',
            shouldRollback: false
        };
    }
    const { max, min, action = 'fail' } = policy.threshold;
    if (max !== undefined && value > max) {
        return {
            action: action === 'ignore' ? 'pass' : action,
            reason: `Value ${value.toFixed(2)} exceeds maximum threshold ${max}`,
            shouldRollback: action === 'fail'
        };
    }
    if (min !== undefined && value < min) {
        return {
            action: action === 'ignore' ? 'pass' : action,
            reason: `Value ${value.toFixed(2)} below minimum threshold ${min}`,
            shouldRollback: action === 'fail'
        };
    }
    return {
        action: 'pass',
        reason: 'Within threshold limits',
        shouldRollback: false
    };
}
/**
 * Get default options from policy config (with service override)
 */
function getDefaultOptions(config, serviceName) {
    if (!config) {
        return {
            prometheusUrl: 'http://localhost:9090',
            timeout: 10000
        };
    }
    // Service-specific Prometheus config
    if (serviceName && config.services && config.services[serviceName]?.prometheus) {
        const servicePrometheus = config.services[serviceName].prometheus;
        return {
            prometheusUrl: servicePrometheus.url || 'http://localhost:9090',
            timeout: servicePrometheus.timeout || 10000
        };
    }
    // Base Prometheus config
    if (config.base?.prometheus) {
        return {
            prometheusUrl: config.base.prometheus.url || 'http://localhost:9090',
            timeout: config.base.prometheus.timeout || 10000
        };
    }
    // Legacy global Prometheus config
    if (config.prometheus) {
        return {
            prometheusUrl: config.prometheus.url || 'http://localhost:9090',
            timeout: config.prometheus.timeout || 10000
        };
    }
    return {
        prometheusUrl: 'http://localhost:9090',
        timeout: 10000
    };
}
