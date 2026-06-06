'use strict';

const store = require('./incident-store');
const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

const NOTIFY_WINDOW_MS = 10 * 60 * 1000;

async function suppressDuplicateIncidentNotification(incident = {}, services = {}) {
  const notifications = await store.listNotifications({ incidentId: incident.id }, services);
  const latest = notifications[0];
  if (!latest) return false;
  const age = Date.now() - new Date(latest.createdAt).getTime();
  return Number.isFinite(age) && age < NOTIFY_WINDOW_MS;
}

async function shouldNotifyIncident(incident = {}, services = {}) {
  if (!incident?.id) return false;
  if (await suppressDuplicateIncidentNotification(incident, services)) return false;
  return ['critical', 'high'].includes(incident.severity) || incident.status === 'open';
}

function buildIncidentNotification(incident = {}, services = {}) {
  return sanitizer.sanitize({
    title: `Incident ${incident.severity || 'info'}: ${incident.title || incident.id}`,
    text: [
      `Incident: ${incident.title || incident.id}`,
      `Severity: ${incident.severity || 'info'}`,
      `Status: ${incident.status || 'open'}`,
      `Affected: ${(incident.affectedSystems || []).join(', ') || '-'}`,
      `Next: buka dashboard Observability atau gunakan /incident ${incident.id}`
    ].join('\n'),
    incidentId: incident.id,
    createdAt: utils.nowIso()
  });
}

async function sendIncidentNotification(incident = {}, services = {}) {
  if (!await shouldNotifyIncident(incident, services)) {
    return store.addNotification({
      incidentId: incident.id,
      channel: 'dashboard',
      status: 'suppressed',
      summary: 'Duplicate or low-priority notification suppressed.'
    }, services);
  }
  const notification = buildIncidentNotification(incident, services);
  try {
    if (services.ownerChatId && services.sendChunkedMessage) {
      await services.sendChunkedMessage(services.ownerChatId, notification.text);
      return store.addNotification({ ...notification, channel: 'telegram', status: 'sent', summary: notification.title }, services);
    }
  } catch (_) {}
  return store.addNotification({ ...notification, channel: 'dashboard', status: 'stored', summary: notification.title }, services);
}

module.exports = {
  buildIncidentNotification,
  sendIncidentNotification,
  shouldNotifyIncident,
  suppressDuplicateIncidentNotification
};
