import * as path from 'node:path';
import { RegressionDatabase, RegressionRecord } from '../database/regressionDatabase';

export interface PersistRegressionInput {
  dataRoot?: string;
  service?: string;
  metric: string;
  baselineLabel: string;
  candidateLabel: string;
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'INSUFFICIENT_DATA';
  baselineMean: number;
  baselineSamples: number;
  baselineStdDev: number;
  candidateMean: number;
  candidateSamples: number;
  candidateStdDev: number;
  changePercent: number;
  pValue?: number;
  effectSize?: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

function getDataRoot(input?: string): string {
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

function toPersistedVerdict(verdict: PersistRegressionInput['verdict']): 'PASS' | 'WARN' | 'FAIL' {
  if (verdict === 'INSUFFICIENT_DATA') {
    return 'WARN';
  }

  return verdict;
}

export async function persistRegressionToPhase5(input: PersistRegressionInput): Promise<string> {
  const root = getDataRoot(input.dataRoot);
  const db = new RegressionDatabase(path.join(root, 'database'));
  await db.initialize();

  const record: RegressionRecord = {
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