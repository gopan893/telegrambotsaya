'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const benchmarkEngine = require('./benchmark-engine');
const regressionDetector = require('./regression-detector');

function shouldRunEvaluation(services = {}) {
  const state = store.getOpsState(services);
  if (!state.scheduler.enabled) return { shouldRun: false, reason: 'scheduler_disabled' };
  const last = Date.parse(state.scheduler.lastEvaluationAt || 0);
  if (!Number.isFinite(last)) return { shouldRun: true, reason: 'never_run' };
  const due = Date.now() - last >= Number(state.scheduler.intervalMs || 6 * 60 * 60 * 1000);
  return { shouldRun: due, reason: due ? 'interval_due' : 'not_due' };
}

function runEvaluation(services = {}, options = {}) {
  const state = store.getOpsState(services);
  const run = benchmarkEngine.runBenchmarkSuite(options.type || null, services);
  const regression = regressionDetector.detectRegression(services);
  const evaluation = {
    id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: guards.nowIso(),
    benchmarkRunId: run.id,
    score: run.score,
    regressionDetected: regression.regressionDetected,
    regressionSeverity: regression.severity
  };
  store.appendBounded(state.evaluations, evaluation, 40);
  state.scheduler.lastEvaluationAt = evaluation.timestamp;
  store.saveOpsState(services);
  return { evaluation, benchmark: run, regression };
}

function setEvaluationSchedule(enabled, intervalMs, services = {}) {
  const state = store.getOpsState(services);
  state.scheduler.enabled = Boolean(enabled);
  if (intervalMs) state.scheduler.intervalMs = guards.clamp(intervalMs, 30 * 60 * 1000, 24 * 60 * 60 * 1000);
  store.saveOpsState(services);
  return state.scheduler;
}

module.exports = {
  shouldRunEvaluation,
  runEvaluation,
  setEvaluationSchedule
};
