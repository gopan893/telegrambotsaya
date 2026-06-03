'use strict';

const utils = require('./routine-utils');

function createRoutinePolicy(services = {}) {
  const auditLog = services.auditLog || [];

  function checkRoutinePolicy(routine, action) {
    if (!routine) return { allowed: false, reason: 'Routine not found' };
    if (!routine.enabled) return { allowed: false, reason: 'Routine is disabled' };

    const actionLower = String(action || '').toLowerCase();

    // Check blocked actions
    if (routine.blockedActions && routine.blockedActions.some(b => actionLower.includes(b.toLowerCase()))) {
      auditLog.push({ type: 'routine_unsafe_action_blocked', routineId: routine.id, action, timestamp: utils.nowIso() });
      return { allowed: false, reason: `Action "${action}" is blocked for this routine` };
    }

    // Check write/danger actions
    if (utils.isWriteAction(action) || utils.isDangerAction(action)) {
      if (routine.mode === 'scheduled_readonly' || routine.mode === 'manual') {
        return { allowed: false, reason: 'Write/danger actions not allowed in this mode', requiresProposal: true };
      }
      if (routine.mode === 'scheduled_dry_run') {
        return { allowed: false, reason: 'Write/danger actions not allowed in dry-run mode', requiresProposal: true };
      }
      if (routine.mode === 'proposal_only') {
        return { allowed: false, reason: 'Proposal only mode - create executor proposal instead', requiresProposal: true };
      }
    }

    // Check external actions
    if (utils.isExternalAction(action)) {
      auditLog.push({ type: 'routine_external_action_requires_eval', routineId: routine.id, action, timestamp: utils.nowIso() });
      return { allowed: false, reason: 'External action requires Evaluation v2 gate', requiresProposal: true, requiresEvaluation: true };
    }

    // Check read-only actions
    if (routine.allowedReadOnlyActions && routine.allowedReadOnlyActions.length > 0) {
      const allowed = routine.allowedReadOnlyActions.some(a => actionLower.includes(a.toLowerCase()));
      if (!allowed) {
        return { allowed: false, reason: `Action "${action}" not in allowed read-only list` };
      }
    }

    return { allowed: true, reason: 'OK' };
  }

  function classifyRoutineActionRisk(action) {
    const actionLower = String(action || '').toLowerCase();
    if (utils.isDangerAction(actionLower)) return 'danger';
    if (actionLower.includes('restore') || actionLower.includes('delete')) return 'high';
    if (utils.isExternalAction(actionLower)) return 'high';
    if (utils.isWriteAction(actionLower)) return 'medium';
    if (actionLower.includes('proposal') || actionLower.includes('recommend')) return 'low';
    return 'low';
  }

  function blockUnsafeRoutineAction(action) {
    return !utils.isWriteAction(action) && !utils.isDangerAction(action) && !utils.isExternalAction(action);
  }

  function requireEvaluationForRoutineProposal(action) {
    return utils.isExternalAction(action);
  }

  function requireExecutorApprovalForRoutineProposal(action) {
    const risk = classifyRoutineActionRisk(action);
    return risk === 'high' || risk === 'danger';
  }

  function enforceRoutineNotificationLimit(routine) {
    const store = services.routineStore;
    if (!store) return true;

    const today = new Date().toISOString().slice(0, 10);
    const notifications = store.listNotifications({ routineId: routine.id });
    const todayCount = notifications.filter(n => n.timestamp && n.timestamp.startsWith(today) && !n.suppressed).length;

    return todayCount < (routine.maxNotificationsPerDay || 3);
  }

  return {
    checkRoutinePolicy,
    classifyRoutineActionRisk,
    blockUnsafeRoutineAction,
    requireEvaluationForRoutineProposal,
    requireExecutorApprovalForRoutineProposal,
    enforceRoutineNotificationLimit
  };
}

module.exports = { createRoutinePolicy };
