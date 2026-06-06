'use strict';

const budgetPolicy = require('../src/cost/budget-policy');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-budget-policy');

const p1 = budgetPolicy.getBudgetPolicy('ws1', 'user1');
assert(p1.workspaceId === 'ws1', 'getBudgetPolicy workspaceId');
assert(p1.dailyTokenLimit === 1000000, 'getBudgetPolicy default daily limit');
assert(p1.hardLimitEnabled === false, 'getBudgetPolicy default hard limit disabled');

const p2 = budgetPolicy.getBudgetPolicy('ws1', 'user1');
assert(p2.workspaceId === 'ws1', 'getBudgetPolicy same policy');

const r1 = budgetPolicy.updateBudgetPolicy({ workspaceId: 'ws1', userId: 'user1', dailyTokenLimit: 500000 });
assert(r1.ok === true, 'updateBudgetPolicy');
assert(r1.policy.dailyTokenLimit === 500000, 'updateBudgetPolicy changed limit');

const r2 = budgetPolicy.updateBudgetPolicy({ workspaceId: 'ws2', userId: 'user1', dailyCostLimit: 10 });
assert(r2.ok === true, 'updateBudgetPolicy new policy');

const status1 = budgetPolicy.checkBudgetStatus(null, null);
assert(status1.status === 'unknown', 'checkBudgetStatus null args');

const policy = budgetPolicy.getBudgetPolicy('ws3', 'user1');
const usage = { dailyTokens: 500000, dailyCost: 2.5, weeklyTokens: 1000000, weeklyCost: 5, monthlyTokens: 5000000, monthlyCost: 25 };
const status2 = budgetPolicy.checkBudgetStatus(policy, usage);
assert(status2.status === 'ok' || status2.status === 'warning', 'checkBudgetStatus under threshold');

const usageHigh = { dailyTokens: 900000, dailyCost: 4.5, weeklyTokens: 3000000, weeklyCost: 15, monthlyTokens: 15000000, monthlyCost: 75 };
const status3 = budgetPolicy.checkBudgetStatus(policy, usageHigh);
assert(status3.status === 'warning', 'checkBudgetStatus warning');

const usageBlock = { dailyTokens: 2000000, dailyCost: 10, weeklyTokens: 5000000, weeklyCost: 25, monthlyTokens: 20000000, monthlyCost: 100 };
const policyHard = budgetPolicy.getBudgetPolicy('ws4', 'user1');
policyHard.hardLimitEnabled = true;
const status4 = budgetPolicy.checkBudgetStatus(policyHard, usageBlock);
assert(status4.status === 'blocked', 'checkBudgetStatus blocked');

const summary = budgetPolicy.buildBudgetStatusSummary(null);
assert(summary === 'No budget status available.', 'buildBudgetStatusSummary null');

const summary2 = budgetPolicy.buildBudgetStatusSummary({ status: 'ok' });
assert(summary2 === 'Budget status: OK', 'buildBudgetStatusSummary ok');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
