'use strict';

const guard = require('../src/cost/budget-guard');
const policyModule = require('../src/cost/budget-policy');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-budget-guard');

const r1 = guard.runBudgetGuard(null);
assert(r1.allowed === true, 'runBudgetGuard null allowed');
assert(r1.reason === 'no_request_plan', 'runBudgetGuard null reason');

const r2 = guard.runBudgetGuard({ type: 'chat', context: 'hello' });
assert(r2.allowed === true, 'runBudgetGuard simple chat allowed');
assert(r2.estimatedTokens > 0, 'runBudgetGuard has estimated tokens');

const r3 = guard.runBudgetGuard({ type: 'council', context: 'complex analysis requiring multiple agents' });
assert(r3.allowed === true, 'runBudgetGuard council not blocked by default');

const r4 = guard.shouldWarnBudget(null, {}, {});
assert(r4 === false, 'shouldWarnBudget null');

const r5 = guard.shouldRequireApprovalForHighCost({ type: 'chat' }, {}, {});
assert(r5 === false, 'shouldRequireApprovalForHighCost chat false');

const r6 = guard.shouldRequireApprovalForHighCost({ type: 'evaluation_suite' }, { dailyCost: 100 }, { dailyCostLimit: 100 });
assert(r6 === true, 'shouldRequireApprovalForHighCost expensive eval');

const r7 = guard.shouldBlockForBudget({}, { dailyCost: 10, monthlyCost: 10 }, { hardLimitEnabled: false, dailyCostLimit: 5, monthlyCostLimit: 20 });
assert(r7 === false, 'shouldBlockForBudget hard limit disabled');

const r8 = guard.shouldBlockForBudget({}, { dailyCost: 10, monthlyCost: 10 }, { hardLimitEnabled: true, dailyCostLimit: 5, monthlyCostLimit: 20 });
assert(r8 === true, 'shouldBlockForBudget hard limit enabled and exceeded');

const resp1 = guard.buildBudgetGuardResponse(null);
assert(resp1.allowed === true, 'buildBudgetGuardResponse null');

const resp2 = guard.buildBudgetGuardResponse({ allowed: true, warning: false, reason: 'ok' });
assert(resp2.allowed === true, 'buildBudgetGuardResponse allowed');

const resp3 = guard.buildBudgetGuardResponse({ allowed: false, blocked: true, reason: 'blocked', estimatedCost: 5 });
assert(resp3.blocked === true, 'buildBudgetGuardResponse blocked');
assert(resp3.allowed === false, 'buildBudgetGuardResponse not allowed');
assert(resp3.suggestedMode === 'economy', 'buildBudgetGuardResponse suggested economy');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
