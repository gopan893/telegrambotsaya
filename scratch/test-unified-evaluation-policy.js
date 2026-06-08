'use strict';

const evalPolicy = require('../src/governance/unified-evaluation-policy');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-unified-evaluation-policy.js ===\n');

// Test read action - no evaluation
const readEval = evalPolicy.determineEvaluationRequirement(
  { actionType: 'read' }, { riskLevel: 'read_only' }
);
assert(readEval.evaluationRequired === false, 'Read action does not require evaluation');

// Test external_write requires evaluation
const extWriteEval = evalPolicy.determineEvaluationRequirement(
  { actionType: 'external_write' }, { riskLevel: 'high' }
);
assert(extWriteEval.evaluationRequired === true, 'External write requires evaluation');

// Test dangerous requires evaluation
const dangerousEval = evalPolicy.determineEvaluationRequirement(
  { actionType: 'dangerous' }, { riskLevel: 'danger' }
);
assert(dangerousEval.evaluationRequired === true, 'Dangerous requires evaluation');

// Test destructive requires evaluation
const destructiveEval = evalPolicy.determineEvaluationRequirement(
  { actionType: 'destructive' }, { riskLevel: 'blocked' }
);
assert(destructiveEval.evaluationRequired === true, 'Destructive requires evaluation');

// Test pattern-based evaluation - github push
const githubEval = evalPolicy.determineEvaluationRequirement(
  { name: 'github.push.propose' }, { riskLevel: 'medium' }
);
assert(githubEval.evaluationRequired === true, 'GitHub push pattern requires evaluation');

// Test pattern-based evaluation - deploy
const deployEval = evalPolicy.determineEvaluationRequirement(
  { name: 'deploy.production' }, { riskLevel: 'medium' }
);
assert(deployEval.evaluationRequired === true, 'Deploy pattern requires evaluation');

// Test pattern-based evaluation - rollback
const rollbackEval = evalPolicy.determineEvaluationRequirement(
  { name: 'rollback.staging' }, { riskLevel: 'medium' }
);
assert(rollbackEval.evaluationRequired === true, 'Rollback pattern requires evaluation');

// Test pattern-based evaluation - restore
const restoreEval = evalPolicy.determineEvaluationRequirement(
  { name: 'restore.backup' }, { riskLevel: 'medium' }
);
assert(restoreEval.evaluationRequired === true, 'Restore pattern requires evaluation');

// Test pattern-based evaluation - gmail
const gmailEval = evalPolicy.determineEvaluationRequirement(
  { name: 'gmail.send.email' }, { riskLevel: 'medium' }
);
assert(gmailEval.evaluationRequired === true, 'Gmail pattern requires evaluation');

// Test buildGovernanceEvalCase
const evalCase = evalPolicy.buildGovernanceEvalCase(
  { name: 'github.push.propose', actionType: 'external_write' },
  { riskLevel: 'high' }
);
assert(evalCase !== null, 'Eval case created');
assert(evalCase.caseId.length > 0, 'Eval case has ID');
assert(evalCase.questions.length >= 5, 'Eval case has questions');
assert(evalCase.qualityGates.includes('no_direct_external_write'), 'Quality gates present');

// Test no eval case for safe action
const noCase = evalPolicy.buildGovernanceEvalCase(
  { name: 'read.status', actionType: 'read' },
  { riskLevel: 'read_only' }
);
assert(noCase === null, 'No eval case for safe action');

// Test runGovernanceEvaluationGate
const gateResult = evalPolicy.runGovernanceEvaluationGate({ evalCase });
assert(gateResult.passed === true, 'Evaluation gate passed (simulated)');
assert(gateResult.skipped === false, 'Evaluation not skipped');

// Test skipped evaluation
const skippedResult = evalPolicy.runGovernanceEvaluationGate({});
assert(skippedResult.skipped === true, 'No eval case results in skipped');

// Test assertGovernanceEvalPass
const passAssert = evalPolicy.assertGovernanceEvalPass(gateResult);
assert(passAssert.ok === true, 'Pass assert returns ok');

const skipAssert = evalPolicy.assertGovernanceEvalPass(null);
assert(skipAssert.ok === true, 'Skip assert for null returns ok');

// Test EVALUATION_REQUIRED_ACTIONS
assert(Array.isArray(evalPolicy.EVALUATION_REQUIRED_ACTIONS), 'EVALUATION_REQUIRED_ACTIONS is array');
assert(evalPolicy.EVALUATION_REQUIRED_ACTIONS.includes('external_write'), 'external_write in required actions');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
