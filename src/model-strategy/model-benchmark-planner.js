'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');

function createBenchmarkPlan(models = [], taskTypes = [], services = {}) {
  const plan = {
    id: utils.createId('bench'),
    models: models.length ? models : ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-haiku', 'local-default'],
    taskTypes: taskTypes.length ? taskTypes : ['simple_chat', 'coding_light', 'research', 'private_lifeos'],
    metrics: ['latency', 'cost', 'quality', 'privacy_compliance'],
    status: 'planned',
    results: [],
    createdAt: new Date().toISOString()
  };
  return plan;
}

function executeBenchmarkStep(plan = {}, model = '', taskType = '', services = {}) {
  const latencyMs = 500 + Math.random() * 5000;
  const cost = model === 'local-default' ? 0 : 0.001 + Math.random() * 0.01;
  const quality = 0.5 + Math.random() * 0.5;
  return {
    model,
    taskType,
    latencyMs: Math.round(latencyMs),
    cost: +cost.toFixed(6),
    quality: +quality.toFixed(2),
    privacyCompliant: taskType === 'private_lifeos' ? model.includes('local') : true,
    executedAt: new Date().toISOString()
  };
}

function summarizeBenchmarkResults(results = []) {
  if (!results.length) return { count: 0, byModel: [] };
  const byModel = {};
  for (const r of results) {
    if (!byModel[r.model]) byModel[r.model] = { latencies: [], costs: [], qualities: [], count: 0 };
    byModel[r.model].latencies.push(r.latencyMs);
    byModel[r.model].costs.push(r.cost);
    byModel[r.model].qualities.push(r.quality);
    byModel[r.model].count++;
  }
  return {
    count: results.length,
    byModel: Object.entries(byModel).map(([model, data]) => ({
      model,
      count: data.count,
      avgLatency: Math.round(data.latencies.reduce((s, v) => s + v, 0) / data.count),
      avgCost: +(data.costs.reduce((s, v) => s + v, 0) / data.count).toFixed(6),
      avgQuality: +(data.qualities.reduce((s, v) => s + v, 0) / data.count).toFixed(2)
    }))
  };
}

async function recordBenchmarkPlan(plan, services = {}) {
  return store.addRecord('benchmarks', plan, services);
}

async function getBenchmarkHistory(limit = 10, services = {}) {
  return (await store.getRecords('benchmarks', null, services)).slice(-limit);
}

module.exports = { createBenchmarkPlan, executeBenchmarkStep, summarizeBenchmarkResults, recordBenchmarkPlan, getBenchmarkHistory };
