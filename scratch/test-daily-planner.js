'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  await lifeos.personalTaskManager.createPersonalTask({ title: 'Ship one small fix', priority: 'high' }, svc);
  await lifeos.habitTracker.createHabit({ title: 'Read docs', frequency: 'daily' }, svc);

  const created = await lifeos.dailyPlanner.createDailyPlan({ date: '2026-06-07' }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.plan.type, 'daily_plan');
  assert.equal(created.plan.data.topPriorities.length, 3);
  assert.ok(created.plan.data.focusBlock.durationMinutes >= 25);

  const current = await lifeos.dailyPlanner.getDailyPlan('2026-06-07', svc);
  assert.equal(current.id, created.plan.id);

  const summary = await lifeos.dailyPlanner.summarizeDailyPlan('2026-06-07', svc);
  assert.equal(summary.ok, true);
  assert.ok(summary.text.includes('Daily plan'));

  const review = await lifeos.dailyPlanner.createEndOfDayReview('2026-06-07', svc);
  assert.equal(review.ok, true);
  assert.equal(review.review.type, 'reflection');

  const blocked = await lifeos.dailyPlanner.createDailyPlan({ title: 'token=abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-daily-planner: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
