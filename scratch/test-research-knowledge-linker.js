'use strict';

const assert = require('assert');
const planner = require('../src/research/research-task-planner');
const linker = require('../src/research/research-knowledge-linker');

(async () => {
  const calls = [];
  const services = {
    __researchStore: {},
    actorId: 'u1',
    workspaceId: 'default',
    aiOS: { knowledgeGraph: {
      upsertConcept: (userId, node) => ({ ok: true, node: { ...node, id: 'kg1' } }),
      evolveGraphFromText: () => ({ ok: true, nodes: [{ id: 'kg2' }] })
    } }
  };
  const task = (await planner.createResearchTask({ topic: 'Project Knowledge Graph docs', userId: 'u1' }, services)).task;
  const res = await linker.linkResearchToKnowledgeGraph(task.id, services);
  assert(res.ok, 'linked to graph');
  assert(res.linkedKnowledgeNodeIds.includes('kg1'), 'node linked');
  console.log('test-research-knowledge-linker: ok');
})();

