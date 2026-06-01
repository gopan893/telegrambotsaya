'use strict';

const auditLog = require('../dashboard/audit-log');
const workspace = require('../workspace');
const backupEngine = require('./backup-engine');
const guards = require('./backup-guards');
const store = require('./backup-store');
const utils = require('./backup-utils');

const BACKUP_SCHEDULES_KEY = 'backup_schedules';
const BACKUP_SCHEDULE_RUNS_KEY = 'backup_schedule_runs';
const MAX_SCHEDULES = 200;
const MAX_SCHEDULE_RUNS = 500;

const VALID_SCOPES = ['workspace', 'user', 'system_safe'];
const VALID_FREQUENCIES = ['manual', 'daily', 'weekly', 'monthly'];
const RUN_STATUSES = ['pending_approval', 'approved', 'running', 'completed', 'failed', 'cancelled'];

function normalizeScope(scope = 'workspace') {
  const clean = String(scope || 'workspace').toLowerCase();
  return VALID_SCOPES.includes(clean) ? clean : 'workspace';
}

function normalizeFrequency(frequency = 'manual') {
  const clean = String(frequency || 'manual').toLowerCase();
  return VALID_FREQUENCIES.includes(clean) ? clean : 'manual';
}

function normalizeRunStatus(status = 'pending_approval') {
  const clean = String(status || 'pending_approval').toLowerCase();
  return RUN_STATUSES.includes(clean) ? clean : 'pending_approval';
}

function normalizeSchedule(input = {}) {
  const now = utils.nowIso();
  const scope = normalizeScope(input.scope);
  const frequency = normalizeFrequency(input.frequency);
  const userId = String(input.userId || input.user_id || input.createdBy || input.created_by || '').trim();
  const workspaceId = String(input.workspaceId || input.workspace_id || (userId ? workspace.utils.getPersonalWorkspaceId(userId) : '')).trim();
  const schedule = {
    id: String(input.id || utils.createId('backup_schedule')).trim(),
    workspaceId,
    userId,
    name: utils.compactText(input.name || 'Backup schedule', 140),
    scope,
    frequency,
    enabled: input.enabled !== false,
    requiresApproval: true,
    nextRunAt: input.nextRunAt || input.next_run_at || calculateNextRunAt({ frequency }, input.createdAt || now),
    lastRunAt: input.lastRunAt || input.last_run_at || null,
    lastStatus: input.lastStatus || input.last_status || null,
    createdBy: String(input.createdBy || input.created_by || userId || '').trim(),
    approvedBy: String(input.approvedBy || input.approved_by || '').trim(),
    approvedAt: input.approvedAt || input.approved_at || null,
    createdAt: input.createdAt || input.created_at || now,
    updatedAt: input.updatedAt || input.updated_at || now,
    archivedAt: input.archivedAt || input.archived_at || null
  };
  return utils.sanitize(schedule);
}

function normalizeScheduleRun(input = {}) {
  const now = utils.nowIso();
  return utils.sanitize({
    id: String(input.id || utils.createId('backup_schedule_run')).trim(),
    scheduleId: String(input.scheduleId || input.schedule_id || '').trim(),
    workspaceId: String(input.workspaceId || input.workspace_id || '').trim(),
    userId: String(input.userId || input.user_id || '').trim(),
    scope: normalizeScope(input.scope || 'workspace'),
    status: normalizeRunStatus(input.status || 'pending_approval'),
    requiresApproval: true,
    requestedBy: String(input.requestedBy || input.requested_by || '').trim(),
    approvedBy: String(input.approvedBy || input.approved_by || '').trim(),
    approvedAt: input.approvedAt || input.approved_at || null,
    backupId: String(input.backupId || input.backup_id || '').trim(),
    errorSummary: utils.compactText(input.errorSummary || input.error_summary || '', 300),
    createdAt: input.createdAt || input.created_at || now,
    updatedAt: input.updatedAt || input.updated_at || now,
    completedAt: input.completedAt || input.completed_at || null
  });
}

function mapScopeToBackupType(scope) {
  return normalizeScope(scope) === 'system_safe' ? 'full_safe' : normalizeScope(scope);
}

function isDue(schedule = {}, now = new Date()) {
  if (!schedule.enabled || schedule.archivedAt || !schedule.nextRunAt || schedule.frequency === 'manual') return false;
  const target = new Date(schedule.nextRunAt).getTime();
  return Number.isFinite(target) && target <= now.getTime();
}

