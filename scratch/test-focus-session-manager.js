'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const created = await lifeos.focusSessionManager.createFocusSession({ title: 'Study block', durationMinutes: 400 }, svc);
  assert.equal(created.ok, true);
  assert.equal(created.session.data.durationMinutes, 180);

  const started = await lifeos.focusSessionManager.startFocusSessionPlan(created.session.id, svc);
  assert.equal(started.session.status, 'doing');

  const completed = await lifeos.focusSessionManager.completeFocusSession(created.session.id, svc);
  assert.equal(completed.session.status, 'completed');

  const summary = await lifeos.focusSessionManager.summarizeFocusSessions({}, svc);
  assert.equal(summary.completed, 1);
  assert.equal(summary.totalMinutes, 180);

  const suggestion = await lifeos.focusSessionManager.suggestFocusBlock(svc);
  assert.equal(suggestion.ok, true);

  const blocked = await lifeos.focusSessionManager.createFocusSession({ title: 'Bearer abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-focus-session-manager: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
