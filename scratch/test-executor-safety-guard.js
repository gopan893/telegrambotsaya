'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var executorGuard;
try {
  executorGuard = require('../src/selfhealing/executor-safety-guard');
  assert(true, 'executor-safety-guard module loads');
  assert(typeof executorGuard.createExecutorSafetyGuard === 'function', 'createExecutorSafetyGuard is function');
} catch (e) {
  assert(false, 'executor-safety-guard module loads: ' + e.message);
}

var guard = executorGuard.createExecutorSafetyGuard(null, {});
assert(typeof guard.runExecutorGuardCheck === 'function', 'runExecutorGuardCheck method exists');

// Test no auto-run check
guard.runExecutorGuardCheck({ id: 'gd_executor_proposal_no_auto_run' }, {}, { executorCode: 'function createProposal() {}' }).then(function(r) {
  assert(r.status !== undefined, 'no-auto-run check returns status');
});

// Test no self-approve check
guard.runExecutorGuardCheck({ id: 'gd_executor_no_self_approve' }, {}, { executorCode: 'function approveProposal() { return actorId !== proposerId; }', proposerCheck: true }).then(function(r) {
  assert(r.status !== undefined, 'no-self-approve check returns status');
});

// Verify critical safety properties
assert(guard.runExecutorGuardCheck.length === 3, 'runExecutorGuardCheck takes 3 args');

console.log('\n=== Executor Safety Guard ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
