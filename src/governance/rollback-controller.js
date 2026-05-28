'use strict';

const observability = require('../agents/observability');
const auditLogger = require('./audit-logger');
const { ensureGovernanceState } = require('./approval-layer');

const MAX_SNAPSHOTS = 5;

function cloneSafe(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function createRecoverySnapshot(traceId, userId, reason, botServices = {}) {
  const { ensureUser, persist } = botServices;
  const user = ensureUser(userId);
  const governance = ensureGovernanceState(user);

  const snapshot = {
    id: `rb_${Date.now().toString(36)}`,
    createdAt: Date.now(),
    reason,
    state: {
      todos: cloneSafe(user.todos || []),
      reminders: cloneSafe(user.reminders || []),
      mood: user.mood || null,
      sessionState: cloneSafe(user.sessionState || null),
      semanticMemory: cloneSafe(user.semanticMemory || [])
    }
  };

  governance.recoverySnapshots.push(snapshot);
  if (governance.recoverySnapshots.length > MAX_SNAPSHOTS) {
    governance.recoverySnapshots.shift();
  }
  governance.updatedAt = Date.now();

  if (typeof persist === 'function') persist();
  auditLogger.logMemoryMutation(traceId, {
    userId,
    scope: 'governance.recoverySnapshots',
    action: 'snapshot_created',
    riskLevel: 'medium'
  });
  observability.logEvent(traceId, 'RollbackController', 'RECOVERY_SNAPSHOT_CREATED', {
    userId: String(userId),
    snapshotId: snapshot.id,
    reason
  });

  return snapshot;
}

function rollbackLastSnapshot(traceId, userId, botServices = {}) {
  const { ensureUser, persist } = botServices;
  const user = ensureUser(userId);
  const governance = ensureGovernanceState(user);
  const snapshot = governance.recoverySnapshots.pop();

  if (!snapshot) {
    return { ok: false, error: 'NO_RECOVERY_SNAPSHOT' };
  }

  user.todos = cloneSafe(snapshot.state.todos || []);
  user.reminders = cloneSafe(snapshot.state.reminders || []);
  user.mood = snapshot.state.mood || user.mood;
  user.sessionState = cloneSafe(snapshot.state.sessionState || null);
  user.semanticMemory = cloneSafe(snapshot.state.semanticMemory || []);
  governance.updatedAt = Date.now();

  if (typeof persist === 'function') persist();
  auditLogger.logMemoryMutation(traceId, {
    userId,
    scope: 'user_state',
    action: 'rollback_applied',
    riskLevel: 'high'
  });
  observability.logEvent(traceId, 'RollbackController', 'ROLLBACK_APPLIED', {
    userId: String(userId),
    snapshotId: snapshot.id
  });

  return { ok: true, snapshotId: snapshot.id };
}

function listSnapshots(userId, botServices = {}) {
  const { ensureUser } = botServices;
  const user = ensureUser(userId);
  const governance = ensureGovernanceState(user);
  return governance.recoverySnapshots || [];
}

module.exports = {
  createRecoverySnapshot,
  rollbackLastSnapshot,
  listSnapshots
};
