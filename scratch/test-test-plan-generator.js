'use strict';

const { createCodeChangePlan } = require('../src/coding/code-change-planner');
const { generateTestPlan, generateRegressionTests, generateManualTestPlan, generateSmokeTestCommands } = require('../src/coding/test-plan-generator');

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
  if (value !== null && value !== undefined) {
    passed++;
    console.log('PASS: ' + label + ' exists');
  } else {
    failed++;
    console.log('FAIL: ' + label + ' is null/undefined');
  }
}

const plan = createCodeChangePlan({
  title: 'Fix dashboard routing',
  summary: 'Menu Agents should go to Agents tab',
  category: 'dashboard_issue',
  userId: 'user1'
}, {}, {});

// Test 1: Full test plan generation
console.log('--- Test: Full test plan ---');
const testPlan = generateTestPlan(plan);
checkExists('testPlan id', testPlan.id);
check('testPlan status', testPlan.status, 'generated');
check('testPlan has smokeCommands', Array.isArray(testPlan.smokeCommands), true);
check('testPlan has regressionTests', Array.isArray(testPlan.regressionTests), true);
check('testPlan has manualTests', Array.isArray(testPlan.manualTests), true);

// Test 2: Smoke commands
console.log('\n--- Test: Smoke commands ---');
const commands = generateSmokeTestCommands(plan);
check('commands has node --check', commands.includes('node --check telebot.js'), true);
check('commands is array', Array.isArray(commands), true);

// Test 3: Regression tests
console.log('\n--- Test: Regression tests ---');
const regression = generateRegressionTests(plan);
check('regression tests is array', Array.isArray(regression), true);
check('regression has tests', regression.length > 0, true);

// Test 4: Manual test plan
console.log('\n--- Test: Manual test plan ---');
const manual = generateManualTestPlan(plan);
check('manual tests is array', Array.isArray(manual), true);
check('manual has steps', manual.length > 0, true);
check('manual step 1 has action', typeof manual[0].action, 'string');

// Test 5: Dashboard issue specific tests
console.log('\n--- Test: Dashboard specific tests ---');
const dashboardPlan = createCodeChangePlan({
  title: 'Dashboard fix',
  summary: 'Fix dashboard tab',
  category: 'dashboard_issue'
}, {}, {});
const dashboardTests = generateRegressionTests(dashboardPlan);
const hasPwaTest = dashboardTests.some(t => t.name && t.name.includes('PWA'));
check('dashboard has PWA test', hasPwaTest, true);

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);
