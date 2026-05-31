'use strict';

const guards = require('./guards');
const aiosGuards = require('./aios-guards');
const utils = require('./aios-utils');
const memoryBus = require('./memory-bus');
const knowledgeGraph = require('./knowledge-graph');
const strategicReasoning = require('./strategic-reasoning');

const GOAL_STATUSES = new Set(['active', 'paused', 'completed', 'archived']);
const STORAGE_KEY = 'aios_goals';

function normalizePriority(priority) {
  const text = guards.sanitizeText(priority || 'medium', 40).toLowerCase();
  if (['high', 'tinggi', 'urgent', 'penting'].includes(text)) return 'high';
  if (['low', 'rendah', 'nanti'].includes(text)) return 'low';
  return 'medium';
}

function createGoal(userId, input = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const title = guards.sanitizeText(input.title || '', 160);
  if (!title) return { ok: false, reason: 'TITLE_REQUIRED' };

  const ts = guards.nowIso();
  const metadata = input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {};
  const workspaceId = guards.sanitizeText(input.workspaceId || input.workspace_id || metadata.workspaceId || metadata.workspace_id || '', 160);
  if (workspaceId) metadata.workspaceId = workspaceId;
  const goal = {
    id: input.id || guards.stableId('goal', `${userId}:${title}`),
    userId: guards.normalizeUserId(userId),
    title,
    description: guards.sanitizeText(input.description || '', 900),
    workspaceId: workspaceId || null,
    metadata,
    status: GOAL_STATUSES.has(input.status) ? input.status : 'active',
    priority: normalizePriority(input.priority),
    progress: guards.clamp01(input.progress || 0, 0),
    milestones: guards.safeArray(input.milestones).slice(0, 20).map((item, index) => ({
      id: item.id || guards.stableId('mile', `${title}:${index}`),
      title: guards.sanitizeText(item.title || item, 160),
      done: !!item.done
    })).filter((item) => item.title),
    linkedWorkflowIds: guards.safeArray(input.linkedWorkflowIds).slice(0, 20),
    linkedMemoryIds: guards.safeArray(input.linkedMemoryIds).slice(0, 30),
    linkedGraphNodeIds: guards.safeArray(input.linkedGraphNodeIds).slice(0, 30),
    dependencies: guards.safeArray(input.dependencies).slice(0, 20).map((item) => guards.sanitizeText(item, 140)).filter(Boolean),
    riskNotes: guards.safeArray(input.riskNotes).slice(0, 20).map((item) => guards.sanitizeText(item, 220)).filter(Boolean),
    strategicReflection: null,
    createdAt: ts,
    updatedAt: ts,
    targetDate: guards.sanitizeText(input.targetDate || '', 60)
  };

  state.goals.push(goal);
  state.goals = guards.pruneListByScore(state.goals, guards.DEFAULT_LIMITS.goals, scoreGoal);
  const memoryResult = memoryBus.publish(userId, {
    type: 'goal',
    content: `Goal: ${goal.title}. ${goal.description}`,
    tags: ['goal', goal.priority],
    source: 'goal-manager',
    importance: goal.priority === 'high' ? 0.86 : 0.72,
    confidence: 0.85
  }, botServices);
  if (memoryResult.ok && memoryResult.memory?.id) goal.linkedMemoryIds.push(memoryResult.memory.id);
  if (botServices?.enableAdvancedAIOS) {
    const graph = knowledgeGraph.evolveGraphFromText(userId, `Goal ${goal.title}. ${goal.description}`, botServices, {
      source: 'goal-manager',
      confidence: 0.82,
      maxConcepts: 5
    });
    if (graph.ok) goal.linkedGraphNodeIds = graph.nodes.map((node) => node.id).slice(0, 30);
  }
  guards.touchState(state);
  mirrorGoalsToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function updateGoal(userId, goalId, field, value, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };

  if (field && typeof field === 'object') {
    for (const [patchField, patchValue] of Object.entries(field)) {
      const result = updateGoal(userId, goalId, patchField, patchValue, botServices);
      if (!result.ok) return result;
    }
    return { ok: true, goal };
  }

  const key = guards.sanitizeText(field || '', 80).toLowerCase();
  if (key === 'status') {
    const status = guards.sanitizeText(value, 40).toLowerCase();
    if (!GOAL_STATUSES.has(status)) return { ok: false, reason: 'INVALID_STATUS' };
    goal.status = status;
  } else if (key === 'progress') {
    const raw = String(value || '').trim().replace('%', '');
    const n = Number(raw);
    goal.progress = guards.clamp01(n > 1 ? n / 100 : n, goal.progress);
  } else if (key === 'description' || key === 'deskripsi') {
    goal.description = guards.sanitizeText(value, 900);
  } else if (key === 'priority' || key === 'prioritas') {
    goal.priority = normalizePriority(value);
  } else if (key === 'targetdate' || key === 'target') {
    goal.targetDate = guards.sanitizeText(value, 60);
  } else if (key === 'title' || key === 'judul') {
    const next = guards.sanitizeText(value, 160);
    if (!next) return { ok: false, reason: 'TITLE_REQUIRED' };
    goal.title = next;
  } else {
    return { ok: false, reason: 'UNSUPPORTED_FIELD' };
  }

  goal.updatedAt = guards.nowIso();
  guards.touchState(state);
  mirrorGoalsToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function listGoals(userId, options = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const status = options.status || null;
  return state.goals
    .filter((goal) => !status || goal.status === status)
    .sort((a, b) => scoreGoal(b) - scoreGoal(a))
    .slice(0, Number(options.limit || 20));
}

function getActiveGoals(userId, botServices, limit = 6) {
  return listGoals(userId, { status: 'active', limit }, botServices);
}

function attachWorkflow(userId, goalId, workflowId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };
  if (!goal.linkedWorkflowIds.includes(workflowId)) goal.linkedWorkflowIds.push(workflowId);
  goal.updatedAt = guards.nowIso();
  guards.touchState(state);
  mirrorGoalsToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function getGoal(userId, goalId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  return state.goals.find(goal => goal.id === goalId) || null;
}

function archiveGoal(userId, goalId, botServices) {
  return updateGoal(userId, goalId, 'status', 'archived', botServices);
}

function calculateGoalStats(userId, botServices) {
  const goals = listGoals(userId, { limit: guards.DEFAULT_LIMITS.goals }, botServices);
  const active = goals.filter(goal => goal.status === 'active');
  const completed = goals.filter(goal => goal.status === 'completed' || goal.status === 'archived');
  const progress = goals.length
    ? goals.reduce((sum, goal) => sum + normalizeProgressPercent(goal.progress), 0) / goals.length
    : 0;
  return {
    total: goals.length,
    active: active.length,
    completed: completed.length,
    averageProgress: Number(progress.toFixed(1))
  };
}

function attachMemory(userId, goalId, memoryId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };
  if (!goal.linkedMemoryIds.includes(memoryId)) goal.linkedMemoryIds.push(memoryId);
  goal.linkedMemoryIds = goal.linkedMemoryIds.slice(-30);
  goal.updatedAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function attachGraphNode(userId, goalId, nodeId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };
  if (!goal.linkedGraphNodeIds.includes(nodeId)) goal.linkedGraphNodeIds.push(nodeId);
  goal.linkedGraphNodeIds = goal.linkedGraphNodeIds.slice(-30);
  goal.updatedAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function trackProgress(userId, goalId, progress, note, botServices) {
  const update = updateGoal(userId, goalId, 'progress', progress, botServices);
  if (update.ok && note) {
    memoryBus.publish(userId, {
      type: 'goal',
      content: `Progress goal ${update.goal.title}: ${guards.sanitizeText(note, 400)}`,
      tags: ['goal-progress', update.goal.id],
      source: 'goal-manager',
      confidence: 0.8,
      importance: 0.68
    }, botServices);
  }
  return update;
}

function suggestNextAction(userId, goalOrId, botServices) {
  const goal = typeof goalOrId === 'string'
    ? listGoals(userId, {}, botServices).find((item) => item.id === goalOrId)
    : goalOrId;
  if (!goal) return 'Pilih satu goal aktif dulu agar next action bisa dibuat.';

  const pendingMilestone = guards.safeArray(goal.milestones).find((item) => !item.done);
  if (pendingMilestone) return `Lanjutkan milestone: ${pendingMilestone.title}`;
  if ((goal.progress || 0) < 0.25) return 'Definisikan langkah pertama yang kecil dan bisa selesai hari ini.';
  if ((goal.progress || 0) < 0.75) return 'Review progres, hambatan, dan tentukan 1 langkah paling berdampak.';
  return 'Siapkan checklist final, validasi hasil, lalu tandai goal selesai jika sudah stabil.';
}

function analyzeGoalReasoning(userId, goalOrId, botServices, context = {}) {
  const goal = typeof goalOrId === 'string'
    ? listGoals(userId, {}, botServices).find((item) => item.id === goalOrId)
    : goalOrId;
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };

  const analysis = strategicReasoning.analyzeGoal(goal, {
    ...context,
    activeGoals: [goal]
  });
  const feasibility = estimateFeasibility(goal, analysis);
  const enriched = {
    ok: true,
    goal,
    feasibility,
    dependencies: goal.dependencies,
    milestones: goal.milestones,
    nextAction: suggestNextAction(userId, goal, botServices),
    confidence: Math.min(analysis.confidence, feasibility.confidence),
    analysis
  };

  goal.strategicReflection = {
    feasibility: feasibility.level,
    confidence: enriched.confidence,
    risks: analysis.risks,
    tradeOffs: analysis.tradeOffs,
    nextAction: enriched.nextAction,
    updatedAt: guards.nowIso()
  };
  guards.touchState(guards.ensureAIOSState(userId, botServices));
  guards.persistAsync(botServices);
  return enriched;
}

