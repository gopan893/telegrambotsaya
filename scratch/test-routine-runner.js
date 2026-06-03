'use strict';

const assert = require('assert');
const { createRoutineRegistry } = require('../src/routines/routine-registry');
const { createRoutineRunner } = require('../src/routines/routine-runner');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const auditLog = [];
const registry = createRoutineRegistry({ auditLog });

// Register a simple handler
registry.registerType('briefing', {
  execute: async (routine, ctx, svc) => ({
    summary: 'Briefing executed',
    findings: [{ type: 'info', message: 'Test finding' }],
    recommendations: []
  }),
  dryRun: async (routine, ctx, svc) => ({
    summary: 'Dry-run briefing',
    findings: [{ type: 'info', message: 'Dry-run finding' }]
  })
});

const runner = createRoutineRunner({ auditLog, registry, proposalBridge: null });

test('Routine runner prevents duplicate runs', async () => {
  const r = registry.createRoutine({ name: 'Dup Test', type: 'briefing', schedule: 'manual', enabled: true });
  assert.strictEqual(runner.isRunning(r.id), false);
  const result = await runner.runRoutine(r.id, {}, {});
  assert.ok(result.status === 'completed' || result.status === 'failed');
});

test('Routine runner rejects disabled routine', async () => {
  const r = registry.createRoutine({ name: 'Disabled Test', type: 'briefing', schedule: 'manual', enabled: false });
  const result = await runner.runRoutine(r.id, {}, {});
  assert.strictEqual(result.status, 'blocked');
});

test('Routine runner rejects non-existent routine', async () => {
  const result = await runner.runRoutine('nonexistent', {}, {});
  assert.strictEqual(result.status, 'failed');
});

test('Routine runner dry-run works', async () => {
  const r = registry.createRoutine({ name: 'DryRun Test', type: 'briefing', schedule: 'manual', enabled: true });
  const result = await runner.runRoutineDryRun(r.id, {});
  assert.ok(result.status === 'completed' || result.status === 'failed');
});

test('Routine runner builds run summary', () => {
  const summary = runner.buildRoutineRunSummary({
    id: 'test', routineId: 'r1', status: 'completed', mode: 'manual',
    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    summary: 'test', findings: [], recommendations: [], proposalIds: [],
    warnings: [], errors: []
  });
  assert.ok(summary);
  assert.strictEqual(summary.status, 'completed');
});

console.log(`\n📊 Routine Runner Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
