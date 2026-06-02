'use strict';

const assignment = require('./agent-assignment');
const store = require('./agent-task-store');
const utils = require('./delegation-utils');

function inferHandoffTarget(task = {}, result = {}) {
  const text = `${task.title || ''} ${task.description || ''} ${result.summary || ''} ${(result.recommendations || []).join(' ')}`.toLowerCase();
  if (task.assignedAgentId !== 'coder' && /\b(code|bug|implementation|module|refactor)\b/.test(text)) return 'coder';
  if (task.assignedAgentId !== 'security' && /\b(token|secret|restore|import|delete|approval|permission)\b/.test(text)) return 'security';
  if (task.assignedAgentId !== 'ops' && /\b(render|deploy|webhook|postgres|redis|health|migration)\b/.test(text)) return 'ops';
  if (task.assignedAgentId !== 'research' && /\b(latest|terbaru|sumber|research|cari)\b/.test(text)) return 'research';
  return '';
}

function shouldHandoffTask(task = {}, agentResult = {}, services = {}) {
  const depth = Number(task.handoffDepth || 0);
  if (depth >= Number(services.maxAgentHandoffDepth || 2)) return { needed: false, reason: 'max_depth_reached' };
  const target = inferHandoffTarget(task, agentResult);
  if (!target) return { needed: false, reason: 'agent_domain_ok' };
  return { needed: true, toAgentId: target, reason: `Task lebih cocok dilanjutkan oleh ${target}.` };
}

async function loadHandoffs(services = {}) {
  const data = await utils.safeRead(utils.AGENT_HANDOFFS_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveHandoffs(items = [], services = {}) {
  return utils.safeWrite(utils.AGENT_HANDOFFS_KEY, utils.sanitizeDelegationPayload(items), services);
}

async function createHandoff(taskId, fromAgentId, toAgentId, reason, services = {}) {
  const task = await store.getTask(taskId, services);
  if (!task) throw new Error('AGENT_TASK_NOT_FOUND');
  const item = utils.sanitizeDelegationPayload({
    id: utils.createId('handoff'),
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    fromAgentId,
    toAgentId,
    reason: utils.sanitizeDelegationText(reason, { max: 260 }),
    status: 'created',
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  });
  const handoffs = await loadHandoffs(services);
  handoffs.unshift(item);
  await saveHandoffs(handoffs.slice(0, 1000), services);
  await store.updateTask(taskId, { status: 'blocked', handoffToAgentId: toAgentId, blockers: [item.reason] }, services);
  await utils.auditDelegation('agents/agent_task_handoff_created', {
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: fromAgentId,
    toAgentId,
    status: 'created'
  }, services);
  return item;
}

async function acceptHandoff(taskId, toAgentId, services = {}) {
  const task = await store.getTask(taskId, services);
  if (!task) throw new Error('AGENT_TASK_NOT_FOUND');
  const assigned = assignment.assignTaskToAgent({ ...task, assignedAgentId: toAgentId }, null, {}, services);
  const next = await store.updateTask(taskId, {
    assignedAgentId: toAgentId,
    assignedBotId: assigned.assignedBotId || toAgentId,
    status: 'queued',
    handoffToAgentId: '',
    handoffDepth: Number(task.handoffDepth || 0) + 1
  }, services);
  const handoffs = await loadHandoffs(services);
  for (const item of handoffs) {
    if (item.taskId === taskId && item.toAgentId === toAgentId && item.status === 'created') {
      item.status = 'accepted';
      item.updatedAt = utils.nowIso();
    }
  }
  await saveHandoffs(handoffs, services);
  await utils.auditDelegation('agents/agent_task_handoff_accepted', {
    taskId,
    delegationId: task.delegationId,
    workspaceId: task.workspaceId,
    userId: task.userId,
    agentId: toAgentId,
    status: 'accepted'
  }, services);
  return next;
}

async function rejectHandoff(taskId, toAgentId, reason, services = {}) {
  const handoffs = await loadHandoffs(services);
  for (const item of handoffs) {
    if (item.taskId === taskId && item.toAgentId === toAgentId && item.status === 'created') {
      item.status = 'rejected';
      item.rejectReason = utils.sanitizeDelegationText(reason || 'Rejected', { max: 220 });
      item.updatedAt = utils.nowIso();
    }
  }
  await saveHandoffs(handoffs, services);
  await utils.auditDelegation('agents/agent_task_handoff_rejected', {
    taskId,
    agentId: toAgentId,
    status: 'rejected'
  }, services);
  return { ok: true };
}

async function listHandoffs(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? utils.normalizeWorkspaceId(filters.workspaceId) : null;
  const status = filters.status ? String(filters.status) : null;
  return (await loadHandoffs(services))
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .filter(item => !status || item.status === status)
    .slice(0, limit)
    .map(utils.sanitizeDelegationPayload);
}

module.exports = {
  acceptHandoff,
  createHandoff,
  listHandoffs,
  rejectHandoff,
  shouldHandoffTask
};
