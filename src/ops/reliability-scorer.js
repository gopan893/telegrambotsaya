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

function calculateReliabilityScore(health, telemetry, benchmark, services = {}) {
  // Signature 1: calculateReliabilityScore(health, telemetry, benchmark, services) -> required
  // Signature 2: calculateReliabilityScore(services = {}, input = {}) -> backward compatible
  let finalServices = services;
  let finalHealth = health;
  let finalTelemetry = telemetry;
  let finalBenchmark = benchmark;

  if (health && typeof health.ensureUser === 'function') {
    finalServices = health;
    const input = telemetry || {};
    finalHealth = input.health || healthMonitor.getHealth(finalServices);
    finalTelemetry = input.telemetry || telemetryCollector.getTelemetrySummary({}, finalServices);
    finalBenchmark = benchmarkEngine.getBenchmarkHistory({}, finalServices);
  } else {
    // If telemetry and health are provided but services is undefined, resolve services
    if (!finalServices || typeof finalServices.ensureUser !== 'function') {
      finalServices = {};
    }
    if (!finalHealth) finalHealth = healthMonitor.getHealth(finalServices);
    if (!finalTelemetry) finalTelemetry = telemetryCollector.getTelemetrySummary({}, finalServices);
    if (!finalBenchmark) finalBenchmark = benchmarkEngine.getBenchmarkHistory({}, finalServices);
  }

  const token = finalTelemetry.token || {};
  const resources = resourceAnalyzer.analyzeResources(finalServices, '0');
  const benchmarks = Array.isArray(finalBenchmark) ? finalBenchmark : [finalBenchmark].filter(Boolean);
  const latestBenchmark = benchmarks[benchmarks.length - 1];
  const regression = regressionDetector.detectRegression(finalServices);
  const factors = {};

  factors.uptime = process.uptime() > 60 * 10 ? 95 : process.uptime() > 60 ? 88 : 72;
  factors.recoverySuccess = finalTelemetry.recentErrorCount === 0 ? 92 : finalTelemetry.recentErrorCount < 5 ? 75 : 48;
  factors.reasoningConsistency = latestBenchmark ? (latestBenchmark.score || 0) * 100 : 78;
  factors.responseQuality = latestBenchmark ? (latestBenchmark.score || 0) * 100 : 78;
  factors.safety = (finalHealth.issues || []).some(item => /UNSAFE|CRITICAL/.test(item)) ? 50 : 92;
  factors.latency = finalTelemetry.latency.p90 < 3000 ? 90 : finalTelemetry.latency.p90 < 9000 ? 68 : 42;
  factors.costEfficiency = (token.averageTokens || 0) < 1200 ? 88 : (token.averageTokens || 0) < 2200 ? 68 : 45;
  factors.memoryEfficiency = resources.memory.telemetrySizeBytes < 120000 && resources.memory.staleItemCount === 0 ? 90 : 62;
  factors.toolSuccess = scoreToolSuccess(finalTelemetry.toolUsage);
  factors.userSatisfactionProxy = finalTelemetry.recentErrorCount === 0 && finalTelemetry.latency.p90 < 5000 ? 82 : 60;
  factors.regressionRisk = regression.regressionDetected ? (regression.severity === 'high' ? 35 : 58) : 90;
  factors.stabilityTrend = benchmarks.length >= 2
    ? Math.max(35, Math.min(95, 75 + ((latestBenchmark?.score || 0) - average(benchmarks.slice(0, -1).map(item => item.score || 0))) * 100))
    : (finalHealth.status === 'healthy' ? 86 : 62);

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

// Section G Required score helper functions:
function calculateLatencyScore(telemetry = {}) {
  const p90 = telemetry.latency?.p90 || 0;
  if (!p90) return 90;
  if (p90 < 2000) return 95;
  if (p90 < 5000) return 85;
  if (p90 < 9000) return 70;
  return 45;
}

function calculateErrorScore(telemetry = {}) {
  const errors = telemetry.recentErrorCount || 0;
  if (errors === 0) return 100;
  if (errors < 3) return 88;
  if (errors < 7) return 65;
  return 30;
}

function calculateToolSuccessScore(telemetry = {}) {
  return scoreToolSuccess(telemetry.toolUsage || {});
}

function calculateStorageScore(health = {}) {
  if (health.storage?.postgresAvailable) return 98;
  if (health.storage?.driver === 'JSON') return 78;
  return 50;
}

function calculateMemoryEfficiencyScore(services = {}) {
  const resources = resourceAnalyzer.analyzeResources(services, '0');
  const size = resources.memory?.telemetrySizeBytes || 0;
  const stale = resources.memory?.staleItemCount || 0;
  if (size < 80000 && stale === 0) return 95;
  if (size < 200000 && stale < 3) return 80;
  return 55;
}

function getReliabilitySummary(services = {}) {
  return calculateReliabilityScore(services);
}

module.exports = {
  calculateReliabilityScore,
  calculateLatencyScore,
  calculateErrorScore,
  calculateToolSuccessScore,
  calculateStorageScore,
  calculateMemoryEfficiencyScore,
  getReliabilitySummary
};
