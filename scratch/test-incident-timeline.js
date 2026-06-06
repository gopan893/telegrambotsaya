'use strict';

const assert = require('assert');
const store = require('../src/observability/incident-store');
const timeline = require('../src/observability/incident-timeline');

(async () => {
  const services = {};
  const incident = await store.upsertIncident({ title: 'Timeline test', severity: 'low' }, services);
  await timeline.addIncidentEvent(incident.id, { summary: 'DATABASE_URL=postgresql://user:pass@host/db', severity: 'medium' }, services);
  const events = await timeline.getIncidentTimeline(incident.id, services);
  assert.strictEqual(events.length, 1);
  assert(!JSON.stringify(events).includes('user:pass'), 'timeline secrets redacted');
  const summary = await timeline.summarizeIncidentTimeline(incident, services);
  assert(summary.includes('Events:'), 'summary built');
  console.log('test-incident-timeline: ok');
})();
