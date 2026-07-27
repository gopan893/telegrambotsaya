'use strict';

const { createEventBus } = require('../event-bus');
const { createMetricsStore } = require('../metrics-store');
const { createRealtimeHealth } = require('../monitoring-sanitizer');

(async () => {
  const bus = createEventBus();
  const ms = createMetricsStore();
  const rh = createRealtimeHealth(bus, ms);
  const payload = rh.buildHealthPayload({});
  console.assert(payload.status === 'ok', 'Health payload should be ok');
  const snapshot = rh.getSnapshot();
  console.assert(typeof snapshot.metrics === 'object', 'Snapshot should have metrics');
  console.log('monitoring-sanitizer tests passed');
})();
