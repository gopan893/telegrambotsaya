'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.weeklyPlanner.createWeeklyPlan({ week: '2026-W23' }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.plan.type, 'weekly_plan');
  assert.ok(created.plan.data.mainGoal);
  assert.ok(String(created.plan.data.recommendedDevAgent).includes('Codex'));

  const summary = await lifeos.weeklyPlanner.summarizeWeeklyPlan('2026-W23', svc);
  assert.equal(summary.ok, true);
  assert.ok(summary.text.includes('Weekly plan'));

  const priorities = await lifeos.weeklyPlanner.recommendWeeklyPriorities(svc);
  assert.equal(priorities.ok, true);
  assert.ok(priorities.projectPriorities.length);

  const review = await lifeos.weeklyPlanner.createWeeklyReview('2026-W23', svc);
  assert.equal(review.ok, true);
  assert.equal(review.review.sensitivity, 'private');

  const blocked = await lifeos.weeklyPlanner.createWeeklyPlan({ title: 'DATABASE_URL=postgresql://secret' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-weekly-planner: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
