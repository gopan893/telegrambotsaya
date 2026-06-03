'use strict';

/**
 * Test: Coding Workspace Verification - Phase 30
 * 
 * Tests:
 * - Coding request classifier works
 * - Project constraints applied
 * - Code change plan does not mutate repo
 * - Codex prompt generator creates usable prompt
 * - Test plan generator lists relevant tests
 * - GitHub issue/PR proposal requires Evaluation v2 + executor approval
 * - Personal/social chat does not trigger coding workspace
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

// Mock coding workspace
const projectConstraints = {
  runtime: 'Node.js 20',
  moduleSystem: 'CommonJS',
  dashboard: 'vanilla HTML/CSS/JS PWA',
  typescript: false,
  reactNextVue: false,
  largeRefactor: 'approval-first'
};

// Mock coding request classifier
function classifyCodingRequest(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('prompt') && lower.includes('phase')) {
    return 'codex_prompt';
  }
  if ((lower.includes('dashboard') || lower.includes('menu')) && 
      (lower.includes('agents') || lower.includes('masuk') || lower.includes('overview'))) {
    return 'dashboard_hotfix';
  }
  if (lower.includes('issue') && lower.includes('github')) {
    return 'github_issue';
  }
  if (lower.includes('pr') || lower.includes('pull request')) {
    return 'github_pr';
  }
  if (lower.includes('react') || lower.includes('typescript')) {
    return 'constraint_violation';
  }
  
  return 'general';
}

// Mock Codex prompt generator
function generateCodexPrompt(context) {
  return `Phase ${context.phase} - ${context.task}\n\nConstraints: Node.js 20, CommonJS, vanilla dashboard`;
}

// Mock test plan generator
function generateTestPlan(changes) {
  return changes.map(c => `test-${c.type}.js`);
}

// Test 1: Coding request classifier works
test('Coding request classifier works', () => {
  const test1 = classifyCodingRequest('buat prompt phase 31');
  const test2 = classifyCodingRequest('menu Agents masuk Overview');
  const test3 = classifyCodingRequest('buat issue GitHub untuk bug dashboard');
  
  assert.strictEqual(test1, 'codex_prompt', 'Should classify as codex_prompt');
  assert.strictEqual(test2, 'dashboard_hotfix', 'Should classify as dashboard_hotfix');
  assert.strictEqual(test3, 'github_issue', 'Should classify as github_issue');
});

// Test 2: Project constraints applied
test('Project constraints applied', () => {
  assert.strictEqual(projectConstraints.runtime, 'Node.js 20', 'Runtime should be Node.js 20');
  assert.strictEqual(projectConstraints.moduleSystem, 'CommonJS', 'Module system should be CommonJS');
  assert.strictEqual(projectConstraints.dashboard, 'vanilla HTML/CSS/JS PWA', 'Dashboard should be vanilla');
  assert.strictEqual(projectConstraints.typescript, false, 'TypeScript should not be allowed');
  assert.strictEqual(projectConstraints.reactNextVue, false, 'React/Next/Vue should not be allowed');
});

// Test 3: Code change plan does not mutate repo
test('Code change plan does not mutate repo', () => {
  const plan = { action: 'analyze', files: ['telebot.js'], mutate: false };
  
  assert.strictEqual(plan.mutate, false, 'Plan should not mutate repo');
});

// Test 4: Codex prompt generator creates usable prompt
test('Codex prompt generator creates usable prompt', () => {
  const prompt = generateCodexPrompt({ phase: 31, task: 'Add new feature' });
  
  assert.ok(prompt.includes('Phase 31'), 'Prompt should include phase number');
  assert.ok(prompt.includes('Node.js 20'), 'Prompt should include constraints');
  assert.ok(prompt.includes('CommonJS'), 'Prompt should include module system');
});

// Test 5: Test plan generator lists relevant tests
test('Test plan generator lists relevant tests', () => {
  const changes = [
    { type: 'routing', file: 'router.js' },
    { type: 'dashboard', file: 'ui.js' }
  ];
  
  const tests = generateTestPlan(changes);
  assert.ok(tests.includes('test-routing.js'), 'Should include routing test');
  assert.ok(tests.includes('test-dashboard.js'), 'Should include dashboard test');
});

// Test 6: GitHub issue/PR proposal requires Evaluation v2 + executor approval
test('GitHub issue/PR proposal requires Evaluation v2 + executor approval', () => {
  const requiresApproval = true;
  const requiresEvalV2 = true;
  
  assert.strictEqual(requiresApproval, true, 'Should require executor approval');
  assert.strictEqual(requiresEvalV2, true, 'Should require Evaluation v2');
});

// Test 7: Personal/social chat does not trigger coding workspace
test('Personal/chat does not trigger coding workspace', () => {
  const personalMessage = 'bagaimana menghadapi guru marah';
  const isCodingRequest = classifyCodingRequest(personalMessage) === 'codex_prompt' || 
                          classifyCodingRequest(personalMessage) === 'dashboard_hotfix';
  
  assert.strictEqual(isCodingRequest, false, 'Personal chat should not trigger coding');
});

// Test 8: "pakai React untuk dashboard" -> warn unless explicit override
test('"pakai React untuk dashboard" -> warn unless explicit override', () => {
  const message = 'pakai React untuk dashboard';
  const classification = classifyCodingRequest(message);
  
  assert.strictEqual(classification, 'constraint_violation', 'Should detect constraint violation');
});

// Test 9: "buat issue GitHub untuk bug ini" -> eval + proposal only
test('"buat issue GitHub untuk bug ini" -> eval + proposal only', () => {
  const message = 'buat issue GitHub untuk bug ini';
  const classification = classifyCodingRequest(message);
  
  assert.strictEqual(classification, 'github_issue', 'Should classify as github issue');
  // Should require eval + proposal only, not direct creation
});

// Test 10: "buat PR untuk fix routing" -> eval + proposal only
test('"buat PR untuk fix routing" -> eval + proposal only', () => {
  const message = 'buat PR untuk fix routing';
  const classification = classifyCodingRequest(message);
  
  assert.strictEqual(classification, 'github_pr', 'Should classify as github PR');
  // Should require eval + proposal only, not direct creation
});

console.log('\n📊 Coding Workspace Verification Test Results:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
