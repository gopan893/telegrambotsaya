'use strict';

const store = require('./device-store');

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown', 'unreachable'];

function createHealthEntry(deviceId) {
  return {
    deviceId,
    status: 'unknown',
    lastCheckAt: null,
    lastSeenAt: null,
    errorCount: 0,
    consecutiveFailures: 0,
    errors: [],
    metrics: { latencyMs: 0, uptime: 0, batteryLevel: null, storageUsed: null },
    history: []
  };
}

function recordHealthCheck(deviceId, status, message) {
  let entry = store.getHealthRecord(deviceId);
  if (!entry) {
    entry = createHealthEntry(deviceId);
  }
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
  store.setHealthRecord(deviceId, entry);
  return entry;
}

function recordError(deviceId, error) {
  const entry = store.getHealthRecord(deviceId) || createHealthEntry(deviceId);
  entry.errorCount++;
  entry.consecutiveFailures++;
  entry.errors.push({ error: String(error), at: new Date().toISOString() });
  if (entry.errors.length > 50) entry.errors = entry.errors.slice(-50);
  if (entry.consecutiveFailures >= 5) entry.status = 'unhealthy';
  else if (entry.status === 'healthy') entry.status = 'degraded';
  store.setHealthRecord(deviceId, entry);
  return entry;
}

function checkDeviceHealth(deviceId) {
  const entry = store.getHealthRecord(deviceId);
  if (!entry) return { status: 'unknown', healthy: false };
  const staleThresholdMs = 300000;
  const isStale = entry.lastSeenAt && (Date.now() - new Date(entry.lastSeenAt).getTime() > staleThresholdMs);
  if (isStale && entry.status === 'healthy') {
    entry.status = 'degraded';
    store.setHealthRecord(deviceId, entry);
  }
  return {
    deviceId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    stale: isStale,
    lastCheckAt: entry.lastCheckAt,
    consecutiveFailures: entry.consecutiveFailures,
    errorCount: entry.errorCount
  };
}

function detectStaleDevices(staleThresholdMs) {
  const threshold = staleThresholdMs || 300000;
  const devices = store.listDevices();
  const stale = [];
  for (const dev of devices) {
    const entry = store.getHealthRecord(dev.id);
    if (!entry || !entry.lastSeenAt) {
      stale.push({ deviceId: dev.id, reason: 'no_health_data' });
      continue;
    }
    const age = Date.now() - new Date(entry.lastSeenAt).getTime();
    if (age > threshold) {
      stale.push({ deviceId: dev.id, reason: 'stale', lastSeenAt: entry.lastSeenAt, ageMs: age });
    }
  }
  return stale;
}

function detectUnreachableDevices() {
  const devices = store.listDevices();
  return devices.filter(dev => {
    const entry = store.getHealthRecord(dev.id);
    return !entry || entry.status === 'unreachable' || entry.consecutiveFailures >= 5;
  }).map(dev => ({ deviceId: dev.id, name: dev.name, type: dev.type }));
}

function getHealthSummary(deviceId) {
  const entry = store.getHealthRecord(deviceId);
  if (!entry) return { deviceId, status: 'unknown', healthy: false };
  return {
    deviceId: entry.deviceId,
    status: entry.status,
    healthy: entry.status === 'healthy',
    errorCount: entry.errorCount,
    consecutiveFailures: entry.consecutiveFailures,
    lastCheckAt: entry.lastCheckAt,
    lastSeenAt: entry.lastSeenAt,
    metrics: entry.metrics
  };
}

function aggregateHealthStats() {
  const entries = Array.from(store.listDevices().map(d => store.getHealthRecord(d.id)).filter(Boolean));
  const stats = {};
  for (const s of HEALTH_STATES) stats[s] = 0;
  for (const e of entries) stats[e.status] = (stats[e.status] || 0) + 1;
  stats.total = entries.length;
  stats.healthyPercentage = stats.total > 0 ? Math.round(((stats.healthy || 0) / stats.total) * 100) : 0;
  return stats;
}

module.exports = {
  createHealthEntry, recordHealthCheck, recordError,
  checkDeviceHealth, detectStaleDevices, detectUnreachableDevices,
  getHealthSummary, aggregateHealthStats, HEALTH_STATES
};
