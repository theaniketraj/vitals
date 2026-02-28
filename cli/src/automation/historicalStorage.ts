/**
 * VITALS Historical Data Storage
 * 
 * Stores regression analysis results for pattern detection and trend analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import { RegressionResult } from '../core/regression';
import { BatchResult } from '../core/batch';

/**
 * Historical regression record
 */
export interface HistoricalRecord {
  id: string;
  timestamp: Date;
  metric: string;
  baseline_label: string;
  candidate_label: string;
  verdict: string;
  change_percent?: number;
  p_value?: number;
  effect_size?: number;
  baseline_mean?: number;
  candidate_mean?: number;
  metadata?: Record<string, any>;
}

/**
 * Deployment metadata
 */
export interface DeploymentMetadata {
  deployment_id: string;
  timestamp: Date;
  service: string;
  version: string;
  environment: string;
  triggered_by?: string;
  commit_sha?: string;
  pr_number?: number;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

/**
 * Incident record
 */
export interface IncidentRecord {
  incident_id: string;
  timestamp: Date;
  service: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  metrics_affected?: string[];
  resolution_time_ms?: number;
  root_cause?: string;
  related_deployment_id?: string;
}

/**
 * Time-series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  data_dir: string;
  max_records?: number;
  retention_days?: number;
  compress?: boolean;
}

/**
 * Historical data storage manager
 */
export class HistoricalStorage {
  private config: StorageConfig;
  private regressionCache: Map<string, HistoricalRecord[]> = new Map();
  private deploymentCache: Map<string, DeploymentMetadata[]> = new Map();
  private incidentCache: Map<string, IncidentRecord[]> = new Map();

