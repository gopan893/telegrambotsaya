'use strict';

const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');
const utils = require('./backup-utils');

function validateBackupScope(scope = {}) {
  const type = utils.normalizeBackupType(scope.type || scope.scope || 'workspace');
  const workspaceId = String(scope.workspaceId || '').trim();
  const userId = String(scope.userId || '').trim();
  if (type === 'workspace' && !workspaceId) return { ok: false, error: 'WORKSPACE_ID_REQUIRED' };
  if (type === 'user' && !userId) return { ok: false, error: 'USER_ID_REQUIRED' };
  return { ok: true, value: { ...scope, type, workspaceId, userId } };
}

function validateExportScope(scope = {}) {
  return validateBackupScope(scope);
}

async function permissionSummary(actorId, workspaceId, services = {}) {
  try {
    return await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
  } catch (_) {
    return { role: 'none', canRead: false, canWrite: false, canDanger: false };
  }
}

async function enforceBackupPermission(scope = {}, services = {}) {
  const valid = validateBackupScope(scope);
  if (!valid.ok) return valid;
  const actorId = String(scope.actorId || scope.createdBy || scope.userId || services.actorId || '').trim();
  const userId = String(valid.value.userId || actorId || '').trim();
  const workspaceId = valid.value.workspaceId || workspace.utils.getPersonalWorkspaceId(userId || actorId);
  const summary = await permissionSummary(actorId, workspaceId, services);
  const permission = valid.value.type === 'user' ? 'read' : 'write';
  const allowed = permission === 'read'
    ? await workspace.permissions.canAccessUserData(actorId, userId || actorId, workspaceId, 'read', services)
    : await workspace.permissions.hasWorkspacePermission(actorId, workspaceId, 'write', services);
  if (!allowed) {
    return { ok: false, error: 'BACKUP_PERMISSION_DENIED', status: 403, actorId, userId, workspaceId, actorRole: summary.role, permission };
  }
  return { ok: true, ...valid.value, actorId, userId, workspaceId, actorRole: summary.role, permission };
}

async function enforceRestorePermission(scope = {}, services = {}) {
  const actorId = String(scope.actorId || services.actorId || scope.userId || '').trim();
  const userId = String(scope.userId || actorId || '').trim();
  const workspaceId = String(scope.workspaceId || workspace.utils.getPersonalWorkspaceId(userId || actorId)).trim();
  const summary = await permissionSummary(actorId, workspaceId, services);
  if (!['owner', 'admin'].includes(summary.role)) {
    return { ok: false, error: 'RESTORE_REQUIRES_OWNER_OR_ADMIN', status: 403, actorId, userId, workspaceId, actorRole: summary.role, permission: 'danger' };
  }
  return { ok: true, actorId, userId, workspaceId, actorRole: summary.role, permission: 'danger' };
}

function preventSecretLeakInBackup(payload = {}) {
  if (utils.containsSecretLike(payload)) return { ok: false, error: 'SECRET_LIKE_BACKUP_PAYLOAD_REJECTED' };
  return { ok: true, value: utils.sanitize(payload) };
}

function sanitizeBackupData(payload = {}) {
  return utils.sanitize(payload);
}

function validateBackupSize(payload = {}, maxBytes = utils.MAX_IMPORT_BYTES) {
  const bytes = utils.estimateBytes(payload);
  if (bytes > maxBytes) return { ok: false, error: 'BACKUP_PAYLOAD_TOO_LARGE', bytes, maxBytes };
  return { ok: true, bytes };
}

function requireRestoreConfirmation(value = '') {
  return String(value || '').trim() === 'RESTORE'
    ? { ok: true }
    : { ok: false, error: 'RESTORE_CONFIRMATION_REQUIRED', expected: 'RESTORE' };
}

function sanitizeRestoreSummary(value = {}) {
  return dashboardGuards.preventSecretLeak(value);
}

module.exports = {
  enforceBackupPermission,
  enforceRestorePermission,
  preventSecretLeakInBackup,
  requireRestoreConfirmation,
  sanitizeBackupData,
  sanitizeRestoreSummary,
  validateBackupScope,
  validateBackupSize,
  validateExportScope
};
