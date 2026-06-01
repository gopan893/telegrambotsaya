'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const guards = require('../src/backup/backup-guards');
const importValidator = require('../src/backup/import-validator');
const exportEngine = require('../src/backup/export-engine');

const downloadsCode = fs.readFileSync(path.join(process.cwd(), 'public/dashboard/downloads.js'), 'utf8');
const sandbox = {
  console,
  Blob,
  Date,
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
  document: {
    createElement: () => ({ click() {}, remove() {} }),
    body: { appendChild() {} },
    getElementById: () => null
  },
  Utils: {
    escapeHtml: value => String(value),
    formatBytes: value => `${value} Bytes`
  },
  navigator: {}
};
vm.createContext(sandbox);
vm.runInContext(`${downloadsCode}; globalThis.BackupDownloads = BackupDownloads;`, sandbox);

const fileName = sandbox.BackupDownloads.buildSafeFilename('telegram-aios', 'workspace backup ../x', new Date('2026-06-01T10:15:00Z'));
assert.match(fileName, /^telegram-aios-workspace-backup-x-20260601-1015\.json$/);
assert.ok(!fileName.includes('..'));

const sanitized = exportEngine.sanitizeExportPayload({ token: 'secret-value', nested: { value: 'safe' } });
assert.ok(['[redacted]', 'set'].includes(sanitized.token));
assert.strictEqual(sanitized.nested.value, 'safe');

const snapshot = {
  backupVersion: '1.0.0',
  scope: { workspaceId: 'ws_test', userId: 'u1' },
  data: { planner_tasks: [] }
};
const payload = { exportType: 'backup', manifest: { version: '1.0.0' }, snapshot };

(async () => {
  const validation = await importValidator.validateImportPayload(payload, {});
  assert.strictEqual(validation.ok, true);

  const bad = await importValidator.validateImportPayload({
    exportType: 'backup',
    manifest: { version: '1.0.0' },
    snapshot: {
      backupVersion: '1.0.0',
      data: { value: 'DATABASE_URL=postgresql://user:pass@example/db' }
    }
  }, {});
  assert.strictEqual(bad.ok, false);

  const preview = await importValidator.buildImportPreview(payload, {});
  assert.strictEqual(preview.ok, true);
  assert.ok(preview.diff.planner_tasks);

  assert.strictEqual(guards.requireRestoreConfirmation('').ok, false);
  assert.strictEqual(guards.requireRestoreConfirmation('RESTORE').ok, true);

  const serialized = JSON.stringify({ sanitized, preview });
  assert.ok(!/DATABASE_URL|REDIS_URL|postgresql:\/\/|rediss:\/\//i.test(serialized));

  console.log('test-backup-download-import-ux: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
