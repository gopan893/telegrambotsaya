'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function createCanary(name, options = {}, services = {}) {
  const state = store.getOpsState(services);
  const canary = {
    id: `canary_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: guards.sanitizeText(name || 'unnamed-canary', 120),
    description: guards.sanitizeText(options.description || '', 260),
    status: 'draft',
    rolloutPercent: guards.clamp(options.rolloutPercent || 0, 0, 25),
    createdAt: guards.nowIso(),
    updatedAt: guards.nowIso(),
    assignedUsers: [],
    metrics: []
  };
  store.appendBounded(state.canaries, canary, 30);
  store.saveOpsState(services);
  return canary;
}

function assignUserToCanary(userId, canaryId, services = {}) {
  const state = store.getOpsState(services);
  const canary = (state.canaries || []).find(item => item.id === canaryId);
  if (!canary) return { ok: false, reason: 'canary_not_found' };
  const id = guards.sanitizeText(userId, 60);
  if (!canary.assignedUsers.includes(id)) canary.assignedUsers.push(id);
  canary.updatedAt = guards.nowIso();
  store.saveOpsState(services);
  return { ok: true, canary };
}

function recordCanaryMetric(canaryId, metric = {}, services = {}) {
  const state = store.getOpsState(services);
  const canary = (state.canaries || []).find(item => item.id === canaryId);
  if (!canary) return { ok: false, reason: 'canary_not_found' };
  store.appendBounded(canary.metrics, {
    timestamp: guards.nowIso(),
    name: guards.sanitizeText(metric.name || 'metric', 80),
    value: Number(metric.value || 0),
    note: guards.sanitizeText(metric.note || '', 160)
  }, 80);
  canary.updatedAt = guards.nowIso();
  store.saveOpsState(services);
  return { ok: true, canary };
}

function compareCanary(canaryId, services = {}) {
  const state = store.getOpsState(services);
  const canary = (state.canaries || []).find(item => item.id === canaryId);
  if (!canary) return { ok: false, reason: 'canary_not_found' };
  const metrics = canary.metrics || [];
  const average = metrics.length
    ? metrics.reduce((sum, item) => sum + Number(item.value || 0), 0) / metrics.length
    : 0;
  return {
    ok: true,
    canary,
    metricCount: metrics.length,
    average: Number(average.toFixed(2)),
    baselineAverage: 0.75,
    deltaVsBaseline: Number((average - 0.75).toFixed(3)),
    recommendation: average >= 0.75 && metrics.length >= 3 ? 'eligible_for_manual_promotion' : 'keep_observing_or_rollback'
  };
}

function promoteCanary(canaryId, services = {}) {
  const state = store.getOpsState(services);
  const canary = (state.canaries || []).find(item => item.id === canaryId);
  if (!canary) return { ok: false, reason: 'canary_not_found' };
  const comparison = compareCanary(canaryId, services);
  if (!comparison.ok || comparison.metricCount < 3 || comparison.average < 0.75) {
    return {
      ok: false,
      reason: 'canary_evidence_insufficient',
      comparison
    };
  }
  canary.status = 'promoted';
  canary.updatedAt = guards.nowIso();
  store.saveOpsState(services);
  return { ok: true, canary };
}

function rollbackCanary(canaryId, services = {}) {
  const state = store.getOpsState(services);
  const canary = (state.canaries || []).find(item => item.id === canaryId);
  if (!canary) return { ok: false, reason: 'canary_not_found' };
  canary.status = 'rolled_back';
  canary.updatedAt = guards.nowIso();
  store.saveOpsState(services);
  return { ok: true, canary };
}

function listCanaries(services = {}, limit = 10) {
  const state = store.getOpsState(services);
  return (state.canaries || []).slice(-limit).reverse();
}

module.exports = {
  createCanary,
  assignUserToCanary,
  recordCanaryMetric,
  compareCanary,
  promoteCanary,
  rollbackCanary,
  listCanaries
};