function calculateNextRunAt(schedule = {}, now = new Date()) {
  const frequency = normalizeFrequency(schedule.frequency);
  if (frequency === 'manual') return null;
  const base = now instanceof Date ? new Date(now.getTime()) : new Date(now || Date.now());
  if (frequency === 'daily') base.setUTCDate(base.getUTCDate() + 1);
  if (frequency === 'weekly') base.setUTCDate(base.getUTCDate() + 7);
  if (frequency === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString();
}

async function audit(action, item = {}, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || services.actorType || 'backup_scheduler',
      actorId: extra.actorId || item.actorId || item.requestedBy || item.createdBy || services.actorId || '',
      action,
      targetType: extra.targetType || (item.scheduleId ? 'backup_schedule_run' : 'backup_schedule'),
      targetId: extra.targetId || item.id || '',
      userId: item.userId || '',
      workspaceId: item.workspaceId || '',
      actorRole: extra.actorRole || item.actorRole || '',
      permission: extra.permission || 'write',
      decision: extra.decision || 'allowed',
      status: extra.status || 'ok',
      afterSummary: extra.afterSummary || {
        scheduleId: item.scheduleId || item.id,
        runId: item.scheduleId ? item.id : '',
        scope: item.scope,
        frequency: item.frequency,
        status: item.status || item.lastStatus
      },
      reason: extra.reason || ''
    }, services);
  } catch (_) {}
}

async function getActorRole(actorId, workspaceId, services = {}) {
  try {
    const summary = await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
    return summary.role || 'none';
  } catch (_) {
    return 'none';
  }
}

async function enforceScheduleWrite(scope = {}, services = {}) {
  const actorId = String(scope.actorId || services.actorId || scope.userId || '').trim();
  const userId = String(scope.userId || actorId || '').trim();
  const workspaceId = String(scope.workspaceId || workspace.utils.getPersonalWorkspaceId(userId || actorId)).trim();
  const backupScope = {
    ...scope,
    actorId,
    userId,
    workspaceId,
    type: mapScopeToBackupType(scope.scope || scope.type || 'workspace')
  };
  const access = await guards.enforceBackupPermission(backupScope, services);
  if (!access.ok) return access;
  return { ...access, actorId, userId, workspaceId };
}

async function enforceScheduleAdmin(scope = {}, services = {}) {
  const actorId = String(scope.actorId || services.actorId || scope.userId || '').trim();
  const userId = String(scope.userId || actorId || '').trim();
  const workspaceId = String(scope.workspaceId || workspace.utils.getPersonalWorkspaceId(userId || actorId)).trim();
  const role = await getActorRole(actorId, workspaceId, services);
  if (!['owner', 'admin'].includes(role)) {
    return { ok: false, error: 'BACKUP_SCHEDULE_REQUIRES_OWNER_OR_ADMIN', status: 403, actorId, userId, workspaceId, actorRole: role };
  }
  return { ok: true, actorId, userId, workspaceId, actorRole: role };
}

