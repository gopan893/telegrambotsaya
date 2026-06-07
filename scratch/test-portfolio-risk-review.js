'use strict';

const assert = require('assert');
const risk = require('../src/portfolio/portfolio-risk-review');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const result = await risk.reviewPortfolioRisk(workspaceId, services);
  assert.strictEqual(result.ok, true);
  assert(['medium', 'high', 'critical'].includes(result.riskLevel));
  assert(result.warnings.length >= 1);
  const summary = await risk.buildPortfolioRiskSummary(workspaceId, services);
  assert(summary.includes('Risk:'));
  console.log('test-portfolio-risk-review: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
