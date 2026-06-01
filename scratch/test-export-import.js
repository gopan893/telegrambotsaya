'use strict';

const assert = require('assert');
const backup = require('../src/backup');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_import',
      name: 'Import Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    aios_goals: { owner: [{ id: 'goal_1', userId: 'owner', workspaceId: 'ws_import', title: 'Goal' }] }
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
  const created = await backup.backupEngine.createWorkspaceBackup('ws_import', {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_import'
  }, services);
  assert.equal(created.ok, true, created.reason);

  const exported = await backup.exportEngine.exportBackupJson(created.manifest.id, services);
  assert.equal(exported.ok, true, exported.reason);
  const raw = JSON.stringify(exported.payload);
  assert.ok(!raw.includes('postgresql://'));
  assert.ok(!raw.includes('Bearer '));

  const validation = await backup.importValidator.validateImportPayload(exported.payload, services);
  assert.equal(validation.ok, true, validation.reason);
  assert.equal(validation.type, 'backup');

  const preview = await backup.importValidator.buildImportPreview(exported.payload, services);
  assert.equal(preview.type, 'backup');
  assert.ok(preview.diff.aios_goals);

  const secret = await backup.importValidator.validateImportPayload({
    backupVersion: '1.0.0',
    data: { bad: 'DATABASE_URL=postgresql://user:pass@host/db' }
  }, services);
  assert.equal(secret.ok, false);

  const huge = await backup.importValidator.validateImportPayload({ backupVersion: '1.0.0', data: { x: 'x'.repeat(3 * 1024 * 1024) } }, services);
  assert.equal(huge.ok, false);

  console.log('test-export-import: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
