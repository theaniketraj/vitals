/**
 * VITALS Time-Series Database Adapters
 * 
 * Abstract interface and implementations for time-series storage:
 * - File-based (JSON) - for prototyping
 * - InfluxDB - purpose-built time-series database
 * - TimescaleDB - PostgreSQL extension for time-series
 * - Prometheus - metrics storage and querying
 */

import { RegressionRecord, RegressionQuery } from './regressionDatabase';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Time-series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  tags: Record<string, string>;
  fields: Record<string, number | string | boolean>;
}

/**
 * Time-series query
 */
export interface TimeSeriesQuery {
  measurement: string;
  start_time: Date;
  end_time: Date;
  tags?: Record<string, string | string[]>;
  fields?: string[];
  aggregation?: 'mean' | 'sum' | 'min' | 'max' | 'count' | 'percentile';
  interval?: string;  // e.g., '5m', '1h', '1d'
  limit?: number;
}

/**
 * Time-series write result
 */
export interface WriteResult {
  success: boolean;
  points_written: number;
  error?: string;
}

/**
 * Abstract time-series adapter interface
 */
export interface ITimeSeriesAdapter {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Write data points
   */
  write(measurement: string, points: TimeSeriesPoint[]): Promise<WriteResult>;

  /**
   * Query data points
   */
  query(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]>;

  /**
   * Write regression records
   */
  writeRegressions(regressions: RegressionRecord[]): Promise<WriteResult>;

  /**
   * Query regressions
   */
  queryRegressions(query: RegressionQuery): Promise<RegressionRecord[]>;

  /**
   * Close connection
   */
  close(): Promise<void>;

  /**
   * Check if connection is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * File-based adapter (JSON storage)
 */
export class FileTimeSeriesAdapter implements ITimeSeriesAdapter {
  private storageDir: string;
  private data: Map<string, TimeSeriesPoint[]>;

  constructor(storageDir: string = './vitals-data/timeseries') {
    this.storageDir = storageDir;
    this.data = new Map();
  }

