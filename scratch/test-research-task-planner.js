'use strict';

const assert = require('assert');
const planner = require('../src/research/research-task-planner');

(async () => {
  const services = { __researchStore: {}, actorId: 'u1', workspaceId: 'default' };
  const res = await planner.createResearchTask({ topic: 'riset cara terbaik deploy Render Node.js', userId: 'u1', workspaceId: 'default' }, services);
  assert(res.ok, 'task created');
  assert.strictEqual(res.task.scope, 'deployment');
  assert(res.plan.primaryQuestion.includes('Render'), 'primary question preserved');
  assert(res.plan.freshnessRequirement === 'high', 'deployment needs high freshness');
  console.log('test-research-task-planner: ok');
})();

