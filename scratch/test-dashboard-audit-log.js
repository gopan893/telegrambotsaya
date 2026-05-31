'use strict';

const assert = require('assert');
const auditLog = require('../src/dashboard/audit-log');

function createServices() {
  const data = {};
  return {
    storageManager: {
      async safeRead(key, fallback) { return data[key] || fallback; },
      async safeWrite(key, value) { data[key] = value; return true; }
    }
  };
}

async function main() {
  const services = createServices();
  await auditLog.recordAuditLog({
    actorId: 'admin',
    action: 'memory/update',
    targetType: 'memory',
    targetId: 'mem1',
    userId: 'u1',
    status: 'ok',
    beforeSummary: { content: 'before' },
    afterSummary: { content: 'postgresql://user:secret@example.com/db' },
    ip: '127.0.0.1',
    userAgent: 'test-agent'
  }, services);

  const list = await auditLog.listAuditLogs({ limit: 10 }, services);
  assert.strictEqual(list.length, 1);
  assert.ok(!JSON.stringify(list).includes('secret@example.com'));
  assert.ok(list[0].ipHash);

  for (let i = 0; i < 1005; i += 1) {
    await auditLog.recordAuditLog({ action: 'goal/update', targetType: 'goal', targetId: `g${i}`, userId: 'u1' }, services);
  }
  const prune = await auditLog.pruneAuditLogs(services);
  assert.strictEqual(prune.kept, auditLog.MAX_LOGS);

  const summary = await auditLog.getAuditSummary({ limit: 5 }, services);
  assert.ok(summary.total <= auditLog.MAX_LOGS);
  assert.ok(summary.byAction['goal/update'] > 0);

  console.log('test-dashboard-audit-log: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
