'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.reminderPlanner.createReminderPlan({ title: 'Review plan malam' }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.reminder.type, 'reminder');
  assert.equal(created.reminder.data.notificationSystem, 'plan_only');

  const listed = await lifeos.reminderPlanner.listReminderPlans({}, svc);
  assert.equal(listed.length, 1);

  const note = lifeos.reminderPlanner.buildReminderNotification(created.reminder, svc);
  assert.equal(note.ok, true);
  assert.ok(note.text.includes('Reminder'));

  const done = await lifeos.reminderPlanner.markReminderDone(created.reminder.id, svc);
  assert.equal(done.reminder.status, 'done');

  const blocked = await lifeos.reminderPlanner.createReminderPlan({ title: 'api_key=abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-reminder-planner: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
