'use strict';

const serializers = require('./dashboard-serializers');

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function statusLabel(status = '') {
  const clean = String(status || 'unavailable');
  const labels = {
    connected: 'connected',
    missing_env: 'missing env',
    pg_missing: 'pg missing',
    ioredis_missing: 'ioredis missing',
    connection_failed: 'connection failed',
    migration_required: 'migration required',
    timeout: 'timeout',
    tls_issue: 'TLS issue',
    unavailable: 'unavailable',
    disabled: 'disabled'
  };
  return labels[clean] || clean;
}

function formatLatency(latencyMs) {
  return latencyMs === null || typeof latencyMs === 'undefined' ? '-' : `${latencyMs}ms`;
}

function formatDbStatus(storageStatus = {}) {
  const storage = serializers.sanitizeStorage(storageStatus);
  return [
    'PostgreSQL Status',
    '',
    `Configured: ${yesNo(storage.databaseUrlConfigured)}`,
    `STORAGE_DRIVER: ${storage.configuredStorageDriver || 'auto'}`,
    `Storage driver: ${storage.activeDriver || storage.storageDriver}`,
    `Available: ${yesNo(storage.postgresAvailable)}`,
    `Table ready: ${yesNo(storage.postgresTableReady)}`,
    `Status: ${statusLabel(storage.postgresStatus)}`,
    `Latency: ${formatLatency(storage.postgresLatencyMs)}`,
    `Fallback active: ${yesNo(storage.fallbackActive)}`,
    `Fallback reason: ${storage.fallbackReason || '-'}`,
    '',
    `Recommended fix: ${storage.postgresRecommendedFix || 'No action needed'}`
  ].join('\n');
}

function formatRedisStatus(storageStatus = {}) {
  const storage = serializers.sanitizeStorage(storageStatus);
  return [
    'Redis Status',
    '',
    `Configured: ${yesNo(storage.redisUrlConfigured)}`,
    `Available: ${yesNo(storage.redisAvailable)}`,
    `Status: ${statusLabel(storage.redisStatus)}`,
    `Latency: ${formatLatency(storage.redisLatencyMs)}`,
    `Cache fallback: ${storage.cacheFallback?.type || 'memory-cache'}`,
    '',
    `Recommended fix: ${storage.redisRecommendedFix || 'No action needed'}`
  ].join('\n');
}

function formatDashboardStorageStatus(storageStatus = {}) {
  const storage = serializers.sanitizeStorage(storageStatus);
  return [
    `Storage driver: ${storage.activeDriver || storage.storageDriver}`,
    `Configured driver: ${storage.configuredStorageDriver}`,
    `Fallback active: ${yesNo(storage.fallbackActive)}`,
    `Fallback reason: ${storage.fallbackReason || '-'}`,
    `PostgreSQL: ${statusLabel(storage.postgresStatus)} (${storage.postgresAvailable ? 'available' : 'not available'})`,
    `Redis: ${statusLabel(storage.redisStatus)} (${storage.redisAvailable ? 'available' : 'not available'})`
  ].join('\n');
}

module.exports = {
  formatDashboardStorageStatus,
  formatDbStatus,
  formatRedisStatus,
  statusLabel
};
