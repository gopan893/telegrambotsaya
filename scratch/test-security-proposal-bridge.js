'use strict';

const bridge = require('../src/security/security-proposal-bridge');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. createSecurityRepairPlan returns valid plan
const plan = bridge.createSecurityRepairPlan({ id: 'finding-123' });
assert(plan.id, 'Repair plan has id');
assertEq(plan.type, 'security_repair', 'Repair plan type is security_repair');
assertEq(plan.findingId, 'finding-123', 'Repair plan has findingId');
assert(Array.isArray(plan.steps), 'Repair plan has steps array');

// 2. createSecurityRepairPlan with null
const planNull = bridge.createSecurityRepairPlan(null);
assert(planNull.id, 'Null repair plan still has id');
assertEq(planNull.findingId, null, 'Null input findingId is null');

// 3. createSecurityExecutorProposal returns proposal with requiresEvaluationV2
const proposal = bridge.createSecurityExecutorProposal(plan);
assert(proposal.id, 'Proposal has id');
assertEq(proposal.requiresEvaluationV2, true, 'Proposal requiresEvaluationV2 is true');
assertEq(proposal.requiresExecutorApproval, true, 'Proposal requiresExecutorApproval is true');
assertEq(proposal.requiresOwnerApproval, true, 'Proposal requiresOwnerApproval is true');

// 4. createSecurityExecutorProposal with null plan
const proposalNull = bridge.createSecurityExecutorProposal(null);
assert(proposalNull.id, 'Null plan proposal has id');
assertEq(proposalNull.planId, null, 'Null plan proposal planId is null');

// 5. linkSecurityFindingToProposal links correctly
const link = bridge.linkSecurityFindingToProposal('finding-1', 'proposal-1');
assert(link.linked === true, 'link returns linked: true');
assertEq(link.findingId, 'finding-1', 'Link has findingId');
assertEq(link.proposalId, 'proposal-1', 'Link has proposalId');

// 6. listProposals returns array
const proposals = bridge.listProposals();
assert(Array.isArray(proposals), 'listProposals returns array');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
