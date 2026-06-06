'use strict';

const assert = require('assert');
const cost = require('../src/portfolio/portfolio-cost-review');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices({ averageTokens: 1500 });
  const estimate = await cost.estimatePortfolioCost(workspaceId, services);
  assert.strictEqual(estimate.ok, true);
  assert.strictEqual(estimate.status, 'warning');
  assert(estimate.estimatedRelativeCost > 0);
  const plan = await cost.suggestCostSavingPortfolioPlan(workspaceId, services);
  assert.strictEqual(plan.strategy, 'reduce_cost');
  assert(plan.steps.length >= 1);
  console.log('test-portfolio-cost-review: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
