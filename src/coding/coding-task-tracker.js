'use strict';

const { createCodingId } = require('./coding-utils');
const { STORAGE_KEYS } = require('./coding-workspace-store');

const TASK_STATUSES = [
  'idea',
  'planned',
  'prompt_ready',
  'proposal_ready',
  'approved',
  'in_progress',
  'testing',
  'done',
  'blocked'
];

function createCodingTask(input = {}, services = {}) {
  const now = new Date().toISOString();
  const task = {
    id: input.id || createCodingId('task'),
    workspaceId: input.workspaceId || 'ws_default',
    userId: String(input.userId || ''),
    title: input.title || 'Untitled coding task',
    description: input.description || '',
    category: input.category || 'feature_request',
    status: input.status || 'idea',
    planId: input.planId || null,
    proposalId: input.proposalId || null,
    priority: input.priority || 'medium',
    tags: input.tags || [],
    createdAt: input.createdAt || now,
    updatedAt: now
  };

  if (services?.storageManager) {
    persistTask(task, services).catch(() => {});
  }

  return task;
}

function listCodingTasks(filters = {}, services = {}) {
  if (!services?.storageManager) return [];

  // Async but return empty for sync context — real usage goes through services
  return [];
}

async function listCodingTasksAsync(filters = {}, services = {}) {
  if (!services?.storageManager) return [];

  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingTasks, []
    );
    const arr = Array.isArray(list) ? list : [];

    let filtered = arr;

    if (filters.workspaceId) {
      filtered = filtered.filter(t => t.workspaceId === filters.workspaceId);
    }
    if (filters.userId) {
      filtered = filtered.filter(t => String(t.userId) === String(filters.userId));
    }
    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    return filtered.slice(-100);
  } catch (_) {
    return [];
  }
}

async function updateCodingTaskStatus(taskId, status, services = {}) {
  if (!services?.storageManager || !taskId) return null;

  if (!TASK_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}. Valid: ${TASK_STATUSES.join(', ')}` };
  }

  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingTasks, []
    );
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(t => t.id === taskId);

    if (idx < 0) return null;

    arr[idx] = {
      ...arr[idx],
      status,
      updatedAt: new Date().toISOString()
    };

    await services.storageManager.saveData(STORAGE_KEYS.codingTasks, arr.slice(-200));
    return arr[idx];
  } catch (_) {
    return null;
  }
}

async function linkCodingTaskToPlan(taskId, planId, services = {}) {
  if (!services?.storageManager || !taskId) return null;

  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingTasks, []
    );
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(t => t.id === taskId);

    if (idx < 0) return null;

    arr[idx] = {
      ...arr[idx],
      planId,
      updatedAt: new Date().toISOString()
    };

    await services.storageManager.saveData(STORAGE_KEYS.codingTasks, arr.slice(-200));
    return arr[idx];
  } catch (_) {
    return null;
  }
}

async function linkCodingTaskToProposal(taskId, proposalId, services = {}) {
  if (!services?.storageManager || !taskId) return null;

  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingTasks, []
    );
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(t => t.id === taskId);

    if (idx < 0) return null;

    arr[idx] = {
      ...arr[idx],
      proposalId,
      status: 'proposal_ready',
      updatedAt: new Date().toISOString()
    };

    await services.storageManager.saveData(STORAGE_KEYS.codingTasks, arr.slice(-200));
    return arr[idx];
  } catch (_) {
    return null;
  }
}

async function persistTask(task, services) {
  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingTasks, []
    );
    const arr = Array.isArray(list) ? list : [];
    arr.push(task);
    await services.storageManager.saveData(STORAGE_KEYS.codingTasks, arr.slice(-200));
  } catch (_) {
    // silent
  }
}

module.exports = {
  createCodingTask,
  listCodingTasks,
  listCodingTasksAsync,
  updateCodingTaskStatus,
  linkCodingTaskToPlan,
  linkCodingTaskToProposal,
  TASK_STATUSES
};
