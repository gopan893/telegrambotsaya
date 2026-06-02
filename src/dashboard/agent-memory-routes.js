'use strict';

const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const serializers = require('./dashboard-serializers');
const multibot = require('../multibot');
const agents = require('../agents');

function getActor(req, services = {}) {
  return {
    actorId: String(req.body?.actorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || 'dashboard-admin'),
    userId: String(req.body?.userId || req.query?.userId || services.env?.OWNER_CHAT_ID || 'dashboard-admin'),
    workspaceId: String(req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default')
  };
}

function getAgentServices(req, services = {}) {
  const actor = getActor(req, services);
  return {
    ...services,
    ...actor,
    actorType: 'dashboard',
    botRegistry: multibot.botRegistry,
    auditLog: services.auditLog || auditLog
  };
}

function fail(res, error, code = 400) {
  return guards.safeDashboardResponse(res, {
    ok: false,
    error: error.code || error.message || String(error)
  }, code);
}

function registerAgentMemoryRoutes(router, services = {}) {
  router.get('/agents/profiles', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const items = await agents.agentProfileStore.listAgentProfiles(agentServices);
      return guards.safeDashboardResponse(res, { items: items.map(serializers.sanitizeAgentProfile) });
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.get('/agents/shared-memory', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const items = await agents.agentMemoryStore.listSharedAgentMemories({
        workspaceId: req.query.workspaceId || agentServices.workspaceId,
        limit: req.query.limit || 20,
        includeArchived: req.query.includeArchived === 'true'
      }, agentServices);
      return guards.safeDashboardResponse(res, { items: items.map(serializers.sanitizeAgentMemory) });
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.post('/agents/shared-memory/create', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.agentMemoryStore.createSharedAgentMemory({
        ...req.body,
        workspaceId: req.body?.workspaceId || agentServices.workspaceId,
        userId: req.body?.userId || agentServices.userId,
        createdBy: agentServices.actorId
      }, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentMemory(item));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.get('/agents/:agentId/profile', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const profile = await agents.agentProfileStore.getAgentProfile(req.params.agentId, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentProfile(profile));
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.post('/agents/:agentId/profile/update', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const profile = await agents.agentProfileStore.updateAgentProfile(req.params.agentId, req.body || {}, getActor(req, services), agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentProfile(profile));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.get('/agents/:agentId/memory', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const items = await agents.agentMemoryStore.listAgentMemories({
        agentId: req.params.agentId,
        workspaceId: req.query.workspaceId || agentServices.workspaceId,
        userId: req.query.userId || agentServices.userId,
        type: req.query.type,
        limit: guards.validateLimit(req.query.limit, 20, 100),
        includeArchived: req.query.includeArchived === 'true'
      }, agentServices);
      return guards.safeDashboardResponse(res, { items: items.map(serializers.sanitizeAgentMemory) });
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.post('/agents/:agentId/memory/create', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.agentMemoryStore.createAgentMemory({
        ...req.body,
        agentId: req.params.agentId,
        workspaceId: req.body?.workspaceId || agentServices.workspaceId,
        userId: req.body?.userId || agentServices.userId,
        createdBy: agentServices.actorId
      }, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentMemory(item));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.post('/agents/:agentId/memory/:memoryId/update', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.agentMemoryStore.updateAgentMemory(req.params.memoryId, req.body || {}, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentMemory(item));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.post('/agents/:agentId/memory/:memoryId/archive', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.agentMemoryStore.archiveAgentMemory(req.params.memoryId, getActor(req, services), agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentMemory(item));
    } catch (err) {
      return fail(res, err, 400);
    }
  });

  router.post('/agents/:agentId/memory/:memoryId/restore', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.agentMemoryStore.restoreAgentMemory(req.params.memoryId, getActor(req, services), agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentMemory(item));
    } catch (err) {
      return fail(res, err, 400);
    }
  });

  router.get('/agents/:agentId/preferences', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const prefs = await agents.agentPreferences.getAgentPreferences(req.params.agentId, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentPreferences(prefs));
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.post('/agents/:agentId/preferences/update', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const prefs = await agents.agentPreferences.updateAgentPreferences(req.params.agentId, req.body || {}, getActor(req, services), agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentPreferences(prefs));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.get('/agents/:agentId/learning-notes', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const items = await agents.learningNotes.listLearningNotes({
        agentId: req.params.agentId,
        workspaceId: req.query.workspaceId || agentServices.workspaceId,
        userId: req.query.userId || agentServices.userId,
        limit: guards.validateLimit(req.query.limit, 20, 100),
        includeArchived: req.query.includeArchived === 'true'
      }, agentServices);
      return guards.safeDashboardResponse(res, { items: items.map(serializers.sanitizeAgentLearningNote) });
    } catch (err) {
      return fail(res, err, 500);
    }
  });

  router.post('/agents/:agentId/learning-notes/create', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const item = await agents.learningNotes.createLearningNote({
        ...req.body,
        agentId: req.params.agentId,
        workspaceId: req.body?.workspaceId || agentServices.workspaceId,
        userId: req.body?.userId || agentServices.userId,
        createdBy: agentServices.actorId
      }, agentServices);
      return guards.safeDashboardResponse(res, serializers.sanitizeAgentLearningNote(item));
    } catch (err) {
      return fail(res, err, err.code === 'AGENT_MEMORY_SECRET_REJECTED' ? 422 : 400);
    }
  });

  router.post('/agents/router/test-with-memory', async (req, res) => {
    try {
      const agentServices = getAgentServices(req, services);
      const message = String(req.body?.message || req.body?.text || '');
      const route = agents.agentRouter.routeMessage(message, {
        forceMode: req.body?.mode || undefined,
        groupSettings: {
          mode: req.body?.mode || 'natural_smart',
          maxAutoAgents: req.body?.maxAutoAgents || 3
        },
        userId: agentServices.userId,
        workspaceId: agentServices.workspaceId
      }, agentServices);
      const selected = [];
      for (const agentId of route.selectedAgents || []) {
        const composed = await agents.agentPromptComposer.composeAgentFinalPrompt(agentId, message, {
          topics: route.topics || [],
          risk: route.risk,
          riskLevel: route.risk?.level || 'low',
          workspaceId: agentServices.workspaceId,
          userId: agentServices.userId
        }, agentServices);
        selected.push(serializers.sanitizeAgentPromptPreview({
          agentId,
          workspaceId: composed.workspaceId,
          selectedMemoryCount: (composed.selectedMemories || []).length,
          sharedMemoryCount: (composed.sharedMemories || []).length,
          selectedMemories: composed.selectedMemories,
          sharedMemories: composed.sharedMemories,
          memoryExplanation: composed.memoryExplanation,
          promptPreview: composed.promptPreview
        }));
      }
      return guards.safeDashboardResponse(res, {
        route: serializers.sanitizeAgentRoutingResult(route),
        agents: selected
      });
    } catch (err) {
      return fail(res, err, 500);
    }
  });
}

module.exports = {
  registerAgentMemoryRoutes
};
