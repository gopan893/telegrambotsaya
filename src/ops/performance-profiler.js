'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function recordOperation(scope, latencyMs, services = {}, meta = {}) {
  const state = store.getOpsState(services);
  const ms = Math.max(0, Number(latencyMs || 0));
  store.appendBounded(state.profiler.operations, {
    scope: guards.sanitizeText(scope || 'unknown', 80),
    latencyMs: Math.round(ms),
    meta: guards.sanitizeMeta(meta),
    timestamp: guards.nowIso()
  }, 160);
  store.saveOpsState(services);
}

function summarizePerformance(services = {}) {
  const state = store.getOpsState(services);
  const ops = state.profiler.operations || [];
  const sorted = ops.map(item => Number(item.latencyMs || 0)).sort((a, b) => a - b);
  const p = (q) => {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
    return sorted[idx];
  };
  const slow = ops.filter(item => item.latencyMs > 1200).slice(-5);
  const groups = {};
  for (const item of ops) {
    const scope = item.scope || 'unknown';
    if (!groups[scope]) groups[scope] = { calls: 0, totalMs: 0, maxMs: 0 };
    groups[scope].calls += 1;
    groups[scope].totalMs += item.latencyMs;
    groups[scope].maxMs = Math.max(groups[scope].maxMs, item.latencyMs);
  }
  const slowOperations = Object.entries(groups)
    .map(([scope, val]) => ({
      scope,
      averageMs: Math.round(val.totalMs / val.calls),
      maxMs: val.maxMs
    }))
    .sort((a, b) => b.averageMs - a.averageMs);

  let bottleneck = 'none';
  if (slowOperations[0]) {
    bottleneck = slowOperations[0].averageMs > 3000 ? `${slowOperations[0].scope} (high latency)` : slowOperations[0].scope;
  }

  return {
    sampleCount: ops.length,
    latency: {
      p50: p(0.5),
      p90: p(0.9),
      p95: p(0.95),
      max: sorted[sorted.length - 1] || 0
    },
    bottleneck,
    slowOperations,
    generatedAt: guards.nowIso()
  };
}

// Section H Required Functions:
function getLatencySummary(services = {}) {
  return summarizePerformance(services).latency;
}

function getSlowOperations(services = {}) {
  return summarizePerformance(services).slowOperations;
}

function getCommandPerformance(services = {}) {
  const state = store.getOpsState(services);
  const ops = state.profiler.operations || [];
  const commands = ops.filter(item => item.scope === 'command' || item.scope?.startsWith('cmd:'));
  return {
    count: commands.length,
    avgLatency: commands.length ? Math.round(commands.reduce((sum, item) => sum + item.latencyMs, 0) / commands.length) : 0
  };
}

function getToolPerformance(services = {}) {
  const state = store.getOpsState(services);
  const ops = state.profiler.operations || [];
  const tools = ops.filter(item => item.scope === 'tool' || item.scope?.startsWith('tool:'));
  return {
    count: tools.length,
    avgLatency: tools.length ? Math.round(tools.reduce((sum, item) => sum + item.latencyMs, 0) / tools.length) : 0
  };
}

module.exports = {
  recordOperation,
  summarizePerformance,
  getLatencySummary,
  getSlowOperations,
  getCommandPerformance,
  getToolPerformance
};
