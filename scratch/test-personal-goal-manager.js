'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.personalGoalManager.createPersonalGoal({ title: 'Belajar konsisten', category: 'learning', progress: 20 }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.goal.data.category, 'learning');

  const linked = await lifeos.personalGoalManager.linkPersonalGoalToProject(created.goal.id, 'project_1', svc);
  assert.equal(linked.goal.data.linkedProjectId, 'project_1');
  assert.equal(linked.goal.data.category, 'project');

  const updated = await lifeos.personalGoalManager.updatePersonalGoal(created.goal.id, { data: { progress: 85 } }, svc);
  assert.equal(updated.goal.data.progress, 85);

  const summary = await lifeos.personalGoalManager.summarizePersonalGoalProgress(created.goal.id, svc);
  assert.equal(summary.ok, true);
  assert.ok(summary.nextStep.includes('Review'));

  const blocked = await lifeos.personalGoalManager.createPersonalGoal({ title: 'ghp_secret' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-personal-goal-manager: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
