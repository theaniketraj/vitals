"use strict";
/**
 * Statistical utilities for regression analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mean = mean;
exports.variance = variance;
exports.welchTest = welchTest;
exports.cohensD = cohensD;
exports.removeOutliers = removeOutliers;
exports.normalizeSeries = normalizeSeries;
exports.smooth = smooth;
exports.validateSampleSize = validateSampleSize;
function mean(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}
function variance(arr, meanVal) {
    return arr.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / (arr.length - 1);
}
/**
 * Welch's t-test for comparing two samples with potentially unequal variances
 * Returns t-statistic and p-value
 */
function welchTest(sample1, sample2) {
    const n1 = sample1.length;
    const n2 = sample2.length;
    const m1 = mean(sample1);
    const m2 = mean(sample2);
    const v1 = variance(sample1, m1);
    const v2 = variance(sample2, m2);
    // Welch's t-statistic
    const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
    // Welch-Satterthwaite degrees of freedom
    const df = Math.pow(v1 / n1 + v2 / n2, 2) /
        (Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1));
    // Simplified p-value approximation (two-tailed)
    const pValue = Math.exp(-0.717 * Math.abs(t) - 0.416 * t * t);
    return { t, pValue, df };
}
/**
 * Cohen's d effect size calculation
 * Measures the standardized difference between two means
 */
function cohensD(sample1, sample2) {
    const m1 = mean(sample1);
    const m2 = mean(sample2);
    const v1 = variance(sample1, m1);
    const v2 = variance(sample2, m2);
    // Pooled standard deviation
    const pooledStd = Math.sqrt((v1 + v2) / 2);
    return (m2 - m1) / pooledStd;
}
/**
 * Remove outliers using IQR method
 */
function removeOutliers(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return data.filter(x => x >= lowerBound && x <= upperBound);
}
/**
 * Normalize time series data to fixed sample size
 */
function normalizeSeries(data, targetSize = 50) {
    if (data.length <= targetSize) {
        return data;
    }
    const chunkSize = Math.floor(data.length / targetSize);
    const result = [];
    for (let i = 0; i < targetSize; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, data.length);
        const chunk = data.slice(start, end);
        result.push(mean(chunk));
    }
    return result;
}
/**
 * Apply rolling average smoothing
 */
function smooth(data, windowSize = 3) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
        const window = data.slice(start, end);
        result.push(mean(window));
    }
    return result;
}
/**
 * Validate sample size meets minimum requirements
 */
function validateSampleSize(data, minSize = 30) {
    return data.length >= minSize;
}
