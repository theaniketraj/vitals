"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRegression = runRegression;
const welch_1 = require("./stats/welch");
const advanced_1 = require("./stats/advanced");
/**
 * Run regression analysis comparing baseline and candidate deployments
 */
async function runRegression(options, baselineData, candidateData) {
    const { metric, threshold = 10, pValue: pValueThreshold = 0.05, effectSizeThreshold = 0.5, minSamples = 30, testType = 'welch' } = options;
    // Step 1: Validate sample sizes
    if (!(0, welch_1.validateSampleSize)(baselineData, minSamples) || !(0, welch_1.validateSampleSize)(candidateData, minSamples)) {
        return {
            metric,
            baseline: { mean: 0, samples: baselineData.length },
            candidate: { mean: 0, samples: candidateData.length },
            change_percent: 0,
            p_value: 1,
            effect_size: 0,
            significant: false,
            verdict: 'INSUFFICIENT_DATA',
            details: `Insufficient data: baseline=${baselineData.length}, candidate=${candidateData.length}, required=${minSamples}`
        };
    }
    // Step 2: Remove outliers
    const baselineCleaned = (0, welch_1.removeOutliers)(baselineData);
    const candidateCleaned = (0, welch_1.removeOutliers)(candidateData);
    // Step 3: Normalize to fixed sample size
    const baselineNormalized = (0, welch_1.normalizeSeries)(baselineCleaned, 50);
    const candidateNormalized = (0, welch_1.normalizeSeries)(candidateCleaned, 50);
    // Step 4: Apply smoothing
    const baselineSmoothed = (0, welch_1.smooth)(baselineNormalized, 3);
    const candidateSmoothed = (0, welch_1.smooth)(candidateNormalized, 3);
    // Step 5: Calculate statistics
    const baselineMean = (0, welch_1.mean)(baselineSmoothed);
    const candidateMean = (0, welch_1.mean)(candidateSmoothed);
    const changePercent = ((candidateMean - baselineMean) / baselineMean) * 100;
    // Step 6: Statistical tests (with test selection)
    let pValue;
    if (testType === 'auto') {
        // Automatically select the best test
        const selectedTest = (0, advanced_1.selectStatisticalTest)(baselineSmoothed, candidateSmoothed);
        if (selectedTest === 'mann-whitney') {
            const result = (0, advanced_1.mannWhitneyUTest)(baselineSmoothed, candidateSmoothed);
            pValue = result.pValue;
        }
        else if (selectedTest === 'permutation') {
            const result = (0, advanced_1.permutationTest)(baselineSmoothed, candidateSmoothed, 1000);
            pValue = result.pValue;
        }
        else {
            const result = (0, welch_1.welchTest)(baselineSmoothed, candidateSmoothed);
            pValue = result.pValue;
        }
    }
    else if (testType === 'mann-whitney') {
        // Non-parametric test (doesn't assume normal distribution)
        const result = (0, advanced_1.mannWhitneyUTest)(baselineSmoothed, candidateSmoothed);
        pValue = result.pValue;
    }
    else if (testType === 'permutation') {
        // Exact test (good for small samples)
        const result = (0, advanced_1.permutationTest)(baselineSmoothed, candidateSmoothed, 1000);
        pValue = result.pValue;
    }
    else {
        // Default: Welch's t-test
        const result = (0, welch_1.welchTest)(baselineSmoothed, candidateSmoothed);
        pValue = result.pValue;
    }
    const effectSize = Math.abs((0, welch_1.cohensD)(baselineSmoothed, candidateSmoothed));
    // Step 7: Determine significance
    const isStatisticallySignificant = pValue < pValueThreshold;
    const isPracticallySignificant = effectSize > effectSizeThreshold;
    const exceedsThreshold = Math.abs(changePercent) > threshold;
    const significant = isStatisticallySignificant && isPracticallySignificant;
    // Step 8: Make decision
    let verdict = 'PASS';
    if (significant && exceedsThreshold) {
        verdict = changePercent > 0 ? 'FAIL' : 'PASS'; // Regression is an increase
    }
    else if (isStatisticallySignificant && exceedsThreshold) {
        verdict = 'WARN';
    }
    return {
        metric,
        baseline: {
            mean: baselineMean,
            samples: baselineData.length
        },
        candidate: {
            mean: candidateMean,
            samples: candidateData.length
        },
        change_percent: changePercent,
        p_value: pValue,
        effect_size: effectSize,
        significant,
        verdict
    };
}
