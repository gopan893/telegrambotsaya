'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const reliabilityScorer = require('./reliability-scorer');
const regressionDetector = require('./regression-detector');

function adjustThresholds(services = {}) {
  const state = store.getOpsState(services);
  const reliability = reliabilityScorer.calculateReliabilityScore(services);
  const thresholds = state.adaptive.thresholds || {};
  const next = {
    maxLatencyP90Ms: reliability.score < 70 ? 7000 : 9000,
    maxRecentErrors: reliability.score < 70 ? 4 : 8,
    maxAverageTokens: reliability.score < 70 ? 1200 : 1600,
    telemetrySamplingRate: reliability.score < 70 ? 0.75 : 1
  };
  state.adaptive.thresholds = { ...thresholds, ...next, updatedAt: guards.nowIso() };
  store.saveOpsState(services);
  return state.adaptive.thresholds;
}

function learnIncidentPattern(incident = {}, services = {}) {
  const state = store.getOpsState(services);
  const key = `${incident.category || incident.classification || 'ops'}:${incident.suspectedCause || 'unknown'}`.slice(0, 160);
  const prev = state.adaptive.incidentPatterns[key] || {
    count: 0,
    firstSeenAt: guards.nowIso(),
    lastSeenAt: null,
    severity: incident.severity || 'warning'
  };
  prev.count += 1;
  prev.lastSeenAt = guards.nowIso();
  prev.severity = incident.severity || prev.severity;
  state.adaptive.incidentPatterns[key] = prev;
  store.saveOpsState(services);
  return prev;
}

function prioritizeFixes(diagnosis = {}, regression = null) {
  const fixes = (diagnosis.recommendedFixes || []).map((fix, index) => ({
    fix,
    priority: index + 1,
    reason: diagnosis.category || diagnosis.diagnosis || 'diagnostic finding'
  }));
  if (regression?.regressionDetected || regression?.detected) {
    fixes.unshift({
      fix: regression.recommendation || 'Review regression before tuning.',
      priority: 0,
      reason: `regression:${regression.metric || 'unknown'}`
    });
  }
  return fixes.slice(0, 6);
}

function recommendRollback(services = {}) {
  const regression = regressionDetector.detectRegression(services);
  const guard = guards.regressionRollbackGuard(regression);
  return {
    recommended: guard.allowed,
    reason: guard.reason || regression.recommendation,
    regression,
    confidence: guard.allowed ? 0.78 : 0.45
  };
}

function usageAwareOptimization(services = {}) {
  const state = store.getOpsState(services);
  const thresholds = adjustThresholds(services);
  const guard = guards.runawayCostPrevention(state, 'benchmark');
  return {
    thresholds,
    benchmarkAllowed: guard.allowed,
    recommendation: guard.allowed
      ? 'Benchmark manual aman dijalankan.'
      : guard.reason,
    reversible: true
  };
}

module.exports = {
  adjustThresholds,
  learnIncidentPattern,
  prioritizeFixes,
  recommendRollback,
  usageAwareOptimization
};
