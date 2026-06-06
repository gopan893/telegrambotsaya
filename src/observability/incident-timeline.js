'use strict';

const store = require('./incident-store');
const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

async function addIncidentEvent(incidentId, event = {}, services = {}) {
  return store.addIncidentEvent(incidentId, event, services);
}

async function getIncidentTimeline(incidentId, services = {}) {
  return store.getIncidentTimeline(incidentId, services);
}

async function buildIncidentTimelineFromLogs(incident = {}, services = {}) {
  const events = await getIncidentTimeline(incident.id, services);
  const base = events.length ? events : utils.safeArray(incident.timeline);
  return sanitizer.sanitize(base
    .sort((a, b) => String(a.time || a.createdAt).localeCompare(String(b.time || b.createdAt)))
    .slice(-100));
}

async function summarizeIncidentTimeline(incident = {}, services = {}) {
  const timeline = await buildIncidentTimelineFromLogs(incident, services);
  if (!timeline.length) return 'Belum ada timeline event untuk incident ini.';
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  return [
    `Events: ${timeline.length}`,
    `First: ${first.time || first.createdAt || '-'}`,
    `Latest: ${last.time || last.createdAt || '-'}`,
    `Latest summary: ${utils.compactText(last.summary || '', 240)}`
  ].join('\n');
}

module.exports = {
  addIncidentEvent,
  buildIncidentTimelineFromLogs,
  getIncidentTimeline,
  summarizeIncidentTimeline
};
