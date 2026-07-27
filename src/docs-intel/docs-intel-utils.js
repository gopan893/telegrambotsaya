'use strict';

const crypto = require('crypto');

function createId(prefix = 'docs') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeText(text, max = 500) {
  return String(text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, max).trim();
}

function sanitizePayload(payload, opts = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const maxKeys = opts.maxKeys || 200;
  const result = Array.isArray(payload) ? [] : {};
  let count = 0;
  for (const [k, v] of Object.entries(payload)) {
    if (count++ >= maxKeys) break;
    if (typeof v === 'string') result[k] = sanitizeText(v, opts.maxString || 500);
    else if (v && typeof v === 'object') result[k] = sanitizePayload(v, opts);
    else result[k] = v;
  }
  return result;
}

module.exports = { createId, sanitizeText, sanitizePayload };
