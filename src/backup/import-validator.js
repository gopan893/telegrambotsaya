'use strict';

const store = require('./backup-store');
const utils = require('./backup-utils');

function detectImportType(payload = {}) {
  if (payload.exportType === 'backup' || payload.snapshot?.backupVersion || payload.manifest?.version) return 'backup';
  if (payload.backupVersion && payload.data) return 'snapshot';
  if (payload.exportType === 'user_summary') return 'user_summary';
  if (Array.isArray(payload.items) && payload.exportType === 'audit') return 'audit';
  return 'unknown';
}

function validateSchemaVersion(payload = {}) {
  const version = payload.snapshot?.backupVersion || payload.backupVersion || payload.manifest?.version || '';
  if (!version) return { ok: false, error: 'BACKUP_VERSION_MISSING' };
  return { ok: true, version };
}

function validateNoSecretLeak(payload = {}) {
  return utils.containsSecretLike(payload)
    ? { ok: false, error: 'SECRET_LIKE_IMPORT_PAYLOAD_REJECTED' }
    : { ok: true };
}

async function validateWorkspaceCompatibility(payload = {}, services = {}) {
  const snapshot = payload.snapshot || payload;
  const workspaceId = payload.manifest?.workspaceId || snapshot.scope?.workspaceId || '';
  if (!workspaceId) return { ok: true, workspaceId: '' };
  try {
    const workspace = require('../workspace');
    const existing = await workspace.store.getWorkspace(workspaceId, services);
    return { ok: true, workspaceId, exists: Boolean(existing) };
  } catch (_) {
    return { ok: true, workspaceId, exists: false };
  }
}

async function calculateImportDiff(payload = {}, services = {}) {
  const snapshot = payload.snapshot || payload;
  const data = snapshot.data || payload.snapshot?.data || {};
  const diff = {};
  for (const [key, incoming] of Object.entries(data || {})) {
    const fallback = Array.isArray(incoming) ? [] : {};
    const existing = services.storageManager?.safeRead
      ? await services.storageManager.safeRead(key, fallback)
      : fallback;
    const incomingCount = utils.countItems(incoming);
    const existingCount = utils.countItems(existing);
    diff[key] = {
      incoming: incomingCount,
      existing: existingCount,
      mode: 'merge_upsert'
    };
  }
  return diff;
}

async function buildImportPreview(payload = {}, services = {}) {
  const type = detectImportType(payload);
  const version = validateSchemaVersion(payload);
  const secret = validateNoSecretLeak(payload);
  if (!version.ok || !secret.ok) {
    return {
      type,
      validVersion: version.ok,
      ok: false,
      error: version.error || secret.error,
      diff: {}
    };
  }
  const diff = await calculateImportDiff(payload, services);
  return utils.sanitize({
    ok: true,
    type,
    validVersion: true,
    workspace: await validateWorkspaceCompatibility(payload, services),
    diff,
    warnings: [
      'Restore uses merge/upsert.',
      'No hard delete is performed.',
      'Restore requires RESTORE confirmation.'
    ]
  });
}

async function validateImportPayload(payload = {}, services = {}) {
  const size = utils.estimateBytes(payload);
  if (size > utils.MAX_IMPORT_BYTES) return { ok: false, reason: 'IMPORT_PAYLOAD_TOO_LARGE', status: 413, size };
  const type = detectImportType(payload);
  if (!['backup', 'snapshot'].includes(type)) return { ok: false, reason: 'UNSUPPORTED_IMPORT_TYPE', status: 400, type };
  const version = validateSchemaVersion(payload);
  if (!version.ok) return { ok: false, reason: version.error, status: 400 };
  const secret = validateNoSecretLeak(payload);
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const workspace = await validateWorkspaceCompatibility(payload, services);
  const diff = await calculateImportDiff(payload, services);
  const job = {
    id: utils.createId('import'),
    type,
    status: 'validated',
    version: version.version,
    workspaceId: workspace.workspaceId || '',
    checksum: utils.checksum(payload),
    diff,
    createdAt: utils.nowIso()
  };
  await store.appendBackupItem(utils.IMPORT_JOBS_KEY, job, 200, services);
  return { ok: true, type, version: version.version, workspace, diff, job };
}

module.exports = {
  buildImportPreview,
  calculateImportDiff,
  detectImportType,
  validateImportPayload,
  validateNoSecretLeak,
  validateSchemaVersion,
  validateWorkspaceCompatibility
};
