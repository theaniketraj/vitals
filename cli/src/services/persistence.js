"use strict";
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
exports.persistRegressionToPhase5 = persistRegressionToPhase5;
const path = __importStar(require("node:path"));
const regressionDatabase_1 = require("../database/regressionDatabase");
function getDataRoot(input) {
    if (!input || input === '~/.vitals') {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(homeDir, '.vitals');
    }
    if (input.startsWith('~')) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(homeDir, input.slice(2));
    }
    return input;
}
function toPersistedVerdict(verdict) {
    if (verdict === 'INSUFFICIENT_DATA') {
        return 'WARN';
    }
    return verdict;
}
async function persistRegressionToPhase5(input) {
    const root = getDataRoot(input.dataRoot);
    const db = new regressionDatabase_1.RegressionDatabase(path.join(root, 'database'));
    await db.initialize();
    const record = {
        id: '',
        timestamp: new Date(),
        service: input.service || 'unknown',
        metric: input.metric,
        verdict: toPersistedVerdict(input.verdict),
        baseline_mean: input.baselineMean,
        baseline_stddev: input.baselineStdDev,
        baseline_sample_count: input.baselineSamples,
        candidate_mean: input.candidateMean,
        candidate_stddev: input.candidateStdDev,
        candidate_sample_count: input.candidateSamples,
        change_percent: input.changePercent,
        p_value: input.pValue,
        effect_size: input.effectSize,
        deployment_id: input.candidateLabel,
        metadata: {
            baseline_label: input.baselineLabel,
            candidate_label: input.candidateLabel,
            ...(input.threshold !== undefined && { threshold: input.threshold }),
            ...(input.metadata || {})
        }
    };
    return db.insert(record);
}
