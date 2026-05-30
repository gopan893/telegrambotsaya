'use strict';

const { createId, normalizeLimit } = require('./postgres-repositories/repository-utils');

const KEYS = {
  users: 'rel_users',
  memories: 'rel_memories',
  goals: 'rel_goals',
  workflows: 'rel_workflows',
  workflowSteps: 'rel_workflow_steps',
  insights: 'rel_insights',
  graphNodes: 'rel_graph_nodes',
  graphEdges: 'rel_graph_edges',
  telemetryEvents: 'rel_telemetry_events',
  incidents: 'rel_incidents'
};

function createJsonRepositories({ loadData, saveData }) {
  async function loadArray(key) {
    const value = await loadData(key, []);
    return Array.isArray(value) ? value : [];
  }

  async function saveArray(key, items) {
    return saveData(key, Array.isArray(items) ? items : []);
  }

  async function ensureUser(userId) {
    const users = await loadArray(KEYS.users);
    const id = String(userId || '');
    let user = users.find(item => item.id === id);
    if (!user) {
      user = { id, telegramUserId: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
      users.push(user);
    } else {
      user.lastSeenAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
    await saveArray(KEYS.users, users);
    return user;
  }

  async function upsertById(key, record) {
    const items = await loadArray(key);
    const now = new Date().toISOString();
    const id = record.id || createId(key.replace(/^rel_/, ''));
    const next = { ...record, id, updatedAt: now, createdAt: record.createdAt || now };
    const index = items.findIndex(item => item.id === id);
    if (index >= 0) items[index] = { ...items[index], ...next };
    else items.push(next);
    await saveArray(key, items.slice(-1000));
    return next;
  }

  function userFilter(userId) {
    return item => String(item.userId || item.user_id || '') === String(userId) && !item.deletedAt && !item.deleted_at;
  }

  const users = {
    async upsertTelegramUser(user = {}) {
      return upsertById(KEYS.users, {
        id: String(user.userId || user.id || user.telegramUserId || ''),
        telegramUserId: String(user.telegramUserId || user.id || ''),
        chatId: user.chatId || null,
        username: user.username || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        role: user.role || 'user',
        settings: user.settings || {},
        lastSeenAt: new Date().toISOString()
      });
    },
    async getUserByTelegramId(telegramUserId) {
      return (await loadArray(KEYS.users)).find(item => String(item.telegramUserId) === String(telegramUserId)) || null;
    },
    async getUserById(userId) {
      return (await loadArray(KEYS.users)).find(item => String(item.id) === String(userId)) || null;
    },
    async updateLastSeen(userId) {
      return ensureUser(userId);
    },
    async updateUserSettings(userId, settings = {}) {
      const user = await ensureUser(userId);
      return upsertById(KEYS.users, { ...user, settings });
    },
    async ensureUserFromTelegram(msg = {}) {
      return users.upsertTelegramUser({
        id: msg.from?.id,
        telegramUserId: msg.from?.id,
        chatId: msg.chat?.id,
        username: msg.from?.username,
        firstName: msg.from?.first_name,
        lastName: msg.from?.last_name
      });
    }
  };

  const memories = {
    async createMemory(memory = {}) {
      await ensureUser(memory.userId || memory.user_id);
      return upsertById(KEYS.memories, {
        ...memory,
        userId: String(memory.userId || memory.user_id),
        type: memory.type || 'semantic',
        content: memory.content || memory.text || ''
      });
    },
    async getMemoryById(userId, memoryId) {
      return (await loadArray(KEYS.memories)).find(item => userFilter(userId)(item) && item.id === memoryId) || null;
    },
    async searchMemories(userId, query = '', options = {}) {
      const q = String(query || '').toLowerCase();
      return (await loadArray(KEYS.memories))
        .filter(userFilter(userId))
        .filter(item => !q || `${item.content || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(q))
        .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
        .slice(0, normalizeLimit(options.limit || options.topK, 5, 20));
    },
    async listMemories(userId, options = {}) {
      return (await loadArray(KEYS.memories)).filter(userFilter(userId)).slice(0, normalizeLimit(options.limit, 10, 20));
    },
    async updateMemory(userId, memoryId, patch = {}) {
      const items = await loadArray(KEYS.memories);
      const index = items.findIndex(item => userFilter(userId)(item) && item.id === memoryId);
      if (index < 0) return null;
      items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
      await saveArray(KEYS.memories, items);
      return items[index];
    },
    async softDeleteMemory(userId, memoryId) {
      const updated = await memories.updateMemory(userId, memoryId, { deletedAt: new Date().toISOString() });
      return { ok: Boolean(updated), id: memoryId };
    },
    async cleanupStaleMemories() {
      return { ok: true, count: 0 };
    }
  };

  const goals = {
    async createGoal(goal = {}) {
      await ensureUser(goal.userId || goal.user_id);
      return upsertById(KEYS.goals, { ...goal, userId: String(goal.userId || goal.user_id), status: goal.status || 'active' });
    },
    async listGoals(userId, options = {}) {
      const status = options.status || null;
      return (await loadArray(KEYS.goals)).filter(userFilter(userId)).filter(item => !status || item.status === status).slice(0, normalizeLimit(options.limit, 20, 50));
    },
    async getGoalById(userId, goalId) {
      return (await loadArray(KEYS.goals)).find(item => userFilter(userId)(item) && item.id === goalId) || null;
    },
    async updateGoal(userId, goalId, patch = {}) {
      const items = await loadArray(KEYS.goals);
      const index = items.findIndex(item => userFilter(userId)(item) && item.id === goalId);
      if (index < 0) return null;
      items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
      await saveArray(KEYS.goals, items);
      return items[index];
    },
    async softDeleteGoal(userId, goalId) {
      const updated = await goals.updateGoal(userId, goalId, { deletedAt: new Date().toISOString() });
      return { ok: Boolean(updated), id: goalId };
    },
    async completeGoal(userId, goalId) {
      return goals.updateGoal(userId, goalId, { status: 'completed', progress: 100, completedAt: new Date().toISOString() });
    }
  };

  const workflows = {
    async createWorkflow(workflow = {}) {
      await ensureUser(workflow.userId || workflow.user_id);
      return upsertById(KEYS.workflows, { ...workflow, userId: String(workflow.userId || workflow.user_id), status: workflow.status || 'active' });
    },
    async listWorkflows(userId, options = {}) {
      const status = options.status || null;
      return (await loadArray(KEYS.workflows)).filter(userFilter(userId)).filter(item => !status || item.status === status).slice(0, normalizeLimit(options.limit, 20, 100));
    },
    async getWorkflowById(userId, workflowId) {
      return (await loadArray(KEYS.workflows)).find(item => userFilter(userId)(item) && item.id === workflowId) || null;
    },
    async updateWorkflow(userId, workflowId, patch = {}) {
      const items = await loadArray(KEYS.workflows);
      const index = items.findIndex(item => userFilter(userId)(item) && item.id === workflowId);
      if (index < 0) return null;
      items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
      await saveArray(KEYS.workflows, items);
      return items[index];
    },
    async addWorkflowStep(step = {}) {
      await ensureUser(step.userId || step.user_id);
      return upsertById(KEYS.workflowSteps, { ...step, userId: String(step.userId || step.user_id), workflowId: String(step.workflowId || step.workflow_id), status: step.status || 'pending' });
    },
    async listWorkflowSteps(userId, workflowId) {
      return (await loadArray(KEYS.workflowSteps)).filter(item => userFilter(userId)(item) && String(item.workflowId || item.workflow_id) === String(workflowId));
    },
    async completeWorkflowStep(userId, workflowId, stepNumber) {
      const items = await loadArray(KEYS.workflowSteps);
      const index = items.findIndex(item => userFilter(userId)(item) && String(item.workflowId || item.workflow_id) === String(workflowId) && Number(item.stepNumber || item.step_number) === Number(stepNumber));
      if (index < 0) return null;
      items[index] = { ...items[index], status: 'done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveArray(KEYS.workflowSteps, items);
      return items[index];
    },
    async softDeleteWorkflow(userId, workflowId) {
      const updated = await workflows.updateWorkflow(userId, workflowId, { deletedAt: new Date().toISOString() });
      return { ok: Boolean(updated), id: workflowId };
    }
  };

  const graph = {
    async upsertNode(node = {}) { await ensureUser(node.userId || node.user_id); return upsertById(KEYS.graphNodes, { ...node, userId: String(node.userId || node.user_id) }); },
    async listNodes(userId, options = {}) { return (await loadArray(KEYS.graphNodes)).filter(userFilter(userId)).slice(0, normalizeLimit(options.limit, 25, 100)); },
    async getNodeById(userId, nodeId) { return (await loadArray(KEYS.graphNodes)).find(item => userFilter(userId)(item) && item.id === nodeId) || null; },
    async createEdge(edge = {}) { await ensureUser(edge.userId || edge.user_id); return upsertById(KEYS.graphEdges, { ...edge, userId: String(edge.userId || edge.user_id) }); },
    async listEdges(userId, options = {}) { return (await loadArray(KEYS.graphEdges)).filter(userFilter(userId)).slice(0, normalizeLimit(options.limit, 50, 200)); },
    async getGraphSnapshot(userId, options = {}) { return { nodes: await graph.listNodes(userId, options), edges: await graph.listEdges(userId, options) }; },
    async softDeleteNode(userId, nodeId) { const node = await graph.getNodeById(userId, nodeId); if (node) await graph.upsertNode({ ...node, deletedAt: new Date().toISOString() }); return { ok: Boolean(node), id: nodeId }; },
    async softDeleteEdge(userId, edgeId) { const items = await loadArray(KEYS.graphEdges); const edge = items.find(item => userFilter(userId)(item) && item.id === edgeId); if (edge) await upsertById(KEYS.graphEdges, { ...edge, deletedAt: new Date().toISOString() }); return { ok: Boolean(edge), id: edgeId }; }
  };

  const insights = {
    async createInsight(insight = {}) {
      await ensureUser(insight.userId || insight.user_id);
      return upsertById(KEYS.insights, { ...insight, userId: String(insight.userId || insight.user_id), type: insight.type || 'insight' });
    },
    async listInsights(userId, options = {}) {
      return (await loadArray(KEYS.insights))
        .filter(userFilter(userId))
        .slice(0, normalizeLimit(options.limit, 10, 50));
    },
    async searchInsights(userId, query = '', options = {}) {
      const q = String(query || '').toLowerCase();
      return (await loadArray(KEYS.insights))
        .filter(userFilter(userId))
        .filter(item => !q || String(item.content || '').toLowerCase().includes(q))
        .slice(0, normalizeLimit(options.limit, 5, 20));
    },
    async deleteInsight(userId, insightId) {
      const items = await loadArray(KEYS.insights);
      const index = items.findIndex(item => userFilter(userId)(item) && item.id === insightId);
      if (index < 0) return { ok: false, id: insightId };
      items[index] = { ...items[index], deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveArray(KEYS.insights, items);
      return { ok: true, id: insightId };
    }
  };

  const telemetry = {
    async recordTelemetryEvent(event = {}) { return { ok: true, id: (await upsertById(KEYS.telemetryEvents, { ...event, content: undefined })).id }; },
    async getTelemetrySummary(options = {}) { return (await loadArray(KEYS.telemetryEvents)).slice(-normalizeLimit(options.limit, 20, 100)); },
    async pruneTelemetryEvents() { return { ok: true, count: 0 }; }
  };

  const incidents = {
    async createIncident(incident = {}) { return upsertById(KEYS.incidents, { ...incident, status: incident.status || 'open' }); },
    async listIncidents(options = {}) { return (await loadArray(KEYS.incidents)).filter(item => !options.status || item.status === options.status).slice(0, normalizeLimit(options.limit, 20, 100)); },
    async getIncidentById(incidentId) { return (await loadArray(KEYS.incidents)).find(item => item.id === incidentId) || null; },
    async updateIncident(incidentId, patch = {}) { const item = await incidents.getIncidentById(incidentId); return item ? upsertById(KEYS.incidents, { ...item, ...patch }) : null; },
    async resolveIncident(incidentId) { return incidents.updateIncident(incidentId, { status: 'resolved', resolvedAt: new Date().toISOString() }); }
  };

  return {
    graph,
    goals,
    incidents,
    insights,
    memories,
    telemetry,
    users,
    workflows
  };
}

module.exports = {
  KEYS,
  createJsonRepositories
};
