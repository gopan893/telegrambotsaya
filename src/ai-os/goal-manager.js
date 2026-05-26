'use strict';

const guards = require('./guards');
const memoryBus = require('./memory-bus');

const GOAL_STATUSES = new Set(['active', 'paused', 'completed', 'archived']);

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
  const goal = {
    id: input.id || guards.stableId('goal', `${userId}:${title}`),
    userId: guards.normalizeUserId(userId),
    title,
    description: guards.sanitizeText(input.description || '', 900),
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
    createdAt: ts,
    updatedAt: ts,
    targetDate: guards.sanitizeText(input.targetDate || '', 60)
  };

  state.goals.push(goal);
  state.goals = guards.pruneListByScore(state.goals, guards.DEFAULT_LIMITS.goals, scoreGoal);
  memoryBus.publish(userId, {
    type: 'goal',
    content: `Goal: ${goal.title}. ${goal.description}`,
    tags: ['goal', goal.priority],
    source: 'goal-manager',
    importance: goal.priority === 'high' ? 0.86 : 0.72,
    confidence: 0.85
  }, botServices);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, goal };
}

function updateGoal(userId, goalId, field, value, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false, reason: 'GOAL_NOT_FOUND' };

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
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  createGoal,
  updateGoal,
  listGoals,
  getActiveGoals,
  attachWorkflow,
  trackProgress,
  suggestNextAction,
  detectStaleGoals,
  resetGoals
};
