'use strict';

const auditLog = require('../dashboard/audit-log');
const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

const PRODUCTION_INCIDENTS_KEY = 'production_incidents';
const INCIDENT_EVENTS_KEY = 'incident_events';
const INCIDENT_RESPONSE_PLANS_KEY = 'incident_response_plans';
const INCIDENT_NOTIFICATIONS_KEY = 'incident_notifications';

async function loadData(key, defaultValue, services = {}) {
  try {
    if (services.storageManager?.loadData) {
      const value = await services.storageManager.loadData(key, defaultValue);
      return typeof value === 'undefined' ? defaultValue : value;
    }
  } catch (_) {}
  if (!services.__observabilityMemory) services.__observabilityMemory = {};
  return typeof services.__observabilityMemory[key] === 'undefined'
    ? defaultValue
    : services.__observabilityMemory[key];
}

async function saveData(key, data, services = {}) {
  const safe = sanitizer.sanitize(data);
  try {
    if (services.storageManager?.saveData) {
      await services.storageManager.saveData(key, safe);
      return true;
    }
  } catch (_) {}
  if (!services.__observabilityMemory) services.__observabilityMemory = {};
  services.__observabilityMemory[key] = safe;
  return true;
}

async function audit(action, payload = {}, services = {}) {
  try {
    await auditLog.recordAuditLog({
      actorType: payload.actorType || 'observability',
      actorId: payload.actorId || payload.userId || 'system',
      action,
      targetType: payload.targetType || 'production_incident',
      targetId: payload.targetId || payload.id || '',
      userId: payload.userId || '',
      workspaceId: payload.workspaceId || 'default',
      decision: payload.decision || 'allowed',
      status: payload.status || 'ok',
      reason: payload.reason || '',
      afterSummary: sanitizer.sanitize(payload.summary || payload.afterSummary || payload)
    }, services);
  } catch (_) {}
}

async function listIncidents(filters = {}, services = {}) {
  const items = await loadData(PRODUCTION_INCIDENTS_KEY, [], services);
  return (Array.isArray(items) ? items : [])
    .filter(item => !filters.status || item.status === filters.status || (filters.status === 'open' && utils.isOpenIncident(item)))
    .filter(item => !filters.severity || item.severity === filters.severity)
    .filter(item => !filters.workspaceId || item.workspaceId === filters.workspaceId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, Math.min(Number(filters.limit || 50), 200));
}

async function getIncident(incidentId, services = {}) {
  const items = await loadData(PRODUCTION_INCIDENTS_KEY, [], services);
  return (Array.isArray(items) ? items : []).find(item => item.id === incidentId) || null;
}

