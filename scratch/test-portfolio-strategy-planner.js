'use strict';

const assert = require('assert');
const strategy = require('../src/portfolio/portfolio-strategy-planner');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const weekly = await strategy.createWeeklyPortfolioPlan(workspaceId, services);
  assert.strictEqual(weekly.ok, true);
  assert(weekly.steps.length >= 1);
  assert.strictEqual(weekly.requiresExecutorApproval, false);
  const monthly = await strategy.createMonthlyPortfolioPlan(workspaceId, services);
  assert.strictEqual(monthly.ok, true);
  assert.strictEqual(monthly.type, 'monthly_portfolio');
  assert(Array.isArray(monthly.relatedPlans));
  console.log('test-portfolio-strategy-planner: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
