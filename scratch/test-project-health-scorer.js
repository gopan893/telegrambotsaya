'use strict';

const assert = require('assert');
const health = require('../src/portfolio/project-health-scorer');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services } = makePortfolioServices();
  const result = await health.scoreProjectHealth('goal_deploy', services);
  assert.strictEqual(result.goalId, 'goal_deploy');
  assert(result.score >= 0 && result.score <= 100);
  assert(['healthy', 'warning', 'blocked', 'critical'].includes(result.status));
  assert(result.blockers.length >= 1, 'blocked/high-risk project should include blockers');
  const summary = await health.buildProjectHealthSummary('goal_deploy', services);
  assert(summary.includes('Project goal_deploy'));
  console.log('test-project-health-scorer: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
