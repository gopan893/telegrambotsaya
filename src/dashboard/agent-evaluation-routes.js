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
    workspaceId: req.body?.workspaceId || req.query?.workspaceId || 'default',
    userId: req.body?.userId || req.query?.userId || actorId,
    auditLog: services.auditLog || require('./audit-log')
  };
}

function registerAgentEvaluationRoutes(router, services = {}) {
  router.get('/agent-evaluation/cases', async (req, res) => {
    const items = await agents.agentEvaluationHarness.listEvaluationCases({
      category: req.query.category,
      id: req.query.id
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.post('/agent-evaluation/run', async (req, res) => {
    const caseId = guards.validateId(req.body?.caseId || req.query?.caseId || '');
    if (!caseId) return guards.safeDashboardResponse(res, { ok: false, error: 'CASE_ID_REQUIRED' }, 400);
    const result = await agents.agentEvaluationHarness.runEvaluationCase(caseId, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok === false ? result : { ok: true, result }, result.ok === false ? 404 : 200);
  });

  router.post('/agent-evaluation/run-suite', async (req, res) => {
    const result = await agents.agentEvaluationHarness.runEvaluationSuite({
      category: req.body?.category || '',
      limit: guards.validateLimit(req.body?.limit, 30, 50)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result);
  });

  router.get('/agent-evaluation/runs', async (req, res) => {
    const items = await agents.agentEvaluationHarness.listEvaluationRuns({
      limit: guards.validateLimit(req.query.limit, 20, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/agent-evaluation/latest', async (req, res) => {
    const latest = await agents.agentEvaluationHarness.getLatestEvaluationRun(buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, latest });
  });
}

module.exports = {
  registerAgentEvaluationRoutes
};
