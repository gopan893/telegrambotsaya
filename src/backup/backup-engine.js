'use strict';

const auditLog = require('../dashboard/audit-log');
const workspace = require('../workspace');
const guards = require('./backup-guards');
const store = require('./backup-store');
const utils = require('./backup-utils');

async function audit(action, manifestOrScope = {}, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || services.actorType || 'backup',
      actorId: extra.actorId || manifestOrScope.createdBy || manifestOrScope.actorId || services.actorId || '',
      action,
      targetType: extra.targetType || 'backup',
      targetId: extra.targetId || manifestOrScope.id || '',
      userId: manifestOrScope.userId || '',
      workspaceId: manifestOrScope.workspaceId || '',
      actorRole: extra.actorRole || manifestOrScope.actorRole || '',
      permission: extra.permission || 'read',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      afterSummary: extra.afterSummary || utils.summarizeManifest(manifestOrScope),
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

async function readSafeKey(key, services = {}) {
  try {
    if (services.storageManager?.safeRead) return await services.storageManager.safeRead(key, Array.isArray(key) ? [] : undefined);
  } catch (_) {}
  return undefined;
}

async function collectSafeData(scope = {}, options = {}, services = {}) {
  const keys = Array.isArray(options.includes) && options.includes.length
    ? options.includes.filter(key => utils.SAFE_DATA_KEYS.includes(key))
    : utils.SAFE_DATA_KEYS;
  const excludes = new Set([...(options.excludes || []), ...(options.includeAudit ? [] : ['dashboard_audit_logs'])]);
  const data = {};
  for (const key of keys) {
    if (excludes.has(key)) continue;
    const fallback = ['workspaces', 'planner_sessions', 'planner_tasks', 'executor_proposals', 'executor_runs', 'tool_registry', 'tool_runs', 'tool_audit', 'dashboard_audit_logs'].includes(key) ? [] : {};
    const value = await (services.storageManager?.safeRead ? services.storageManager.safeRead(key, fallback) : readSafeKey(key, services));
    data[key] = utils.filterByScope(utils.sanitize(value ?? fallback), {
      ...scope,
      includeAudit: Boolean(options.includeAudit)
    }, key);
  }
  return data;
}

async function createBackup(scope = {}, options = {}, services = {}) {
  const type = utils.normalizeBackupType(scope.type || options.type || 'workspace');
  const normalizedScope = {
    ...scope,
    type,
    workspaceId: scope.workspaceId || options.workspaceId || '',
    userId: scope.userId || options.userId || '',
    actorId: scope.actorId || options.actorId || services.actorId || scope.createdBy || '',
    createdBy: scope.createdBy || options.createdBy || scope.actorId || options.actorId || services.actorId || ''
  };
  const access = await guards.enforceBackupPermission(normalizedScope, services);
  if (!access.ok) {
    await audit('backup/permission_denied', normalizedScope, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const backupScope = { ...normalizedScope, workspaceId: access.workspaceId, userId: access.userId };
  const data = await collectSafeData(backupScope, options, services);
  const snapshot = {
    backupVersion: utils.BACKUP_VERSION,
    generatedAt: utils.nowIso(),
    scope: {
      type,
      workspaceId: backupScope.workspaceId,
      userId: backupScope.userId
    },
    data: utils.sanitize(data)
  };
  const secret = guards.preventSecretLeakInBackup(snapshot);
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const size = guards.validateBackupSize(secret.value, Number(options.maxBytes || utils.MAX_IMPORT_BYTES));
  if (!size.ok) return { ok: false, reason: size.error, bytes: size.bytes, status: 413 };

  const manifest = utils.summarizeManifest({
    id: options.id || utils.createId('backup'),
    type,
    workspaceId: backupScope.workspaceId,
    userId: backupScope.userId,
    createdBy: backupScope.createdBy || access.actorId,
    status: 'created',
    version: utils.BACKUP_VERSION,
    itemCounts: utils.buildItemCounts(data),
    checksum: utils.checksum(secret.value),
    sanitized: true,
    includes: Object.keys(data),
    excludes: [...new Set([...(options.excludes || []), ...(options.includeAudit ? [] : ['dashboard_audit_logs']), 'env', 'tokens', 'credentials'])],
    createdAt: utils.nowIso(),
    restoredAt: null,
    errorSummary: ''
  });
  const snapshotRecord = {
    id: manifest.id,
    manifestId: manifest.id,
    checksum: manifest.checksum,
    payload: secret.value,
    createdAt: manifest.createdAt
  };
  await store.upsertBackupItem(utils.BACKUP_MANIFESTS_KEY, manifest, services);
  await store.upsertBackupItem(utils.BACKUP_SNAPSHOTS_KEY, snapshotRecord, services);
  await audit('backup/created', manifest, services, { actorId: access.actorId, actorRole: access.actorRole, permission: access.permission });
  return { ok: true, manifest, backup: snapshotRecord };
}

function createWorkspaceBackup(workspaceId, options = {}, services = {}) {
  return createBackup({ type: 'workspace', workspaceId, userId: options.userId || options.actorId || '', actorId: options.actorId, createdBy: options.createdBy }, options, services);
}

function createUserBackup(userId, options = {}, services = {}) {
  return createBackup({ type: 'user', userId, workspaceId: options.workspaceId || workspace.utils.getPersonalWorkspaceId(userId), actorId: options.actorId, createdBy: options.createdBy }, options, services);
}

async function createSystemSafeBackup(options = {}, services = {}) {
  const ownerId = options.userId || options.actorId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '';
  let workspaceId = options.workspaceId || '';
  if (!workspaceId) {
    const adminWorkspace = await workspace.store.ensureAdminWorkspace({ ...services, env: { ...(services.env || {}), OWNER_CHAT_ID: ownerId } });
    workspaceId = adminWorkspace?.id || workspace.utils.getPersonalWorkspaceId(ownerId);
  }
  return createBackup({ type: 'full_safe', userId: ownerId, workspaceId, actorId: options.actorId || ownerId, createdBy: options.createdBy || ownerId }, { ...options, includeAudit: options.includeAudit !== false }, services);
}

async function listBackups(filters = {}, services = {}) {
  const items = await store.listBackupItems(utils.BACKUP_MANIFESTS_KEY, filters, services);
  return items.map(utils.summarizeManifest);
}

async function getBackup(backupId, services = {}) {
  const manifest = await store.getBackupItem(utils.BACKUP_MANIFESTS_KEY, backupId, services);
  if (!manifest) return null;
  const snapshot = await store.getBackupItem(utils.BACKUP_SNAPSHOTS_KEY, backupId, services);
  return { manifest: utils.summarizeManifest(manifest), snapshot: snapshot ? utils.sanitize(snapshot) : null };
}

async function validateBackup(backupId, services = {}) {
  const record = await getBackup(backupId, services);
  if (!record?.manifest || !record?.snapshot) return { ok: false, reason: 'BACKUP_NOT_FOUND', status: 404 };
  const calculated = utils.checksum(record.snapshot.payload);
  const ok = calculated === record.manifest.checksum && !utils.containsSecretLike(record.snapshot.payload);
  const status = ok ? 'validated' : 'failed';
  const manifest = await store.updateBackupItem(utils.BACKUP_MANIFESTS_KEY, backupId, {
    status,
    errorSummary: ok ? '' : 'Checksum mismatch or secret-like payload detected'
  }, services);
  await audit('backup/validated', manifest || record.manifest, services, { status: ok ? 'ok' : 'failed', reason: ok ? '' : 'validation failed' });
  return { ok, manifest: utils.summarizeManifest(manifest || record.manifest), checksum: calculated };
}

async function archiveBackup(backupId, services = {}) {
  const manifest = await store.updateBackupItem(utils.BACKUP_MANIFESTS_KEY, backupId, { status: 'archived' }, services);
  if (!manifest) return { ok: false, reason: 'BACKUP_NOT_FOUND', status: 404 };
  await audit('backup/archived', manifest, services, { permission: 'write' });
  return { ok: true, manifest: utils.summarizeManifest(manifest) };
}

module.exports = {
  createBackup,
  createSystemSafeBackup,
  createUserBackup,
  createWorkspaceBackup,
  getBackup,
  listBackups,
  validateBackup,
  archiveBackup
};
