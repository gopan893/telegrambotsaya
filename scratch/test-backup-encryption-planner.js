'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  // Create encryption plan
  const plan = dr.backupEncryptionPlanner.createBackupEncryptionPlan('default', {});
  assert(plan.ok, 'createBackupEncryptionPlan returns ok');
  assert(plan.plan.envNames.includes('BACKUP_ENCRYPTION_KEY'), 'plan includes BACKUP_ENCRYPTION_KEY');
  assert(plan.plan.manualKeyCreationInstructions.length > 0, 'plan has key creation instructions');
  assert(plan.plan.storageRecommendations.length > 0, 'plan has storage recommendations');
  assert(plan.plan.verificationSteps.length > 0, 'plan has verification steps');
  assert(plan.plan.restoreCompatibilityNotes.length > 0, 'plan has restore compatibility notes');

  // Create key rotation plan
  const rotation = dr.backupEncryptionPlanner.createBackupKeyRotationPlan({});
  assert(rotation.ok, 'createBackupKeyRotationPlan returns ok');
  assert(rotation.plan.envNames.includes('BACKUP_ENCRYPTION_KEY'), 'rotation plan has BACKUP_ENCRYPTION_KEY');
  assert(rotation.plan.manualChecklist.length > 0, 'rotation plan has manual checklist');
  assert(rotation.plan.riskConsiderations.length > 0, 'rotation plan has risk considerations');

  // Create metadata protection plan
  const metadata = dr.backupEncryptionPlanner.createBackupMetadataProtectionPlan({});
  assert(metadata.ok, 'createBackupMetadataProtectionPlan returns ok');
  assert(metadata.plan.metadataFields.length > 0, 'metadata plan has field list');
  assert(metadata.plan.sanitizationRules.length > 0, 'metadata plan has sanitization rules');

  // Build checklist
  const checklist = dr.backupEncryptionPlanner.buildBackupEncryptionChecklist(plan.plan, {});
  assert(checklist.ok, 'buildBackupEncryptionChecklist returns ok');
  assert(checklist.checklist.length > 0, 'checklist has items');

  // Checklist with null plan
  const badChecklist = dr.backupEncryptionPlanner.buildBackupEncryptionChecklist(null, {});
  assert(!badChecklist.ok, 'buildBackupEncryptionChecklist rejects null');

  // Verify no secret values in plans
  const planStr = JSON.stringify(plan);
  assert(!planStr.includes('sk-'), 'encryption plan does not contain secret values');
  assert(plan.plan.envNamesRequired.every(n => typeof n === 'string'), 'env names are strings');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
