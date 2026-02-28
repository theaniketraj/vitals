/**
 * Enhanced Data Preprocessing Module
 * 
 * Implements comprehensive data preprocessing pipeline:
 * - Time window alignment
 * - Outlier removal (IQR, Z-score, MAD methods)
 * - Normalization strategies
 * - Multiple smoothing techniques
 * - Data validation
 */

export interface PreprocessingOptions {
  /** Outlier removal method */
  outlierMethod?: 'iqr' | 'zscore' | 'mad' | 'none';
  /** IQR multiplier (default: 1.5) */
  iqrMultiplier?: number;
  /** Z-score threshold (default: 3) */
  zscoreThreshold?: number;
  /** Normalize to fixed sample size */
  targetSampleSize?: number;
  /** Smoothing method */
  smoothingMethod?: 'moving-average' | 'exponential' | 'gaussian' | 'none';
  /** Smoothing window size (default: 3) */
  smoothingWindow?: number;
  /** Exponential smoothing alpha (default: 0.3) */
  exponentialAlpha?: number;
  /** Minimum sample size required */
  minSampleSize?: number;
  /** Fill missing values strategy */
  fillStrategy?: 'interpolate' | 'forward' | 'backward' | 'mean' | 'none';
}

export interface PreprocessingResult {
  /** Processed data */
  data: number[];
  /** Original data length */
  originalLength: number;
  /** Outliers removed count */
  outliersRemoved: number;
  /** Missing values filled count */
  missingValuesFilled: number;
  /** Processing steps applied */
  stepsApplied: string[];
  /** Warnings or issues */
  warnings: string[];
}

/**
 * Comprehensive preprocessing pipeline
 */
export function preprocessData(
  data: number[],
  options: PreprocessingOptions = {}
): PreprocessingResult {
  const {
    outlierMethod = 'iqr',
    iqrMultiplier = 1.5,
    zscoreThreshold = 3,
    targetSampleSize = 50,
    smoothingMethod = 'moving-average',
    smoothingWindow = 3,
    exponentialAlpha = 0.3,
    minSampleSize = 30,
    fillStrategy = 'interpolate'
  } = options;

  const result: PreprocessingResult = {
    data: [...data],
    originalLength: data.length,
    outliersRemoved: 0,
    missingValuesFilled: 0,
    stepsApplied: [],
    warnings: []
  };

  // Step 1: Validate input
  if (data.length === 0) {
    result.warnings.push('Empty dataset provided');
    return result;
  }

  // Step 2: Handle missing values (NaN, Infinity)
  const cleaned = fillMissingValues(result.data, fillStrategy);
  result.missingValuesFilled = cleaned.filled;
  result.data = cleaned.data;
  if (cleaned.filled > 0) {
    result.stepsApplied.push(`filled_missing_values:${fillStrategy}`);
  }

  // Step 3: Check minimum sample size
  if (result.data.length < minSampleSize) {
    result.warnings.push(`Sample size ${result.data.length} below minimum ${minSampleSize}`);
  }

  // Step 4: Remove outliers
  if (outlierMethod !== 'none') {
    const beforeLength = result.data.length;
    
    switch (outlierMethod) {
      case 'iqr':
        result.data = removeOutliersIQR(result.data, iqrMultiplier);
        break;
      case 'zscore':
        result.data = removeOutliersZScore(result.data, zscoreThreshold);
        break;
      case 'mad':
        result.data = removeOutliersMAD(result.data);
        break;
    }
    
    result.outliersRemoved = beforeLength - result.data.length;
    if (result.outliersRemoved > 0) {
      result.stepsApplied.push(`outliers_removed:${outlierMethod}`);
    }
  }

  // Step 5: Normalize to target sample size
  if (targetSampleSize > 0 && result.data.length > targetSampleSize) {
    result.data = normalizeToFixedSize(result.data, targetSampleSize);
    result.stepsApplied.push(`normalized:${targetSampleSize}`);
  }

  // Step 6: Apply smoothing
  if (smoothingMethod !== 'none' && result.data.length > smoothingWindow) {
    switch (smoothingMethod) {
      case 'moving-average':
        result.data = movingAverageSmooth(result.data, smoothingWindow);
        break;
      case 'exponential':
        result.data = exponentialSmooth(result.data, exponentialAlpha);
        break;
      case 'gaussian':
        result.data = gaussianSmooth(result.data, smoothingWindow);
        break;
    }
    result.stepsApplied.push(`smoothed:${smoothingMethod}`);
  }

  return result;
}

