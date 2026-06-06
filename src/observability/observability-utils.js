'use strict';

const crypto = require('crypto');

const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'];
const STATUS_ORDER = ['healthy', 'degraded', 'unhealthy', 'unknown'];
const RISK_ORDER = ['low', 'medium', 'high', 'danger'];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'obs') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeSeverity(value = 'low') {
  const clean = String(value || '').toLowerCase();
  return SEVERITY_ORDER.includes(clean) ? clean : 'low';
}

function normalizeIncidentStatus(value = 'open') {
  const clean = String(value || '').toLowerCase();
  return ['open', 'investigating', 'mitigating', 'resolved', 'closed'].includes(clean) ? clean : 'open';
}

function normalizeHealthStatus(value = 'unknown') {
  const clean = String(value || '').toLowerCase();
  return STATUS_ORDER.includes(clean) ? clean : 'unknown';
}

function normalizeRiskLevel(value = 'medium') {
  const clean = String(value || '').toLowerCase();
  return RISK_ORDER.includes(clean) ? clean : 'medium';
}

function maxSeverity(values = []) {
  return values
    .map(normalizeSeverity)
    .sort((a, b) => SEVERITY_ORDER.indexOf(b) - SEVERITY_ORDER.indexOf(a))[0] || 'info';
}

function maxRisk(values = []) {
  return values
    .map(normalizeRiskLevel)
    .sort((a, b) => RISK_ORDER.indexOf(b) - RISK_ORDER.indexOf(a))[0] || 'low';
}

function compactText(value = '', max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function statusFromChecks(checks = []) {
  const statuses = safeArray(checks).map(check => normalizeHealthStatus(check.status));
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.length && statuses.every(status => status === 'healthy')) return 'healthy';
  return statuses.length ? 'degraded' : 'unknown';
}

function isOpenIncident(incident = {}) {
  return ['open', 'investigating', 'mitigating'].includes(normalizeIncidentStatus(incident.status));
}

function makeFingerprint(parts = []) {
  return crypto.createHash('sha256').update(parts.map(part => String(part || '').toLowerCase()).join('|')).digest('hex').slice(0, 20);
}

module.exports = {
  SEVERITY_ORDER,
  RISK_ORDER,
  compactText,
  createId,
  isOpenIncident,
  makeFingerprint,
  maxRisk,
  maxSeverity,
  normalizeHealthStatus,
  normalizeIncidentStatus,
  normalizeRiskLevel,
  normalizeSeverity,
  nowIso,
  safeArray,
  statusFromChecks,
  unique
};
