'use strict';

const { classifyRequest } = require('../src/coding/coding-request-classifier');
const { createCodeChangePlan, createPlanFromBugReport, createPlanFromFeatureRequest, createPlanFromPhasePrompt, createMinimalPatchStrategy, createCompatibilityChecklist } = require('../src/coding/code-change-planner');

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

// Test 1: Basic plan creation
console.log('--- Test: Basic plan creation ---');
const plan1 = createCodeChangePlan({
  title: 'Test plan',
  summary: 'Test summary',
  category: 'feature_request',
  userId: 'user1'
}, {}, {});
checkExists('plan id', plan1.id);
checkExists('plan title', plan1.title);
check('plan status', plan1.status, 'planned');
check('plan has affectedAreas', Array.isArray(plan1.affectedAreas) && plan1.affectedAreas.length > 0, true);
check('plan has proposedFiles', Array.isArray(plan1.proposedFiles) && plan1.proposedFiles.length > 0, true);
check('plan has implementationSteps', Array.isArray(plan1.implementationSteps) && plan1.implementationSteps.length > 0, true);
check('plan has compatibilityChecklist', Array.isArray(plan1.compatibilityChecklist) && plan1.compatibilityChecklist.length > 0, true);
check('plan has constraints', typeof plan1.constraints === 'object' && plan1.constraints !== null, true);

// Test 2: Bug report plan
console.log('\n--- Test: Bug report plan ---');
const bugPlan = createPlanFromBugReport({
  title: 'Fix login bug',
  bugDescription: 'User cannot login with valid credentials',
  userId: 'user1'
});
check('bug plan category', bugPlan.category, 'bug_fix');
checkExists('bug plan id', bugPlan.id);

// Test 3: Feature request plan
console.log('\n--- Test: Feature request plan ---');
const featurePlan = createPlanFromFeatureRequest({
  title: 'Add reminder feature',
  featureDescription: 'Allow users to set reminders',
  userId: 'user1'
});
check('feature plan category', featurePlan.category, 'feature_request');
checkExists('feature plan id', featurePlan.id);

// Test 4: Phase prompt plan
console.log('\n--- Test: Phase prompt plan ---');
const phasePlan = createPlanFromPhasePrompt({
  title: 'Phase 30 implementation',
  phaseDescription: 'Add multi-agent coding workspace',
  userId: 'user1'
});
check('phase plan category', phasePlan.category, 'phase_prompt');
check('phase plan has src in affectedAreas', phasePlan.affectedAreas.includes('src'), true);

// Test 5: Dangerous request - critical risk
console.log('\n--- Test: Dangerous request ---');
const dangerPlan = createCodeChangePlan({
  title: 'hapus semua file lama',
  summary: 'Delete all old files',
  category: 'refactor',
  userId: 'user1'
}, {}, {});
check('danger plan riskLevel', dangerPlan.riskLevel, 'critical');
check('danger plan requiresApproval', dangerPlan.requiresApproval, true);

// Test 6: React violation
console.log('\n--- Test: React constraint violation ---');
const reactPlan = createCodeChangePlan({
  title: 'pakai React untuk dashboard',
  summary: 'Use React for dashboard',
  category: 'feature_request',
  userId: 'user1'
}, {}, {});
check('react plan riskLevel', reactPlan.riskLevel, 'high');

// Test 7: Minimal patch strategy
console.log('\n--- Test: Minimal patch strategy ---');
const patch = createMinimalPatchStrategy(plan1, {});
checkExists('patch strategy', patch.strategy);
check('patch strategy type', patch.strategy, 'minimal_patch');

// Test 8: Compatibility checklist
console.log('\n--- Test: Compatibility checklist ---');
const checklist = createCompatibilityChecklist(plan1, {});
check('checklist is array', Array.isArray(checklist), true);
check('checklist has items', checklist.length > 0, true);

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);
