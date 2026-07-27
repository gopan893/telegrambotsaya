'use strict';

const store = require('./device-store');
const utils = require('./device-utils');

const EVENT_TYPES = [
  'device_registered', 'device_updated', 'device_removed',
  'pairing_requested', 'pairing_approved', 'pairing_rejected',
  'health_check', 'health_degraded', 'health_recovered',
  'action_planned', 'action_simulated', 'proposal_created',
  'proposal_approved', 'proposal_rejected',
  'capability_registered', 'capability_blocked',
  'risk_classified', 'violation_detected'
];

function recordEvent(params) {
  if (!params || !params.eventType || !params.deviceId) {
    return { ok: false, error: 'Missing eventType or deviceId' };
  }
  const id = utils.createId('audit');
  const event = {
    id,
    eventType: params.eventType,
    deviceId: params.deviceId,
    deviceName: params.deviceName || '',
    severity: params.severity || 'info',
    message: utils.sanitizeText(params.message || '', 500),
    details: params.details || {},
    performedBy: params.performedBy || 'system',
    createdAt: new Date().toISOString()
  };
  store.addAuditEvent(id, event);
  return { ok: true, eventId: id, event };
}

function listEvents(filter) {
  return store.listAuditEvents(filter);
}

function getDeviceEvents(deviceId) {
  return store.listAuditEvents({ deviceId });
}

function getRecentEvents(limit) {
  const events = store.listAuditEvents();
  return events.slice(0, limit || 50);
}

function getEventTypes() {
  return EVENT_TYPES;
}

function getAuditSummary(deviceId) {
  const events = deviceId ? store.listAuditEvents({ deviceId }) : store.listAuditEvents();
  const byType = {};
  const bySeverity = {};
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
  }
  return { total: events.length, byType, bySeverity, deviceId: deviceId || 'all' };
}

module.exports = {
  recordEvent, listEvents, getDeviceEvents,
  getRecentEvents, getEventTypes, getAuditSummary, EVENT_TYPES
};
