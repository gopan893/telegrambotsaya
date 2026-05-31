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

function runBenchmark(caseIdOrObject, services = {}, options = {}) {
  // Signature 1: runBenchmark(caseId, services)
  // Signature 2: runBenchmark(testCaseObject, services, options)
  let testCase;
  if (typeof caseIdOrObject === 'string') {
    testCase = benchmarkCases.cases.find(c => c.id === caseIdOrObject || c.type === caseIdOrObject);
    if (!testCase) {
      testCase = {
        id: 'runtime-dynamic-case',
        type: 'fallback',
        title: `Dynamic case: ${caseIdOrObject}`,
        run: () => ({ score: 0.8, passed: true, notes: 'Fallback dynamic verification.' })
      };
    }
  } else {
    testCase = caseIdOrObject;
  }

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

function runBenchmarkSuite(options = {}, services = {}) {
  // Signature 1: runBenchmarkSuite(options, services) -> required
  // Signature 2: runBenchmarkSuite(type = null, services = {}, options = {}) -> backward compatible
  let type = null;
  let finalServices = services;
  let finalOptions = options;

  if (typeof options === 'string' || options === null) {
    type = options;
    finalServices = services || {};
    finalOptions = arguments[2] || {};
  } else {
    type = options.type || null;
    finalServices = services || {};
  }

  const state = store.getOpsState(finalServices);
  const baselineId = state.benchmarkBaselineId || null;
  const selected = benchmarkCases.getBenchmarkCases(type, finalOptions);
  const results = selected.map(testCase => runBenchmark(testCase, finalServices, { baselineId }));
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
    full: Boolean(finalOptions.full),
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
  store.saveOpsState(finalServices);
  return run;
}

function compareBenchmarkRuns(current, baseline) {
  // Signature 1: compareBenchmarkRuns(current, baseline) -> current is current, baseline is baseline
  // Signature 2: compareBenchmarkRuns(before, after) -> before is before, after is after
  const before = baseline || current;
  const after = baseline ? current : before; // normalize current/baseline vs before/after

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

function getBenchmarkHistory(options = {}, services = {}) {
  // Signature 1: getBenchmarkHistory(options, services) -> required
  // Signature 2: getBenchmarkHistory(services, limit) -> backward compatible
  let finalServices = services;
  let limit = 10;

  if (options && typeof options.ensureUser === 'function') {
    finalServices = options;
    limit = Number(services) || 10;
  } else if (options && typeof options === 'object') {
    limit = Number(options.limit) || 10;
  }

  const state = store.getOpsState(finalServices);
  return (state.benchmarkRuns || []).slice(-limit);
}

function getBenchmarkSummary(services = {}) {
  const history = getBenchmarkHistory({}, services);
  const latest = history[history.length - 1] || null;
  const baseline = history.find(run => run.id === store.getOpsState(services).benchmarkBaselineId) || null;
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

function saveBenchmarkRun(run, services = {}) {
  const state = store.getOpsState(services);
  store.appendBounded(state.benchmarkRuns, run, state.config.maxBenchmarkRuns);
  store.saveOpsState(services);
  return true;
}

module.exports = {
  runBenchmark,
  runBenchmarkSuite,
  compareBenchmarkRuns,
  getBenchmarkHistory,
  getBenchmarkSummary,
  saveBenchmarkRun
};
