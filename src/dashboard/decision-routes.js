'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const agents = require('../agents');

function getActorId(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function getDecisionServices(req, services = {}) {
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

function registerDecisionRoutes(router, services = {}) {
  router.get('/decisions', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const items = await agents.decisionStore.listDecisionRecords({
      workspaceId: req.query.workspaceId,
      userId: req.query.userId,
      status: req.query.status,
      includeArchived: req.query.includeArchived === 'true',
      limit: guards.validateLimit(req.query.limit, 30, 100)
    }, svc);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/decisions/history', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const items = await agents.decisionStore.searchDecisionHistory(req.query.q || '', svc);
    return guards.safeDashboardResponse(res, { ok: true, items: items.slice(0, guards.validateLimit(req.query.limit, 30, 100)) });
  });

  router.get('/decisions/risk-summary', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const items = await agents.decisionStore.listDecisionRecords({ workspaceId: req.query.workspaceId, limit: 100, includeArchived: true }, svc);
    const counts = items.reduce((acc, item) => {
      const key = item.riskLevel || 'low';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return guards.safeDashboardResponse(res, { ok: true, counts, approvalRequired: items.filter(item => item.approvalRequired).length });
  });

  router.get('/decisions/:decisionId', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const decisionId = guards.validateId(req.params.decisionId);
    if (!decisionId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DECISION_ID' }, 400);
    const decision = await agents.decisionStore.getDecisionRecord(decisionId, svc);
    if (!decision) return guards.safeDashboardResponse(res, { ok: false, error: 'DECISION_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, decision });
  });

  router.post('/decisions/analyze', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const validation = guards.validateTextLength(req.body?.question || req.body?.message || req.body?.text, 1600, 'question');
    if (!validation.ok) return guards.safeDashboardResponse(res, { ok: false, error: validation.error }, 400);
    try {
      const result = await agents.decisionStore.analyzeDecision({
        workspaceId: svc.workspaceId,
        userId: svc.userId,
        chatId: req.body?.chatId || '',
        source: 'dashboard',
        question: validation.value,
        topics: req.body?.topics || []
      }, svc);
      return guards.safeDashboardResponse(res, result);
    } catch (err) {
      return guards.safeDashboardResponse(res, { ok: false, error: err.code || err.message }, err.code === 'DECISION_SECRET_REJECTED' ? 400 : 500);
    }
  });

  router.post('/decisions/:decisionId/status', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const decisionId = guards.validateId(req.params.decisionId);
    if (!decisionId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DECISION_ID' }, 400);
    const decision = await agents.decisionStore.updateDecisionStatus(decisionId, req.body?.status || 'deferred', { actorId: getActorId(req, services) }, svc);
    return guards.safeDashboardResponse(res, { ok: true, decision });
  });

  router.post('/decisions/:decisionId/archive', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const decisionId = guards.validateId(req.params.decisionId);
    if (!decisionId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_DECISION_ID' }, 400);
    const decision = await agents.decisionStore.archiveDecision(decisionId, { actorId: getActorId(req, services) }, svc);
    return guards.safeDashboardResponse(res, { ok: true, decision });
  });

  router.post('/decisions/:decisionId/link-goal', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const decision = await agents.decisionStore.linkDecisionToGoal(req.params.decisionId, req.body?.goalId || '', svc);
    return guards.safeDashboardResponse(res, { ok: true, decision });
  });

  router.post('/decisions/:decisionId/link-plan', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const decision = await agents.decisionStore.linkDecisionToPlanner(req.params.decisionId, req.body?.planId || '', svc);
    return guards.safeDashboardResponse(res, { ok: true, decision });
  });

  router.post('/decisions/router-test', async (req, res) => {
    const svc = getDecisionServices(req, services);
    const text = String(req.body?.message || req.body?.text || '');
    const route = agents.agentRouter.routeMessage(text, { forceMode: 'natural_smart', groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 } }, svc);
    const decision = agents.decisionDetector.shouldTriggerDecisionSystem(text, route, {}, {}, svc);
    return guards.safeDashboardResponse(res, { ok: true, route, decision });
  });
}

module.exports = {
  registerDecisionRoutes
};
