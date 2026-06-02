'use strict';

const guards = require('./dashboard-guards');
const agents = require('../agents');

function actorFromReq(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function buildServices(req, services = {}) {
  const actorId = actorFromReq(req, services);
  return {
    ...services,
    actorId,
    actorType: 'dashboard',
    workspaceId: req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default',
    userId: req.body?.userId || req.query?.userId || actorId,
    auditLog: services.auditLog || require('./audit-log')
  };
}

function sendResult(res, result, status = 200) {
  if (result?.ok === false) {
    return guards.safeDashboardResponse(res, { ok: false, error: result.reason || result.error || 'AGENT_EXECUTOR_ERROR', preflight: result.preflight }, result.status || status || 400);
  }
  return guards.safeDashboardResponse(res, result, status);
}

function registerAgentExecutorRoutes(router, services = {}) {
  router.get('/agent-executor/action-plans', async (req, res) => {
    const svc = buildServices(req, services);
    const items = await agents.agentActionPlan.listActionPlans({
      workspaceId: req.query.workspaceId,
      userId: req.query.userId,
      status: req.query.status,
      source: req.query.source,
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, svc);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/agent-executor/action-plans/:id', async (req, res) => {
    const svc = buildServices(req, services);
    const id = guards.validateId(req.params.id);
    if (!id) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_ACTION_PLAN_ID' }, 400);
    const plan = await agents.agentActionPlan.getActionPlan(id, svc);
    if (!plan) return guards.safeDashboardResponse(res, { ok: false, error: 'ACTION_PLAN_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, plan });
  });

  router.post('/agent-executor/action-plans/create', async (req, res) => {
    const svc = buildServices(req, services);
    const text = req.body?.text || req.body?.message || req.body?.description || req.body?.title || '';
    const validation = guards.validateTextLength(text, 1600, 'action');
    if (!validation.ok) return guards.safeDashboardResponse(res, { ok: false, error: validation.error }, 400);
    const result = req.body?.actions
      ? { ok: true, plan: await agents.agentActionPlan.createActionPlan({ ...req.body, workspaceId: svc.workspaceId, userId: svc.userId, source: req.body?.source || 'dashboard' }, svc) }
      : await agents.agentExecutorBridge.createActionPlanFromText(validation.value, {
        workspaceId: svc.workspaceId,
        userId: svc.userId,
        source: 'dashboard',
        createdByAgentId: req.body?.createdByAgentId || 'executor',
        title: req.body?.title,
        description: validation.value
      }, svc);
    return sendResult(res, result.ok ? { ok: true, plan: result.plan, detection: result.detection } : result);
  });

  router.post('/agent-executor/action-plans/:id/preflight', async (req, res) => {
    const svc = buildServices(req, services);
    const id = guards.validateId(req.params.id);
    if (!id) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_ACTION_PLAN_ID' }, 400);
    const preflight = await agents.executorPreflightReview.runExecutorPreflight(id, svc);
    return guards.safeDashboardResponse(res, { ok: true, preflight });
  });

  router.post('/agent-executor/action-plans/:id/propose', async (req, res) => {
    const svc = buildServices(req, services);
    const id = guards.validateId(req.params.id);
    if (!id) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_ACTION_PLAN_ID' }, 400);
    const result = await agents.agentExecutorBridge.createProposalFromActionPlan(id, svc);
    return sendResult(res, result);
  });

  router.post('/agent-executor/from-decision/:decisionId', async (req, res) => {
    const result = await agents.agentExecutorBridge.createProposalFromDecision(req.params.decisionId, req.body || {}, buildServices(req, services));
    return sendResult(res, result);
  });

  router.post('/agent-executor/from-council/:sessionId', async (req, res) => {
    const result = await agents.agentExecutorBridge.createProposalFromCouncil(req.params.sessionId, req.body || {}, buildServices(req, services));
    return sendResult(res, result);
  });

  router.post('/agent-executor/from-delegation/:delegationId', async (req, res) => {
    const result = await agents.agentExecutorBridge.createProposalFromDelegation(req.params.delegationId, req.body || {}, buildServices(req, services));
    return sendResult(res, result);
  });

  router.post('/agent-executor/from-task/:taskId', async (req, res) => {
    const result = await agents.agentExecutorBridge.createProposalFromAgentTask(req.params.taskId, req.body || {}, buildServices(req, services));
    return sendResult(res, result);
  });

  router.get('/agent-executor/linked-proposals', async (_req, res) => {
    return guards.safeDashboardResponse(res, { ok: true, items: [] });
  });

  router.get('/agent-executor/results', async (_req, res) => {
    return guards.safeDashboardResponse(res, { ok: true, items: [] });
  });
}

module.exports = {
  registerAgentExecutorRoutes
};
