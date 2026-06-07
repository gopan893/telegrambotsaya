'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.personalTaskManager.createPersonalTask({ title: 'Buy notebook', priority: 'high' }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.task.status, 'todo');

  const listed = await lifeos.personalTaskManager.listPersonalTasks({}, svc);
  assert.equal(listed.length, 1);

  const updated = await lifeos.personalTaskManager.updatePersonalTask(created.task.id, { priority: 'critical' }, svc);
  assert.equal(updated.task.priority, 'critical');

  const done = await lifeos.personalTaskManager.completePersonalTask(created.task.id, svc);
  assert.equal(done.task.status, 'done');

  const archived = await lifeos.personalTaskManager.archivePersonalTask(created.task.id, 'test cleanup', svc);
  assert.equal(archived.task.status, 'archived');
  const stillThere = await lifeos.lifeStore.getLifeItem(created.task.id, svc);
  assert.equal(stillThere.id, created.task.id);

  const blocked = await lifeos.personalTaskManager.createPersonalTask({ title: 'sk-abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-personal-task-manager: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
