'use strict';

const { isTruthy } = require('./dashboard-utils');

function getEnv(reqOrEnv) {
  if (reqOrEnv?.app?.locals?.dashboardEnv) return reqOrEnv.app.locals.dashboardEnv;
  return reqOrEnv && !reqOrEnv.headers ? reqOrEnv : process.env;
}

function getDashboardToken(env = process.env) {
  return env.dashboard?.adminToken || env.DASHBOARD_ADMIN_TOKEN || '';
}

function isDashboardEnabled(env = process.env) {
  if (typeof env.dashboard?.enabled === 'boolean') return env.dashboard.enabled;
  return isTruthy(env.DASHBOARD_ENABLED);
}

function isDashboardTokenConfigured(env = process.env) {
  return Boolean(getDashboardToken(env));
}

function getDashboardStatus(env = process.env) {
  const enabled = isDashboardEnabled(env);
  const tokenConfigured = isDashboardTokenConfigured(env);
  return {
    enabled,
    tokenConfigured,
    adminTokenSet: tokenConfigured,
    protectedEndpoints: enabled && tokenConfigured ? 'active' : 'disabled'
  };
}

function extractBearerToken(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  return '';
}

function requireDashboardAuth(req, res, next) {
  const env = getEnv(req);
  const status = getDashboardStatus(env);
  if (!status.enabled) {
    return res.status(403).json({ ok: false, error: 'DASHBOARD_DISABLED' });
  }
  if (!status.tokenConfigured) {
    return res.status(401).json({ ok: false, error: 'DASHBOARD_TOKEN_NOT_CONFIGURED' });
  }

  const token = extractBearerToken(req);
  if (!token || token !== getDashboardToken(env)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
  return next();
}

function createDashboardAuth(env = process.env) {
  return function dashboardAuth(req, res, next) {
    req.app.locals.dashboardEnv = env;
    return requireDashboardAuth(req, res, next);
  };
}

module.exports = {
  createDashboardAuth,
  getDashboardStatus,
  isDashboardEnabled,
  isDashboardTokenConfigured,
  requireDashboardAuth
};
