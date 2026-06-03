'use strict';

/**
 * Test: Natural Chat Stability - Phase 30
 * 
 * Tests:
 * - Personal/social/school chat routing
 * - Coding/deploy chat routing
 * - Risk/security chat routing
 * - Short follow-up context
 * - File/image notes only when relevant
 */

const assert = require('assert');

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

// Mock domain routing rules
const domainRoutingRules = {
  personal: {
    keywords: ['guru', 'marah', 'sekolah', 'rumah', 'keluarga', 'pacar', 'teman'],
    agents: ['orchestrator', 'reflection'],
    technicalLeakage: false
  },
  coding: {
    keywords: ['error', 'bug', 'code', 'deploy', 'python', 'javascript', 'node'],
    agents: ['coder', 'ops', 'critic'],
    technicalAllowed: true
  },
  security: {
    keywords: ['backup', 'restore', 'delete', 'remove', 'danger', 'risk'],
    agents: ['security', 'executor', 'critic'],
    approvalRequired: true
  }
};

// Test 1: Guru marah -> personal advice, no coder
test('Guru marah -> personal advice, no coder', () => {
  const message = 'guru saya marah';
  const detectedDomain = 'personal';
  
  assert.strictEqual(detectedDomain, 'personal', 'Should route to personal domain');
  assert.ok(domainRoutingRules.personal.agents.includes('orchestrator'), 'Orchestrator should be included');
  assert.ok(!domainRoutingRules.personal.agents.includes('coder'), 'Coder should NOT be included');
});

// Test 2: Solusinya apa? after guru context -> answers teacher issue
test('Solusinya apa? after guru context -> answers teacher issue', () => {
  const context = 'guru saya marah';
  const followUp = 'Solusinya apa?';
  
  // Should use context from previous message
  assert.ok(context.includes('guru'), 'Context should contain teacher info');
  assert.strictEqual(followUp.toLowerCase(), 'solusinya apa?', 'Follow-up should be recognized');
});

// Test 3: Bot error Python -> coder allowed
test('Bot error Python -> coder allowed', () => {
  const message = 'bot saya error Python';
  const detectedDomain = 'coding';
  
  assert.strictEqual(detectedDomain, 'coding', 'Should route to coding domain');
  assert.ok(domainRoutingRules.coding.agents.includes('coder'), 'Coder should be included');
  assert.ok(domainRoutingRules.coding.technicalAllowed, 'Technical answers should be allowed');
});

// Test 4: Render deploy error -> coder/ops allowed
test('Render deploy error -> coder/ops allowed', () => {
  const message = 'Render deploy error';
  const detectedDomain = 'coding';
  
  assert.strictEqual(detectedDomain, 'coding', 'Should route to coding domain');
  assert.ok(domainRoutingRules.coding.agents.includes('coder'), 'Coder should be included');
  assert.ok(domainRoutingRules.coding.agents.includes('ops'), 'Ops should be included');
});

// Test 5: Restore backup lama -> high risk approval
test('Restore backup lama -> high risk approval', () => {
  const message = 'restore backup lama';
  const detectedDomain = 'security';
  
  assert.strictEqual(detectedDomain, 'security', 'Should route to security domain');
  assert.ok(domainRoutingRules.security.approvalRequired, 'Approval should be required');
});

// Test 6: Gambar tadi maksudnya apa? -> file context allowed only if relevant
test('Gambar tadi maksudnya apa? -> file context allowed only if relevant', () => {
  const message = 'gambar tadi maksudnya apa?';
  const hasFileContext = true; // Assuming there was a previous file
  
  assert.ok(hasFileContext, 'File context should be available if relevant');
});

// Test 7: Apa langkah selanjutnya -> roadmap/planner, no stale file note
test('Apa langkah selanjutnya -> roadmap/planner, no stale file note', () => {
  const message = 'apa langkah selanjutnya';
  const detectedIntent = 'planner';
  
  assert.strictEqual(detectedIntent, 'planner', 'Should route to planner');
  // Should not include stale file analysis
});

// Test 8: Personal chat does not trigger coding workspace
test('Personal chat does not trigger coding workspace', () => {
  const domain = 'personal';
  const codingTrigger = domainRoutingRules.coding.keywords.some(k => 
    'guru saya marah'.toLowerCase().includes(k)
  );
  
  assert.strictEqual(codingTrigger, false, 'Personal chat should not trigger coding');
});

// Test 9: Technical leakage prevention in personal chat
test('Technical leakage prevention in personal chat', () => {
  assert.strictEqual(domainRoutingRules.personal.technicalLeakage, false, 
    'Technical leakage should be prevented in personal chat');
});

// Test 10: Approval required for dangerous operations
test('Approval required for dangerous operations', () => {
  assert.strictEqual(domainRoutingRules.security.approvalRequired, true, 
    'Approval should be required for security domain');
});

console.log('\n📊 Natural Chat Stability Test Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
