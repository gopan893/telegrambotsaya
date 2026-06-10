'use strict';

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown'];
const DRIFT_TYPES = ['config_drift', 'permission_drift', 'dependency_drift', 'version_drift', 'behavior_drift'];

function createHealthEntry(pluginId, status) {
  const state = HEALTH_STATES.includes(status) ? status : 'unknown';
  return {
    pluginId,
    status: state,
    errorCount: 0,
    warningCount: 0,
    lastCheckAt: new Date().toISOString(),
    lastErrorAt: null,
    lastWarningAt: null,
    errors: [],
    warnings: [],
    drifts: [],
    metrics: { uptime: 0, invocations: 0, avgResponseMs: 0, memoryUsageMB: 0 },
    history: [{ status: state, at: new Date().toISOString() }]
  };
}

function recordHealthCheck(entry, status, message) {
  if (!entry) return;
  const validStatus = HEALTH_STATES.includes(status) ? status : 'unknown';
  entry.status = validStatus;
  entry.lastCheckAt = new Date().toISOString();
  entry.history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (entry.history.length > 100) entry.history = entry.history.slice(-100);
}

function recordError(entry, error) {
  if (!entry) return;
  entry.errorCount++;
  entry.lastErrorAt = new Date().toISOString();
  entry.errors.push({ error: String(error), at: new Date().toISOString() });
  if (entry.errors.length > 50) entry.errors = entry.errors.slice(-50);
  if (entry.status !== 'unhealthy') {
    entry.status = entry.errorCount >= 5 ? 'unhealthy' : 'degraded';
    entry.history.push({ status: entry.status, at: new Date().toISOString() });
  }
}

function recordWarning(entry, warning) {
  if (!entry) return;
  entry.warningCount++;
  entry.lastWarningAt = new Date().toISOString();
  entry.warnings.push({ warning: String(warning), at: new Date().toISOString() });
  if (entry.warnings.length > 50) entry.warnings = entry.warnings.slice(-50);
  if (entry.status === 'healthy') {
    entry.status = 'degraded';
    entry.history.push({ status: entry.status, at: new Date().toISOString() });
  }
}

function detectDrift(entry, driftType, details) {
  if (!entry) return;
  if (!DRIFT_TYPES.includes(driftType)) return;
  entry.drifts.push({ type: driftType, details: details || '', detectedAt: new Date().toISOString() });
  if (entry.drifts.length > 20) entry.drifts = entry.drifts.slice(-20);
  if (entry.status === 'healthy') {
    entry.status = 'degraded';
    entry.history.push({ status: entry.status, at: new Date().toISOString() });
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

function hasDrift(entry) {
  return entry && entry.drifts && entry.drifts.length > 0;
}

function getHealthSummary(entry) {
  if (!entry) return { status: 'unknown', healthy: false };
  return {
    pluginId: entry.pluginId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    errorCount: entry.errorCount,
    warningCount: entry.warningCount,
    driftCount: entry.drifts.length,
    lastCheckAt: entry.lastCheckAt,
    lastErrorAt: entry.lastErrorAt,
    metrics: entry.metrics
  };
}

function aggregateHealthStats(entries) {
  if (!Array.isArray(entries)) return {};
  const stats = {};
  for (const s of HEALTH_STATES) {
    stats[s] = entries.filter(e => e.status === s).length;
  }
  stats.total = entries.length;
  stats.totalErrors = entries.reduce((sum, e) => sum + (e.errorCount || 0), 0);
  stats.totalWarnings = entries.reduce((sum, e) => sum + (e.warningCount || 0), 0);
  stats.totalDrifts = entries.reduce((sum, e) => sum + (e.drifts ? e.drifts.length : 0), 0);
  return stats;
}

module.exports = {
  createHealthEntry, recordHealthCheck, recordError, recordWarning,
  detectDrift, updateMetrics, isHealthy, isUnhealthy, hasDrift,
  getHealthSummary, aggregateHealthStats,
  HEALTH_STATES, DRIFT_TYPES
};
