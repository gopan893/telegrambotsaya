'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const agents = require('../agents');

function getActorId(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function getAgentTaskServices(req, services = {}) {
  const actorId = getActorId(req, services);
  return {
    ...services,
    actorId,
    actorType: 'dashboard',
    workspaceId: req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default',
    userId: req.body?.userId || req.query?.userId || actorId,
    learningNotes: agents.learningNotes,
    auditLog
  };
}

function registerAgentTaskRoutes(router, services = {}) {
  router.get('/agent-tasks', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const items = await agents.agentTaskStore.listTasks({
      workspaceId: req.query.workspaceId,
      delegationId: req.query.delegationId,
      assignedAgentId: req.query.assignedAgentId,
      status: req.query.status,
      limit: guards.validateLimit(req.query.limit, 30, 100)
    }, svc);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/agent-tasks/:taskId', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const taskId = guards.validateId(req.params.taskId);
    if (!taskId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_TASK_ID' }, 400);
    const task = await agents.agentTaskStore.getTask(taskId, svc);
    if (!task) return guards.safeDashboardResponse(res, { ok: false, error: 'AGENT_TASK_NOT_FOUND' }, 404);
    const results = await agents.agentTaskStore.listTaskResults({ taskId }, svc);
    return guards.safeDashboardResponse(res, { ok: true, task, results });
  });

  router.post('/agent-tasks/create', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const validation = guards.validateTextLength(req.body?.title || req.body?.description, 900, 'task');
    if (!validation.ok) return guards.safeDashboardResponse(res, { ok: false, error: validation.error }, 400);
    const task = await agents.agentTaskStore.createTask({
      ...req.body,
      workspaceId: svc.workspaceId,
      userId: svc.userId,
      source: 'dashboard'
    }, svc);
    return guards.safeDashboardResponse(res, { ok: true, task });
  });

  router.post('/agent-tasks/:taskId/run', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const taskId = guards.validateId(req.params.taskId);
    if (!taskId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_TASK_ID' }, 400);
    const task = await agents.agentTaskRunner.runAgentTask(taskId, svc);
    return guards.safeDashboardResponse(res, { ok: true, task });
  });

  router.post('/agent-tasks/:taskId/block', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const taskId = guards.validateId(req.params.taskId);
    if (!taskId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_TASK_ID' }, 400);
    const task = await agents.agentTaskQueue.markAgentTaskBlocked(taskId, req.body?.reason || 'Blocked from dashboard', svc);
    return guards.safeDashboardResponse(res, { ok: true, task });
  });

  router.post('/agent-tasks/:taskId/archive', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const taskId = guards.validateId(req.params.taskId);
    if (!taskId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_TASK_ID' }, 400);
    const task = await agents.agentTaskQueue.archiveAgentTask(taskId, { actorId: getActorId(req, services) }, svc);
    return guards.safeDashboardResponse(res, { ok: true, task });
  });

  router.get('/delegations', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const items = await agents.delegationEngine.listDelegationSessions({
      workspaceId: req.query.workspaceId,
      userId: req.query.userId,
      status: req.query.status,
      limit: guards.validateLimit(req.query.limit, 30, 100)
    }, svc);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/delegations/:delegationId', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const delegationId = guards.validateId(req.params.delegationId);
    if (!delegationId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DELEGATION_ID' }, 400);
    const session = await agents.delegationEngine.getDelegationSession(delegationId, svc);
    if (!session) return guards.safeDashboardResponse(res, { ok: false, error: 'DELEGATION_NOT_FOUND' }, 404);
    const tasks = await agents.agentTaskStore.listTasks({ delegationId, limit: 100 }, svc);
    const results = await agents.agentTaskStore.listTaskResults({ delegationId, limit: 100 }, svc);
    return guards.safeDashboardResponse(res, { ok: true, session, tasks, results });
  });

  router.post('/delegations/create', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const validation = guards.validateTextLength(req.body?.message || req.body?.goal || req.body?.topic, 1600, 'message');
    if (!validation.ok) return guards.safeDashboardResponse(res, { ok: false, error: validation.error }, 400);
    const session = await agents.delegationEngine.createDelegationSession({
      workspaceId: svc.workspaceId,
      userId: svc.userId,
      chatId: req.body?.chatId || '',
      source: 'dashboard',
      originalMessage: validation.value,
      goal: req.body?.goal || validation.value
    }, svc);
    const plan = await agents.delegationEngine.planDelegation(session.id, svc);
    return guards.safeDashboardResponse(res, { ok: true, session: plan.session, tasks: plan.tasks });
  });

  router.post('/delegations/:delegationId/run', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const delegationId = guards.validateId(req.params.delegationId);
    if (!delegationId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DELEGATION_ID' }, 400);
    const result = await agents.delegationEngine.runDelegation(delegationId, svc);
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/delegations/:delegationId/cancel', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const delegationId = guards.validateId(req.params.delegationId);
    if (!delegationId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DELEGATION_ID' }, 400);
    const session = await agents.delegationEngine.cancelDelegation(delegationId, { actorId: getActorId(req, services) }, svc);
    return guards.safeDashboardResponse(res, { ok: true, session });
  });

  router.get('/agent-handoffs', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const items = await agents.handoffManager.listHandoffs({ workspaceId: req.query.workspaceId, status: req.query.status, limit: req.query.limit }, svc);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.post('/agent-handoffs/:taskId/accept', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const task = await agents.handoffManager.acceptHandoff(req.params.taskId, req.body?.agentId || req.body?.toAgentId || 'orchestrator', svc);
    return guards.safeDashboardResponse(res, { ok: true, task });
  });

  router.post('/agent-handoffs/:taskId/reject', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const result = await agents.handoffManager.rejectHandoff(req.params.taskId, req.body?.agentId || req.body?.toAgentId || 'orchestrator', req.body?.reason || 'Rejected', svc);
    return guards.safeDashboardResponse(res, result);
  });

  router.post('/delegations/router-test', async (req, res) => {
    const svc = getAgentTaskServices(req, services);
    const text = String(req.body?.message || req.body?.text || '');
    const route = agents.agentRouter.routeMessage(text, { forceMode: 'natural_smart', groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 } }, svc);
    const delegation = agents.delegationEngine.shouldTriggerDelegation(text, { workspaceId: svc.workspaceId, userId: svc.userId }, route, {}, svc);
    return guards.safeDashboardResponse(res, { ok: true, route, delegation });
  });
}

module.exports = {
  registerAgentTaskRoutes
};
