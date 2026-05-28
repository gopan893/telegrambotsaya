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
    category: guards.sanitizeText(payload.category || payload.classification || 'ops', 80),
    classification: payload.classification || 'info',
    status: 'open',
    severity: payload.severity || payload.classification || 'info',
    evidence: (payload.evidence || []).slice(0, 8).map(item => guards.sanitizeText(item, 220)),
    suspectedCause: guards.sanitizeText(payload.suspectedCause || '-', 300),
    recommendedActions: (payload.recommendedActions || payload.recommendedFixes || []).slice(0, 8).map(item => guards.sanitizeText(item, 220)),
    recommendedFixes: (payload.recommendedFixes || []).slice(0, 6).map(item => guards.sanitizeText(item, 220)),
    confidence: Number(payload.confidence || 0.5),
    createdAt: guards.nowIso(),
    updatedAt: guards.nowIso(),
    resolvedAt: null,
    lessons: [],
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
  let classification = classifyIncident(health, diagnosis);
  const escalation = guards.incidentEscalationGuard(state, classification, (diagnosis.evidence || []).length);
  classification = escalation.severity || classification;
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
    category: diagnosis.category,
    classification,
    severity: diagnosis.severity,
    evidence: diagnosis.evidence,
    suspectedCause: diagnosis.suspectedCause,
    recommendedActions: diagnosis.recommendedFixes,
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
  const result = updateIncident(incidentId, {
    status: 'resolved',
    resolvedAt: guards.nowIso()
  }, services);
  if (result.ok && result.incident) {
    result.incident.lessons = result.incident.lessons || [];
    result.incident.lessons.push('Incident resolved. Review telemetry, benchmark, dan recovery action setelah deploy.');
    store.saveOpsState(services);
  }
  return result;
}

function listRecentIncidents(services = {}, limit = 8) {
  const state = store.getOpsState(services);
  return (state.incidents || []).slice(-limit).reverse();
}

function getIncident(incidentId, services = {}) {
  const state = store.getOpsState(services);
  return (state.incidents || []).find(item => item.id === incidentId) || null;
}

function createPostmortemDraft(incident) {
  if (!incident) return 'Incident tidak ditemukan.';
  return [
    `Postmortem Draft: ${incident.id}`,
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Suspected cause: ${incident.suspectedCause}`,
    `Evidence: ${(incident.evidence || []).join(', ') || '-'}`,
    'Recommended actions:',
    ...((incident.recommendedActions || incident.recommendedFixes || []).map(item => `- ${item}`)),
    'Lessons:',
    ...((incident.lessons || ['Belum ada lesson.']).map(item => `- ${item}`))
  ].join('\n');
}

module.exports = {
  detectIncident,
  classifyIncident,
  createIncident,
  updateIncident,
  resolveIncident,
  listRecentIncidents,
  getIncident,
  createPostmortemDraft
};
