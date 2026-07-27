'use strict';

const store = require('./model-strategy-store');
const profiler = require('./model-latency-tracker');
const qualityEval = require('./model-quality-evaluator');
const costEst = require('./model-cost-estimator');
const utils = require('./model-strategy-utils');

async function generateStrategyReport(services = {}) {
  const sStore = await store.loadStrategyStore(services);
  const routingDecisions = sStore.routingDecisions || [];
  const latencyRecords = sStore.latencyRecords || [];
  const qualityEvals = sStore.qualityEvaluations || [];
  const benchmarks = sStore.benchmarks || [];

  const latencyByModel = {};
  for (const r of latencyRecords) {
    if (!latencyByModel[r.model]) latencyByModel[r.model] = [];
    latencyByModel[r.model].push(r.latencyMs);
  }
  const latencySummaries = Object.entries(latencyByModel).map(([model, lats]) => ({
    model,
    count: lats.length,
    avgMs: Math.round(lats.reduce((s, v) => s + v, 0) / lats.length)
  }));

  const qualityByModel = {};
  for (const q of qualityEvals) {
    if (!qualityByModel[q.model]) qualityByModel[q.model] = { total: 0, count: 0 };
    qualityByModel[q.model].total += q.overall || 0;
    qualityByModel[q.model].count++;
  }
  const qualitySummaries = Object.entries(qualityByModel).map(([model, data]) => ({
    model,
    count: data.count,
    avgQuality: +(data.total / data.count).toFixed(2)
  }));

  const strategyCounts = {};
  for (const d of routingDecisions) {
    const s = d.strategy || 'unknown';
    strategyCounts[s] = (strategyCounts[s] || 0) + 1;
  }

  const blockedCount = routingDecisions.filter(d => d.blocked).length;

  return {
    id: utils.createId('srpt'),
    generatedAt: new Date().toISOString(),
    totalDecisions: routingDecisions.length,
    blockedDecisions: blockedCount,
    strategyCounts,
    latencySummaries,
    qualitySummaries,
    benchmarkCount: benchmarks.length
  };
}

function formatStrategyReport(report = {}) {
  const parts = [
    `Model Strategy Report (${report.generatedAt || 'unknown'})`,
    `Total Decisions: ${report.totalDecisions || 0}`,
    `Blocked: ${report.blockedDecisions || 0}`,
    `Strategy Distribution: ${JSON.stringify(report.strategyCounts || {})}`,
    `Benchmarks: ${report.benchmarkCount || 0}`
  ];
  if (report.latencySummaries?.length) {
    parts.push('Latency:');
    for (const l of report.latencySummaries.slice(0, 5)) parts.push(`  ${l.model}: ${l.avgMs}ms (${l.count} samples)`);
  }
  if (report.qualitySummaries?.length) {
    parts.push('Quality:');
    for (const q of report.qualitySummaries.slice(0, 5)) parts.push(`  ${q.model}: ${q.avgQuality} (${q.count} samples)`);
  }
  return parts.join('\n');
}

module.exports = { generateStrategyReport, formatStrategyReport };
