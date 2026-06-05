'use strict';

const { createStore } = require('../cicd-store');

const mockStorage = { data: {}, async get(k) { return this.data[k] || null; }, async set(k, v) { this.data[k] = v; } };

(async () => {
  const store = createStore(mockStorage);
  await store.addRelease({ version: 'v2.0.1', status: 'proposed' });
  const releases = await store.getReleases();
  console.assert(releases.length === 1, 'Should have 1 release');
  console.assert(releases[0].version === 'v2.0.1', 'Version should match');
  await store.saveProposal({ version: 'v2.0.1', status: 'proposed' });
  const proposals = await store.getProposals();
  console.assert(proposals.length === 1, 'Should have 1 proposal');
  await store.savePipeline({ status: 'running' });
  const pipelines = await store.getPipelines();
  console.assert(pipelines.length === 1, 'Should have 1 pipeline');
  console.log('cicd-store tests passed');
})();
