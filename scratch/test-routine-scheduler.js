'use strict';

const assert = require('assert');
const { createRoutineScheduler } = require('../src/routines/routine-scheduler');
const { createRoutineRegistry } = require('../src/routines/routine-registry');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const registry = createRoutineRegistry({ auditLog: [] });
const scheduler = createRoutineScheduler({ scheduleLib: null, auditLog: [] });

test('Routine scheduler creates without scheduleLib', () => {
  assert.ok(scheduler);
  assert.ok(typeof scheduler.registerRoutine === 'function');
});

test('Routine scheduler registers manual routine returns false', () => {
  const r = registry.createRoutine({ name: 'Manual', type: 'briefing', schedule: 'manual' });
  const result = scheduler.registerRoutine(r);
  assert.strictEqual(result, false);
});

test('Routine scheduler finds due routines', () => {
  const due = scheduler.getDueRoutines(registry);
  assert.ok(Array.isArray(due));
});

test('Routine scheduler unregisters routine', () => {
  const r = registry.createRoutine({ name: 'Unreg', type: 'briefing', schedule: 'daily' });
  const result = scheduler.unregisterRoutine(r.id);
  assert.ok(typeof result === 'boolean');
});

test('Routine scheduler rescheduleAll handles empty', () => {
  const emptyReg = createRoutineRegistry({ auditLog: [] });
  scheduler.rescheduleAll(emptyReg);
  assert.ok(true);
});

test('Routine scheduler returns scheduled routines list', () => {
  const list = scheduler.getScheduledRoutines();
  assert.ok(Array.isArray(list));
});

test('Routine scheduler handles invalid routine gracefully', () => {
  const result = scheduler.registerRoutine(null);
  assert.strictEqual(result, false);
});

console.log(`\n📊 Routine Scheduler Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
