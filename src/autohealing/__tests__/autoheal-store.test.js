'use strict';

const { createStore } = require('../autoheal-store');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

test('stores actions and creates run IDs', async () => {
  const store = createStore(mockStorage);
  await store.upsertAction({ id: 'test1', name: 'Test', handlerName: 'test', level: 'L1' });
  expect(await store.getActions()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'test1' })]));
  const run = await store.saveRun({ actionId: 'test1', status: 'completed' });
  expect(run.id).toBeTruthy();
});
