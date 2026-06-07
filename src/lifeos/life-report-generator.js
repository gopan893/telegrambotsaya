'use strict';

const dailyPlanner = require('./daily-planner');
const weeklyPlanner = require('./weekly-planner');
const taskManager = require('./personal-task-manager');
const habitTracker = require('./habit-tracker');
const focusManager = require('./focus-session-manager');
const energyJournal = require('./energy-mood-journal');
const goalManager = require('./personal-goal-manager');
const priorityEngine = require('./life-priority-engine');
const proposal = require('./life-integration-proposal');
const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

async function generateDailyBriefing(userId, services = {}) {
  const runtime = { ...services, userId: userId || services.userId };
  let plan = await dailyPlanner.getDailyPlan(utils.getDateKey(new Date()), runtime);
  if (!plan) plan = (await dailyPlanner.createDailyPlan({ userId: runtime.userId, workspaceId: runtime.workspaceId }, runtime)).plan;
  const tasks = await taskManager.listPersonalTasks({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: 10 }, runtime);
  const habits = await habitTracker.summarizeHabits({}, runtime);
  const focus = await focusManager.suggestFocusBlock(runtime);
  const priority = await priorityEngine.recommendTodayPriority(runtime);
  return {
    ok: true,
    date: utils.getDateKey(new Date()),
    plan,
    tasks: tasks.slice(0, 5),
    habits,
    focus,
    priority,
    text: [
      'Daily Life OS Briefing',
      ...(plan.data?.topPriorities || []).map((item, index) => `${index + 1}. ${item}`),
      `Next: ${priority.recommendation}`,
      `Focus: ${focus.durationMinutes} menit`
    ].join('\n')
  };
}

async function generateEveningReview(userId, services = {}) {
  const review = await dailyPlanner.createEndOfDayReview(utils.getDateKey(new Date()), { ...services, userId: userId || services.userId });
  return { ok: true, review: review.review, text: 'Evening review siap: apa yang cukup baik hari ini dan apa yang bisa dibuat lebih kecil besok?' };
}

async function generateWeeklyLifeReport(userId, services = {}) {
  const runtime = { ...services, userId: userId || services.userId };
  const week = utils.getWeekKey(new Date());
  let summary = await weeklyPlanner.summarizeWeeklyPlan(week, runtime);
  if (!summary.ok) {
    const created = await weeklyPlanner.createWeeklyPlan({ week, userId: runtime.userId, workspaceId: runtime.workspaceId }, runtime);
    summary = { ok: true, plan: created.plan, text: `Weekly plan ${week}\nMain goal: ${created.plan.data.mainGoal}` };
  }
  return { ok: true, week, ...summary };
}

async function generatePersonalGoalReport(userId, services = {}) {
  const goals = await goalManager.listPersonalGoals({ workspaceId: services.workspaceId, userId: userId || services.userId, limit: 50 }, services);
  return {
    ok: true,
    totalGoals: goals.length,
    activeGoals: goals.filter((goal) => goal.status === 'active').length,
    goals: goals.slice(0, 8),
    text: goals.length ? goals.slice(0, 5).map((goal, index) => `${index + 1}. ${goal.title} (${goal.data?.progress || 0}%)`).join('\n') : 'Belum ada personal goal.'
  };
}

async function generateLifeOSSummary(userId, services = {}) {
  const runtime = { ...services, userId: userId || services.userId };
  const [tasks, habits, focus, energy, goals, proposals, balance] = await Promise.all([
    taskManager.listPersonalTasks({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: 20 }, runtime),
    habitTracker.summarizeHabits({}, runtime),
    focusManager.summarizeFocusSessions({}, runtime),
    energyJournal.summarizeEnergyTrend({}, runtime),
    goalManager.listPersonalGoals({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: 20 }, runtime),
    store.listLifeProposals({ workspaceId: runtime.workspaceId, userId: runtime.userId, limit: 20 }, runtime),
    priorityEngine.recommendLifeProjectBalance(runtime)
  ]);
  return {
    ok: true,
    tasks,
    habits,
    focus,
    energy,
    goals,
    pendingProposals: proposals.filter((item) => item.status === 'pending_approval'),
    balance,
    text: [
      'Life OS Summary',
      `Tasks: ${tasks.length}`,
      `Habits: ${habits.active}/${habits.total}`,
      `Focus completed: ${focus.completed}`,
      `Goals: ${goals.length}`,
      `Pending proposals: ${proposals.filter((item) => item.status === 'pending_approval').length}`,
      `Balance: ${balance.recommendation}`
    ].join('\n')
  };
}

module.exports = {
  generateDailyBriefing,
  generateEveningReview,
  generateLifeOSSummary,
  generatePersonalGoalReport,
  generateWeeklyLifeReport
};
