'use strict';

const assert = require('assert');
const { createRoutineRegistry } = require('../src/routines/routine-registry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const registry = createRoutineRegistry({ auditLog: [] });

test('Routine registry creates routines', () => {
  const r = registry.createRoutine({ name: 'Test', type: 'briefing', schedule: 'daily' });
  assert.ok(r.id, 'Should have id');
  assert.strictEqual(r.name, 'Test');
  assert.strictEqual(r.enabled, true);
});

test('Routine registry lists routines', () => {
  const list = registry.listRoutines();
  assert.ok(list.length > 0);
});

test('Routine registry gets routine by id', () => {
  const list = registry.listRoutines();
  if (list.length > 0) {
    const r = registry.getRoutine(list[0].id);
    assert.ok(r);
    assert.strictEqual(r.id, list[0].id);
  }
});

test('Routine registry enables/disables routines', () => {
  const r = registry.createRoutine({ name: 'Toggle Test', type: 'briefing', schedule: 'manual' });
  assert.strictEqual(r.enabled, true);
  registry.disableRoutine(r.id);
  const disabled = registry.getRoutine(r.id);
  assert.strictEqual(disabled.enabled, false);
  registry.enableRoutine(r.id);
  const enabled = registry.getRoutine(r.id);
  assert.strictEqual(enabled.enabled, true);
});

test('Routine registry updates schedule', () => {
  const r = registry.createRoutine({ name: 'Schedule Test', type: 'briefing', schedule: 'manual' });
  const updated = registry.updateRoutineSchedule(r.id, 'daily');
  assert.ok(updated);
  assert.strictEqual(updated.schedule, 'daily');
});

test('Routine registry removes routine (soft)', () => {
  const r = registry.createRoutine({ name: 'Remove Test', type: 'briefing', schedule: 'manual' });
  const result = registry.removeRoutine(r.id);
  assert.strictEqual(result, true);
  const after = registry.getRoutine(r.id);
  assert.strictEqual(after.enabled, false);
});

test('Routine registry creates default routines', () => {
  const reg2 = createRoutineRegistry({ auditLog: [] });
  const created = reg2.createDefaultRoutines();
  assert.ok(created.length > 0);
  const all = reg2.listRoutines();
  assert.ok(all.length > 0);
});

test('Routine limits notifications per day', () => {
  const r = registry.createRoutine({ name: 'Notif Test', type: 'briefing', schedule: 'daily', maxNotificationsPerDay: 2 });
  assert.strictEqual(r.maxNotificationsPerDay, 2);
});

test('Routine defaults to low risk', () => {
  const r = registry.createRoutine({ name: 'Risk Test', type: 'backup_check', schedule: 'daily' });
  assert.strictEqual(r.riskLevel, 'low');
  assert.strictEqual(r.mode, 'manual');
  assert.strictEqual(r.enabled, true);
});

console.log(`\n📊 Routine Registry Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