async function upsertIncident(input = {}, services = {}) {
  const now = utils.nowIso();
  const incident = sanitizer.sanitizeIncident({
    id: input.id || utils.createId('inc'),
    workspaceId: input.workspaceId || 'default',
    title: utils.compactText(input.title || 'Production incident', 180),
    summary: utils.compactText(input.summary || input.description || '', 900),
    severity: utils.normalizeSeverity(input.severity || 'low'),
    status: utils.normalizeIncidentStatus(input.status || 'open'),
    source: input.source || 'observability',
    affectedSystems: utils.unique(input.affectedSystems || []),
    firstSeenAt: input.firstSeenAt || now,
    lastSeenAt: input.lastSeenAt || now,
    timeline: Array.isArray(input.timeline) ? input.timeline.slice(0, 100) : [],
    rootCauseHypothesis: input.rootCauseHypothesis || null,
    responsePlanId: input.responsePlanId || '',
    proposalIds: Array.isArray(input.proposalIds) ? input.proposalIds : [],
    fingerprint: input.fingerprint || utils.makeFingerprint([input.source, input.title, input.workspaceId || 'default']),
    createdAt: input.createdAt || now,
    updatedAt: now
  });
  const items = await loadData(PRODUCTION_INCIDENTS_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  const index = list.findIndex(item => item.id === incident.id);
  const next = index >= 0 ? list.map(item => item.id === incident.id ? { ...item, ...incident, createdAt: item.createdAt || incident.createdAt } : item) : list.concat(incident);
  await saveData(PRODUCTION_INCIDENTS_KEY, next.slice(-500), services);
  await audit(index >= 0 ? 'observability/incident_updated' : 'observability/incident_created', incident, services);
  return incident;
}

async function updateIncident(incidentId, patch = {}, services = {}) {
  const incident = await getIncident(incidentId, services);
  if (!incident) return null;
  return upsertIncident({ ...incident, ...patch, id: incident.id }, services);
}

async function addIncidentEvent(incidentId, event = {}, services = {}) {
  const now = utils.nowIso();
  const safeEvent = sanitizer.sanitizeTimelineDetails({
    id: event.id || utils.createId('evt'),
    incidentId,
    time: event.time || now,
    source: event.source || 'observability',
    type: event.type || 'event',
    severity: utils.normalizeSeverity(event.severity || 'info'),
    summary: utils.compactText(event.summary || '', 600),
    safeDetails: event.safeDetails || event.details || {}
  });
  const events = await loadData(INCIDENT_EVENTS_KEY, [], services);
  const next = (Array.isArray(events) ? events : []).concat(safeEvent).slice(-2000);
  await saveData(INCIDENT_EVENTS_KEY, next, services);
  const incident = await getIncident(incidentId, services);
  if (incident) {
    const timeline = (incident.timeline || []).concat(safeEvent).slice(-100);
    await updateIncident(incidentId, { timeline, lastSeenAt: now }, services);
  }
  await audit('observability/timeline_event_added', { ...safeEvent, targetId: incidentId }, services);
  return safeEvent;
}

async function getIncidentTimeline(incidentId, services = {}) {
  const events = await loadData(INCIDENT_EVENTS_KEY, [], services);
  return (Array.isArray(events) ? events : [])
    .filter(event => event.incidentId === incidentId)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

async function upsertResponsePlan(plan = {}, services = {}) {
  const now = utils.nowIso();
  const safe = sanitizer.sanitize({
    id: plan.id || utils.createId('irp'),
    incidentId: plan.incidentId,
    actions: Array.isArray(plan.actions) ? plan.actions.slice(0, 20) : [],
    riskLevel: utils.normalizeRiskLevel(plan.riskLevel || 'medium'),
    requiresEvaluation: plan.requiresEvaluation !== false,
    requiresExecutorApproval: plan.requiresExecutorApproval !== false,
    rollbackRecommended: Boolean(plan.rollbackRecommended),
    repairRecommended: Boolean(plan.repairRecommended),
    status: plan.status || 'draft',
    createdAt: plan.createdAt || now,
    updatedAt: now
  });
  const plans = await loadData(INCIDENT_RESPONSE_PLANS_KEY, [], services);
  const list = Array.isArray(plans) ? plans : [];
  const next = list.some(item => item.id === safe.id) ? list.map(item => item.id === safe.id ? { ...item, ...safe } : item) : list.concat(safe);
  await saveData(INCIDENT_RESPONSE_PLANS_KEY, next.slice(-500), services);
  await updateIncident(safe.incidentId, { responsePlanId: safe.id }, services);
  await audit('observability/response_plan_created', { ...safe, targetId: safe.id, targetType: 'incident_response_plan' }, services);
  return safe;
}

async function getResponsePlan(planId, services = {}) {
  const plans = await loadData(INCIDENT_RESPONSE_PLANS_KEY, [], services);
  return (Array.isArray(plans) ? plans : []).find(plan => plan.id === planId) || null;
}

async function listResponsePlans(filters = {}, services = {}) {
  const plans = await loadData(INCIDENT_RESPONSE_PLANS_KEY, [], services);
  return (Array.isArray(plans) ? plans : [])
    .filter(plan => !filters.incidentId || plan.incidentId === filters.incidentId)
    .slice(-100)
    .reverse();
}

async function addNotification(notification = {}, services = {}) {
  const safe = sanitizer.sanitizeNotification({
    id: notification.id || utils.createId('notif'),
    incidentId: notification.incidentId,
    channel: notification.channel || 'dashboard',
    status: notification.status || 'stored',
    summary: notification.summary || '',
    createdAt: notification.createdAt || utils.nowIso()
  });
  const notifications = await loadData(INCIDENT_NOTIFICATIONS_KEY, [], services);
  await saveData(INCIDENT_NOTIFICATIONS_KEY, (Array.isArray(notifications) ? notifications : []).concat(safe).slice(-1000), services);
  await audit('observability/notification_' + safe.status, { ...safe, targetType: 'incident_notification', targetId: safe.id }, services);
  return safe;
}

async function listNotifications(filters = {}, services = {}) {
  const notifications = await loadData(INCIDENT_NOTIFICATIONS_KEY, [], services);
  return (Array.isArray(notifications) ? notifications : [])
    .filter(item => !filters.incidentId || item.incidentId === filters.incidentId)
    .slice(-100)
    .reverse();
}

module.exports = {
  PRODUCTION_INCIDENTS_KEY,
  INCIDENT_EVENTS_KEY,
  INCIDENT_RESPONSE_PLANS_KEY,
  INCIDENT_NOTIFICATIONS_KEY,
  addIncidentEvent,
  addNotification,
  getIncident,
  getIncidentTimeline,
  getResponsePlan,
  listIncidents,
  listNotifications,
  listResponsePlans,
  loadData,
  saveData,
  updateIncident,
  upsertIncident,
  upsertResponsePlan
};
