'use strict';

const observability = require('../agents/observability');

function resolveRole(userId, botServices = {}) {
  const env = botServices.env || {};
  const id = String(userId);
  const adminSet = env.ADMIN_SET || new Set();

  if (String(env.OWNER_CHAT_ID || '') === id) return 'owner';
  if (adminSet.size === 0) return 'admin';
  if (adminSet.has(id)) return 'admin';
  return 'user';
}

function hasPermission(role, policy = {}) {
  if (!policy.requiresAdmin) return true;
  return role === 'owner' || role === 'admin';
}

function validatePermission(traceId, userId, policy, botServices = {}) {
  const role = resolveRole(userId, botServices);
  const allowed = hasPermission(role, policy);

  observability.logEvent(traceId, 'PermissionEngine', 'PERMISSION_VALIDATED', {
    userId: String(userId),
    role,
    capability: policy.capability,
    allowed
  });

  return {
    role,
    allowed,
    reason: allowed ? null : 'ROLE_NOT_ALLOWED'
  };
}

module.exports = {
  resolveRole,
  hasPermission,
  validatePermission
};
