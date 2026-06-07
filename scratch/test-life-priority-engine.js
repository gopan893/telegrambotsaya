'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  await lifeos.personalTaskManager.createPersonalTask({ title: 'Critical personal task', priority: 'critical' }, svc);
  await lifeos.energyMoodJournal.createEnergyMoodNote({ note: 'low energy', energyLevel: 2 }, svc);

  const today = await lifeos.lifePriorityEngine.recommendTodayPriority(svc);
  assert.equal(today.ok, true);
  assert.equal(today.priority.title, 'Critical personal task');

  const balance = await lifeos.lifePriorityEngine.recommendLifeProjectBalance(svc);
  assert.equal(balance.balance, 'rest_first');

  const simple = await lifeos.lifePriorityEngine.suggestSimplifiedPlan(svc);
  assert.equal(simple.ok, true);
  assert.equal(simple.plan.length, 4);

  const rest = await lifeos.lifePriorityEngine.decideRestOrPush({ text: 'Saya capek' }, svc);
  assert.equal(rest.decision, 'rest');

  const overload = await lifeos.lifePriorityEngine.detectTooManyCommitments(svc);
  assert.equal(overload.ok, true);

  console.log('test-life-priority-engine: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
