'use strict';

const dr = require('../src/disaster-recovery');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // Check inventory (no backup manifests)
  const inventory = await dr.backupIntegrityChecker.checkBackupInventory({});
  assert(typeof inventory.ok === 'boolean', 'checkBackupInventory returns ok boolean');
  assert(typeof inventory.totalBackups === 'number', 'checkBackupInventory returns totalBackups');
  assert(inventory.totalBackups === 0, 'inventory shows 0 backups (no data)');

  // Check metadata integrity
  const metadata = await dr.backupIntegrityChecker.checkBackupMetadataIntegrity({});
  assert(typeof metadata.ok === 'boolean', 'checkBackupMetadataIntegrity returns ok');
  assert(metadata.note.includes('read-only'), 'metadata check is read-only');

  // Check encryption status
  const encryption = await dr.backupIntegrityChecker.checkBackupEncryptionStatus({});
  assert(typeof encryption.ok === 'boolean', 'checkBackupEncryptionStatus returns ok');
  assert(encryption.note.includes('Read-only'), 'encryption check is read-only');
  assert(encryption.note.includes('No secret'), 'encryption check does not expose secrets');

  // Check restore readiness
  const readiness = await dr.backupIntegrityChecker.checkBackupRestoreReadiness({});
  assert(typeof readiness.ok === 'boolean', 'checkBackupRestoreReadiness returns ok');

  // Build report
  const results = {
    inventory: await dr.backupIntegrityChecker.checkBackupInventory({}),
    metadata: await dr.backupIntegrityChecker.checkBackupMetadataIntegrity({}),
    encryption: await dr.backupIntegrityChecker.checkBackupEncryptionStatus({}),
    readiness: await dr.backupIntegrityChecker.checkBackupRestoreReadiness({})
  };

  const report = await dr.backupIntegrityChecker.buildBackupIntegrityReport(results, {});
  assert(typeof report.ok === 'boolean', 'buildBackupIntegrityReport returns ok');
  assert(report.checks.inventory !== undefined, 'report has inventory check');
  assert(report.checks.metadata !== undefined, 'report has metadata check');
  assert(report.checks.encryption !== undefined, 'report has encryption check');
  assert(report.checks.readiness !== undefined, 'report has readiness check');
  assert(typeof report.generatedAt === 'string', 'report has generatedAt');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
