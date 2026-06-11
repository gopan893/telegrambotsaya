'use strict';

const backup = require('../../src/backup');

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
      safeWrite: async (key, value) => { db[key] = value; return true; },
      getStorageStatus: () => ({ activeDriver: 'json', fallbackActive: true, jsonFallbackAvailable: true })
    },
    __db: db
  };
}

describe('Backup Engine', () => {
  test('creates workspace backup with checksum', async () => {
    const services = createServices();
    const result = await backup.backupEngine.createWorkspaceBackup('ws_backup', {
      actorId: 'editor', userId: 'owner', workspaceId: 'ws_backup'
    }, { ...services, actorId: 'editor' });
    expect(result.ok).toBe(true);
    expect(result.manifest.checksum).toBeTruthy();
    expect(result.manifest.sanitized).toBe(true);
    expect(JSON.stringify(result)).not.toContain('DATABASE_URL=');
  });

  test('creates user backup', async () => {
    const services = createServices();
    const result = await backup.backupEngine.createUserBackup('owner', {
      actorId: 'owner', workspaceId: 'ws_backup'
    }, services);
    expect(result.ok).toBe(true);
  });

  test('lists and fetches backups', async () => {
    const services = createServices();
    await backup.backupEngine.createWorkspaceBackup('ws_backup', {
      actorId: 'editor', userId: 'owner', workspaceId: 'ws_backup'
    }, { ...services, actorId: 'editor' });

    const list = await backup.backupEngine.listBackups({ limit: 10 }, services);
    expect(list.length).toBeGreaterThanOrEqual(1);

    const fetched = await backup.backupEngine.getBackup(list[0].id, services);
    expect(fetched.manifest.id).toBe(list[0].id);
  });

  test('denies backup for viewer role', async () => {
    const services = createServices();
    const result = await backup.backupEngine.createWorkspaceBackup('ws_backup', {
      actorId: 'viewer', userId: 'owner', workspaceId: 'ws_backup'
    }, { ...services, actorId: 'viewer' });
    expect(result.ok).toBe(false);
  });
});
