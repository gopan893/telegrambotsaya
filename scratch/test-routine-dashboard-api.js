'use strict';

const assert = require('assert');
const { createRoutineRegistry } = require('../src/routines/routine-registry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

function mockReq(body, params, query) {
  return { body: body || {}, params: params || {}, query: query || {}, user: { userId: 'admin' } };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

const registry = createRoutineRegistry({ auditLog: [] });

test('Dashboard API creates routine', () => {
  const r = registry.createRoutine({ name: 'API Test', type: 'briefing', schedule: 'daily' });
  assert.ok(r.id);
  assert.strictEqual(r.name, 'API Test');
});

test('Dashboard API lists routines', () => {
  const list = registry.listRoutines();
  assert.ok(Array.isArray(list));
});

test('Dashboard API gets routine by id', () => {
  const r = registry.createRoutine({ name: 'Get Test', type: 'briefing', schedule: 'manual' });
  const found = registry.getRoutine(r.id);
  assert.ok(found);
  assert.strictEqual(found.id, r.id);
});

test('Dashboard API enables/disables routine', () => {
  const r = registry.createRoutine({ name: 'Toggle API', type: 'briefing', schedule: 'manual' });
  registry.disableRoutine(r.id);
  assert.strictEqual(registry.getRoutine(r.id).enabled, false);
  registry.enableRoutine(r.id);
  assert.strictEqual(registry.getRoutine(r.id).enabled, true);
});

test('Dashboard API creates and lists runs', () => {
  const store = registry.routineStore;
  const run = store.createRun({ routineId: 'test', workspaceId: 'default', userId: 'test', mode: 'manual' });
  assert.ok(run.id);

  const runs = store.listRuns({});
  assert.ok(runs.length > 0);
});

test('Dashboard API creates and lists notifications', () => {
  const store = registry.routineStore;
  const notif = store.createNotification({ routineId: 'test', runId: 'run1', userId: 'test', message: 'Test notification' });
  assert.ok(notif.id);

  const notifications = store.listNotifications({});
  assert.ok(notifications.length > 0);
});

test('Dashboard API default routines exist', () => {
  const reg2 = createRoutineRegistry({ auditLog: [] });
  reg2.createDefaultRoutines();
  const list = reg2.listRoutines();
  const types = list.map(r => r.type);
  assert.ok(types.includes('briefing'));
  assert.ok(types.includes('backup_check'));
  assert.ok(types.includes('ops_check'));
});

test('Dashboard API routine modes are validated', () => {
  const r = registry.createRoutine({ name: 'Mode Test', type: 'briefing', schedule: 'daily', mode: 'scheduled_readonly' });
  assert.strictEqual(r.mode, 'scheduled_readonly');
});

test('Dashboard API routine risk levels are set', () => {
  const r = registry.createRoutine({ name: 'Risk API', type: 'backup_check', schedule: 'daily', riskLevel: 'low' });
  assert.strictEqual(r.riskLevel, 'low');
});

console.log(`\n📊 Routine Dashboard API Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
