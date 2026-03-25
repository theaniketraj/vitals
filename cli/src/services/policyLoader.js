"use strict";
/**
 * Policy loader and evaluator for vitals.yaml configuration
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
exports.findPolicyConfig = findPolicyConfig;
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
 * Get metric policy from configuration
 */
function getMetricPolicy(config, metricName) {
    if (!config.metrics || !config.metrics[metricName]) {
        return null;
    }
    return config.metrics[metricName];
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
 * Get default options from policy config
 */
function getDefaultOptions(config) {
    return {
        prometheusUrl: config?.prometheus?.url || 'http://localhost:9090',
        timeout: config?.prometheus?.timeout || 10000
    };
}
