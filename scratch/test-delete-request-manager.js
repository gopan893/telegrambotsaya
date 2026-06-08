'use strict';

const drm = require('../src/privacy/delete-request-manager');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test createDeleteRequest creates with softDeleteOnly=true
const req = drm.createDeleteRequest({ userId: 'user1', categories: ['telegram_messages'], reason: 'cleanup' });
assert(req.id, 'delete request has id');
assert(req.softDeleteOnly === true, 'softDeleteOnly defaults to true');
assert(req.hardDeleteRequested === false, 'hardDeleteRequested defaults to false');
assert(req.status === 'draft', 'status is draft');
assert(req.userId === 'user1', 'userId correct');

// Test createDeleteRequest with hard delete
const hardReq = drm.createDeleteRequest({ hardDeleteRequested: true });
assert(hardReq.hardDeleteRequested === true, 'hardDeleteRequested set to true');
assert(hardReq.riskLevel === 'high', 'riskLevel is high for hard delete');

// Test validateDeleteRequest catches no categories
const invalidReq = drm.validateDeleteRequest({ categories: [] });
assert(invalidReq.valid === false, 'empty categories invalid');
assert(invalidReq.issues.includes('No categories selected'), 'no categories issue');

// Test validateDeleteRequest passes valid
const validReq = drm.validateDeleteRequest({ categories: ['telegram_messages'] });
assert(validReq.valid === true, 'valid categories passes');

// Test blockUnsafeHardDelete blocks audit log hard delete
const auditHardDelete = drm.blockUnsafeHardDelete({ hardDeleteRequested: true, categories: ['audit_logs'] });
assert(auditHardDelete.blocked === true, 'audit log hard delete blocked');
assert(auditHardDelete.reason.includes('audit/security'), 'correct reason');

// Test blockUnsafeHardDelete passes for non-hard
const softDelete = drm.blockUnsafeHardDelete({ hardDeleteRequested: false });
assert(softDelete.blocked === false, 'soft delete not blocked');

// Test createDeleteProposal returns proposal
const proposal = drm.createDeleteProposal(req.id);
assert(proposal, 'proposal created');
assert(proposal.proposalId, 'proposal has proposalId');
assert(proposal.status === 'pending_approval', 'proposal status pending_approval');

// Test executeApprovedSoftDelete requires approved
const notApproved = drm.executeApprovedSoftDelete(req.id);
assert(notApproved.executed === false, 'draft delete not executed');
assert(notApproved.reason === 'Not approved', 'correct reason for not executed');

// Test listRequests
const allReqs = drm.listRequests();
assert(Array.isArray(allReqs), 'listRequests returns array');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
