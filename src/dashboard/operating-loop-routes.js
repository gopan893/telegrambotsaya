'use strict';

const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const auditLog = require('./audit-log');
const permissions = require('./dashboard-permissions');

function registerOperatingLoopRoutes(router, services = {}) {
  let operatingLoop;
  try {
    operatingLoop = require('../operating-loop');
  } catch (e) {
    operatingLoop = null;
  }

  let registry;
  try {
    registry = require('../operating-loop/operating-loop-registry');
  } catch (e) {
    registry = null;
  }

  let store;
  try {
    store = require('../operating-loop/operating-loop-store');
  } catch (e) {
    store = null;
  }

  let snapshotBuilder;
  try {
    snapshotBuilder = require('../operating-loop/operating-snapshot-builder');
  } catch (e) {
    snapshotBuilder = null;
  }

  let blockerDetector;
  try {
    blockerDetector = require('../operating-loop/blocker-detector');
  } catch (e) {
    blockerDetector = null;
  }

  let synthesizer;
  try {
    synthesizer = require('../operating-loop/next-action-synthesizer');
  } catch (e) {
    synthesizer = null;
  }

  let reportGenerator;
  try {
    reportGenerator = require('../operating-loop/operating-loop-report-generator');
  } catch (e) {
    reportGenerator = null;
  }

  let collector;
  try {
    collector = require('../operating-loop/system-state-collector');
  } catch (e) {
    collector = null;
  }

  function requireOp(mod, orBlock) {
    if (!mod) {
      if (orBlock) return orBlock();
      return { ok: false, error: 'OPERATING_LOOP_MODULE_UNAVAILABLE' };
    }
    return null;
  }

  const svc = services;

  router.get('/operating-loop/loops', async (req, res) => {
    try {
      const block = requireOp(registry, () => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.q) filters.q = req.query.q;
      const result = await registry.listOperatingLoops(filters, svc);
      guards.safeDashboardResponse(res, { ok: true, data: result.data || [], total: result.total || 0 });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/loops/:id', async (req, res) => {
    try {
      const block = requireOp(registry, () => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = await registry.getOperatingLoop(req.params.id, svc);
      if (!result.ok || !result.data) return guards.safeDashboardResponse(res, { ok: false, error: 'LOOP_NOT_FOUND' }, 404);
      guards.safeDashboardResponse(res, { ok: true, data: result.data });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operating-loop/loops/:id/enable', async (req, res) => {
    try {
      const block = requireOp(registry, () => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = await registry.enableOperatingLoop(req.params.id, svc);
      if (result.ok) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
          action: 'loop_enabled', targetType: 'operating_loop', targetId: req.params.id,
          status: 'success'
        }, svc);
      }
      guards.safeDashboardResponse(res, result, result.ok ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operating-loop/loops/:id/disable', async (req, res) => {
    try {
      const block = requireOp(registry, () => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = await registry.disableOperatingLoop(req.params.id, svc);
      if (result.ok) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
          action: 'loop_disabled', targetType: 'operating_loop', targetId: req.params.id,
          status: 'success'
        }, svc);
      }
      guards.safeDashboardResponse(res, result, result.ok ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/operating-loop/loops/:id/run', async (req, res) => {
    try {
      const block = requireOp(registry, () => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const loop = await registry.getOperatingLoop(req.params.id, svc);
      if (!loop.ok || !loop.data) return guards.safeDashboardResponse(res, { ok: false, error: 'LOOP_NOT_FOUND' }, 404);
      const state = collector ? await collector.collectSystemState('', svc) : {};
      const snapshot = snapshotBuilder ? await snapshotBuilder.buildOperatingSnapshot(state, svc) : { healthStatus: 'unknown' };
      const blockers = blockerDetector ? await blockerDetector.detectOperatingBlockers(snapshot, svc) : [];
      const actions = synthesizer ? await synthesizer.synthesizeNextActions(snapshot, blockers, svc) : [];
      const run = { loopId: req.params.id, snapshot, blockers, actions, status: 'completed', timestamp: new Date().toISOString() };
      if (store) await store.saveLoopRun(run, svc);
      await auditLog.recordAuditLog({
        actorType: 'dashboard', actorId: req.dashboardActorId || 'admin',
        action: 'loop_run', targetType: 'operating_loop', targetId: req.params.id,
        status: 'success'
      }, svc);
      guards.safeDashboardResponse(res, { ok: true, run });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/snapshot', async (req, res) => {
    try {
      const block = requireOp(collector, () => guards.safeDashboardResponse(res, { ok: true, data: { healthStatus: 'unknown', modules: {}, concerns: [], opportunities: [], pendingApprovals: 0 } }));
      if (block) return;
      const state = await collector.collectSystemState('', svc);
      const snapshot = snapshotBuilder ? await snapshotBuilder.buildOperatingSnapshot(state, svc) : { healthStatus: 'unknown' };
      guards.safeDashboardResponse(res, { ok: true, data: snapshot });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/blockers', async (req, res) => {
    try {
      const block = requireOp(blockerDetector, () => guards.safeDashboardResponse(res, { ok: true, data: [] }));
      if (block) return;
      const state = collector ? await collector.collectSystemState('', svc) : {};
      const snapshot = snapshotBuilder ? await snapshotBuilder.buildOperatingSnapshot(state, svc) : { healthStatus: 'unknown' };
      const blockers = await blockerDetector.detectOperatingBlockers(snapshot, svc);
      guards.safeDashboardResponse(res, { ok: true, data: blockers || [] });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/next-action', async (req, res) => {
    try {
      const block = requireOp(synthesizer, () => guards.safeDashboardResponse(res, { ok: true, data: null }));
      if (block) return;
      const state = collector ? await collector.collectSystemState('', svc) : {};
      const snapshot = snapshotBuilder ? await snapshotBuilder.buildOperatingSnapshot(state, svc) : { healthStatus: 'unknown' };
      const blockers = blockerDetector ? await blockerDetector.detectOperatingBlockers(snapshot, svc) : [];
      const actions = await synthesizer.synthesizeNextActions(snapshot, blockers, svc);
      guards.safeDashboardResponse(res, { ok: true, data: (actions || [])[0] || null });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/reports/daily', async (req, res) => {
    try {
      const block = requireOp(reportGenerator, () => guards.safeDashboardResponse(res, { ok: true, data: { type: 'daily', healthStatus: 'unknown', summary: 'Report generator unavailable' } }));
      if (block) return;
      const report = await reportGenerator.generateDailyAIOSReport(req.query.workspaceId || '', svc);
      guards.safeDashboardResponse(res, { ok: true, data: report });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/reports/weekly', async (req, res) => {
    try {
      const block = requireOp(reportGenerator, () => guards.safeDashboardResponse(res, { ok: true, data: { type: 'weekly', healthStatus: 'unknown', summary: 'Report generator unavailable' } }));
      if (block) return;
      const report = await reportGenerator.generateWeeklyAIOSReport(req.query.workspaceId || '', svc);
      guards.safeDashboardResponse(res, { ok: true, data: report });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/runs', async (req, res) => {
    try {
      const block = requireOp(store, () => guards.safeDashboardResponse(res, { ok: true, data: [], total: 0 }));
      if (block) return;
      const filters = {};
      if (req.query.loopId) filters.loopId = req.query.loopId;
      if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);
      const result = await store.listLoopRuns(filters, svc);
      guards.safeDashboardResponse(res, { ok: true, data: result.data || [], total: result.total || 0 });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/runs/:id', async (req, res) => {
    try {
      const block = requireOp(store, () => guards.safeDashboardResponse(res, { ok: false, error: 'Module not loaded' }, 503));
      if (block) return;
      const result = await store.getLoopRun(req.params.id, svc);
      if (!result.ok || !result.data) return guards.safeDashboardResponse(res, { ok: false, error: 'RUN_NOT_FOUND' }, 404);
      guards.safeDashboardResponse(res, { ok: true, data: result.data });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/pending-proposals', async (req, res) => {
    try {
      const block = requireOp(reportGenerator, () => guards.safeDashboardResponse(res, { ok: true, data: [] }));
      if (block) return;
      const digest = await reportGenerator.generateApprovalDigest(req.query.workspaceId || '', svc);
      guards.safeDashboardResponse(res, { ok: true, data: digest.pendingApprovals || [] });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/operating-loop/status', async (req, res) => {
    try {
      let totalLoops = 0;
      let enabledCount = 0;
      let snapshotHealth = 'unknown';
      if (registry) {
        const loops = await registry.listOperatingLoops({}, svc);
        totalLoops = loops.total || 0;
        enabledCount = (loops.data || []).filter(l => l.status === 'enabled').length;
      }
      if (collector) {
        const state = await collector.collectSystemState('', svc);
        const snapshot = snapshotBuilder ? await snapshotBuilder.buildOperatingSnapshot(state, svc) : { healthStatus: 'unknown' };
        snapshotHealth = snapshot.healthStatus || 'unknown';
      }
      guards.safeDashboardResponse(res, {
        ok: true,
        totalLoops,
        enabledCount,
        snapshotHealth,
        loopModuleAvailable: !!registry,
        collectorAvailable: !!collector,
        reportGeneratorAvailable: !!reportGenerator
      });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });
}

module.exports = { registerOperatingLoopRoutes };
