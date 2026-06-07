'use strict';

const assert = require('assert');
const planner = require('../src/research/research-task-planner');
const collector = require('../src/research/source-collector');

(async () => {
  const services = { __researchStore: {}, actorId: 'u1', workspaceId: 'default', env: {} };
  const task = (await planner.createResearchTask({ topic: 'buat dokumentasi env project ini', userId: 'u1', workspaceId: 'default' }, services)).task;
  const res = await collector.collectSourcesForTask(task.id, services);
  assert(res.ok, 'sources collected');
  assert(res.sources.some(source => source.type === 'project_doc'), 'project docs collected');
  assert(!JSON.stringify(res).includes('DATABASE_URL='), 'no env value leak');
  console.log('test-source-collector: ok');
})();

