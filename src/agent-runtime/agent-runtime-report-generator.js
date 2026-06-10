'use strict';

const store = require('./agent-runtime-store');
const profiler = require('./agent-runtime-profiler');
const healthMonitor = require('./agent-runtime-health-monitor');
const regressionDetector = require('./agent-runtime-regression-detector');
const loadController = require('./agent-load-controller');
const qualityScorer = require('./agent-response-quality-scorer');
const utils = require('./agent-runtime-utils');

async function generateRuntimeReport(services = {}) {
  const rtStore = await store.loadRuntimeStore(services);
  const profiles = rtStore.profiles || [];
  const loadSnapshots = rtStore.loadSnapshots || [];
  const healthChecks = rtStore.healthChecks || [];
  const regressions = rtStore.regressions || [];

  const profileSummary = profiler.summarizeProfiles(profiles.slice(-100));
  const health = healthMonitor.buildHealthCheckResult(profiles, loadSnapshots, [], services);
  const recentRegressions = regressions.filter(r => r.hasRegression).slice(-10);
  const qualities = profiles.filter(p => p.qualityScore != null).map(p => ({ overall: p.qualityScore }));
  const qualitySummary = qualityScorer.aggregateQualityScores(qualities);

  const agents = {};
  for (const p of profiles.slice(-200)) {
    const a = p.agentId || 'unknown';
    if (!agents[a]) agents[a] = { count: 0, totalLatency: 0, totalCost: 0, errors: 0 };
    agents[a].count++;
    agents[a].totalLatency += p.latencyMs || 0;
    agents[a].totalCost += p.costEstimate || 0;
    if (!p.success) agents[a].errors++;
  }
  const agentSummaries = Object.entries(agents).map(([id, a]) => ({
    agentId: id,
    taskCount: a.count,
    avgLatency: Math.round(a.totalLatency / a.count),
    totalCost: +a.totalCost.toFixed(6),
    errorRate: +(a.errors / a.count).toFixed(2)
  }));

  return {
    id: utils.createId('rpt'),
    generatedAt: new Date().toISOString(),
    profileSummary,
    health,
    qualitySummary,
    recentRegressions,
    agentSummaries,
    totalProfiles: profiles.length,
    totalHealthChecks: healthChecks.length
  };
}

function formatReportSummary(report = {}) {
  const parts = [
    `Runtime Report (${report.generatedAt || 'unknown'})`,
    `Status: ${report.health?.overallStatus || 'unknown'}`,
    `Profiles: ${report.totalProfiles || 0}`,
    `Avg Latency: ${report.profileSummary?.avgLatency || 0}ms`,
    `Avg Cost: ${report.profileSummary?.avgCost || 0}`,
    `Quality: ${report.qualitySummary?.avgOverall || 0}`,
    `Regressions: ${report.recentRegressions?.length || 0}`
  ];
  if (report.agentSummaries?.length) {
    parts.push('Agent breakdown:');
    for (const a of report.agentSummaries.slice(0, 5)) {
      parts.push(`  ${a.agentId}: ${a.taskCount} tasks, ${a.avgLatency}ms avg, ${a.errorRate} err`);
    }
  }
  return parts.join('\n');
}

async function saveReport(report, services = {}) {
  return store.addRecord('reports', report, services);
}

module.exports = { generateRuntimeReport, formatReportSummary, saveReport };
