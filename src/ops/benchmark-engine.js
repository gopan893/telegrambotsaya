'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const benchmarkCases = require('./benchmark-cases');

function normalizeCaseResult(testCase, result, latencyMs, baselineId = null) {
  const status = result.passed === false ? 'failed' : 'passed';
  return {
    id: testCase.id,
    type: testCase.type,
    status,
    passed: status === 'passed',
    title: testCase.title,
    score: Number(result.score || 0),
    latencyMs,
    details: result.details || { notes: guards.sanitizeText(result.notes || '', 240) },
    errors: result.error ? [guards.sanitizeText(result.error, 240)] : [],
    notes: guards.sanitizeText(result.notes || '', 240),
    createdAt: guards.nowIso(),
    baselineId,
    regressionAgainstBaseline: false
  };
}

function runBenchmark(testCase, services = {}, options = {}) {
  const start = Date.now();
  try {
    const result = typeof testCase.run === 'function'
      ? testCase.run(services)
      : { score: 0.5, passed: true, notes: 'No-op benchmark.' };
    const latencyMs = result.latencyMs !== undefined ? result.latencyMs : Date.now() - start;
    return normalizeCaseResult(testCase, result, latencyMs, options.baselineId || null);
  } catch (err) {
    return normalizeCaseResult(testCase, {
      score: 0,
      passed: false,
      error: err.message,
      notes: err.message
    }, Date.now() - start, options.baselineId || null);
  }
}

function runBenchmarkSuite(type = null, services = {}, options = {}) {
  const state = store.getOpsState(services);
  const baselineId = state.benchmarkBaselineId || null;
  const selected = benchmarkCases.getBenchmarkCases(type, options);
  const results = selected.map(testCase => runBenchmark(testCase, services, { baselineId }));
  const score = results.length
    ? results.reduce((sum, item) => sum + item.score, 0) / results.length
    : 0;
  const run = {
    id: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: type || 'suite',
    status: results.every(item => item.passed) ? 'passed' : 'failed',
    createdAt: guards.nowIso(),
    score: Number(score.toFixed(3)),
    passed: results.every(item => item.passed),
    caseCount: results.length,
    full: Boolean(options.full),
    baselineId,
    regressionAgainstBaseline: false,
    results
  };
  if (!state.benchmarkBaselineId && run.passed) {
    state.benchmarkBaselineId = run.id;
    run.baselineId = run.id;
  }
  if (baselineId) {
    const baseline = (state.benchmarkRuns || []).find(item => item.id === baselineId);
    const comparison = compareBenchmarkRuns(baseline, run);
    run.regressionAgainstBaseline = comparison.regression;
    for (const result of run.results) {
      result.regressionAgainstBaseline = comparison.regression && result.score < 0.7;
    }
  }
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

function getBenchmarkSummary(services = {}) {
  const history = getBenchmarkHistory(services, 10);
  const latest = history[history.length - 1] || null;
  const baseline = history.find(item => item.id === store.getOpsState(services).benchmarkBaselineId) || null;
  return {
    totalRuns: (store.getOpsState(services).benchmarkRuns || []).length,
    baselineId: baseline?.id || store.getOpsState(services).benchmarkBaselineId || null,
    latestId: latest?.id || null,
    latestScore: latest?.score || 0,
    latestStatus: latest?.status || 'none',
    latestCreatedAt: latest?.createdAt || null,
    regressionAgainstBaseline: Boolean(latest?.regressionAgainstBaseline)
  };
}

module.exports = {
  runBenchmark,
  runBenchmarkSuite,
  compareBenchmarkRuns,
  getBenchmarkHistory,
  getBenchmarkSummary
};
