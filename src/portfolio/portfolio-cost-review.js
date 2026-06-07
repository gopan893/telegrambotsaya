'use strict';

const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

async function estimatePortfolioCost(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const cost = snapshot.costStatus || { status: 'unavailable' };
  return utils.sanitize({
    ok: true,
    workspaceId: snapshot.workspaceId,
    status: cost.status || 'unknown',
    averageTokens: Number(cost.averageTokens || 0),
    aiPerRequest: Number(cost.aiPerRequest || 0),
    activeProjects: snapshot.activeGoals.length,
    estimatedRelativeCost: Math.round((Number(cost.averageTokens || 0) / 1000) + (snapshot.activeGoals.length * 2) + (snapshot.openTasks.length * 0.4)),
    recommendations: cost.recommendations || []
  });
}

async function estimateProjectCost(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const tasks = snapshot.openTasks.filter(task => String(task.linkedGoalId || '') === String(goalId));
  const base = await estimatePortfolioCost(workspaceId, services);
  return utils.sanitize({
    ok: true,
    goalId,
    workspaceId,
    openTasks: tasks.length,
    estimatedRelativeCost: Math.round((base.estimatedRelativeCost || 0) * Math.max(0.2, tasks.length / Math.max(1, snapshot.openTasks.length))),
    warnings: base.status === 'warning' ? ['Portfolio has cost warning; avoid deep council unless needed.'] : []
  });
}

async function detectExpensiveProjects(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const expensive = [];
  for (const goal of snapshot.activeGoals) {
    const cost = await estimateProjectCost(goal.id, { ...services, workspaceId: snapshot.workspaceId });
    if (cost.estimatedRelativeCost >= 4 || cost.warnings.length) expensive.push({ goal, cost });
  }
  return utils.sanitize({ ok: true, workspaceId: snapshot.workspaceId, expensive });
}

async function suggestCostSavingPortfolioPlan(workspaceId, services = {}) {
  const estimate = await estimatePortfolioCost(workspaceId, services);
  const steps = [
    'Gunakan summary context untuk pertanyaan ringan.',
    'Batasi council/deep evaluation hanya pada action berisiko.',
    'Bersihkan task/plan stale sebelum membuat project baru.',
    'Jalankan benchmark/evaluation manual pada perubahan besar saja.'
  ];
  return utils.sanitize({ ok: true, workspaceId: estimate.workspaceId, strategy: 'reduce_cost', estimate, steps });
}

async function buildPortfolioCostSummary(workspaceId, services = {}) {
  const estimate = await estimatePortfolioCost(workspaceId, services);
  await utils.auditPortfolio('portfolio/cost_review_run', { workspaceId: estimate.workspaceId, userId: services.userId, summary: estimate }, services);
  return estimate;
}

module.exports = {
  buildPortfolioCostSummary,
  detectExpensiveProjects,
  estimatePortfolioCost,
  estimateProjectCost,
  suggestCostSavingPortfolioPlan
};
