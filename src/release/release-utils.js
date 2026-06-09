'use strict';

const crypto = require('crypto');

function generateId() {
  return 'rc_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function sanitizeReport(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/(TELEGRAM_TOKEN|DASHBOARD_ADMIN_TOKEN|GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|CLOUDFLARE_API_TOKEN|DATABASE_URL|REDIS_URL)=[^\s,}]+/gi, '$1=[REDACTED]')
    .replace(/(token|secret|api[_-]?key|password|auth)[:=]\s*['"]?[^\s,}'"]+['"]?/gi, '$1=[REDACTED]');
}

function formatTimestamp(date) {
  const d = date || new Date();
  return d.toISOString();
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  if (m > 0) parts.push(m + 'm');
  if (s > 0 || parts.length === 0) parts.push(s + 's');
  return parts.join(' ');
}

function safeString(val, fallback) {
  if (typeof val === 'string' && val.trim()) return val.trim();
  return fallback !== undefined ? fallback : '';
}

function safeNumber(val, fallback) {
  const n = Number(val);
  return isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
}

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

function safeObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
}

function truncate(text, maxLen) {
  if (typeof text !== 'string') return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '...';
}

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const seen = new WeakSet();
  function redact(value) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(redact);
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      const lk = k.toLowerCase();
      if (/(token|secret|key|password|auth|credential)/i.test(lk) && typeof v === 'string' && v.length > 4) {
        result[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        result[k] = redact(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return redact(obj);
}

module.exports = {
  generateId,
  sanitizeReport,
  formatTimestamp,
  formatDuration,
  safeString,
  safeNumber,
  safeArray,
  safeObject,
  truncate,
  redactSecrets
};
