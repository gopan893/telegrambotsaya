'use strict';

const auth = require('./dashboard-auth');

const LEVELS = {
  none: 0,
  read: 1,
  write: 2,
  danger: 3,
  ops: 4
};

const ACTION_PERMISSIONS = {
  'memory/update': 'write',
  'memory/archive': 'danger',
  'memory/restore': 'danger',
  'goal/update': 'write',
  'goal/archive': 'danger',
  'goal/restore': 'danger',
  'workflow/step/add': 'write',
  'workflow/step/done': 'write',
  'workflow/step/reorder': 'write',
  'workflow/archive': 'danger',
  'workflow/restore': 'danger',
  'diagnostics/run': 'ops',
  'benchmark/run-light': 'ops',
  'telemetry/prune': 'danger',
  'ops/refresh': 'ops',
  'report/export-health': 'read',
  'report/export-user-summary': 'read'
};

function envFromReq(req) {
  return req?.app?.locals?.dashboardEnv || process.env;
}

function bearer(req) {
  const header = String(req?.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getDashboardPermissionLevel(req) {
  const env = envFromReq(req);
  const token = bearer(req);
  if (!token) return 'none';
  if (token === auth.getDashboardToken?.(env) || token === (env.DASHBOARD_ADMIN_TOKEN || env.dashboard?.adminToken)) return 'ops';
  if (env.DASHBOARD_DANGER_TOKEN && token === env.DASHBOARD_DANGER_TOKEN) return 'danger';
  if (env.DASHBOARD_WRITE_TOKEN && token === env.DASHBOARD_WRITE_TOKEN) return 'write';
  return 'none';
}

function canPerformAction(permission, action) {
  const required = getActionPermission(action);
  return (LEVELS[permission] || 0) >= (LEVELS[required] || 0);
}

function getActionPermission(action) {
  return ACTION_PERMISSIONS[action] || ACTION_PERMISSIONS[String(action || '').replace(/^actions\//, '')] || 'read';
}

function requireDashboardPermission(permission) {
  return function dashboardPermission(req, res, next) {
    const level = getDashboardPermissionLevel(req);
    if ((LEVELS[level] || 0) < (LEVELS[permission] || 0)) {
      return res.status(403).json({ ok: false, error: 'INSUFFICIENT_PERMISSION', required: permission });
    }
    req.dashboardPermission = level;
    return next();
  };
}

function requireActionPermission(action) {
  return function dashboardActionPermission(req, res, next) {
    const level = getDashboardPermissionLevel(req);
    if (!canPerformAction(level, action)) {
      return res.status(403).json({
        ok: false,
        error: 'INSUFFICIENT_PERMISSION',
        action,
        required: getActionPermission(action)
      });
    }
    req.dashboardPermission = level;
    return next();
  };
}

module.exports = {
  ACTION_PERMISSIONS,
  canPerformAction,
  getActionPermission,
  getDashboardPermissionLevel,
  requireActionPermission,
  requireDashboardPermission
};
