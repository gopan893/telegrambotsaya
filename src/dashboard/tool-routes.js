'use strict';

const tools = require('../tools');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const workspace = require('../workspace');
const workspaceRoutes = require('./workspace-routes');

function actorFromReq(req, services = {}) {
  return workspaceRoutes.getActorId(req, services);
}

function userFromReq(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '') || '';
}

function workspaceFromReq(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || '').trim();
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: actorFromReq(req, services),
    actorType: 'dashboard',
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

async function requireToolAdmin(req, res, services = {}) {
  const actorId = actorFromReq(req, services);
  const userId = userFromReq(req, services) || actorId;
  const workspaceId = await tools.toolUtils.resolveWorkspaceId(userId, workspaceFromReq(req), buildServices(req, services));
  const summary = await workspace.permissions.getPermissionSummary(actorId, workspaceId, buildServices(req, services));
  if (!['owner', 'admin'].includes(summary.role)) {
    return { ok: false, response: guards.safeDashboardResponse(res, { ok: false, error: 'TOOL_ADMIN_REQUIRED' }, 403) };
  }
  return { ok: true, actorId, userId, workspaceId, actorRole: summary.role };
}

function parseInput(req) {
  return req.body?.input || req.body?.payload || tools.toolUtils.parseToolInput(req.body?.text || req.query?.input || req.query?.q || '');
}

function registerToolRoutes(router, services = {}) {
  router.use(async (req, _res, next) => {
    try {
      await tools.builtinTools.registerBuiltInTools(buildServices(req, services));
    } catch (_) {}
    next();
  });

  router.get('/tools', async (req, res) => {
    const items = await tools.toolRegistry.listTools({
      category: req.query.category || '',
      riskLevel: req.query.riskLevel || '',
      source: req.query.source || '',
      enabled: req.query.enabled || '',
      q: req.query.q || '',
      limit: guards.validateLimit(req.query.limit, 200, 500)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, {
      ok: true,
      summary: await tools.toolRegistry.buildToolRegistrySummary(buildServices(req, services)),
      items: items.map(serializers.sanitizeToolMetadata)
    });
  });

  router.get('/tools/runs', async (req, res) => {
    const items = await tools.toolAudit.listToolRuns({
      toolId: req.query.toolId || '',
      workspaceId: req.query.workspaceId || '',
      status: req.query.status || '',
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeToolRun) });
  });

  router.get('/tools/audit', async (req, res) => {
    const items = await tools.toolAudit.listToolAudit({
      toolId: req.query.toolId || '',
      workspaceId: req.query.workspaceId || '',
      action: req.query.action || '',
      limit: guards.validateLimit(req.query.limit, 50, 100)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, { ok: true, items: items.map(serializers.sanitizeToolAudit) });
  });

  router.get('/tools/:toolId', async (req, res) => {
    const tool = await tools.toolRegistry.getTool(req.params.toolId, buildServices(req, services));
    if (!tool) return guards.safeDashboardResponse(res, { ok: false, error: 'TOOL_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, tool: serializers.sanitizeToolMetadata(tool) });
  });

  router.post('/tools/:toolId/enable', async (req, res) => {
    const access = await requireToolAdmin(req, res, services);
    if (!access.ok) return access.response;
    const result = await tools.toolRegistry.enableTool(req.params.toolId, { ...buildServices(req, services), workspaceId: access.workspaceId });
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, tool: serializers.sanitizeToolMetadata(result.tool) } : { ok: false, error: result.error }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/tools/:toolId/disable', async (req, res) => {
    const access = await requireToolAdmin(req, res, services);
    if (!access.ok) return access.response;
    const result = await tools.toolRegistry.disableTool(req.params.toolId, { ...buildServices(req, services), workspaceId: access.workspaceId });
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, tool: serializers.sanitizeToolMetadata(result.tool) } : { ok: false, error: result.error }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/tools/:toolId/preview', async (req, res) => {
    const userId = userFromReq(req, services);
    const result = await tools.toolRunner.previewToolRun(req.params.toolId, parseInput(req), {
      actorId: actorFromReq(req, services),
      userId,
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, preview: result.preview } : { ok: false, error: result.reason, governance: result.governance }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/tools/:toolId/run', async (req, res) => {
    const userId = userFromReq(req, services);
    const result = await tools.toolRunner.runTool(req.params.toolId, parseInput(req), {
      actorId: actorFromReq(req, services),
      userId,
      workspaceId: workspaceFromReq(req)
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, result: result.result, tool: result.tool } : { ok: false, error: result.reason, requiresApproval: Boolean(result.requiresApproval), governance: result.governance }, result.ok ? 200 : (result.status || 400));
  });

  router.post('/tools/:toolId/propose', async (req, res) => {
    const userId = userFromReq(req, services);
    const result = await tools.toolRunner.buildToolExecutionProposal(req.params.toolId, parseInput(req), {
      actorId: actorFromReq(req, services),
      userId,
      workspaceId: workspaceFromReq(req),
      sourceType: 'dashboard',
      sourceId: req.params.toolId
    }, buildServices(req, services));
    return guards.safeDashboardResponse(res, result.ok ? { ok: true, proposal: serializers.sanitizeExecutionProposal(result.proposal) } : { ok: false, error: result.reason, governance: result.governance }, result.ok ? 200 : (result.status || 400));
  });
}

module.exports = {
  registerToolRoutes
};
