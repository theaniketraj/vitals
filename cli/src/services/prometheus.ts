import axios from 'axios';
import { getCache, MetricCache } from './cache';

export interface MetricQuery {
  metric: string;
  label?: string;
  timeRange?: string;
}

export interface PrometheusConfig {
  url: string;
  timeout?: number;
  /** Enable caching (default: true) */
  cache?: boolean;
  /** Cache TTL in seconds (default: 300) */
  cacheTTL?: number;
}

/**
 * Fetch metric data from Prometheus with caching
 */
export async function fetchMetric(
  config: PrometheusConfig,
  query: MetricQuery
): Promise<number[]> {
  const { url, timeout = 10000, cache: useCache = true, cacheTTL = 300 } = config;
  const { metric, label, timeRange = '10m' } = query;

  // Check cache first
  if (useCache) {
    const cacheInstance = getCache({ ttl: cacheTTL });
    const cacheKey = MetricCache.generateMetricKey(url, metric, label, timeRange);
    const cached = await cacheInstance.get<number[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
  }

  let promQuery = metric;
  if (label) {
    promQuery = `${metric}{deployment="${label}"}`;
  }

  // Use rate for counter metrics
  if (metric.includes('_total') || metric.includes('_count')) {
    promQuery = `rate(${promQuery}[${timeRange}])`;
  }

  try {
    const response = await axios.get(`${url}/api/v1/query_range`, {
      params: {
        query: promQuery,
        start: Math.floor(Date.now() / 1000) - parseTimeRange(timeRange),
        end: Math.floor(Date.now() / 1000),
        step: '15s'
      },
      timeout
    });

    if (response.data.status !== 'success') {
      throw new Error(`Prometheus query failed: ${response.data.error || 'Unknown error'}`);
    }

    const results = response.data.data.result;
    if (!results || results.length === 0) {
      throw new Error(`No data found for query: ${promQuery}`);
    }

    // Extract values from the first result series
    const values = results[0].values.map((v: [number, string]) => parseFloat(v[1]));

    // Cache the result
    if (useCache) {
      const cacheInstance = getCache({ ttl: cacheTTL });
      const cacheKey = MetricCache.generateMetricKey(url, metric, label, timeRange);
      await cacheInstance.set(cacheKey, values);
    }

    return values;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse time range string to seconds
 */
function parseTimeRange(range: string): number {
  const match = range.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time range format: ${range}`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400
  };

  return value * multipliers[unit];
}

/**
 * Fetch metric data for a specific time range with caching
 */
export async function fetchRangeMetrics(
  config: PrometheusConfig,
  query: MetricQuery & { start: string; end: string }
): Promise<number[]> {
  const { url, timeout = 10000, cache: useCache = true, cacheTTL = 300 } = config;
  const { metric, label, start, end } = query;

  // Check cache first
  if (useCache) {
    const cacheInstance = getCache({ ttl: cacheTTL });
    const cacheKey = MetricCache.generateRangeKey(url, metric, label, start, end);
    const cached = await cacheInstance.get<number[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
  }

  let promQuery = metric;
  if (label) {
    promQuery = `${metric}{service="${label}"}`;
  }

  try {
    const response = await axios.get(`${url}/api/v1/query_range`, {
      params: {
        query: promQuery,
        start,
        end,
        step: '15s'
      },
      timeout
    });

    if (response.data.status !== 'success') {
      throw new Error(`Prometheus query failed: ${response.data.error || 'Unknown error'}`);
    }

    const results = response.data.data.result;
    if (!results || results.length === 0) {
      return [];
    }

    // Extract values from the first result
    const values = results[0].values.map((v: [number, string]) => parseFloat(v[1]));
    const filteredValues = values.filter((v: number) => !isNaN(v));

    // Cache the result
    if (useCache) {
      const cacheInstance = getCache({ ttl: cacheTTL });
      const cacheKey = MetricCache.generateRangeKey(url, metric, label, start, end);
      await cacheInstance.set(cacheKey, filteredValues);
    }

    return filteredValues;
  } catch (error: any) {
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }
}

/**
 * Fetch instant metric value (current state)
 */
export async function fetchInstantMetric(
  config: PrometheusConfig,
  query: MetricQuery
): Promise<number> {
  const { url, timeout = 10000 } = config;
  const { metric, label } = query;

  let promQuery = metric;
  if (label) {
    promQuery = `${metric}{deployment="${label}"}`;
  }

  try {
    const response = await axios.get(`${url}/api/v1/query`, {
      params: { query: promQuery },
      timeout
    });

    if (response.data.status !== 'success') {
      throw new Error(`Prometheus query failed: ${response.data.error || 'Unknown error'}`);
    }

    const results = response.data.data.result;
    if (!results || results.length === 0) {
      throw new Error(`No data found for query: ${promQuery}`);
    }

    return parseFloat(results[0].value[1]);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch instant metric: ${error.message}`);
    }
    throw error;
  }
}
