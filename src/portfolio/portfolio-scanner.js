'use strict';

const planner = require('../planner');
const observability = require('../observability');
const githubops = require('../githubops');
const deploy = require('../deploy');
const utils = require('./portfolio-utils');
const store = require('./portfolio-store');

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
}

function getRepos(services = {}) {
  try {
    return services.storageManager?.getRepositories?.() || null;
  } catch (_) {
    return null;
  }
}

async function listActiveGoals(workspaceId, services = {}) {
  const userId = String(services.userId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard');
  const repos = getRepos(services);
  let goals = [];
  if (repos?.goals?.listGoals) {
    goals = await safeCall(() => repos.goals.listGoals(userId, { limit: 200 }), []);
  }
  if (!goals.length && services.aiOS?.goalManager?.listGoals) {
    goals = await safeCall(() => services.aiOS.goalManager.listGoals(userId, {}, services), []);
  }
  return (Array.isArray(goals) ? goals : [])
    .filter(goal => utils.itemMatchesWorkspace(goal, workspaceId))
    .filter(goal => utils.isActiveStatus(goal.status))
    .map(utils.summarizeGoal);
}

async function listActiveOperatorPlans(workspaceId, services = {}) {
  const operator = services.operatorSystem || services.projectOperator || null;
  if (operator?.listPlans) {
    const plans = await safeCall(() => operator.listPlans({ workspaceId, status: 'active' }, services), []);
    return (Array.isArray(plans) ? plans : []).filter(item => utils.itemMatchesWorkspace(item, workspaceId));
  }
  const userId = String(services.userId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard');
  const plans = await planner.plannerEngine.listPlans({
    userId,
    actorId: services.actorId || userId,
    workspaceId,
    status: '',
    limit: 200
  }, services);
  return (Array.isArray(plans) ? plans : []).filter(plan => ['draft', 'active', 'reviewing'].includes(String(plan.status || '').toLowerCase()));
}

async function listOpenTasks(workspaceId, services = {}) {
  const userId = String(services.userId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard');
  const tasks = await planner.taskOrchestrator.listTasks({
    userId,
    actorId: services.actorId || userId,
    workspaceId,
    status: '',
    includeArchived: false,
    limit: 300
  }, services);
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => utils.itemMatchesWorkspace(task, workspaceId))
    .filter(task => ['todo', 'doing', 'blocked'].includes(String(task.status || '').toLowerCase()))
    .map(utils.summarizeTask);
}

async function listPendingProposals(workspaceId, services = {}) {
  const executor = require('../executor');
  const userId = String(services.userId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard');
  const proposals = await executor.executionQueue.listPendingApprovals({
    userId,
    actorId: services.actorId || userId,
    workspaceId,
    limit: 100
  }, services);
  return (Array.isArray(proposals) ? proposals : []).map(item => utils.sanitize({
    id: item.id,
    title: utils.compactText(item.title || '', 160),
    status: item.status,
    riskLevel: item.riskLevel,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt
  }));
}

async function listOpenIncidents(workspaceId, services = {}) {
  const incidents = await safeCall(() => observability.incidentStore.listIncidents({ status: 'open', workspaceId, limit: 100 }, services), []);
  return (Array.isArray(incidents) ? incidents : []).map(item => utils.sanitize({
    id: item.id,
    title: utils.compactText(item.title || item.summary || '', 180),
    severity: item.severity || 'low',
    status: item.status || 'open',
    affectedSystems: item.affectedSystems || [],
    firstSeenAt: item.firstSeenAt || item.createdAt,
    updatedAt: item.updatedAt
  }));
}

async function getLatestDeployStatus(services = {}) {
  const candidates = await safeCall(() => deploy.store.listReleaseCandidates?.({ limit: 1 }, services), []);
  const latest = Array.isArray(candidates) ? candidates[0] : null;
  const gate = await safeCall(() => deploy.renderDeployGate.runRenderDeployGate?.({}, services), null);
  return utils.sanitize({
    status: latest?.status || gate?.status || (gate?.ok ? 'ready' : 'unknown'),
    latestCandidateId: latest?.id || '',
    gateOk: gate?.ok ?? null,
    warnings: gate?.warnings || [],
    blockers: gate?.blockers || []
  });
}

async function getGithubOpsStatus(services = {}) {
  const repoState = await safeCall(() => githubops.repoState.getRepoState?.(services), null);
  const releaseGate = await safeCall(() => githubops.releaseGate.checkGithubReleaseGate?.(services), null);
  return utils.sanitize({
    ok: Boolean(repoState?.ok || releaseGate?.ok),
    branch: repoState?.branch || repoState?.currentBranch || '',
    dirty: Boolean(repoState?.dirty || repoState?.hasChanges),
    releaseGateStatus: releaseGate?.status || (releaseGate?.ok ? 'passed' : 'unknown'),
    blockers: releaseGate?.blockers || []
  });
}

async function getCostStatus(workspaceId, services = {}) {
  const costSystem = services.costSystem || services.opsSystem?.costOptimizer || require('../ops').costOptimizer;
  if (!costSystem?.analyzeCost) return { status: 'unavailable', warnings: ['Cost module unavailable.'] };
  const cost = await safeCall(() => costSystem.analyzeCost(services, services.userId || services.actorId || '0'), null);
  if (!cost) return { status: 'unavailable', warnings: ['Cost analysis failed safely.'] };
  const avg = Number(cost.estimatedTokenUsage?.averageTokens || 0);
  return utils.sanitize({
    status: avg >= 1400 ? 'warning' : 'ok',
    averageTokens: avg,
    aiPerRequest: Number(cost.aiPerRequest || 0),
    recommendations: (cost.recommendations || []).slice(0, 5)
  });
}

async function buildPortfolioSnapshot(workspaceId, services = {}) {
  const resolvedWorkspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', workspaceId, services);
  const [goals, plans, tasks, proposals, incidents, latestDeployStatus, githubOpsStatus, costStatus] = await Promise.all([
    listActiveGoals(resolvedWorkspaceId, services),
    listActiveOperatorPlans(resolvedWorkspaceId, services),
    listOpenTasks(resolvedWorkspaceId, services),
    listPendingProposals(resolvedWorkspaceId, services),
    listOpenIncidents(resolvedWorkspaceId, services),
    getLatestDeployStatus(services),
    getGithubOpsStatus(services),
    getCostStatus(resolvedWorkspaceId, services)
  ]);
  const portfolio = await store.getOrCreateDefaultPortfolio(resolvedWorkspaceId, services.userId || services.actorId || '', services);
  const blockedTasks = tasks.filter(task => task.status === 'blocked');
  const staleTasks = tasks.filter(task => {
    const days = utils.daysSince(task.updatedAt);
    return days !== null && days >= 7;
  });
  const snapshot = {
    ok: true,
    workspaceId: resolvedWorkspaceId,
    portfolio,
    totals: {
      activeGoals: goals.length,
      activePlans: plans.length,
      activeTasks: tasks.length,
      blockedTasks: blockedTasks.length,
      staleTasks: staleTasks.length,
      pendingApprovals: proposals.length,
      openIncidents: incidents.length
    },
    activeGoals: goals,
    activePlans: plans,
    openTasks: tasks,
    blockedTasks,
    staleTasks,
    pendingApprovals: proposals,
    openIncidents: incidents,
    latestDeployStatus,
    githubOpsStatus,
    costStatus,
    generatedAt: utils.nowIso()
  };
  await utils.auditPortfolio('portfolio/scan_run', {
    workspaceId: resolvedWorkspaceId,
    userId: services.userId || '',
    summary: snapshot.totals
  }, services);
  return utils.sanitize(snapshot);
}

async function scanActivePortfolio(workspaceId, services = {}) {
  return buildPortfolioSnapshot(workspaceId, services);
}

module.exports = {
  buildPortfolioSnapshot,
  listActiveGoals,
  listActiveOperatorPlans,
  listOpenIncidents,
  listOpenTasks,
  listPendingProposals,
  scanActivePortfolio
};
