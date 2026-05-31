'use strict';

const utils = require('./planner-utils');

const impactWeight = { low: 12, medium: 24, high: 38 };
const urgencyWeight = { low: 8, medium: 20, high: 34 };
const effortPenalty = { small: 0, medium: 6, large: 12 };
const goalPriorityWeight = { low: 2, medium: 7, high: 13, critical: 18 };
const riskWeight = { low: 0, medium: 5, high: 10, critical: 14 };

function dueDateBoost(dueDate) {
  if (!dueDate) return 0;
  const ms = new Date(dueDate).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 0;
  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 0) return 16;
  if (days <= 1) return 14;
  if (days <= 3) return 10;
  if (days <= 7) return 6;
  if (days <= 14) return 3;
  return 0;
}

function labelFromScore(score) {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function calculatePriorityScore(task = {}, context = {}) {
  const impact = utils.normalizeImpactUrgency(task.impact || 'medium');
  const urgency = utils.normalizeImpactUrgency(task.urgency || 'medium');
  const effort = utils.normalizeEffort(task.effort || 'medium');
  const linkedGoal = (context.goals || []).find(goal => goal.id === task.linkedGoalId || goal.id === task.goalId) || {};
  const dependencyBlocker = Array.isArray(task.dependencies) && task.dependencies.length ? 8 : 0;
  const blockedPenalty = task.status === 'blocked' ? -8 : 0;
  const donePenalty = task.status === 'done' || task.status === 'archived' ? -30 : 0;
  const workspaceBoost = context.workspaceStatus === 'active' || !context.workspaceStatus ? 4 : 0;
  const riskLevel = utils.normalizePriority(task.riskLevel || context.riskLevel || 'low');
  const raw = 18
    + (impactWeight[impact] || 20)
    + (urgencyWeight[urgency] || 16)
    - (effortPenalty[effort] || 0)
    + dependencyBlocker
    + dueDateBoost(task.dueDate)
    + (goalPriorityWeight[utils.normalizePriority(linkedGoal.priority || task.linkedGoalPriority || 'medium')] || 7)
    + (riskWeight[riskLevel] || 0)
    + workspaceBoost
    + blockedPenalty
    + donePenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    priorityScore: score,
    priority: labelFromScore(score),
    explanation: explainPriority({ ...task, priorityScore: score }, { ...context, linkedGoal })
  };
}

function rankTasks(tasks = [], context = {}) {
  return (Array.isArray(tasks) ? tasks : [])
    .map(task => {
      const scored = calculatePriorityScore(task, context);
      return { ...task, priorityScore: scored.priorityScore, priority: scored.priority, priorityExplanation: scored.explanation };
    })
    .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
}

function explainPriority(task = {}, context = {}) {
  const parts = [];
  parts.push(`impact=${utils.normalizeImpactUrgency(task.impact || 'medium')}`);
  parts.push(`urgency=${utils.normalizeImpactUrgency(task.urgency || 'medium')}`);
  parts.push(`effort=${utils.normalizeEffort(task.effort || 'medium')}`);
  if (task.dueDate) parts.push(`due=${task.dueDate}`);
  if (task.status === 'blocked') parts.push('blocked');
  if (context.linkedGoal?.priority || task.linkedGoalPriority) parts.push(`goal=${context.linkedGoal?.priority || task.linkedGoalPriority}`);
  return `Score ${Number(task.priorityScore || 0)}/100 berdasarkan ${parts.join(', ')}.`;
}

module.exports = {
  calculatePriorityScore,
  explainPriority,
  rankTasks
};
