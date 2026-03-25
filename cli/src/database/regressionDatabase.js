"use strict";
/**
 * VITALS Regression Database
 *
 * Structured storage and querying for regression analysis results.
 * Provides rich querying capabilities beyond simple JSONL storage.
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
exports.RegressionDatabase = void 0;
exports.migrateFromHistoricalStorage = migrateFromHistoricalStorage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const readdir = (0, util_1.promisify)(fs.readdir);
const stat = (0, util_1.promisify)(fs.stat);
/**
 * SQLite-based regression database implementation
 *
 * Uses a simple JSON file-based approach that mimics SQL-like querying.
 * For production, this could be replaced with actual SQLite, PostgreSQL, or TimescaleDB.
 */
class RegressionDatabase {
    constructor(basePath = '~/.vitals/database') {
        this.loaded = false;
        // Expand home directory
        if (basePath.startsWith('~')) {
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            basePath = path.join(homeDir, basePath.slice(2));
        }
        this.basePath = basePath;
        this.indexPath = path.join(basePath, 'index.json');
        this.dataPath = path.join(basePath, 'regressions');
        this.index = new Map();
    }
    /**
     * Initialize database
     */
    async initialize() {
        // Create directories
        await mkdir(this.basePath, { recursive: true });
        await mkdir(this.dataPath, { recursive: true });
        // Load index
        await this.loadIndex();
        this.loaded = true;
    }
    /**
     * Insert a single regression record
     */
    async insert(record) {
        await this.ensureLoaded();
        // Generate ID if not provided
        if (!record.id) {
            record.id = this.generateId(record);
        }
        // Validate timestamp
        if (!(record.timestamp instanceof Date)) {
            record.timestamp = new Date(record.timestamp);
        }
        // Store record
        await this.writeRecord(record);
        // Update index
        this.index.set(record.id, record);
        await this.saveIndex();
        return record.id;
    }
    /**
     * Insert multiple regression records
     */
    async insertBatch(records) {
        await this.ensureLoaded();
        const ids = [];
        for (const record of records) {
            if (!record.id) {
                record.id = this.generateId(record);
            }
            if (!(record.timestamp instanceof Date)) {
                record.timestamp = new Date(record.timestamp);
            }
            await this.writeRecord(record);
            this.index.set(record.id, record);
            ids.push(record.id);
        }
        await this.saveIndex();
        return ids;
    }
    /**
     * Query regression records with filters
     */
    async query(filter) {
        await this.ensureLoaded();
        let results = Array.from(this.index.values());
        // Apply filters
        results = this.applyFilters(results, filter);
        // Sort
        results = this.sortResults(results, filter);
        // Paginate
        if (filter.offset !== undefined) {
            results = results.slice(filter.offset);
        }
        if (filter.limit !== undefined) {
            results = results.slice(0, filter.limit);
        }
        return results;
    }
    /**
     * Get record by ID
     */
    async getById(id) {
        await this.ensureLoaded();
        return this.index.get(id) || null;
    }
    /**
     * Update a record
     */
    async update(id, updates) {
        await this.ensureLoaded();
        const record = this.index.get(id);
        if (!record) {
            throw new Error(`Record not found: ${id}`);
        }
        // Apply updates
        Object.assign(record, updates);
        // Write updated record
        await this.writeRecord(record);
        await this.saveIndex();
    }
    /**
     * Delete a record
     */
    async delete(id) {
        await this.ensureLoaded();
        const record = this.index.get(id);
        if (!record) {
            return;
        }
        // Delete file
        const filePath = this.getRecordPath(record);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (error) {
            // File might not exist, ignore
        }
        // Remove from index
        this.index.delete(id);
        await this.saveIndex();
    }
    /**
     * Aggregate records by field
     */
    async aggregate(groupBy, filter) {
        await this.ensureLoaded();
        let records = Array.from(this.index.values());
        if (filter) {
            records = this.applyFilters(records, filter);
        }
        // Group records
        const groups = new Map();
        for (const record of records) {
            const key = record[groupBy] || 'unknown';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(record);
        }
        // Calculate aggregations
        const results = [];
        for (const [value, groupRecords] of groups) {
            const passCount = groupRecords.filter(r => r.verdict === 'PASS').length;
            const warnCount = groupRecords.filter(r => r.verdict === 'WARN').length;
            const failCount = groupRecords.filter(r => r.verdict === 'FAIL').length;
            const changePercents = groupRecords.map(r => r.change_percent);
            const avgChange = changePercents.reduce((sum, val) => sum + val, 0) / changePercents.length;
            const maxChange = Math.max(...changePercents);
            const minChange = Math.min(...changePercents);
            results.push({
                group_by: groupBy,
                value,
                count: groupRecords.length,
                pass_count: passCount,
                warn_count: warnCount,
                fail_count: failCount,
                avg_change_percent: avgChange,
                max_change_percent: maxChange,
                min_change_percent: minChange
            });
        }
        return results.sort((a, b) => b.count - a.count);
    }
    /**
     * Get time series data
     */
    async getTimeSeries(metric, field, interval, filter) {
        await this.ensureLoaded();
        let records = Array.from(this.index.values()).filter(r => r.metric === metric);
        if (filter) {
            records = this.applyFilters(records, filter);
        }
        // Sort by timestamp
        records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        // Group by interval
        const groups = new Map();
        const intervalMs = interval === 'hour' ? 3600000 : interval === 'day' ? 86400000 : 604800000;
        for (const record of records) {
            const bucket = Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
            if (!groups.has(bucket)) {
                groups.set(bucket, []);
            }
            groups.get(bucket).push(record);
        }
        // Calculate averages for each bucket
        const results = [];
        for (const [bucket, groupRecords] of groups) {
            const values = groupRecords.map(r => r[field]).filter(v => typeof v === 'number');
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            results.push({
                timestamp: new Date(bucket),
                value: avg,
                count: groupRecords.length
            });
        }
        return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    /**
     * Count records matching filter
     */
    async count(filter) {
        await this.ensureLoaded();
        if (!filter) {
            return this.index.size;
        }
        const records = Array.from(this.index.values());
        return this.applyFilters(records, filter).length;
    }
    // Private helper methods
    async ensureLoaded() {
        if (!this.loaded) {
            await this.initialize();
        }
    }
    generateId(record) {
        const timestamp = record.timestamp.getTime();
        const hash = `${record.service}-${record.metric}-${timestamp}`;
        return Buffer.from(hash).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
    }
    getRecordPath(record) {
        const year = record.timestamp.getFullYear();
        const month = String(record.timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(record.timestamp.getDate()).padStart(2, '0');
        return path.join(this.dataPath, record.service, `${year}-${month}-${day}`, `${record.id}.json`);
    }
    async writeRecord(record) {
        const filePath = this.getRecordPath(record);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    }
    async loadIndex() {
        try {
            const data = await readFile(this.indexPath, 'utf8');
            const records = JSON.parse(data);
            this.index.clear();
            for (const record of records) {
                record.timestamp = new Date(record.timestamp);
                this.index.set(record.id, record);
            }
        }
        catch (error) {
            // Index doesn't exist yet, start fresh
            this.index.clear();
        }
    }
    async saveIndex() {
        const records = Array.from(this.index.values());
        await writeFile(this.indexPath, JSON.stringify(records, null, 2), 'utf8');
    }
    applyFilters(records, filter) {
        return records.filter(record => {
            // Service filter
            if (filter.service) {
                const services = Array.isArray(filter.service) ? filter.service : [filter.service];
                if (!services.includes(record.service))
                    return false;
            }
            // Metric filter
            if (filter.metric) {
                const metrics = Array.isArray(filter.metric) ? filter.metric : [filter.metric];
                if (!metrics.includes(record.metric))
                    return false;
            }
            // Verdict filter
            if (filter.verdict) {
                const verdicts = Array.isArray(filter.verdict) ? filter.verdict : [filter.verdict];
                if (!verdicts.includes(record.verdict))
                    return false;
            }
            // Environment filter
            if (filter.environment) {
                const environments = Array.isArray(filter.environment) ? filter.environment : [filter.environment];
                if (!record.environment || !environments.includes(record.environment))
                    return false;
            }
            // Date range
            if (filter.start_date && record.timestamp < filter.start_date)
                return false;
            if (filter.end_date && record.timestamp > filter.end_date)
                return false;
            // Statistical filters
            if (filter.min_change_percent !== undefined && record.change_percent < filter.min_change_percent)
                return false;
            if (filter.max_change_percent !== undefined && record.change_percent > filter.max_change_percent)
                return false;
            if (filter.min_p_value !== undefined && (record.p_value === undefined || record.p_value < filter.min_p_value))
                return false;
            if (filter.max_p_value !== undefined && (record.p_value === undefined || record.p_value > filter.max_p_value))
                return false;
            // Tags filter
            if (filter.tags && filter.tags.length > 0) {
                if (!record.tags)
                    return false;
                if (filter.tags_mode === 'all') {
                    if (!filter.tags.every(tag => record.tags.includes(tag)))
                        return false;
                }
                else {
                    if (!filter.tags.some(tag => record.tags.includes(tag)))
                        return false;
                }
            }
            // Deployment filter
            if (filter.deployment_id && record.deployment_id !== filter.deployment_id)
                return false;
            if (filter.commit_hash && record.commit_hash !== filter.commit_hash)
                return false;
            return true;
        });
    }
    sortResults(records, filter) {
        if (!filter.sort_by) {
            return records;
        }
        const sortOrder = filter.sort_order === 'asc' ? 1 : -1;
        return records.sort((a, b) => {
            let aVal;
            let bVal;
            switch (filter.sort_by) {
                case 'timestamp':
                    aVal = a.timestamp.getTime();
                    bVal = b.timestamp.getTime();
                    break;
                case 'change_percent':
                    aVal = a.change_percent;
                    bVal = b.change_percent;
                    break;
                case 'p_value':
                    aVal = a.p_value || Infinity;
                    bVal = b.p_value || Infinity;
                    break;
                case 'service':
                    aVal = a.service;
                    bVal = b.service;
                    break;
                case 'metric':
                    aVal = a.metric;
                    bVal = b.metric;
                    break;
                default:
                    return 0;
            }
            if (aVal < bVal)
                return -sortOrder;
            if (aVal > bVal)
                return sortOrder;
            return 0;
        });
    }
}
exports.RegressionDatabase = RegressionDatabase;
/**
 * Export helper to convert Phase 4 historical storage to regression database
 */
async function migrateFromHistoricalStorage(historicalStoragePath, database) {
    let count = 0;
    const regressionsDir = path.join(historicalStoragePath, 'regressions');
    if (!fs.existsSync(regressionsDir)) {
        return count;
    }
    const files = await readdir(regressionsDir);
    for (const file of files) {
        if (!file.endsWith('.jsonl')) {
            continue;
        }
        const metric = file.replace(/\.jsonl$/, '').replace(/_/g, ':');
        const filePath = path.join(regressionsDir, file);
        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) {
            continue;
        }
        const content = await readFile(filePath, 'utf8');
        const records = content
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => JSON.parse(line));
        for (const record of records) {
            await database.insert({
                id: typeof record.id === 'string' ? record.id : '',
                timestamp: new Date(record.timestamp || Date.now()),
                service: typeof record.metadata === 'object' && record.metadata !== null && typeof record.metadata.service === 'string'
                    ? record.metadata.service
                    : 'unknown',
                metric: typeof record.metric === 'string' ? record.metric : metric,
                verdict: record.verdict || 'WARN',
                baseline_mean: typeof record.baseline_mean === 'number' ? record.baseline_mean : 0,
                baseline_stddev: 0,
                baseline_sample_count: 0,
                candidate_mean: typeof record.candidate_mean === 'number' ? record.candidate_mean : 0,
                candidate_stddev: 0,
                candidate_sample_count: 0,
                change_percent: typeof record.change_percent === 'number' ? record.change_percent : 0,
                p_value: typeof record.p_value === 'number' ? record.p_value : undefined,
                effect_size: typeof record.effect_size === 'number' ? record.effect_size : undefined,
                deployment_id: typeof record.candidate_label === 'string' ? record.candidate_label : undefined,
                tags: typeof record.metadata === 'object' && record.metadata !== null && Array.isArray(record.metadata.tags)
                    ? record.metadata.tags
                    : undefined,
                metadata: typeof record.metadata === 'object' && record.metadata !== null
                    ? record.metadata
                    : undefined
            });
            count += 1;
        }
    }
    return count;
}
