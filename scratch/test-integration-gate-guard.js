'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var integrationGuard;
try {
  integrationGuard = require('../src/selfhealing/integration-gate-guard');
  assert(true, 'integration-gate-guard module loads');
  assert(typeof integrationGuard.createIntegrationGateGuard === 'function', 'createIntegrationGateGuard is function');
} catch (e) {
  assert(false, 'integration-gate-guard module loads: ' + e.message);
}

var guard = integrationGuard.createIntegrationGateGuard(null, {});
assert(typeof guard.runIntegrationGuardCheck === 'function', 'runIntegrationGuardCheck method exists');

// Test evaluation gate check
guard.runIntegrationGuardCheck({ id: 'gd_integration_evaluation_gate_required' }, {}, { integrationCode: 'evaluation', evaluationGateRequired: true }).then(function(r) {
  assert(r.status !== undefined, 'eval gate check returns status');
});

// Test dry-run check
guard.runIntegrationGuardCheck({ id: 'gd_integration_dry_run_no_write' }, {}, { integrationCode: 'if (!dryRun) { /* write */ }' }).then(function(r) {
  assert(r.status !== undefined, 'dry-run check returns status');
});

assert(guard.runIntegrationGuardCheck.length === 3, 'runIntegrationGuardCheck takes 3 args');

console.log('\n=== Integration Gate Guard ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
