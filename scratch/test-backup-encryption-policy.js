'use strict';

const dr = require('../src/disaster-recovery');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // Get default policy
  const policy = dr.backupEncryptionPolicy.getBackupEncryptionPolicy({});
  assert(policy, 'getBackupEncryptionPolicy returns policy');
  assert(policy.algorithm === 'none', 'default policy algorithm is none');
  assert(policy.encryptionRequired === false, 'default policy encryptionRequired is false');
  assert(policy.keySourceEnvName === 'BACKUP_ENCRYPTION_KEY', 'key source is BACKUP_ENCRYPTION_KEY');
  assert(policy.rotationRecommendedDays === 90, 'default rotation days is 90');

  // Validate policy
  const valid = dr.backupEncryptionPolicy.validateBackupEncryptionPolicy(policy, {});
  assert(valid.ok, 'validateBackupEncryptionPolicy returns ok');

  // Validate null
  const invalid = dr.backupEncryptionPolicy.validateBackupEncryptionPolicy(null, {});
  assert(!invalid.ok, 'validateBackupEncryptionPolicy rejects null');

  // Validate bad algorithm
  const badAlgo = dr.backupEncryptionPolicy.validateBackupEncryptionPolicy(
    { ...policy, algorithm: 'bad' }, {});
  assert(!badAlgo.ok, 'validateBackupEncryptionPolicy rejects bad algorithm');

  // Detect unencrypted risk
  const risk = dr.backupEncryptionPolicy.detectUnencryptedBackupRisk({});
  assert(!risk.ok, 'detectUnencryptedBackupRisk detects risk when not encrypted');
  assert(risk.risks.length > 0, 'risk has at least one issue');
  assert(risk.setupInstructions.length > 0, 'risk includes setup instructions');

  // Build report
  const report = dr.backupEncryptionPolicy.buildBackupEncryptionPolicyReport({});
  assert(report.ok === false, 'report shows encryption not OK');
  assert(report.report.encryptionEnabled === false, 'report shows encryption not enabled');
  assert(report.report.keySource === 'BACKUP_ENCRYPTION_KEY', 'report shows key source env name');
  assert(!report.report.hasKeyConfigured, 'report shows key not configured');

  // Custom policy via services
  const customPolicy = dr.backupEncryptionPolicy.getBackupEncryptionPolicy({
    encryptionPolicy: { encryptionRequired: true, algorithm: 'aes-256-gcm' }
  });
  assert(customPolicy.encryptionRequired, 'custom policy encryptionRequired is true');
  assert(customPolicy.algorithm === 'aes-256-gcm', 'custom policy algorithm is aes-256-gcm');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
