'use strict';

const assert = require('assert');
const safeActions = require('../src/dashboard/safe-actions');
const auditLog = require('../src/dashboard/audit-log');

function createMemoryServices() {
  const data = {
    rel_memories: [
      { id: 'mem1', userId: 'u1', type: 'semantic', content: 'old', tags: [], importance: 0.5, confidence: 0.5 }
    ],
    dashboard_audit_logs: []
  };
  const storageManager = {
    async safeRead(key, fallback) { return data[key] || fallback; },
    async safeWrite(key, value) { data[key] = value; return true; },
    getRepositories() {
      return {
        memories: {
          async getMemoryById(userId, memoryId) {
            return data.rel_memories.find(item => item.userId === userId && item.id === memoryId && !item.deletedAt) || null;
          },
          async updateMemory(userId, memoryId, patch) {
            const item = data.rel_memories.find(row => row.userId === userId && row.id === memoryId && !row.deletedAt);
            if (!item) return null;
            Object.assign(item, patch, { updatedAt: new Date().toISOString() });
            return item;
          },
          async softDeleteMemory(userId, memoryId) {
            const item = data.rel_memories.find(row => row.userId === userId && row.id === memoryId);
            if (!item) return { ok: false };
            item.deletedAt = new Date().toISOString();
            return { ok: true, id: memoryId };
          }
        }
      };
    },
    getStore() { return null; }
  };
  return { data, services: { storageManager } };
}

async function main() {
  const { data, services } = createMemoryServices();
  const context = { actorId: 'admin' };

  const update = await safeActions.handleSafeAction('memory/update', {
    userId: 'u1',
    memoryId: 'mem1',
    content: 'new content',
    tags: ['phase13'],
    importance: 0.8
  }, context, services);
  assert.strictEqual(update.ok, true);
  assert.strictEqual(data.rel_memories[0].content, 'new content');

  const secret = await safeActions.handleSafeAction('memory/update', {
    userId: 'u1',
    memoryId: 'mem1',
    content: 'postgresql://user:secret@example.com/db'
  }, context, services);
  assert.strictEqual(secret.ok, false);
  assert.strictEqual(secret.status, 'rejected');

  const archive = await safeActions.handleSafeAction('memory/archive', {
    userId: 'u1',
    memoryId: 'mem1',
    confirm: true,
    confirmationText: 'ARCHIVE',
    reason: 'cleanup'
  }, context, services);
  assert.strictEqual(archive.ok, true);
  assert.ok(data.rel_memories[0].deletedAt);

  const restore = await safeActions.handleSafeAction('memory/restore', {
    userId: 'u1',
    memoryId: 'mem1',
    confirm: true,
    confirmationText: 'RESTORE'
  }, context, services);
  assert.strictEqual(restore.ok, true);
  assert.strictEqual(data.rel_memories[0].deletedAt, null);

  const logs = await auditLog.listAuditLogs({ limit: 10 }, services);
  assert.ok(logs.some(log => log.action === 'memory/update'));
  assert.ok(logs.some(log => log.action === 'memory/archive'));
  assert.ok(logs.some(log => log.action === 'memory/restore'));

  console.log('test-dashboard-memory-control: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
