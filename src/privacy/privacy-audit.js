'use strict';

const EVENTS = [];

function recordPrivacyAudit(event) {
  if (!event) return null;
  const entry = { ...event, id: require('crypto').createHash('sha1').update(`pa:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16), timestamp: new Date().toISOString() };
  if (entry.details && typeof entry.details === 'object') { const s = JSON.stringify(entry.details); if (/(token|secret|password|api_key)/i.test(s)) entry.details = { redacted: true }; }
  EVENTS.push(entry); return entry;
}

function listPrivacyAudit(filters = {}) {
  let r = [...EVENTS]; const { type, userId, limit } = filters;
  if (type) r = r.filter(e => e.type === type);
  if (userId) r = r.filter(e => e.userId === userId);
  r.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (limit) r = r.slice(0, limit);
  return r;
}

function sanitizePrivacyAuditEvent(event) {
  if (!event) return null;
  const safe = { ...event };
  if (safe.details && typeof safe.details === 'object') { const s = JSON.stringify(safe.details); if (/(token|secret|password|api_key)/i.test(s)) safe.details = { redacted: true }; }
  return safe;
}

function summarizePrivacyAudit(filters = {}) {
  const events = listPrivacyAudit(filters);
  const byType = {};
  for (const e of events) { byType[e.type] = (byType[e.type] || 0) + 1; }
  return { total: events.length, byType };
}

module.exports = { recordPrivacyAudit, listPrivacyAudit, sanitizePrivacyAuditEvent, summarizePrivacyAudit };
