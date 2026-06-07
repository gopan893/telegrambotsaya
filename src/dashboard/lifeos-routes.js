'use strict';

const express = require('express');
const lifeos = require('../lifeos');
const guards = require('./dashboard-guards');
const workspaceRoutes = require('./workspace-routes');

function getActor(req, services = {}) {
  return workspaceRoutes.getActorId(req, services) || String(req.body?.actorId || req.query?.actorId || services.actorId || 'dashboard-admin');
}

function getWorkspace(req, services = {}) {
  return String(req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default').trim() || 'default';
}

function getUser(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.userId || services.env?.OWNER_CHAT_ID || getActor(req, services)) || getActor(req, services);
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: getActor(req, services),
    userId: getUser(req, services),
    workspaceId: getWorkspace(req, services),
    actorType: 'dashboard',
    lifeosSystem: lifeos,
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function route(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      return guards.safeDashboardResponse(res, {
        ok: false,
        error: 'LIFEOS_ROUTE_FAILED',
        message: err?.message || 'Life OS module unavailable'
      }, 200);
    }
  };
}

function registerLifeOsRoutes(router, services = {}) {
  const dr = express.Router();

  dr.get('/', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const [summary, storage] = await Promise.all([
      lifeos.lifeReportGenerator.generateLifeOSSummary(runtime.userId, runtime),
      lifeos.lifeStore.getLifeOsStorageStatus(runtime)
    ]);
    return guards.safeDashboardResponse(res, { ok: true, summary, storage });
  }));

  dr.get('/daily', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const plan = await lifeos.dailyPlanner.getDailyPlan(req.query.date || new Date(), runtime);
    return guards.safeDashboardResponse(res, { ok: true, plan });
  }));

  dr.post('/daily', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.dailyPlanner.createDailyPlan({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/weekly', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.weeklyPlanner.summarizeWeeklyPlan(req.query.week || lifeos.lifeUtils.getWeekKey(new Date()), runtime);
    return guards.safeDashboardResponse(res, result.ok ? result : { ok: true, plan: null, reason: result.reason });
  }));

  dr.post('/weekly', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.weeklyPlanner.createWeeklyPlan({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/tasks', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await lifeos.personalTaskManager.listPersonalTasks({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: req.query.limit || 100 }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items });
  }));

  dr.post('/tasks', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.personalTaskManager.createPersonalTask({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/tasks/:id/complete', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.personalTaskManager.completePersonalTask(req.params.id, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 404));
  }));

  dr.get('/habits', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await lifeos.lifeStore.listLifeItems({ workspaceId: runtime.workspaceId, userId: runtime.userId, type: 'habit', limit: req.query.limit || 100 }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items });
  }));

  dr.post('/habits', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.habitTracker.createHabit({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/habits/:id/checkin', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.habitTracker.logHabitCheckin(req.params.id, req.body?.date || new Date(), req.body?.value !== false, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 404));
  }));

  dr.get('/reminders', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await lifeos.reminderPlanner.listReminderPlans({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: req.query.limit || 100 }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items });
  }));

  dr.post('/reminders', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.reminderPlanner.createReminderPlan({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/focus', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await lifeos.lifeStore.listLifeItems({ workspaceId: runtime.workspaceId, userId: runtime.userId, type: 'focus_session', limit: req.query.limit || 100 }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items });
  }));

  dr.post('/focus', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.focusSessionManager.createFocusSession({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/goals', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const items = await lifeos.personalGoalManager.listPersonalGoals({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: req.query.limit || 100 }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items });
  }));

  dr.post('/goals', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.personalGoalManager.createPersonalGoal({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/mood', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await lifeos.energyMoodJournal.createEnergyMoodNote({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/integration-proposal', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const kind = String(req.body?.kind || req.body?.type || '').toLowerCase();
    let result;
    if (kind.includes('calendar')) result = await lifeos.lifeIntegrationProposal.createCalendarEventProposal(req.body || {}, runtime);
    else if (kind.includes('gmail') || kind.includes('email')) result = await lifeos.lifeIntegrationProposal.createGmailDraftProposal(req.body || {}, runtime);
    else if (kind.includes('routine')) result = await lifeos.lifeIntegrationProposal.createRoutineProposalFromLifePlan(req.body || {}, runtime);
    else result = await lifeos.lifeIntegrationProposal.createLifeExecutorProposal(req.body || {}, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/report', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const report = await lifeos.lifeReportGenerator.generateLifeOSSummary(runtime.userId, runtime);
    return guards.safeDashboardResponse(res, report);
  }));

  router.use('/lifeos', dr);
}

module.exports = {
  registerLifeOsRoutes
};
