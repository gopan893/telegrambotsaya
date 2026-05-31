'use strict';

const crypto = require('crypto');
const guards = require('./dashboard-guards');

const AUDIT_KEY = 'dashboard_audit_logs';
const MAX_LOGS = 1000;

function createId() {
  if (crypto.randomUUID) return `audit_${crypto.randomUUID()}`;
  return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function hash(value = '') {
  if (!value) return '';
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function summarizeAgent(value = '') {
  return guards.preventSecretLeak(String(value || '').slice(0, 160));
}

function buildAuditEntry(entry = {}) {
  const now = new Date().toISOString();
  return sanitizeAuditEntry({
    id: entry.id || createId(),
    actorType: entry.actorType || 'dashboard',
    actorId: entry.actorId || 'admin',
    action: entry.action || 'unknown',
    targetType: entry.targetType || 'unknown',
    targetId: entry.targetId || '',
    userId: entry.userId || '',
    status: entry.status || 'ok',
    beforeSummary: guards.sanitizeBeforeAfterSummary(entry.beforeSummary || entry.before || ''),
    afterSummary: guards.sanitizeBeforeAfterSummary(entry.afterSummary || entry.after || ''),
    reason: String(entry.reason || '').slice(0, 240),
    ipHash: entry.ipHash || hash(entry.ip || ''),
    userAgentSummary: entry.userAgentSummary || summarizeAgent(entry.userAgent || ''),
    createdAt: entry.createdAt || now
  });
}

async function readLogs(services = {}) {
  if (services.storageManager?.safeRead) {
    const logs = await services.storageManager.safeRead(AUDIT_KEY, []);
    return Array.isArray(logs) ? logs : [];
  }
  if (!services.__auditLogs) services.__auditLogs = [];
  return services.__auditLogs;
}

async function writeLogs(logs, services = {}) {
  const clean = Array.isArray(logs) ? logs.slice(-MAX_LOGS) : [];
  if (services.storageManager?.safeWrite) {
    await services.storageManager.safeWrite(AUDIT_KEY, clean);
  } else {
    services.__auditLogs = clean;
  }
  return clean;
}

async function recordAuditLog(entry, services = {}) {
  const logs = await readLogs(services);
  const audit = buildAuditEntry(entry);
  logs.push(audit);
  await writeLogs(logs, services);
  return audit;
}

async function listAuditLogs(options = {}, services = {}) {
  const logs = await readLogs(services);
  const limit = guards.validateLimit(options.limit, 20, 100);
  const action = options.action ? String(options.action) : '';
  const status = options.status ? String(options.status) : '';
  const targetType = options.targetType ? String(options.targetType) : '';
  const userId = options.userId ? String(options.userId) : '';
  return logs
    .filter(entry => !action || entry.action === action)
    .filter(entry => !status || entry.status === status)
    .filter(entry => !targetType || entry.targetType === targetType)
    .filter(entry => !userId || String(entry.userId) === userId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(sanitizeAuditEntry);
}

async function getAuditSummary(options = {}, services = {}) {
  const logs = await readLogs(services);
  const recent = await listAuditLogs({ ...options, limit: options.limit || 5 }, services);
  const byStatus = logs.reduce((acc, entry) => {
    acc[entry.status || 'unknown'] = (acc[entry.status || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const byAction = logs.reduce((acc, entry) => {
    acc[entry.action || 'unknown'] = (acc[entry.action || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  return guards.preventSecretLeak({
    total: logs.length,
    byStatus,
    byAction,
    recent
  });
}

function sanitizeAuditEntry(entry = {}) {
  return guards.preventSecretLeak({
    id: entry.id,
    actorType: entry.actorType,
    actorId: String(entry.actorId || '').slice(0, 80),
    action: entry.action,
    targetType: entry.targetType,
    targetId: String(entry.targetId || '').slice(0, 120),
    userId: String(entry.userId || '').slice(0, 80),
    status: entry.status || 'ok',
    beforeSummary: guards.sanitizeBeforeAfterSummary(entry.beforeSummary || ''),
    afterSummary: guards.sanitizeBeforeAfterSummary(entry.afterSummary || ''),
    reason: String(entry.reason || '').slice(0, 240),
    ipHash: entry.ipHash || '',
    userAgentSummary: String(entry.userAgentSummary || '').slice(0, 160),
    createdAt: entry.createdAt
  });
}

async function pruneAuditLogs(services = {}) {
  const logs = await readLogs(services);
  const pruned = logs.slice(-MAX_LOGS);
  await writeLogs(pruned, services);
  return { ok: true, kept: pruned.length, pruned: Math.max(0, logs.length - pruned.length) };
}

module.exports = {
  AUDIT_KEY,
  MAX_LOGS,
  getAuditSummary,
  listAuditLogs,
  pruneAuditLogs,
  recordAuditLog,
  sanitizeAuditEntry
};
