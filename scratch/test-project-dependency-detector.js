'use strict';

const assert = require('assert');
const deps = require('../src/portfolio/project-dependency-detector');
const { makePortfolioServices } = require('./portfolio-test-fixture');

(async () => {
  const { services, workspaceId } = makePortfolioServices();
  const graph = await deps.detectProjectDependencies(workspaceId, services);
  assert.strictEqual(graph.ok, true);
  assert(graph.edges.some(edge => edge.to === 'tests_pass' || edge.to === 'release_gate_pass'));
  const taskDeps = await deps.detectTaskDependencies('goal_deploy', services);
  assert(taskDeps.some(item => item.blocked));
  const unsafe = await deps.detectUnsafeOrdering([{ id: 'x', title: 'deploy production now' }], services);
  assert.strictEqual(unsafe.warnings.length, 1);
  console.log('test-project-dependency-detector: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
