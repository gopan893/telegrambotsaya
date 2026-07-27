'use strict';

const utils = require('./routine-utils');
const store = require('./routine-store');

function createRoutineRegistry(services = {}) {
  const routineStore = store.createRoutineStore(services);
  const auditLog = services.auditLog || [];
  const registeredTypes = {};

  function registerType(type, handler) {
    registeredTypes[type] = handler;
  }

  function getHandler(type) {
    return registeredTypes[type] || null;
  }

  function listRegisteredTypes() {
    return Object.keys(registeredTypes);
  }

  function createRoutine(data) {
    const routine = routineStore.createRoutine(data);
    auditLog.push({ type: 'routine_created', routineId: routine.id, name: routine.name, timestamp: utils.nowIso() });
    return routine;
  }

  function getRoutine(id) {
    return routineStore.getRoutine(id);
  }

  function listRoutines(filters = {}) {
    return routineStore.listRoutines(filters);
  }

  function enableRoutine(id) {
    const r = routineStore.getRoutine(id);
    if (!r) return null;
    const updated = routineStore.updateRoutine(id, { enabled: true });
    auditLog.push({ type: 'routine_enabled', routineId: id, timestamp: utils.nowIso() });
    return updated;
  }

  function disableRoutine(id) {
    const r = routineStore.getRoutine(id);
    if (!r) return null;
    const updated = routineStore.updateRoutine(id, { enabled: false });
    auditLog.push({ type: 'routine_disabled', routineId: id, timestamp: utils.nowIso() });
    return updated;
  }

  function updateRoutineSchedule(id, schedule) {
    const r = routineStore.getRoutine(id);
    if (!r) return null;
    const preset = utils.validateSchedulePreset(schedule);
    const updated = routineStore.updateRoutine(id, { schedule: preset });
    auditLog.push({ type: 'routine_schedule_changed', routineId: id, schedule: preset, timestamp: utils.nowIso() });
    return updated;
  }

  function removeRoutine(id) {
    const r = routineStore.getRoutine(id);
    if (!r) return false;
    auditLog.push({ type: 'routine_removed', routineId: id, timestamp: utils.nowIso() });
    return routineStore.removeRoutine(id);
  }

  function createDefaultRoutines() {
    const defaults = [
      {
        name: 'Daily Briefing',
        description: 'Summarize goals, tasks, pending proposals, recent agent activity',
        type: 'briefing',
        schedule: 'daily',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_summary', 'read_tasks', 'read_proposals']
      },
      {
        name: 'Weekly Roadmap Review',
        description: 'Review phase progress and suggest next steps',
        type: 'roadmap_review',
        schedule: 'weekly',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_roadmap', 'read_phases']
      },
      {
        name: 'Backup Health Check',
        description: 'Check backup status, create proposal if backup needed',
        type: 'backup_check',
        schedule: 'daily',
        mode: 'proposal_only',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_backup_status'],
        blockedActions: ['run_backup']
      },
      {
        name: 'Ops Health Check',
        description: 'Check app/storage/Redis/dashboard health',
        type: 'ops_check',
        schedule: 'daily',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_health', 'read_storage', 'read_redis']
      },
      {
        name: 'Agent Evaluation Check',
        description: 'Run Evaluation v2 summary or latest results',
        type: 'eval_check',
        schedule: 'weekly',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_evaluation']
      },
      {
        name: 'Integration Status Check',
        description: 'Check connector credential/config status',
        type: 'integration_check',
        schedule: 'daily',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_integration_status']
      },
      {
        name: 'Coding Workspace Review',
        description: 'Summarize coding tasks, change plans, prompts, proposals',
        type: 'coding_review',
        schedule: 'daily',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_coding_tasks', 'read_change_plans']
      },
      {
        name: 'Memory Hygiene Review',
        description: 'Suggest memory archive/cleanup',
        type: 'memory_hygiene',
        schedule: 'weekly',
        mode: 'proposal_only',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_memory_stats'],
        blockedActions: ['delete_memory']
      },
      {
        name: 'Pending Executor Review',
        description: 'List pending proposals and risks',
        type: 'pending_review',
        schedule: 'daily',
        mode: 'scheduled_readonly',
        riskLevel: 'low',
        allowedReadOnlyActions: ['read_pending_proposals']
      }
    ];

    const created = [];
    for (const def of defaults) {
      const existing = routineStore.listRoutines({ type: def.type });
      if (existing.length === 0) {
        created.push(routineStore.createRoutine(def));
      }
    }
    return created;
  }

  return {
    routineStore,
    registerType,
    getHandler,
    listRegisteredTypes,
    createRoutine,
    getRoutine,
    listRoutines,
    enableRoutine,
    disableRoutine,
    updateRoutineSchedule,
    removeRoutine,
    createDefaultRoutines
  };
}

module.exports = { createRoutineRegistry };
