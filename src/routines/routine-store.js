'use strict';

const utils = require('./routine-utils');

function createRoutineStore(store = {}) {
  const storageKeys = {
    routines: 'routines',
    runs: 'routine_runs',
    notifications: 'routine_notifications',
    proposals: 'routine_proposals'
  };

  const memoryFallback = {};
  for (const key of Object.values(storageKeys)) {
    memoryFallback[key] = [];
  }

  function hasStorage() {
    const s = store.storageManager || store;
    return typeof s.get === 'function' || typeof s.loadData === 'function' || typeof s.set === 'function' || typeof s.saveData === 'function';
  }

  function getStorage() {
    return store.storageManager || store;
  }

  function listKeys(key) {
    const s = getStorage();
    if (typeof s.get === 'function') {
      try {
        const val = s.get(key);
        return Array.isArray(val) ? val : [];
      } catch (_) {}
    }
    if (typeof s.loadData === 'function') {
      try {
        return s.loadData(key, []);
      } catch (_) {}
    }
    return memoryFallback[key] || [];
  }

  function saveKeys(key, data) {
    memoryFallback[key] = data;
    const s = getStorage();
    if (typeof s.set === 'function') {
      try { s.set(key, data); } catch (_) {}
    } else if (typeof s.saveData === 'function') {
      try { s.saveData(key, data); } catch (_) {}
    }
    return true;
  }

  function pushToList(key, item) {
    let list = listKeys(key);
    list.push(item);
    return saveKeys(key, list);
  }

  function updateInList(key, id, updates) {
    let list = listKeys(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...updates };
    return saveKeys(key, list);
  }

  function removeFromList(key, id) {
    let list = listKeys(key);
    list = list.filter(i => i.id !== id);
    return saveKeys(key, list);
  }

  // Routine CRUD
  function listRoutines(filters = {}) {
    let list = listKeys(storageKeys.routines);
    if (filters.workspaceId) list = list.filter(r => r.workspaceId === filters.workspaceId);
    if (filters.userId) list = list.filter(r => r.userId === filters.userId);
    if (filters.enabled !== undefined) list = list.filter(r => r.enabled === filters.enabled);
    if (filters.type) list = list.filter(r => r.type === filters.type);
    return list;
  }

  function getRoutine(id) {
    const list = listKeys(storageKeys.routines);
    return list.find(r => r.id === id) || null;
  }

  function createRoutine(data) {
    const routine = {
      id: utils.createId('rout'),
      workspaceId: data.workspaceId || 'default',
      userId: data.userId || 'system',
      name: data.name || 'Untitled Routine',
      description: data.description || '',
      type: data.type || 'briefing',
      schedule: utils.validateSchedulePreset(data.schedule || 'manual'),
      enabled: data.enabled !== false,
      mode: utils.validateMode(data.mode || 'manual'),
      riskLevel: utils.normalizeRiskLevel(data.riskLevel || 'low'),
      requiresApprovalForActions: data.requiresApprovalForActions !== false,
      allowedReadOnlyActions: data.allowedReadOnlyActions || [],
      blockedActions: data.blockedActions || [],
      quietHours: data.quietHours || { start: '22:00', end: '06:00' },
      maxNotificationsPerDay: data.maxNotificationsPerDay || 3,
      lastRunAt: null,
      nextRunAt: utils.computeNextRun(data.schedule || 'manual'),
      createdAt: utils.nowIso(),
      updatedAt: utils.nowIso()
    };
    pushToList(storageKeys.routines, routine);
    return routine;
  }

  function updateRoutine(id, updates) {
    updates.updatedAt = utils.nowIso();
    if (updates.schedule) updates.nextRunAt = utils.computeNextRun(updates.schedule);
    updateInList(storageKeys.routines, id, updates);
    return getRoutine(id);
  }

  function removeRoutine(id) {
    const routine = getRoutine(id);
    if (!routine) return false;
    routine.enabled = false;
    routine.updatedAt = utils.nowIso();
    updateInList(storageKeys.routines, id, { enabled: false, updatedAt: utils.nowIso() });
    return true;
  }

  // Run CRUD
  function listRuns(filters = {}) {
    let list = listKeys(storageKeys.runs);
    if (filters.routineId) list = list.filter(r => r.routineId === filters.routineId);
    if (filters.status) list = list.filter(r => r.status === filters.status);
    return list.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  }

  function getRun(id) {
    const list = listKeys(storageKeys.runs);
    return list.find(r => r.id === id) || null;
  }

  function createRun(data) {
    const run = {
      id: utils.createId('run'),
      routineId: data.routineId,
      workspaceId: data.workspaceId || 'default',
      userId: data.userId || 'system',
      status: 'queued',
      mode: utils.validateMode(data.mode || 'manual'),
      startedAt: utils.nowIso(),
      completedAt: null,
      summary: '',
      findings: [],
      recommendations: [],
      proposalIds: [],
      evaluationRunId: null,
      warnings: [],
      errors: []
    };
    pushToList(storageKeys.runs, run);
    return run;
  }

  function updateRun(id, updates) {
    updateInList(storageKeys.runs, id, updates);
    return getRun(id);
  }

  // Notification CRUD
  function listNotifications(filters = {}) {
    let list = listKeys(storageKeys.notifications);
    if (filters.routineId) list = list.filter(n => n.routineId === filters.routineId);
    if (filters.runId) list = list.filter(n => n.runId === filters.runId);
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }

  function createNotification(data) {
    const notification = {
      id: utils.createId('notif'),
      routineId: data.routineId,
      runId: data.runId,
      userId: data.userId || 'system',
      message: data.message || '',
      priority: data.priority || 'normal',
      suppressed: false,
      timestamp: utils.nowIso()
    };
    pushToList(storageKeys.notifications, notification);
    return notification;
  }

  // Proposal CRUD
  function listProposals(filters = {}) {
    let list = listKeys(storageKeys.proposals);
    if (filters.routineId) list = list.filter(p => p.routineId === filters.routineId);
    if (filters.runId) list = list.filter(p => p.runId === filters.runId);
    return list;
  }

  function createProposalLink(routineId, runId, proposalId) {
    pushToList(storageKeys.proposals, {
      id: utils.createId('rprop'),
      routineId,
      runId,
      proposalId,
      createdAt: utils.nowIso()
    });
  }

  function getProposalsForRun(runId) {
    return listProposals({ runId });
  }

  return {
    listRoutines,
    getRoutine,
    createRoutine,
    updateRoutine,
    removeRoutine,
    listRuns,
    getRun,
    createRun,
    updateRun,
    listNotifications,
    createNotification,
    listProposals,
    createProposalLink,
    getProposalsForRun
  };
}

module.exports = { createRoutineStore };
