'use strict';

const backup = require('../backup');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const workspaceRoutes = require('./workspace-routes');

function actorFromReq(req, services = {}) {
  return workspaceRoutes.getActorId(req, services);
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: actorFromReq(req, services),
    actorType: 'dashboard',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function workspaceFromReq(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || '').trim();
}

function userFromReq(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '') || '';
}

function registerBackupRoutes(router, services = {}) {
  router.get('/backup', async (req, res) => {
    const items = await backup.backupEngine.listBackups({
      type: req.query.type || '',
      workspaceId: req.query.workspaceId || '',
      userId: req.query.userId || '',
      status: req.query.status || '',
      includeArchived: req.query.includeArchived === 'true',
      limit: guards.validateLimit(req.query.limit, 30, 100)
    }, buildServices(req, services));
    const recovery = await backup.disasterRecovery.getDisasterRecoveryStatus(buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeBackupManifest), recovery });
  });

  router.post('/backup/create', async (req, res) => {
    const svc = buildServices(req, services);
    const type = req.body?.type || 'workspace';
    const payload = {
      actorId: req.body?.actorId || svc.actorId,
      createdBy: req.body?.actorId || svc.actorId,
      userId: userFromReq(req, services),
      workspaceId: workspaceFromReq(req),
      includeAudit: Boolean(req.body?.includeAudit)
    };
    const result = type === 'user'
      ? await backup.backupEngine.createUserBackup(payload.userId, payload, svc)
      : type === 'system' || type === 'full_safe'
        ? await backup.backupEngine.createSystemSafeBackup(payload, svc)
        : await backup.backupEngine.createWorkspaceBackup(payload.workspaceId, payload, svc);
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, manifest: serializers.sanitizeBackupManifest(result.manifest) } : { ok: false, error: result.reason }, result.ok ? 200 : (result.status || 400));
  });

  router.get('/backup/:backupId', async (req, res) => {
    const item = await backup.backupEngine.getBackup(req.params.backupId, buildServices(req, services));
    if (!item) return guards.safeDashboardResponse(res, { ok: false, error: 'BACKUP_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, manifest: serializers.sanitizeBackupManifest(item.manifest), snapshot: serializers.sanitizeBackupSnapshot(item.snapshot) });
  });

  router.post('/backup/:backupId/validate', async (req, res) => {
    const result = await backup.backupEngine.validateBackup(req.params.backupId, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, manifest: serializers.sanitizeBackupManifest(result.manifest), checksum: result.checksum } : { ok: false, error: result.reason }, result.ok ? 200 : (result.status || 400));
  });

  router.get('/backup/:backupId/export', async (req, res) => {
    const result = await backup.exportEngine.exportBackupJson(req.params.backupId, buildServices(req, services));
    if (!result.ok) return guards.safeDashboardResponse(res, { ok: false, error: result.reason }, result.status || 400);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.status(200).json(result.payload);
  });

  router.post('/backup/:backupId/archive', async (req, res) => {
    const result = await backup.backupEngine.archiveBackup(req.params.backupId, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, manifest: serializers.sanitizeBackupManifest(result.manifest) } : { ok: false, error: result.reason }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/import/validate', async (req, res) => {
    const result = await backup.importValidator.validateImportPayload(req.body?.payload || req.body || {}, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, type: result.type, version: result.version, diff: result.diff, job: result.job } : { ok: false, error: result.reason }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/import/preview', async (req, res) => {
    const preview = await backup.importValidator.buildImportPreview(req.body?.payload || req.body || {}, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, preview });
  });

  router.post('/restore/plan', async (req, res) => {
    const svc = buildServices(req, services);
    const source = req.body?.backupId || req.body?.payload || req.body?.importPayload || {};
    const result = await backup.restoreEngine.createRestorePlan(source, {
      actorId: req.body?.actorId || svc.actorId,
      userId: userFromReq(req, services),
      workspaceId: workspaceFromReq(req),
      allowOverwrite: Boolean(req.body?.allowOverwrite)
    }, svc);
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, plan: serializers.sanitizeRestorePlan(result.plan) } : { ok: false, error: result.reason, expected: result.expected }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/restore/:restorePlanId/run', async (req, res) => {
    const svc = buildServices(req, services);
    const result = await backup.restoreEngine.runApprovedRestore(req.params.restorePlanId, {
      actorId: req.body?.actorId || svc.actorId,
      confirmationText: req.body?.confirmationText || req.body?.confirmation
    }, svc);
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, plan: serializers.sanitizeRestorePlan(result.plan), results: result.results } : { ok: false, error: result.reason, expected: result.expected }, result.ok ? 200 : (result.status || 400));
  });

  router.get('/recovery/status', async (req, res) => {
    const status = await backup.disasterRecovery.getDisasterRecoveryStatus(buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, status });
  });

  router.post('/recovery/check', async (req, res) => {
    const result = await backup.disasterRecovery.runDisasterRecoveryCheck(buildServices(req, services));
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/integrity/check', async (req, res) => {
    const result = await backup.integrityChecker.runIntegrityCheck({
      workspaceId: workspaceFromReq(req),
      userId: userFromReq(req, services)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, report: result });
  });
}

module.exports = {
  registerBackupRoutes
};
