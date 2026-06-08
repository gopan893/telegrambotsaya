'use strict';

const rp = require('../src/privacy/retention-policy-manager');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test getRetentionPolicy returns defaults for known categories
const sessPolicy = rp.getRetentionPolicy('telegram_session_context');
assert(sessPolicy.retentionDays === 30, 'telegram_session_context retentionDays is 30');
assert(sessPolicy.archiveAfterDays === 7, 'telegram_session_context archiveAfterDays is 7');
assert(sessPolicy.hardDeleteAllowed === false, 'telegram_session_context hardDeleteAllowed is false');

const auditPolicy = rp.getRetentionPolicy('audit_logs');
assert(auditPolicy.retentionDays === 180, 'audit_logs retentionDays is 180');

// Test getRetentionPolicy returns default for unknown category
const unknownPolicy = rp.getRetentionPolicy('unknown');
assert(unknownPolicy.retentionDays === 90, 'unknown category default retentionDays is 90');
assert(unknownPolicy.defaultAction === 'keep', 'unknown category default action is keep');

// Test updateRetentionPolicy creates entry
const updated = rp.updateRetentionPolicy({ dataCategory: 'test_retention', retentionDays: 60 });
assert(updated.id, 'updateRetentionPolicy creates id');
assert(updated.dataCategory === 'test_retention', 'updated policy has correct category');
assert(updated.retentionDays === 60, 'updated policy has correct retentionDays');

// Test findRetentionCandidates returns array
const candidates = rp.findRetentionCandidates();
assert(Array.isArray(candidates), 'findRetentionCandidates returns array');
assert(candidates.length > 0, 'candidates array not empty');

// Test createRetentionActionPlan has candidates
const plan = rp.createRetentionActionPlan(candidates);
assert(plan.id, 'plan has id');
assert(plan.candidates, 'plan has candidates');
assert(plan.candidates.length === candidates.length, 'plan candidates count matches');

// Test validateRetentionPolicy detects invalid
const invalidPolicy = { retentionDays: 0, hardDeleteAllowed: true };
const validResult = rp.validateRetentionPolicy(invalidPolicy);
assert(validResult.valid === false, 'invalid policy detected');
assert(validResult.issues.length > 0, 'invalid policy has issues');

// Test validateRetentionPolicy passes for valid
const goodPolicy = { retentionDays: 90, hardDeleteAllowed: false, requiresApprovalForDelete: true };
const goodResult = rp.validateRetentionPolicy(goodPolicy);
assert(goodResult.valid === true, 'valid policy passes');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
