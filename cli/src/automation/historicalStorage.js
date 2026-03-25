"use strict";
/**
 * VITALS Historical Data Storage
 *
 * Stores regression analysis results for pattern detection and trend analysis
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
exports.HistoricalStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Historical data storage manager
 */
class HistoricalStorage {
    constructor(config) {
        this.regressionCache = new Map();
        this.deploymentCache = new Map();
        this.incidentCache = new Map();
        this.config = {
            max_records: 10000,
            retention_days: 90,
            compress: false,
            ...config
        };
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.config.data_dir)) {
            fs.mkdirSync(this.config.data_dir, { recursive: true });
        }
    }
    /**
     * Store a regression result
     */
    async storeRegression(result, metadata) {
        const record = {
            id: this.generateId(),
            timestamp: new Date(),
            metric: result.metric,
            baseline_label: metadata?.baseline_label || 'unknown',
            candidate_label: metadata?.candidate_label || 'unknown',
            verdict: result.verdict,
            change_percent: result.change_percent,
            p_value: result.p_value,
            effect_size: result.effect_size,
            baseline_mean: result.baseline.mean,
            candidate_mean: result.candidate.mean,
            metadata
        };
        await this.appendRecord('regressions', result.metric, record);
        // Update cache
        const metricKey = result.metric;
        if (!this.regressionCache.has(metricKey)) {
            this.regressionCache.set(metricKey, []);
        }
        this.regressionCache.get(metricKey).push(record);
    }
    /**
     * Store batch results
     */
    async storeBatchResults(batchResult, metadata) {
        const promises = [];
        for (const [, result] of batchResult.results) {
            if (!(result instanceof Error) && 'verdict' in result) {
                promises.push(this.storeRegression(result, metadata));
            }
        }
        await Promise.all(promises);
    }
    /**
     * Store deployment metadata
     */
    async storeDeployment(deployment) {
        await this.appendRecord('deployments', deployment.service, deployment);
        const serviceKey = deployment.service;
        if (!this.deploymentCache.has(serviceKey)) {
            this.deploymentCache.set(serviceKey, []);
        }
        this.deploymentCache.get(serviceKey).push(deployment);
    }
    /**
     * Store incident record
     */
    async storeIncident(incident) {
        await this.appendRecord('incidents', incident.service, incident);
        const serviceKey = incident.service;
        if (!this.incidentCache.has(serviceKey)) {
            this.incidentCache.set(serviceKey, []);
        }
        this.incidentCache.get(serviceKey).push(incident);
    }
    /**
     * Query regressions for a metric
     */
    async queryRegressions(metric, options) {
        // Check cache first
        if (this.regressionCache.has(metric)) {
            return this.filterRecords(this.regressionCache.get(metric), options);
        }
        // Load from disk
        const records = await this.loadRecords('regressions', metric);
        this.regressionCache.set(metric, records);
        return this.filterRecords(records, options);
    }
    /**
     * Query deployments for a service
     */
    async queryDeployments(service, options) {
        // Check cache first
        if (this.deploymentCache.has(service)) {
            return this.filterDeployments(this.deploymentCache.get(service), options);
        }
        // Load from disk
        const records = await this.loadRecords('deployments', service);
        this.deploymentCache.set(service, records);
        return this.filterDeployments(records, options);
    }
    /**
     * Query incidents for a service
     */
    async queryIncidents(service, options) {
        // Check cache first
        if (this.incidentCache.has(service)) {
            return this.filterIncidents(this.incidentCache.get(service), options);
        }
        // Load from disk
        const records = await this.loadRecords('incidents', service);
        this.incidentCache.set(service, records);
        return this.filterIncidents(records, options);
    }
    /**
     * Get time series data for a metric
     */
    async getTimeSeries(metric, field, options) {
        const records = await this.queryRegressions(metric, options);
        return records
            .filter(r => r[field] !== undefined)
            .map(r => ({
            timestamp: r.timestamp,
            value: r[field],
            metadata: { verdict: r.verdict }
        }));
    }
    /**
     * Get regression statistics for a metric
     */
    async getRegressionStats(metric, days = 30) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const records = await this.queryRegressions(metric, { start_date: startDate });
        const total = records.length;
        const passed = records.filter(r => r.verdict === 'PASS').length;
        const failed = records.filter(r => r.verdict === 'FAIL').length;
        const warned = records.filter(r => r.verdict === 'WARN').length;
        const totalChanges = records
            .filter(r => r.change_percent !== undefined)
            .map(r => r.change_percent);
        const avgChange = totalChanges.length > 0
            ? totalChanges.reduce((sum, val) => sum + val, 0) / totalChanges.length
            : 0;
        return {
            total,
            passed,
            failed,
            warned,
            failure_rate: total > 0 ? failed / total : 0,
            avg_change_percent: avgChange
        };
    }
    /**
     * Cleanup old records based on retention policy
     */
    async cleanup() {
        if (!this.config.retention_days) {
            return { deleted: 0, retained: 0 };
        }
        const cutoffDate = new Date(Date.now() - this.config.retention_days * 24 * 60 * 60 * 1000);
        let deleted = 0;
        let retained = 0;
        // Cleanup each type of data
        const types = ['regressions', 'deployments', 'incidents'];
        for (const type of types) {
            const typeDir = path.join(this.config.data_dir, type);
            if (!fs.existsSync(typeDir))
                continue;
            const files = fs.readdirSync(typeDir);
            for (const file of files) {
                const filePath = path.join(typeDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const records = content.split('\n')
                    .filter(line => line.trim())
                    .map(line => JSON.parse(line));
                const filtered = records.filter((record) => {
                    const timestamp = new Date(record.timestamp);
                    if (timestamp < cutoffDate) {
                        deleted++;
                        return false;
                    }
                    retained++;
                    return true;
                });
                // Rewrite file with filtered records
                const newContent = filtered.map(r => JSON.stringify(r)).join('\n') + '\n';
                fs.writeFileSync(filePath, newContent, 'utf-8');
            }
        }
        return { deleted, retained };
    }
    /**
     * Export data to JSON
     */
    async exportToJSON(outputPath) {
        const data = {
            regressions: {},
            deployments: {},
            incidents: {}
        };
        // Export regressions
        const regressionsDir = path.join(this.config.data_dir, 'regressions');
        if (fs.existsSync(regressionsDir)) {
            const files = fs.readdirSync(regressionsDir);
            for (const file of files) {
                const metric = file.replace('.jsonl', '');
                data.regressions[metric] = await this.loadRecords('regressions', metric);
            }
        }
        // Export deployments
        const deploymentsDir = path.join(this.config.data_dir, 'deployments');
        if (fs.existsSync(deploymentsDir)) {
            const files = fs.readdirSync(deploymentsDir);
            for (const file of files) {
                const service = file.replace('.jsonl', '');
                data.deployments[service] = await this.loadRecords('deployments', service);
            }
        }
        // Export incidents
        const incidentsDir = path.join(this.config.data_dir, 'incidents');
        if (fs.existsSync(incidentsDir)) {
            const files = fs.readdirSync(incidentsDir);
            for (const file of files) {
                const service = file.replace('.jsonl', '');
                data.incidents[service] = await this.loadRecords('incidents', service);
            }
        }
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    // Private helper methods
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async appendRecord(type, key, record) {
        const typeDir = path.join(this.config.data_dir, type);
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, { recursive: true });
        }
        const filePath = path.join(typeDir, `${this.sanitizeKey(key)}.jsonl`);
        const line = JSON.stringify(record) + '\n';
        fs.appendFileSync(filePath, line, 'utf-8');
    }
    async loadRecords(type, key) {
        const filePath = path.join(this.config.data_dir, type, `${this.sanitizeKey(key)}.jsonl`);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return content
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    }
    sanitizeKey(key) {
        return key.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    filterRecords(records, options) {
        let filtered = [...records];
        if (options?.start_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date);
        }
        if (options?.end_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date);
        }
        if (options?.verdict) {
            filtered = filtered.filter(r => r.verdict === options.verdict);
        }
        // Sort by timestamp descending
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    filterDeployments(records, options) {
        let filtered = [...records];
        if (options?.start_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date);
        }
        if (options?.end_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date);
        }
        if (options?.environment) {
            filtered = filtered.filter(r => r.environment === options.environment);
        }
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    filterIncidents(records, options) {
        let filtered = [...records];
        if (options?.start_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date);
        }
        if (options?.end_date) {
            filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date);
        }
        if (options?.severity) {
            filtered = filtered.filter(r => r.severity === options.severity);
        }
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
}
exports.HistoricalStorage = HistoricalStorage;
