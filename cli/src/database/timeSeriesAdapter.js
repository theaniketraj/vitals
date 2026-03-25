"use strict";
/**
 * VITALS Time-Series Database Adapters
 *
 * Abstract interface and implementations for time-series storage:
 * - File-based (JSON) - for prototyping
 * - InfluxDB - purpose-built time-series database
 * - TimescaleDB - PostgreSQL extension for time-series
 * - Prometheus - metrics storage and querying
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
exports.TimeSeriesAdapterFactory = exports.PrometheusAdapter = exports.TimescaleDBAdapter = exports.InfluxDBAdapter = exports.FileTimeSeriesAdapter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * File-based adapter (JSON storage)
 */
class FileTimeSeriesAdapter {
    constructor(storageDir = './vitals-data/timeseries') {
        this.storageDir = storageDir;
        this.data = new Map();
    }
    async connect() {
        // Ensure storage directory exists
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
        // Load existing data
        const files = fs.readdirSync(this.storageDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const measurement = path.basename(file, '.json');
                const filePath = path.join(this.storageDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const points = JSON.parse(content, (key, value) => {
                    // Restore Date objects
                    if (key === 'timestamp' && typeof value === 'string') {
                        return new Date(value);
                    }
                    return value;
                });
                this.data.set(measurement, points);
            }
        }
    }
    async write(measurement, points) {
        try {
            // Get existing points
            const existing = this.data.get(measurement) || [];
            // Append new points
            existing.push(...points);
            // Sort by timestamp
            existing.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            // Store in memory
            this.data.set(measurement, existing);
            // Persist to disk
            const filePath = path.join(this.storageDir, `${measurement}.json`);
            fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
            return {
                success: true,
                points_written: points.length
            };
        }
        catch (error) {
            return {
                success: false,
                points_written: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async query(query) {
        const points = this.data.get(query.measurement) || [];
        // Filter by time range
        let results = points.filter(p => p.timestamp >= query.start_time &&
            p.timestamp <= query.end_time);
        // Filter by tags
        if (query.tags) {
            results = results.filter(p => {
                for (const [key, value] of Object.entries(query.tags)) {
                    if (Array.isArray(value)) {
                        if (!value.includes(p.tags[key]))
                            return false;
                    }
                    else {
                        if (p.tags[key] !== value)
                            return false;
                    }
                }
                return true;
            });
        }
        // Filter by fields
        if (query.fields && query.fields.length > 0) {
            results = results.filter(p => query.fields.some(field => field in p.fields));
        }
        // Apply aggregation if specified
        if (query.aggregation && query.interval) {
            results = this.aggregatePoints(results, query.aggregation, query.interval);
        }
        // Apply limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }
        return results;
    }
    async writeRegressions(regressions) {
        const points = regressions.map(r => ({
            timestamp: r.timestamp,
            value: r.change_percent,
            tags: {
                service: r.service,
                metric: r.metric,
                verdict: r.verdict,
                ...(r.environment && { environment: r.environment }),
                ...(r.deployment_id && { deployment_id: r.deployment_id }),
                ...(r.commit_hash && { commit_hash: r.commit_hash })
            },
            fields: {
                baseline_mean: r.baseline_mean,
                baseline_stddev: r.baseline_stddev,
                candidate_mean: r.candidate_mean,
                candidate_stddev: r.candidate_stddev,
                ...(r.p_value !== undefined && { p_value: r.p_value }),
                ...(r.effect_size !== undefined && { effect_size: r.effect_size }),
                change_percent: r.change_percent,
                verdict: r.verdict
            }
        }));
        return await this.write('regressions', points);
    }
    async queryRegressions(query) {
        const tsQuery = {
            measurement: 'regressions',
            start_time: query.start_date || new Date(0),
            end_time: query.end_date || new Date(),
            tags: {},
            limit: query.limit
        };
        if (query.service) {
            tsQuery.tags.service = query.service;
        }
        if (query.metric) {
            tsQuery.tags.metric = query.metric;
        }
        if (query.verdict) {
            tsQuery.tags.verdict = query.verdict;
        }
        if (query.environment) {
            tsQuery.tags.environment = query.environment;
        }
        const points = await this.query(tsQuery);
        // Convert points back to RegressionRecords
        return points.map((p, index) => ({
            id: `${p.tags.service}-${p.timestamp.getTime()}-${index}`,
            timestamp: p.timestamp,
            service: p.tags.service,
            metric: p.tags.metric,
            verdict: p.tags.verdict,
            baseline_mean: p.fields.baseline_mean,
            baseline_stddev: p.fields.baseline_stddev,
            baseline_sample_count: 0, // Not stored in time-series
            candidate_mean: p.fields.candidate_mean,
            candidate_stddev: p.fields.candidate_stddev,
            candidate_sample_count: 0, // Not stored in time-series
            p_value: p.fields.p_value,
            effect_size: p.fields.effect_size,
            change_percent: p.fields.change_percent,
            is_significant: p.fields.p_value < 0.05,
            environment: p.tags.environment,
            deployment_id: p.tags.deployment_id,
            commit_hash: p.tags.commit_hash,
            tags: [],
            policy_id: '',
            policy_name: '',
            metadata: {}
        }));
    }
    async close() {
        // File-based, no connection to close
    }
    async healthCheck() {
        try {
            return fs.existsSync(this.storageDir);
        }
        catch {
            return false;
        }
    }
    aggregatePoints(points, aggregation, interval) {
        // Parse interval (e.g., '5m' -> 5 minutes)
        const intervalMs = this.parseInterval(interval);
        // Group points into buckets
        const buckets = new Map();
        for (const point of points) {
            const bucket = Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs;
            if (!buckets.has(bucket)) {
                buckets.set(bucket, []);
            }
            buckets.get(bucket).push(point);
        }
        // Aggregate each bucket
        const aggregated = [];
        for (const [bucket, bucketPoints] of buckets.entries()) {
            const values = bucketPoints.map(p => p.value);
            let aggregatedValue;
            switch (aggregation) {
                case 'mean':
                    aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
                    break;
                case 'sum':
                    aggregatedValue = values.reduce((a, b) => a + b, 0);
                    break;
                case 'min':
                    aggregatedValue = Math.min(...values);
                    break;
                case 'max':
                    aggregatedValue = Math.max(...values);
                    break;
                case 'count':
                    aggregatedValue = values.length;
                    break;
                default:
                    aggregatedValue = values[0];
            }
            aggregated.push({
                timestamp: new Date(bucket),
                value: aggregatedValue,
                tags: bucketPoints[0].tags,
                fields: { value: aggregatedValue }
            });
        }
        return aggregated;
    }
    parseInterval(interval) {
        const match = interval.match(/^(\d+)(s|m|h|d)$/);
        if (!match) {
            throw new Error(`Invalid interval format: ${interval}`);
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: throw new Error(`Invalid time unit: ${unit}`);
        }
    }
}
exports.FileTimeSeriesAdapter = FileTimeSeriesAdapter;
/**
 * InfluxDB adapter (placeholder - requires influxdb-client package)
 */
class InfluxDBAdapter {
    constructor(config) {
        this.url = config.url;
        this.token = config.token;
        this.org = config.org;
        this.bucket = config.bucket;
    }
    async connect() {
        // TODO: Implement InfluxDB connection
        // const { InfluxDB } = require('@influxdata/influxdb-client');
        // this.client = new InfluxDB({ url, token });
        console.warn('InfluxDB adapter not fully implemented. Install @influxdata/influxdb-client.');
    }
    async write(measurement, points) {
        // TODO: Implement InfluxDB write
        // const writeApi = this.client.getWriteApi(this.org, this.bucket);
        // for (const point of points) {
        //   const influxPoint = new Point(measurement)
        //     .timestamp(point.timestamp)
        //     .floatField('value', point.value);
        //   
        //   for (const [key, value] of Object.entries(point.tags)) {
        //     influxPoint.tag(key, value);
        //   }
        //   
        //   for (const [key, value] of Object.entries(point.fields)) {
        //     influxPoint.field(key, value);
        //   }
        //   
        //   writeApi.writePoint(influxPoint);
        // }
        // await writeApi.close();
        return { success: false, points_written: 0, error: 'Not implemented' };
    }
    async query(query) {
        // TODO: Implement InfluxDB query using Flux language
        return [];
    }
    async writeRegressions(regressions) {
        // Convert to points and write
        const points = regressions.map(r => ({
            timestamp: r.timestamp,
            value: r.change_percent,
            tags: {
                service: r.service,
                metric: r.metric,
                verdict: r.verdict
            },
            fields: {
                baseline_mean: r.baseline_mean,
                candidate_mean: r.candidate_mean,
                ...(r.p_value !== undefined && { p_value: r.p_value })
            }
        }));
        return await this.write('regressions', points);
    }
    async queryRegressions(query) {
        // TODO: Implement
        return [];
    }
    async close() {
        // TODO: Close InfluxDB connection
    }
    async healthCheck() {
        // TODO: Check InfluxDB health
        return false;
    }
}
exports.InfluxDBAdapter = InfluxDBAdapter;
/**
 * TimescaleDB adapter (placeholder - requires pg package)
 */
class TimescaleDBAdapter {
    constructor(connectionString) {
        this.connectionString = connectionString;
    }
    async connect() {
        // TODO: Implement PostgreSQL connection
        // const { Pool } = require('pg');
        // this.pool = new Pool({ connectionString: this.connectionString });
        console.warn('TimescaleDB adapter not fully implemented. Install pg package.');
    }
    async write(measurement, points) {
        // TODO: Implement TimescaleDB write
        // CREATE TABLE IF NOT EXISTS <measurement> (
        //   time TIMESTAMPTZ NOT NULL,
        //   value DOUBLE PRECISION,
        //   tags JSONB,
        //   fields JSONB
        // );
        // SELECT create_hypertable('<measurement>', 'time', if_not_exists => TRUE);
        return { success: false, points_written: 0, error: 'Not implemented' };
    }
    async query(query) {
        // TODO: Implement TimescaleDB query
        // SELECT * FROM <measurement>
        // WHERE time >= $1 AND time <= $2
        // AND tags @> $3::jsonb
        // ORDER BY time DESC
        // LIMIT $4;
        return [];
    }
    async writeRegressions(regressions) {
        // TODO: Implement
        return { success: false, points_written: 0, error: 'Not implemented' };
    }
    async queryRegressions(query) {
        // TODO: Implement
        return [];
    }
    async close() {
        // TODO: Close PostgreSQL connection
    }
    async healthCheck() {
        // TODO: Check PostgreSQL health
        return false;
    }
}
exports.TimescaleDBAdapter = TimescaleDBAdapter;
/**
 * Prometheus adapter (read-only, for querying existing data)
 */
class PrometheusAdapter {
    constructor(prometheusUrl) {
        this.prometheusUrl = prometheusUrl;
    }
    async connect() {
        // Prometheus is HTTP-based, no persistent connection
    }
    async write(measurement, points) {
        // Prometheus typically doesn't accept writes via API
        // Use pushgateway for batch writes
        return {
            success: false,
            points_written: 0,
            error: 'Prometheus adapter is read-only. Use Pushgateway for writes.'
        };
    }
    async query(query) {
        // TODO: Implement Prometheus query using PromQL
        // GET /api/v1/query_range
        // query=<metric>{<tags>}
        // start=<timestamp>
        // end=<timestamp>
        // step=<interval>
        return [];
    }
    async writeRegressions(regressions) {
        return {
            success: false,
            points_written: 0,
            error: 'Prometheus adapter is read-only'
        };
    }
    async queryRegressions(query) {
        // TODO: Query Prometheus for regression metrics
        return [];
    }
    async close() {
        // No connection to close
    }
    async healthCheck() {
        try {
            // TODO: Check Prometheus health endpoint
            // const response = await fetch(`${this.prometheusUrl}/-/healthy`);
            // return response.ok;
            return false;
        }
        catch {
            return false;
        }
    }
}
exports.PrometheusAdapter = PrometheusAdapter;
/**
 * Factory for creating adapters
 */
class TimeSeriesAdapterFactory {
    static create(type, config) {
        switch (type) {
            case 'file':
                return new FileTimeSeriesAdapter(config.storageDir);
            case 'influxdb':
                return new InfluxDBAdapter({
                    url: config.url,
                    token: config.token,
                    org: config.org,
                    bucket: config.bucket
                });
            case 'timescaledb':
                return new TimescaleDBAdapter(config.connectionString);
            case 'prometheus':
                return new PrometheusAdapter(config.prometheusUrl);
            default:
                throw new Error(`Unknown adapter type: ${type}`);
        }
    }
}
exports.TimeSeriesAdapterFactory = TimeSeriesAdapterFactory;
