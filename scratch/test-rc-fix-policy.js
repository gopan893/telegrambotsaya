'use strict';

const RcFixPolicy = require('../src/release/rc-fix-policy');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('\n=== RC Fix Policy Tests ===\n');

// 1. evaluateRcFixAllowed - P0 fix allowed
const p0Change = { type: 'fix', description: 'boot crash fix', priority: 'P0' };
const p0Result = RcFixPolicy.evaluateRcFixAllowed(p0Change);
assert(p0Result.allowed === true, 'P0 boot crash fix allowed');

// 2. evaluateRcFixAllowed - P1 fix allowed
const p1Change = { type: 'fix', description: 'dashboard route missing fix', priority: 'P1' };
const p1Result = RcFixPolicy.evaluateRcFixAllowed(p1Change);
assert(p1Result.allowed === true, 'P1 dashboard route fix allowed');

// 3. evaluateRcFixAllowed - docs update allowed
const docsChange = { type: 'docs_update', description: 'update stabilization report' };
const docsResult = RcFixPolicy.evaluateRcFixAllowed(docsChange);
assert(docsResult.allowed === true, 'docs update allowed');

// 4. evaluateRcFixAllowed - test update allowed
const testChange = { type: 'test_update', description: 'fix failing test' };
const testResult = RcFixPolicy.evaluateRcFixAllowed(testChange);
assert(testResult.allowed === true, 'test update allowed');

// 5. evaluateRcFixAllowed - new feature blocked
const featChange = { type: 'new_feature', description: 'new AI agent system' };
const featResult = RcFixPolicy.evaluateRcFixAllowed(featChange);
assert(featResult.allowed === false, 'new feature blocked');

// 6. evaluateRcFixAllowed - new module blocked
const modChange = { type: 'new_module', description: 'new connector module' };
const modResult = RcFixPolicy.evaluateRcFixAllowed(modChange);
assert(modResult.allowed === false, 'new module blocked');

// 7. evaluateRcFixAllowed - shell executor blocked
const shellChange = { type: 'fix', description: 'add shell executor feature' };
const shellResult = RcFixPolicy.evaluateRcFixAllowed(shellChange);
assert(shellResult.allowed === false, 'shell executor blocked');

// 8. evaluateRcFixAllowed - auto approve blocked
const autoApproveChange = { type: 'fix', description: 'enable auto approve' };
const autoApproveResult = RcFixPolicy.evaluateRcFixAllowed(autoApproveChange);
assert(autoApproveResult.allowed === false, 'auto approve blocked');

// 9. evaluateRcFixAllowed - no type specified
const noTypeResult = RcFixPolicy.evaluateRcFixAllowed({});
assert(noTypeResult.allowed === false, 'no type change blocked');

// 10. assertNoLargeFeatureChange
assert(RcFixPolicy.assertNoLargeFeatureChange({ type: 'fix', description: 'small bug' }).allowed === true, 'small fix not blocked by large feature check');
assert(RcFixPolicy.assertNoLargeFeatureChange({ type: 'large_refactor', description: 'refactor all' }).allowed === false, 'large refactor blocked');
assert(RcFixPolicy.assertNoLargeFeatureChange({ type: 'new_agent', description: 'new agent' }).allowed === false, 'new agent blocked');

// 11. assertNoUnsafeCapabilityAdded
assert(RcFixPolicy.assertNoUnsafeCapabilityAdded({ description: 'shell executor support' }).allowed === false, 'shell executor unsafe');
assert(RcFixPolicy.assertNoUnsafeCapabilityAdded({ description: 'add new dashboard metric' }).allowed === true, 'safe capability allowed');

// 12. assertFixIsP0OrP1
assert(RcFixPolicy.assertFixIsP0OrP1({ priority: 'P0', description: 'fix' }).allowed === true, 'P0 fix allowed');
assert(RcFixPolicy.assertFixIsP0OrP1({ priority: 'P1', description: 'fix' }).allowed === true, 'P1 fix allowed');
assert(RcFixPolicy.assertFixIsP0OrP1({ priority: 'P2', description: 'nice to have' }).allowed === false, 'P2 fix blocked');

// 13. buildRcFixPolicyDecision
const decision = RcFixPolicy.buildRcFixPolicyDecision({ type: 'fix', description: 'test fix', allowed: true, classification: 'P0' });
assert(decision.allowed === true, 'decision allowed = true');
assert(decision.change.type === 'fix', 'decision change type');
assert(decision.policy === 'rc-stabilization-fix-policy-v1', 'decision policy name');

console.log(`\nResult: ${passed} PASS, ${failed} FAIL\n`);
process.exit(failed > 0 ? 1 : 0);
