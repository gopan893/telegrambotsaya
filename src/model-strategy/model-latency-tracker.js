'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');

function recordLatency(model = '', provider = '', latencyMs = 0, services = {}) {
  return store.addRecord('latencyRecords', {
    id: utils.createId('lat'),
    model,
    provider,
    latencyMs,
    recordedAt: new Date().toISOString()
  }, services);
}

async function getLatencyStats(model = '', services = {}) {
  const records = await store.getRecords('latencyRecords', r => r.model === model, services);
  if (!records.length) return { model, count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  const sorted = records.map(r => r.latencyMs).sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);
  return {
    model,
    count: sorted.length,
    avgMs: Math.round(total / sorted.length),
    p50Ms: sorted[Math.floor(sorted.length * 0.5)] || 0,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0,
    maxMs: sorted[sorted.length - 1] || 0
  };
}

async function getModelLatencyRanking(services = {}) {
  const all = await store.getRecords('latencyRecords', null, services);
  const byModel = {};
  for (const r of all) {
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(r.latencyMs);
  }
  return Object.entries(byModel).map(([model, latencies]) => {
    const sorted = latencies.sort((a, b) => a - b);
    const total = sorted.reduce((s, v) => s + v, 0);
    return {
      model,
      count: sorted.length,
      avgMs: Math.round(total / sorted.length),
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0
    };
  }).sort((a, b) => a.avgMs - b.avgMs);
}

function isLatencyAcceptable(latencyMs = 0, model = '', services = {}) {
  const thresholds = services.latencyThresholds || { default: 30000, local: 10000, cloud: 15000 };
  const key = model.includes('local') ? 'local' : 'cloud';
  const threshold = thresholds[key] || thresholds.default || 30000;
  return { acceptable: latencyMs <= threshold, latencyMs, threshold };
}

module.exports = { recordLatency, getLatencyStats, getModelLatencyRanking, isLatencyAcceptable };
