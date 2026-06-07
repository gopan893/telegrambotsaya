'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

async function createPersonalTask(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_PERSONAL_TASK_REJECTED', status: 400 };
  const item = utils.buildLifeItem({ ...input, type: 'personal_task', status: input.status || 'todo' }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/task_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { title: item.title, priority: item.priority } }, services);
  return { ok: true, task: item };
}

async function listPersonalTasks(filters = {}, services = {}) {
  return store.listLifeItems({ ...filters, type: 'personal_task' }, services);
}

async function updatePersonalTask(taskId, patch = {}, services = {}) {
  if (utils.containsSecretLike(patch)) return { ok: false, reason: 'SECRET_LIKE_TASK_PATCH_REJECTED', status: 400 };
  const current = await store.getLifeItem(taskId, services);
  if (!current || current.type !== 'personal_task') return { ok: false, reason: 'PERSONAL_TASK_NOT_FOUND', status: 404 };
  const next = utils.buildLifeItem({ ...current, ...patch, id: current.id, type: 'personal_task', createdAt: current.createdAt }, services);
  await store.upsertLifeItem(next, services);
  await utils.auditLife('lifeos/task_updated', { workspaceId: next.workspaceId, userId: next.userId, targetId: next.id, summary: { status: next.status, priority: next.priority } }, services);
  return { ok: true, task: next };
}

async function completePersonalTask(taskId, services = {}) {
  const result = await updatePersonalTask(taskId, { status: 'done', data: { completedAt: utils.nowIso() } }, services);
  if (result.ok) await utils.auditLife('lifeos/task_completed', { workspaceId: result.task.workspaceId, userId: result.task.userId, targetId: result.task.id }, services);
  return result;
}

async function archivePersonalTask(taskId, reason = '', services = {}) {
  const result = await updatePersonalTask(taskId, { status: 'archived', data: { archivedAt: utils.nowIso(), archiveReason: utils.sanitizeText(reason, 200) } }, services);
  if (result.ok) await utils.auditLife('lifeos/task_archived', { workspaceId: result.task.workspaceId, userId: result.task.userId, targetId: result.task.id, reason }, services);
  return result;
}

async function detectStalePersonalTasks(services = {}) {
  const tasks = await listPersonalTasks({ workspaceId: services.workspaceId, userId: services.userId, limit: 200 }, services);
  const now = Date.now();
  return tasks.filter((task) => {
    if (['done', 'archived'].includes(task.status)) return false;
    const updated = Date.parse(task.updatedAt || task.createdAt || '');
    return Number.isFinite(updated) && now - updated > 14 * 86400000;
  });
}

module.exports = {
  archivePersonalTask,
  completePersonalTask,
  createPersonalTask,
  detectStalePersonalTasks,
  listPersonalTasks,
  updatePersonalTask
};
