'use strict';

const assert = require('assert');
const stale = require('../src/portfolio/project-staleness-detector');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const result = await stale.detectStaleProjects(workspaceId, services);
  assert.strictEqual(result.ok, true);
  assert(result.stale.some(item => item.goal.id === 'goal_feature'));
  const taskStale = await stale.detectStaleTasks('goal_feature', services);
  assert(taskStale.some(item => item.id === 'task_portfolio_docs'));
  console.log('test-project-staleness-detector: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
