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

function registerEvaluationRoutes(router, services = {}) {
  router.get('/agent-evaluation/cases', async (req, res) => {
    const items = await agents.agentEvaluationV2.suite.listEvaluationCases({
      category: req.query.category,
      id: req.query.id
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.post('/agent-evaluation/cases/create', async (req, res) => {
    try {
      const item = await agents.agentEvaluationV2.suite.createEvaluationCase(req.body || {}, buildServices(req, services));
      return guards.safeDashboardResponse(res, { ok: true, item });
    } catch (err) {
      return guards.safeDashboardResponse(res, { ok: false, error: err.code || err.message }, 400);
    }
  });

  router.post('/agent-evaluation/run', async (req, res) => {
    const caseId = guards.validateId(req.body?.caseId || req.query?.caseId || '');
    if (!caseId) return guards.safeDashboardResponse(res, { ok: false, error: 'CASE_ID_REQUIRED' }, 400);
    const result = await agents.agentEvaluationV2.suite.runEvaluationCase(caseId, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok === false ? result : { ok: true, result }, result.ok === false ? 404 : 200);
  });

  router.post('/agent-evaluation/run-suite', async (req, res) => {
    const result = await agents.agentEvaluationV2.suite.runEvaluationSuite({
      category: req.body?.category || '',
      suiteName: req.body?.suiteName || 'agent-evaluation-v2',
      limit: guards.validateLimit(req.body?.limit, 50, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result);
  });

  router.get('/agent-evaluation/runs', async (req, res) => {
    const items = await agents.agentEvaluationV2.suite.listEvaluationRuns({
      limit: guards.validateLimit(req.query.limit, 20, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/agent-evaluation/runs/:runId', async (req, res) => {
    const run = await agents.agentEvaluationV2.suite.getEvaluationRun(req.params.runId, buildServices(req, services));
    return guards.safeDashboardResponse(res, run ? { ok: true, run } : { ok: false, error: 'RUN_NOT_FOUND' }, run ? 200 : 404);
  });

  router.get('/agent-evaluation/latest', async (req, res) => {
    const latest = await agents.agentEvaluationV2.suite.getLatestEvaluationRun(buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, latest });
  });

  router.get('/agent-evaluation/compare', async (req, res) => {
    const runs = await agents.agentEvaluationV2.suite.listEvaluationRuns({ limit: 2 }, buildServices(req, services));
    const compare = agents.agentEvaluationV2.regression.compareRuns(runs[0], runs[1]);
    return guards.safeDashboardResponse(res, { ok: true, compare, runs });
  });

  router.get('/agent-evaluation/quality-gates', async (req, res) => {
    const latest = await agents.agentEvaluationV2.suite.getLatestEvaluationRun(buildServices(req, services));
    const qualityGates = latest?.qualityGates || agents.agentEvaluationV2.qualityGates.evaluateQualityGates(latest || {});
    return guards.safeDashboardResponse(res, { ok: true, qualityGates, latestRunId: latest?.id || '' });
  });
}

module.exports = {
  buildServices,
  registerEvaluationRoutes
};