/**
 * Fill missing values (NaN, Infinity)
 */
function fillMissingValues(
  data: number[],
  strategy: 'interpolate' | 'forward' | 'backward' | 'mean' | 'none'
): { data: number[]; filled: number } {
  let filled = 0;
  const result = [...data];
  
  if (strategy === 'none') {
    // Just filter out invalid values
    const validData = result.filter(v => isFinite(v));
    filled = result.length - validData.length;
    return { data: validData, filled };
  }

  // Find valid values for mean calculation
  const validValues = result.filter(v => isFinite(v));
  if (validValues.length === 0) {
    return { data: [], filled: result.length };
  }
  
  const meanValue = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;

  for (let i = 0; i < result.length; i++) {
    if (!isFinite(result[i])) {
      filled++;
      
      switch (strategy) {
        case 'interpolate':
          // Find nearest valid values
          let before = i - 1;
          while (before >= 0 && !isFinite(result[before])) before--;
          let after = i + 1;
          while (after < result.length && !isFinite(result[after])) after++;
          
          if (before >= 0 && after < result.length) {
            result[i] = (result[before] + result[after]) / 2;
          } else if (before >= 0) {
            result[i] = result[before];
          } else if (after < result.length) {
            result[i] = result[after];
          } else {
            result[i] = meanValue;
          }
          break;
          
        case 'forward':
          // Use previous valid value
          let prev = i - 1;
          while (prev >= 0 && !isFinite(result[prev])) prev--;
          result[i] = prev >= 0 ? result[prev] : meanValue;
          break;
          
        case 'backward':
          // Use next valid value (requires second pass)
          result[i] = meanValue; // Temporary, will be fixed in second pass
          break;
          
        case 'mean':
          result[i] = meanValue;
          break;
      }
    }
  }

  // Second pass for backward fill
  if (strategy === 'backward') {
    for (let i = result.length - 1; i >= 0; i--) {
      if (data[i] !== result[i]) { // Was filled in first pass
        let next = i + 1;
        while (next < result.length && data[next] !== result[next]) next++;
        result[i] = next < result.length ? result[next] : meanValue;
      }
    }
  }

  return { data: result, filled };
}

/**
 * Remove outliers using IQR method
 */
export function removeOutliersIQR(data: number[], multiplier = 1.5): number[] {
  if (data.length < 4) return data;
  
  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return data.filter(x => x >= lowerBound && x <= upperBound);
}

/**
 * Remove outliers using Z-score method
 */
export function removeOutliersZScore(data: number[], threshold = 3): number[] {
  if (data.length < 2) return data;
  
  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return data;

  return data.filter(x => Math.abs((x - mean) / stdDev) <= threshold);
}

/**
 * Remove outliers using Median Absolute Deviation (MAD) method
 * More robust to extreme outliers than Z-score
 */
export function removeOutliersMAD(data: number[]): number[] {
  if (data.length < 2) return data;
  
  // Calculate median
  const sorted = [...data].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculate MAD
  const deviations = data.map(x => Math.abs(x - median));
  const madSorted = deviations.sort((a, b) => a - b);
  const mad = madSorted[Math.floor(madSorted.length / 2)];

  if (mad === 0) return data;

  // Modified Z-score using MAD
  const threshold = 3.5; // Standard threshold for MAD method
  return data.filter(x => {
    const modifiedZScore = 0.6745 * Math.abs(x - median) / mad;
    return modifiedZScore <= threshold;
  });
}

/**
 * Normalize time series to fixed sample size using averaging
 */
export function normalizeToFixedSize(data: number[], targetSize: number): number[] {
  if (data.length <= targetSize) return data;

  const result: number[] = [];
  const chunkSize = data.length / targetSize;

  for (let i = 0; i < targetSize; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.floor((i + 1) * chunkSize);
    const chunk = data.slice(start, end);
    const avg = chunk.reduce((sum, v) => sum + v, 0) / chunk.length;
    result.push(avg);
  }

  return result;
}

