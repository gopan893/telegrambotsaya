'use strict';

const acp = require('../src/privacy/archive-cleanup-planner');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test createArchiveCleanupPlan creates draft
const plan = acp.createArchiveCleanupPlan({ workspaceId: 'ws1', categories: ['audit_logs', 'security_findings'] });
assert(plan.id, 'plan has id');
assert(plan.status === 'draft', 'plan status is draft');
assert(plan.workspaceId === 'ws1', 'plan workspaceId correct');

// Test createArchiveCleanupPlan creates actions per category
assert(plan.actions.length === 2, 'plan has 2 actions');
assert(plan.actions[0].category === 'audit_logs', 'first action category correct');
assert(plan.actions[0].action === 'archive', 'action type is archive');

// Test createArchiveCleanupPlan with >2 categories requires approval
const bigPlan = acp.createArchiveCleanupPlan({ categories: ['a', 'b', 'c'] });
assert(bigPlan.requiresApproval === true, '3 categories requires approval');

// Test findArchiveCandidates returns count
const candidates = acp.findArchiveCandidates('audit_logs');
assert(candidates.category === 'audit_logs', 'candidates category correct');
assert(typeof candidates.candidates === 'number', 'candidates count is number');
assert(candidates.action === 'archive', 'candidates action is archive');

// Test createArchiveProposal returns proposal
const proposal = acp.createArchiveProposal(plan.id);
assert(proposal, 'proposal created');
assert(proposal.proposalId, 'proposal has proposalId');
assert(proposal.planId === plan.id, 'proposal planId matches');
assert(proposal.status === 'pending_approval', 'proposal status pending_approval');

// Test executeApprovedArchivePlan requires approved status
const notApproved = acp.executeApprovedArchivePlan(plan.id);
assert(notApproved.executed === false, 'draft plan not executed');
assert(notApproved.reason === 'Plan not approved', 'correct reason');

// Test findDuplicatePrivateData
const dups = acp.findDuplicatePrivateData();
assert(Array.isArray(dups), 'findDuplicatePrivateData returns array');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
