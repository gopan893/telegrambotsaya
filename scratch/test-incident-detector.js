'use strict';

const assert = require('assert');
const detector = require('../src/observability/incident-detector');

(async () => {
  const services = {};
  const health = { status: 'unhealthy', blockers: ['dashboard unreachable'], warnings: [], checks: [{ id: 'dashboard', status: 'unhealthy' }] };
  const first = await detector.detectIncidentFromHealthCheck(health, services);
  const second = await detector.detectIncidentFromHealthCheck(health, services);
  assert(first.ok && first.incident, 'incident created');
  assert(second.deduped, 'duplicate incident deduped');
  assert.strictEqual(first.incident.source, 'production_health');
  assert(!JSON.stringify(first).includes('DATABASE_URL='), 'no secret leak');
  console.log('test-incident-detector: ok');
})();
