'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const healthMonitor = require('./health-monitor');
const diagnosticsEngine = require('./diagnostics-engine');

function classifyIncident(health, diagnosis) {
  if (health.status === 'critical' || diagnosis.severity === 'critical') return 'critical';
  if (health.status === 'degraded' || diagnosis.severity === 'degraded') return 'incident';
  if (diagnosis.severity === 'warning') return 'warning';
  return 'info';
}

function createIncident(payload = {}, services = {}) {
  const state = store.getOpsState(services);
  const incident = {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: guards.sanitizeText(payload.title || 'Operational event', 160),
    classification: payload.classification || 'info',
    status: 'open',
    severity: payload.severity || payload.classification || 'info',
    suspectedCause: guards.sanitizeText(payload.suspectedCause || '-', 300),
    recommendedFixes: (payload.recommendedFixes || []).slice(0, 6).map(item => guards.sanitizeText(item, 220)),
    confidence: Number(payload.confidence || 0.5),
    createdAt: guards.nowIso(),
    updatedAt: guards.nowIso(),
    resolvedAt: null,
    eventKey: payload.eventKey || null
  };
  store.appendBounded(state.incidents, incident, state.config.maxIncidents);
  store.compactState(state);
  store.saveOpsState(services);
  return incident;
}

function detectIncident(services = {}, input = {}) {
  const state = store.getOpsState(services);
  const health = input.health || healthMonitor.getHealth(services);
  const diagnosis = input.diagnosis || diagnosticsEngine.diagnose(services, { health });
  const classification = classifyIncident(health, diagnosis);
  const eventKey = `${classification}:${diagnosis.diagnosis}:${diagnosis.suspectedCause}`;

  if (classification === 'info') {
    return { detected: false, classification, health, diagnosis };
  }

  if (guards.suppressFalsePositive(state, eventKey, 3 * 60 * 1000, classification === 'critical' ? 1 : 2)) {
    store.saveOpsState(services);
    return {
      detected: false,
      classification,
      suppressed: true,
      health,
      diagnosis
    };
  }

  const existing = (state.incidents || []).slice().reverse().find(item => {
    return item.status === 'open' && item.eventKey === eventKey;
  });
  if (existing) {
    existing.updatedAt = guards.nowIso();
    existing.confidence = Math.max(existing.confidence || 0, diagnosis.confidence || 0);
    store.saveOpsState(services);
    return { detected: true, incident: existing, classification, health, diagnosis };
  }

  const incident = createIncident({
    title: `Operational ${classification}: ${diagnosis.diagnosis}`,
    classification,
    severity: diagnosis.severity,
    suspectedCause: diagnosis.suspectedCause,
    recommendedFixes: diagnosis.recommendedFixes,
    confidence: diagnosis.confidence,
    eventKey
  }, services);

  return { detected: true, incident, classification, health, diagnosis };
}

function updateIncident(incidentId, patch = {}, services = {}) {
  const state = store.getOpsState(services);
  const incident = (state.incidents || []).find(item => item.id === incidentId);
  if (!incident) return { ok: false, reason: 'incident_not_found' };
  Object.assign(incident, {
    ...patch,
    updatedAt: guards.nowIso()
  });
  store.saveOpsState(services);
  return { ok: true, incident };
}

function resolveIncident(incidentId, services = {}) {
  return updateIncident(incidentId, {
    status: 'resolved',
    resolvedAt: guards.nowIso()
  }, services);
}

function listRecentIncidents(services = {}, limit = 8) {
  const state = store.getOpsState(services);
  return (state.incidents || []).slice(-limit).reverse();
}

module.exports = {
  detectIncident,
  classifyIncident,
  createIncident,
  updateIncident,
  resolveIncident,
  listRecentIncidents
};
