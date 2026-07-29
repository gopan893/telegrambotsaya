'use strict';

const { createEventBus } = require('../event-bus');

test('emits, stores, filters, and unsubscribes events', () => {
  const bus = createEventBus();
  const events = [];
  const unsubscribe = bus.on('health', event => events.push(event));
  expect(bus.emit({ topic: 'health', severity: 'info', title: 'Test', summary: 'test event' }).id).toBeTruthy();
  expect(events).toHaveLength(1);
  expect(bus.getHistory({ topic: 'health' })).not.toHaveLength(0);
  unsubscribe();
  bus.emit({ topic: 'health', title: 'After unsubscribe' });
  expect(events).toHaveLength(1);
});
