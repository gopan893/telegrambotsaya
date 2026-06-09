'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  // Check backup availability (no backups)
  const backup = await dr.recoveryReadinessGate.checkBackupAvailability({});
  assert(!backup.ok, 'checkBackupAvailability returns not ok with no data');
  assert(backup.detected === false, 'no backups detected');

  // Check encryption readiness
  const encryption = await dr.recoveryReadinessGate.checkBackupEncryptionReadiness({});
  assert(typeof encryption.ok === 'boolean', 'checkBackupEncryptionReadiness returns ok');
  assert(encryption.encryptionRequired === false, 'encryption not required by default');

  // Check restore rehearsal status (none run)
  const rehearsal = await dr.recoveryReadinessGate.checkRestoreRehearsalStatus({});
  assert(!rehearsal.ok, 'checkRestoreRehearsalStatus returns not ok with no rehearsals');

  // Record a rehearsal and check again
  const scope = 'postgres_recovery';
  await dr.restoreRehearsalRunner.runRestoreRehearsal(scope, {});
  const rehearsalOk = await dr.recoveryReadinessGate.checkRestoreRehearsalStatus({});
  assert(rehearsalOk.ok, 'checkRestoreRehearsalStatus returns ok after rehearsal');
  assert(rehearsalOk.rehearsalsRun >= 1, 'at least 1 rehearsal recorded');
  assert(rehearsalOk.latestRehearsalScope === scope, 'latest rehearsal scope correct');

  // Check recovery docs ready
  const docs = await dr.recoveryReadinessGate.checkRecoveryDocsReady({});
  assert(typeof docs.ok === 'boolean', 'checkRecoveryDocsReady returns ok');

  // Check critical env documented
  const env = await dr.recoveryReadinessGate.checkCriticalEnvDocumented({});
  assert(env.ok, 'checkCriticalEnvDocumented returns ok');
  assert(env.documentedEnvNames.length > 0, 'documented env names list non-empty');
  assert(env.note.includes('No actual values'), 'no actual values exposed');

  // Run full gate
  const gate = await dr.recoveryReadinessGate.runRecoveryReadinessGate({});
  assert(typeof gate.ok === 'boolean', 'runRecoveryReadinessGate returns ok');
  assert(typeof gate.gateResult === 'string', 'gate has gateResult');
  assert(['ready', 'warning', 'blocked', 'unknown'].includes(gate.gateResult), 'gateResult is valid value');
  assert(gate.checks.backup !== undefined, 'gate has backup check');
  assert(gate.checks.encryption !== undefined, 'gate has encryption check');
  assert(gate.checks.rehearsal !== undefined, 'gate has rehearsal check');
  assert(gate.checks.docs !== undefined, 'gate has docs check');
  assert(gate.checks.env !== undefined, 'gate has env check');

  // Build report
  const report = dr.recoveryReadinessGate.buildRecoveryReadinessReport(gate, {});
  assert(typeof report.gateResult === 'string', 'report has gateResult');
  assert(report.passCount >= 0, 'report has passCount');
  assert(report.totalChecks === 5, 'report has 5 total checks');
  assert(report.summary.length > 0, 'report has summary');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
