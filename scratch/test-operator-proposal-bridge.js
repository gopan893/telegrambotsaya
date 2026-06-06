'use strict';

const bridge = require('../src/operator/operator-proposal-bridge');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-proposal-bridge');

const r1 = bridge.createOperatorActionPlan(null);
assert(r1.ok === false, 'null action plan');

const task = { id: 't1', title: 'Implement feature', type: 'coding', riskLevel: 'medium' };
const r2 = bridge.createOperatorActionPlan(task);
assert(r2.ok === true, 'action plan created');
assert(r2.actionPlan.sourceId === 't1', 'linked to source');
assert(r2.actionPlan.actions.length > 0, 'has actions');

const r3 = bridge.createOperatorExecutorProposal(r2.actionPlan);
assert(r3.ok === true, 'executor proposal created');
assert(r3.proposal.status === 'pending_approval', 'proposal pending');

const r4 = bridge.linkOperatorProposal('t1', r3.proposal.id);
assert(r4.ok === true, 'link proposal');

const r5 = bridge.getOperatorLinkedProposals('t1');
assert(r5.length > 0, 'linked proposals found');

const r6 = bridge.createOperatorActionPlan({ id: 't2', title: 'Deploy', type: 'deployment', riskLevel: 'high', requiresApproval: true });
assert(r6.ok === true, 'deployment action plan');
assert(r6.actionPlan.actions.some(a => a.danger), 'danger action detected');

const r7 = bridge.createOperatorExecutorProposal(r6.actionPlan);
assert(r7.ok === true, 'deploy proposal');
assert(r7.proposal.requiresEvaluation === true, 'deploy requires eval');

bridge.clearProposals();
const r8 = bridge.listAllProposals();
assert(r8.length === 0, 'proposals cleared');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
