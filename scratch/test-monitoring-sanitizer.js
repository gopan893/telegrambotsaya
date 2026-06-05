'use strict';

const assert = require('assert');
const utils = require('../src/monitoring/monitoring-utils');
const { createEventBus } = require('../src/monitoring/event-bus');

const dirty = {
  title: 'contains bearer Bearer sk-secretvalue',
  safeDetails: {
    DATABASE_URL: 'postgresql://user:pass@host/db',
    nested: 'token 1234567890:ABCDEFghijklmnopqrstuvwxyz'
  }
};

const clean = utils.sanitize(dirty);
assert(!JSON.stringify(clean).includes('postgresql://'), 'database URL redacted');
assert(!JSON.stringify(clean).includes('sk-secretvalue'), 'sk-style token redacted');
assert(!JSON.stringify(clean).includes('ABCDEFghijklmnopqrstuvwxyz'), 'telegram token value redacted');
assert.strictEqual(clean.safeDetails.DATABASE_URL, '[REDACTED]', 'secret key redacted');

const bus = createEventBus();
const event = bus.emit({ topic: 'health', severity: 'info', title: 'token sk-test1234', summary: 'ok' });
assert(!JSON.stringify(event).includes('sk-test1234'), 'event bus sanitizes event values');

console.log('test-monitoring-sanitizer: ok');
