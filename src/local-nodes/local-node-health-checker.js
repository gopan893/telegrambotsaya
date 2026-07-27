'use strict';

const store = require('./local-node-store');

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown', 'unreachable'];

function createHealthEntry(nodeId) {
  return {
    nodeId,
    status: 'unknown',
    lastCheckAt: null,
    lastSeenAt: null,
    errorCount: 0,
    consecutiveFailures: 0,
    errors: [],
    metrics: { latencyMs: 0, uptime: 0 },
    history: []
  };
}

function recordHealthCheck(nodeId, status, message) {
  let entry = store.getHealthRecord(nodeId);
  if (!entry) entry = createHealthEntry(nodeId);
  const validStatus = HEALTH_STATES.includes(status) ? status : 'unknown';
  entry.status = validStatus;
  entry.lastCheckAt = new Date().toISOString();
  if (validStatus === 'healthy') {
    entry.consecutiveFailures = 0;
    entry.lastSeenAt = new Date().toISOString();
  } else if (validStatus === 'unhealthy' || validStatus === 'unreachable') {
    entry.consecutiveFailures++;
  }
  entry.history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (entry.history.length > 100) entry.history = entry.history.slice(-100);
  store.setHealthRecord(nodeId, entry);
  return entry;
}

function recordError(nodeId, error) {
  const entry = store.getHealthRecord(nodeId) || createHealthEntry(nodeId);
  entry.errorCount++;
  entry.consecutiveFailures++;
  entry.errors.push({ error: String(error), at: new Date().toISOString() });
  if (entry.errors.length > 50) entry.errors = entry.errors.slice(-50);
  if (entry.consecutiveFailures >= 5) entry.status = 'unhealthy';
  else if (entry.status === 'healthy') entry.status = 'degraded';
  store.setHealthRecord(nodeId, entry);
  return entry;
}

function checkNodeHealth(nodeId) {
  const node = store.getNode(nodeId);
  if (!node) return { ok: false, error: 'Node not found', status: 'unknown' };
  const entry = store.getHealthRecord(nodeId);
  if (!entry) return { ok: true, nodeId, status: 'unknown', healthy: false };
  return {
    ok: true,
    nodeId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    lastCheckAt: entry.lastCheckAt,
    consecutiveFailures: entry.consecutiveFailures,
    errorCount: entry.errorCount
  };
}

function detectUnhealthyNodes() {
  const nodes = store.listNodes();
  return nodes.filter(n => {
    const entry = store.getHealthRecord(n.id);
    return !entry || entry.status === 'unreachable' || entry.consecutiveFailures >= 5;
  }).map(n => ({ nodeId: n.id, name: n.name, type: n.type }));
}

function getHealthSummary(nodeId) {
  const entry = store.getHealthRecord(nodeId);
  if (!entry) return { nodeId, status: 'unknown', healthy: false };
  return {
    nodeId: entry.nodeId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    errorCount: entry.errorCount,
    consecutiveFailures: entry.consecutiveFailures,
    lastCheckAt: entry.lastCheckAt,
    lastSeenAt: entry.lastSeenAt,
    metrics: entry.metrics
  };
}

function aggregateNodeHealth() {
  const nodes = store.listNodes();
  const stats = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0, unreachable: 0, total: nodes.length };
  for (const node of nodes) {
    const entry = store.getHealthRecord(node.id);
    const status = entry ? entry.status : 'unknown';
    stats[status] = (stats[status] || 0) + 1;
  }
  return stats;
}

module.exports = {
  createHealthEntry, recordHealthCheck, recordError,
  checkNodeHealth, detectUnhealthyNodes, getHealthSummary,
  aggregateNodeHealth, HEALTH_STATES
};
