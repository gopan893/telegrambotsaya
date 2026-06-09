'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { workspaceId: 'test', userId: 'tester' };

  // create task
  const task = await research.researchTaskManager.createResearchTask({ title: 'Test riset API Gemini', query: 'Apa itu Gemini Vision API?', category: 'api_research' }, svc);
  assert(task && task.id, 'createResearchTask returns id');
  assert(task.status === 'draft', 'task status draft');
  assert(task.category === 'api_research', 'task category');

  // list tasks
  const tasks = await research.researchTaskManager.listResearchTasks({}, svc);
  assert(tasks.length >= 1, 'listResearchTasks returns tasks');

  // get task
  const fetched = await research.researchTaskManager.getResearchTask(task.id, svc);
  assert(fetched && fetched.id === task.id, 'getResearchTask returns correct task');

  // update task
  const updated = await research.researchTaskManager.updateResearchTask(task.id, { status: 'collecting' }, svc);
  assert(updated && updated.status === 'collecting', 'updateResearchTask changes status');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
