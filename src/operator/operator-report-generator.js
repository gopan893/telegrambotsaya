'use strict';

const store = require('./project-operator-store');
const progressTracker = require('./operator-progress-tracker');
const decisionEngine = require('./operator-decision-engine');

function generateDailyOperatorReport(workspaceId) {
  const goals = store.listGoals({ workspaceId, status: 'in_progress' });
  const text = goals.length > 0
    ? `Active goals: ${goals.length}. ${goals.map(g => `${g.title} (${progressTracker.calculateProgress(g.id).percent}%)`).join(', ')}`
    : 'No active goals.';
  return { report: text, date: new Date().toISOString().split('T')[0], activeGoals: goals.length };
}

function generateProjectStatusReport(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { error: 'Goal not found' };
  const progress = progressTracker.calculateProgress(goalId);
  const blocked = progressTracker.detectBlockedProgress(goalId);
  const tasks = store.listTasks({ goalId });
  const plans = store.listPlans(goalId);
  const nextAction = decisionEngine.recommendNextOperatorAction(goalId);
  return {
    goal: { id: goal.id, title: goal.title, status: goal.status, category: goal.category },
    progress,
    blocked,
    tasks: tasks.length,
    plans: plans.length,
    nextAction: nextAction.topRecommendation || null,
    generatedAt: new Date().toISOString()
  };
}

function generateReleaseReadinessReport(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { error: 'Goal not found' };
  const progress = progressTracker.calculateProgress(goalId);
  const blocked = progressTracker.detectBlockedProgress(goalId);
  const pendingApprovals = store.listTasks({ goalId, status: 'review' });
  const issues = [];
  if (progress.percent < 100) issues.push(`Progress only ${progress.percent}%`);
  if (blocked.blocked) issues.push(`${blocked.blockerCount} blocker(s) remain`);
  if (pendingApprovals.length > 0) issues.push(`${pendingApprovals.length} task(s) pending approval`);
  return {
    ready: issues.length === 0,
    issues,
    progress: progress.percent,
    pendingApprovals: pendingApprovals.length
  };
}

function generateNextAgentReport(goalId) {
  const decision = decisionEngine.recommendNextOperatorAction(goalId);
  return {
    agent: decision.recommendedAgent || { agent: 'unknown', reason: 'No recommendation' },
    nextAction: decision.topRecommendation || { action: 'none', description: 'No action needed' },
    progress: decision.progress
  };
}

function generateExecutiveSummary(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return 'No goal data.';
  const status = generateProjectStatusReport(goalId);
  const release = generateReleaseReadinessReport(goalId);
  const next = generateNextAgentReport(goalId);
  let summary = `=== Executive Summary: ${goal.title} ===\n`;
  summary += `Status: ${goal.status} | Progress: ${status.progress.percent}% | Tasks: ${status.tasks}\n`;
  if (status.blocked.blocked) summary += `Blockers: ${status.blocked.blockerCount}\n`;
  summary += `Release Ready: ${release.ready ? 'YES' : 'NO'}\n`;
  if (!release.ready) summary += `Issues: ${release.issues.join(', ')}\n`;
  summary += `Next: ${next.nextAction.action} - ${next.nextAction.description}\n`;
  summary += `Agent: ${next.agent.agent} (${next.agent.reason})\n`;
  return summary;
}

module.exports = {
  generateDailyOperatorReport,
  generateProjectStatusReport,
  generateReleaseReadinessReport,
  generateNextAgentReport,
  generateExecutiveSummary
};
