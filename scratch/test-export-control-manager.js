'use strict';

const ecm = require('../src/privacy/export-control-manager');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test createExportRequest creates draft
const req = ecm.createExportRequest({ workspaceId: 'ws1', categories: ['knowledge_graph'], format: 'json' });
assert(req.id, 'export request has id');
assert(req.status === 'draft', 'export request status is draft');
assert(req.workspaceId === 'ws1', 'export request workspaceId correct');
assert(req.format === 'json', 'export request format correct');

// Test createExportRequest with many categories triggers approval
const bigReq = ecm.createExportRequest({ categories: ['a', 'b', 'c', 'd'] });
assert(bigReq.requiresApproval === true, '4+ categories requires approval');

// Test validateExportRequest catches missing categories
const invalidReq = { categories: [] };
const invalidResult = ecm.validateExportRequest(invalidReq);
assert(invalidResult.valid === false, 'empty categories invalid');
assert(invalidResult.issues.includes('No categories selected'), 'correct issue message');

// Test validateExportRequest passes valid request
const validResult = ecm.validateExportRequest({ categories: ['knowledge_graph'] });
assert(validResult.valid === true, 'valid export request passes');

// Test runExportPrivacyReview blocks secret_blocked
const blockedReq = { categories: ['secret_blocked', 'knowledge_graph'] };
const blockedResult = ecm.runExportPrivacyReview(blockedReq);
assert(blockedResult.blocked === true, 'secret_blocked category blocked');
assert(blockedResult.reason.includes('secret_blocked'), 'reason mentions blocked category');

// Test runExportPrivacyReview passes clean request
const cleanReq = { categories: ['knowledge_graph', 'project_goals'] };
const cleanResult = ecm.runExportPrivacyReview(cleanReq);
assert(cleanResult.blocked === false, 'clean categories pass review');

// Test buildExportManifest has correct fields
const manifest = ecm.buildExportManifest(req);
assert(manifest.exportId === req.id, 'manifest exportId matches');
assert(manifest.categories, 'manifest has categories');
assert(manifest.format === 'json', 'manifest format correct');
assert(typeof manifest.recordCount === 'number', 'manifest recordCount is number');

// Test createExportProposal returns proposal
const proposal = ecm.createExportProposal(req.id);
assert(proposal, 'proposal created');
assert(proposal.proposalId, 'proposal has proposalId');
assert(proposal.status === 'pending_approval', 'proposal status pending_approval');

// Test listExports
const allExports = ecm.listExports();
assert(Array.isArray(allExports), 'listExports returns array');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
