"use strict";
/**
 * Performance Caching Layer
 *
 * Implements local file-based caching to reduce API load and improve performance:
 * - Cache metric queries with configurable TTL
 * - Invalidation strategies
 * - Size management
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
exports.MetricCache = void 0;
exports.getCache = getCache;
exports.initializeCache = initializeCache;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class MetricCache {
    constructor(options = {}) {
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
    async get(key) {
        if (!this.enabled)
            return null;
        const cacheKey = this.hashKey(key);
        const cachePath = this.getCachePath(cacheKey);
        try {
            if (!fs.existsSync(cachePath)) {
                return null;
            }
            const cacheData = fs.readFileSync(cachePath, 'utf-8');
            const entry = JSON.parse(cacheData);
            // Check if expired
            const age = Date.now() - entry.timestamp;
            if (age > this.ttl * 1000) {
                // Remove expired entry
                fs.unlinkSync(cachePath);
                return null;
            }
            return entry.data;
        }
        catch (error) {
            // If cache read fails, just return null
            return null;
        }
    }
    /**
     * Store data in cache
     */
    async set(key, data) {
        if (!this.enabled)
            return;
        const cacheKey = this.hashKey(key);
        const cachePath = this.getCachePath(cacheKey);
        const entry = {
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
        }
        catch (error) {
            // If cache write fails, just continue without caching
            console.warn(`Failed to write cache: ${error}`);
        }
    }
    /**
     * Clear specific cache entry
     */
    async clear(key) {
        if (!this.enabled)
            return;
        const cacheKey = this.hashKey(key);
        const cachePath = this.getCachePath(cacheKey);
        try {
            if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath);
            }
        }
        catch (error) {
            console.warn(`Failed to clear cache: ${error}`);
        }
    }
    /**
     * Clear all cache entries
     */
    async clearAll() {
        if (!this.enabled)
            return;
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
        }
        catch (error) {
            console.warn(`Failed to clear cache: ${error}`);
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.enabled || !fs.existsSync(this.cacheDir)) {
            return { entries: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
        }
        let entries = 0;
        let totalSize = 0;
        let oldestEntry = null;
        let newestEntry = null;
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
        }
        catch (error) {
            console.warn(`Failed to get cache stats: ${error}`);
        }
        return { entries, totalSize, oldestEntry, newestEntry };
    }
    /**
     * Remove expired entries
     */
    async cleanExpired() {
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
                    const entry = JSON.parse(cacheData);
                    const age = now - entry.timestamp;
                    if (age > this.ttl * 1000) {
                        fs.unlinkSync(filePath);
                        removed++;
                    }
                }
                catch {
                    // If file is corrupted, remove it
                    fs.unlinkSync(filePath);
                    removed++;
                }
            }
        }
        catch (error) {
            console.warn(`Failed to clean expired cache: ${error}`);
        }
        return removed;
    }
    /**
     * Ensure cache doesn't exceed size limit
     */
    async ensureCacheSize(newEntrySize) {
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
        }
        catch (error) {
            console.warn(`Failed to manage cache size: ${error}`);
        }
    }
    /**
     * Generate cache key hash
     */
    hashKey(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
    /**
     * Get cache file path for a key
     */
    getCachePath(cacheKey) {
        return path.join(this.cacheDir, `${cacheKey}.json`);
    }
    /**
     * Generate cache key for metric query
     */
    static generateMetricKey(prometheusUrl, metric, label, timeRange) {
        return `metric:${prometheusUrl}:${metric}:${label || 'none'}:${timeRange}`;
    }
    /**
     * Generate cache key for range query
     */
    static generateRangeKey(prometheusUrl, metric, label, start, end) {
        return `range:${prometheusUrl}:${metric}:${label || 'none'}:${start}:${end}`;
    }
}
exports.MetricCache = MetricCache;
/**
 * Global cache instance
 */
let globalCache = null;
/**
 * Get or create global cache instance
 */
function getCache(options) {
    if (!globalCache) {
        globalCache = new MetricCache(options);
    }
    return globalCache;
}
/**
 * Initialize cache with options
 */
function initializeCache(options) {
    globalCache = new MetricCache(options);
    return globalCache;
}
