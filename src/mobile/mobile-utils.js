'use strict';

const crypto = require('crypto');

const SECRET_PATTERNS = [
  /token/i, /api[_-]?key/i, /secret/i, /password/i,
  /credential/i, /TELEGRAM_TOKEN/, /DATABASE_URL/,
  /REDIS_URL/, /DASHBOARD_ADMIN_TOKEN/, /GITHUB_TOKEN/,
  /GOOGLE_CLIENT_SECRET/, /CLOUDFLARE_API_TOKEN/
];

function sanitizeMobileData(data) {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? data.map(sanitizeMobileData) : {};
  if (!Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (SECRET_PATTERNS.some(p => p.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeMobileData(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

function validateTabId(tabId) {
  if (!tabId || typeof tabId !== 'string') return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(tabId);
}

function validateSeverity(severity) {
  return ['info', 'warning', 'critical'].includes(severity);
}

function validateActionType(actionType) {
  return ['navigate', 'refresh', 'snapshot', 'action'].includes(actionType);
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  sanitizeMobileData,
  validateTabId,
  validateSeverity,
  validateActionType,
  nowIso,
  createId
};
