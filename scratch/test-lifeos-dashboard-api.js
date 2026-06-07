'use strict';

const assert = require('assert');
const express = require('express');
const dashboard = require('../src/dashboard');

function makeServices() {
  return {
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'life-token',
      OWNER_CHAT_ID: 'owner'
    },
    __lifeosStore: {},
    workspaceId: 'ws_life',
    userId: 'owner',
    actorId: 'owner',
    storageManager: {
      getStorageStatus: () => ({ activeDriver: 'memory', fallbackActive: false })
    },
    logger: { warn: () => {}, error: () => {}, log: () => {} }
  };
}

async function request(server, path, options = {}) {
  const port = server.address().port;
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  return { status: res.status, data, text };
}

(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  dashboard.registerDashboardRoutes(app, makeServices());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const denied = await request(server, '/api/dashboard/lifeos');
    assert.equal(denied.status, 401);

    const root = await request(server, '/api/dashboard/lifeos', { token: 'life-token' });
    assert.equal(root.status, 200);
    assert.equal(root.data.ok, true);

    const daily = await request(server, '/api/dashboard/lifeos/daily', { token: 'life-token', method: 'POST', body: { date: '2026-06-07' } });
    assert.equal(daily.status, 200);
    assert.equal(daily.data.ok, true);
    assert.equal(daily.data.plan.type, 'daily_plan');

    const task = await request(server, '/api/dashboard/lifeos/tasks', { token: 'life-token', method: 'POST', body: { title: 'Dashboard task' } });
    assert.equal(task.status, 200);
    assert.equal(task.data.ok, true);

    const done = await request(server, `/api/dashboard/lifeos/tasks/${task.data.task.id}/complete`, { token: 'life-token', method: 'POST', body: {} });
    assert.equal(done.status, 200);
    assert.equal(done.data.task.status, 'done');

    const habit = await request(server, '/api/dashboard/lifeos/habits', { token: 'life-token', method: 'POST', body: { title: 'Dashboard habit' } });
    assert.equal(habit.status, 200);
    const checkin = await request(server, `/api/dashboard/lifeos/habits/${habit.data.habit.id}/checkin`, { token: 'life-token', method: 'POST', body: {} });
    assert.equal(checkin.status, 200);

    const proposal = await request(server, '/api/dashboard/lifeos/integration-proposal', { token: 'life-token', method: 'POST', body: { kind: 'calendar', title: 'Meeting' } });
    assert.equal(proposal.status, 200);
    assert.equal(proposal.data.proposal.directExternalWrite, false);
    assert.equal(proposal.data.proposal.didExecute, false);

    const secret = await request(server, '/api/dashboard/lifeos/mood', { token: 'life-token', method: 'POST', body: { note: 'DATABASE_URL=postgresql://secret' } });
    assert.equal(secret.status, 400);
    assert.ok(!/postgresql:\/\/secret/.test(secret.text));

    console.log('test-lifeos-dashboard-api: ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
