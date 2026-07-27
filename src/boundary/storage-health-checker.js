'use strict';

const utils = require('./storage-boundary-utils');

function _sanitizeError(err) {
  if (!err) return 'unknown error';
  const msg = typeof err === 'string' ? err : (err.message || String(err));
  return msg.replace(/(password|secret|token|key|DATABASE_URL|REDIS_URL)[=:]\s*\S+/gi, '$1=[REDACTED]');
}

function _hasEnv(name, services) {
  const env = services && services.env ? services.env : process.env;
  return !!env[name];
}

function _getEnv(name, services) {
  const env = services && services.env ? services.env : process.env;
  return env[name] || '';
}

function checkPostgresHealth(services) {
  const hasUrl = _hasEnv('DATABASE_URL', services);
  const isProd = _getEnv('NODE_ENV', services) === 'production';
  if (!hasUrl && isProd) {
    return { adapter: 'postgres', healthy: false, status: 'blocked', warning: 'DATABASE_URL missing in production' };
  }
  if (!hasUrl) {
    return { adapter: 'postgres', healthy: false, status: 'unavailable', warning: 'DATABASE_URL not configured' };
  }
  try {
    const url = _getEnv('DATABASE_URL', services);
    return { adapter: 'postgres', healthy: true, status: 'available', urlConfigured: !!url };
  } catch (err) {
    return { adapter: 'postgres', healthy: false, status: 'error', error: _sanitizeError(err) };
  }
}

function checkRedisHealth(services) {
  const hasUrl = _hasEnv('REDIS_URL', services);
  if (!hasUrl) {
    return { adapter: 'redis', healthy: false, status: 'unavailable', warning: 'REDIS_URL not configured' };
  }
  try {
    const url = _getEnv('REDIS_URL', services);
    return { adapter: 'redis', healthy: true, status: 'available', urlConfigured: !!url };
  } catch (err) {
    return { adapter: 'redis', healthy: false, status: 'error', error: _sanitizeError(err) };
  }
}

function checkJsonFallbackHealth(services) {
  const dir = _getEnv('JSON_FALLBACK_DIR', services);
  const healthy = !dir || dir.length > 0;
  return { adapter: 'json-fallback', healthy, status: healthy ? 'available' : 'unconfigured' };
}

function checkMemoryFallbackHealth(services) {
  return { adapter: 'memory-fallback', healthy: true, status: 'available' };
}

function checkBackupMetadataHealth(services) {
  const results = [
    checkPostgresHealth(services),
    checkRedisHealth(services),
    checkJsonFallbackHealth(services),
    checkMemoryFallbackHealth(services)
  ];
  const healthy = results.filter(r => r.healthy).length;
  return { total: results.length, healthy, degraded: results.length - healthy, checks: results };
}

function checkAllStorageHealth(services) {
  const adapters = [
    { name: 'postgres', fn: checkPostgresHealth },
    { name: 'redis', fn: checkRedisHealth },
    { name: 'json-fallback', fn: checkJsonFallbackHealth },
    { name: 'memory-fallback', fn: checkMemoryFallbackHealth }
  ];
  const results = adapters.map(a => {
    try { return a.fn(services); }
    catch (err) { return { adapter: a.name, healthy: false, status: 'error', error: _sanitizeError(err) }; }
  });
  return results;
}

function buildStorageHealthReport(results, services) {
  if (!results) results = checkAllStorageHealth(services);
  const total = results.length;
  const healthy = results.filter(r => r.healthy).length;
  const blocked = results.filter(r => r.status === 'blocked').length;
  return { total, healthy, degraded: total - healthy, blocked, results };
}

module.exports = {
  checkAllStorageHealth,
  checkPostgresHealth,
  checkRedisHealth,
  checkJsonFallbackHealth,
  checkMemoryFallbackHealth,
  checkBackupMetadataHealth,
  buildStorageHealthReport
};
