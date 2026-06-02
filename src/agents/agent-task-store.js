'use strict';

const utils = require('./delegation-utils');

async function loadList(key, services = {}) {
  const data = await utils.safeRead(key, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveList(key, items = [], services = {}) {
  return await utils.safeWrite(key, utils.sanitizeDelegationPayload(items), services);
}

async function createDelegation(input = {}, services = {}) {
  const session = utils.buildEmptyDelegationSession(input);
  const sessions = await loadList(utils.AGENT_DELEGATIONS_KEY, services);
  sessions.unshift(session);
  await saveList(utils.AGENT_DELEGATIONS_KEY, sessions.slice(0, 1000), services);
  await utils.auditDelegation('agents/delegation_session_created', {
    delegationId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    riskLevel: session.riskLevel,
    approvalRequired: session.approvalRequired
  }, services);
  return session;
}

async function updateDelegation(delegationId, patch = {}, services = {}) {
  const sessions = await loadList(utils.AGENT_DELEGATIONS_KEY, services);
  const index = sessions.findIndex(item => item.id === delegationId);
  if (index < 0) throw new Error('DELEGATION_NOT_FOUND');
  const next = utils.sanitizeDelegationPayload({
    ...sessions[index],
    ...patch,
    id: sessions[index].id,
    workspaceId: sessions[index].workspaceId,
    updatedAt: utils.nowIso()
  });
  sessions[index] = next;
  await saveList(utils.AGENT_DELEGATIONS_KEY, sessions, services);
  return next;
}

async function getDelegation(delegationId, services = {}) {
  return (await loadList(utils.AGENT_DELEGATIONS_KEY, services)).find(item => item.id === delegationId) || null;
}

async function listDelegations(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? utils.normalizeWorkspaceId(filters.workspaceId) : null;
  const userId = filters.userId ? String(filters.userId) : null;
  const status = filters.status ? String(filters.status) : null;
  return (await loadList(utils.AGENT_DELEGATIONS_KEY, services))
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .filter(item => !userId || item.userId === userId)
    .filter(item => !status || item.status === status)
    .slice(0, limit)
    .map(utils.sanitizeDelegationPayload);
}

async function createTask(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) throw Object.assign(new Error('AGENT_TASK_SECRET_REJECTED'), { code: 'AGENT_TASK_SECRET_REJECTED' });
  const task = utils.buildAgentTask(input);
  const tasks = await loadList(utils.AGENT_TASKS_KEY, services);
  tasks.unshift(task);
  await saveList(utils.AGENT_TASKS_KEY, tasks.slice(0, 3000), services);
  await utils.auditDelegation('agents/agent_task_created', {
    taskId: task.id,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: task.assignedAgentId,
    riskLevel: task.riskLevel,
    status: task.status
  }, services);
  return task;
}

async function updateTask(taskId, patch = {}, services = {}) {
  const tasks = await loadList(utils.AGENT_TASKS_KEY, services);
  const index = tasks.findIndex(item => item.id === taskId);
  if (index < 0) throw new Error('AGENT_TASK_NOT_FOUND');
  const next = utils.sanitizeDelegationPayload({
    ...tasks[index],
    ...patch,
    id: tasks[index].id,
    workspaceId: tasks[index].workspaceId,
    updatedAt: utils.nowIso()
  });
  tasks[index] = next;
  await saveList(utils.AGENT_TASKS_KEY, tasks, services);
  return next;
}

async function getTask(taskId, services = {}) {
  return (await loadList(utils.AGENT_TASKS_KEY, services)).find(item => item.id === taskId) || null;
}

async function listTasks(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? utils.normalizeWorkspaceId(filters.workspaceId) : null;
  const delegationId = filters.delegationId ? String(filters.delegationId) : null;
  const assignedAgentId = filters.assignedAgentId ? String(filters.assignedAgentId) : null;
  const status = filters.status ? String(filters.status) : null;
  const includeArchived = Boolean(filters.includeArchived);
  return (await loadList(utils.AGENT_TASKS_KEY, services))
    .filter(item => includeArchived || item.status !== 'archived')
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .filter(item => !delegationId || item.delegationId === delegationId)
    .filter(item => !assignedAgentId || item.assignedAgentId === assignedAgentId)
    .filter(item => !status || item.status === status)
    .slice(0, limit)
    .map(utils.sanitizeDelegationPayload);
}

async function archiveTask(taskId, actor = {}, services = {}) {
  const task = await updateTask(taskId, { status: 'archived', archivedAt: utils.nowIso() }, services);
  await utils.auditDelegation('agents/agent_task_archived', {
    taskId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    actorId: actor.actorId || actor.userId || '',
    status: 'archived'
  }, services);
  return task;
}

async function appendTaskResult(result = {}, services = {}) {
  const items = await loadList(utils.AGENT_TASK_RESULTS_KEY, services);
  const item = utils.sanitizeDelegationPayload({
    id: result.id || utils.createId('agent_task_result'),
    ...result,
    createdAt: result.createdAt || utils.nowIso()
  });
  items.unshift(item);
  await saveList(utils.AGENT_TASK_RESULTS_KEY, items.slice(0, 3000), services);
  return item;
}

async function listTaskResults(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
  const delegationId = filters.delegationId ? String(filters.delegationId) : null;
  const taskId = filters.taskId ? String(filters.taskId) : null;
  return (await loadList(utils.AGENT_TASK_RESULTS_KEY, services))
    .filter(item => !delegationId || item.delegationId === delegationId)
    .filter(item => !taskId || item.taskId === taskId)
    .slice(0, limit)
    .map(utils.sanitizeDelegationPayload);
}

module.exports = {
  appendTaskResult,
  archiveTask,
  createDelegation,
  createTask,
  getDelegation,
  getTask,
  listDelegations,
  listTaskResults,
  listTasks,
  loadList,
  saveList,
  updateDelegation,
  updateTask
};
