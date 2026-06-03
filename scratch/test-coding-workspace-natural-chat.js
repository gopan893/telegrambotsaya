'use strict';

const { classifyRequest } = require('../src/coding/coding-request-classifier');
const { createCodeChangePlan } = require('../src/coding/code-change-planner');
const { generateTestPlan } = require('../src/coding/test-plan-generator');
const { generateCodexPrompt } = require('../src/coding/codex-prompt-generator');
const { buildRiskReviewSummary } = require('../src/coding/regression-risk-reviewer');

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

// Test 1: "buat prompt phase 30" → Codex-ready prompt
console.log('--- Test: buat prompt phase 30 ---');
const phase30 = classifyRequest('buat prompt phase 30');
check('phase30 is coding', phase30.isCodingRelated, true);
check('phase30 category', phase30.category, 'phase_prompt');
check('phase30 has agents', phase30.selectedAgents.length > 0, true);
check('phase30 no approval needed', phase30.requiresApproval, false);

const phase30Plan = createCodeChangePlan({
  title: 'Phase 30 implementation',
  summary: 'Add multi-agent coding workspace',
  category: phase30.category,
  userId: 'user1'
}, {}, {});
checkExists('phase30 plan', phase30Plan.id);

const phase30TestPlan = generateTestPlan(phase30Plan);
checkExists('phase30 test plan', phase30TestPlan.id);

const phase30Prompt = generateCodexPrompt(phase30Plan, phase30TestPlan, null, {});
checkExists('phase30 codex prompt', phase30Prompt);
check('phase30 prompt has constraints', phase30Prompt.includes('CommonJS'), true);

// Test 2: "menu Agents masih masuk Overview" → dashboard hotfix plan
console.log('\n--- Test: menu Agents masih masuk Overview ---');
const menuBug = classifyRequest('menu Agents masih masuk Overview');
check('menuBug is coding', menuBug.isCodingRelated, true);
check('menuBug category', menuBug.category, 'dashboard_issue');

const menuPlan = createCodeChangePlan({
  title: 'Fix Agents menu routing',
  summary: 'Menu Agents should navigate to Agents tab',
  category: menuBug.category,
  userId: 'user1'
}, {}, {});
checkExists('menu plan', menuPlan.id);

const menuTestPlan = generateTestPlan(menuPlan);
check('menu test plan has PWA test', menuTestPlan.regressionTests.some(t => t.name && t.name.includes('PWA')), true);

// Test 3: "buat issue GitHub untuk bug dashboard" → proposal only
console.log('\n--- Test: buat issue GitHub ---');
const ghReq = classifyRequest('buat issue GitHub untuk bug dashboard');
check('ghReq is coding', ghReq.isCodingRelated, true);
check('ghReq needsGitHubProposal', ghReq.needsGitHubProposal, true);
check('ghReq requiresApproval', ghReq.requiresApproval, true);
check('ghReq needsEvaluation', ghReq.needsEvaluation, true);

// Test 4: "hapus semua file lama" → critical risk
console.log('\n--- Test: hapus semua file lama ---');
const dangerReq = classifyRequest('hapus semua file lama');
check('dangerReq is coding', dangerReq.isCodingRelated, true);
check('dangerReq riskLevel', dangerReq.riskLevel, 'critical');
check('dangerReq requiresApproval', dangerReq.requiresApproval, true);

// Test 5: "pakai React untuk dashboard" → constraint violation
console.log('\n--- Test: pakai React ---');
const reactReq = classifyRequest('pakai React untuk dashboard');
check('reactReq is coding', reactReq.isCodingRelated, true);
check('reactReq riskLevel', reactReq.riskLevel, 'high');

// Test 6: "bagaimana menghadapi guru marah?" → not coding
console.log('\n--- Test: personal question ---');
const personalReq = classifyRequest('bagaimana menghadapi guru marah?');
check('personalReq not coding', personalReq.isCodingRelated, false);
check('personalReq no agents', personalReq.selectedAgents.length, 0);

// Test 7: "bot saya error Python" → Coder selected
console.log('\n--- Test: bot error ---');
const botReq = classifyRequest('bot saya error Python');
check('botReq is coding', botReq.isCodingRelated, true);
check('botReq has Coder', botReq.selectedAgents.includes('Coder'), true);

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);
