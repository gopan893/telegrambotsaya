'use strict';

const planner = require('../planner');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const workspaceRoutes = require('./workspace-routes');

function actorFromReq(req, services = {}) {
  return workspaceRoutes.getActorId(req, services);
}

function userFromReq(req, fallback = '') {
  return guards.validateUserId(req.body?.userId || req.query?.userId || fallback || '') || '';
}

function workspaceFromReq(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || '').trim();
}

function buildPlannerServices(req, services = {}) {
  return {
    ...services,
    actorId: actorFromReq(req, services),
    actorType: 'dashboard',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function sendResult(res, result, status = 200) {
  const code = result?.status || status;
  if (result && result.ok === false) {
    return guards.safeDashboardResponse(res, { ok: false, error: result.reason || result.error || 'PLANNER_ERROR' }, code >= 400 ? code : 400);
  }
  return guards.safeDashboardResponse(res, result, code);
}

function sanitizePlanResponse(result = {}) {
  return {
    ok: Boolean(result.ok),
    plan: result.plan ? serializers.sanitizePlan(result.plan) : null,
    tasks: Array.isArray(result.tasks) ? result.tasks.map(serializers.sanitizeTask) : undefined,
    summaryText: serializers.truncateText(result.summaryText || '', 1600)
  };
}

function registerPlannerRoutes(router, services = {}) {
  router.get('/planner', async (req, res) => {
    const userId = userFromReq(req, services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '');
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const items = await planner.plannerEngine.listPlans({
      userId,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req),
      includeArchived: req.query.includeArchived === 'true',
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, buildPlannerServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizePlan) });
  });

  router.post('/planner/create', async (req, res) => {
    const userId = userFromReq(req, services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '');
    const result = await planner.plannerEngine.createPlan({
      ...req.body,
      userId,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.get('/planner/next-actions', async (req, res) => {
    const userId = userFromReq(req, services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '');
    const result = await planner.plannerEngine.suggestNextActions(workspaceFromReq(req), userId, buildPlannerServices(req, services));
    return guards.safeDashboardResponse(res, {
      ok: true,
      workspaceId: result.workspaceId,
      actions: (result.actions || []).map(serializers.sanitizeTask),
      blocked: (result.blocked || []).map(serializers.sanitizeTask)
    });
  });

  router.post('/planner/from-goal', async (req, res) => {
    const userId = userFromReq(req, services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '');
    const goalId = guards.validateId(req.body?.goalId || req.query?.goalId || '');
    if (!goalId) return guards.safeDashboardResponse(res, { ok: false, error: 'GOAL_ID_REQUIRED' }, 400);
    const result = await planner.plannerEngine.generatePlanFromGoal(goalId, {
      ...req.body,
      userId,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.post('/planner/from-text', async (req, res) => {
    const userId = userFromReq(req, services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '');
    const text = String(req.body?.text || '').trim();
    if (!text) return guards.safeDashboardResponse(res, { ok: false, error: 'TEXT_REQUIRED' }, 400);
    const result = await planner.plannerEngine.generatePlanFromText(text, {
      ...req.body,
      userId,
      actorId: actorFromReq(req, services),
      workspaceId: workspaceFromReq(req)
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.post('/planner/tasks/reorder', async (req, res) => {
    const planId = guards.validateId(req.body?.planId || '');
    if (!planId) return guards.safeDashboardResponse(res, { ok: false, error: 'PLAN_ID_REQUIRED' }, 400);
    const result = await planner.taskOrchestrator.reorderTasks(planId, req.body?.orderedTaskIds || [], buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, plan: serializers.sanitizePlan(result.plan) } : result, result.status || 200);
  });

  router.get('/planner/:planId', async (req, res) => {
    const planId = guards.validateId(req.params.planId);
    if (!planId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_PLAN_ID' }, 400);
    const result = await planner.plannerEngine.summarizePlan(planId, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.post('/planner/:planId/update', async (req, res) => {
    const planId = guards.validateId(req.params.planId);
    if (!planId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_PLAN_ID' }, 400);
    const result = await planner.plannerEngine.updatePlan(planId, {
      ...req.body,
      actorId: actorFromReq(req, services)
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.post('/planner/:planId/archive', async (req, res) => {
    const planId = guards.validateId(req.params.planId);
    if (!planId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_PLAN_ID' }, 400);
    const result = await planner.plannerEngine.archivePlan(planId, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? sanitizePlanResponse(result) : result, result.status || 200);
  });

  router.get('/planner/:planId/tasks', async (req, res) => {
    const planId = guards.validateId(req.params.planId);
    const plan = await planner.plannerEngine.getPlan(planId, buildPlannerServices(req, services));
    if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'PLAN_NOT_FOUND' }, 404);
    const tasks = await planner.taskOrchestrator.listTasks({
      userId: plan.userId,
      actorId: actorFromReq(req, services),
      workspaceId: plan.workspaceId,
      planId,
      includeArchived: req.query.includeArchived === 'true',
      limit: guards.validateLimit(req.query.limit, 100, 200)
    }, buildPlannerServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: tasks.map(serializers.sanitizeTask) });
  });

  router.post('/planner/:planId/tasks/create', async (req, res) => {
    const planId = guards.validateId(req.params.planId);
    const plan = await planner.plannerEngine.getPlan(planId, buildPlannerServices(req, services));
    if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'PLAN_NOT_FOUND' }, 404);
    const result = await planner.taskOrchestrator.createTask({
      ...req.body,
      planId,
      userId: plan.userId,
      actorId: actorFromReq(req, services),
      workspaceId: plan.workspaceId
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, task: serializers.sanitizeTask(result.task) } : result, result.status || 200);
  });

  router.post('/planner/tasks/:taskId/update', async (req, res) => {
    const taskId = guards.validateId(req.params.taskId);
    const result = await planner.taskOrchestrator.updateTask(taskId, {
      ...req.body,
      actorId: actorFromReq(req, services)
    }, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, task: serializers.sanitizeTask(result.task) } : result, result.status || 200);
  });

  router.post('/planner/tasks/:taskId/done', async (req, res) => {
    const taskId = guards.validateId(req.params.taskId);
    const result = await planner.taskOrchestrator.markTaskDone(taskId, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, task: serializers.sanitizeTask(result.task) } : result, result.status || 200);
  });

  router.post('/planner/tasks/:taskId/blocked', async (req, res) => {
    const taskId = guards.validateId(req.params.taskId);
    const result = await planner.taskOrchestrator.markTaskBlocked(taskId, req.body?.reason || '', buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, task: serializers.sanitizeTask(result.task) } : result, result.status || 200);
  });

  router.post('/planner/tasks/:taskId/archive', async (req, res) => {
    const taskId = guards.validateId(req.params.taskId);
    const result = await planner.taskOrchestrator.archiveTask(taskId, buildPlannerServices(req, services));
    return sendResult(res, result.ok ? { ok: true, task: serializers.sanitizeTask(result.task) } : result, result.status || 200);
  });
}

module.exports = {
  registerPlannerRoutes
};
