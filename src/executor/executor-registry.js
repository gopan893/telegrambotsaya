'use strict';

const registry = new Map();

function getPlanner() {
  return require('../planner');
}

function getDashboardActions() {
  return require('../dashboard/dashboard-actions');
}

function getRepos(services = {}) {
  try {
    return services.storageManager?.getRepositories?.() || null;
  } catch (_) {
    return null;
  }
}

async function workflowStepAdd(action, services = {}) {
  const payload = action.payload || {};
  const repos = getRepos(services);
  if (repos?.workflows?.addWorkflowStep) {
    const step = await repos.workflows.addWorkflowStep({
      userId: action.userId,
      workflowId: payload.workflowId || action.targetId,
      title: payload.title || action.description,
      description: payload.description || '',
      metadata: { workspaceId: action.workspaceId, executorProposalId: services.proposalId || '' }
    });
    return { ok: Boolean(step), step };
  }
  if (services.aiOS?.workflowEngine?.addStep) {
    const result = services.aiOS.workflowEngine.addStep(action.userId, payload.workflowId || action.targetId, {
      title: payload.title || action.description,
      description: payload.description || '',
      workspaceId: action.workspaceId,
      metadata: { workspaceId: action.workspaceId, executorProposalId: services.proposalId || '' }
    }, services);
    return { ok: result?.ok !== false, result };
  }
  return { ok: false, error: 'WORKFLOW_ENGINE_UNAVAILABLE' };
}

async function workflowStepDone(action, services = {}) {
  const payload = action.payload || {};
  const workflowId = payload.workflowId || action.targetId;
  const stepNumber = payload.stepNumber || payload.step || payload.stepId;
  if (!workflowId || !stepNumber) return { ok: false, error: 'WORKFLOW_STEP_REQUIRED' };
  const repos = getRepos(services);
  if (repos?.workflows?.completeWorkflowStep) {
    const step = await repos.workflows.completeWorkflowStep(action.userId, workflowId, stepNumber);
    return { ok: Boolean(step), step };
  }
  if (services.aiOS?.workflowEngine?.markStepDone) {
    const result = services.aiOS.workflowEngine.markStepDone(action.userId, workflowId, stepNumber, services);
    return { ok: result?.ok !== false, result };
  }
  return { ok: false, error: 'WORKFLOW_ENGINE_UNAVAILABLE' };
}

async function goalProgressUpdate(action, services = {}) {
  const payload = action.payload || {};
  const goalId = payload.goalId || action.targetId;
  const progress = Number(payload.progress);
  if (!goalId || !Number.isFinite(progress)) return { ok: false, error: 'GOAL_PROGRESS_REQUIRED' };
  const repos = getRepos(services);
  if (repos?.goals?.updateGoal) {
    const goal = await repos.goals.updateGoal(action.userId, goalId, { progress });
    return { ok: Boolean(goal), goal };
  }
  if (services.aiOS?.goalManager?.updateGoal) {
    const result = services.aiOS.goalManager.updateGoal(action.userId, goalId, 'progress', progress, services);
    return { ok: result?.ok !== false, result };
  }
  return { ok: false, error: 'GOAL_MANAGER_UNAVAILABLE' };
}

async function dashboardAction(action, services = {}, actionName) {
  const result = await getDashboardActions().handleAction(actionName, services, action.payload || {});
  return { ok: result?.ok !== false, result };
}

function registerExecutor(actionType, handler, metadata = {}) {
  const cleanType = String(actionType || '').trim();
  if (!cleanType) return null;
  const entry = {
    actionType: cleanType,
    handler,
    description: metadata.description || cleanType,
    riskLevel: metadata.riskLevel || 'medium',
    requiresApproval: metadata.requiresApproval !== false,
    permissionsRequired: metadata.permissionsRequired || ['write'],
    enabled: metadata.enabled !== false
  };
  registry.set(cleanType, entry);
  return entry;
}

function getExecutor(actionType) {
  return registry.get(String(actionType || '').trim()) || null;
}

function listExecutors() {
  return Array.from(registry.values()).map(item => ({
    actionType: item.actionType,
    description: item.description,
    riskLevel: item.riskLevel,
    requiresApproval: item.requiresApproval,
    permissionsRequired: item.permissionsRequired,
    enabled: item.enabled
  }));
}

function validateExecutorAction(action = {}) {
  const entry = getExecutor(action.type);
  if (!entry) return { ok: false, error: 'EXECUTOR_NOT_REGISTERED' };
  if (!entry.enabled) return { ok: false, error: 'EXECUTOR_DISABLED' };
  if (entry.requiresApproval && action.requiresApproval === false) return { ok: false, error: 'APPROVAL_REQUIRED' };
  return { ok: true, executor: entry };
}

registerExecutor('planner.task.mark_done', async (action, services) => {
  const result = await getPlanner().taskOrchestrator.markTaskDone(action.payload?.taskId || action.targetId, {
    ...services,
    actorId: services.actorId || action.userId
  });
  return { ok: result.ok, result };
}, {
  description: 'Mark a planner task as done.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('planner.task.mark_blocked', async (action, services) => {
  const result = await getPlanner().taskOrchestrator.markTaskBlocked(action.payload?.taskId || action.targetId, action.payload?.reason || 'Blocked via approved executor.', {
    ...services,
    actorId: services.actorId || action.userId
  });
  return { ok: result.ok, result };
}, {
  description: 'Mark a planner task as blocked.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('workflow.step.add', workflowStepAdd, {
  description: 'Add a workflow step.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('workflow.step.done', workflowStepDone, {
  description: 'Mark a workflow step as done.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('goal.progress.update', goalProgressUpdate, {
  description: 'Update goal progress.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('ops.diagnostics.run', (action, services) => dashboardAction(action, services, 'diagnostics/run'), {
  description: 'Run read-only diagnostics.',
  riskLevel: 'low',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('ops.benchmark.light', (action, services) => dashboardAction(action, services, 'benchmark/run-light'), {
  description: 'Run light benchmark.',
  riskLevel: 'medium',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('report.health.export', (action, services) => dashboardAction(action, services, 'report/export-health'), {
  description: 'Build a sanitized health report.',
  riskLevel: 'low',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('report.user_summary.export', (action, services) => dashboardAction(action, services, 'report/export-user-summary'), {
  description: 'Build a sanitized user summary report.',
  riskLevel: 'low',
  requiresApproval: true,
  permissionsRequired: ['write']
});

registerExecutor('memory.suggest_archive', async (action) => ({
  ok: true,
  result: {
    recommendation: 'Memory archive suggestion only. No memory was archived automatically.',
    memoryId: action.payload?.memoryId || action.targetId || ''
  }
}), {
  description: 'Suggest memory archive without archiving.',
  riskLevel: 'low',
  requiresApproval: true,
  permissionsRequired: ['write']
});

module.exports = {
  getExecutor,
  listExecutors,
  registerExecutor,
  validateExecutorAction
};
