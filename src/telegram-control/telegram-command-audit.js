'use strict';

const utils = require('./telegram-utils');

const auditLog = [];
const MAX_LOG_SIZE = 10000;

function recordTelegramCommandAudit(event) {
  if (!event) return null;

  const sanitized = sanitizeTelegramAuditEvent(event);
  const record = {
    id: utils.generateId('aud'),
    workspaceId: sanitized.workspaceId || null,
    userId: sanitized.userId || null,
    chatId: sanitized.chatId || null,
    command: sanitized.command || null,
    intent: sanitized.intent || null,
    module: sanitized.module || null,
    riskLevel: sanitized.riskLevel || 'unknown',
    actionType: sanitized.actionType || null,
    allowed: sanitized.allowed !== false,
    proposalId: sanitized.proposalId || null,
    resultStatus: sanitized.resultStatus || 'completed',
    reason: sanitized.reason || null,
    createdAt: utils.getCurrentTimestamp()
  };

  auditLog.push(record);
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_LOG_SIZE);
  }

  return record;
}

function listTelegramCommandAudit(filters) {
  let result = [...auditLog];

  if (filters) {
    if (filters.limit) {
      result = result.slice(-filters.limit);
    }
    if (filters.command) {
      result = result.filter(e => e.command === filters.command);
    }
    if (filters.module) {
      result = result.filter(e => e.module === filters.module);
    }
    if (filters.userId) {
      result = result.filter(e => e.userId === filters.userId);
    }
    if (filters.chatId) {
      result = result.filter(e => e.chatId === String(filters.chatId));
    }
    if (filters.allowed !== undefined) {
      result = result.filter(e => e.allowed === filters.allowed);
    }
    if (filters.riskLevel) {
      result = result.filter(e => e.riskLevel === filters.riskLevel);
    }
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      result = result.filter(e => new Date(e.createdAt).getTime() >= since);
    }
  }

  return result.slice(-100);
}

function sanitizeTelegramAuditEvent(event) {
  if (!event || typeof event !== 'object') return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(event)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password') || key.toLowerCase().includes('key')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = utils.sanitizeText(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getAuditLogSize() {
  return auditLog.length;
}

function clearAuditLog() {
  auditLog.length = 0;
}

module.exports = {
  recordTelegramCommandAudit,
  listTelegramCommandAudit,
  sanitizeTelegramAuditEvent,
  getAuditLogSize,
  clearAuditLog
};
