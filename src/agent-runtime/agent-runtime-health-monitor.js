'use strict';

const store = require('./agent-runtime-store');
const utils = require('./agent-runtime-utils');

function checkRuntimeHealth(profiles = [], loadSnapshots = [], services = {}) {
  const recent = profiles.slice(-20);
  const latestLoad = loadSnapshots[loadSnapshots.length - 1] || {};
  const avgLatency = recent.length ? recent.reduce((s, p) => s + (p.latencyMs || 0), 0) / recent.length : 0;
  const errorRate = recent.length ? recent.filter(p => !p.success).length / recent.length : 0;
  const highLatency = avgLatency > (services.latencyThresholdMs || 30000);
  const highErrorRate = errorRate > (services.errorRateThreshold || 0.3);
  const overloaded = latestLoad.loadPercent > 80;
  const status = highLatency || highErrorRate || overloaded ? 'degraded' : 'healthy';
  return {
    id: utils.createId('health'),
    status,
    avgLatency: Math.round(avgLatency),
    errorRate: +errorRate.toFixed(2),
    highLatency,
    highErrorRate,
    overloaded,
    loadPercent: latestLoad.loadPercent || 0,
    checkedAt: new Date().toISOString()
  };
}

function detectLoop(profiles = [], windowSize = 10, services = {}) {
  const recent = profiles.slice(-windowSize);
  if (recent.length < 3) return { loopDetected: false, reason: 'insufficient_data' };
  const sameAgent = recent.every(p => p.agentId === recent[0].agentId);
  const sameTaskType = recent.every(p => p.taskType === recent[0].taskType);
  const avgLatency = recent.reduce((s, p) => s + (p.latencyMs || 0), 0) / recent.length;
  const similarLatency = recent.every(p => Math.abs((p.latencyMs || 0) - avgLatency) < avgLatency * 0.3);
  const allFailed = recent.every(p => !p.success);
  if (sameAgent && sameTaskType && allFailed) {
    return { loopDetected: true, reason: 'repeated_failure_loop', agentId: recent[0].agentId, taskType: recent[0].taskType };
  }
  if (sameAgent && sameTaskType && similarLatency && recent.length >= windowSize) {
    return { loopDetected: true, reason: 'stuck_loop', agentId: recent[0].agentId };
  }
  return { loopDetected: false };
}

function detectStalledTasks(tasks = [], services = {}) {
  const now = Date.now();
  const stallThresholdMs = services.stallThresholdMs || 5 * 60 * 1000;
  return tasks.filter(t => {
    if (t.status !== 'running') return false;
    const started = new Date(t.startedAt || t.createdAt || 0).getTime();
    return now - started > stallThresholdMs;
  }).map(t => ({ taskId: t.id, agentId: t.assignedAgentId, stalledSince: t.startedAt, stallMs: Date.now() - new Date(t.startedAt || 0).getTime() }));
}

function buildHealthCheckResult(profiles = [], loadSnapshots = [], tasks = [], services = {}) {
  const health = checkRuntimeHealth(profiles, loadSnapshots, services);
  const loop = detectLoop(profiles, 10, services);
  const stalled = detectStalledTasks(tasks, services);
  const degraded = health.status === 'degraded' || loop.loopDetected || stalled.length > 0;
  return {
    id: utils.createId('hc'),
    ...health,
    loop,
    stalledTasks: stalled,
    overallStatus: degraded ? 'degraded' : 'healthy',
    checkedAt: new Date().toISOString()
  };
}

async function recordHealthCheck(result, services = {}) {
  return store.addRecord('healthChecks', result, services);
}

module.exports = { checkRuntimeHealth, detectLoop, detectStalledTasks, buildHealthCheckResult, recordHealthCheck };
