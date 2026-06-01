'use strict';

const auditLog = require('../dashboard/audit-log');
const backupEngine = require('./backup-engine');
const guards = require('./backup-guards');
const utils = require('./backup-utils');

function buildExportFileName(scope = 'backup', id = '') {
  const cleanScope = String(scope || 'backup').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const cleanId = String(id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${cleanScope}_${cleanId}_${new Date().toISOString().slice(0, 10)}.json`;
}

function sanitizeExportPayload(payload = {}) {
  return utils.sanitize(payload);
}

async function recordExportAudit(action, payload = {}, services = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: services.actorType || 'backup',
      actorId: services.actorId || payload.createdBy || payload.userId || '',
      action,
      targetType: 'backup_export',
      targetId: payload.id || payload.manifest?.id || '',
      userId: payload.userId || payload.manifest?.userId || '',
      workspaceId: payload.workspaceId || payload.manifest?.workspaceId || '',
      permission: 'read',
      decision: 'allowed',
      status: 'ok',
      afterSummary: {
        fileName: payload.fileName,
        checksum: payload.manifest?.checksum,
        type: payload.manifest?.type
      }
    }, services);
  } catch (_) {}
}

async function exportBackupJson(backupId, services = {}) {
  const record = await backupEngine.getBackup(backupId, services);
  if (!record?.manifest || !record?.snapshot) return { ok: false, reason: 'BACKUP_NOT_FOUND', status: 404 };
  const payload = sanitizeExportPayload({
    exportType: 'backup',
    exportedAt: utils.nowIso(),
    manifest: record.manifest,
    snapshot: record.snapshot.payload
  });
  const secret = guards.preventSecretLeakInBackup(payload);
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const fileName = buildExportFileName(record.manifest.type, backupId);
  await recordExportAudit('backup/exported', { ...record.manifest, fileName }, services);
  return { ok: true, fileName, payload: secret.value };
}

async function exportWorkspaceJson(workspaceId, options = {}, services = {}) {
  const created = await backupEngine.createWorkspaceBackup(workspaceId, options, services);
  if (!created.ok) return created;
  return exportBackupJson(created.manifest.id, services);
}

async function exportUserSummaryJson(userId, options = {}, services = {}) {
  const created = await backupEngine.createUserBackup(userId, { ...options, includeAudit: false }, services);
  if (!created.ok) return created;
  const summary = {
    exportType: 'user_summary',
    exportedAt: utils.nowIso(),
    manifest: created.manifest,
    itemCounts: created.manifest.itemCounts
  };
  return {
    ok: true,
    fileName: buildExportFileName('user_summary', userId),
    payload: sanitizeExportPayload(summary)
  };
}

async function exportAuditJson(filters = {}, services = {}) {
  const items = await auditLog.listAuditLogs({ ...filters, limit: filters.limit || 100 }, services);
  const payload = sanitizeExportPayload({
    exportType: 'audit',
    exportedAt: utils.nowIso(),
    filters: utils.sanitize(filters),
    items
  });
  return { ok: true, fileName: buildExportFileName('audit', filters.workspaceId || 'recent'), payload };
}

module.exports = {
  buildExportFileName,
  exportAuditJson,
  exportBackupJson,
  exportUserSummaryJson,
  exportWorkspaceJson,
  sanitizeExportPayload
};
