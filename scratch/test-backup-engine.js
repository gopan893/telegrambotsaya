'use strict';

const assert = require('assert');
const backup = require('../src/backup');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_backup',
      name: 'Backup Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'editor', role: 'editor', status: 'active' },
        { userId: 'viewer', role: 'viewer', status: 'active' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    aios_memories: {
      owner: [{ id: 'mem_1', userId: 'owner', workspaceId: 'ws_backup', content: 'PostgreSQL memory note' }]
    },
    planner_sessions: [{ id: 'plan_1', userId: 'owner', workspaceId: 'ws_backup', title: 'Plan' }],
    dashboard_audit_logs: []
  };
  return {
    actorId: 'owner',
    actorType: 'test',
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => {
        db[key] = value;
        return true;
      },
      getStorageStatus: () => ({ activeDriver: 'json', fallbackActive: true, jsonFallbackAvailable: true })
    },
    __db: db
  };
}

(async () => {
  const services = createServices();
  const workspaceBackup = await backup.backupEngine.createWorkspaceBackup('ws_backup', {
    actorId: 'editor',
    userId: 'owner',
    workspaceId: 'ws_backup'
  }, { ...services, actorId: 'editor' });
  assert.equal(workspaceBackup.ok, true, workspaceBackup.reason);
  assert.ok(workspaceBackup.manifest.checksum);
  assert.equal(workspaceBackup.manifest.sanitized, true);
  assert.ok(!JSON.stringify(workspaceBackup).includes('DATABASE_URL='));

  const userBackup = await backup.backupEngine.createUserBackup('owner', {
    actorId: 'owner',
    workspaceId: 'ws_backup'
  }, services);
  assert.equal(userBackup.ok, true, userBackup.reason);

  const list = await backup.backupEngine.listBackups({ limit: 10 }, services);
  assert.ok(list.length >= 2);
  const fetched = await backup.backupEngine.getBackup(workspaceBackup.manifest.id, services);
  assert.equal(fetched.manifest.id, workspaceBackup.manifest.id);

  const denied = await backup.backupEngine.createWorkspaceBackup('ws_backup', {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_backup'
  }, { ...services, actorId: 'viewer' });
  assert.equal(denied.ok, false);

  console.log('test-backup-engine: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
