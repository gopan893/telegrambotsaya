'use strict';

const { isTruthy } = require('./dashboard-utils');

function getEnv(reqOrEnv) {
  if (reqOrEnv?.app?.locals?.dashboardEnv) return reqOrEnv.app.locals.dashboardEnv;
  return reqOrEnv && !reqOrEnv.headers ? reqOrEnv : process.env;
}

function isDashboardEnabled(env = process.env) {
  return isTruthy(env.DASHBOARD_ENABLED);
}

function getDashboardStatus(env = process.env) {
  return {
    enabled: isDashboardEnabled(env),
    adminTokenSet: Boolean(env.DASHBOARD_ADMIN_TOKEN),
    protectedEndpoints: isDashboardEnabled(env) && Boolean(env.DASHBOARD_ADMIN_TOKEN) ? 'active' : 'disabled'
  };
}

function extractBearerToken(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  return String(req.query?.token || '').trim();
}

function requireDashboardAuth(req, res, next) {
  const env = getEnv(req);
  const status = getDashboardStatus(env);
  if (!status.enabled) {
    return res.status(401).json({ ok: false, error: 'DASHBOARD_DISABLED' });
  }
  if (!status.adminTokenSet) {
    return res.status(401).json({ ok: false, error: 'DASHBOARD_TOKEN_NOT_CONFIGURED' });
  }

  const token = extractBearerToken(req);
  if (!token || token !== env.DASHBOARD_ADMIN_TOKEN) {
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
  requireDashboardAuth
};
