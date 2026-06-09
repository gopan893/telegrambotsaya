'use strict';

const crypto = require('crypto');

function generateId(prefix) {
  return (prefix || 'rel') + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function formatTimestamp(date) {
  const d = date || new Date();
  return d.toISOString();
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

module.exports = { generateId, formatTimestamp, safeString, safeNumber, safeArray, safeObject, redactSecrets };
