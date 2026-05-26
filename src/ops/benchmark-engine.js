'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const benchmarkCases = require('./benchmark-cases');

function runBenchmark(testCase, services = {}) {
  const start = Date.now();
  try {
    const result = typeof testCase.run === 'function'
      ? testCase.run(services)
      : { score: 0.5, passed: true, notes: 'No-op benchmark.' };
    const latencyMs = result.latencyMs !== undefined ? result.latencyMs : Date.now() - start;
    return {
      id: testCase.id,
      type: testCase.type,
      title: testCase.title,
      passed: Boolean(result.passed),
      score: Number(result.score || 0),
      latencyMs,
      notes: guards.sanitizeText(result.notes || '', 240)
    };
  } catch (err) {
    return {
      id: testCase.id,
      type: testCase.type,
      title: testCase.title,
      passed: false,
      score: 0,
      latencyMs: Date.now() - start,
      notes: guards.sanitizeText(err.message, 240)
    };
  }
}

function runBenchmarkSuite(type = null, services = {}) {
  const selected = benchmarkCases.getBenchmarkCases(type);
  const results = selected.map(testCase => runBenchmark(testCase, services));
  const score = results.length
    ? results.reduce((sum, item) => sum + item.score, 0) / results.length
    : 0;
  const run = {
    id: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: type || 'suite',
    createdAt: guards.nowIso(),
    score: Number(score.toFixed(3)),
    passed: results.every(item => item.passed),
    caseCount: results.length,
    results
  };
  const state = store.getOpsState(services);
  store.appendBounded(state.benchmarkRuns, run, state.config.maxBenchmarkRuns);
  store.compactState(state);
  store.saveOpsState(services);
  return run;
}

function compareBenchmarkRuns(before, after) {
  if (!before || !after) {
    return {
      comparable: false,
      delta: 0,
      regression: false,
      notes: 'Butuh minimal dua benchmark run.'
    };
  }
  const delta = Number((Number(after.score || 0) - Number(before.score || 0)).toFixed(3));
  return {
    comparable: true,
    beforeScore: before.score,
    afterScore: after.score,
    delta,
    regression: delta <= -0.08,
    notes: delta < 0 ? 'Skor benchmark turun.' : 'Skor benchmark stabil/naik.'
  };
}

function getBenchmarkHistory(services = {}, limit = 10) {
  const state = store.getOpsState(services);
  return (state.benchmarkRuns || []).slice(-limit);
}

module.exports = {
  runBenchmark,
  runBenchmarkSuite,
  compareBenchmarkRuns,
  getBenchmarkHistory
};
