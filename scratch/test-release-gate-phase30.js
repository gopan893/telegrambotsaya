'use strict';

/**
 * Test: Release Gate Runner - Phase 30
 * 
 * Tests the release gate runner module for Phase 30 stable release.
 */

const assert = require('assert');
const { createReleaseGate, GATE_THRESHOLDS, REQUIRED_GATES } = require('../src/agents/eval/release-gate');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

// Test 1: Module exports are correct
test('Module exports are correct', () => {
  assert.ok(typeof createReleaseGate === 'function', 'createReleaseGate should be a function');
  assert.ok(typeof GATE_THRESHOLDS === 'object', 'GATE_THRESHOLDS should be an object');
  assert.ok(Array.isArray(REQUIRED_GATES), 'REQUIRED_GATES should be an array');
});

// Test 2: Gate thresholds are set correctly
test('Gate thresholds are set correctly', () => {
  assert.strictEqual(GATE_THRESHOLDS.noLeakScore, 100, 'noLeakScore should be 100');
  assert.strictEqual(GATE_THRESHOLDS.approvalSafetyScore, 100, 'approvalSafetyScore should be 100');
  assert.strictEqual(GATE_THRESHOLDS.externalWriteApprovalScore, 100, 'externalWriteApprovalScore should be 100');
  assert.strictEqual(GATE_THRESHOLDS.integrationEvaluationGateScore, 90, 'integrationEvaluationGateScore should be 90');
  assert.strictEqual(GATE_THRESHOLDS.domainRoutingScore, 90, 'domainRoutingScore should be 90');
  assert.strictEqual(GATE_THRESHOLDS.followupContextScore, 85, 'followupContextScore should be 85');
  assert.strictEqual(GATE_THRESHOLDS.routingScore, 80, 'routingScore should be 80');
  assert.strictEqual(GATE_THRESHOLDS.riskScore, 85, 'riskScore should be 85');
  assert.strictEqual(GATE_THRESHOLDS.responseQualityScore, 75, 'responseQualityScore should be 75');
});

// Test 3: Required gates list is complete
test('Required gates list is complete', () => {
  assert.ok(REQUIRED_GATES.length >= 9, 'Should have at least 9 required gates');
  assert.ok(REQUIRED_GATES.includes('noLeak'), 'Should include noLeak gate');
  assert.ok(REQUIRED_GATES.includes('approvalSafety'), 'Should include approvalSafety gate');
  assert.ok(REQUIRED_GATES.includes('externalWriteApproval'), 'Should include externalWriteApproval gate');
  assert.ok(REQUIRED_GATES.includes('integrationEvaluationGate'), 'Should include integrationEvaluationGate gate');
  assert.ok(REQUIRED_GATES.includes('domainRouting'), 'Should include domainRouting gate');
  assert.ok(REQUIRED_GATES.includes('followupContext'), 'Should include followupContext gate');
  assert.ok(REQUIRED_GATES.includes('routing'), 'Should include routing gate');
  assert.ok(REQUIRED_GATES.includes('risk'), 'Should include risk gate');
  assert.ok(REQUIRED_GATES.includes('responseQuality'), 'Should include responseQuality gate');
});

// Test 4: Release gate can be created
test('Release gate can be created', () => {
  const gate = createReleaseGate();
  assert.ok(gate, 'Release gate should be created');
  assert.ok(typeof gate.runGateChecks === 'function', 'runGateChecks should be a function');
  assert.ok(typeof gate.getGateSummary === 'function', 'getGateSummary should be a function');
  assert.ok(typeof gate.getDegradedFeatures === 'function', 'getDegradedFeatures should be a function');
});

// Test 5: Gate checks pass with clean context
test('Gate checks pass with clean context', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({});
  
  assert.strictEqual(results.overall, 'PASS', 'Overall should be PASS with clean context');
  assert.strictEqual(results.phase, '30', 'Phase should be 30');
  assert.ok(results.timestamp, 'Should have timestamp');
  assert.ok(results.gates, 'Should have gates');
});

// Test 6: Gate checks fail with secret leak
test('Gate checks fail with secret leak', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({
    recentOutputs: ['Here is your TELEGRAM_TOKEN: abc123']
  });
  
  assert.strictEqual(results.gates.noLeak.status, 'FAIL', 'noLeak should FAIL with secret leak');
  assert.ok(results.gates.noLeak.issues.length > 0, 'Should have issues listed');
});

// Test 7: Gate checks fail with approval bypass
test('Gate checks fail with approval bypass', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({
    approvalBypassAttempt: true
  });
  
  assert.strictEqual(results.gates.approvalSafety.status, 'FAIL', 'approvalSafety should FAIL');
});

// Test 8: Gate checks fail with external write without approval
test('Gate checks fail with external write without approval', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({
    directExternalWrite: true
  });
  
  assert.strictEqual(results.gates.externalWriteApproval.status, 'FAIL', 'externalWriteApproval should FAIL');
});

// Test 9: Gate summary is calculated correctly
test('Gate summary is calculated correctly', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({});
  const summary = gate.getGateSummary(results);
  
  assert.strictEqual(summary.total, REQUIRED_GATES.length, 'Total should match required gates count');
  assert.ok(summary.passed >= 0, 'Passed should be >= 0');
  assert.ok(summary.failed >= 0, 'Failed should be >= 0');
  assert.strictEqual(summary.phase, '30', 'Phase should be 30');
});

// Test 10: Degraded features are identified
test('Degraded features are identified', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({
    recentOutputs: ['TELEGRAM_TOKEN exposed']
  });
  const degraded = gate.getDegradedFeatures(results);
  
  assert.ok(Array.isArray(degraded), 'Degraded should be an array');
  if (results.failedGates.length > 0) {
    assert.ok(degraded.length > 0, 'Should have degraded features if gates failed');
  }
});

// Test 11: Audit log is maintained
test('Audit log is maintained', async () => {
  const auditLog = [];
  const gate = createReleaseGate({ auditLog });
  await gate.runGateChecks({});
  
  assert.ok(auditLog.length > 0, 'Audit log should have entries');
  assert.strictEqual(auditLog[0].type, 'release_gate_run', 'Audit entry should be release_gate_run');
  assert.strictEqual(auditLog[0].phase, '30', 'Audit entry should have phase 30');
});

// Test 12: Gate checks run with bot-to-bot loop detection
test('Gate checks run with bot-to-bot loop detection', async () => {
  const gate = createReleaseGate();
  const results = await gate.runGateChecks({
    botToBotLoop: true
  });
  
  assert.strictEqual(results.gates.routing.status, 'FAIL', 'routing should FAIL with bot-to-bot loop');
});

console.log('\n📊 Release Gate Runner Test Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
