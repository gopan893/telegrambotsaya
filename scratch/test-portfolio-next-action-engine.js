'use strict';

const assert = require('assert');
const next = require('../src/portfolio/portfolio-next-action-engine');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const result = await next.recommendPortfolioNextAction(workspaceId, services);
  assert.strictEqual(result.ok, true);
  assert(result.nextProject);
  assert(result.summary.includes('Lanjutkan:'));
  assert(result.recommendedAgent);
  const taskAgent = await next.recommendNextAgentForTask('task_deploy_gate', services);
  assert.strictEqual(taskAgent.ok, true);
  assert(taskAgent.agent);
  console.log('test-portfolio-next-action-engine: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
