'use strict';

const { createEventBus } = require('../event-bus');
const { createMetricsStore } = require('../metrics-store');
const { createRealtimeHealth } = require('../monitoring-sanitizer');

test('builds health payload and snapshot', () => {
  const health = createRealtimeHealth(createEventBus(), createMetricsStore());
  expect(health.buildHealthPayload({}).status).toBe('ok');
  expect(health.getSnapshot().metrics).toEqual(expect.any(Object));
});