/**
 * Moving average smoothing (simple rolling average)
 */
export function movingAverageSmooth(data: number[], windowSize = 3): number[] {
  if (data.length < windowSize) return data;
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
    result.push(avg);
  }

  return result;
}

/**
 * Exponential smoothing (EWMA)
 */
export function exponentialSmooth(data: number[], alpha = 0.3): number[] {
  if (data.length === 0) return [];
  
  const result: number[] = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1];
    result.push(smoothed);
  }

  return result;
}

/**
 * Gaussian smoothing using gaussian weights
 */
export function gaussianSmooth(data: number[], windowSize = 3): number[] {
  if (data.length < windowSize) return data;
  
  // Generate gaussian kernel
  const sigma = windowSize / 6; // Standard deviation
  const halfWindow = Math.floor(windowSize / 2);
  const kernel: number[] = [];
  
  for (let i = -halfWindow; i <= halfWindow; i++) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(weight);
  }
  
  // Normalize kernel
  const kernelSum = kernel.reduce((sum, w) => sum + w, 0);
  const normalizedKernel = kernel.map(w => w / kernelSum);

  // Apply convolution
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    let weighted = 0;
    let weightSum = 0;
    
    for (let j = 0; j < kernel.length; j++) {
      const dataIndex = i - halfWindow + j;
      if (dataIndex >= 0 && dataIndex < data.length) {
        weighted += data[dataIndex] * normalizedKernel[j];
        weightSum += normalizedKernel[j];
      }
    }
    
    result.push(weighted / weightSum);
  }

  return result;
}

/**
 * Align time series data to common time windows
 */
export function alignTimeWindows(
  data1: Array<[number, number]>, // [timestamp, value]
  data2: Array<[number, number]>,
  intervalSeconds = 15
): { aligned1: number[]; aligned2: number[]; timestamps: number[] } {
  if (data1.length === 0 || data2.length === 0) {
    return { aligned1: [], aligned2: [], timestamps: [] };
  }

  // Find common time range
  const start = Math.max(data1[0][0], data2[0][0]);
  const end = Math.min(data1[data1.length - 1][0], data2[data2.length - 1][0]);

  // Generate aligned timestamps
  const timestamps: number[] = [];
  for (let t = start; t <= end; t += intervalSeconds) {
    timestamps.push(t);
  }

  // Interpolate values for each timestamp
  const aligned1 = timestamps.map(t => interpolateValue(data1, t));
  const aligned2 = timestamps.map(t => interpolateValue(data2, t));

  return { aligned1, aligned2, timestamps };
}

/**
 * Interpolate value at specific timestamp
 */
function interpolateValue(data: Array<[number, number]>, timestamp: number): number {
  // Find nearest points
  let before = 0;
  let after = data.length - 1;

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] <= timestamp) before = i;
    if (data[i][0] >= timestamp && after === data.length - 1) after = i;
  }

  if (before === after) return data[before][1];

  // Linear interpolation
  const t1 = data[before][0];
  const t2 = data[after][0];
  const v1 = data[before][1];
  const v2 = data[after][1];

  const ratio = (timestamp - t1) / (t2 - t1);
  return v1 + ratio * (v2 - v1);
}

/**
 * Calculate data quality metrics
 */
export function calculateDataQuality(data: number[]): {
  completeness: number;
  variance: number;
  stability: number;
  outlierRatio: number;
} {
  if (data.length === 0) {
    return { completeness: 0, variance: 0, stability: 0, outlierRatio: 0 };
  }

  // Completeness (ratio of valid values)
  const validCount = data.filter(v => isFinite(v)).length;
  const completeness = validCount / data.length;

  // Variance
  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;

  // Stability (coefficient of variation)
  const stdDev = Math.sqrt(variance);
  const stability = mean !== 0 ? 1 - Math.min(1, stdDev / Math.abs(mean)) : 0;

  // Outlier ratio
  const withoutOutliers = removeOutliersIQR(data);
  const outlierRatio = 1 - withoutOutliers.length / data.length;

  return { completeness, variance, stability, outlierRatio };
}
