'use strict';

const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');

function registerPrivacyRoutes(router, services) {
  const env = services.env || process.env;
  const dashboardAuth = auth.createDashboardAuth(env);

  // All routes use auth
  router.use('/api/dashboard/privacy', dashboardAuth);

  const safeHandler = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  };

  // GET /api/dashboard/privacy
  router.get('/api/dashboard/privacy', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const overview = prv.privacyReportGenerator.generatePrivacyOverviewReport(req.query.workspaceId || 'default');
    guards.safeDashboardResponse(res, { ok: true, overview });
  }));

  // POST /api/dashboard/privacy/inventory-scan
  router.post('/api/dashboard/privacy/inventory-scan', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    prv.privacyAudit.recordPrivacyAudit({ type: 'inventory_scan', userId: req.body?.userId || 'system' });
    const inventory = prv.dataInventoryScanner.scanDataInventory(req.body?.workspaceId || 'default', services);
    const report = prv.dataInventoryScanner.buildDataInventoryReport(inventory);
    guards.safeDashboardResponse(res, { ok: true, ...report });
  }));

  // GET /api/dashboard/privacy/inventory
  router.get('/api/dashboard/privacy/inventory', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const inv = prv.dataInventoryScanner.scanDataInventory(req.query.workspaceId || 'default', services);
    guards.safeDashboardResponse(res, { ok: true, categories: inv });
  }));

  // POST /api/dashboard/privacy/classify
  router.post('/api/dashboard/privacy/classify', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const results = Object.keys(prv.dataInventoryScanner.CATEGORIES).map(cat => ({
      category: cat,
      classification: prv.dataClassificationEngine.classifyDataCategory(cat)
    }));
    const summary = prv.dataClassificationEngine.buildClassificationSummary(results);
    guards.safeDashboardResponse(res, { ok: true, results, summary });
  }));

  // GET /api/dashboard/privacy/policies
  router.get('/api/dashboard/privacy/policies', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const categories = Object.keys(prv.dataInventoryScanner.CATEGORIES);
    const policies = categories.map(c => ({ category: c, policy: prv.privacyPolicyEngine.getPrivacyPolicy(c) }));
    guards.safeDashboardResponse(res, { ok: true, policies });
  }));

  // POST /api/dashboard/privacy/policies
  router.post('/api/dashboard/privacy/policies', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const updated = prv.privacyPolicyEngine.updatePrivacyPolicy(req.body);
    prv.privacyAudit.recordPrivacyAudit({ type: 'privacy_policy_changed', userId: req.body?.userId || 'system', details: { category: req.body?.dataCategory } });
    guards.safeDashboardResponse(res, { ok: true, policy: updated });
  }));

  // GET /api/dashboard/privacy/retention
  router.get('/api/dashboard/privacy/retention', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const policies = ['telegram_session_context', 'audit_logs', 'security_findings', 'incident_reports', 'deploy_reports', 'cost_usage', 'lifeos_mood_energy', 'lessons_learned', 'improvement_feedback'].map(c => ({ category: c, policy: prv.retentionPolicyManager.getRetentionPolicy(c) }));
    guards.safeDashboardResponse(res, { ok: true, policies });
  }));

  // POST /api/dashboard/privacy/retention
  router.post('/api/dashboard/privacy/retention', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const updated = prv.retentionPolicyManager.updateRetentionPolicy(req.body);
    prv.privacyAudit.recordPrivacyAudit({ type: 'retention_policy_changed', userId: req.body?.userId || 'system', details: { category: req.body?.dataCategory } });
    guards.safeDashboardResponse(res, { ok: true, policy: updated });
  }));

  // GET /api/dashboard/privacy/retention-candidates
  router.get('/api/dashboard/privacy/retention-candidates', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const candidates = prv.retentionPolicyManager.findRetentionCandidates();
    const plan = prv.retentionPolicyManager.createRetentionActionPlan(candidates);
    guards.safeDashboardResponse(res, { ok: true, candidates, plan });
  }));

  // POST /api/dashboard/privacy/export-request
  router.post('/api/dashboard/privacy/export-request', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const exportReq = prv.exportControlManager.createExportRequest(req.body);
    const validation = prv.exportControlManager.validateExportRequest(exportReq);
    if (!validation.valid) return guards.safeDashboardResponse(res, { ok: false, error: 'VALIDATION_FAILED', issues: validation.issues }, 400);
    const review = prv.exportControlManager.runExportPrivacyReview(exportReq);
    if (review.blocked) return guards.safeDashboardResponse(res, { ok: false, error: 'BLOCKED', reason: review.reason }, 403);
    const manifest = prv.exportControlManager.buildExportManifest(exportReq);
    prv.privacyAudit.recordPrivacyAudit({ type: 'export_request_created', userId: req.body?.userId || 'system', details: { categories: exportReq.categories, requiresApproval: exportReq.requiresApproval } });
    guards.safeDashboardResponse(res, { ok: true, exportRequest: exportReq, manifest });
  }));

  // GET /api/dashboard/privacy/export-requests
  router.get('/api/dashboard/privacy/export-requests', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const exports = prv.exportControlManager.listExports(req.query.status);
    guards.safeDashboardResponse(res, { ok: true, exports });
  }));

  // GET /api/dashboard/privacy/export-requests/:id/manifest
  router.get('/api/dashboard/privacy/export-requests/:id/manifest', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const manifest = prv.exportPackageBuilder.buildZipManifest({ id: req.params.id, categories: ['sample'], redactionMode: 'strict' });
    guards.safeDashboardResponse(res, { ok: true, manifest });
  }));

  // POST /api/dashboard/privacy/archive-plan
  router.post('/api/dashboard/privacy/archive-plan', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const plan = prv.archiveCleanupPlanner.createArchiveCleanupPlan(req.body);
    prv.privacyAudit.recordPrivacyAudit({ type: 'archive_plan_created', userId: req.body?.userId || 'system', details: { categories: plan.categories } });
    guards.safeDashboardResponse(res, { ok: true, plan });
  }));

  // GET /api/dashboard/privacy/archive-plans
  router.get('/api/dashboard/privacy/archive-plans', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const plans = prv.archiveCleanupPlanner.listPlans(req.query.status);
    guards.safeDashboardResponse(res, { ok: true, plans });
  }));

  // POST /api/dashboard/privacy/delete-request
  router.post('/api/dashboard/privacy/delete-request', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const delReq = prv.deleteRequestManager.createDeleteRequest(req.body);
    const validation = prv.deleteRequestManager.validateDeleteRequest(delReq);
    if (!validation.valid) return guards.safeDashboardResponse(res, { ok: false, error: 'VALIDATION_FAILED', issues: validation.issues }, 400);
    const safety = prv.deleteRequestManager.blockUnsafeHardDelete(delReq);
    if (safety.blocked) return guards.safeDashboardResponse(res, { ok: false, error: 'HARD_DELETE_BLOCKED', reason: safety.reason }, 403);
    prv.privacyAudit.recordPrivacyAudit({ type: 'delete_request_created', userId: req.body?.userId || 'system', details: { categories: delReq.categories, hardDelete: delReq.hardDeleteRequested } });
    guards.safeDashboardResponse(res, { ok: true, deleteRequest: delReq, message: 'Delete request created. Requires approval before execution.' });
  }));

  // GET /api/dashboard/privacy/delete-requests
  router.get('/api/dashboard/privacy/delete-requests', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const requests = prv.deleteRequestManager.listRequests(req.query.status);
    guards.safeDashboardResponse(res, { ok: true, deleteRequests: requests });
  }));

  // GET /api/dashboard/privacy/report
  router.get('/api/dashboard/privacy/report', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const report = prv.privacyReportGenerator.generatePrivacyOverviewReport(req.query.workspaceId || 'default');
    guards.safeDashboardResponse(res, { ok: true, report });
  }));

  // GET /api/dashboard/privacy/audit
  router.get('/api/dashboard/privacy/audit', safeHandler(async (req, res) => {
    const prv = require('../privacy');
    const events = prv.privacyAudit.listPrivacyAudit({ type: req.query.type, userId: req.query.userId, limit: parseInt(req.query.limit) || 50 });
    const summary = prv.privacyAudit.summarizePrivacyAudit();
    guards.safeDashboardResponse(res, { ok: true, events, summary });
  }));
}

module.exports = { registerPrivacyRoutes };
