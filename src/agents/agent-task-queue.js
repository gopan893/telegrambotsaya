'use strict';

const store = require('./agent-task-store');
const utils = require('./delegation-utils');

async function enqueueAgentTask(task, services = {}) {
  const existing = task.id ? await store.getTask(task.id, services) : null;
  const queued = existing
    ? await store.updateTask(task.id, { status: 'queued' }, services)
    : await store.createTask({ ...task, status: 'queued' }, services);
  await utils.auditDelegation('agents/agent_task_queued', {
    taskId: queued.id,
    delegationId: queued.delegationId,
    workspaceId: queued.workspaceId,
    userId: queued.userId,
    agentId: queued.assignedAgentId,
    status: 'queued'
  }, services);
  return queued;
}

async function listQueuedAgentTasks(filters = {}, services = {}) {
  return store.listTasks({ ...filters, status: 'queued' }, services);
}

async function claimAgentTask(taskId, agentId, services = {}) {
  const task = await store.getTask(taskId, services);
  if (!task) throw new Error('AGENT_TASK_NOT_FOUND');
  if (task.assignedAgentId && task.assignedAgentId !== agentId) throw new Error('AGENT_TASK_ASSIGNED_TO_DIFFERENT_AGENT');
  return store.updateTask(taskId, { assignedAgentId: agentId, status: 'running', startedAt: utils.nowIso() }, services);
}

async function markAgentTaskRunning(taskId, services = {}) {
  return store.updateTask(taskId, { status: 'running', startedAt: utils.nowIso() }, services);
}

async function markAgentTaskCompleted(taskId, result, services = {}) {
  const summary = utils.sanitizeDelegationText(result?.summary || result?.resultSummary || result?.text || '', { max: 900 });
  const task = await store.updateTask(taskId, {
    status: 'completed',
    result: utils.sanitizeDelegationPayload(result),
    resultSummary: summary,
    confidence: Number(result?.confidence || 0.68),
    completedAt: utils.nowIso()
  }, services);
  await store.appendTaskResult({
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: task.assignedAgentId,
    result: task.result,
    resultSummary: task.resultSummary,
    confidence: task.confidence
  }, services);
  await utils.auditDelegation('agents/agent_task_completed', {
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: task.assignedAgentId,
    status: 'completed',
    confidence: task.confidence
  }, services);
  return task;
}

async function markAgentTaskFailed(taskId, error, services = {}) {
  const task = await store.updateTask(taskId, {
    status: 'failed',
    resultSummary: utils.sanitizeDelegationText(error?.message || error || 'Task failed', { max: 400 }),
    completedAt: utils.nowIso()
  }, services);
  await utils.auditDelegation('agents/agent_task_failed', {
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: task.assignedAgentId,
    status: 'failed'
  }, services);
  return task;
}

async function markAgentTaskBlocked(taskId, reason, services = {}) {
  const task = await store.updateTask(taskId, {
    status: 'blocked',
    blockers: [utils.sanitizeDelegationText(reason || 'Blocked', { max: 260 })]
  }, services);
  await utils.auditDelegation('agents/agent_task_blocked', {
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: task.assignedAgentId,
    status: 'blocked'
  }, services);
  return task;
}

async function archiveAgentTask(taskId, actor, services = {}) {
  return store.archiveTask(taskId, actor, services);
}

module.exports = {
  archiveAgentTask,
  claimAgentTask,
  enqueueAgentTask,
  listQueuedAgentTasks,
  markAgentTaskBlocked,
  markAgentTaskCompleted,
  markAgentTaskFailed,
  markAgentTaskRunning
};
