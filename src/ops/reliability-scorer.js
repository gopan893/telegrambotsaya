'use strict';

const healthMonitor = require('./health-monitor');
const telemetryCollector = require('./telemetry-collector');
const benchmarkEngine = require('./benchmark-engine');
const regressionDetector = require('./regression-detector');
const resourceAnalyzer = require('./resource-analyzer');
const guards = require('./ops-guards');

function boundedScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0;
}

function scoreToolSuccess(toolUsage = {}) {
  const entries = Object.values(toolUsage || {});
  if (!entries.length) return 86;
  const total = entries.reduce((sum, item) => sum + Number(item.calls || 0), 0);
  const success = entries.reduce((sum, item) => sum + Number(item.success || 0), 0);
  return total ? (success / total) * 100 : 86;
}

function calculateReliabilityScore(services = {}, input = {}) {
  const health = input.health || healthMonitor.getHealth(services);
  const telemetry = input.telemetry || telemetryCollector.getTelemetrySummary(services);
  const token = telemetry.token || {};
  const resources = resourceAnalyzer.analyzeResources(services, input.userId || '0');
  const benchmarks = benchmarkEngine.getBenchmarkHistory(services, 5);
  const latestBenchmark = benchmarks[benchmarks.length - 1];
  const regression = input.regression || regressionDetector.detectRegression(services);
  const factors = {};

  factors.uptime = process.uptime() > 60 * 10 ? 95 : process.uptime() > 60 ? 88 : 72;
  factors.recoverySuccess = telemetry.recentErrorCount === 0 ? 92 : telemetry.recentErrorCount < 5 ? 75 : 48;
  factors.reasoningConsistency = latestBenchmark ? (latestBenchmark.score || 0) * 100 : 78;
  factors.responseQuality = latestBenchmark ? (latestBenchmark.score || 0) * 100 : 78;
  factors.safety = (health.issues || []).some(item => /UNSAFE|CRITICAL/.test(item)) ? 50 : 92;
  factors.latency = telemetry.latency.p90 < 3000 ? 90 : telemetry.latency.p90 < 9000 ? 68 : 42;
  factors.costEfficiency = (token.averageTokens || 0) < 1200 ? 88 : (token.averageTokens || 0) < 2200 ? 68 : 45;
  factors.memoryEfficiency = resources.memory.telemetrySizeBytes < 120000 && resources.memory.staleItemCount === 0 ? 90 : 62;
  factors.toolSuccess = scoreToolSuccess(telemetry.toolUsage);
  factors.userSatisfactionProxy = telemetry.recentErrorCount === 0 && telemetry.latency.p90 < 5000 ? 82 : 60;
  factors.regressionRisk = regression.regressionDetected ? (regression.severity === 'high' ? 35 : 58) : 90;
  factors.stabilityTrend = benchmarks.length >= 2
    ? Math.max(35, Math.min(95, 75 + ((latestBenchmark?.score || 0) - average(benchmarks.slice(0, -1).map(item => item.score || 0))) * 100))
    : (health.status === 'healthy' ? 86 : 62);

  const weights = {
    uptime: 0.08,
    recoverySuccess: 0.08,
    reasoningConsistency: 0.1,
    responseQuality: 0.1,
    safety: 0.12,
    latency: 0.1,
    costEfficiency: 0.08,
    memoryEfficiency: 0.08,
    toolSuccess: 0.08,
    userSatisfactionProxy: 0.06,
    regressionRisk: 0.08,
    stabilityTrend: 0.04
  };
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0);
  const risk = 100 - score;
  const sorted = Object.entries(factors).sort((a, b) => b[1] - a[1]);
  const weakest = [...sorted].sort((a, b) => a[1] - b[1]);
  const topRisks = weakest
    .filter(([, value]) => value < 70)
    .slice(0, 4)
    .map(([name, value]) => `${name} rendah (${Math.round(value)}/100)`);
  const recommendedFixes = topRisks.length
    ? topRisks.map(item => `Perbaiki ${item.split(' ')[0]} sebelum menambah fitur baru.`)
    : ['Pertahankan baseline, jalankan benchmark setelah deploy besar.'];
  const trend = regression.regressionDetected
    ? 'menurun'
    : (benchmarks.length >= 2 && (latestBenchmark?.score || 0) >= (benchmarks[benchmarks.length - 2]?.score || 0) ? 'stabil/naik' : 'belum cukup data');

  return {
    score: boundedScore(score),
    overallScore: boundedScore(score),
    risk: boundedScore(risk),
    status: score >= 82 ? 'strong' : score >= 65 ? 'watch' : 'weak',
    factors,
    strongestArea: sorted[0] ? { name: sorted[0][0], score: boundedScore(sorted[0][1]) } : null,
    weakestArea: weakest[0] ? { name: weakest[0][0], score: boundedScore(weakest[0][1]) } : null,
    topRisks,
    recommendedFixes,
    trend,
    explanation: [
      `Uptime ${boundedScore(factors.uptime)}/100`,
      `Recovery ${boundedScore(factors.recoverySuccess)}/100`,
      `Reasoning ${boundedScore(factors.reasoningConsistency)}/100`,
      `Response ${boundedScore(factors.responseQuality)}/100`,
      `Safety ${boundedScore(factors.safety)}/100`,
      `Latency ${boundedScore(factors.latency)}/100`,
      `Cost ${boundedScore(factors.costEfficiency)}/100`,
      `Memory ${boundedScore(factors.memoryEfficiency)}/100`,
      `Tool ${boundedScore(factors.toolSuccess)}/100`,
      `User proxy ${boundedScore(factors.userSatisfactionProxy)}/100`,
      `Regression ${boundedScore(factors.regressionRisk)}/100`,
      `Trend ${boundedScore(factors.stabilityTrend)}/100`
    ],
    generatedAt: guards.nowIso()
  };
}

module.exports = {
  calculateReliabilityScore
};
