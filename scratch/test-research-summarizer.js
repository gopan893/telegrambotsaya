'use strict';

const assert = require('assert');
const planner = require('../src/research/research-task-planner');
const collector = require('../src/research/source-collector');
const evidence = require('../src/research/evidence-extractor');
const summarizer = require('../src/research/research-summarizer');

(async () => {
  const services = { __researchStore: {}, actorId: 'u1', workspaceId: 'default' };
  const task = (await planner.createResearchTask({ topic: 'troubleshooting Render exited status 1', userId: 'u1' }, services)).task;
  const collected = await collector.collectSourcesForTask(task.id, services);
  await evidence.buildEvidencePack(collected.task, null, services);
  const summary = await summarizer.summarizeResearchTask(task.id, services);
  assert(summary.ok, 'summary created');
  assert(Array.isArray(summary.summary.evidenceUsed), 'evidence references present');
  assert(!summary.summary.answerSummary.includes('fake citation'), 'no fake citation');
  console.log('test-research-summarizer: ok');
})();

