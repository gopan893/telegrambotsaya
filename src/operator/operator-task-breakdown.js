'use strict';

const store = require('./project-operator-store');

function breakGoalIntoTasks(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { ok: false, error: 'Goal not found' };
  const plan = store.listPlans(goalId).find(p => p.status === 'draft' || p.status === 'active');
  return breakPlanIntoTasks(plan ? plan.id : null);
}

function breakPlanIntoTasks(planId) {
  const plan = store.getPlan(planId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  const goal = store.getGoal(plan.goalId);
  const taskList = [];
  const phases = plan.phases || [];

  for (const phase of phases) {
    if (phase.name.toLowerCase().includes('analysis') || phase.name.toLowerCase().includes('planning')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: `Analisa ${goal ? goal.title : 'project'}`, type: 'planning', riskLevel: 'low' }));
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Review existing system', type: 'planning', riskLevel: 'low' }));
    }
    if (phase.name.toLowerCase().includes('implementation') || phase.name.toLowerCase().includes('coding') || phase.name.toLowerCase().includes('fix')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: `Implement ${goal ? goal.title : 'changes'}`, type: 'coding', riskLevel: 'medium' }));
    }
    if (phase.name.toLowerCase().includes('test') || phase.name.toLowerCase().includes('review')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Run tests & review', type: 'testing', riskLevel: 'low' }));
    }
    if (phase.name.toLowerCase().includes('deploy') || phase.name.toLowerCase().includes('release')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Prepare release', type: 'deployment', riskLevel: 'high', requiresApproval: true }));
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Deploy & monitor', type: 'deployment', riskLevel: 'high', requiresApproval: true }));
    }
    if (phase.name.toLowerCase().includes('integrasi') || phase.name.toLowerCase().includes('integration')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Integration test', type: 'testing', riskLevel: 'medium' }));
    }
    if (phase.name.toLowerCase().includes('diagnosis')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Diagnose issue', type: 'planning', riskLevel: 'medium' }));
    }
    if (phase.name.toLowerCase().includes('verification') || phase.name.toLowerCase().includes('monitor')) {
      taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: 'Verify & monitor', type: 'monitoring', riskLevel: 'low' }));
    }
  }

  if (taskList.length === 0) {
    taskList.push(store.createTask({ goalId: plan.goalId, planId: plan.id, title: `Complete ${goal ? goal.title : 'task'}`, type: 'planning', riskLevel: 'medium' }));
  }

  store.updateGoal(plan.goalId, { linkedTasks: taskList.map(t => t.id) });
  return { ok: true, tasks: taskList };
}

function prioritizeOperatorTasks(filters) {
  const allTasks = store.listTasks(filters);
  const priorityScore = { high: 3, medium: 2, low: 1 };
  const statusScore = { todo: 0, in_progress: 1, blocked: 2, review: 3, done: 4 };
  allTasks.sort((a, b) => {
    const aScore = (priorityScore[a.priority] || 1) * 10 + (statusScore[a.status] || 0);
    const bScore = (priorityScore[b.priority] || 1) * 10 + (statusScore[b.status] || 0);
    return aScore - bScore;
  });
  return allTasks;
}

function detectBlockedTasks(filters) {
  const allTasks = store.listTasks(filters);
  return allTasks.filter(t => t.status === 'blocked');
}

function linkTaskToAgent(taskId, agentId) {
  const task = store.getTask(taskId);
  if (!task) return { ok: false, error: 'Task not found' };
  const updated = store.updateTask(taskId, { assignedAgent: agentId });
  return { ok: true, task: updated };
}

module.exports = {
  breakGoalIntoTasks,
  breakPlanIntoTasks,
  prioritizeOperatorTasks,
  detectBlockedTasks,
  linkTaskToAgent
};
