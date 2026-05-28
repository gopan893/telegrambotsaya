'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const telemetryCollector = require('./telemetry-collector');

function recordOperation(scope, latencyMs, services = {}, meta = {}) {
  const state = store.getOpsState(services);
  const item = {
    timestamp: guards.nowIso(),
    scope: guards.sanitizeText(scope || 'unknown', 100),
    latencyMs: Math.max(0, Math.round(Number(latencyMs || 0))),
    meta: guards.sanitizeMeta(meta)
  };
  store.appendBounded(state.profiler.operations, item, 160);
  telemetryCollector.recordLatency(`op:${item.scope}`, item.latencyMs, services, item.meta);
  store.compactState(state);
  store.saveOpsState(services);
  return item;
}

function summarizePerformance(services = {}) {
  const state = store.getOpsState(services);
  const ops = state.profiler.operations || [];
  const byScope = {};
  for (const op of ops) {
    const scope = op.scope || 'unknown';
    if (!byScope[scope]) byScope[scope] = { count: 0, total: 0, max: 0 };
    byScope[scope].count += 1;
    byScope[scope].total += Number(op.latencyMs || 0);
    byScope[scope].max = Math.max(byScope[scope].max, Number(op.latencyMs || 0));
  }
  const scopes = Object.entries(byScope).map(([scope, data]) => ({
    scope,
    count: data.count,
    averageMs: data.count ? Math.round(data.total / data.count) : 0,
    maxMs: data.max
  })).sort((a, b) => b.averageMs - a.averageMs);

  const telemetry = telemetryCollector.getTelemetrySummary(services);
  return {
    sampleCount: ops.length,
    slowOperations: scopes.filter(item => item.averageMs >= 2500).slice(0, 8),
    scopes: scopes.slice(0, 12),
    latency: telemetry.latency,
    bottleneck: scopes[0]?.scope || 'none',
    generatedAt: guards.nowIso()
  };
}

module.exports = {
  recordOperation,
  summarizePerformance
};
