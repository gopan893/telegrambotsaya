'use strict';

const assert = require('assert');
const scheduler = require('../src/backup/backup-scheduler');
const auditLog = require('../src/dashboard/audit-log');
const workspace = require('../src/workspace');

async function main() {
  const services = { actorId: 'owner1', actorType: 'test', env: { OWNER_CHAT_ID: 'owner1' } };
  const ws = await workspace.store.ensurePersonalWorkspace('owner1', services);

  const daily = scheduler.calculateNextRunAt({ frequency: 'daily' }, new Date('2026-06-01T00:00:00Z'));
  const weekly = scheduler.calculateNextRunAt({ frequency: 'weekly' }, new Date('2026-06-01T00:00:00Z'));
  const monthly = scheduler.calculateNextRunAt({ frequency: 'monthly' }, new Date('2026-06-01T00:00:00Z'));
  assert.strictEqual(daily, '2026-06-02T00:00:00.000Z');
  assert.strictEqual(weekly, '2026-06-08T00:00:00.000Z');
  assert.strictEqual(monthly, '2026-07-01T00:00:00.000Z');

  const created = await scheduler.createBackupSchedule({
    actorId: 'owner1',
    userId: 'owner1',
    workspaceId: ws.id,
    name: 'Weekly Test Backup',
    scope: 'workspace',
    frequency: 'weekly'
  }, services);
  assert.strictEqual(created.ok, true);
  assert.strictEqual(created.schedule.requiresApproval, true);

  const preview = await scheduler.previewScheduleRun(created.schedule.id, services);
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.preview.willCreateBackup, false);

  const requested = await scheduler.requestScheduleRunApproval(created.schedule.id, services);
  assert.strictEqual(requested.ok, true);
  assert.strictEqual(requested.run.status, 'pending_approval');

  const deniedRun = await scheduler.runApprovedSchedule(requested.run.id, services);
  assert.strictEqual(deniedRun.ok, false);

  const approved = await scheduler.approveScheduleRun(requested.run.id, { actorId: 'owner1' }, services);
  assert.strictEqual(approved.ok, true);
  assert.strictEqual(approved.run.status, 'approved');

  const completed = await scheduler.runApprovedSchedule(requested.run.id, services);
  assert.strictEqual(completed.ok, true);
  assert.ok(completed.backup.id);

  const archived = await scheduler.archiveBackupSchedule(created.schedule.id, services);
  assert.strictEqual(archived.ok, true);
  assert.ok(archived.schedule.archivedAt);

  const logs = await auditLog.listAuditLogs({ limit: 100 }, services);
  assert.ok(logs.some(log => log.action === 'backup_schedule/created'));
  assert.ok(logs.some(log => log.action === 'backup_schedule_run/completed'));
  assert.ok(!JSON.stringify(logs).includes('DATABASE_URL'));

  console.log('test-backup-scheduler: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
