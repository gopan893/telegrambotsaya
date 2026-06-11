'use strict';

const { isTruthy } = require('./dashboard-utils');

function checkIpAllowed(req, env = process.env) {
  const allowedIps = env.DASHBOARD_ALLOWED_IPS
    ? (Array.isArray(env.DASHBOARD_ALLOWED_IPS) ? env.DASHBOARD_ALLOWED_IPS : String(env.DASHBOARD_ALLOWED_IPS).split(',').map(s => s.trim()).filter(Boolean))
    : [];
  
  if (allowedIps.length === 0) return { allowed: true };
  
  const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  
  if (allowedIps.includes(clientIp)) return { allowed: true };
  
  const timestamp = new Date().toISOString();
  console.warn(`[security] Dashboard access denied from IP: ${clientIp} at ${timestamp}`);
  
  return { allowed: false, ip: clientIp };
}

function getEnv(reqOrEnv) {
  if (reqOrEnv?.app?.locals?.dashboardEnv) return reqOrEnv.app.locals.dashboardEnv;
  return reqOrEnv && !reqOrEnv.headers ? reqOrEnv : process.env;
}

function getDashboardToken(env = process.env) {
  return env.dashboard?.adminToken || env.DASHBOARD_ADMIN_TOKEN || '';
}

function getDashboardTokens(env = process.env) {
  return [
    getDashboardToken(env),
    env.dashboard?.writeToken || env.DASHBOARD_WRITE_TOKEN || '',
    env.dashboard?.dangerToken || env.DASHBOARD_DANGER_TOKEN || ''
  ].filter(Boolean);
}

function isDashboardEnabled(env = process.env) {
  if (typeof env.dashboard?.enabled === 'boolean') return env.dashboard.enabled;
  return isTruthy(env.DASHBOARD_ENABLED);
}

function isDashboardTokenConfigured(env = process.env) {
  return getDashboardTokens(env).length > 0;
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

  const ipCheck = checkIpAllowed(req, env);
  if (!ipCheck.allowed) {
    return res.status(403).json({ ok: false, error: 'IP_NOT_ALLOWED', message: 'Akses dashboard tidak diizinkan dari IP ini.' });
  }

  const token = extractBearerToken(req);
  if (!token || !getDashboardTokens(env).includes(token)) {
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
  checkIpAllowed,
  createDashboardAuth,
  getDashboardToken,
  getDashboardTokens,
  getDashboardStatus,
  isDashboardEnabled,
  isDashboardTokenConfigured,
  requireDashboardAuth
};
