/**
 * Performance Caching Layer
 * 
 * Implements local file-based caching to reduce API load and improve performance:
 * - Cache metric queries with configurable TTL
 * - Invalidation strategies
 * - Size management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheOptions {
  /** Cache directory path (default: .vitals-cache) */
  cacheDir?: string;
  /** Time-to-live in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Maximum cache size in MB (default: 100) */
  maxSizeMB?: number;
  /** Enable cache (default: true) */
  enabled?: boolean;
}

export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  timestamp: number;
  /** Cache key */
  key: string;
  /** Size in bytes */
  size: number;
}

export class MetricCache {
  private cacheDir: string;
  private ttl: number;
  private maxSizeMB: number;
  private enabled: boolean;

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.vitals-cache');
    this.ttl = options.ttl || 300; // 5 minutes default
    this.maxSizeMB = options.maxSizeMB || 100;
    this.enabled = options.enabled !== false;

    // Create cache directory if it doesn't exist
    if (this.enabled && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get cached data if available and not expired
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    const cacheKey = this.hashKey(key);
    const cachePath = this.getCachePath(cacheKey);

    try {
      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const cacheData = fs.readFileSync(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(cacheData);

      // Check if expired
      const age = Date.now() - entry.timestamp;
      if (age > this.ttl * 1000) {
        // Remove expired entry
        fs.unlinkSync(cachePath);
        return null;
      }

      return entry.data;
    } catch (error) {
      // If cache read fails, just return null
      return null;
    }
  }

  /**
   * Store data in cache
   */
  async set<T>(key: string, data: T): Promise<void> {
    if (!this.enabled) return;

    const cacheKey = this.hashKey(key);
    const cachePath = this.getCachePath(cacheKey);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      key: cacheKey,
      size: 0
    };

    const cacheData = JSON.stringify(entry);
    entry.size = Buffer.byteLength(cacheData);

    try {
      // Check cache size before writing
      await this.ensureCacheSize(entry.size);
      fs.writeFileSync(cachePath, cacheData, 'utf-8');
    } catch (error) {
      // If cache write fails, just continue without caching
      console.warn(`Failed to write cache: ${error}`);
    }
  }

  /**
   * Clear specific cache entry
   */
  async clear(key: string): Promise<void> {
    if (!this.enabled) return;

    const cacheKey = this.hashKey(key);
    const cachePath = this.getCachePath(cacheKey);

    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.warn(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    if (!this.enabled) return;

    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          const filePath = path.join(this.cacheDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    entries: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    if (!this.enabled || !fs.existsSync(this.cacheDir)) {
      return { entries: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
    }

    let entries = 0;
    let totalSize = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    try {
      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          entries++;
          totalSize += stats.size;

          const mtime = stats.mtimeMs;
          if (oldestEntry === null || mtime < oldestEntry) {
            oldestEntry = mtime;
          }
          if (newestEntry === null || mtime > newestEntry) {
            newestEntry = mtime;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to get cache stats: ${error}`);
    }

    return { entries, totalSize, oldestEntry, newestEntry };
  }

  /**
   * Remove expired entries
   */
  async cleanExpired(): Promise<number> {
    if (!this.enabled || !fs.existsSync(this.cacheDir)) {
      return 0;
    }

    let removed = 0;
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        
        try {
          const cacheData = fs.readFileSync(filePath, 'utf-8');
          const entry: CacheEntry<any> = JSON.parse(cacheData);
          
          const age = now - entry.timestamp;
          if (age > this.ttl * 1000) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch {
          // If file is corrupted, remove it
          fs.unlinkSync(filePath);
          removed++;
        }
      }
    } catch (error) {
      console.warn(`Failed to clean expired cache: ${error}`);
    }

    return removed;
  }

  /**
   * Ensure cache doesn't exceed size limit
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    const maxBytes = this.maxSizeMB * 1024 * 1024;
    const stats = await this.getStats();

    if (stats.totalSize + newEntrySize <= maxBytes) {
      return;
    }

    // Remove oldest entries until we have space
    try {
      const files = fs.readdirSync(this.cacheDir);
      const fileStats = files.map(file => {
        const filePath = path.join(this.cacheDir, file);
        const stat = fs.statSync(filePath);
        return { file, filePath, mtime: stat.mtimeMs, size: stat.size };
      }).sort((a, b) => a.mtime - b.mtime); // Oldest first

      let currentSize = stats.totalSize;
      for (const { filePath, size } of fileStats) {
        if (currentSize + newEntrySize <= maxBytes) {
          break;
        }
        fs.unlinkSync(filePath);
        currentSize -= size;
      }
    } catch (error) {
      console.warn(`Failed to manage cache size: ${error}`);
    }
  }

  /**
   * Generate cache key hash
   */
  private hashKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Get cache file path for a key
   */
  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.json`);
  }

  /**
   * Generate cache key for metric query
   */
  static generateMetricKey(
    prometheusUrl: string,
    metric: string,
    label: string | undefined,
    timeRange: string
  ): string {
    return `metric:${prometheusUrl}:${metric}:${label || 'none'}:${timeRange}`;
  }

  /**
   * Generate cache key for range query
   */
  static generateRangeKey(
    prometheusUrl: string,
    metric: string,
    label: string | undefined,
    start: string,
    end: string
  ): string {
    return `range:${prometheusUrl}:${metric}:${label || 'none'}:${start}:${end}`;
  }
}

/**
 * Global cache instance
 */
let globalCache: MetricCache | null = null;

/**
 * Get or create global cache instance
 */
export function getCache(options?: CacheOptions): MetricCache {
  if (!globalCache) {
    globalCache = new MetricCache(options);
  }
  return globalCache;
}

/**
 * Initialize cache with options
 */
export function initializeCache(options: CacheOptions): MetricCache {
  globalCache = new MetricCache(options);
  return globalCache;
}
