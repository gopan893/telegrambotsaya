'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

const CATEGORIES = ['learning', 'health', 'work', 'project', 'finance_tracking', 'relationship', 'routine', 'personal_growth'];

function normalizeCategory(category = 'personal_growth') {
  const clean = String(category || '').trim().toLowerCase();
  return CATEGORIES.includes(clean) ? clean : 'personal_growth';
}

async function createPersonalGoal(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_PERSONAL_GOAL_REJECTED', status: 400 };
  const item = utils.buildLifeItem({
    ...input,
    type: 'personal_goal',
    status: input.status || 'active',
    data: {
      category: normalizeCategory(input.category),
      linkedProjectId: input.linkedProjectId || '',
      progress: Number(input.progress || 0),
      milestones: utils.safeArray(input.milestones).slice(0, 10),
      ...(input.data || {})
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/personal_goal_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { category: item.data.category, title: item.title } }, services);
  return { ok: true, goal: item };
}

async function listPersonalGoals(filters = {}, services = {}) {
  return store.listLifeItems({ ...filters, type: 'personal_goal' }, services);
}

async function updatePersonalGoal(goalId, patch = {}, services = {}) {
  if (utils.containsSecretLike(patch)) return { ok: false, reason: 'SECRET_LIKE_GOAL_PATCH_REJECTED', status: 400 };
  const current = await store.getLifeItem(goalId, services);
  if (!current || current.type !== 'personal_goal') return { ok: false, reason: 'PERSONAL_GOAL_NOT_FOUND', status: 404 };
  const next = utils.buildLifeItem({ ...current, ...patch, id: current.id, type: 'personal_goal', createdAt: current.createdAt, data: { ...(current.data || {}), ...(patch.data || {}) } }, services);
  await store.upsertLifeItem(next, services);
  return { ok: true, goal: next };
}

async function linkPersonalGoalToProject(goalId, projectId, services = {}) {
  return updatePersonalGoal(goalId, { data: { linkedProjectId: utils.sanitizeText(projectId, 120), category: 'project' } }, services);
}

async function summarizePersonalGoalProgress(goalId, services = {}) {
  const goal = await store.getLifeItem(goalId, services);
  if (!goal || goal.type !== 'personal_goal') return { ok: false, reason: 'PERSONAL_GOAL_NOT_FOUND', status: 404 };
  return {
    ok: true,
    goal,
    progress: Number(goal.data?.progress || 0),
    nextStep: goal.data?.progress >= 80 ? 'Review dan siapkan maintenance plan.' : 'Pilih satu langkah kecil berikutnya.'
  };
}

module.exports = {
  CATEGORIES,
  createPersonalGoal,
  linkPersonalGoalToProject,
  listPersonalGoals,
  summarizePersonalGoalProgress,
  updatePersonalGoal
};
