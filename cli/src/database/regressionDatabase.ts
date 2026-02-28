/**
 * VITALS Regression Database
 * 
 * Structured storage and querying for regression analysis results.
 * Provides rich querying capabilities beyond simple JSONL storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * Regression record with full metadata
 */
export interface RegressionRecord {
  id: string;  // Unique identifier
  timestamp: Date;
  service: string;
  metric: string;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  
  // Statistical data
  baseline_mean: number;
  baseline_stddev: number;
  baseline_sample_count: number;
  candidate_mean: number;
  candidate_stddev: number;
  candidate_sample_count: number;
  change_percent: number;
  
  // Statistical test results
  p_value?: number;
  effect_size?: number;
  confidence_level?: number;
  test_type?: string;  // e.g., "welch_t_test", "mann_whitney"
  
  // Context
  environment?: string;
  deployment_id?: string;
  commit_hash?: string;
  author?: string;
  tags?: string[];
  
  // Policy information
  policy_name?: string;
  policy_action?: string;
  threshold?: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Query filters for regression search
 */
export interface RegressionQuery {
  service?: string | string[];
  metric?: string | string[];
  verdict?: 'PASS' | 'WARN' | 'FAIL' | ('PASS' | 'WARN' | 'FAIL')[];
  environment?: string | string[];
  
  // Time range
  start_date?: Date;
  end_date?: Date;
  
  // Statistical filters
  min_change_percent?: number;
  max_change_percent?: number;
  min_p_value?: number;
  max_p_value?: number;
  
  // Tags
  tags?: string[];
  tags_mode?: 'any' | 'all';  // Match any tag or all tags
  
  // Deployment
  deployment_id?: string;
  commit_hash?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sort_by?: 'timestamp' | 'change_percent' | 'p_value' | 'service' | 'metric';
  sort_order?: 'asc' | 'desc';
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  group_by: string;
  value: string;
  count: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  avg_change_percent: number;
  max_change_percent: number;
  min_change_percent: number;
}

/**
 * Time series point for trending
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  count: number;
}

/**
 * Regression database interface
 */
export interface IRegressionDatabase {
  insert(record: RegressionRecord): Promise<string>;
  insertBatch(records: RegressionRecord[]): Promise<string[]>;
  query(filter: RegressionQuery): Promise<RegressionRecord[]>;
  getById(id: string): Promise<RegressionRecord | null>;
  update(id: string, updates: Partial<RegressionRecord>): Promise<void>;
  delete(id: string): Promise<void>;
  aggregate(groupBy: 'service' | 'metric' | 'environment' | 'verdict', filter?: RegressionQuery): Promise<AggregationResult[]>;
  getTimeSeries(metric: string, field: string, interval: 'hour' | 'day' | 'week', filter?: RegressionQuery): Promise<TimeSeriesPoint[]>;
  count(filter?: RegressionQuery): Promise<number>;
}

/**
 * SQLite-based regression database implementation
 * 
 * Uses a simple JSON file-based approach that mimics SQL-like querying.
 * For production, this could be replaced with actual SQLite, PostgreSQL, or TimescaleDB.
 */
export class RegressionDatabase implements IRegressionDatabase {
  private readonly basePath: string;
  private readonly indexPath: string;
  private readonly dataPath: string;
  private readonly index: Map<string, RegressionRecord>;
  private loaded: boolean = false;

