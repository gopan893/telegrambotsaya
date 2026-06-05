'use strict';

const utils = require('../src/deploy/deploy-utils');
const store = require('../src/deploy/deploy-release-store');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- deploy-utils ---');
assert(typeof utils.now() === 'string', 'now() returns string');
assert(typeof utils.shortId() === 'string', 'shortId() returns string');
assert(utils.maskSecrets('TOKEN=abc') === 'TOKEN=[REDACTED]', 'maskSecrets works');
assert(utils.sanitizeEnvReport(null) === null, 'sanitizeEnvReport null returns null');
const report = utils.sanitizeEnvReport({ checks: [{ envName: 'TEST', required: true, present: true, ok: true }] });
assert(report.checks[0].envName === 'TEST', 'sanitizeEnvReport preserves envName');

console.log('\n--- deploy-release-store ---');
store.clear();
assert(store.getReleaseCandidates().length === 0, 'empty after clear');
store.addReleaseCandidate({ id: 'rc1' });
assert(store.getReleaseCandidates().length === 1, 'addReleaseCandidate works');
store.addDeployPlan({ id: 'dp1' });
assert(store.getDeployPlans().length === 1, 'addDeployPlan works');
store.addDeployProposal({ id: 'dpp1' });
assert(store.getDeployProposals().length === 1, 'addDeployProposal works');
store.addPostDeployReport({ id: 'pdr1' });
assert(store.getPostDeployReports().length === 1, 'addPostDeployReport works');
store.addRollbackPlan({ id: 'rb1' });
assert(store.getRollbackPlans().length === 1, 'addRollbackPlan works');
store.addRollbackProposal({ id: 'rbp1' });
assert(store.getRollbackProposals().length === 1, 'addRollbackProposal works');
store.addDeployGate({ id: 'dg1' });
assert(store.getDeployGates().length === 1, 'addDeployGate works');
store.addReleaseGate({ id: 'rg1' });
assert(store.getReleaseGates().length === 1, 'addReleaseGate works');
store.clear();
assert(store.getReleaseCandidates().length === 0, 'clear resets all');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
