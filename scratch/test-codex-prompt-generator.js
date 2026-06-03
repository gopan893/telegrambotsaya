'use strict';

const { createCodeChangePlan } = require('../src/coding/code-change-planner');
const { generateTestPlan } = require('../src/coding/test-plan-generator');
const { generateCodexPrompt, generateHotfixPrompt, generatePhasePrompt, generateCompactPrompt } = require('../src/coding/codex-prompt-generator');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log('PASS: ' + label);
  } else {
    failed++;
    console.log('FAIL: ' + label + ' | expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual));
  }
}

function checkExists(label, value) {
  if (value !== null && value !== undefined && value !== '') {
    passed++;
    console.log('PASS: ' + label + ' exists');
  } else {
    failed++;
    console.log('FAIL: ' + label + ' is empty/null/undefined');
  }
}

const plan = createCodeChangePlan({
  title: 'Add reminder feature',
  summary: 'Allow users to set reminders via Telegram',
  category: 'feature_request',
  userId: 'user1'
}, {}, {});

const testPlan = generateTestPlan(plan);

// Test 1: Full Codex prompt
console.log('--- Test: Full Codex prompt ---');
const prompt = generateCodexPrompt(plan, testPlan, null, {});
checkExists('prompt', prompt);
check('prompt contains title', prompt.includes('reminder'), true);
check('prompt contains constraints', prompt.includes('CommonJS'), true);
check('prompt has Node.js 20', prompt.includes('Node.js 20'), true);
check('prompt has Node.js mention', prompt.includes('Node'), true);

// Test 2: Hotfix prompt
console.log('\n--- Test: Hotfix prompt ---');
const hotfix = generateHotfixPrompt({ title: 'Fix login bug', summary: 'User cant login' }, {});
checkExists('hotfix prompt', hotfix);
check('hotfix has bug info', hotfix.includes('login'), true);

// Test 3: Phase prompt
console.log('\n--- Test: Phase prompt ---');
const phase = generatePhasePrompt({ title: 'Phase 30', summary: 'Multi-agent coding' }, {});
checkExists('phase prompt', phase);
check('phase has phase info', phase.includes('Multi-agent') || phase.includes('phase') || phase.includes('Phase'), true);

// Test 4: Compact prompt
console.log('\n--- Test: Compact prompt ---');
const compact = generateCompactPrompt({ title: 'Quick fix', summary: 'Fix typo' }, {});
checkExists('compact prompt', compact);

// Test 5: Prompt with risk review
console.log('\n--- Test: Prompt with risk review ---');
const riskReview = { overallRisk: 'medium', reviews: [{ agent: 'Security', severity: 'ok', issues: [] }] };
const promptWithRisk = generateCodexPrompt(plan, testPlan, riskReview, {});
checkExists('prompt with risk', promptWithRisk);
check('prompt longer with risk', promptWithRisk.length > prompt.length, true);

// Test 6: Secret redaction
console.log('\n--- Test: Secret redaction ---');
const secretPlan = createCodeChangePlan({
  title: 'Fix token handling',
  summary: 'The sk-1234567890abcdef token needs updating',
  category: 'security_issue'
});
const secretPrompt = generateCodexPrompt(secretPlan, null, null, {});
check('secret redacted', !secretPrompt.includes('sk-1234567890abcdef'), true);

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);
