'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.habitTracker.createHabit({ title: 'Stretch', frequency: 'daily' }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.habit.type, 'habit');

  const checkin = await lifeos.habitTracker.logHabitCheckin(created.habit.id, new Date(), true, svc);
  assert.equal(checkin.ok, true);
  assert.ok(checkin.streak >= 1);

  const streak = await lifeos.habitTracker.getHabitStreak(created.habit.id, svc);
  assert.equal(streak.ok, true);

  const summary = await lifeos.habitTracker.summarizeHabits({}, svc);
  assert.equal(summary.total, 1);
  assert.equal(summary.active, 1);

  const suggestion = await lifeos.habitTracker.suggestHabitAdjustment(created.habit.id, svc);
  assert.equal(suggestion.ok, true);
  assert.ok(/target|ritme|skip/i.test(suggestion.suggestion));

  const blocked = await lifeos.habitTracker.createHabit({ title: 'password=abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-habit-tracker: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
