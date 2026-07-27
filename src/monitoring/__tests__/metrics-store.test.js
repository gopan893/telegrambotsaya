'use strict';

const { createMetricsStore } = require('../metrics-store');

(async () => {
  const ms = createMetricsStore();
  ms.set('test_key', 42);
  console.assert(ms.get('test_key').value === 42, 'Get should return set value');
  ms.increment('counter');
  ms.increment('counter', 5);
  console.assert(ms.get('counter').value === 6, 'Increment should work');
  const snap = ms.snapshot();
  console.assert(snap.test_key === 42, 'Snapshot should include test_key');
  console.assert(snap.counter === 6, 'Snapshot should include counter');
  console.log('metrics-store tests passed');
})();
