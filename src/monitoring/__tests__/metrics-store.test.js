'use strict';

const { createMetricsStore } = require('../metrics-store');

test('sets, increments, and snapshots metrics', () => {
  const metrics = createMetricsStore();
  metrics.set('test_key', 42);
  metrics.increment('counter');
  metrics.increment('counter', 5);
  expect(metrics.get('test_key').value).toBe(42);
  expect(metrics.get('counter').value).toBe(6);
  expect(metrics.snapshot()).toMatchObject({ test_key: 42, counter: 6 });
});
