'use strict';

const store = require('./project-operator-store');
const progressTracker = require('./operator-progress-tracker');

function recommendNextOperatorAction(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { ok: false, error: 'No active goal. Create a goal first.' };
  const progress = progressTracker.calculateProgress(goalId);
  const blocked = progressTracker.detectBlockedProgress(goalId);
  const stale = progressTracker.detectStaleTasks(goalId);
  const recommendations = [];

  if (goal.status === 'idea') recommendations.push({ action: 'analyze_goal', description: 'Analyze goal and create delivery plan.' });
  else if (goal.status === 'planned') recommendations.push({ action: 'break_tasks', description: 'Break plan into tasks.' });
  if (blocked.blocked) recommendations.push({ action: 'resolve_blockers', description: `Resolve ${blocked.blockerCount} blocked task(s).` });
  if (stale.length > 0) recommendations.push({ action: 'review_stale', description: `${stale.length} task(s) stale >3 days.` });
  const todoTasks = store.listTasks({ goalId, status: 'todo' });
  if (todoTasks.length > 0) recommendations.push({ action: 'assign_tasks', description: `Assign ${todoTasks.length} todo task(s) to agents.` });
  if (progress.percent >= 100 && goal.status !== 'shipped') recommendations.push({ action: 'ship_goal', description: 'All tasks done. Review and ship.' });
  if (recommendations.length === 0) recommendations.push({ action: 'monitor', description: 'No pending actions. Monitor progress.' });

  const top = recommendations[0];
  const agent = decideCodexOpenCodeHermesNext(goalId);
  return {
    goalId,
    goalStatus: goal.status,
    progress: progress.percent,
    recommendations,
    topRecommendation: top,
    recommendedAgent: agent
  };
}

function compareNextActions(goalId) {
  const decisions = recommendNextOperatorAction(goalId);
  if (!decisions.ok === false) return decisions;
  return {
    recommended: decisions.topRecommendation,
    alternatives: decisions.recommendations.slice(1),
    reasoning: `Based on goal status "${decisions.goalStatus}" and ${decisions.progress}% progress.`
  };
}

function decideContinueOrStabilize(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { decision: 'unknown' };
  const blocked = progressTracker.detectBlockedProgress(goalId);
  if (blocked.blocked) return { decision: 'stabilize', reason: `${blocked.blockerCount} blocked task(s).` };
  const stale = progressTracker.detectStaleTasks(goalId);
  if (stale.length > 0) return { decision: 'continue', reason: `${stale.length} stale task(s) need attention but can continue.` };
  return { decision: 'continue', reason: 'No blockers. Safe to continue.' };
}

function decideCodexOpenCodeHermesNext(goalId) {
  const goal = store.getGoal(goalId);
  if (!goal) return { agent: 'hermes', reason: 'Need planning: start with Hermes.' };
  const todoTasks = store.listTasks({ goalId, status: 'todo' });
  const codingTasks = todoTasks.filter(t => t.type === 'coding');
  const reviewTasks = todoTasks.filter(t => t.type === 'review' || t.type === 'testing');
  const deploymentTasks = todoTasks.filter(t => t.type === 'deployment');
  const blocked = progressTracker.detectBlockedProgress(goalId);
  if (blocked.blocked || reviewTasks.length > 0) return { agent: 'opencode', reason: `Recovery/audit needed: ${blocked.blocked ? 'blocked tasks' : 'pending review'}. Use OpenCode.` };
  if (codingTasks.length > 0) return { agent: 'codex', reason: `${codingTasks.length} coding task(s) pending. Use Codex.` };
  if (deploymentTasks.length > 0) return { agent: 'opencode', reason: 'Deployment tasks need oversight. Use OpenCode.' };
  if (todoTasks.length === 0) return { agent: 'hermes', reason: 'Planning/reorg needed. Use Hermes.' };
  return { agent: 'codex', reason: 'Implementation phase. Use Codex.' };
}

function buildDecisionSummary(decision) {
  if (!decision) return 'No decision data.';
  if (decision.error) return `Decision: ${decision.error}`;
  let summary = `Decision for Goal: ${decision.goalId} | Status: ${decision.goalStatus} | Progress: ${decision.progress}%\n`;
  summary += `Recommended: ${decision.topRecommendation.action} - ${decision.topRecommendation.description}\n`;
  if (decision.recommendedAgent) summary += `Recommended Agent: ${decision.recommendedAgent.agent} (${decision.recommendedAgent.reason})\n`;
  return summary;
}

module.exports = {
  recommendNextOperatorAction,
  compareNextActions,
  decideContinueOrStabilize,
  decideCodexOpenCodeHermesNext,
  buildDecisionSummary
};
