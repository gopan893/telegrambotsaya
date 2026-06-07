'use strict';

const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

const DEFAULT_STALE_DAYS = 7;

async function detectStaleTasks(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  return (snapshot.openTasks || [])
    .filter(task => !goalId || String(task.linkedGoalId) === String(goalId))
    .map(task => ({ ...task, ageDays: utils.daysSince(task.updatedAt) }))
    .filter(task => task.ageDays !== null && task.ageDays >= Number(services.staleDays || DEFAULT_STALE_DAYS));
}

async function detectStaleProjects(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const stale = [];
  for (const goal of snapshot.activeGoals || []) {
    const ageDays = utils.daysSince(goal.updatedAt || goal.createdAt);
    const staleTasks = await detectStaleTasks(goal.id, { ...services, workspaceId: snapshot.workspaceId });
    const pendingTooLong = (snapshot.pendingApprovals || []).some(item => utils.daysSince(item.createdAt) >= 3);
    if ((ageDays !== null && ageDays >= Number(services.staleDays || DEFAULT_STALE_DAYS)) || staleTasks.length || pendingTooLong) {
      stale.push({
        goal,
        ageDays,
        staleTasks,
        pendingApprovalTooLong: pendingTooLong,
        suggestedAction: await suggestStaleProjectAction(goal.id, { ...services, workspaceId: snapshot.workspaceId })
      });
    }
  }
  await utils.auditPortfolio('portfolio/stale_project_detected', {
    workspaceId: snapshot.workspaceId,
    userId: services.userId,
    summary: { staleProjects: stale.length }
  }, services);
  return utils.sanitize({ ok: true, workspaceId: snapshot.workspaceId, stale });
}

async function detectAbandonedPlans(workspaceId, services = {}) {
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const abandoned = (snapshot.activePlans || [])
    .map(plan => ({ ...plan, ageDays: utils.daysSince(plan.updatedAt || plan.createdAt) }))
    .filter(plan => plan.ageDays !== null && plan.ageDays >= 14 && !(plan.taskIds || []).length);
  return utils.sanitize({ ok: true, workspaceId: snapshot.workspaceId, abandoned });
}

async function suggestStaleProjectAction(goalId, services = {}) {
  const staleTasks = await detectStaleTasks(goalId, services);
  if (staleTasks.some(task => task.status === 'blocked')) return 'Unblock task atau buat proposal repair sebelum lanjut feature.';
  if (staleTasks.length) return 'Review task stale, pilih satu next action kecil, dan update plan.';
  return 'Refresh project status dan tetapkan next action baru.';
}

module.exports = {
  detectAbandonedPlans,
  detectStaleProjects,
  detectStaleTasks,
  suggestStaleProjectAction
};
