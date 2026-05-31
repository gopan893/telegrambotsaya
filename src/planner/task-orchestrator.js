'use strict';

const auditLog = require('../dashboard/audit-log');
const guards = require('./planner-guards');
const priorityScorer = require('./priority-scorer');
const store = require('./planner-store');
const utils = require('./planner-utils');

async function audit(action, task, services = {}, extra = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: extra.actorType || 'planner',
      actorId: extra.actorId || task.userId,
      action,
      targetType: 'task',
      targetId: task.id,
      userId: task.userId,
      workspaceId: task.workspaceId,
      actorRole: extra.actorRole || '',
      permission: extra.permission || 'write',
      decision: 'allowed',
      status: 'ok',
      beforeSummary: extra.beforeSummary || '',
      afterSummary: utils.summarizeTask(task)
    }, services);
  } catch (_) {}
}

async function getPlan(planId, services = {}) {
  return store.getPlannerItem(store.PLANNER_SESSIONS_KEY, planId, services);
}

async function createTask(input = {}, services = {}) {
  const userId = String(input.userId || input.actorId || '').trim();
  const workspaceId = await utils.resolveWorkspaceId(userId, input.workspaceId, services);
  const access = await guards.enforcePlannerPermission({
    actorId: input.actorId || userId,
    userId,
    workspaceId,
    permission: 'write',
    action: 'task/create'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const validation = guards.validateTaskInput(input);
  if (!validation.ok) return { ok: false, reason: validation.error, status: 400 };
  const plan = input.planId ? await getPlan(input.planId, services) : null;
  if (input.planId && (!plan || plan.workspaceId !== workspaceId || plan.userId !== userId || plan.status === 'archived')) {
    return { ok: false, reason: 'PLAN_NOT_FOUND', status: 404 };
  }
  const scored = priorityScorer.calculatePriorityScore(validation.value, { goals: [] });
  const now = utils.nowIso();
  const task = {
    id: input.id || utils.createId('task'),
    workspaceId,
    userId,
    planId: input.planId || '',
    ...validation.value,
    priority: scored.priority,
    priorityScore: scored.priorityScore,
    priorityExplanation: scored.explanation,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null
  };
  await store.upsertPlannerItem(store.PLANNER_TASKS_KEY, task, services);
  if (plan) {
    const taskIds = Array.from(new Set([...(plan.taskIds || []), task.id]));
    await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, plan.id, { taskIds }, services);
  }
  await audit('planner/task_created', task, services, access);
  return { ok: true, task };
}

async function getTask(taskId, services = {}) {
  return store.getPlannerItem(store.PLANNER_TASKS_KEY, taskId, services);
}

async function updateTask(taskId, patch = {}, services = {}) {
  const existing = await getTask(taskId, services);
  if (!existing || existing.status === 'archived') return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: patch.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'task/update'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const validation = guards.validateTaskInput({ ...existing, ...patch });
  if (!validation.ok) return { ok: false, reason: validation.error, status: 400 };
  const scored = priorityScorer.calculatePriorityScore({ ...existing, ...validation.value }, { goals: [] });
  const updated = await store.updatePlannerItem(store.PLANNER_TASKS_KEY, taskId, {
    ...validation.value,
    status: patch.status ? utils.normalizeTaskStatus(patch.status) : existing.status,
    priority: patch.priority ? utils.normalizePriority(patch.priority) : scored.priority,
    priorityScore: scored.priorityScore,
    priorityExplanation: scored.explanation
  }, services);
  await audit('planner/task_updated', updated, services, { ...access, beforeSummary: utils.summarizeTask(existing) });
  return { ok: true, task: updated };
}

async function markTaskDone(taskId, services = {}) {
  const existing = await getTask(taskId, services);
  if (!existing) return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'task/done'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updatePlannerItem(store.PLANNER_TASKS_KEY, taskId, {
    status: 'done',
    completedAt: utils.nowIso(),
    priorityScore: 0
  }, services);
  await audit('planner/task_done', updated, services, { ...access, beforeSummary: utils.summarizeTask(existing) });
  return { ok: true, task: updated };
}

async function markTaskBlocked(taskId, reason = '', services = {}) {
  const existing = await getTask(taskId, services);
  if (!existing) return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const secret = guards.preventSecretLeakInPlanner({ reason });
  if (!secret.ok) return { ok: false, reason: secret.error, status: 400 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'task/block'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updatePlannerItem(store.PLANNER_TASKS_KEY, taskId, {
    status: 'blocked',
    blockedReason: utils.compactText(reason, 300)
  }, services);
  await audit('planner/task_blocked', updated, services, { ...access, beforeSummary: utils.summarizeTask(existing) });
  return { ok: true, task: updated };
}

async function archiveTask(taskId, services = {}) {
  const existing = await getTask(taskId, services);
  if (!existing) return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || existing.userId,
    userId: existing.userId,
    workspaceId: existing.workspaceId,
    permission: 'write',
    action: 'task/archive'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const updated = await store.updatePlannerItem(store.PLANNER_TASKS_KEY, taskId, {
    status: 'archived',
    archivedAt: utils.nowIso()
  }, services);
  await audit('planner/task_archived', updated, services, { ...access, beforeSummary: utils.summarizeTask(existing) });
  return { ok: true, task: updated };
}

async function listTasks(options = {}, services = {}) {
  const workspaceId = await utils.resolveWorkspaceId(options.userId || options.actorId, options.workspaceId, services);
  const access = await guards.enforcePlannerPermission({
    actorId: options.actorId || options.userId,
    userId: options.userId,
    workspaceId,
    permission: 'read',
    action: 'task/list'
  }, services);
  if (!access.ok) return [];
  const tasks = await store.listPlannerItems(store.PLANNER_TASKS_KEY, {
    userId: access.userId,
    workspaceId: access.workspaceId,
    planId: options.planId || '',
    status: options.status || '',
    includeArchived: Boolean(options.includeArchived),
    limit: options.limit || 100
  }, services);
  return priorityScorer.rankTasks(tasks, options.context || {});
}

async function reorderTasks(planId, orderedTaskIds = [], services = {}) {
  const plan = await getPlan(planId, services);
  if (!plan) return { ok: false, reason: 'PLAN_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || plan.userId,
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    permission: 'write',
    action: 'task/reorder'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  const ids = utils.uniqueList(orderedTaskIds, 300);
  const updated = await store.updatePlannerItem(store.PLANNER_SESSIONS_KEY, planId, { taskIds: ids }, services);
  try {
    await auditLog.recordAuditLog({
      actorType: 'planner',
      actorId: access.actorId,
      action: 'planner/task_reordered',
      targetType: 'plan',
      targetId: planId,
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      actorRole: access.actorRole,
      permission: 'write',
      decision: 'allowed',
      status: 'ok',
      beforeSummary: { taskIds: plan.taskIds || [] },
      afterSummary: { taskIds: ids }
    }, services);
  } catch (_) {}
  return { ok: true, plan: updated };
}

async function linkTaskToGoal(taskId, goalId, services = {}) {
  return updateTask(taskId, { linkedGoalId: goalId }, services);
}

async function linkTaskToWorkflow(taskId, workflowId, services = {}) {
  return updateTask(taskId, { linkedWorkflowId: workflowId }, services);
}

async function convertTaskToWorkflowStep(taskId, workflowId, services = {}) {
  const task = await getTask(taskId, services);
  if (!task) return { ok: false, reason: 'TASK_NOT_FOUND', status: 404 };
  const access = await guards.enforcePlannerPermission({
    actorId: services.actorId || task.userId,
    userId: task.userId,
    workspaceId: task.workspaceId,
    permission: 'write',
    action: 'task/convert_to_workflow_step'
  }, services);
  if (!access.ok) return { ok: false, reason: access.error, status: 403 };
  let workflowStep = null;
  const repos = services.storageManager?.getRepositories?.();
  if (repos?.workflows?.addWorkflowStep) {
    workflowStep = await repos.workflows.addWorkflowStep({
      userId: task.userId,
      workflowId,
      title: task.title,
      description: task.description,
      metadata: { workspaceId: task.workspaceId, sourceTaskId: task.id }
    });
  } else if (services.aiOS?.workflowEngine?.addStep) {
    workflowStep = services.aiOS.workflowEngine.addStep(task.userId, workflowId, {
      title: task.title,
      description: task.description,
      workspaceId: task.workspaceId,
      metadata: { workspaceId: task.workspaceId, sourceTaskId: task.id }
    }, services);
  }
  const linked = await updateTask(taskId, { linkedWorkflowId: workflowId }, services);
  return { ok: true, task: linked.task, workflowStep };
}

module.exports = {
  archiveTask,
  convertTaskToWorkflowStep,
  createTask,
  getTask,
  linkTaskToGoal,
  linkTaskToWorkflow,
  listTasks,
  markTaskBlocked,
  markTaskDone,
  reorderTasks,
  updateTask
};
