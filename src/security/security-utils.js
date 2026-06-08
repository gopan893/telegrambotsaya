'use strict';

const crypto = require('crypto');

const REDACTED = '[REDACTED_SECRET]';

function generateId(prefix) {
  return crypto.createHash('sha1').update(`${prefix || 'sec'}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function redactValue(value) {
  if (!value || typeof value !== 'string') return value;
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

function redactAll(value) {
  return REDACTED;
}

function safeEnvName(name) {
  return name || 'unknown';
}

function sanitizeReportText(text) {
  if (!text) return '';
  return String(text).replace(/(token|secret|password|api[_-]?key|auth)[=\s:]+['"]?\S+['"]?/gi, '$1=[REDACTED]');
}

function formatTimestamp(date) {
  return (date || new Date()).toISOString();
}

function truncateArray(arr, max) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max || 100);
}

function categorizeSeverity(value) {
  if (value >= 95) return 'excellent';
  if (value >= 85) return 'good';
  if (value >= 70) return 'needs_attention';
  return 'unsafe';
}

module.exports = {
  REDACTED,
  generateId,
  redactValue,
  redactAll,
  safeEnvName,
  sanitizeReportText,
  formatTimestamp,
  truncateArray,
  categorizeSeverity
};
