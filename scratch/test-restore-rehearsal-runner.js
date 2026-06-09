'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  const scopes = [
    'postgres_recovery', 'redis_recovery', 'render_redeploy_recovery',
    'telegram_webhook_recovery', 'github_actions_recovery', 'dashboard_recovery',
    'config_recovery', 'secret_rotation_rehearsal'
  ];

  for (const scope of scopes) {
    // Run rehearsal
    const result = await dr.restoreRehearsalRunner.runRestoreRehearsal(scope, {});
    assert(result.ok, `${scope} rehearsal returns ok`);
    assert(result.rehearsal.scope === scope, `${scope} rehearsal scope correct`);
    assert(result.rehearsal.result === 'completed', `${scope} rehearsal completed`);

    const report = result.report;
    assert(report.ok, `${scope} rehearsal report ok`);
    assert(report.report.note.includes('REHEARSAL_ONLY'),
      `${scope} report includes REHEARSAL_ONLY notice`);
    assert(report.report.requiresProposal, `${scope} report requires proposal`);
  }

  // Invalid scope
  const bad = await dr.restoreRehearsalRunner.runRestoreRehearsal('bogus_scope', {});
  assert(!bad.ok, 'invalid scope returns error');

  // Simulate step
  const stepResult = await dr.restoreRehearsalRunner.simulateRestoreStep(
    { step: 1, action: 'Test restore action' }, {});
  assert(stepResult.ok, 'simulateRestoreStep returns ok');
  assert(stepResult.status === 'simulated', 'simulateRestoreStep status is simulated');

  // Simulate null step
  const nullStep = await dr.restoreRehearsalRunner.simulateRestoreStep(null, {});
  assert(!nullStep.ok, 'simulateRestoreStep rejects null');

  // Validate prerequisites
  const prereqs = await dr.restoreRehearsalRunner.validateRestorePrerequisites('postgres_recovery', {});
  assert(prereqs.ok, 'validateRestorePrerequisites returns ok for postgres_recovery');

  const invalidPrereqs = await dr.restoreRehearsalRunner.validateRestorePrerequisites('bogus', {});
  assert(!invalidPrereqs.ok, 'validateRestorePrerequisites rejects invalid scope');

  // Build report from null
  const nullReport = dr.restoreRehearsalRunner.buildRestoreRehearsalReport(null, {});
  assert(!nullReport.ok, 'buildRestoreRehearsalReport rejects null');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
