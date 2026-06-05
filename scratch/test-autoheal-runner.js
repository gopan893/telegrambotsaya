'use strict';

const assert = require('assert');
const { createStore } = require('../src/autohealing/autoheal-store');
const { createActions } = require('../src/autohealing/autoheal-actions');
const { createRunner } = require('../src/autohealing/autoheal-runner');

const memoryStorage = {
  data: {},
  async safeRead(key, fallback) { return this.data[key] || fallback; },
  async safeWrite(key, value) { this.data[key] = value; return true; }
};

async function run() {
  const store = createStore(memoryStorage);
  await store.upsertAction({ id: 'ah_l1', name: 'L1', enabled: true, level: 'L1', riskLevel: 'low', handlerName: 'clearExpiredRoutineLocks', cooldownSeconds: 0, maxRunsPerDay: 100 });
  await store.upsertAction({ id: 'ah_l2', name: 'L2', enabled: true, level: 'L2', riskLevel: 'high', requiresApproval: true, requiresEvaluation: true, handlerName: 'proposeCodeRepair' });
  await store.upsertAction({ id: 'ah_l3', name: 'L3', enabled: false, level: 'L3', riskLevel: 'critical', handlerName: 'shellExec' });

  const actions = createActions(store, {});
  const runner = createRunner(store, actions, {});

  const l1 = await runner.runAutoHeal('ah_l1', { workspaceId: 'w1', trigger: 'test' });
  assert.strictEqual(l1.ok, true, 'L1 autoheal runs');
  assert.strictEqual(l1.status, 'completed', 'L1 completed');

  const l2 = await runner.runAutoHeal('ah_l2', { workspaceId: 'w1', trigger: 'test' });
  assert.strictEqual(l2.ok, true, 'L2 creates proposal/plan path');
  assert.strictEqual(l2.status, 'proposal_created', 'L2 proposal only');

  const l3 = await runner.runAutoHeal('ah_l3', { workspaceId: 'w1', trigger: 'test' });
  assert.strictEqual(l3.ok, false, 'L3 cannot run');

  const runs = await store.getRuns();
  assert(runs.some(item => item.actionId === 'ah_l1'), 'run persisted through safeRead/safeWrite storage');

  console.log('test-autoheal-runner: ok');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
