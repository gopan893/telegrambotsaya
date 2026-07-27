'use strict';

const { createStore } = require('../autoheal-store');
const { createActions } = require('../autoheal-actions');
const { createRunner } = require('../autoheal-runner');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

(async () => {
  const store = createStore(mockStorage);
  await store.upsertAction({ id: 'ah_test1', name: 'Test Action', enabled: true, level: 'L1', riskLevel: 'low', handlerName: 'clearExpiredRoutineLocks', cooldownSeconds: 0, maxRunsPerDay: 100 });
  const actions = createActions(store, {});
  const runner = createRunner(store, actions, {});
  const result = await runner.runAutoHeal('ah_test1', { workspaceId: 'w1', trigger: 'test' });
  console.assert(result.ok, 'Runner should succeed: ' + JSON.stringify(result));
  console.log('autoheal-runner tests passed');
})();