function archiveCompletedGoals(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  let archived = 0;
  for (const goal of state.goals) {
    if (goal.status === 'completed' && guards.clamp01(goal.progress || 0, 0) >= 0.98) {
      goal.status = 'archived';
      goal.updatedAt = guards.nowIso();
      archived += 1;
    }
  }
  if (archived) guards.persistAsync(botServices);
  return { archived };
}

function detectStaleGoals(userId, botServices, staleDays = 21) {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  return getActiveGoals(userId, botServices, 50).filter((goal) => {
    const ts = Date.parse(goal.updatedAt || goal.createdAt || 0);
    return ts && ts < cutoff;
  });
}

function scoreGoal(goal) {
  const priority = goal.priority === 'high' ? 0.35 : goal.priority === 'medium' ? 0.2 : 0.1;
  const progress = 0.2 * (1 - guards.clamp01(goal.progress || 0, 0));
  const active = goal.status === 'active' ? 0.25 : goal.status === 'paused' ? 0.1 : 0;
  const updated = Date.parse(goal.updatedAt || goal.createdAt || 0);
  const recency = updated ? Math.max(0, 0.2 - ((Date.now() - updated) / (90 * 24 * 60 * 60 * 1000))) : 0.05;
  return priority + progress + active + recency;
}

function resetGoals(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.goals = [];
  guards.touchState(state);
  mirrorGoalsToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true };
}

