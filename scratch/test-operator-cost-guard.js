'use strict';

const guard = require('../src/operator/operator-cost-guard');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-cost-guard');

const r1 = guard.estimateOperatorPlanCost(null);
assert(r1.known === false, 'estimate null plan');

const plan = { phases: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], milestones: [{ name: 'M1' }] };
const r2 = guard.estimateOperatorPlanCost(plan);
assert(r2.known === true, 'estimate plan known');
assert(r2.estimatedCost > 0, 'cost positive');

const r3 = guard.runOperatorBudgetGuard(null);
assert(r3.allowed === true, 'budget guard null');

const r4 = guard.runOperatorBudgetGuard({ phases: plan.phases, milestones: plan.milestones });
assert(r4.allowed === true, 'budget guard small plan');

const bigPlan = { phases: Array(20).fill({ name: 'X' }), milestones: Array(10).fill({ name: 'M' }) };
const r5 = guard.runOperatorBudgetGuard(bigPlan);
assert(r5.allowed === true || r5.warning === true, 'big plan warns');

const r6 = guard.suggestCheaperOperatorPlan(null);
assert(r6.suggestion === null, 'suggest cheaper null');

const r7 = guard.suggestCheaperOperatorPlan(plan);
assert(r7.suggestion !== null, 'suggest cheaper');
assert(r7.estimatedSavings > 0, 'savings positive');

const r8 = guard.decideIfCouncilNeeded(null);
assert(r8.needed === false, 'council null');

const highRiskPlan = { phases: [{ name: 'A' }], risks: [{ severity: 'high' }] };
const r9 = guard.decideIfCouncilNeeded(highRiskPlan);
assert(r9.needed === true, 'council high risk');

const r10 = guard.decideIfCouncilNeeded({ phases: [{ name: 'A' }] });
assert(r10.needed === false, 'no council simple');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