  constructor(basePath: string = '~/.vitals/database') {
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
  async initialize(): Promise<void> {
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
  async insert(record: RegressionRecord): Promise<string> {
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
  async insertBatch(records: RegressionRecord[]): Promise<string[]> {
    await this.ensureLoaded();
    
    const ids: string[] = [];
    
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
  async query(filter: RegressionQuery): Promise<RegressionRecord[]> {
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
  async getById(id: string): Promise<RegressionRecord | null> {
    await this.ensureLoaded();
    return this.index.get(id) || null;
  }

  /**
   * Update a record
   */
  async update(id: string, updates: Partial<RegressionRecord>): Promise<void> {
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
  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    
    const record = this.index.get(id);
    if (!record) {
      return;
    }
    
    // Delete file
    const filePath = this.getRecordPath(record);
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore
    }
    
    // Remove from index
    this.index.delete(id);
    await this.saveIndex();
  }

  /**
   * Aggregate records by field
   */
  async aggregate(
    groupBy: 'service' | 'metric' | 'environment' | 'verdict',
    filter?: RegressionQuery
  ): Promise<AggregationResult[]> {
    await this.ensureLoaded();
    
    let records = Array.from(this.index.values());
    
    if (filter) {
      records = this.applyFilters(records, filter);
    }
    
    // Group records
    const groups = new Map<string, RegressionRecord[]>();
    for (const record of records) {
      const key = record[groupBy] || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }
    
    // Calculate aggregations
    const results: AggregationResult[] = [];
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
  async getTimeSeries(
    metric: string,
    field: string,
    interval: 'hour' | 'day' | 'week',
    filter?: RegressionQuery
  ): Promise<TimeSeriesPoint[]> {
    await this.ensureLoaded();
    
    let records = Array.from(this.index.values()).filter(r => r.metric === metric);
    
    if (filter) {
      records = this.applyFilters(records, filter);
    }
    
    // Sort by timestamp
    records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Group by interval
    const groups = new Map<number, RegressionRecord[]>();
    const intervalMs = interval === 'hour' ? 3600000 : interval === 'day' ? 86400000 : 604800000;
    
    for (const record of records) {
      const bucket = Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      if (!groups.has(bucket)) {
        groups.set(bucket, []);
      }
      groups.get(bucket)!.push(record);
    }
    
    // Calculate averages for each bucket
    const results: TimeSeriesPoint[] = [];
    for (const [bucket, groupRecords] of groups) {
      const values = groupRecords.map(r => (r as any)[field]).filter(v => typeof v === 'number');
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
  async count(filter?: RegressionQuery): Promise<number> {
    await this.ensureLoaded();
    
    if (!filter) {
      return this.index.size;
    }
    
    const records = Array.from(this.index.values());
    return this.applyFilters(records, filter).length;
  }

  // Private helper methods

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.initialize();
    }
  }

  private generateId(record: RegressionRecord): string {
    const timestamp = record.timestamp.getTime();
    const hash = `${record.service}-${record.metric}-${timestamp}`;
    return Buffer.from(hash).toString('base64').replace(/[/+=]/g, '').substring(0, 16);
  }

  private getRecordPath(record: RegressionRecord): string {
    const year = record.timestamp.getFullYear();
    const month = String(record.timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(record.timestamp.getDate()).padStart(2, '0');
    
    return path.join(this.dataPath, record.service, `${year}-${month}-${day}`, `${record.id}.json`);
  }

  private async writeRecord(record: RegressionRecord): Promise<void> {
    const filePath = this.getRecordPath(record);
    await mkdir(path.dirname(filePath), { recursive: true });
    
    await writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await readFile(this.indexPath, 'utf8');
      const records = JSON.parse(data) as RegressionRecord[];
      
      this.index.clear();
      for (const record of records) {
        record.timestamp = new Date(record.timestamp);
        this.index.set(record.id, record);
      }
    } catch (error) {
      // Index doesn't exist yet, start fresh
      this.index.clear();
    }
  }

  private async saveIndex(): Promise<void> {
    const records = Array.from(this.index.values());
    await writeFile(this.indexPath, JSON.stringify(records, null, 2), 'utf8');
  }

  private applyFilters(records: RegressionRecord[], filter: RegressionQuery): RegressionRecord[] {
    return records.filter(record => {
      // Service filter
      if (filter.service) {
        const services = Array.isArray(filter.service) ? filter.service : [filter.service];
        if (!services.includes(record.service)) return false;
      }
      
      // Metric filter
      if (filter.metric) {
        const metrics = Array.isArray(filter.metric) ? filter.metric : [filter.metric];
        if (!metrics.includes(record.metric)) return false;
      }
      
      // Verdict filter
      if (filter.verdict) {
        const verdicts = Array.isArray(filter.verdict) ? filter.verdict : [filter.verdict];
        if (!verdicts.includes(record.verdict)) return false;
      }
      
      // Environment filter
      if (filter.environment) {
        const environments = Array.isArray(filter.environment) ? filter.environment : [filter.environment];
        if (!record.environment || !environments.includes(record.environment)) return false;
      }
      
      // Date range
      if (filter.start_date && record.timestamp < filter.start_date) return false;
      if (filter.end_date && record.timestamp > filter.end_date) return false;
      
      // Statistical filters
      if (filter.min_change_percent !== undefined && record.change_percent < filter.min_change_percent) return false;
      if (filter.max_change_percent !== undefined && record.change_percent > filter.max_change_percent) return false;
      if (filter.min_p_value !== undefined && (record.p_value === undefined || record.p_value < filter.min_p_value)) return false;
      if (filter.max_p_value !== undefined && (record.p_value === undefined || record.p_value > filter.max_p_value)) return false;
      
      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        if (!record.tags) return false;
        
        if (filter.tags_mode === 'all') {
          if (!filter.tags.every(tag => record.tags!.includes(tag))) return false;
        } else {
          if (!filter.tags.some(tag => record.tags!.includes(tag))) return false;
        }
      }
      
      // Deployment filter
      if (filter.deployment_id && record.deployment_id !== filter.deployment_id) return false;
      if (filter.commit_hash && record.commit_hash !== filter.commit_hash) return false;
      
      return true;
    });
  }

  private sortResults(records: RegressionRecord[], filter: RegressionQuery): RegressionRecord[] {
    if (!filter.sort_by) {
      return records;
    }
    
    const sortOrder = filter.sort_order === 'asc' ? 1 : -1;
    
    return records.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
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
      
      if (aVal < bVal) return -sortOrder;
      if (aVal > bVal) return sortOrder;
      return 0;
    });
  }
}

/**
 * Export helper to convert Phase 4 historical storage to regression database
 */
export async function migrateFromHistoricalStorage(
  historicalStoragePath: string,
  database: RegressionDatabase
): Promise<number> {
  // This would read JSONL files and insert into database
  // Implementation depends on historical storage format
  let count = 0;
  
  // TODO: Implement migration logic
  
  return count;
}