async function hydrateGoalsFromStorage(userId, services = {}) {
  const state = guards.ensureAIOSState(userId, services);
  if (!services.storageManager?.loadData) return state;
  try {
    const stored = await utils.loadUserBucket(STORAGE_KEY, userId, services, []);
    if (stored.length && !state.goals.length) {
      state.goals = aiosGuards.enforceGoalLimit(stored);
      guards.touchState(state);
    }
  } catch (_) {}
  return state;
}

async function mirrorGoalsToStorage(userId, state, services = {}) {
  if (!services.storageManager?.saveData) return false;
  try {
    const safe = aiosGuards.enforceGoalLimit(guards.safeArray(state.goals));
    state.goals = safe;
    return await utils.saveUserBucket(STORAGE_KEY, userId, safe, services);
  } catch (_) {
    return false;
  }
}

function normalizeProgressPercent(progress) {
  const n = Number(progress || 0);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : Math.min(100, n);
}

function estimateFeasibility(goal, analysis) {
  let score = 0.62;
  if (goal.targetDate) score += 0.06;
  if (guards.safeArray(goal.milestones).length) score += 0.12;
  if (guards.safeArray(goal.dependencies).length > 6) score -= 0.1;
  if (guards.safeArray(analysis.risks).length > 3) score -= 0.08;
  if (goal.priority === 'high') score += 0.04;
  const confidence = guards.clamp01(score, 0.6);
  return {
    score: confidence,
    confidence,
    level: confidence >= 0.76 ? 'high' : confidence >= 0.56 ? 'medium' : 'low',
    reason: confidence >= 0.76
      ? 'Goal punya struktur cukup jelas.'
      : 'Goal masih perlu milestone, dependency, atau batas waktu yang lebih jelas.'
  };
}

module.exports = {
  STORAGE_KEY,
  createGoal,
  updateGoal,
  listGoals,
  getGoal,
  getActiveGoals,
  attachWorkflow,
  archiveGoal,
  attachMemory,
  attachGraphNode,
  trackProgress,
  calculateGoalStats,
  suggestNextAction,
  analyzeGoalReasoning,
  detectStaleGoals,
  archiveCompletedGoals,
  resetGoals,
  hydrateGoalsFromStorage,
  normalizeProgressPercent
};
