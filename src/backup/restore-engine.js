'use strict';

const auditLog = require('../dashboard/audit-log');
const guards = require('./backup-guards');
const backupEngine = require('./backup-engine');
const importValidator = require('./import-validator');
const store = require('./backup-store');
const utils = require('./backup-utils');

function getSnapshotPayload(input = {}) {
  if (input.snapshot?.data) return input.snapshot;
  if (input.backupVersion && input.data) return input;
  if (input.payload?.snapshot?.data) return input.payload.snapshot;
  return null;
}

async function audit(action, plan = {}, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || services.actorType || 'restore',
      actorId: extra.actorId || plan.actorId || services.actorId || '',
      action,
      targetType: extra.targetType || 'restore_plan',
      targetId: extra.targetId || plan.id || '',
      userId: plan.userId || '',
      workspaceId: plan.workspaceId || '',
      actorRole: extra.actorRole || plan.actorRole || '',
      permission: extra.permission || 'danger',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      afterSummary: extra.afterSummary || {
        restorePlanId: plan.id,
        backupId: plan.backupId,
        itemCounts: plan.itemCounts,
        mode: plan.mode
      },
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

function mergeById(existing, incoming, allowOverwrite = false) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  const source = Array.isArray(incoming) ? incoming : [];
  let inserted = 0;
  let updated = 0;
  for (const item of source) {
    const id = item?.id;
    if (!id) {
      base.push(item);
      inserted += 1;
      continue;
    }
    const index = base.findIndex(existingItem => String(existingItem.id) === String(id));
    if (index >= 0) {
      const existingUpdated = new Date(base[index].updatedAt || base[index].updated_at || base[index].createdAt || 0).getTime();
      const incomingUpdated = new Date(item.updatedAt || item.updated_at || item.createdAt || 0).getTime();
      if (allowOverwrite || incomingUpdated >= existingUpdated || !existingUpdated) {
        base[index] = { ...base[index], ...item, restoredAt: utils.nowIso() };
        updated += 1;
      }
    } else {
      base.push({ ...item, restoredAt: utils.nowIso() });
      inserted += 1;
    }
  }
  return { value: base, inserted, updated };
}

function mergeObject(existing = {}, incoming = {}, allowOverwrite = false) {
  const out = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  let inserted = 0;
  let updated = 0;
  for (const [key, value] of Object.entries(incoming || {})) {
    if (Array.isArray(value)) {
      const merged = mergeById(Array.isArray(out[key]) ? out[key] : [], value, allowOverwrite);
      out[key] = merged.value;
      inserted += merged.inserted;
      updated += merged.updated;
    } else if (value && typeof value === 'object') {
      const merged = mergeObject(out[key] || {}, value, allowOverwrite);
      out[key] = merged.value;
      inserted += merged.inserted;
      updated += merged.updated;
    } else if (allowOverwrite || typeof out[key] === 'undefined') {
      if (typeof out[key] === 'undefined') inserted += 1;
      else updated += 1;
      out[key] = value;
    }
  }
  return { value: out, inserted, updated };
}

async function restoreItem(item = {}, services = {}) {
  const key = item.key;
  const incoming = item.value;
  const allowOverwrite = Boolean(item.allowOverwrite);
  const fallback = Array.isArray(incoming) ? [] : {};
  const existing = services.storageManager?.safeRead
    ? await services.storageManager.safeRead(key, fallback)
    : fallback;
  const merged = Array.isArray(incoming)
    ? mergeById(existing, incoming, allowOverwrite)
    : mergeObject(existing, incoming, allowOverwrite);
  if (services.storageManager?.safeWrite) await services.storageManager.safeWrite(key, merged.value);
  return { key, inserted: merged.inserted, updated: merged.updated };
}

