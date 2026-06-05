'use strict';

const store = require('../src/deploy/deploy-release-store');
const rollback = require('../src/deploy/rollback-plan-generator');
const rcm = require('../src/deploy/release-candidate-manager');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- rollback-plan-generator ---');
store.clear();
const rc = rcm.createReleaseCandidate({ branch: 'main', commitSha: 'abc123' });

const noPlan = rollback.createRollbackPlan('nonexistent', {}, {});
assert(noPlan.ok === false, 'nonexistent deploy plan returns error');

const deployStore = require('../src/deploy/deploy-release-store');
deployStore.addDeployPlan({ id: 'dp-test', branch: 'main', commitSha: 'abc123', blockers: [] });

const plan = rollback.createRollbackPlan('dp-test', { reason: 'Deploy failed' }, {});
assert(plan.ok === true, 'createRollbackPlan ok');
assert(plan.plan.status === 'draft', 'rollback status draft');
assert(plan.plan.executorApprovalRequired === true, 'executor approval required');

const riskSummary = rollback.buildRollbackRiskSummary(plan.plan);
assert(riskSummary.includes('Risk Level'), 'risk summary includes level');

const proposal = rollback.createRollbackProposal(plan.plan.id, {});
assert(proposal.ok === true, 'createRollbackProposal ok');
assert(proposal.proposal.status === 'pending_approval', 'proposal pending');

const approved = rollback.approveRollbackProposal(proposal.proposal.id);
assert(approved.ok === true, 'approveRollbackProposal ok');
assert(approved.proposal.status === 'approved', 'status approved');

const doubleApprove = rollback.approveRollbackProposal(proposal.proposal.id);
assert(doubleApprove.ok === true, 'double approve does not reject'); // idempotent

const rejected = rollback.rejectRollbackProposal('nonexistent', 'reason');
assert(rejected.ok === false, 'reject nonexistent returns error');

const linked = rollback.linkRollbackPlanToProposal(plan.plan.id, 'prop-1');
assert(linked.ok === true, 'linkRollbackPlanToProposal ok');

const detection = rollback.detectLastKnownGoodRelease({});
assert(typeof detection.releaseId === 'string' || detection.releaseId === null, 'detectLastKnownGoodRelease returns data');

const emptyRisk = rollback.buildRollbackRiskSummary(null);
assert(typeof emptyRisk === 'string', 'null risk summary returns string');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
