'use strict';

const { createCodeChangePlan } = require('../src/coding/code-change-planner');
const { reviewCodingPlanRisk, detectRegressionRisk, detectSecurityRisk, detectCompatibilityRisk, buildRiskReviewSummary } = require('../src/coding/regression-risk-reviewer');

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

// Test plan
const plan = createCodeChangePlan({
  title: 'Fix dashboard routing',
  summary: 'Menu Agents should go to Agents tab',
  category: 'dashboard_issue',
  userId: 'user1'
}, {}, {});

// Test 1: Full risk review
console.log('--- Test: Full risk review ---');
const review = reviewCodingPlanRisk(plan, {});
checkExists('review planId', review.planId);
check('review has reviewers', Array.isArray(review.reviewers), true);
check('review hasCoder', review.reviewers.includes('Coder'), true);
check('review hasPlanner', review.reviewers.includes('Planner'), true);
check('review hasCritic', review.reviewers.includes('Critic'), true);
check('review hasSecurity', review.reviewers.includes('Security'), true);
check('review hasExecutor', review.reviewers.includes('Executor'), true);

// Test 2: Regression risk
console.log('\n--- Test: Regression risk ---');
const regression = detectRegressionRisk(plan, {});
checkExists('regression risk level', regression.regressionRisk);
check('regression has reasons', Array.isArray(regression.reasons), true);

// Test 3: Security risk
console.log('\n--- Test: Security risk ---');
const security = detectSecurityRisk(plan, {});
checkExists('security risk level', security.securityRisk);
check('security has issues array', Array.isArray(security.issues), true);

// Test 4: Security risk - secret reference (bypass redact by using direct object)
console.log('\n--- Test: Security risk - secret ---');
const secretPlan = {
  title: 'Fix DATABASE_URL handling',
  requestSummary: 'Update token and secret management',
  category: 'security_issue',
  riskLevel: 'high'
};
const secretReview = detectSecurityRisk(secretPlan, {});
check('secret plan security risk high', secretReview.securityRisk === 'high', true);
check('secret plan has issues', secretReview.issues.length > 0, true);

// Test 5: Security risk - dangerous delete (bypass redact)
console.log('\n--- Test: Security risk - dangerous ---');
const dangerPlan = {
  title: 'hapus semua file lama',
  requestSummary: 'Delete all old files from server',
  category: 'refactor',
  riskLevel: 'critical'
};
const dangerSecurity = detectSecurityRisk(dangerPlan, {});
check('danger plan blocked by security', dangerSecurity.securityRisk === 'high', true);

// Test 6: Compatibility risk
console.log('\n--- Test: Compatibility risk ---');
const compat = detectCompatibilityRisk(plan, {});
checkExists('compat risk level', compat.compatibilityRisk);
check('compat has checks', Array.isArray(compat.checks), true);

// Test 7: Compatibility - React violation
console.log('\n--- Test: Compatibility - React ---');
const reactPlan = {
  title: 'pakai React untuk dashboard',
  requestSummary: 'Use React for dashboard',
  category: 'feature_request'
};
const reactCompat = detectCompatibilityRisk(reactPlan, {});
check('react compat has warnings', reactCompat.checks.length > 0, true);

// Test 8: Summary builder
console.log('\n--- Test: Summary builder ---');
const summary = buildRiskReviewSummary(plan, {});
checkExists('summary overallRisk', summary.overallRisk);
check('summary canProceed boolean', typeof summary.canProceed, 'boolean');

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);
