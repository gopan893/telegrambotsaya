'use strict';

const store = require('../src/operator/project-operator-store');
const risk = require('../src/operator/operator-risk-review');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-risk-review');

store.deleteAll();

const r1 = risk.reviewOperatorPlanRisk(null);
assert(r1.ok === false, 'review null plan');

// Need a plan in store for reviewOperatorPlanRisk(planId)
const goal = store.createGoal({ title: 'Risk Goal' });
const plan = store.createPlan({ goalId: goal.id, title: 'Safe Plan', phases: [{ name: 'Planning', order: 1 }], summary: 'Simple task' });
const r2 = risk.reviewOperatorPlanRisk(plan.id);
assert(r2.overallLevel === 'low', 'safe plan low risk');
assert(r2.safe === true, 'safe plan safe');

const deployPlan = store.createPlan({ goalId: goal.id, title: 'Deploy Plan', phases: [{ name: 'Deploy', order: 1 }], summary: 'Deploy to production' });
const r3 = risk.reviewOperatorPlanRisk(deployPlan.id);
assert(r3.overallLevel === 'high', 'deploy plan high risk');
assert(r3.requiresApproval === true, 'deploy plan requires approval');

const bypassPlan = store.createPlan({ goalId: goal.id, title: 'Bypass', phases: [], summary: 'Git push and deploy directly' });
const r4 = risk.reviewOperatorPlanRisk(bypassPlan.id);
assert(r4.overallLevel === 'high', 'bypass plan high risk');
assert(r4.risks.some(r => r.type === 'approval_bypass'), 'approval bypass detected');

const r5 = risk.detectCompatibilityRisk(null);
assert(r5 === null, 'compat risk null');

const r6 = risk.detectApprovalBypassRisk({ phases: [], summary: 'safe' });
assert(r6 === null, 'no bypass for safe');

const r7 = risk.detectCostRisk({ estimatedCost: 5 });
assert(r7.severity === 'medium', 'cost risk medium');

const r8 = risk.detectDeploymentRisk({ phases: [{ name: 'Deploy' }], summary: 'test' });
assert(r8.severity === 'high', 'deploy risk high');

const r9 = risk.buildOperatorRiskSummary(plan);
assert(r9.includes('No risks'), 'summary no risks');

const r10 = risk.buildOperatorRiskSummary(null);
assert(r10 === 'Risk review unavailable.', 'null plan summary');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
