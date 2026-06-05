'use strict';

const { createEventBus } = require('../event-bus');

(async () => {
  const bus = createEventBus();
  const events = [];
  const unsub = bus.on('health', e => events.push(e));
  const ev = bus.emit({ topic: 'health', severity: 'info', title: 'Test', summary: 'test event' });
  console.assert(ev.id, 'Event should have id');
  console.assert(events.length === 1, 'Listener should fire');
  const history = bus.getHistory({ topic: 'health' });
  console.assert(history.length >= 1, 'History should contain event');
  unsub();
  bus.emit({ topic: 'health', title: 'After unsub' });
  console.assert(events.length === 1, 'Unsubscribed listener should not fire');
  console.log('event-bus tests passed');
})();
