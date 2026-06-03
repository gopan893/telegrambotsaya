'use strict';

const utils = require('./routine-utils');

function createRoutineScheduler(services = {}) {
  const scheduleLib = services.scheduleLib || null;
  const auditLog = services.auditLog || [];
  const scheduledJobs = new Map();

  function registerRoutine(routine) {
    if (!routine || !routine.enabled) return false;
    if (routine.schedule === 'manual') return false;
    if (!scheduleLib) {
      auditLog.push({ type: 'routine_scheduler_unavailable', routineId: routine.id, timestamp: utils.nowIso() });
      return false;
    }

    // Cancel existing job
    if (scheduledJobs.has(routine.id)) {
      try { scheduledJobs.get(routine.id).cancel(); } catch (_) {}
      scheduledJobs.delete(routine.id);
    }

    try {
      let rule;
      switch (routine.schedule) {
        case 'hourly':
          rule = new scheduleLib.RecurrenceRule();
          rule.minute = 0;
          break;
        case 'daily':
          rule = new scheduleLib.RecurrenceRule();
          rule.hour = 7;
          rule.minute = 0;
          break;
        case 'weekly':
          rule = new scheduleLib.RecurrenceRule();
          rule.dayOfWeek = 1;
          rule.hour = 7;
          rule.minute = 0;
          break;
        case 'monthly':
          rule = new scheduleLib.RecurrenceRule();
          rule.date = 1;
          rule.hour = 7;
          rule.minute = 0;
          break;
        default:
          return false;
      }

      if (rule) {
        rule.tz = 'Asia/Jakarta';
      }

      const job = scheduleLib.scheduleJob(rule, () => {
        if (services.runner && typeof services.runner.runRoutine === 'function') {
          services.runner.runRoutine(routine.id, {}, services).catch(() => {});
        }
      });

      if (job) {
        scheduledJobs.set(routine.id, job);
        auditLog.push({ type: 'routine_scheduled', routineId: routine.id, schedule: routine.schedule, timestamp: utils.nowIso() });
        return true;
      }
    } catch (err) {
      auditLog.push({ type: 'routine_schedule_failed', routineId: routine.id, error: err.message, timestamp: utils.nowIso() });
    }
    return false;
  }

  function unregisterRoutine(id) {
    if (scheduledJobs.has(id)) {
      try { scheduledJobs.get(id).cancel(); } catch (_) {}
      scheduledJobs.delete(id);
      auditLog.push({ type: 'routine_unscheduled', routineId: id, timestamp: utils.nowIso() });
      return true;
    }
    return false;
  }

  function getScheduledRoutines() {
    return Array.from(scheduledJobs.keys());
  }

  function getDueRoutines(registry) {
    const now = new Date();
    const routines = registry.listRoutines({ enabled: true });
    return routines.filter(r => {
      if (r.schedule === 'manual') return false;
      if (!r.nextRunAt) return true;
      return new Date(r.nextRunAt) <= now;
    });
  }

  function rescheduleAll(registry) {
    const routines = registry.listRoutines({ enabled: true });
    for (const r of routines) {
      if (r.schedule !== 'manual') {
        registerRoutine(r);
      }
    }
  }

  return {
    registerRoutine,
    unregisterRoutine,
    getScheduledRoutines,
    getDueRoutines,
    rescheduleAll
  };
}

module.exports = { createRoutineScheduler };
