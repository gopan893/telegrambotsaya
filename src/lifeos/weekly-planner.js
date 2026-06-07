'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');
const priorityEngine = require('./life-priority-engine');

async function createWeeklyPlan(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_WEEKLY_PLAN_REJECTED', status: 400 };
  const week = input.week || utils.getWeekKey(input.date || new Date());
  const priorities = await recommendWeeklyPriorities(services);
  const overload = await detectOverloadedWeek(services);
  const item = utils.buildLifeItem({
    ...input,
    type: 'weekly_plan',
    title: input.title || `Weekly plan ${week}`,
    scheduledAt: week,
    status: 'planned',
    data: {
      week,
      mainGoal: input.mainGoal || priorities.mainGoal,
      projectPriorities: input.projectPriorities || priorities.projectPriorities,
      personalPriorities: input.personalPriorities || priorities.personalPriorities,
      habits: input.habits || priorities.habits,
      maintenanceTasks: input.maintenanceTasks || ['Review pending approvals', 'Rapikan task yang stale'],
      riskBlocker: overload.overloaded ? 'Too many commitments; reduce scope.' : 'No overload signal detected.',
      recommendedDevAgent: 'Codex untuk implementasi kecil, OpenCode untuk audit/recovery, Hermes untuk prompt/strategy.'
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/weekly_plan_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { week, mainGoal: item.data.mainGoal } }, services);
  return { ok: true, plan: item };
}

async function summarizeWeeklyPlan(week, services = {}) {
  const weekKey = week || utils.getWeekKey(new Date());
  const plans = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'weekly_plan', limit: 20 }, services);
  const plan = plans.find((item) => String(item.data?.week || item.scheduledAt) === String(weekKey));
  if (!plan) return { ok: false, reason: 'WEEKLY_PLAN_NOT_FOUND', status: 404 };
  return {
    ok: true,
    plan,
    text: [
      `Weekly plan ${weekKey}`,
      `Main goal: ${plan.data?.mainGoal}`,
      `Project: ${(plan.data?.projectPriorities || []).join(', ')}`,
      `Personal: ${(plan.data?.personalPriorities || []).join(', ')}`,
      `Risk: ${plan.data?.riskBlocker}`
    ].join('\n')
  };
}

async function recommendWeeklyPriorities(services = {}) {
  const balance = await priorityEngine.recommendLifeProjectBalance(services);
  return {
    ok: true,
    mainGoal: balance.balance === 'rest_first' ? 'Stabilkan energi dan selesaikan scope kecil.' : 'Selesaikan satu project priority dan satu habit personal.',
    projectPriorities: ['Satu task project paling penting', 'Review blocker dan pending approval'],
    personalPriorities: ['Satu habit utama', 'Satu sesi refleksi mingguan'],
    habits: ['Belajar singkat', 'Istirahat cukup']
  };
}

async function detectOverloadedWeek(services = {}) {
  return priorityEngine.detectTooManyCommitments(services);
}

async function createWeeklyReview(week, services = {}) {
  const weekKey = week || utils.getWeekKey(new Date());
  const item = utils.buildLifeItem({
    type: 'reflection',
    title: `Weekly review ${weekKey}`,
    scheduledAt: weekKey,
    sensitivity: 'private',
    data: {
      week: weekKey,
      prompt: 'Apa yang perlu dilanjutkan, dikurangi, dan dirayakan kecil-kecilan?'
    }
  }, services);
  await store.upsertLifeItem(item, services);
  return { ok: true, review: item };
}

module.exports = {
  createWeeklyPlan,
  createWeeklyReview,
  detectOverloadedWeek,
  recommendWeeklyPriorities,
  summarizeWeeklyPlan
};
