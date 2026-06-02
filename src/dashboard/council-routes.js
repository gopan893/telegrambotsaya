'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const agents = require('../agents');

function getActorId(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function getCouncilServices(req, services = {}) {
  const actorId = getActorId(req, services);
  return {
    ...services,
    actorId,
    actorType: 'dashboard',
    workspaceId: req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default',
    userId: req.body?.userId || req.query?.userId || actorId,
    agentMemoryStore: agents.agentMemoryStore,
    auditLog
  };
}

async function auditCouncilDashboard(action, req, summary = {}, services = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: 'dashboard',
      actorId: getActorId(req, services),
      action,
      targetType: 'agent_council',
      targetId: summary.sessionId || summary.targetId || '',
      workspaceId: summary.workspaceId || req.body?.workspaceId || req.query?.workspaceId || 'default',
      userId: summary.userId || req.body?.userId || req.query?.userId || '',
      decision: summary.decision || 'allowed',
      status: summary.status || 'ok',
      afterSummary: guards.preventSecretLeak(summary)
    }, services);
  } catch (_) {}
}

async function runCouncilFromBody(req, res, services, mode) {
  const textValidation = guards.validateTextLength(req.body?.topic || req.body?.message || req.body?.text, 1600, 'topic');
  if (!textValidation.ok) return guards.safeDashboardResponse(res, { ok: false, error: textValidation.error }, 400);
  const councilServices = getCouncilServices(req, services);
  const route = agents.agentRouter.routeMessage(textValidation.value, {
    forceMode: mode,
    userId: councilServices.userId,
    groupSettings: { mode, maxAutoAgents: 5 }
  }, councilServices);
  const result = await agents.councilEngine.runCouncil({
    workspaceId: councilServices.workspaceId,
    userId: councilServices.userId,
    chatId: req.body?.chatId || '',
    source: 'dashboard',
    mode,
    topic: textValidation.value,
    originalMessage: textValidation.value,
    routerPolicy: route,
    riskLevel: route.risk?.level || 'low',
    approvalRequired: route.approvalRequired
  }, councilServices);
  await auditCouncilDashboard(`agents/council_${mode}_dashboard_run`, req, {
    sessionId: result.session?.id || result.sessionId,
    workspaceId: councilServices.workspaceId,
    userId: councilServices.userId,
    mode,
    riskLevel: result.riskReview?.riskLevel || result.session?.riskLevel
  }, services);
  return guards.safeDashboardResponse(res, { ok: true, ...result });
}

function registerCouncilRoutes(router, services = {}) {
  router.get('/council', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const sessions = await agents.councilEngine.listSessions({ limit: req.query.limit || 20, workspaceId: req.query.workspaceId }, councilServices);
    const summaries = await agents.councilEngine.listSummaries({ limit: 5, workspaceId: req.query.workspaceId }, councilServices);
    return guards.safeDashboardResponse(res, {
      ok: true,
      status: 'available',
      sessions,
      summaries,
      modes: ['quick_council', 'deep_council', 'debate', 'risk_review', 'decision_review', 'coding_review', 'planning_review']
    });
  });

  router.get('/council/sessions', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const sessions = await agents.councilEngine.listSessions({
      limit: guards.validateLimit(req.query.limit, 30, 100),
      workspaceId: req.query.workspaceId,
      source: req.query.source,
      mode: req.query.mode
    }, councilServices);
    return guards.safeDashboardResponse(res, { ok: true, items: sessions });
  });

  router.get('/council/sessions/:sessionId', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const sessionId = guards.validateId(req.params.sessionId);
    if (!sessionId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_SESSION_ID' }, 400);
    const session = await agents.councilEngine.getSession(sessionId, councilServices);
    if (!session) return guards.safeDashboardResponse(res, { ok: false, error: 'COUNCIL_SESSION_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, session });
  });

  router.post('/council/run', (req, res) => runCouncilFromBody(req, res, services, req.body?.mode || 'quick_council'));
  router.post('/council/debate', (req, res) => runCouncilFromBody(req, res, services, 'debate'));
  router.post('/council/risk-review', (req, res) => runCouncilFromBody(req, res, services, 'risk_review'));
  router.post('/council/decision-review', (req, res) => runCouncilFromBody(req, res, services, 'decision_review'));

  router.post('/council/sessions/:sessionId/cancel', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const sessionId = guards.validateId(req.params.sessionId);
    if (!sessionId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_SESSION_ID' }, 400);
    const session = await agents.councilEngine.cancelCouncilSession(sessionId, { actorId: getActorId(req, services) }, councilServices);
    await auditCouncilDashboard('agents/council_session_cancelled_dashboard', req, {
      sessionId,
      workspaceId: session.workspaceId,
      userId: session.userId
    }, services);
    return guards.safeDashboardResponse(res, { ok: true, session });
  });

  router.get('/council/summaries', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const items = await agents.councilEngine.listSummaries({
      limit: guards.validateLimit(req.query.limit, 30, 100),
      workspaceId: req.query.workspaceId
    }, councilServices);
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.post('/council/router-test', async (req, res) => {
    const councilServices = getCouncilServices(req, services);
    const text = String(req.body?.message || req.body?.text || '');
    const route = agents.agentRouter.routeMessage(text, {
      forceMode: req.body?.mode || 'natural_smart',
      groupSettings: { mode: req.body?.mode || 'natural_smart', maxAutoAgents: 5 }
    }, councilServices);
    const council = agents.councilEngine.shouldTriggerCouncil(text, {
      source: req.body?.source || 'natural_chat',
      userId: councilServices.userId,
      workspaceId: councilServices.workspaceId,
      mode: req.body?.mode
    }, route, councilServices);
    await auditCouncilDashboard('agents/council_router_tested', req, {
      workspaceId: councilServices.workspaceId,
      userId: councilServices.userId,
      route,
      council
    }, services);
    return guards.safeDashboardResponse(res, { ok: true, route, council });
  });
}

module.exports = {
  registerCouncilRoutes
};
