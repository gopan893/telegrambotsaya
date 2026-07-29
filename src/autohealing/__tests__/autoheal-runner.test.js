'use strict';

const { createStore } = require('../autoheal-store');
const { createActions } = require('../autoheal-actions');
const { createRunner } = require('../autoheal-runner');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

test('runs enabled low-risk auto-heal action', async () => {
  const store = createStore(mockStorage);
  await store.upsertAction({ id: 'ah_test1', name: 'Test Action', enabled: true, level: 'L1', riskLevel: 'low', handlerName: 'clearExpiredRoutineLocks', cooldownSeconds: 0, maxRunsPerDay: 100 });
  const runner = createRunner(store, createActions(store, {}), {});
  await expect(runner.runAutoHeal('ah_test1', { workspaceId: 'w1', trigger: 'test' })).resolves.toMatchObject({ ok: true });
});
