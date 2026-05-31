'use strict';

const utils = require('./planner-utils');
const store = require('./planner-store');

function milestoneStatus(tasks = []) {
  if (!tasks.length) return 'todo';
  const done = tasks.filter(task => task.status === 'done').length;
  const blocked = tasks.some(task => task.status === 'blocked');
  if (done === tasks.length) return 'done';
  if (blocked) return 'blocked';
  if (done > 0) return 'doing';
  return 'todo';
}

function milestoneProgress(tasks = []) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(task => task.status === 'done').length / tasks.length) * 100);
}

function generateMilestones(plan = {}, tasks = []) {
  const activeTasks = (Array.isArray(tasks) ? tasks : []).filter(task => task.status !== 'archived');
  if (!activeTasks.length) return [];
  const chunkSize = Math.max(1, Math.ceil(activeTasks.length / Math.min(4, Math.max(1, activeTasks.length))));
  const milestones = [];
  for (let i = 0; i < activeTasks.length; i += chunkSize) {
    const chunk = activeTasks.slice(i, i + chunkSize);
    const index = milestones.length + 1;
    const target = new Date();
    target.setDate(target.getDate() + (index * 7));
    milestones.push({
      id: utils.createId('milestone'),
      title: index === 1 ? 'Fondasi awal' : index === 2 ? 'Eksekusi inti' : index === 3 ? 'Stabilisasi' : `Milestone ${index}`,
      targetDate: target.toISOString(),
      taskIds: chunk.map(task => task.id),
      status: milestoneStatus(chunk),
      progress: milestoneProgress(chunk)
    });
  }
  return milestones;
}

async function updateMilestoneProgress(planId, services = {}) {
  const plan = await store.getPlannerItem(store.PLANNER_SESSIONS_KEY, planId, services);
  if (!plan) return { ok: false, reason: 'PLAN_NOT_FOUND' };
  const tasks = await store.listPlannerItems(store.PLANNER_TASKS_KEY, { planId, includeArchived: true, limit: 500 }, services);
  const milestones = Array.isArray(plan.milestones) && plan.milestones.length ? plan.milestones : generateMilestones(plan, tasks);
  const updatedMilestones = milestones.map(milestone => {
    const linkedTasks = tasks.filter(task => (milestone.taskIds || []).includes(task.id));
    return {
      ...milestone,
      status: milestoneStatus(linkedTasks),
      progress: milestoneProgress(linkedTasks)
    };
  });
  const updatedPlan = await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, planId, { milestones: updatedMilestones }, services);
  return { ok: true, plan: updatedPlan, milestones: updatedMilestones };
}

async function summarizeMilestones(planId, services = {}) {
  const result = await updateMilestoneProgress(planId, services);
  if (!result.ok) return 'Milestone tidak ditemukan.';
  const lines = result.milestones.length
    ? result.milestones.map((item, index) => `${index + 1}. ${item.title} - ${item.status} (${item.progress}%)`)
    : ['Belum ada milestone.'];
  return lines.join('\n');
}

module.exports = {
  generateMilestones,
  summarizeMilestones,
  updateMilestoneProgress
};
