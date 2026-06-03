'use strict';

const store = require('./connector-execution-store');

const RATE_LIMIT_KEY = 'integration_connector_rate_limits';

const DEFAULT_LIMITS = {
  read_only: { limit: 30, windowMs: 60 * 60 * 1000 },
  dry_run: { limit: 20, windowMs: 60 * 60 * 1000 },
  proposal: { limit: 10, windowMs: 60 * 60 * 1000 },
  approved_run: { limit: 10, windowMs: 60 * 60 * 1000 }
};

function modeForAction(action = '', explicitMode = '') {
  if (explicitMode) return explicitMode;
  if (/\.(status|list|info|check|diagnose|validate|preview)$/i.test(action)) return 'read_only';
  return 'proposal';
}

async function resetConnectorRateLimitIfNeeded(bucket = {}, now = Date.now()) {
  if (!bucket.resetAt || now >= Number(bucket.resetAt || 0)) {
    return { count: 0, resetAt: now + Number(bucket.windowMs || DEFAULT_LIMITS.read_only.windowMs) };
  }
  return bucket;
}

async function enforceConnectorRateLimit(connectorId, action, userId, workspaceId, services = {}, options = {}) {
  const mode = modeForAction(action, options.mode);
  const config = { ...DEFAULT_LIMITS[mode] };
  const all = await store.loadIntegrationData(RATE_LIMIT_KEY, {}, services);
  const key = `${workspaceId || 'default'}:${userId || 'anon'}:${connectorId}:${action}:${mode}`;
  const current = await resetConnectorRateLimitIfNeeded({ ...(all[key] || {}), windowMs: config.windowMs });
  if (Number(current.count || 0) >= config.limit) {
    all[key] = current;
    await store.saveIntegrationData(RATE_LIMIT_KEY, all, services);
    return {
      allowed: false,
      reason: 'CONNECTOR_RATE_LIMIT_HIT',
      connectorId,
      action,
      mode,
      limit: config.limit,
      remaining: 0,
      resetAt: new Date(Number(current.resetAt)).toISOString()
    };
  }
  const next = { ...current, count: Number(current.count || 0) + 1, windowMs: config.windowMs };
  all[key] = next;
  await store.saveIntegrationData(RATE_LIMIT_KEY, all, services);
  return {
    allowed: true,
    reason: 'allowed',
    connectorId,
    action,
    mode,
    limit: config.limit,
    remaining: Math.max(0, config.limit - next.count),
    resetAt: new Date(Number(next.resetAt)).toISOString()
  };
}

async function getConnectorRateLimitStatus(connectorId, action, userId, workspaceId, services = {}, options = {}) {
  const mode = modeForAction(action, options.mode);
  const config = DEFAULT_LIMITS[mode] || DEFAULT_LIMITS.read_only;
  const all = await store.loadIntegrationData(RATE_LIMIT_KEY, {}, services);
  const key = `${workspaceId || 'default'}:${userId || 'anon'}:${connectorId}:${action}:${mode}`;
  const current = await resetConnectorRateLimitIfNeeded({ ...(all[key] || {}), windowMs: config.windowMs });
  return {
    connectorId,
    action,
    mode,
    limit: config.limit,
    used: Number(current.count || 0),
    remaining: Math.max(0, config.limit - Number(current.count || 0)),
    resetAt: new Date(Number(current.resetAt || Date.now() + config.windowMs)).toISOString()
  };
}

module.exports = {
  DEFAULT_LIMITS,
  enforceConnectorRateLimit,
  getConnectorRateLimitStatus,
  modeForAction,
  resetConnectorRateLimitIfNeeded
};