  constructor(config: StorageConfig) {
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
  async storeRegression(result: RegressionResult, metadata?: Record<string, any>): Promise<void> {
    const record: HistoricalRecord = {
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
    this.regressionCache.get(metricKey)!.push(record);
  }

  /**
   * Store batch results
   */
  async storeBatchResults(batchResult: BatchResult, metadata?: Record<string, any>): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [, result] of batchResult.results) {
      if (!(result instanceof Error) && 'verdict' in result) {
        promises.push(this.storeRegression(result as RegressionResult, metadata));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Store deployment metadata
   */
  async storeDeployment(deployment: DeploymentMetadata): Promise<void> {
    await this.appendRecord('deployments', deployment.service, deployment);

    const serviceKey = deployment.service;
    if (!this.deploymentCache.has(serviceKey)) {
      this.deploymentCache.set(serviceKey, []);
    }
    this.deploymentCache.get(serviceKey)!.push(deployment);
  }

  /**
   * Store incident record
   */
  async storeIncident(incident: IncidentRecord): Promise<void> {
    await this.appendRecord('incidents', incident.service, incident);

    const serviceKey = incident.service;
    if (!this.incidentCache.has(serviceKey)) {
      this.incidentCache.set(serviceKey, []);
    }
    this.incidentCache.get(serviceKey)!.push(incident);
  }

  /**
   * Query regressions for a metric
   */
  async queryRegressions(
    metric: string,
    options?: {
      start_date?: Date;
      end_date?: Date;
      verdict?: string;
      limit?: number;
    }
  ): Promise<HistoricalRecord[]> {
    // Check cache first
    if (this.regressionCache.has(metric)) {
      return this.filterRecords(this.regressionCache.get(metric)!, options);
    }

    // Load from disk
    const records = await this.loadRecords<HistoricalRecord>('regressions', metric);
    this.regressionCache.set(metric, records);

    return this.filterRecords(records, options);
  }

  /**
   * Query deployments for a service
   */
  async queryDeployments(
    service: string,
    options?: {
      start_date?: Date;
      end_date?: Date;
      environment?: string;
      limit?: number;
    }
  ): Promise<DeploymentMetadata[]> {
    // Check cache first
    if (this.deploymentCache.has(service)) {
      return this.filterDeployments(this.deploymentCache.get(service)!, options);
    }

    // Load from disk
    const records = await this.loadRecords<DeploymentMetadata>('deployments', service);
    this.deploymentCache.set(service, records);

    return this.filterDeployments(records, options);
  }

  /**
   * Query incidents for a service
   */
  async queryIncidents(
    service: string,
    options?: {
      start_date?: Date;
      end_date?: Date;
      severity?: string;
      limit?: number;
    }
  ): Promise<IncidentRecord[]> {
    // Check cache first
    if (this.incidentCache.has(service)) {
      return this.filterIncidents(this.incidentCache.get(service)!, options);
    }

    // Load from disk
    const records = await this.loadRecords<IncidentRecord>('incidents', service);
    this.incidentCache.set(service, records);

    return this.filterIncidents(records, options);
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeries(
    metric: string,
    field: 'change_percent' | 'p_value' | 'baseline_mean' | 'candidate_mean',
    options?: {
      start_date?: Date;
      end_date?: Date;
    }
  ): Promise<TimeSeriesPoint[]> {
    const records = await this.queryRegressions(metric, options);

    return records
      .filter(r => r[field] !== undefined)
      .map(r => ({
        timestamp: r.timestamp,
        value: r[field] as number,
        metadata: { verdict: r.verdict }
      }));
  }

  /**
   * Get regression statistics for a metric
   */
  async getRegressionStats(
    metric: string,
    days: number = 30
  ): Promise<{
    total: number;
    passed: number;
    failed: number;
    warned: number;
    failure_rate: number;
    avg_change_percent: number;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.queryRegressions(metric, { start_date: startDate });

    const total = records.length;
    const passed = records.filter(r => r.verdict === 'PASS').length;
    const failed = records.filter(r => r.verdict === 'FAIL').length;
    const warned = records.filter(r => r.verdict === 'WARN').length;

    const totalChanges = records
      .filter(r => r.change_percent !== undefined)
      .map(r => r.change_percent!);
    
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
  async cleanup(): Promise<{ deleted: number; retained: number }> {
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
      if (!fs.existsSync(typeDir)) continue;

      const files = fs.readdirSync(typeDir);
      for (const file of files) {
        const filePath = path.join(typeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const records = content.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));

        const filtered = records.filter((record: any) => {
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
  async exportToJSON(outputPath: string): Promise<void> {
    const data = {
      regressions: {} as Record<string, HistoricalRecord[]>,
      deployments: {} as Record<string, DeploymentMetadata[]>,
      incidents: {} as Record<string, IncidentRecord[]>
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async appendRecord(type: string, key: string, record: any): Promise<void> {
    const typeDir = path.join(this.config.data_dir, type);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    const filePath = path.join(typeDir, `${this.sanitizeKey(key)}.jsonl`);
    const line = JSON.stringify(record) + '\n';

    fs.appendFileSync(filePath, line, 'utf-8');
  }

  private async loadRecords<T>(type: string, key: string): Promise<T[]> {
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

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private filterRecords(
    records: HistoricalRecord[],
    options?: {
      start_date?: Date;
      end_date?: Date;
      verdict?: string;
      limit?: number;
    }
  ): HistoricalRecord[] {
    let filtered = [...records];

    if (options?.start_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date!);
    }

    if (options?.end_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date!);
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

  private filterDeployments(
    records: DeploymentMetadata[],
    options?: {
      start_date?: Date;
      end_date?: Date;
      environment?: string;
      limit?: number;
    }
  ): DeploymentMetadata[] {
    let filtered = [...records];

    if (options?.start_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date!);
    }

    if (options?.end_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date!);
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

  private filterIncidents(
    records: IncidentRecord[],
    options?: {
      start_date?: Date;
      end_date?: Date;
      severity?: string;
      limit?: number;
    }
  ): IncidentRecord[] {
    let filtered = [...records];

    if (options?.start_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) >= options.start_date!);
    }

    if (options?.end_date) {
      filtered = filtered.filter(r => new Date(r.timestamp) <= options.end_date!);
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
