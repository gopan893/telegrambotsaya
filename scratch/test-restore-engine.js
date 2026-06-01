'use strict';

const assert = require('assert');
const backup = require('../src/backup');

function createServices() {
  const now = new Date().toISOString();
  const db = {
    workspaces: [{
      id: 'ws_restore',
      name: 'Restore Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'viewer', role: 'viewer', status: 'active' }
      ],
      createdAt: now,
      updatedAt: now
    }],
    planner_tasks: [{ id: 'task_old', userId: 'owner', workspaceId: 'ws_restore', title: 'Old task', updatedAt: now }]
  };
  return {
    actorId: 'owner',
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => {
        db[key] = value;
        return true;
      }
    },
    __db: db
  };
}

(async () => {
  const services = createServices();
  const payload = {
    exportType: 'backup',
    manifest: { version: '1.0.0', workspaceId: 'ws_restore', userId: 'owner' },
    snapshot: {
      backupVersion: '1.0.0',
      scope: { type: 'workspace', workspaceId: 'ws_restore', userId: 'owner' },
      data: {
        planner_tasks: [{ id: 'task_new', userId: 'owner', workspaceId: 'ws_restore', title: 'New task' }]
      }
    }
  };

  const plan = await backup.restoreEngine.createRestorePlan(payload, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_restore'
  }, services);
  assert.equal(plan.ok, true, plan.reason);

  const noConfirm = await backup.restoreEngine.runApprovedRestore(plan.plan.id, { actorId: 'owner' }, services);
  assert.equal(noConfirm.ok, false);
  assert.equal(noConfirm.reason, 'RESTORE_CONFIRMATION_REQUIRED');

  const denied = await backup.restoreEngine.createRestorePlan(payload, {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_restore'
  }, { ...services, actorId: 'viewer' });
  assert.equal(denied.ok, false);

  const restored = await backup.restoreEngine.runApprovedRestore(plan.plan.id, {
    actorId: 'owner',
    confirmationText: 'RESTORE'
  }, services);
  assert.equal(restored.ok, true, restored.reason);
  assert.ok(services.__db.planner_tasks.some(task => task.id === 'task_new'));
  assert.ok(services.__db.planner_tasks.some(task => task.id === 'task_old'));
  assert.ok((services.__db.dashboard_audit_logs || []).some(item => item.action === 'restore/completed'));

  console.log('test-restore-engine: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
