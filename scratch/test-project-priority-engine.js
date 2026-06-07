'use strict';

const assert = require('assert');
const priority = require('../src/portfolio/project-priority-engine');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const ranked = await priority.rankProjects(workspaceId, services);
  assert.strictEqual(ranked.length, 2);
  assert(ranked[0].priorityScore >= ranked[1].priorityScore);
  assert(ranked[0].explanation);
  const top = await priority.recommendTopProject(workspaceId, services);
  assert(top.topProject);
  assert(top.summary.includes(top.topProject.goal.title));
  console.log('test-project-priority-engine: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
