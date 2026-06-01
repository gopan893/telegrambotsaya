'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const serializers = require('./dashboard-serializers');
const multibot = require('../multibot');
const agents = require('../agents');

function getActorId(req, services = {}) {
  return String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin');
}

function getAgentServices(services = {}) {
  return {
    ...services,
    botRegistry: multibot.botRegistry,
    auditLog
  };
}

async function auditAgentAction(action, req, summary, services = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: 'dashboard',
      actorId: getActorId(req, services),
      action,
      targetType: 'agents',
      targetId: summary?.targetId || '',
      workspaceId: summary?.workspaceId || req.body?.workspaceId || req.query?.workspaceId || '',
      status: summary?.status || 'ok',
      decision: summary?.decision || 'allowed',
      afterSummary: guards.preventSecretLeak(summary || {})
    }, services);
  } catch (_) {}
}

function registerAgentRoutes(router, services = {}) {
  const agentServices = getAgentServices(services);

  router.get('/bots', (req, res) => {
    multibot.botRegistry.loadBotConfigs(services.env || process.env);
    return guards.safeDashboardResponse(res, {
      items: multibot.botRegistry.listBotConfigsSafe(services.env || process.env)
    });
  });

  router.get('/bots/status', (req, res) => {
    multibot.botRegistry.loadBotConfigs(services.env || process.env);
    return guards.safeDashboardResponse(res, multibot.botRegistry.buildBotStatusSummary(services.env || process.env));
  });

  router.get('/bots/:botId', (req, res) => {
    multibot.botRegistry.loadBotConfigs(services.env || process.env);
    const bot = multibot.botRegistry.getBotConfig(req.params.botId, services.env || process.env);
    if (!bot) return guards.safeDashboardResponse(res, { ok: false, error: 'BOT_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, serializers.sanitizeBotConfig(bot));
  });

  router.get('/agents', (req, res) => {
    const items = agents.agentRegistry.listAgents({}, agentServices).map(serializers.sanitizeAgentSummary);
    return guards.safeDashboardResponse(res, { items });
  });

  router.get('/agents/router/status', async (req, res) => {
    const groupSettings = req.query.chatId
      ? await agents.conversationBus.getGroupSettings(req.query.chatId, agentServices)
      : null;
    return guards.safeDashboardResponse(res, {
      mode: groupSettings?.mode || 'natural_smart',
      maxAutoAgents: groupSettings?.maxAutoAgents || 3,
      multiBot: multibot.botRegistry.buildBotStatusSummary(services.env || process.env),
      agents: agents.agentRegistry.listAgents({}, agentServices).map(serializers.sanitizeAgentSummary)
    });
  });

  router.post('/agents/router/test', async (req, res) => {
    const sample = String(req.body?.message || req.body?.text || '');
    const route = agents.agentRouter.routeMessage(sample, {
      forceMode: req.body?.mode || undefined,
      groupSettings: {
        mode: req.body?.mode || 'natural_smart',
        maxAutoAgents: req.body?.maxAutoAgents || 3
      }
    }, agentServices);
    await auditAgentAction('agents/router_tested', req, {
      targetId: 'router',
      status: 'ok',
      decision: 'allowed',
      route
    }, services);
    return guards.safeDashboardResponse(res, serializers.sanitizeAgentRoutingResult(route));
  });

  router.get('/agents/activity', async (req, res) => {
    const items = await agents.conversationBus.listAgentActivity({ limit: req.query.limit || 30 }, agentServices);
    return guards.safeDashboardResponse(res, { items: items.map(serializers.sanitizeAgentActivity) });
  });

  router.get('/agents/group-settings', async (req, res) => {
    const chatId = String(req.query.chatId || 'default');
    const settings = await agents.conversationBus.getGroupSettings(chatId, agentServices);
    return guards.safeDashboardResponse(res, serializers.sanitizeAgentGroupSettings(settings));
  });

  router.post('/agents/group-settings/update', async (req, res) => {
    const chatId = String(req.body?.chatId || 'default');
    const settings = await agents.conversationBus.setGroupSettings(chatId, {
      mode: req.body?.mode,
      maxAutoAgents: req.body?.maxAutoAgents,
      allowAllAgents: req.body?.allowAllAgents,
      orchestratorBotId: req.body?.orchestratorBotId,
      updatedBy: getActorId(req, services)
    }, agentServices);
    await auditAgentAction('agents/group_mode_changed', req, {
      targetId: chatId,
      chatId,
      mode: settings.mode,
      maxAutoAgents: settings.maxAutoAgents
    }, services);
    return guards.safeDashboardResponse(res, serializers.sanitizeAgentGroupSettings(settings));
  });

  router.get('/agents/:agentId', (req, res) => {
    const agent = agents.agentRegistry.getAgent(req.params.agentId, agentServices);
    if (!agent) return guards.safeDashboardResponse(res, { ok: false, error: 'AGENT_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, serializers.sanitizeAgentSummary(agent));
  });
}

module.exports = {
  registerAgentRoutes
};
