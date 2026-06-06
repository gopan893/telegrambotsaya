'use strict';

const scanner = require('./portfolio-scanner');
const healthScorer = require('./project-health-scorer');
const utils = require('./portfolio-utils');

const USER_PRIORITY_WEIGHT = { low: 8, medium: 18, high: 30, critical: 42 };

function factorWeights(mode = 'balanced') {
  const clean = utils.normalizePriorityMode(mode);
  const base = { user: 1, health: 1, urgency: 1, dependency: 1, cost: 1, risk: 1, release: 1, progress: 1, effort: 1 };
  if (clean === 'speed') return { ...base, urgency: 1.4, effort: 1.2, release: 1.25 };
  if (clean === 'stability') return { ...base, health: 1.6, risk: 1.5, release: 1.2 };
  if (clean === 'cost_saving') return { ...base, cost: 1.8, effort: 1.2 };
  if (clean === 'quality') return { ...base, health: 1.4, release: 1.4, risk: 1.2 };
  return base;
}

async function calculateProjectPriority(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const goal = (snapshot.activeGoals || []).find(item => String(item.id) === String(goalId)) || utils.summarizeGoal({ id: goalId, title: goalId, workspaceId });
  const health = await healthScorer.scoreProjectHealth(goalId, { ...services, workspaceId });
  const mode = utils.normalizePriorityMode(snapshot.portfolio?.priorityMode || services.priorityMode || 'balanced');
  const weights = factorWeights(mode);
  const userScore = USER_PRIORITY_WEIGHT[String(goal.priority || 'medium').toLowerCase()] || USER_PRIORITY_WEIGHT.medium;
  const urgency = health.status === 'critical' ? 38 : (health.status === 'blocked' ? 28 : (utils.daysSince(goal.updatedAt) >= 7 ? 20 : 12));
  const dependencyImpact = (snapshot.blockedTasks || []).some(task => String(task.linkedGoalId) === String(goalId)) ? 26 : 10;
  const cost = snapshot.costStatus?.status === 'warning' ? 24 : 10;
  const risk = ['critical', 'blocked'].includes(health.status) ? 30 : (health.status === 'warning' ? 18 : 8);
  const release = snapshot.latestDeployStatus?.gateOk === false ? 26 : 12;
  const progressValue = Number(goal.progress || 0) >= 80 ? 18 : (Number(goal.progress || 0) >= 35 ? 14 : 10);
  const effort = health.status === 'healthy' ? 15 : 9;
  const raw =
    (userScore * weights.user)
    + ((100 - health.score) * 0.42 * weights.health)
    + (urgency * weights.urgency)
    + (dependencyImpact * weights.dependency)
    + (cost * weights.cost)
    + (risk * weights.risk)
    + (release * weights.release)
    + (progressValue * weights.progress)
    + (effort * weights.effort);
  const priorityScore = utils.clampScore(raw);
  const result = utils.sanitize({
    goal,
    goalId,
    priorityScore,
    priorityLabel: priorityScore >= 85 ? 'critical' : (priorityScore >= 65 ? 'high' : (priorityScore >= 40 ? 'medium' : 'low')),
    mode,
    health,
    factors: { userScore, urgency, dependencyImpact, cost, risk, release, progressValue, effort },
    recommendation: buildRecommendation(goal, health, snapshot),
    explanation: explainPriorityDecision({ priorityScore, goal, health, mode })
  });
  await utils.auditPortfolio('portfolio/priority_generated', {
    targetType: 'goal',
    targetId: goalId,
    workspaceId,
    userId: services.userId,
    summary: result
  }, services);
  return result;
}

function buildRecommendation(goal = {}, health = {}, snapshot = {}) {
  if ((snapshot.openIncidents || []).some(item => ['critical', 'high'].includes(item.severity))) {
    return 'Stabilize production/incident first sebelum feature work.';
  }
  if (health.status === 'critical' || health.status === 'blocked') return 'Prioritaskan unblock/stabilization project ini.';
  if (snapshot.costStatus?.status === 'warning') return 'Pertimbangkan cost-saving pass sebelum deep council/evaluation.';
  return `Lanjutkan project "${goal.title || goal.id}" dengan next task paling kecil dan test gate.`;
}

async function compareProjectPriority(goalA, goalB, services = {}) {
  const [a, b] = await Promise.all([
    calculateProjectPriority(typeof goalA === 'string' ? goalA : goalA.id, services),
    calculateProjectPriority(typeof goalB === 'string' ? goalB : goalB.id, services)
  ]);
  return { winner: a.priorityScore >= b.priorityScore ? a : b, loser: a.priorityScore >= b.priorityScore ? b : a, a, b };
}

async function rankProjects(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const ranked = [];
  for (const goal of snapshot.activeGoals || []) {
    ranked.push(await calculateProjectPriority(goal.id, { ...services, workspaceId: snapshot.workspaceId }));
  }
  return ranked.sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
}

async function recommendTopProject(workspaceId, services = {}) {
  const ranked = await rankProjects(workspaceId, services);
  return {
    ok: true,
    workspaceId,
    topProject: ranked[0] || null,
    ranked,
    summary: ranked[0] ? explainPriorityDecision(ranked[0]) : 'Belum ada active project yang bisa diprioritaskan.'
  };
}

function explainPriorityDecision(result = {}) {
  const goalTitle = result.goal?.title || result.goalId || 'project';
  if (!result.goal && result.priorityScore === undefined) return 'Belum ada data prioritas.';
  return `${goalTitle} mendapat score ${result.priorityScore}/100 karena mode ${result.mode || 'balanced'}, health ${result.health?.score ?? '-'} (${result.health?.status || '-'}), dan urgensi/blocker saat ini.`;
}

module.exports = {
  calculateProjectPriority,
  compareProjectPriority,
  explainPriorityDecision,
  rankProjects,
  recommendTopProject
};
