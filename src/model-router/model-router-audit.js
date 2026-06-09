'use strict';

const store = require('./model-router-store');
const utils = require('./model-router-utils');

const AUDIT_EVENTS = [
  'route_selected', 'local_unavailable', 'cloud_blocked_by_privacy',
  'cost_warning', 'fallback_used', 'high_cost_route_proposal_required', 'secret_redaction_applied'
];

async function recordModelRouterAudit(event = {}, services = {}) {
  const entry = {
    id: utils.createId('audit'),
    event: event.event || 'unknown',
    detail: utils.sanitizeText(event.detail || '', 500),
    provider: utils.sanitizeText(event.provider || '', 100),
    taskClass: event.taskClass || '',
    timestamp: new Date().toISOString()
  };
  const s = await store.loadModelStore(services);
  s.audits.push(entry);
  if (s.audits.length > 200) s.audits = s.audits.slice(-200);
  await store.saveModelStore(s, services);
  return entry;
}

async function listModelRouterAudit(filters = {}, services = {}) {
  const s = await store.loadModelStore(services);
  let list = [...s.audits];
  if (filters.event) list = list.filter(a => a.event === filters.event);
  if (filters.provider) list = list.filter(a => a.provider === filters.provider);
  const limit = Math.min(Number(filters.limit || 50), 200);
  return list.slice(-limit).reverse();
}

function sanitizeModelRouterAudit(event = {}, services = {}) {
  if (!event || typeof event !== 'object') return event;
  const sanitized = { ...event };
  if (sanitized.detail) sanitized.detail = utils.sanitizeText(sanitized.detail, 500);
  return sanitized;
}

module.exports = { recordModelRouterAudit, listModelRouterAudit, sanitizeModelRouterAudit, AUDIT_EVENTS };
