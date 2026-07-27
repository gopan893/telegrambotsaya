'use strict';

const { createStore } = require('../autoheal-store');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

(async () => {
  const store = createStore(mockStorage);
  await store.upsertAction({ id: 'test1', name: 'Test', handlerName: 'test', level: 'L1' });
  const actions = await store.getActions();
  console.assert(actions.length > 0, 'Store should have actions');
  console.assert(actions.find(a => a.id === 'test1'), 'Should find test1 action');
  const run = await store.saveRun({ actionId: 'test1', status: 'completed' });
  console.assert(run.id, 'Run should have an id');
  console.log('autoheal-store tests passed');
})();