async function createRestorePlan(importPayloadOrBackupId, options = {}, services = {}) {
  let payload = null;
  let backupId = '';
  if (typeof importPayloadOrBackupId === 'string') {
    backupId = importPayloadOrBackupId;
    const record = await backupEngine.getBackup(backupId, services);
    if (!record?.snapshot?.payload) return { ok: false, reason: 'BACKUP_NOT_FOUND', status: 404 };
    payload = record.snapshot.payload;
  } else {
    payload = importPayloadOrBackupId;
  }
  const snapshot = getSnapshotPayload(payload);
  if (!snapshot?.data) return { ok: false, reason: 'RESTORE_PAYLOAD_INVALID', status: 400 };
  const validation = await importValidator.validateImportPayload(payload, services);
  if (!validation.ok) return validation;
  const scope = {
    actorId: options.actorId || services.actorId || '',
    userId: options.userId || payload.manifest?.userId || snapshot.scope?.userId || options.actorId || services.actorId || '',
    workspaceId: options.workspaceId || payload.manifest?.workspaceId || snapshot.scope?.workspaceId || ''
  };
  const access = await guards.enforceRestorePermission(scope, services);
  if (!access.ok) {
    await audit('restore/permission_denied', scope, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const plan = {
    id: options.id || utils.createId('restore'),
    backupId,
    status: 'planned',
    mode: options.allowOverwrite ? 'merge_overwrite_confirmed' : 'merge_upsert',
    workspaceId: access.workspaceId,
    userId: access.userId,
    actorId: access.actorId,
    actorRole: access.actorRole,
    requiresConfirmation: true,
    confirmationText: 'RESTORE',
    allowOverwrite: Boolean(options.allowOverwrite),
    itemCounts: utils.buildItemCounts(snapshot.data),
    diff: validation.diff,
    payload: utils.sanitize(snapshot),
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  };
  await store.upsertBackupItem(utils.IMPORT_JOBS_KEY, plan, services);
  await audit('restore/plan_created', plan, services, { actorRole: access.actorRole });
  return { ok: true, plan: utils.sanitize({ ...plan, payload: undefined }) };
}

async function previewRestore(restorePlanId, services = {}) {
  const plan = await store.getBackupItem(utils.IMPORT_JOBS_KEY, restorePlanId, services);
  if (!plan) return { ok: false, reason: 'RESTORE_PLAN_NOT_FOUND', status: 404 };
  return {
    ok: true,
    plan: utils.sanitize({ ...plan, payload: undefined }),
    rollback: rollbackNotSupportedNotice(plan)
  };
}

async function restoreWorkspaceData(plan, services = {}) {
  const data = plan.payload?.data || {};
  const results = [];
  for (const [key, value] of Object.entries(data)) {
    results.push(await restoreItem({ key, value, allowOverwrite: plan.allowOverwrite }, services));
  }
  return results;
}

function restoreUserData(plan, services = {}) {
  return restoreWorkspaceData(plan, services);
}

async function runApprovedRestore(restorePlanId, actor = {}, services = {}) {
  const plan = await store.getBackupItem(utils.IMPORT_JOBS_KEY, restorePlanId, services);
  if (!plan) return { ok: false, reason: 'RESTORE_PLAN_NOT_FOUND', status: 404 };
  const confirm = guards.requireRestoreConfirmation(actor.confirmationText || actor.confirmation || '');
  if (!confirm.ok) return { ok: false, reason: confirm.error, expected: confirm.expected, status: 400 };
  const access = await guards.enforceRestorePermission({
    actorId: actor.actorId || plan.actorId || services.actorId || '',
    userId: plan.userId,
    workspaceId: plan.workspaceId
  }, services);
  if (!access.ok) {
    await audit('restore/permission_denied', plan, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  await store.updateBackupItem(utils.IMPORT_JOBS_KEY, restorePlanId, { status: 'running' }, services);
  await audit('restore/run_started', plan, services, { actorRole: access.actorRole });
  try {
    const results = await restoreWorkspaceData(plan, services);
    const completed = await store.updateBackupItem(utils.IMPORT_JOBS_KEY, restorePlanId, {
      status: 'completed',
      restoredAt: utils.nowIso(),
      results
    }, services);
    await store.appendBackupItem(utils.RESTORE_LOGS_KEY, {
      id: utils.createId('restore_log'),
      restorePlanId,
      workspaceId: plan.workspaceId,
      userId: plan.userId,
      status: 'completed',
      results,
      createdAt: utils.nowIso()
    }, utils.MAX_RESTORE_LOGS, services);
    await audit('restore/completed', completed || plan, services, { actorRole: access.actorRole, afterSummary: { results } });
    return { ok: true, plan: utils.sanitize({ ...(completed || plan), payload: undefined }), results, rollback: rollbackNotSupportedNotice(plan) };
  } catch (err) {
    const failed = await store.updateBackupItem(utils.IMPORT_JOBS_KEY, restorePlanId, {
      status: 'failed',
      errorSummary: utils.compactText(err.message, 300)
    }, services);
    await audit('restore/failed', failed || plan, services, { status: 'failed', reason: err.message });
    return { ok: false, reason: err.message, plan: utils.sanitize({ ...(failed || plan), payload: undefined }) };
  }
}

function rollbackNotSupportedNotice() {
  return 'Rollback otomatis belum didukung. Restore memakai merge/upsert tanpa hard delete.';
}

module.exports = {
  createRestorePlan,
  previewRestore,
  restoreItem,
  restoreUserData,
  restoreWorkspaceData,
  rollbackNotSupportedNotice,
  runApprovedRestore
};
