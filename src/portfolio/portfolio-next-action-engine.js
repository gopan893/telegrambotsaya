'use strict';

const priority = require('./project-priority-engine');
const scanner = require('./portfolio-scanner');
const utils = require('./portfolio-utils');

function recommendAgentForText(text = '', riskLevel = 'low') {
  const lower = String(text || '').toLowerCase();
  if (['critical', 'high'].includes(riskLevel) || /secret|security|risk|approval|unsafe/.test(lower)) return 'Critic/Security';
  if (/deploy|render|incident|monitor|ops/.test(lower)) return 'Ops';
  if (/audit|review|recovery|regression|stabil/.test(lower)) return 'OpenCode';
  if (/implement|fix|code|dashboard|api|test/.test(lower)) return 'Codex';
  if (/cost|token|budget/.test(lower)) return 'Cost';
  return 'Hermes';
}

async function recommendNextProject(workspaceId, services = {}) {
  return priority.recommendTopProject(workspaceId, services);
}

async function recommendNextTaskForProject(goalId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const tasks = snapshot.openTasks
    .filter(task => !goalId || String(task.linkedGoalId || '') === String(goalId))
    .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
  return tasks[0] || null;
}

async function recommendNextAgentForTask(taskId, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(services.userId || services.actorId || 'dashboard', services.workspaceId || '', services);
  const snapshot = await scanner.buildPortfolioSnapshot(workspaceId, services);
  const task = snapshot.openTasks.find(item => String(item.id) === String(taskId)) || {};
  const agent = recommendAgentForText(`${task.title || taskId} ${task.blockedReason || ''}`, task.status === 'blocked' ? 'high' : 'low');
  return { ok: true, task, agent, reason: `${agent} cocok untuk konteks task ini.` };
}

async function recommendPortfolioNextAction(workspaceId, services = {}) {
  const top = await priority.recommendTopProject(workspaceId, services);
  const project = top.topProject;
  const nextTask = project ? await recommendNextTaskForProject(project.goalId, { ...services, workspaceId }) : null;
  const riskLevel = project?.health?.status === 'critical' ? 'critical' : (project?.health?.status === 'blocked' ? 'high' : 'low');
  const agent = recommendAgentForText(`${project?.goal?.title || ''} ${nextTask?.title || ''} ${project?.recommendation || ''}`, riskLevel);
  const result = utils.sanitize({
    ok: true,
    workspaceId,
    nextProject: project,
    nextTask,
    recommendedAgent: agent,
    riskLevel,
    actionType: riskLevel === 'low' ? 'plan_next_task' : 'stabilize_or_propose_repair',
    requiresProposal: ['high', 'critical'].includes(riskLevel),
    summary: buildNextActionSummary({ project, nextTask, agent, riskLevel })
  });
  await utils.auditPortfolio('portfolio/next_action_recommended', { workspaceId, userId: services.userId, summary: result }, services);
  return result;
}

function buildNextActionSummary(result = {}) {
  if (!result.project) return 'Belum ada project aktif. Buat goal/plan dulu sebelum portfolio ranking.';
  const lines = [
    `Lanjutkan: ${result.project.goal?.title || result.project.goalId}`,
    `Alasan: ${result.project.explanation || result.project.recommendation || '-'}`,
    `Task berikutnya: ${result.nextTask?.title || 'Review project dan buat task kecil.'}`,
    `Agent rekomendasi: ${result.agent || result.recommendedAgent || '-'}`,
    `Risk: ${result.riskLevel || 'low'}`
  ];
  return lines.join('\n');
}

module.exports = {
  buildNextActionSummary,
  recommendNextAgentForTask,
  recommendNextProject,
  recommendNextTaskForProject,
  recommendPortfolioNextAction
};
