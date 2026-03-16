import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliRoot = path.resolve(__dirname, '..');

function runCli(args, cwd = cliRoot) {
  const result = spawnSync('node', ['./bin/vitals', ...args], {
    cwd,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`CLI failed (${result.status})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

test('phase5 dependencies import-traces and map flow', () => {
  const testDataRoot = mkdtempSync(path.join(tmpdir(), 'vitals-phase5-deps-'));

  try {
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-traces.json');

    const importResult = runCli([
      'data',
      'dependencies',
      'import-traces',
      '--file',
      fixturePath,
      '--data-root',
      testDataRoot
    ]);

    const importJson = JSON.parse(importResult.stdout);
    assert.ok(importJson.services >= 3, 'expected at least three discovered services');
    assert.ok(importJson.dependencies >= 2, 'expected at least two discovered dependencies');

    const mapResult = runCli([
      'data',
      'dependencies',
      'map',
      '--format',
      'json',
      '--data-root',
      testDataRoot
    ]);

    const mapJson = JSON.parse(mapResult.stdout);
    assert.ok(Array.isArray(mapJson.services));
    assert.ok(Array.isArray(mapJson.dependencies));

    const serviceNames = mapJson.services.map(service => service.name);
    assert.ok(serviceNames.includes('frontend'));
    assert.ok(serviceNames.includes('catalog-service'));
  } finally {
    rmSync(testDataRoot, { recursive: true, force: true });
  }
});

test('phase5 regressions import-historical and list flow', () => {
  const testDataRoot = mkdtempSync(path.join(tmpdir(), 'vitals-phase5-reg-'));
  const testHistoryRoot = mkdtempSync(path.join(tmpdir(), 'vitals-history-'));

  try {
    const regressionsDir = path.join(testHistoryRoot, 'regressions');
    mkdirSync(regressionsDir, { recursive: true });

    const historicalFile = path.join(regressionsDir, 'latency_p95.jsonl');
    writeFileSync(
      historicalFile,
      `${JSON.stringify({
        id: 'hist-1',
        timestamp: '2026-03-16T12:00:00.000Z',
        metric: 'latency_p95',
        verdict: 'FAIL',
        change_percent: 22.5,
        p_value: 0.01,
        effect_size: 0.9,
        baseline_mean: 120,
        candidate_mean: 147,
        candidate_label: 'deploy-456',
        metadata: { service: 'checkout-service', tags: ['historical', 'imported'] }
      })}\n`,
      'utf8'
    );

    const importResult = runCli([
      'data',
      'regressions',
      'import-historical',
      '--data-root',
      testDataRoot,
      '--history-dir',
      testHistoryRoot
    ]);

    const importJson = JSON.parse(importResult.stdout);
    assert.equal(importJson.imported, 1);

    const listResult = runCli([
      'data',
      'regressions',
      'list',
      '--data-root',
      testDataRoot,
      '--metric',
      'latency_p95',
      '--format',
      'json',
      '--limit',
      '5'
    ]);

    const listJson = JSON.parse(listResult.stdout);
    assert.equal(listJson.length, 1);
    assert.equal(listJson[0].service, 'checkout-service');
    assert.equal(listJson[0].verdict, 'FAIL');
  } finally {
    rmSync(testDataRoot, { recursive: true, force: true });
    rmSync(testHistoryRoot, { recursive: true, force: true });
  }
});