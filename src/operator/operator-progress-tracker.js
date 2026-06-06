'use strict';

const store = require('./project-operator-store');

function updateGoalProgress(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { ok: false, error: 'Goal not found' };
  const progress = calculateProgress(goalId);
  return { ok: true, progress };
}

function calculateProgress(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { percent: 0, tasksDone: 0, tasksTotal: 0, status: 'unknown' };
  const taskIds = goal.linkedTasks || [];
  const allTasks = taskIds.map(id => store.getTask(id)).filter(Boolean);
  const total = allTasks.length;
  if (total === 0) {
    const statusMap = { idea: 0, planned: 10, in_progress: 25, blocked: 15, reviewing: 50, ready_to_ship: 80, shipped: 100, archived: 100 };
    return { percent: statusMap[goal.status] || 0, tasksDone: 0, tasksTotal: 0, status: goal.status };
  }
  const done = allTasks.filter(t => t.status === 'done').length;
  const blocked = allTasks.filter(t => t.status === 'blocked');
  const inProgress = allTasks.filter(t => t.status === 'in_progress');
  const percent = Math.round((done / total) * 100);
  return {
    percent,
    tasksDone: done,
    tasksTotal: total,
    tasksBlocked: blocked.length,
    tasksInProgress: inProgress.length,
    blockedTasks: blocked.map(t => ({ id: t.id, title: t.title })),
    status: goal.status
  };
}

function detectStaleTasks(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return [];
  const taskIds = goal.linkedTasks || [];
  const now = new Date();
  const stale = [];
  for (const id of taskIds) {
    const task = store.getTask(id);
    if (!task) continue;
    if (task.status === 'todo' || task.status === 'in_progress') {
      const daysSinceUpdate = (now - new Date(task.updatedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 3) stale.push({ ...task, staleDays: Math.round(daysSinceUpdate) });
    }
  }
  return stale;
}

function detectBlockedProgress(goalId) {
  const tasks = store.listTasks({ goalId });
  const blocked = tasks.filter(t => t.status === 'blocked');
  if (blocked.length === 0) return { blocked: false };
  return {
    blocked: true,
    blockerCount: blocked.length,
    blockers: blocked.map(t => ({ id: t.id, title: t.title, reason: t.description || 'Unknown' }))
  };
}

function generateProgressSummary(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return 'Goal not found.';
  const progress = calculateProgress(goalId);
  const blocked = detectBlockedProgress(goalId);
  const stale = detectStaleTasks(goalId);
  let summary = `Goal: ${goal.title} (${goal.status})\n`;
  summary += `Progress: ${progress.percent}% (${progress.tasksDone}/${progress.tasksTotal} tasks done)\n`;
  if (blocked.blocked) summary += `Blockers: ${blocked.blockerCount} blocked tasks\n`;
  if (stale.length > 0) summary += `Stale: ${stale.length} tasks inactive >3 days\n`;
  summary += `Next: ${recommendNextAction(goalId)}`;
  return summary;
}

function recommendNextAction(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return 'Create a goal first.';
  const progress = calculateProgress(goalId);
  if (progress.percent === 0 && goal.status === 'idea') return 'Analyze goal and create plan.';
  if (goal.status === 'planned') return 'Break plan into tasks and assign agents.';
  const blocked = detectBlockedProgress(goalId);
  if (blocked.blocked) return `Resolve ${blocked.blockerCount} blocked task(s).`;
  if (progress.tasksDone < progress.tasksTotal) return `Continue working: ${progress.tasksTotal - progress.tasksDone} tasks remaining.`;
  if (goal.status !== 'shipped') return 'Goal tasks complete. Review and ship.';
  return 'Goal shipped. Archive or start new goal.';
}

module.exports = {
  updateGoalProgress,
  calculateProgress,
  detectStaleTasks,
  detectBlockedProgress,
  generateProgressSummary,
  recommendNextAction
};
