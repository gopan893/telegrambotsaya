'use strict';

const store = require('../src/deploy/deploy-release-store');
const proposalBuilder = require('../src/deploy/deploy-proposal-builder');
const planGen = require('../src/deploy/deploy-plan-generator');
const rcm = require('../src/deploy/release-candidate-manager');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- deploy-proposal-builder ---');
store.clear();
const rc = rcm.createReleaseCandidate({ branch: 'main' });
const plan = planGen.createDeployPlan(rc.candidate.id, { provider: 'render' }, {});

const noProposal = proposalBuilder.createDeployProposal('nonexistent', {});
assert(noProposal.ok === false, 'nonexistent plan returns error');

const proposal = proposalBuilder.createDeployProposal(plan.plan.id, {});
assert(proposal.ok === true, 'createDeployProposal ok');
assert(proposal.proposal.executorApproval === null, 'no approval yet');

const evalGate = proposalBuilder.runDeployEvaluationGate(plan.plan, null, {});
assert(evalGate.ok === false, 'eval gate fails without eval system');

const executorProp = proposalBuilder.createExecutorProposalForDeploy(plan.plan, null, {});
assert(executorProp.ok === false, 'executor proposal fails without executor system');

const mockExecutor = { createProposal: (input) => ({ id: 'exec-1', ...input }) };
const executorProp2 = proposalBuilder.createExecutorProposalForDeploy(plan.plan, mockExecutor, {});
assert(executorProp2.ok === true, 'executor proposal with mock ok');
assert(executorProp2.executorProposalId === 'exec-1', 'executor proposal id set');

const linked = proposalBuilder.linkDeployPlanToProposal(plan.plan.id, 'prop-1');
assert(linked.ok === true, 'linkDeployPlanToProposal ok');

const status = proposalBuilder.getDeployProposalStatus(plan.plan.id);
assert(status.ok === true, 'getDeployProposalStatus ok');
assert(status.proposalId === proposal.proposal.id, 'correct proposal id');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
