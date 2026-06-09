'use strict';

const PERMISSION_LEVELS = { none: 0, read: 1, write: 2, admin: 3 };

function resolvePermission(pluginPermissions, connectorId) {
  const raw = pluginPermissions[connectorId];
  if (!raw) return { level: 'none', score: 0, allowed: false };
  const level = PERMISSION_LEVELS[raw] !== undefined ? raw : 'none';
  return { level, score: PERMISSION_LEVELS[level] || 0, allowed: PERMISSION_LEVELS[level] >= PERMISSION_LEVELS.read };
}

function canAccessResource(pluginPermissions, connectorId, requiredLevel = 'read') {
  const resolved = resolvePermission(pluginPermissions, connectorId);
  return PERMISSION_LEVELS[resolved.level] >= PERMISSION_LEVELS[requiredLevel];
}

function buildPermissionManifest(manifestPermissions = []) {
  const result = {};
  for (const entry of manifestPermissions) {
    if (typeof entry === 'string') result[entry] = 'read';
    else if (entry.resource && entry.access) result[entry.resource] = entry.access;
  }
  return result;
}

function validatePermissionRequest(pluginId, connectorId, requestedLevel, grantedPermissions) {
  const manifestPerms = grantedPermissions[pluginId] || {};
  const granted = resolvePermission(manifestPerms, connectorId);
  if (PERMISSION_LEVELS[requestedLevel] <= granted.score) return { ok: true, granted: granted.level };
  return { ok: false, reason: `Plugin "${pluginId}" lacks "${requestedLevel}" access to "${connectorId}" (has "${granted.level}")` };
}

module.exports = { resolvePermission, canAccessResource, buildPermissionManifest, validatePermissionRequest, PERMISSION_LEVELS };
