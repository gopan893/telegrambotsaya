'use strict';

const guards = require('./dashboard-guards');
const integrations = require('../integrations');

function actorFromReq(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function buildServices(req, services = {}) {
  const actorId = actorFromReq(req, services);
  return {
    ...services,
    actorId,
    actorType: 'dashboard',
    actorRole: req.body?.actorRole || req.query?.actorRole || 'owner',
    workspaceId: req.body?.workspaceId || req.query?.workspaceId || 'default',
    userId: req.body?.userId || req.query?.userId || actorId,
    auditLog: services.auditLog || require('./audit-log')
  };
}

function bodyAction(req) {
  return {
    connectorId: req.body?.connectorId || req.query?.connectorId || '',
    action: req.body?.action || req.query?.action || '',
    payload: req.body?.payload || {},
    context: req.body?.context || {}
  };
}

function registerIntegrationExecutionRoutes(router, services = {}) {
  router.post('/integrations/execute', async (req, res) => {
    const svc = buildServices(req, services);
    const input = bodyAction(req);
    const connector = integrations.connectorExecutor.getConnector(input.connectorId);
    const metadata = connector?.actionMetadata?.(input.action);
    if (!metadata?.readOnly) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'EXECUTE_READ_ONLY_ONLY' }, 400);
    }
    const result = await integrations.connectorExecutor.executeConnectorAction(input.connectorId, input.action, input.payload, {
      ...input.context,
      workspaceId: svc.workspaceId,
      userId: svc.userId,
      actorId: svc.actorId,
      actorRole: svc.actorRole
    }, svc);
    return guards.safeDashboardResponse(res, result, result.ok === false ? (result.status || 400) : 200);
  });

  router.post('/integrations/dry-run', async (req, res) => {
    const svc = buildServices(req, services);
    const input = bodyAction(req);
    const result = await integrations.connectorExecutor.runConnectorDryRun(input.connectorId, input.action, input.payload, {
      ...input.context,
      workspaceId: svc.workspaceId,
      userId: svc.userId,
      actorId: svc.actorId,
      actorRole: svc.actorRole
    }, svc);
    return guards.safeDashboardResponse(res, result, result.ok === false ? 400 : 200);
  });

  router.post('/integrations/propose', async (req, res) => {
    const svc = buildServices(req, services);
    const input = bodyAction(req);
    const result = await integrations.connectorExecutor.executeConnectorAction(input.connectorId, input.action, input.payload, {
      ...input.context,
      workspaceId: svc.workspaceId,
      userId: svc.userId,
      actorId: svc.actorId,
      actorRole: svc.actorRole
    }, svc);
    return guards.safeDashboardResponse(res, result, result.ok === false ? (result.status || 400) : 200);
  });

  router.post('/integrations/pipeline/create', async (req, res) => {
    const result = await integrations.proposalPipeline.createIntegrationProposalPipeline({
      connectorId: req.body?.connectorId,
      action: req.body?.action,
      payload: req.body?.payload || {},
      context: {
        ...req.body?.context,
        workspaceId: req.body?.workspaceId,
        userId: req.body?.userId,
        actorId: actorFromReq(req, services),
        actorRole: req.body?.actorRole || 'owner'
      }
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? (result.status || 400) : 200);
  });

  router.get('/integrations/pipeline/:id', async (req, res) => {
    const result = await integrations.proposalPipeline.getPipelineStatus(req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? 404 : 200);
  });

  router.post('/integrations/pipeline/:id/preflight', async (req, res) => {
    const result = await integrations.proposalPipeline.runIntegrationPreflight(req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? 400 : 200);
  });

  router.post('/integrations/pipeline/:id/dry-run', async (req, res) => {
    const result = await integrations.proposalPipeline.runIntegrationDryRun(req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? 400 : 200);
  });

  router.post('/integrations/pipeline/:id/evaluate', async (req, res) => {
    const result = await integrations.proposalPipeline.runIntegrationEvaluationGate(req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? 400 : 200);
  });

  router.post('/integrations/pipeline/:id/create-proposal', async (req, res) => {
    const result = await integrations.proposalPipeline.createExecutorProposalAfterGate(req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, result, result.ok === false ? (result.status || 400) : 200);
  });

  router.get('/integrations/executions', async (req, res) => {
    const items = await integrations.connectorStore.listIntegrationItems(integrations.connectorStore.INTEGRATION_EXECUTIONS_KEY, {
      connectorId: req.query.connectorId,
      status: req.query.status,
      limit: guards.validateLimit(req.query.limit, 30, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items });
  });

  router.get('/integrations/executions/:id', async (req, res) => {
    const item = await integrations.connectorStore.getIntegrationItem(integrations.connectorStore.INTEGRATION_EXECUTIONS_KEY, req.params.id, buildServices(req, services));
    return guards.safeDashboardResponse(res, item ? { ok: true, item } : { ok: false, error: 'EXECUTION_NOT_FOUND' }, item ? 200 : 404);
  });

  router.get('/integrations/connectors/:id/quality', async (req, res) => {
    const status = integrations.connectorQualityGates.getConnectorQualityStatus(req.params.id, {
      ...buildServices(req, services),
      integrationConnectors: integrations.connectorExecutor
    });
    return guards.safeDashboardResponse(res, { ok: true, status });
  });

  router.post('/integrations/connectors/:id/run-quality-gate', async (req, res) => {
    const result = await integrations.connectorQualityGates.runIntegrationQualityGate(req.params.id, {
      ...buildServices(req, services),
      integrationConnectors: integrations.connectorExecutor
    });
    return guards.safeDashboardResponse(res, result);
  });

  router.get('/integrations/connectors/:id/rate-limit', async (req, res) => {
    const svc = buildServices(req, services);
    const status = await integrations.connectorRateLimit.getConnectorRateLimitStatus(req.params.id, req.query.action || 'status', svc.userId, svc.workspaceId, svc, { mode: req.query.mode });
    return guards.safeDashboardResponse(res, { ok: true, status });
  });
}

module.exports = {
  buildServices,
  registerIntegrationExecutionRoutes
};