  async connect(): Promise<void> {
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

  async write(measurement: string, points: TimeSeriesPoint[]): Promise<WriteResult> {
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
    } catch (error) {
      return {
        success: false,
        points_written: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async query(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    const points = this.data.get(query.measurement) || [];
    
    // Filter by time range
    let results = points.filter(p =>
      p.timestamp >= query.start_time &&
      p.timestamp <= query.end_time
    );
    
    // Filter by tags
    if (query.tags) {
      results = results.filter(p => {
        for (const [key, value] of Object.entries(query.tags!)) {
          if (Array.isArray(value)) {
            if (!value.includes(p.tags[key])) return false;
          } else {
            if (p.tags[key] !== value) return false;
          }
        }
        return true;
      });
    }
    
    // Filter by fields
    if (query.fields && query.fields.length > 0) {
      results = results.filter(p =>
        query.fields!.some(field => field in p.fields)
      );
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

  async writeRegressions(regressions: RegressionRecord[]): Promise<WriteResult> {
    const points: TimeSeriesPoint[] = regressions.map(r => ({
      timestamp: r.timestamp,
      value: r.change_percent,
      tags: {
        service: r.service,
        metric: r.metric,
        verdict: r.verdict,
        environment: r.environment,
        ...(r.deployment_id && { deployment_id: r.deployment_id }),
        ...(r.commit_hash && { commit_hash: r.commit_hash })
      },
      fields: {
        baseline_mean: r.baseline_mean,
        baseline_stddev: r.baseline_stddev,
        candidate_mean: r.candidate_mean,
        candidate_stddev: r.candidate_stddev,
        p_value: r.p_value,
        effect_size: r.effect_size,
        change_percent: r.change_percent,
        verdict: r.verdict
      }
    }));
    
    return await this.write('regressions', points);
  }

  async queryRegressions(query: RegressionQuery): Promise<RegressionRecord[]> {
    const tsQuery: TimeSeriesQuery = {
      measurement: 'regressions',
      start_time: query.start_date || new Date(0),
      end_time: query.end_date || new Date(),
      tags: {},
      limit: query.limit
    };
    
    if (query.service) {
      tsQuery.tags!.service = query.service;
    }
    if (query.metric) {
      tsQuery.tags!.metric = query.metric;
    }
    if (query.verdict) {
      tsQuery.tags!.verdict = query.verdict;
    }
    if (query.environment) {
      tsQuery.tags!.environment = query.environment;
    }
    
    const points = await this.query(tsQuery);
    
    // Convert points back to RegressionRecords
    return points.map((p, index) => ({
      id: `${p.tags.service}-${p.timestamp.getTime()}-${index}`,
      timestamp: p.timestamp,
      service: p.tags.service,
      metric: p.tags.metric,
      verdict: p.tags.verdict as 'PASS' | 'WARN' | 'FAIL',
      baseline_mean: p.fields.baseline_mean as number,
      baseline_stddev: p.fields.baseline_stddev as number,
      baseline_count: 0,  // Not stored in time-series
      candidate_mean: p.fields.candidate_mean as number,
      candidate_stddev: p.fields.candidate_stddev as number,
      candidate_count: 0,  // Not stored in time-series
      p_value: p.fields.p_value as number,
      effect_size: p.fields.effect_size as number,
      change_percent: p.fields.change_percent as number,
      is_significant: p.fields.p_value as number < 0.05,
      environment: p.tags.environment,
      deployment_id: p.tags.deployment_id,
      commit_hash: p.tags.commit_hash,
      tags: [],
      policy_id: '',
      policy_name: '',
      metadata: {}
    }));
  }

  async close(): Promise<void> {
    // File-based, no connection to close
  }

  async healthCheck(): Promise<boolean> {
    try {
      return fs.existsSync(this.storageDir);
    } catch {
      return false;
    }
  }

  private aggregatePoints(
    points: TimeSeriesPoint[],
    aggregation: string,
    interval: string
  ): TimeSeriesPoint[] {
    // Parse interval (e.g., '5m' -> 5 minutes)
    const intervalMs = this.parseInterval(interval);
    
    // Group points into buckets
    const buckets = new Map<number, TimeSeriesPoint[]>();
    
    for (const point of points) {
      const bucket = Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(point);
    }
    
    // Aggregate each bucket
    const aggregated: TimeSeriesPoint[] = [];
    
    for (const [bucket, bucketPoints] of buckets.entries()) {
      const values = bucketPoints.map(p => p.value);
      let aggregatedValue: number;
      
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

  private parseInterval(interval: string): number {
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

/**
 * InfluxDB adapter (placeholder - requires influxdb-client package)
 */
export class InfluxDBAdapter implements ITimeSeriesAdapter {
  private url: string;
  private token: string;
  private org: string;
  private bucket: string;
  
  constructor(config: {
    url: string;
    token: string;
    org: string;
    bucket: string;
  }) {
    this.url = config.url;
    this.token = config.token;
    this.org = config.org;
    this.bucket = config.bucket;
  }

  async connect(): Promise<void> {
    // TODO: Implement InfluxDB connection
    // const { InfluxDB } = require('@influxdata/influxdb-client');
    // this.client = new InfluxDB({ url, token });
    console.warn('InfluxDB adapter not fully implemented. Install @influxdata/influxdb-client.');
  }

  async write(measurement: string, points: TimeSeriesPoint[]): Promise<WriteResult> {
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

  async query(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    // TODO: Implement InfluxDB query using Flux language
    return [];
  }

  async writeRegressions(regressions: RegressionRecord[]): Promise<WriteResult> {
    // Convert to points and write
    const points: TimeSeriesPoint[] = regressions.map(r => ({
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
        p_value: r.p_value
      }
    }));
    
    return await this.write('regressions', points);
  }

  async queryRegressions(query: RegressionQuery): Promise<RegressionRecord[]> {
    // TODO: Implement
    return [];
  }

  async close(): Promise<void> {
    // TODO: Close InfluxDB connection
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Check InfluxDB health
    return false;
  }
}

/**
 * TimescaleDB adapter (placeholder - requires pg package)
 */
export class TimescaleDBAdapter implements ITimeSeriesAdapter {
  private connectionString: string;
  
  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    // TODO: Implement PostgreSQL connection
    // const { Pool } = require('pg');
    // this.pool = new Pool({ connectionString: this.connectionString });
    console.warn('TimescaleDB adapter not fully implemented. Install pg package.');
  }

  async write(measurement: string, points: TimeSeriesPoint[]): Promise<WriteResult> {
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

  async query(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    // TODO: Implement TimescaleDB query
    // SELECT * FROM <measurement>
    // WHERE time >= $1 AND time <= $2
    // AND tags @> $3::jsonb
    // ORDER BY time DESC
    // LIMIT $4;
    
    return [];
  }

  async writeRegressions(regressions: RegressionRecord[]): Promise<WriteResult> {
    // TODO: Implement
    return { success: false, points_written: 0, error: 'Not implemented' };
  }

  async queryRegressions(query: RegressionQuery): Promise<RegressionRecord[]> {
    // TODO: Implement
    return [];
  }

  async close(): Promise<void> {
    // TODO: Close PostgreSQL connection
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Check PostgreSQL health
    return false;
  }
}

/**
 * Prometheus adapter (read-only, for querying existing data)
 */
export class PrometheusAdapter implements ITimeSeriesAdapter {
  private prometheusUrl: string;
  
  constructor(prometheusUrl: string) {
    this.prometheusUrl = prometheusUrl;
  }

  async connect(): Promise<void> {
    // Prometheus is HTTP-based, no persistent connection
  }

  async write(measurement: string, points: TimeSeriesPoint[]): Promise<WriteResult> {
    // Prometheus typically doesn't accept writes via API
    // Use pushgateway for batch writes
    return { 
      success: false, 
      points_written: 0, 
      error: 'Prometheus adapter is read-only. Use Pushgateway for writes.' 
    };
  }

  async query(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    // TODO: Implement Prometheus query using PromQL
    // GET /api/v1/query_range
    // query=<metric>{<tags>}
    // start=<timestamp>
    // end=<timestamp>
    // step=<interval>
    
    return [];
  }

  async writeRegressions(regressions: RegressionRecord[]): Promise<WriteResult> {
    return { 
      success: false, 
      points_written: 0, 
      error: 'Prometheus adapter is read-only' 
    };
  }

  async queryRegressions(query: RegressionQuery): Promise<RegressionRecord[]> {
    // TODO: Query Prometheus for regression metrics
    return [];
  }

  async close(): Promise<void> {
    // No connection to close
  }

  async healthCheck(): Promise<boolean> {
    try {
      // TODO: Check Prometheus health endpoint
      // const response = await fetch(`${this.prometheusUrl}/-/healthy`);
      // return response.ok;
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Factory for creating adapters
 */
export class TimeSeriesAdapterFactory {
  static create(type: 'file' | 'influxdb' | 'timescaledb' | 'prometheus', config: any): ITimeSeriesAdapter {
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
