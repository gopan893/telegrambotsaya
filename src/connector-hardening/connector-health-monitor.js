'use strict';

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown', 'disconnected'];

function createConnectorHealthEntry(connectorId, status) {
  const state = HEALTH_STATES.includes(status) ? status : 'unknown';
  return {
    connectorId,
    status: state,
    lastCheckAt: new Date().toISOString(),
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    errorCount: 0,
    warningCount: 0,
    consecutiveFailures: 0,
    errors: [],
    warnings: [],
    metrics: { latencyMs: 0, uptime: 0, requests: 0, failures: 0 },
    history: [{ status: state, at: new Date().toISOString() }]
  };
}

function recordHealthCheck(entry, status, message) {
  if (!entry) return;
  const validStatus = HEALTH_STATES.includes(status) ? status : 'unknown';
  entry.status = validStatus;
  entry.lastCheckAt = new Date().toISOString();
  if (validStatus === 'healthy') entry.consecutiveFailures = 0;
  entry.history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (entry.history.length > 100) entry.history = entry.history.slice(-100);
}

function recordConnection(entry, connected) {
  if (!entry) return;
  if (connected) {
    entry.lastConnectedAt = new Date().toISOString();
    entry.consecutiveFailures = 0;
  } else {
    entry.lastDisconnectedAt = new Date().toISOString();
    entry.consecutiveFailures++;
  }
}

function recordError(entry, error) {
  if (!entry) return;
  entry.errorCount++;
  entry.consecutiveFailures++;
  entry.errors.push({ error: String(error), at: new Date().toISOString() });
  if (entry.errors.length > 50) entry.errors = entry.errors.slice(-50);
  if (entry.consecutiveFailures >= 5) {
    entry.status = 'unhealthy';
    entry.history.push({ status: 'unhealthy', at: new Date().toISOString() });
  } else if (entry.status === 'healthy') {
    entry.status = 'degraded';
    entry.history.push({ status: 'degraded', at: new Date().toISOString() });
  }
}

function recordWarning(entry, warning) {
  if (!entry) return;
  entry.warningCount++;
  entry.warnings.push({ warning: String(warning), at: new Date().toISOString() });
  if (entry.warnings.length > 50) entry.warnings = entry.warnings.slice(-50);
  if (entry.status === 'healthy') {
    entry.status = 'degraded';
    entry.history.push({ status: 'degraded', at: new Date().toISOString() });
  }
}

function updateMetrics(entry, metrics) {
  if (!entry || !metrics) return;
  Object.assign(entry.metrics, metrics);
  entry.updatedAt = new Date().toISOString();
}

function isHealthy(entry) {
  return entry && entry.status === 'healthy';
}

function isUnhealthy(entry) {
  return entry && entry.status === 'unhealthy';
}

function shouldRetry(entry) {
  return entry && entry.consecutiveFailures < 3;
}

function getHealthSummary(entry) {
  if (!entry) return { status: 'unknown' };
  return {
    connectorId: entry.connectorId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    errorCount: entry.errorCount,
    warningCount: entry.warningCount,
    consecutiveFailures: entry.consecutiveFailures,
    lastCheckAt: entry.lastCheckAt,
    metrics: entry.metrics
  };
}

function aggregateConnectorHealthStats(entries) {
  if (!Array.isArray(entries)) return {};
  const stats = {};
  for (const s of HEALTH_STATES) {
    stats[s] = entries.filter(e => e.status === s).length;
  }
  stats.total = entries.length;
  stats.totalErrors = entries.reduce((sum, e) => sum + (e.errorCount || 0), 0);
  stats.healthyPercentage = stats.total > 0 ? Math.round(((stats.healthy || 0) / stats.total) * 100) : 0;
  return stats;
}

module.exports = {
  createConnectorHealthEntry, recordHealthCheck, recordConnection,
  recordError, recordWarning, updateMetrics, isHealthy, isUnhealthy,
  shouldRetry, getHealthSummary, aggregateConnectorHealthStats,
  HEALTH_STATES
};