async function createBackupSchedule(input = {}, services = {}) {
  const secret = guards.preventSecretLeakInBackup(input);
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const schedule = normalizeSchedule({
    ...secret.value,
    userId: secret.value.userId || services.actorId || '',
    createdBy: secret.value.createdBy || services.actorId || secret.value.userId || ''
  });
  const access = await enforceScheduleWrite({
    actorId: schedule.createdBy,
    userId: schedule.userId,
    workspaceId: schedule.workspaceId,
    scope: schedule.scope
  }, services);
  if (!access.ok) {
    await audit('backup_schedule/permission_denied', schedule, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const saved = await store.upsertBackupItem(BACKUP_SCHEDULES_KEY, {
    ...schedule,
    workspaceId: access.workspaceId,
    userId: access.userId,
    createdBy: access.actorId,
    actorRole: access.actorRole
  }, services);
  await audit('backup_schedule/created', saved, services, { actorRole: access.actorRole });
  return { ok: true, schedule: normalizeSchedule(saved) };
}

async function listBackupSchedules(filters = {}, services = {}) {
  const items = await store.listBackupItems(BACKUP_SCHEDULES_KEY, {
    ...filters,
    includeArchived: filters.includeArchived === true
  }, services);
  return items.map(normalizeSchedule).map(item => ({ ...item, due: isDue(item) }));
}

async function requestDueScheduleApprovals(filters = {}, services = {}) {
  const schedules = await listBackupSchedules(filters, services);
  const created = [];
  for (const schedule of schedules.filter(item => item.due)) {
    const existing = await listScheduleRuns({
      scheduleId: schedule.id,
      status: 'pending_approval',
      limit: 1
    }, services);
    if (existing.length) continue;
    const result = await requestScheduleRunApproval(schedule.id, services);
    if (result.ok) created.push(result.run);
  }
  return { ok: true, created };
}

async function getBackupSchedule(scheduleId, services = {}) {
  const item = await store.getBackupItem(BACKUP_SCHEDULES_KEY, scheduleId, services);
  return item ? { ...normalizeSchedule(item), due: isDue(item) } : null;
}

async function updateBackupSchedule(scheduleId, patch = {}, services = {}) {
  const existing = await getBackupSchedule(scheduleId, services);
  if (!existing) return { ok: false, reason: 'BACKUP_SCHEDULE_NOT_FOUND', status: 404 };
  const access = await enforceScheduleWrite({
    actorId: patch.actorId || services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    scope: existing.scope
  }, services);
  if (!access.ok) {
    await audit('backup_schedule/permission_denied', existing, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const cleanPatch = utils.sanitize({
    name: patch.name,
    scope: patch.scope ? normalizeScope(patch.scope) : undefined,
    frequency: patch.frequency ? normalizeFrequency(patch.frequency) : undefined,
    enabled: typeof patch.enabled === 'undefined' ? undefined : Boolean(patch.enabled)
  });
  Object.keys(cleanPatch).forEach(key => typeof cleanPatch[key] === 'undefined' && delete cleanPatch[key]);
  if (cleanPatch.frequency && cleanPatch.frequency !== existing.frequency) {
    cleanPatch.nextRunAt = calculateNextRunAt({ frequency: cleanPatch.frequency });
  }
  const updated = await store.updateBackupItem(BACKUP_SCHEDULES_KEY, scheduleId, {
    ...cleanPatch,
    updatedAt: utils.nowIso()
  }, services);
  await audit('backup_schedule/updated', updated || existing, services, { actorRole: access.actorRole, beforeSummary: existing, afterSummary: updated || existing });
  return { ok: true, schedule: normalizeSchedule(updated || existing) };
}

async function archiveBackupSchedule(scheduleId, services = {}) {
  const existing = await getBackupSchedule(scheduleId, services);
  if (!existing) return { ok: false, reason: 'BACKUP_SCHEDULE_NOT_FOUND', status: 404 };
  const access = await enforceScheduleWrite({
    actorId: services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    scope: existing.scope
  }, services);
  if (!access.ok) {
    await audit('backup_schedule/permission_denied', existing, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const archived = await store.updateBackupItem(BACKUP_SCHEDULES_KEY, scheduleId, {
    enabled: false,
    archivedAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  }, services);
  await audit('backup_schedule/archived', archived || existing, services, { actorRole: access.actorRole });
  return { ok: true, schedule: normalizeSchedule(archived || existing) };
}

async function previewScheduleRun(scheduleId, services = {}) {
  const schedule = await getBackupSchedule(scheduleId, services);
  if (!schedule) return { ok: false, reason: 'BACKUP_SCHEDULE_NOT_FOUND', status: 404 };
  return {
    ok: true,
    preview: utils.sanitize({
      schedule,
      due: isDue(schedule),
      willCreateBackup: false,
      requiresApproval: true,
      nextRunAt: schedule.nextRunAt,
      includes: schedule.scope === 'system_safe' ? utils.SAFE_DATA_KEYS : utils.SAFE_DATA_KEYS.filter(key => key !== 'dashboard_audit_logs'),
      warnings: [
        'Preview tidak menjalankan backup.',
        'Run terjadwal tetap membutuhkan approval eksplisit.',
        'Tidak ada restore/import terjadwal.'
      ]
    })
  };
}

async function requestScheduleRunApproval(scheduleId, services = {}) {
  const schedule = await getBackupSchedule(scheduleId, services);
  if (!schedule) return { ok: false, reason: 'BACKUP_SCHEDULE_NOT_FOUND', status: 404 };
  if (schedule.archivedAt || !schedule.enabled) return { ok: false, reason: 'BACKUP_SCHEDULE_DISABLED', status: 400 };
  const access = await enforceScheduleWrite({
    actorId: services.actorId || schedule.userId,
    userId: schedule.userId,
    workspaceId: schedule.workspaceId,
    scope: schedule.scope
  }, services);
  if (!access.ok) {
    await audit('backup_schedule_run/permission_denied', schedule, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const run = normalizeScheduleRun({
    scheduleId: schedule.id,
    workspaceId: schedule.workspaceId,
    userId: schedule.userId,
    scope: schedule.scope,
    status: 'pending_approval',
    requestedBy: access.actorId
  });
  await store.upsertBackupItem(BACKUP_SCHEDULE_RUNS_KEY, run, services);
  await audit('backup_schedule_run/approval_requested', run, services, { actorRole: access.actorRole, targetType: 'backup_schedule_run' });
  return { ok: true, run };
}

async function approveScheduleRun(scheduleRunId, actor = {}, services = {}) {
  const run = await store.getBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, services);
  if (!run) return { ok: false, reason: 'BACKUP_SCHEDULE_RUN_NOT_FOUND', status: 404 };
  if (run.status !== 'pending_approval') return { ok: false, reason: 'BACKUP_SCHEDULE_RUN_NOT_PENDING', status: 400 };
  const access = await enforceScheduleAdmin({
    actorId: actor.actorId || services.actorId || run.userId,
    userId: run.userId,
    workspaceId: run.workspaceId
  }, services);
  if (!access.ok) {
    await audit('backup_schedule_run/permission_denied', run, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  const approved = await store.updateBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, {
    status: 'approved',
    approvedBy: access.actorId,
    approvedAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  }, services);
  await audit('backup_schedule_run/approved', approved || run, services, { actorRole: access.actorRole, actorId: access.actorId, targetType: 'backup_schedule_run' });
  return { ok: true, run: normalizeScheduleRun(approved || run) };
}

async function runApprovedSchedule(scheduleRunId, services = {}) {
  const run = await store.getBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, services);
  if (!run) return { ok: false, reason: 'BACKUP_SCHEDULE_RUN_NOT_FOUND', status: 404 };
  if (run.status !== 'approved') return { ok: false, reason: 'BACKUP_SCHEDULE_RUN_NOT_APPROVED', status: 403 };
  const schedule = await getBackupSchedule(run.scheduleId, services);
  if (!schedule) return { ok: false, reason: 'BACKUP_SCHEDULE_NOT_FOUND', status: 404 };
  const access = await enforceScheduleAdmin({
    actorId: services.actorId || run.approvedBy || run.userId,
    userId: run.userId,
    workspaceId: run.workspaceId
  }, services);
  if (!access.ok) {
    await audit('backup_schedule_run/permission_denied', run, services, { status: 'denied', decision: 'denied', reason: access.error });
    return { ok: false, reason: access.error, status: access.status || 403 };
  }
  await store.updateBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, { status: 'running', updatedAt: utils.nowIso() }, services);
  await audit('backup_schedule_run/started', run, services, { actorRole: access.actorRole, targetType: 'backup_schedule_run' });
  try {
    const backupOptions = {
      actorId: access.actorId,
      userId: schedule.userId,
      workspaceId: schedule.workspaceId,
      includeAudit: false
    };
    const backupResult = schedule.scope === 'user'
      ? await backupEngine.createUserBackup(schedule.userId, backupOptions, services)
      : schedule.scope === 'system_safe'
        ? await backupEngine.createSystemSafeBackup(backupOptions, services)
        : await backupEngine.createWorkspaceBackup(schedule.workspaceId, backupOptions, services);
    if (!backupResult.ok) throw new Error(backupResult.reason || 'BACKUP_FAILED');
    const completedAt = utils.nowIso();
    const completed = await store.updateBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, {
      status: 'completed',
      backupId: backupResult.manifest.id,
      completedAt,
      updatedAt: completedAt
    }, services);
    await store.updateBackupItem(BACKUP_SCHEDULES_KEY, schedule.id, {
      lastRunAt: completedAt,
      lastStatus: 'completed',
      nextRunAt: calculateNextRunAt(schedule, completedAt),
      updatedAt: completedAt
    }, services);
    await audit('backup_schedule_run/completed', completed || run, services, {
      actorRole: access.actorRole,
      targetType: 'backup_schedule_run',
      afterSummary: { scheduleId: schedule.id, runId: scheduleRunId, backupId: backupResult.manifest.id }
    });
    return { ok: true, run: normalizeScheduleRun(completed || run), backup: backupResult.manifest };
  } catch (err) {
    const failed = await store.updateBackupItem(BACKUP_SCHEDULE_RUNS_KEY, scheduleRunId, {
      status: 'failed',
      errorSummary: utils.compactText(err.message, 300),
      updatedAt: utils.nowIso()
    }, services);
    await store.updateBackupItem(BACKUP_SCHEDULES_KEY, schedule.id, {
      lastStatus: 'failed',
      updatedAt: utils.nowIso()
    }, services);
    await audit('backup_schedule_run/failed', failed || run, services, { status: 'failed', reason: err.message, targetType: 'backup_schedule_run' });
    return { ok: false, reason: err.message, run: normalizeScheduleRun(failed || run) };
  }
}

async function listScheduleRuns(filters = {}, services = {}) {
  const items = await store.listBackupItems(BACKUP_SCHEDULE_RUNS_KEY, filters, services);
  return items.map(normalizeScheduleRun);
}

module.exports = {
  BACKUP_SCHEDULES_KEY,
  BACKUP_SCHEDULE_RUNS_KEY,
  approveScheduleRun,
  archiveBackupSchedule,
  calculateNextRunAt,
  createBackupSchedule,
  getBackupSchedule,
  isDue,
  listBackupSchedules,
  listScheduleRuns,
  normalizeSchedule,
  normalizeScheduleRun,
  previewScheduleRun,
  requestDueScheduleApprovals,
  requestScheduleRunApproval,
  runApprovedSchedule,
  updateBackupSchedule
};
