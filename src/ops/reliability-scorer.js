'use strict';

const healthMonitor = require('./health-monitor');
const telemetryCollector = require('./telemetry-collector');
const guards = require('./ops-guards');

function boundedScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateReliabilityScore(services = {}, input = {}) {
  const health = input.health || healthMonitor.getHealth(services);
  const telemetry = input.telemetry || telemetryCollector.getTelemetrySummary(services);
  const token = telemetry.token || {};
  const factors = {};

  factors.uptime = process.uptime() > 60 ? 92 : 75;
  factors.memory = health.memory.rssMb < 300 ? 95 : health.memory.rssMb < 420 ? 75 : 45;
  factors.errors = telemetry.recentErrorCount === 0 ? 96 : telemetry.recentErrorCount < 5 ? 78 : 48;
  factors.queue = health.queue.pending === 0 ? 95 : health.queue.pending < Math.max(2, health.queue.maxQueueSize * 0.5) ? 75 : 45;
  factors.provider = Object.values(health.providers || {}).some(item => item.available) ? 90 : 35;
  factors.latency = telemetry.latency.p90 < 3000 ? 90 : telemetry.latency.p90 < 9000 ? 68 : 42;
  factors.costEfficiency = (token.averageTokens || 0) < 1200 ? 88 : (token.averageTokens || 0) < 2200 ? 68 : 45;
  factors.safety = (health.issues || []).some(item => /UNSAFE|CRITICAL/.test(item)) ? 50 : 90;

  const weights = {
    uptime: 0.1,
    memory: 0.16,
    errors: 0.18,
    queue: 0.12,
    provider: 0.16,
    latency: 0.1,
    costEfficiency: 0.08,
    safety: 0.1
  };
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0);
  const risk = 100 - score;

  return {
    score: boundedScore(score),
    risk: boundedScore(risk),
    status: score >= 82 ? 'strong' : score >= 65 ? 'watch' : 'weak',
    factors,
    explanation: [
      `Memory ${factors.memory}/100`,
      `Errors ${factors.errors}/100`,
      `Provider ${factors.provider}/100`,
      `Latency ${factors.latency}/100`,
      `Cost ${factors.costEfficiency}/100`
    ],
    generatedAt: guards.nowIso()
  };
}

module.exports = {
  calculateReliabilityScore
};
