'use strict';

const utils = require('./routine-utils');

function createRoutineNotificationPolicy(services = {}) {
  const auditLog = services.auditLog || [];
  const registry = services.registry || null;

  function getStore() {
    return registry?.routineStore || null;
  }

  function shouldNotifyUser(run) {
    if (!run || run.status === 'failed') return true;
    if (run.warnings && run.warnings.length > 0) return true;
    if (run.findings && run.findings.some(f => f.severity === 'high' || f.severity === 'critical')) return true;

    // Check notification limit
    const store = getStore();
    if (store) {
      const routine = store.getRoutine(run.routineId);
      if (routine) {
        return false; // Will be checked by enforceRoutineNotificationLimit
      }
    }

    return false;
  }

  function buildRoutineNotificationMessage(run) {
    const parts = [];
    parts.push(`🔄 Routine: ${run.routineId}`);
    parts.push(`Status: ${run.status}`);
    if (run.summary) parts.push(`\n${run.summary}`);
    if (run.warnings && run.warnings.length > 0) {
      parts.push(`\n⚠️ Warnings:\n${run.warnings.slice(0, 3).join('\n')}`);
    }
    if (run.proposalIds && run.proposalIds.length > 0) {
      parts.push(`\n📋 ${run.proposalIds.length} proposal(s) created`);
    }
    return parts.join('\n');
  }

  async function sendRoutineNotification(run, svc) {
    const store = getStore();
    if (!store) return false;

    const routine = store.getRoutine(run.routineId);
    if (!routine) return false;

    // Check quiet hours
    if (routine.quietHours) {
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      const current = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      if (current >= routine.quietHours.start || current < routine.quietHours.end) {
        store.createNotification({
          routineId: run.routineId,
          runId: run.id,
          userId: run.userId || 'system',
          message: 'Suppressed during quiet hours',
          priority: 'normal',
          suppressed: true
        });
        return false;
      }
    }

    const message = buildRoutineNotificationMessage(run);

    store.createNotification({
      routineId: run.routineId,
      runId: run.id,
      userId: run.userId || 'system',
      message,
      priority: run.warnings?.length > 0 ? 'high' : 'normal'
    });

    auditLog.push({
      type: 'routine_notification_sent',
      runId: run.id,
      routineId: run.routineId,
      timestamp: utils.nowIso()
    });

    return true;
  }

  function suppressDuplicateNotification(run) {
    const store = getStore();
    if (!store) return false;

    const notifications = store.listNotifications({ routineId: run.routineId });
    const recent = notifications.filter(n =>
      n.timestamp && new Date(n.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
    );

    return recent.length > 1;
  }

  return {
    shouldNotifyUser,
    buildRoutineNotificationMessage,
    sendRoutineNotification,
    suppressDuplicateNotification
  };
}

module.exports = { createRoutineNotificationPolicy };
