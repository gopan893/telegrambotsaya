'use strict';

const { createCodeChangePlan } = require('../src/coding/code-change-planner');
const { buildGithubIssueProposal, buildGithubPrProposal, createGithubProposalAfterEvaluation } = require('../src/coding/github-proposal-builder');

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
  title: 'Fix dashboard routing bug',
  summary: 'Menu Agents should navigate to Agents tab',
  category: 'bug_fix',
  userId: 'user1'
}, {}, {});

// Test 1: Issue proposal
console.log('--- Test: GitHub issue proposal ---');
const issue = buildGithubIssueProposal(plan, {});
checkExists('issue id', issue.id);
check('issue type', issue.type, 'issue');
check('issue status', issue.status, 'proposal_only');
check('issue requiresApproval', issue.requiresApproval, true);
check('issue evaluationStatus', issue.evaluationStatus, 'pending');
checkExists('issue title', issue.title);
checkExists('issue body', issue.body);
check('issue has labels', Array.isArray(issue.labels), true);

// Test 2: PR proposal
console.log('\n--- Test: GitHub PR proposal ---');
const pr = buildGithubPrProposal(plan, {});
checkExists('pr id', pr.id);
check('pr type', pr.type, 'pr');
check('pr status', pr.status, 'proposal_only');
check('pr requiresApproval', pr.requiresApproval, true);
checkExists('pr branch', pr.branch);
checkExists('pr body', pr.body);

// Test 3: No secrets in proposal
console.log('\n--- Test: No secrets ---');
const secretPlan = createCodeChangePlan({
  title: 'Fix DATABASE_URL handling',
  summary: 'The postgresql://user:pass@host/db connection needs fix',
  category: 'security_issue'
});
const secretIssue = buildGithubIssueProposal(secretPlan, {});
check('no postgresql in body', !secretIssue.body.includes('postgresql://user:pass@host/db'), true);

// Test 4: createGithubProposalAfterEvaluation (async)
console.log('\n--- Test: Evaluation gate ---');
createGithubProposalAfterEvaluation(plan, 'issue', {}).then(result => {
  check('proposal result has success', typeof result.success, 'boolean');
  check('proposal result has message', typeof result.message, 'string');
  check('proposal requiresExecutorApproval', result.requiresExecutorApproval, true);

  if (result.success) {
    checkExists('proposal object', result.proposal);
    check('proposal evaluation passed', result.proposal.evaluationStatus, 'pass');
  } else {
    checkExists('failure reason', result.reason);
  }

  // Summary
  console.log('\n---');
  console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
  console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.log('ERROR: ' + err.message);
  process.exit(1);
});
