'use strict';

const { createStore } = require('../cicd-store');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

test('stores releases, proposals, and pipelines', async () => {
  const store = createStore(mockStorage);
  await store.addRelease({ version: 'v2.0.1', status: 'proposed' });
  expect(await store.getReleases()).toEqual([expect.objectContaining({ version: 'v2.0.1' })]);
  await store.saveProposal({ version: 'v2.0.1', status: 'proposed' });
  expect(await store.getProposals()).toHaveLength(1);
  await store.savePipeline({ status: 'running' });
  expect(await store.getPipelines()).toHaveLength(1);
});
