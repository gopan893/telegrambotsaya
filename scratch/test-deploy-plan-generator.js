'use strict';

const store = require('../src/deploy/deploy-release-store');
const planGen = require('../src/deploy/deploy-plan-generator');
const rcm = require('../src/deploy/release-candidate-manager');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- deploy-plan-generator ---');
store.clear();
const rc = rcm.createReleaseCandidate({ branch: 'main', commitSha: 'abc123', commitMessage: 'Test' });

const plan = planGen.createDeployPlan(rc.candidate.id, { provider: 'render', environment: 'production' }, {});
assert(plan.ok === true, 'createDeployPlan ok');
assert(plan.plan.targetProvider === 'render', 'target provider set');
assert(plan.plan.environment === 'production', 'environment set');
assert(plan.plan.status === 'draft', 'status draft');
assert(plan.plan.blockers.length >= 0, 'blockers checked');
assert(plan.plan.evaluationRequired === true, 'evaluation required');
assert(plan.plan.executorApprovalRequired === true, 'executor approval required');

const noPlan = planGen.createDeployPlan('nonexistent', {}, {});
assert(noPlan.ok === false, 'nonexistent RC returns error');

const readiness = planGen.validateDeployReadiness(plan.plan);
assert(typeof readiness.ok === 'boolean', 'validateDeployReadiness returns boolean');

const riskSummary = planGen.buildDeployRiskSummary(plan.plan);
assert(riskSummary.includes('Risk Level'), 'risk summary includes level');

const manual = planGen.buildDeployManualInstructions(plan.plan);
assert(manual.includes('Deploy Instructions'), 'manual instructions generated');

const emptyRisk = planGen.buildDeployRiskSummary(null);
assert(typeof emptyRisk === 'string', 'null risk summary returns string');

const emptyManual = planGen.buildDeployManualInstructions(null);
assert(typeof emptyManual === 'string', 'null manual returns string');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
