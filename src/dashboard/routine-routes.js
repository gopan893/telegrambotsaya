'use strict';

const express = require('express');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const routines = require('../routines');

function registerRoutineDashboardRoutes(app, services = {}) {
  const router = express.Router();
  const routineRegistry = services.routineRegistry || routines.createRoutineRegistry(services);
  const routineRunner = services.routineRunner || routines.createRoutineRunner({ ...services, registry: routineRegistry });
  const routineScheduler = services.routineScheduler || routines.createRoutineScheduler({ ...services, runner: routineRunner });

  // All routes require auth
  router.use(auth.requireAuth);

  // GET /api/dashboard/routines
  router.get('/', (req, res) => {
    const userId = req.user?.userId || req.query.userId;
    const list = routineRegistry.listRoutines(userId ? { userId } : {});
    const safe = list.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      schedule: r.schedule,
      enabled: r.enabled,
      mode: r.mode,
      riskLevel: r.riskLevel,
      lastRunAt: r.lastRunAt,
      nextRunAt: r.nextRunAt,
      createdAt: r.createdAt
    }));
    return res.json({ ok: true, routines: safe });
  });

  // POST /api/dashboard/routines
  router.post('/', (req, res) => {
    try {
      const routine = routineRegistry.createRoutine(req.body || {});
      return res.status(201).json({ ok: true, routine: { id: routine.id, name: routine.name } });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // GET /api/dashboard/routines/:id
  router.get('/:id', (req, res) => {
    const routine = routineRegistry.getRoutine(req.params.id);
    if (!routine) return res.status(404).json({ ok: false, error: 'Routine not found' });
    return res.json({ ok: true, routine: { id: routine.id, name: routine.name, type: routine.type, schedule: routine.schedule, enabled: routine.enabled, mode: routine.mode, riskLevel: routine.riskLevel, lastRunAt: routine.lastRunAt, nextRunAt: routine.nextRunAt, description: routine.description } });
  });

  // POST /api/dashboard/routines/:id/enable
  router.post('/:id/enable', (req, res) => {
    const updated = routineRegistry.enableRoutine(req.params.id);
    if (!updated) return res.status(404).json({ ok: false, error: 'Routine not found' });
    routineScheduler.registerRoutine(updated);
    return res.json({ ok: true });
  });

  // POST /api/dashboard/routines/:id/disable
  router.post('/:id/disable', (req, res) => {
    const routine = routineRegistry.getRoutine(req.params.id);
    if (!routine) return res.status(404).json({ ok: false, error: 'Routine not found' });
    routineRegistry.disableRoutine(req.params.id);
    routineScheduler.unregisterRoutine(req.params.id);
    return res.json({ ok: true });
  });

  // POST /api/dashboard/routines/:id/run
  router.post('/:id/run', async (req, res) => {
    const routine = routineRegistry.getRoutine(req.params.id);
    if (!routine) return res.status(404).json({ ok: false, error: 'Routine not found' });
    if (!routine.enabled) return res.status(400).json({ ok: false, error: 'Routine is disabled' });

    try {
      const result = await routineRunner.runRoutine(req.params.id, { userId: req.user?.userId }, services);
      return res.json({ ok: result.status === 'completed', ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/dashboard/routines/:id/dry-run
  router.post('/:id/dry-run', async (req, res) => {
    try {
      const result = await routineRunner.runRoutineDryRun(req.params.id, services);
      return res.json({ ok: result.status === 'completed', ...result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/dashboard/routines/:id/runs
  router.get('/:id/runs', (req, res) => {
    const store = routineRegistry.routineStore;
    const runs = store.listRuns({ routineId: req.params.id });
    return res.json({ ok: true, runs: runs.map(r => ({
      id: r.id,
      status: r.status,
      mode: r.mode,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      summary: (r.summary || '').slice(0, 200),
      findingsCount: (r.findings || []).length,
      proposalsCount: (r.proposalIds || []).length
    })) });
  });

  // GET /api/dashboard/routine-runs
  router.get('/runs', (req, res) => {
    const store = routineRegistry.routineStore;
    const runs = store.listRuns({});
    return res.json({ ok: true, runs: runs.slice(0, 50) });
  });

  // GET /api/dashboard/routine-runs/:runId
  router.get('/runs/:runId', (req, res) => {
    const store = routineRegistry.routineStore;
    const run = store.getRun(req.params.runId);
    if (!run) return res.status(404).json({ ok: false, error: 'Run not found' });
    return res.json({ ok: true, run });
  });

  // GET /api/dashboard/routine-notifications
  router.get('/notifications', (req, res) => {
    const store = routineRegistry.routineStore;
    const notifications = store.listNotifications({});
    return res.json({ ok: true, notifications: notifications.slice(0, 50) });
  });

  app.use('/api/dashboard/routines', router);
  return router;
}

module.exports = { registerRoutineDashboardRoutes };
