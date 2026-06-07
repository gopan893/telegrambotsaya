'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');
const taskManager = require('./personal-task-manager');
const habitTracker = require('./habit-tracker');
const focusManager = require('./focus-session-manager');
const priorityEngine = require('./life-priority-engine');

async function createDailyPlan(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_DAILY_PLAN_REJECTED', status: 400 };
  const date = utils.getDateKey(input.date || new Date());
  const topTasks = await recommendTodayTopTasks({ ...services, workspaceId: input.workspaceId || services.workspaceId, userId: input.userId || services.userId });
  const habitSummary = await habitTracker.summarizeHabits({ date }, services);
  const focus = await focusManager.suggestFocusBlock(services);
  const balance = await priorityEngine.recommendLifeProjectBalance(services);
  const priorities = utils.safeArray(input.priorities).length
    ? utils.safeArray(input.priorities).slice(0, 3)
    : topTasks.tasks.map((task) => task.title).slice(0, 3);
  while (priorities.length < 3) priorities.push(['Satu task personal kecil', 'Satu habit ringan', 'Review malam 5 menit'][priorities.length]);
  const item = utils.buildLifeItem({
    ...input,
    type: 'daily_plan',
    title: input.title || `Daily plan ${date}`,
    scheduledAt: date,
    status: 'planned',
    data: {
      date,
      topPriorities: priorities.slice(0, 3),
      projectTask: input.projectTask || priorities[0],
      personalTask: input.personalTask || priorities[1],
      habit: input.habit || habitSummary.topStreaks?.[0]?.title || priorities[2],
      focusBlock: { title: focus.title, durationMinutes: focus.durationMinutes, targetTaskId: focus.targetTaskId },
      breakReminder: 'Ambil jeda pendek setelah satu focus block.',
      reflectionQuestion: 'Apa satu hal kecil yang membuat hari ini cukup?',
      pendingApprovals: input.pendingApprovals || [],
      balanceRecommendation: balance.recommendation
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/daily_plan_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { date, topPriorities: item.data.topPriorities } }, services);
  return { ok: true, plan: item };
}

async function getDailyPlan(date, services = {}) {
  const dateKey = utils.getDateKey(date || new Date());
  const plans = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'daily_plan', date: dateKey, limit: 5 }, services);
  return plans[0] || null;
}

async function updateDailyPlan(planId, patch = {}, services = {}) {
  if (utils.containsSecretLike(patch)) return { ok: false, reason: 'SECRET_LIKE_DAILY_PATCH_REJECTED', status: 400 };
  const current = await store.getLifeItem(planId, services);
  if (!current || current.type !== 'daily_plan') return { ok: false, reason: 'DAILY_PLAN_NOT_FOUND', status: 404 };
  const next = utils.buildLifeItem({ ...current, ...patch, id: current.id, type: 'daily_plan', createdAt: current.createdAt, data: { ...(current.data || {}), ...(patch.data || {}) } }, services);
  await store.upsertLifeItem(next, services);
  return { ok: true, plan: next };
}

async function summarizeDailyPlan(date, services = {}) {
  const plan = await getDailyPlan(date, services);
  if (!plan) return { ok: false, reason: 'DAILY_PLAN_NOT_FOUND', status: 404 };
  return {
    ok: true,
    plan,
    text: [
      `Daily plan ${plan.data?.date || plan.scheduledAt}`,
      ...(plan.data?.topPriorities || []).map((item, index) => `${index + 1}. ${item}`),
      `Focus: ${plan.data?.focusBlock?.durationMinutes || 25} menit`,
      `Balance: ${plan.data?.balanceRecommendation || 'jaga scope tetap kecil'}`
    ].join('\n')
  };
}

async function recommendTodayTopTasks(services = {}) {
  const tasks = await taskManager.listPersonalTasks({ workspaceId: services.workspaceId, userId: services.userId, limit: 100 }, services);
  const open = tasks.filter((task) => !['done', 'archived'].includes(task.status));
  const sorted = open.sort((a, b) => rank(b.priority) - rank(a.priority)).slice(0, 3);
  return { ok: true, tasks: sorted };
}

async function createEndOfDayReview(date, services = {}) {
  const dateKey = utils.getDateKey(date || new Date());
  const plan = await getDailyPlan(dateKey, services);
  const tasks = await taskManager.listPersonalTasks({ workspaceId: services.workspaceId, userId: services.userId, limit: 100 }, services);
  const done = tasks.filter((task) => task.status === 'done').length;
  const item = utils.buildLifeItem({
    type: 'reflection',
    title: `Evening review ${dateKey}`,
    scheduledAt: dateKey,
    sensitivity: 'private',
    data: {
      dailyPlanId: plan?.id || '',
      completedTasks: done,
      prompt: 'Apa yang cukup baik hari ini, dan apa yang bisa dibuat lebih kecil besok?'
    }
  }, services);
  await store.upsertLifeItem(item, services);
  return { ok: true, review: item };
}

function rank(priority = 'medium') {
  return { low: 1, medium: 2, high: 3, critical: 4 }[priority] || 2;
}

module.exports = {
  createDailyPlan,
  createEndOfDayReview,
  getDailyPlan,
  recommendTodayTopTasks,
  summarizeDailyPlan,
  updateDailyPlan
};
